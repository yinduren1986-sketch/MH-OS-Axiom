/**
 * intent-gate.ts — OSC Phase R3
 * Pre-flight intent check before running dispatch pipelines.
 *
 * Reads recent intent from .recent_intent.json (written by conditional-heartbeat handler).
 * If intent is "idle", skip the pipeline entirely.
 * If intent is "query", run scan-only mode (no dispatch).
 */

import { readFileSync } from "node:fs";

export type IntentCategory = "continue" | "pause" | "query" | "idle";

export interface IntentResult {
  category: IntentCategory;
  confidence: number;
  matchedKeyword?: string;
  ts: number;
}

const INTENT_FILE = "/root/.openclaw/workspace/.recent_intent.json";
const INTENT_TTL_MS = 30 * 60 * 1000; // intent expires after 30 min

export function readIntent(): IntentResult {
  try {
    const raw = readFileSync(INTENT_FILE, "utf-8");
    const data = JSON.parse(raw);
    const age = Date.now() - (data.ts ?? 0);
    if (age > INTENT_TTL_MS) {
      return { category: "idle", confidence: 1.0, ts: Date.now() };
    }
    return {
      category: (data.category ?? "idle") as IntentCategory,
      confidence: data.confidence ?? 1.0,
      matchedKeyword: data.matchedKeyword ?? undefined,
      ts: data.ts ?? Date.now(),
    };
  } catch {
    return { category: "idle", confidence: 1.0, ts: Date.now() };
  }
}

export type GateDecision =
  | { allowed: true; intent: IntentResult }
  | { allowed: false; reason: string; intent: IntentResult };

/**
 * Decide whether the dispatch pipeline should run.
 *
 * Rules:
 *   idle     → not allowed (no action needed)
 *   query    → scan only (status check, no dispatch)
 *   continue → allowed (normal dispatch)
 *   pause    → allowed but go easy (relaxed mode)
 */
export function checkIntentGate(): GateDecision {
  const intent = readIntent();

  switch (intent.category) {
    case "idle":
      return {
        allowed: false,
        reason: `intent=idle (confidence ${intent.confidence}), skipping dispatch`,
        intent,
      };
    case "query":
      return {
        allowed: true,
        intent: { ...intent, category: "query" as IntentCategory },
      };
    case "continue":
      return { allowed: true, intent };
    case "pause":
      return { allowed: true, intent };
    default:
      return { allowed: true, intent };
  }
}

/** Returns a human-readable label for the current intent. */
export function intentLabel(intent: IntentResult): string {
  const kw = intent.matchedKeyword ? ` (matched: "${intent.matchedKeyword}")` : "";
  return `${intent.category}${kw} [confidence: ${intent.confidence}]`;
}
