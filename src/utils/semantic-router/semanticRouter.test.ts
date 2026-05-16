/**
 * semanticRouter.test.ts — OSC Phase 5
 * Run: npx tsx src/utils/semantic-router/semanticRouter.test.ts
 */
import { classifyIntent, intentToStrategy } from "./semanticRouter.js";

const tests = [
  // Continue patterns
  { input: "继续推进", expected: "continue" },
  { input: "继续搞", expected: "continue" },
  { input: "跑", expected: "continue" },
  { input: "继续", expected: "continue" },
  { input: "开搞", expected: "continue" },
  { input: "搞", expected: "continue" },
  { input: "继续做", expected: "continue" },
  { input: "推进", expected: "continue" },
  { input: "开工", expected: "continue" },
  // Pause patterns
  { input: "先暂停", expected: "pause" },
  { input: "等等", expected: "pause" },
  { input: "缓缓", expected: "pause" },
  { input: "先放着", expected: "pause" },
  // Query patterns
  { input: "怎么样了", expected: "query" },
  { input: "状态", expected: "query" },
  { input: "看板", expected: "query" },
  { input: "进度", expected: "query" },
  { input: "完成了吗", expected: "query" },
  // Idle (default)
  { input: "早安", expected: "idle" },
  { input: "吃饭了吗", expected: "idle" },
  { input: "随便聊聊", expected: "idle" },
  { input: "你好", expected: "idle" },
];

let passed = 0,
  failed = 0;
for (const { input, expected } of tests) {
  const result = classifyIntent(input);
  if (result.category === expected) {
    passed++;
  } else {
    failed++;
    console.log(`❌ "${input}" → ${result.category} (expected ${expected})`);
  }
}

// Test strategy mapping
const strategyTests = [
  { cat: "continue", expected: "eager" },
  { cat: "pause", expected: "relaxed" },
  { cat: "query", expected: "informative" },
  { cat: "idle", expected: "silent" },
];
for (const { cat, expected } of strategyTests) {
  const strat = intentToStrategy(cat as Parameters<typeof intentToStrategy>[0]);
  if (strat === expected) passed++;
  else {
    failed++;
    console.log(`❌ strategy(${cat}) → ${strat}`);
  }
}

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
else console.log("✅ All tests passed");
