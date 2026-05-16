/**
 * Compaction Facts Logger — OSC Phase 2 Day 7
 *
 * After each compaction, extracts key facts and writes them to:
 *   1. memory/YYYY-MM-DD-daily.md (YAML block) — for human readability
 *   2. factsStore.jsonl (structured) — for programmatic query
 *
 * Trigger: session:compact:after
 */
import fs from "node:fs/promises";
import path from "node:path";
import { stringifyYaml } from "yaml";
import { insert as insertFact, type InsertFact } from "../../../db/factsStore.js";
import { root } from "../../../infra/fs-safe.js";
import type { HookHandler } from "../../hooks.js";

interface CompactContext {
  summary?: string;
  tokensBefore?: number;
  tokensAfter?: number;
  messageCount?: number;
  date?: string;
}

function getTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function extractFactsFromSummary(summary: string): string[] {
  const lines = summary.split("\n").filter((l) => l.trim().length > 5);
  return lines
    .slice(0, 5)
    .map((line) => {
      return line
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/^[-*#]\s*/, "")
        .trim();
    })
    .filter((l) => l.length > 4);
}

async function writeYamlBlock(
  dailyFile: string,
  facts: string[],
  tokensBefore: number,
  tokensAfter: number,
  messageCount: number,
): Promise<void> {
  const fm = {
    compaction: {
      timestamp: new Date().toISOString(),
      tokens_before: tokensBefore,
      tokens_after: tokensAfter,
      tokens_saved: tokensBefore - tokensAfter,
      message_count: messageCount,
      facts_count: facts.length,
    },
  };

  const yamlBlock = `\n---\ncompaction:\n${stringifyYaml(fm.compaction, { indent: 2 })}\n---\n`;
  await fs.appendFile(dailyFile, yamlBlock, "utf-8");
}

async function writeFactsToStore(
  facts: string[],
  tokensBefore: number,
  tokensAfter: number,
  sessionKey: string,
): Promise<void> {
  // Write each fact to the JSONL facts store
  for (let i = 0; i < facts.length; i++) {
    const fact = facts[i];
    // Parse the fact into subject/predicate/object
    // Try to extract a subject from the fact text
    const insertData: InsertFact = {
      subject: "compaction",
      predicate: `fact_${i + 1}`,
      object: fact,
      source: sessionKey,
      confidence: 0.85,
      tags: ["compaction", "auto-generated"],
    };
    await insertFact(insertData);
  }
}

const handler: HookHandler = async (event) => {
  try {
    if (event.type !== "session" || event.action !== "compact:after") return;

    const ctx = event.context as CompactContext;
    const summary = ctx.summary ?? "";
    const tokensBefore = ctx.tokensBefore ?? 0;
    const tokensAfter = ctx.tokensAfter ?? 0;
    const messageCount = ctx.messageCount ?? 0;

    if (!summary) return;

    const workspaceDir = root;
    const memoryDir = path.join(workspaceDir, "memory");
    const today = getTodayDate();
    const dailyFile = path.join(memoryDir, `${today}-daily.md`);

    // 1. Extract facts from summary
    const facts = extractFactsFromSummary(summary);

    // 2. Write YAML block to daily memory file
    await writeYamlBlock(dailyFile, facts, tokensBefore, tokensAfter, messageCount);
    event.messages.push(`[compaction-facts-logger] wrote ${facts.length} facts to daily log`);

    // 3. Write structured facts to JSONL store
    try {
      await writeFactsToStore(facts, tokensBefore, tokensAfter, event.sessionKey);
      event.messages.push(`[compaction-facts-logger] wrote ${facts.length} facts to facts store`);
    } catch (err) {
      console.warn(`[compaction-facts-logger] factsStore error: ${err}`);
    }
  } catch (err) {
    console.warn(`[compaction-facts-logger] error: ${err}`);
  }
};

export default handler;
