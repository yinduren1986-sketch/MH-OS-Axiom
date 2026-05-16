/**
 * semanticRouter.ts — OSC Phase 5 Day 18-20
 *
 * Classifies user message intent and routes to appropriate heartbeat strategy.
 *
 * Categories:
 *   continue   — "继续推进", "跑", "继续搞" → push task forward
 *   pause      — "先暂停", "等等", "缓缓" → defer task
 *   query      — "怎么样了", "状态", "看板" → status check
 *   idle       — anything else → treat as idle/no-action
 */

export type IntentCategory = "continue" | "pause" | "query" | "idle";

interface IntentResult {
  category: IntentCategory;
  confidence: number; // 0-1
  matchedKeyword?: string;
}

const CONTINUE_PATTERNS = [
  /继续(搞|推进|做|推进)/,
  /^跑$/,
  /^继续$/,
  /^开搞$/,
  /^搞$/,
  /推进/,
  /开工/,
  /开始做/,
  /继续做/,
];

const PAUSE_PATTERNS = [/先暂停/, /^等等$/, /^缓缓$/, /先放着/, /先不弄/, /先搁置/, /先别做/];

const QUERY_PATTERNS = [/怎么样了/, /进行中/, /状态/, /看板/, /进度/, /完成了吗/, /搞定了吗/];

export function classifyIntent(message: string): IntentResult {
  const text = message.trim();

  for (const pattern of CONTINUE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return { category: "continue", confidence: 0.95, matchedKeyword: match[0] };
    }
  }

  for (const pattern of PAUSE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return { category: "pause", confidence: 0.9, matchedKeyword: match[0] };
    }
  }

  for (const pattern of QUERY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return { category: "query", confidence: 0.85, matchedKeyword: match[0] };
    }
  }

  return { category: "idle", confidence: 1.0 };
}

/**
 * Maps intent category to heartbeat behavior strategy.
 * Used by the conditional-heartbeat hook to decide what to inject.
 */
export type HeartbeatStrategy =
  | "eager" // continue → proactive reminder, push forward
  | "relaxed" // pause → minimal contact, wait
  | "informative" // query → provide status on request
  | "silent"; // idle → no injection

export function intentToStrategy(category: IntentCategory): HeartbeatStrategy {
  switch (category) {
    case "continue":
      return "eager";
    case "pause":
      return "relaxed";
    case "query":
      return "informative";
    case "idle":
      return "silent";
  }
}
