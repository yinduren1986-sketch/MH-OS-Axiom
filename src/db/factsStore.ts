/**
 * factsStore.ts — OSC Phase 2 Day 6
 *
 * File-based fact store using JSON lines (facts.jsonl).
 * No native module required — works in any Node.js environment.
 * Can be swapped for SQLite by implementing the same interface.
 *
 * Format: one JSON object per line (NDJSON)
 * File: ~/.openclaw/workspace/facts.jsonl
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FACTS_DIR = path.join(__dirname, "../../.openclaw/workspace");
const FACTS_FILE = path.join(FACTS_DIR, "facts.jsonl");

export interface Fact {
  id: number;
  subject: string;
  predicate: string;
  object: string;
  source?: string;
  confidence: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface InsertFact {
  subject: string;
  predicate: string;
  object: string;
  source?: string;
  confidence?: number;
  tags?: string[];
}

export interface QueryFactsOptions {
  subjects?: string[];
  predicates?: string[];
  keywords?: string[];
  timeRange?: { from?: string; to?: string };
  limit?: number;
  offset?: number;
}

let _cache: Fact[] | null = null;
let _nextId = 1;

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(FACTS_DIR, { recursive: true });
  } catch {}
}

async function load(): Promise<Fact[]> {
  if (_cache !== null) return _cache;
  await ensureDir();
  try {
    const content = await fs.readFile(FACTS_FILE, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    _cache = lines.map((line) => JSON.parse(line) as Fact);
    if (_cache.length > 0) {
      _nextId = Math.max(..._cache.map((f) => f.id)) + 1;
    }
  } catch {
    _cache = [];
  }
  return _cache!;
}

async function persist(facts: Fact[]): Promise<void> {
  await ensureDir();
  const lines = facts.map((f) => JSON.stringify(f));
  await fs.writeFile(FACTS_FILE, lines.join("\n"), "utf-8");
}

export async function insert(fact: InsertFact): Promise<number> {
  const facts = await load();
  const now = new Date().toISOString();
  const newFact: Fact = {
    id: _nextId++,
    subject: fact.subject,
    predicate: fact.predicate,
    object: fact.object,
    source: fact.source,
    confidence: fact.confidence ?? 1.0,
    tags: fact.tags ?? [],
    created_at: now,
    updated_at: now,
  };
  facts.push(newFact);
  await persist(facts);
  return newFact.id;
}

export async function query(options: QueryFactsOptions = {}): Promise<Fact[]> {
  const facts = await load();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  let results = facts.filter((f) => {
    if (options.subjects?.length) {
      const match = options.subjects.some((s) => f.subject.toLowerCase().includes(s.toLowerCase()));
      if (!match) return false;
    }
    if (options.predicates?.length) {
      const match = options.predicates.some((p) =>
        f.predicate.toLowerCase().includes(p.toLowerCase()),
      );
      if (!match) return false;
    }
    if (options.keywords?.length) {
      const match = options.keywords.some(
        (k) =>
          f.object.toLowerCase().includes(k.toLowerCase()) ||
          f.subject.toLowerCase().includes(k.toLowerCase()),
      );
      if (!match) return false;
    }
    if (options.timeRange?.from && f.created_at < options.timeRange.from) return false;
    if (options.timeRange?.to && f.created_at > options.timeRange.to) return false;
    return true;
  });

  // Sort by created_at desc, apply pagination
  results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return results.slice(offset, offset + limit);
}

export async function remove(id: number): Promise<void> {
  const facts = await load();
  const filtered = facts.filter((f) => f.id !== id);
  await persist(filtered);
  _cache = filtered;
}

export async function count(): Promise<number> {
  const facts = await load();
  return facts.length;
}

export async function stats(): Promise<{
  total: number;
  by_subject: Record<string, number>;
}> {
  const facts = await load();
  const by_subject: Record<string, number> = {};
  for (const f of facts) {
    by_subject[f.subject] = (by_subject[f.subject] ?? 0) + 1;
  }
  return { total: facts.length, by_subject };
}

export async function clear(): Promise<void> {
  _cache = [];
  _nextId = 1;
  await ensureDir();
  try {
    await fs.unlink(FACTS_FILE);
  } catch {}
}

// CLI
const args = process.argv.slice(2);
if (args[0] === "--stats") {
  stats().then((s) => {
    console.log(`Total facts: ${s.total}`);
    Object.entries(s.by_subject).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  });
} else if (args[0] === "--insert" && args[1] && args[2] && args[3]) {
  insert({ subject: args[1], predicate: args[2], object: args[3] }).then((id) =>
    console.log(`Inserted: id=${id}`),
  );
} else if (args[0] === "--query" && args[1]) {
  query({ keywords: [args[1]] }).then((results) => {
    console.log(`Found ${results.length} facts:`);
    results.forEach((f) => console.log(`  [${f.id}] ${f.subject} ${f.predicate} ${f.object}`));
  });
} else {
  console.log("Usage: --stats | --insert <s> <p> <o> | --query <keyword>");
}
