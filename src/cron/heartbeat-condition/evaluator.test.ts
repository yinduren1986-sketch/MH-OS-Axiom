/**
 * evaluator.test.ts — OSC Phase 4
 * Run: npx tsx src/cron/heartbeat-condition/evaluator.test.ts
 */
import { evaluateLine } from "./evaluator.js";

const tests = [
  // Simple comparisons
  { input: "pending_count > 0", env: { pending_count: 3 }, expected: true },
  { input: "pending_count > 0", env: { pending_count: 0 }, expected: false },
  { input: "status == 'idle'", env: { status: "idle" }, expected: true },
  { input: "status == 'idle'", env: { status: "running" }, expected: false },
  { input: "count >= 5", env: { count: 5 }, expected: true },
  { input: "count < 10", env: { count: 9 }, expected: true },
  { input: "name != 'test'", env: { name: "foo" }, expected: true },
  // AND
  {
    input: "pending_count > 0 AND status == 'idle'",
    env: { pending_count: 3, status: "idle" },
    expected: true,
  },
  {
    input: "pending_count > 0 AND status == 'idle'",
    env: { pending_count: 3, status: "running" },
    expected: false,
  },
  {
    input: "pending_count > 0 AND status == 'idle'",
    env: { pending_count: 0, status: "idle" },
    expected: false,
  },
  // OR
  {
    input: "pending_count > 0 OR status == 'idle'",
    env: { pending_count: 0, status: "idle" },
    expected: true,
  },
  {
    input: "pending_count > 0 OR status == 'idle'",
    env: { pending_count: 0, status: "running" },
    expected: false,
  },
  // CONDITION: prefix
  { input: "CONDITION: pending_count > 0", env: { pending_count: 5 }, expected: true },
  // Undefined var → false
  { input: "foo > 0", env: {}, expected: false },
  // Numeric strings
  { input: "count > 0", env: { count: "42" }, expected: true },
];

let passed = 0,
  failed = 0;
for (const { input, env, expected } of tests) {
  const result = evaluateLine(input, env);
  if (result === expected) {
    passed++;
  } else {
    failed++;
    console.log(`❌ "${input}" with ${JSON.stringify(env)} → ${result} (expected ${expected})`);
  }
}
console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
else console.log("✅ All tests passed");
