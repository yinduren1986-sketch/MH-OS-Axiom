import { readFileSync, writeFileSync } from "node:fs";
import type { HookHandler } from "../../hooks.js";

interface Todo {
  id: string;
  content: string;
  created: string;
  priority: string;
}

interface TodosFile {
  todos: Todo[];
}

export type IntentCategory = "continue" | "pause" | "query" | "idle";

export type HeartbeatStrategy = "eager" | "relaxed" | "informative" | "silent";

// Intent patterns from semanticRouter
const CONTINUE_PATTERNS = [
  /继续(搞|推进|做)/,
  /^跑$/,
  /^继续$/,
  /^开搞$/,
  /^搞$/,
  /推进/,
  /开工/,
  /开始做/,
  /继续做/,
];

const PAUSE_PATTERNS = [/先暂停/, /^等等$/, /^缓缓$/, /先放着/, /先不弄/, /先搁置/];

const QUERY_PATTERNS = [/怎么样了/, /进行中/, /状态/, /看板/, /进度/, /完成了吗/];

export interface IntentResult {
  category: IntentCategory;
  confidence: number;
  matchedKeyword?: string;
}

export function classifyIntentFromText(text: string): IntentResult {
  const trimmed = text.trim();
  for (const p of CONTINUE_PATTERNS) {
    const m = trimmed.match(p);
    if (m) return { category: "continue", confidence: 0.95, matchedKeyword: m[0] };
  }
  for (const p of PAUSE_PATTERNS) {
    const m = trimmed.match(p);
    if (m) return { category: "pause", confidence: 0.9, matchedKeyword: m[0] };
  }
  for (const p of QUERY_PATTERNS) {
    const m = trimmed.match(p);
    if (m) return { category: "query", confidence: 0.85, matchedKeyword: m[0] };
  }
  return { category: "idle", confidence: 1.0 };
}

export function intentToStrategy(cat: IntentCategory): HeartbeatStrategy {
  switch (cat) {
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

// ── Intent file storage ─────────────────────────────────────────────────────

const INTENT_FILE = "/root/.openclaw/workspace/.recent_intent.json";

function writeIntentFile(result: IntentResult): void {
  try {
    writeFileSync(
      INTENT_FILE,
      JSON.stringify({
        category: result.category,
        confidence: result.confidence,
        matchedKeyword: result.matchedKeyword ?? null,
        ts: Date.now(),
      }),
      "utf-8",
    );
  } catch {
    // non-fatal
  }
}

function readIntentFile(): IntentResult {
  try {
    const raw = readFileSync(INTENT_FILE, "utf-8");
    const data = JSON.parse(raw);
    const age = Date.now() - (data.ts ?? 0);
    if (age > 30 * 60 * 1000) return { category: "idle", confidence: 1.0 };
    return {
      category: (data.category ?? "idle") as IntentCategory,
      confidence: data.confidence ?? 1.0,
      matchedKeyword: data.matchedKeyword ?? undefined,
    };
  } catch {
    return { category: "idle", confidence: 1.0 };
  }
}

// ── Quiet hours ──────────────────────────────────────────────────────────────

function isQuietHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 2 && hour < 6;
}

// ── Hook handler ─────────────────────────────────────────────────────────────

const handler: HookHandler = async (hookCtx) => {
  // Safety Gate: never wake user between 2–6 AM
  if (isQuietHours()) return;

  // Step 1: Classify intent from the most recent user message in this session
  // hookCtx.recentMessages gives us recent messages; find the last user message
  const recentMessages =
    (hookCtx as { recentMessages?: Array<{ role: string; text?: string }> }).recentMessages ?? [];
  let lastUserText = "";
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i];
    if (msg.role === "user" && msg.text && msg.text.trim()) {
      lastUserText = msg.text;
      break;
    }
  }

  const intent = lastUserText
    ? classifyIntentFromText(lastUserText)
    : { category: "idle" as IntentCategory, confidence: 1.0 };

  // Write intent so other parts of the system can read it
  writeIntentFile(intent);

  // Step 2: Check todos
  const todosPath = "/root/.openclaw/workspace/todos.json";
  let pending: Todo[] = [];
  try {
    const raw = readFileSync(todosPath, "utf-8");
    const data: TodosFile = JSON.parse(raw);
    pending = data.todos?.filter((t) => t.priority === "high") ?? [];
  } catch {
    pending = [];
  }

  if (pending.length === 0) return; // silent — no pending

  const strategy = intentToStrategy(intent.category);
  const todoList = pending.map((t, i) => `${i + 1}. ${t.content}`).join("\n");

  if (strategy === "relaxed") {
    return { prependContext: `💤 顺便提醒，你有 ${pending.length} 个待办事项：\n${todoList}` };
  }
  if (strategy === "informative") {
    return { prependContext: `📊 当前状态：${pending.length} 个高优先级任务待处理\n${todoList}` };
  }
  if (strategy === "eager") {
    return {
      prependContext: `【待办提醒】你有 ${pending.length} 个高优先级任务待处理：\n${todoList}\n\n请优先处理这些任务后再进行其他工作。`,
    };
  }

  // idle → silent skip
  return;
};

export default handler;
