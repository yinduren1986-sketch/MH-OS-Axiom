/**
 * timeParser.ts — OSC Phase 2 Day 8-9
 *
 * Minimal Chinese + English time expression parser.
 * Converts natural language time references to ISO date range tuples.
 *
 * Hardcoded patterns (no NLP library required).
 * Extend as needed without changing the interface.
 */
export interface DateRange {
  from: string; // ISO 8601 date (YYYY-MM-DD)
  to: string;
  label: string; // human-readable description
}

type TimeParserFn = (now: Date) => DateRange;

const RELATIVE_MAP: Record<string, TimeParserFn> = {
  今天: (now) => {
    const y = now.getFullYear(),
      m = now.getMonth() + 1,
      d = now.getDate();
    return {
      from: `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`,
      to: `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`,
      label: "今天",
    };
  },
  昨天: (now) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return dateToRange(d, "昨天");
  },
  前天: (now) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    return dateToRange(d, "前天");
  },
  明天: (now) => {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return dateToRange(d, "明天");
  },
  后天: (now) => {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return dateToRange(d, "后天");
  },
  大后天: (now) => {
    const d = new Date(now);
    d.setDate(d.getDate() + 3);
    return dateToRange(d, "大后天");
  },
  上周: (now) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return dateToRange(d, "上周");
  },
  这周: (now) => {
    const day = now.getDay() || 7;
    const start = new Date(now);
    start.setDate(now.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: dateStr(start), to: dateStr(end), label: "这周" };
  },
  下周: (now) => {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    const day = d.getDay() || 7;
    const start = new Date(d);
    start.setDate(d.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: dateStr(start), to: dateStr(end), label: "下周" };
  },
  上个月: (now) => {
    const y = now.getFullYear(),
      m = now.getMonth(); // 0-indexed
    const fromM = m === 0 ? 12 : m;
    const fromY = m === 0 ? y - 1 : y;
    return {
      from: `${fromY}-${fromM.toString().padStart(2, "0")}-01`,
      to: `${y}-${(now.getMonth() + 1).toString().padStart(2, "0")}-01`,
      label: "上个月",
    };
  },
  这个月: (now) => {
    const y = now.getFullYear(),
      m = now.getMonth() + 1;
    return {
      from: `${y}-${m.toString().padStart(2, "0")}-01`,
      to: `${y}-${m.toString().padStart(2, "0")}-31`,
      label: "这个月",
    };
  },
  // Weekday references
  上周一: (now) => getWeekday(now, -7, 1, "上周一"),
  上周二: (now) => getWeekday(now, -7, 2, "上周二"),
  上周三: (now) => getWeekday(now, -7, 3, "上周三"),
  上周四: (now) => getWeekday(now, -7, 4, "上周四"),
  上周五: (now) => getWeekday(now, -7, 5, "上周五"),
  上周六: (now) => getWeekday(now, -7, 6, "上周六"),
  上周日: (now) => getWeekday(now, -7, 0, "上周日"),
  本周三: (now) => getWeekday(now, 0, 3, "本周三"),
  本周五: (now) => getWeekday(now, 0, 5, "本周五"),
  本周日: (now) => getWeekday(now, 0, 0, "本周日"),
  周三: (now) => getWeekday(now, 0, 3, "本周三"),
  下周三: (now) => getWeekday(now, 7, 3, "下周三"),
  下周五: (now) => getWeekday(now, 7, 5, "下周五"),
  下周日: (now) => getWeekday(now, 7, 0, "下周日"),
  下周: (now) => {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    const day = d.getDay() || 7;
    const start = new Date(d);
    start.setDate(d.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: dateStr(start), to: dateStr(end), label: "下周" };
  },
  // English
  today: (now) => dateToRange(now, "today"),
  yesterday: (now) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return dateToRange(d, "yesterday");
  },
  "this week": (now) => {
    const day = now.getDay() || 7;
    const start = new Date(now);
    start.setDate(now.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: dateStr(start), to: dateStr(end), label: "this week" };
  },
  "last week": (now) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return dateToRange(d, "last week");
  },
  "next week": (now) => {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    const day = d.getDay() || 7;
    const start = new Date(d);
    start.setDate(d.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: dateStr(start), to: dateStr(end), label: "next week" };
  },
  "last month": (now) => {
    const y = now.getFullYear(),
      m = now.getMonth(); // 0-indexed
    const fromM = m === 0 ? 12 : m;
    const fromY = m === 0 ? y - 1 : y;
    return {
      from: `${fromY}-${fromM.toString().padStart(2, "0")}-01`,
      to: `${y}-${(now.getMonth() + 1).toString().padStart(2, "0")}-01`,
      label: "last month",
    };
  },
  "this month": (now) => {
    const y = now.getFullYear(),
      m = now.getMonth() + 1;
    return {
      from: `${y}-${m.toString().padStart(2, "0")}-01`,
      to: `${y}-${m.toString().padStart(2, "0")}-31`,
      label: "this month",
    };
  },
};

function dateStr(d: Date): string {
  const y = d.getFullYear(),
    m = d.getMonth() + 1,
    day = d.getDate();
  return `${y}-${m.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function dateToRange(d: Date, label: string): DateRange {
  return { from: dateStr(d), to: dateStr(d), label };
}

function getWeekday(
  now: Date,
  offsetDays: number,
  targetWeekday: number,
  label: string,
): DateRange {
  const todayWeekday = now.getDay();
  let daysBack = (todayWeekday - targetWeekday + 7) % 7;

  if (offsetDays < 0) {
    // 上X: previous calendar week
    if (daysBack === 0) {
      daysBack = 7;
    } else if (targetWeekday === 0) {
      // Special: Sunday is week boundary. Most recent past IS in last week. No add.
    } else if (targetWeekday < todayWeekday) {
      daysBack += 7;
    }
  } else if (offsetDays > 0) {
    // 下X: next calendar week
    if (targetWeekday === 0) {
      // Special: for 下周日, subtract 7 to skip current week and land on NEXT Sunday
      daysBack -= 7;
    } else if (targetWeekday <= todayWeekday) {
      daysBack -= 7;
    }
  } else {
    // offsetDays === 0: 本X
    if (targetWeekday === 0 && daysBack > 0) {
      // Special: 本周日. Most recent past is this week. User wants NEXT Sunday.
      daysBack -= 7;
    }
  }

  const d = new Date(now);
  d.setDate(d.getDate() - daysBack);
  return { from: dateStr(d), to: dateStr(d), label };
}

/**
 * Parse a time expression string into a date range.
 * Returns null if the expression is not recognized.
 */
export function parseTimeExpression(expr: string): DateRange | null {
  const now = new Date();
  const fn = RELATIVE_MAP[expr.trim()];
  if (fn) return fn(now);

  // Try "N天前" pattern
  const daysAgoMatch = expr.match(/^(\d+)天前$/);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return { from: dateStr(d), to: dateStr(d), label: `${days}天前` };
  }

  // Try "N天前" pattern for future
  const daysLaterMatch = expr.match(/^(\d+)天后$/);
  if (daysLaterMatch) {
    const days = parseInt(daysLaterMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return { from: dateStr(d), to: dateStr(d), label: `${days}天后` };
  }

  // Try "上周X" pattern (e.g. 上周三 = last Wednesday)
  const lastWeekdayMatch = expr.match(/^上周([一二三四五六日])/);
  if (lastWeekdayMatch) {
    const dayMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0 };
    const targetDay = dayMap[lastWeekdayMatch[1]];
    if (targetDay !== undefined) {
      return getWeekday(now, -7, targetDay, expr.trim());
    }
  }

  // Try "YYYY-MM-DD" exact date
  const exactMatch = expr.match(/^\d{4}-\d{2}-\d{2}$/);
  if (exactMatch) {
    return { from: expr.trim(), to: expr.trim(), label: expr.trim() };
  }

  return null;
}

/**
 * Extract time expressions from a natural language query.
 * Returns all matches found in the query.
 */
export function extractTimeExpressions(query: string): string[] {
  const matches: string[] = [];
  const known = Object.keys(RELATIVE_MAP);
  for (const kw of known) {
    if (query.includes(kw)) matches.push(kw);
  }
  // Also match patterns
  const patterns = [/\d+天前/g, /\d+天后/g, /^\d{4}-\d{2}-\d{2}$/g];
  // Just check each pattern once
  const dynaMatch = query.match(/\d+天[前后]/);
  if (dynaMatch && !matches.includes(dynaMatch[0])) matches.push(dynaMatch[0]);
  return matches;
}

// CLI for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = ["今天", "昨天", "上周三", "这周", "下周三", "3天前", "后天", "2026-05-01"];
  for (const t of tests) {
    const result = parseTimeExpression(t);
    if (result) {
      console.log(`"${t}" → ${result.label} (${result.from} ~ ${result.to})`);
    } else {
      console.log(`"${t}" → UNRECOGNIZED`);
    }
  }
}
