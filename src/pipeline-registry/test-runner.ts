/**
 * test-runner.ts
 *
 * Smoke-test PipelineExecutor by loading the real index.yaml
 * and executing both pipelines with appropriate mock context.
 *
 * Run: npx tsx src/pipeline-registry/test-runner.ts
 */

import { loadPipelineFromIndex, executePipeline } from "./pipeline-executor";

const INDEX_YAML = "src/pipeline-registry/index.yaml";

async function runEchoreplyDispatch() {
  const pipeline = loadPipelineFromIndex(INDEX_YAML, "echoreply-dispatch");
  if (!pipeline) {
    console.error("Pipeline not found: echoreply-dispatch");
    process.exit(1);
  }

  console.log("\n=== Pipeline: echoreply-dispatch ===");
  console.log("Steps:", pipeline.steps.map((s) => s.id).join(" -> "));

  // Mock context — scan step output_as="dispatch_result", stored flat:
  //   { pending_count: 3, pending_tasks: [...], new_complete_count: 0, timeout_count: 0 }
  // Condition {{steps.scan.output.pending_count}} uses field "output.pending_count"
  // which the interpolate fix resolves by stripping "output." prefix when not found directly.
  const ctx = {
    outputs: {
      dispatch_result: {
        pending_count: 3,
        pending_tasks: [
          { id: "t1", type: "translate", priority: "high" },
          { id: "t2", type: "feishu-write", priority: "medium" },
          { id: "t3", type: "rss-harvest", priority: "low" },
        ],
        new_complete_count: 0,
        timeout_count: 0,
        status: "dispatched",
        dispatched_at: new Date().toISOString(),
      },
    },
    inputs: {},
  };

  console.log("\n[Run] pending_count = 3\n");
  const result = await executePipeline(pipeline, ctx);

  console.log("\n[Results]");
  const stepIds = pipeline.steps.map((s) => s.output_as);
  let allOk = true;
  for (const outputKey of stepIds) {
    if (!result.outputs[outputKey]) {
      console.warn(`[MISSING] ${outputKey}`);
      allOk = false;
    } else {
      console.log(`[OK] ${outputKey}`);
    }
  }
  return allOk;
}

async function runEchoreplyNotify() {
  const pipeline = loadPipelineFromIndex(INDEX_YAML, "echoreply-notify");
  if (!pipeline) {
    console.error("Pipeline not found: echoreply-notify");
    process.exit(1);
  }

  console.log("\n=== Pipeline: echoreply-notify ===");
  console.log("Steps:", pipeline.steps.map((s) => s.id).join(" -> "));

  // Mock context — both check_complete and check_timeout use output_as key
  // so {{steps.check_complete.output.new_complete_count}} resolves to
  // ctx.outputs["complete_result"]["new_complete_count"]
  const ctx = {
    outputs: {
      complete_result: {
        new_complete_count: 2,
        summary: "2 tasks completed",
        completed_tasks: [{ id: "c1" }, { id: "c2" }],
        status: "success",
      },
      timeout_result: {
        timeout_count: 1,
        summary: "1 task timed out",
        timed_out_tasks: [{ id: "c3" }],
        status: "success",
      },
    },
    inputs: {},
  };

  console.log("\n[Run] new_complete_count=2, timeout_count=1\n");
  const result = await executePipeline(pipeline, ctx);

  console.log("\n[Results]");
  const stepIds = pipeline.steps.map((s) => s.output_as);
  let allOk = true;
  for (const outputKey of stepIds) {
    if (!result.outputs[outputKey]) {
      console.warn(`[MISSING] ${outputKey}`);
      allOk = false;
    } else {
      console.log(`[OK] ${outputKey}`);
    }
  }
  return allOk;
}

async function main() {
  const r1 = await runEchoreplyDispatch();
  await runEchoreplyNotify();
  if (!r1) process.exit(1);
}

main().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
