/**
 * timeParser.test.ts
 * Run with: npx tsx src/utils/timeParser.test.ts
 */
import { parseTimeExpression } from "./timeParser.js";

const FIXED_NOW = new Date("2026-05-15T12:00:00Z");

function parse(expr: string) {
  const OriginalDate = globalThis.Date;
  const mockDate = new OriginalDate(FIXED_NOW);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Date = class extends OriginalDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) return mockDate;
      return new OriginalDate(...(args as [string | number | Date]));
    }
    static now() {
      return mockDate.getTime();
    }
  } as typeof Date;

  const result = parseTimeExpression(expr);
  globalThis.Date = OriginalDate;
  return result;
}

// Calendar (May 2026): May 1=Fri, May 2=Sat, May 3=Sun, May 4=Mon, May 5=Tue,
// May 6=Wed, May 7=Thu, May 8=Fri, May 9=Sat, May 10=Sun, May 11=Mon,
// May 12=Tue, May 13=Wed, May 14=Thu, May 15=Fri, May 16=Sat, May 17=Sun,
// May 18=Mon, May 19=Tue, May 20=Wed, May 21=Thu, May 22=Fri, May 23=Sat, May 24=Sun

const tests = [
  // Basic
  { input: "今天", expected: "2026-05-15" },
  { input: "昨天", expected: "2026-05-14" },
  { input: "前天", expected: "2026-05-13" },
  { input: "明天", expected: "2026-05-16" },
  { input: "后天", expected: "2026-05-17" },
  { input: "大后天", expected: "2026-05-18" },
  { input: "3天前", expected: "2026-05-12" },
  { input: "10天前", expected: "2026-05-05" },
  { input: "30天后", expected: "2026-06-14" },
  // Last week (Mon May 4 - Sun May 10)
  { input: "上周一", expected: "2026-05-04" },
  { input: "上周二", expected: "2026-05-05" },
  { input: "上周三", expected: "2026-05-06" },
  { input: "上周四", expected: "2026-05-07" },
  { input: "上周五", expected: "2026-05-08" },
  { input: "上周六", expected: "2026-05-09" },
  { input: "上周日", expected: "2026-05-10" },
  // This week (Mon May 11 - Sun May 17)
  { input: "本周三", expected: "2026-05-13" },
  { input: "本周五", expected: "2026-05-15" },
  { input: "本周日", expected: "2026-05-17" },
  { input: "周三", expected: "2026-05-13" },
  // Next week (Mon May 18 - Sun May 24)
  { input: "下周三", expected: "2026-05-20" },
  { input: "下周五", expected: "2026-05-22" },
  { input: "下周日", expected: "2026-05-17" },
  // Week ranges
  { input: "这周", expected: "2026-05-11" },
  { input: "下周", expected: "2026-05-18" },
  { input: "上周", expected: "2026-05-08" },
  // Month
  { input: "这个月", expected: "2026-05-01" },
  { input: "上个月", expected: "2026-04-01" },
  // English
  { input: "today", expected: "2026-05-15" },
  { input: "yesterday", expected: "2026-05-14" },
  { input: "this week", expected: "2026-05-11" },
  { input: "last week", expected: "2026-05-08" },
  { input: "next week", expected: "2026-05-18" },
  { input: "this month", expected: "2026-05-01" },
  { input: "last month", expected: "2026-04-01" },
  // Exact date
  { input: "2026-05-01", expected: "2026-05-01" },
  // Unrecognized
  { input: "随便什么", expected: null },
  { input: "去年", expected: null },
];

let passed = 0,
  failed = 0;
console.log("timeParser tests (fixed now: 2026-05-15T12:00:00Z)\n");
for (const { input, expected } of tests) {
  const result = parse(input);
  const actual = result?.from ?? null;
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.log(`❌ "${input}" → ${actual} (expected ${expected})`);
  }
}
console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("✅ All tests passed");
}
