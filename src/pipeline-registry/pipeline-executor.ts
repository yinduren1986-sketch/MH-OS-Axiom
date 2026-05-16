/**
 * pipeline-executor.ts
 *
 * Parses YAML pipeline declarations and executes them step by step.
 * Resolves dependencies, evaluates conditions, and maps inputs/outputs.
 *
 * Location: src/pipeline-registry/pipeline-executor.ts
 */

import { createHash } from "node:crypto";
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import YAML from "yaml";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface SkillCard {
  skill_id: string;
  action_verb: string;
  target_object: string;
  description: string;
  constraints?: {
    risk_level?: string;
    requires_confirmation?: boolean;
    idempotent?: boolean;
    compensating_action?: string;
  };
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  exec_log?: {
    enabled?: boolean;
    fields?: string[];
  };
}

export interface PipelineLogEntry {
  exec_id: string; // {pipeline_id}.{step_id}.{timestamp_ms}
  timestamp: string;
  pipeline_id: string;
  pipeline_step: string;
  skill_id: string;
  action_verb: string;
  input_mapping: Record<string, string>;
  resolved_inputs: Record<string, unknown>;
  input_hash: string; // SHA256 of resolved_inputs for deduplication/rollback
  output: unknown;
  output_hash?: string; // SHA256 of output (optional, for output verification)
  duration_ms: number;
  status: "success" | "failed" | "compensated";
  compensation_status: "n/a" | "triggered" | "failed" | "skipped";
  error?: string;
  linked_facts?: string[]; //因果链：相关事实id数组
}

export interface PipelineStep {
  id: string;
  skill: string;
  depends_on: string[];
  condition?: string;
  input_mapping?: Record<string, string>;
  output_as: string;
  compensating_action?: string;
}

export interface Pipeline {
  pipeline_id: string;
  description: string;
  trigger: "manual" | "scheduled" | "event";
  trigger_config: {
    cron?: string;
    event?: string;
  };
  condition: string;
  steps: PipelineStep[];
  error_policy: {
    on_step_fail: "compensate" | "pause_and_notify" | "skip_continue";
    notify_channel?: string;
    notify_target?: string;
  };
}

export interface StepContext {
  outputs: Record<string, unknown>;
  inputs: Record<string, unknown>;
  env?: Record<string, unknown>; // pipeline-level env vars (e.g. pending_count)
}

// Extends StepContext with env for interpolate use
export interface PipelineContext extends StepContext {}

/**
 * Interpolate a template string with step outputs or context values.
 * Supports:
 *   {{steps.x.output.field}}  — resolved from ctx.outputs[step_id][field]
 *   {{context.field}}         — resolved from ctx.inputs[field] (top-level context)
 *   {{user.input}}            — resolved from ctx.inputs[field]
 *
 * If a placeholder cannot be resolved, it is left as-is.
 */
export function interpolate(
  template: string,
  ctx: StepContext,
  stepIdToOutputAs?: Record<string, string>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const parts = path.trim().split(".");
    if (parts[0] === "steps" && parts.length >= 3) {
      // e.g. {{steps.scan.output.pending_count}}
      // stepId may be the step.id or the step's output_as key
      const stepId = parts[1];
      const field = parts.slice(2).join(".");
      // Try stepId as direct key first, then as output_as mapping
      let stepOutput = ctx.outputs[stepId] as Record<string, unknown> | undefined;
      if (
        (!stepOutput || !Object.prototype.hasOwnProperty.call(stepOutput, field)) &&
        stepIdToOutputAs
      ) {
        const outputAs = stepIdToOutputAs[stepId];
        if (outputAs) stepOutput = ctx.outputs[outputAs] as Record<string, unknown> | undefined;
      }
      // Handle {{steps.scan.output.pending_count}} — field="output.pending_count"
      // but real output is stored flat under output_as (e.g. {pending_count:3})
      let resolvedField = field;
      if (
        stepOutput &&
        !Object.prototype.hasOwnProperty.call(stepOutput, field) &&
        field.startsWith("output.")
      ) {
        resolvedField = field.slice(7); // strip leading "output."
      }
      if (stepOutput && Object.prototype.hasOwnProperty.call(stepOutput, resolvedField)) {
        return String(stepOutput[resolvedField]);
      }
      return `{{${path}}}`;
    }
    if (parts[0] === "context" && parts.length >= 2) {
      const field = parts[1];
      if (ctx.inputs && Object.prototype.hasOwnProperty.call(ctx.inputs, field)) {
        return String((ctx.inputs as Record<string, unknown>)[field]);
      }
      return `{{${path}}}`;
    }
    // env.* — look up from ctx.env (pipeline env vars)
    if (parts[0] === "env" && parts.length >= 2) {
      const field = parts[1];
      const envObj = (ctx as unknown as { env?: Record<string, unknown> }).env;
      if (envObj && Object.prototype.hasOwnProperty.call(envObj, field)) {
        return String(envObj[field]);
      }
      return `{{${path}}}`;
    }
    // Bare key — try ctx.inputs directly
    if (parts.length === 1) {
      const field = parts[0];
      if (ctx.inputs && Object.prototype.hasOwnProperty.call(ctx.inputs, field)) {
        return String((ctx.inputs as Record<string, unknown>)[field]);
      }
    }
    return `{{${path}}}`;
  });
}

/**
 * Evaluate a condition string to a boolean.
 * Supports:
 *   {{steps.scan.output.pending_count}} > 0   — template-interpolated comparison
 *   pending_count > 0                          — bare field from ctx.inputs
 *   OR / AND composition
 *
 * Key fix: look up field values using step output_as as key (the actual ctx.outputs
 * storage key), not the step.id.
 */
export function evaluateCondition(
  condition: string,
  ctx: StepContext,
  stepIdToOutputAs?: Record<string, string>,
): boolean {
  // First try interpolation (for template strings like {{steps.scan.output.pending_count}} > 0)
  const result = interpolate(condition, ctx, stepIdToOutputAs);

  // Only use fall-back when interpolation left unresolved {{...}} markers.
  // If interpolation fully resolved (e.g. "3 > 0"), use the resolved result directly.
  if (result.includes("{{")) {
    // Fall back to bare-field resolution from flat field-map.
    const flat: Record<string, unknown> = { ...ctx.inputs };
    for (const [, val] of Object.entries(ctx.outputs)) {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        Object.assign(flat, val as Record<string, unknown>);
      }
    }
    const trimmed = condition.trim();
    // "field > N" pattern
    const match = trimmed.match(/^(\w+)\s*([><=!]+)\s*(\d+)$/);
    if (match) {
      const [, field, op, right] = match;
      const val = flat[field];
      if (typeof val === "number") {
        const n = parseInt(right);
        switch (op) {
          case ">":
            return val > n;
          case "<":
            return val < n;
          case ">=":
            return val >= n;
          case "<=":
            return val <= n;
          case "==":
            return val === n;
          case "!=":
            return val !== n;
        }
      }
    }
    // Bare truthy key
    if (/^\w+$/.test(trimmed)) {
      const val = flat[trimmed];
      if (typeof val === "boolean") return val;
      if (typeof val === "number") return val > 0;
      return !!val;
    }
    return false;
  }

  // Handle OR / AND
  if (/OR/i.test(result))
    return result.split(/OR/i).some((p) => evaluateCondition(p.trim(), ctx, stepIdToOutputAs));
  if (/AND/i.test(result))
    return result.split(/AND/i).every((p) => evaluateCondition(p.trim(), ctx, stepIdToOutputAs));

  if (result.trim() === "true") return true;
  if (result.trim() === "false") return false;

  // Numeric evaluation for already-interpolated comparisons like "3 > 0"
  const num = parseFloat(result);
  if (!isNaN(num)) return num > 0;

  return false;
}

/**
 * Get all steps that are ready to execute (all dependencies satisfied).
 */
export function getReadySteps(
  pipeline: Pipeline,
  completed: Set<string>,
  ctx: StepContext,
  stepIdToOutputAs?: Record<string, string>,
): PipelineStep[] {
  return pipeline.steps.filter((step) => {
    if (completed.has(step.id)) return false;
    const depsMet = step.depends_on.every((dep) => completed.has(dep));
    if (!depsMet) return false;
    if (step.condition) {
      const condResult = evaluateCondition(step.condition, ctx, stepIdToOutputAs);
      console.log(
        `[getReadySteps] step=${step.id} condition=${JSON.stringify(step.condition)} depsMet=${depsMet} condResult=${condResult}`,
      );
      if (!condResult) return false;
    }
    return true;
  });
}

/**
 * Load a Skill Card JSON from the registry.
 * Returns null if not found.
 *
 * Resolves path relative to this file's directory so it works regardless of
 * the process cwd.
 */
export function loadSkillCard(skillId: string): SkillCard | null {
  const registryDir = resolve(__dirname, "../skill-catalog/registry");
  const cardPath = resolve(registryDir, `${skillId}.json`);
  if (!existsSync(cardPath)) {
    console.warn(`[PipelineExecutor] Skill Card not found: ${cardPath}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(cardPath, "utf-8")) as SkillCard;
  } catch (e) {
    console.error(`[PipelineExecutor] Failed to parse Skill Card ${skillId}: ${e}`);
    return null;
  }
}

/**
 * Append a record to the pipeline execution log.
 */
export function execLog(record: PipelineLogEntry): void {
  const logDir = resolve(__dirname, "../../../logs");
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const logPath = resolve(logDir, "pipeline-execution.jsonl");
  appendFileSync(logPath, JSON.stringify(record) + "\n");
}

/**
 * Execute a single pipeline step.
 *
 * 1. Load Skill Card from registry (skill-catalog/registry/{skill_id}.json)
 * 2. Resolve input_mapping via interpolate()
 * 3. Dispatch based on action_verb (dispatch/send/read/write/generic)
 * 4. Write execution log entry to logs/pipeline-execution.jsonl
 * 5. Return output — stored as step.output_as for downstream steps
 *
 * In standalone mode this module produces representative outputs for CI/smoke-testing.
 * In production (OpenClaw agent context), wrap dispatch/send/read/write cases with
 * real tool calls (sessions_spawn, message, feishu_doc, etc.).
 */
export async function executeStep(
  step: PipelineStep,
  ctx: StepContext,
  pipelineId: string,
): Promise<unknown> {
  const startTime = Date.now();
  const skillId = step.skill;

  // 1. Load Skill Card
  const skillCard = loadSkillCard(skillId);
  if (!skillCard) {
    throw new Error(`Skill Card not found for skill: ${skillId}`);
  }

  // 2. Resolve input_mapping via interpolate()
  const resolvedInputs: Record<string, unknown> = {};
  if (step.input_mapping) {
    for (const [key, tmpl] of Object.entries(step.input_mapping)) {
      resolvedInputs[key] = interpolate(tmpl, ctx);
    }
  }

  console.log(
    `[PipelineExecutor] Step: ${step.id} | Skill: ${skillId} (${skillCard.action_verb}) | ` +
      `Inputs: ${JSON.stringify(resolvedInputs)}`,
  );

  // 3. Execute based on action_verb
  let output: unknown;

  switch (skillCard.action_verb) {
    case "dispatch": {
      // Real: call sessions_spawn to dispatch subagent
      // Supports stale detection: if task is too old, notify only (don't spawn)
      const agentId = (resolvedInputs["agent_id"] as string) || "canmou";
      const task = resolvedInputs["task"] as string;
      const runId = (resolvedInputs["run_id"] as string) || `dispatch-${Date.now()}`;
      const createdAt = resolvedInputs["created_at"] as string | undefined;
      const staleThresholdHrs = (resolvedInputs["stale_threshold_hours"] as number) || 4;

      // Stale detection: check if task is too old
      let stale = false;
      if (createdAt) {
        const ageMs = Date.now() - new Date(createdAt).getTime();
        const thresholdMs = staleThresholdHrs * 60 * 60 * 1000;
        stale = ageMs > thresholdMs;
      }

      let dispatched = true;
      let status = "dispatched";
      let spawnSessionKey: string | undefined;

      if (stale) {
        // Too old — notify only, don't spawn
        dispatched = false;
        status = "stale";
        console.log(`[dispatch] Task ${runId} is stale (created ${createdAt}), notify only`);
      } else {
        // Normal: spawn subagent
        const result = await sessions_spawn({
          agentId,
          task,
          mode: "run",
          runtime: "subagent",
          taskId: runId,
        });
        spawnSessionKey =
          (result as { session_key?: string; runId?: string }).session_key ||
          (result as { runId?: string }).runId;
      }

      output = {
        ...(ctx.outputs[step.output_as] as Record<string, unknown>),
        skill_id: skillId,
        action_verb: skillCard.action_verb,
        target_object: skillCard.target_object,
        inputs: resolvedInputs,
        pending_count: resolvedInputs["pending_count"],
        pending_tasks: resolvedInputs["pending_tasks"],
        new_complete_count: resolvedInputs["new_complete_count"],
        timeout_count: resolvedInputs["timeout_count"],
        dispatched,
        stale,
        stale_threshold_hours: staleThresholdHrs,
        ...(spawnSessionKey && { spawn_session_key: spawnSessionKey }),
        dispatched_at: new Date().toISOString(),
        status,
      };
      break;
    }

    case "send": {
      // Real: call message tool (channel, target, message)
      const channel = (resolvedInputs["channel"] as string) || "qqbot";
      const target = resolvedInputs["target"] as string;
      const message = resolvedInputs["message"] as string;

      const msgResult = await message({
        action: "send",
        channel,
        target,
        message,
      });

      output = {
        skill_id: skillId,
        action_verb: skillCard.action_verb,
        target_object: skillCard.target_object,
        channel,
        target,
        message_preview: String(message ?? "").slice(0, 80),
        message_length: String(message ?? "").length,
        queued_at: new Date().toISOString(),
        status: msgResult ? "sent" : "failed",
      };
      break;
    }

    case "read": {
      // feishu-doc-read, getnote, etc.
      const source = (resolvedInputs["source"] as string) || "memory";
      let result: unknown;

      if (source === "memory") {
        result = await memory_search({
          query: resolvedInputs["query"] as string,
          scope: "local",
          maxResults: 3,
        });
      } else if (source === "feishu_doc") {
        result = await feishu_doc({
          action: "read",
          doc_token: resolvedInputs["doc_token"] as string,
        });
      }

      output = {
        skill_id: skillId,
        action_verb: skillCard.action_verb,
        target_object: skillCard.target_object,
        source,
        result,
        read_at: new Date().toISOString(),
        status: result ? "ok" : "not_found",
      };
      break;
    }

    case "write": {
      // feishu-doc-write, memory-write, etc.
      const dest = (resolvedInputs["destination"] as string) || "memory";
      const content = resolvedInputs["content"] as string;

      let result: unknown;
      if (dest === "feishu_doc") {
        result = await feishu_doc({
          action: "write",
          doc_token: resolvedInputs["doc_token"] as string,
          content,
        });
      } else if (dest === "qq") {
        result = await message({
          action: "send",
          channel: "qqbot",
          target: resolvedInputs["target"] as string,
          message: content,
        });
      }

      output = {
        skill_id: skillId,
        action_verb: skillCard.action_verb,
        target_object: skillCard.target_object,
        destination: dest,
        content_preview: String(content ?? "").slice(0, 80),
        written_at: new Date().toISOString(),
        status: result ? "ok" : "failed",
      };
      break;
    }

    default: {
      // Generic fallback — skill metadata + inputs
      output = {
        skill_id: skillId,
        action_verb: skillCard.action_verb,
        target_object: skillCard.target_object,
        inputs: resolvedInputs,
        status: "executed",
        executed_at: new Date().toISOString(),
      };
    }
  }

  // 4. Log execution
  const durationMs = Date.now() - startTime;
  const timestamp = new Date().toISOString();
  const execId = `${pipelineId}.${step.id}.${Date.now()}`;
  const inputStr = JSON.stringify(resolvedInputs, Object.keys(resolvedInputs).sort());
  const inputHash = createHash("sha256").update(inputStr).digest("hex").slice(0, 16);
  const outputStr = JSON.stringify(output);
  const outputHash = createHash("sha256").update(outputStr).digest("hex").slice(0, 16);

  execLog({
    exec_id: execId,
    timestamp,
    pipeline_id: pipelineId,
    pipeline_step: step.id,
    skill_id: skillId,
    action_verb: skillCard.action_verb,
    input_mapping: step.input_mapping ?? {},
    resolved_inputs: resolvedInputs,
    input_hash: inputHash,
    output,
    output_hash: outputHash,
    duration_ms: durationMs,
    status: "success",
    compensation_status: "n/a",
  });

  return output;
}

/**
 * Execute a complete pipeline.
 *
 * Runs in rounds:
 *   1. Collect ready steps (dependencies met, condition true)
 *   2. Execute all ready steps concurrently
 *   3. Store each step's output as step.output_as in ctx.outputs
 *   4. Repeat until all steps done or no ready steps remain (deadlock)
 *
 * Error policy:
 *   compensate     — run compensating actions in reverse order
 *   pause_and_notify — throw (caller handles notification)
 *   skip_continue — mark step complete and continue
 */
export async function executePipeline(
  pipeline: Pipeline,
  initialContext: StepContext = { outputs: {}, inputs: {} },
  env?: Record<string, unknown>,
): Promise<StepContext> {
  const ctx: StepContext = { ...initialContext } as StepContext;
  if (env) ctx.env = env;
  const completed = new Set<string>();

  // Build stepId → output_as mapping so interpolate() can resolve cross-step refs
  const stepIdToOutputAs: Record<string, string> = {};
  for (const step of pipeline.steps) {
    stepIdToOutputAs[step.id] = step.output_as;
  }

  console.log(`[PipelineExecutor] Starting pipeline: ${pipeline.pipeline_id}`);

  let round = 0;
  while (completed.size < pipeline.steps.length) {
    round++;
    const ready = getReadySteps(pipeline, completed, ctx, stepIdToOutputAs);
    if (ready.length === 0) {
      const remaining = pipeline.steps
        .filter((s) => !completed.has(s.id))
        .map((s) => s.id)
        .join(", ");
      console.warn(
        `[PipelineExecutor] No ready steps but pipeline not complete. Remaining: ${remaining}`,
      );
      break;
    }

    // Execute all ready steps in this round concurrently
    console.log(
      `[PipelineExecutor] Round ${round}: ready steps =`,
      ready.map((s) => s.id),
    );
    await Promise.all(
      ready.map(async (step) => {
        try {
          const output = await executeStep(step, ctx, pipeline.pipeline_id);
          ctx.outputs[step.output_as] = output;
          completed.add(step.id);
          console.log(
            `[PipelineExecutor] Step ${step.id} completed, outputs now =`,
            Object.keys(ctx.outputs),
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          const timestamp = new Date().toISOString();
          console.error(`[PipelineExecutor] Step ${step.id} failed: ${errorMsg}`);

          if (pipeline.error_policy.on_step_fail === "skip_continue") {
            // Log as skipped
            const execId = `${pipeline.pipeline_id}.${step.id}.${Date.now()}`;
            execLog({
              exec_id: execId,
              timestamp,
              pipeline_id: pipeline.pipeline_id,
              pipeline_step: step.id,
              skill_id: step.skill,
              action_verb: "skip",
              input_mapping: step.input_mapping ?? {},
              resolved_inputs: {},
              input_hash: "",
              output: { error: errorMsg },
              duration_ms: Date.now() - (Date.now() - 0), // placeholder
              status: "failed",
              compensation_status: "skipped",
              error: errorMsg,
            });
            completed.add(step.id);
            return;
          }

          if (pipeline.error_policy.on_step_fail === "compensate") {
            const completedList = pipeline.steps.filter((s) => completed.has(s.id));
            // Execute compensations in reverse order
            for (const compStep of [...completedList].reverse()) {
              if (compStep.compensating_action) {
                const compExecId = `${pipeline.pipeline_id}.${compStep.id}.compensate.${Date.now()}`;
                console.log(
                  `[PipelineExecutor] Compensating: ${compStep.id} via ${compStep.compensating_action}`,
                );
                // Real implementation: call compensating_action tool
                // Stub: just log the compensation
                execLog({
                  exec_id: compExecId,
                  timestamp: new Date().toISOString(),
                  pipeline_id: pipeline.pipeline_id,
                  pipeline_step: compStep.id,
                  skill_id: compStep.skill,
                  action_verb: "compensate",
                  input_mapping: compStep.input_mapping ?? {},
                  resolved_inputs: {},
                  input_hash: "",
                  output: { compensating_action: compStep.compensating_action },
                  duration_ms: 0,
                  status: "success",
                  compensation_status: "triggered",
                  linked_facts: [],
                });
              }
            }
            // Log the failed step itself
            const failedExecId = `${pipeline.pipeline_id}.${step.id}.${Date.now()}`;
            execLog({
              exec_id: failedExecId,
              timestamp,
              pipeline_id: pipeline.pipeline_id,
              pipeline_step: step.id,
              skill_id: step.skill,
              action_verb: "fail",
              input_mapping: step.input_mapping ?? {},
              resolved_inputs: {},
              input_hash: "",
              output: { error: errorMsg },
              duration_ms: 0,
              status: "failed",
              compensation_status: "triggered",
              error: errorMsg,
            });
          }

          throw err;
        }
      }),
    );
  }

  console.log(
    `[PipelineExecutor] Pipeline ${pipeline.pipeline_id} complete. ` +
      `Completed: ${completed.size}/${pipeline.steps.length}`,
  );
  return ctx;
}

/**
 * Load and parse a single pipeline YAML file.
 */
export function loadPipeline(yamlPath: string): Pipeline {
  const content = readFileSync(resolve(yamlPath), "utf-8");
  const parsed = YAML.parse(content);
  if (Array.isArray(parsed)) {
    throw new Error("Use loadPipelineFromIndex for index files with multiple pipelines");
  }
  return parsed as Pipeline;
}

/**
 * Load a pipeline from the index by pipeline_id.
 */
/**
 * CLI entry point for pipeline executor.
 * Usage:
 *   npx tsx src/pipeline-registry/pipeline-executor.ts --pipeline echoreply-dispatch --manual
 *   npx tsx src/pipeline-registry/pipeline-executor.ts --pipeline echoreply-dispatch --manual --env pending_count=3
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      pipeline: { type: "string", short: "p" },
      manual: { type: "boolean", short: "m", default: false },
      env: { type: "string", short: "e", multiple: true },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help || !values.pipeline) {
    console.log(`Usage:
  npx tsx src/pipeline-registry/pipeline-executor.ts --pipeline <id> [--manual] [--env KEY=VALUE...]

Examples:
  # Run via cron/heartbeat (reads from process.env)
  npx tsx src/pipeline-registry/pipeline-executor.ts --pipeline echoreply-dispatch

  # Manual run with inline env
  npx tsx src/pipeline-registry/pipeline-executor.ts --pipeline echoreply-dispatch --manual --env pending_count=3 --env notify_target=qqbot:c2c:TESTUSER
`);
    process.exit(0);
  }

  const indexPath = "src/pipeline-registry/index.yaml";
  const pipeline = loadPipelineFromIndex(indexPath, values.pipeline);

  if (!pipeline) {
    console.error(`Pipeline "${values.pipeline}" not found in ${indexPath}`);
    process.exit(1);
  }

  // Build env from CLI flags or process.env
  const env: Record<string, unknown> = {};
  for (const kv of values.env ?? []) {
    const [k, v] = kv.split("=");
    if (k && v !== undefined) env[k.trim()] = v.trim();
  }

  // Manual mode: set minimal defaults if not overridden
  if (values.manual) {
    env["manual_run"] = true;
    env["pending_count"] = env["pending_count"] ?? 0;
  } else {
    // Inherit from process.env (cron/heartbeat context)
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v;
    }
  }

  console.log(`[CLI] Running pipeline: ${values.pipeline} (manual=${values.manual})`);
  console.log(`[CLI] Env:`, JSON.stringify(env));

  executePipeline(pipeline, { outputs: {}, inputs: {} }, env)
    .then((ctx) => {
      console.log(`[CLI] Done. outputs:`, Object.keys(ctx.outputs));
      process.exit(0);
    })
    .catch((err) => {
      console.error("[CLI] Error:", err.message);
      process.exit(1);
    });
}

export function loadPipelineFromIndex(indexPath: string, pipelineId: string): Pipeline | null {
  const content = readFileSync(resolve(indexPath), "utf-8");
  const parsed = YAML.parse(content);
  const pipelines: Pipeline[] = parsed.pipelines ?? [];
  return pipelines.find((p) => p.pipeline_id === pipelineId) ?? null;
}
