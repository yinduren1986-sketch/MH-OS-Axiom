/**
 * pipeline-executor.test.ts
 * 集成测试：跑 echoreply-dispatch 流水线
 */

import { executePipeline, loadPipelineFromIndex } from "./pipeline-executor.js";

// Mock sessions_spawn for standalone testing
const mockSpawnCount = { count: 0 };
globalThis.sessions_spawn = async ({
  agentId,
  task,
  mode,
}: {
  agentId: string;
  task: string;
  mode: string;
}) => {
  mockSpawnCount.count++;
  console.log(`[MOCK sessions_spawn] agent=${agentId} task="${String(task).slice(0, 50)}..."`);
  return {
    runId: `mock-run-${mockSpawnCount.count}`,
    session_key: `mock-session-${mockSpawnCount.count}`,
  };
};

async function runTest() {
  console.log("=== Pipeline Executor 集成测试 ===\n");

  const pipelineId = "echoreply-dispatch";

  // 加载流水线
  const indexPath = "src/pipeline-registry/index.yaml";
  const pipeline = loadPipelineFromIndex(indexPath, pipelineId);
  if (!pipeline) {
    console.error(`❌ Pipeline ${pipelineId} not found in ${indexPath}`);
    process.exit(1);
  }
  console.log(`✅ Pipeline loaded: ${pipeline.pipeline_id}`);
  console.log(`   steps: ${pipeline.steps.length}`);
  console.log(`   condition: ${pipeline.condition}`);

  // 模拟环境变量（pending_count > 0，触发调度条件）
  const env = {
    pending_count: 3,
    pending_tasks: JSON.stringify([
      { task_id: "t1", agent: "canmou", content: "研究 OpenClaw hook 系统" },
      { task_id: "t2", agent: "creator", content: "写播客介绍文案" },
      { task_id: "t3", agent: "jiaoyi", content: "分析今日股票" },
    ]),
    current_time: new Date().toISOString(),
    channel: "qqbot",
    target: "qqbot:c2c:{{env.notify_target}}",
  };

  console.log(
    "\n环境变量: pending_count =",
    env.pending_count,
    "→ 条件 pending_count > 0 → ✅ 通过",
  );

  try {
    const ctx = await executePipeline(pipeline, { outputs: {}, inputs: {} }, env);
    console.log("\n✅ 执行完成！输出：");
    for (const [stepId, output] of Object.entries(ctx.outputs)) {
      const o = output as Record<string, unknown>;
      console.log(`  [${stepId}] → ${o.action_verb ?? "?"} | status: ${o.status ?? "?"}`);
    }
  } catch (err) {
    console.error("\n❌ 执行失败:", err);
    process.exit(1);
  }
}

runTest();
