/**
 * policyEngine.test.ts — OSC Phase 4
 * Run: npx tsx src/safety/policyEngine.test.ts
 */
import { evaluateSkillCall, DEFAULT_POLICIES } from "./policyEngine.js";

const tests = [
  // Allow
  {
    skill: "feishu_doc",
    raw: "feishu_doc.write({doc_token: 'xxx', content: 'hello'})",
    params: {},
    expected: "allow",
  },
  // Block rm -rf /
  {
    skill: "exec",
    raw: "exec.run('rm -rf /')",
    params: {},
    expected: "block",
  },
  // Block dangerous shell patterns
  {
    skill: "shell",
    raw: "rm -rf /some/path",
    params: {},
    expected: "block",
  },
  // Confirm email with attachment
  {
    skill: "send_email",
    raw: "send_email({to: 'x', attachments: ['file.pdf']})",
    params: { attachments: ["file.pdf"] },
    expected: "confirm",
  },
  // Confirm email with cc
  {
    skill: "send_email",
    raw: "send_email({to: 'x', cc: ['y@z.com']})",
    params: { cc: ["y@z.com"] },
    expected: "confirm",
  },
  // Safe email (no attachment, no cc) → allow
  {
    skill: "send_email",
    raw: "send_email({to: 'x', text: 'hello'})",
    params: { to: "x", text: "hello" },
    expected: "allow",
  },
];

let passed = 0,
  failed = 0;
for (const { skill, raw, params, expected } of tests) {
  const result = evaluateSkillCall(skill, raw, params, DEFAULT_POLICIES);
  if (result.action === expected) {
    passed++;
  } else {
    failed++;
    console.log(`❌ ${skill} | ${raw} → ${result.action} (expected ${expected})`);
  }
}
console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
else console.log("✅ All tests passed");
