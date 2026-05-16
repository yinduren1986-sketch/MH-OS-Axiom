import fs from "node:fs/promises";
import path from "node:path";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { MemoryCitationsMode } from "../config/types.memory.js";
/**
 * facts-aware-context-engine.ts — OSC Phase 1 Day 5 / Day 7 Update
 *
 * ContextEngine that injects structured facts from the factsStore (JSONL)
 * into the System Prompt. Falls back to frontmatter scanning if store is empty.
 */
import type { ContextEngine, ContextEngineInfo } from "../context-engine/types.js";
import type { AssembleResult, CompactResult, IngestResult } from "../context-engine/types.js";
import { query as queryFacts } from "../db/factsStore.js";
import { parseFrontmatter } from "../utils/memoryParser.js";

interface FactsAwareContextEngineConfig {
  workspaceDir: string;
}

export class FactsAwareContextEngine implements ContextEngine {
  readonly info: ContextEngineInfo = {
    id: "facts-aware",
    name: "Facts-Aware Context Engine (OSC)",
    version: "0.2.0",
  };

  constructor(private config: FactsAwareContextEngineConfig) {}

  /**
   * Try to load facts from factsStore first (Day 7 upgrade),
   * fall back to frontmatter scan if store is empty.
   */
  async loadFactsForQuery(query: string): Promise<string> {
    // Try JSONL facts store first
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 5);

    try {
      const storeFacts = await queryFacts({ keywords, limit: 10 });
      if (storeFacts.length > 0) {
        const lines = storeFacts.map(
          (f) => `  - [store#${f.id}] ${f.subject} ${f.predicate} ${f.object}`,
        );
        return `## Retrieved Facts (from factsStore)\n${lines.join("\n")}\n`;
      }
    } catch {
      // Store not ready yet, fall through to frontmatter
    }

    // Fall back: scan recent frontmatter files
    const { workspaceDir } = this.config;
    const memoryDir = path.join(workspaceDir, "memory");

    let entries: string[];
    try {
      entries = await fs.readdir(memoryDir);
    } catch {
      return "";
    }

    const queryLower = query.toLowerCase();
    const matchedFacts: string[] = [];

    const recentFiles = entries
      .filter((e) => e.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, 7);

    for (const entry of recentFiles) {
      const fp = path.join(memoryDir, entry);
      try {
        const content = await fs.readFile(fp, "utf-8");
        const { frontmatter, body } = parseFrontmatter(content);

        const tags = (frontmatter?.tags as string[]) ?? [];
        const tagMatch = tags.some(
          (t) =>
            queryLower.includes(t.toLowerCase()) ||
            t.toLowerCase().includes(queryLower.slice(0, 10)),
        );

        const conclusions = (frontmatter?.conclusions as string[]) ?? [];
        const matchingConclusions = conclusions.filter(
          (c) =>
            typeof c === "string" &&
            (queryLower.includes(c.toLowerCase().slice(0, 15)) ||
              c.toLowerCase().includes(queryLower.slice(0, 15))),
        );

        const bodyFacts: string[] = [];
        for (const line of body.split("\n")) {
          const idx = line.indexOf("FACTS:");
          if (idx !== -1) {
            const fact = line.slice(idx + 7).trim();
            if (fact && fact.length > 5) bodyFacts.push(fact);
          }
        }
        const matchingBodyFacts = bodyFacts.filter(
          (f) =>
            queryLower.includes(f.toLowerCase().slice(0, 15)) ||
            f.toLowerCase().includes(queryLower.slice(0, 15)),
        );

        if (tagMatch || matchingConclusions.length > 0 || matchingBodyFacts.length > 0) {
          matchedFacts.push(...matchingConclusions.map((c) => `[${entry}] ${c}`));
          matchedFacts.push(...matchingBodyFacts.map((f) => `[${entry}] ${f}`));
        }
      } catch {}
    }

    if (matchedFacts.length === 0) return "";

    const block = [
      "## Retrieved Facts (from frontmatter)",
      ...matchedFacts.slice(0, 10).map((f) => `  - ${f}`),
    ].join("\n");
    return block + "\n";
  }

  async assemble(params: {
    sessionId: string;
    sessionKey?: string;
    messages: AgentMessage[];
    tokenBudget?: number;
    availableTools?: Set<string>;
    citationsMode?: MemoryCitationsMode;
    model?: string;
  }): Promise<AssembleResult> {
    const lastUserMsg = [...params.messages].reverse().find((m) => m.role === "user");
    const query = lastUserMsg?.content?.slice(0, 200) ?? "";
    const factsBlock = await this.loadFactsForQuery(query);

    return {
      messages: params.messages,
      estimatedTokens: 0,
      systemPromptAddition: factsBlock || undefined,
    };
  }

  async ingest(_params: {
    sessionId: string;
    sessionKey?: string;
    message: AgentMessage;
    isHeartbeat?: boolean;
  }): Promise<IngestResult> {
    return { ingested: false };
  }

  async afterTurn(_params: {
    sessionId: string;
    sessionKey?: string;
    sessionFile: string;
    messages: AgentMessage[];
    prePromptMessageCount: number;
    autoCompactionSummary?: string;
    isHeartbeat?: boolean;
    tokenBudget?: number;
    runtimeContext?: unknown;
  }): Promise<void> {}

  async compact(_params: {
    sessionId: string;
    sessionKey?: string;
    sessionFile: string;
    tokenBudget?: number;
    force?: boolean;
    currentTokenCount?: number;
    compactionTarget?: "budget" | "threshold";
    customInstructions?: string;
    runtimeContext?: unknown;
  }): Promise<CompactResult> {
    return { compacted: false, summary: "" };
  }
}
