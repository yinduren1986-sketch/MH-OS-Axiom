/**
 * memoryParser.ts — YAML frontmatter parser for OpenClaw memory files
 *
 * Parses MEMORY.md and memory/YYYY-MM-DD.md files with YAML frontmatter.
 * Used by OSC Phase 1 Day 3 to enable structured fact extraction.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface MemoryFile {
  filepath: string;
  frontmatter: Frontmatter | null;
  body: string;
  facts: string[];
  tags: string[];
  conclusions: string[];
}

export interface Frontmatter {
  title?: string;
  type?: string;
  date?: string;
  source?: string;
  updated?: string;
  tags?: string[];
  facts?: string[];
  conclusions?: string[];
  [key: string]: unknown;
}

// Match YAML frontmatter: --- ... ---
const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export function parseFrontmatter(content: string): {
  frontmatter: Frontmatter | null;
  body: string;
} {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) {
    return { frontmatter: null, body: content };
  }
  try {
    const fm = parseYaml(match[1]) as Frontmatter;
    return { frontmatter: fm, body: match[2] };
  } catch {
    return { frontmatter: null, body: content };
  }
}

export function extractFacts(content: string): string[] {
  const facts: string[] = [];
  for (const line of content.split("\n")) {
    const idx = line.indexOf("FACTS:");
    if (idx !== -1) {
      const fact = line.slice(idx + 7).trim();
      if (fact) facts.push(fact);
    }
  }
  return facts;
}

export function extractTags(frontmatter: Frontmatter | null): string[] {
  if (!frontmatter) return [];
  const tags = frontmatter.tags;
  return Array.isArray(tags) ? tags : [];
}

export function extractConclusions(frontmatter: Frontmatter | null): string[] {
  if (!frontmatter) return [];
  const conclusions = frontmatter.conclusions;
  return Array.isArray(conclusions) ? conclusions : [];
}

export async function readMemoryFile(filepath: string): Promise<MemoryFile | null> {
  try {
    const content = await fs.readFile(filepath, "utf-8");
    const { frontmatter, body } = parseFrontmatter(content);
    return {
      filepath,
      frontmatter,
      body,
      facts: extractFacts(body),
      tags: extractTags(frontmatter),
      conclusions: extractConclusions(frontmatter),
    };
  } catch {
    return null;
  }
}

export async function* walkMemoryDir(memoryDir: string): AsyncGenerator<MemoryFile> {
  let entries: string[];
  try {
    entries = await fs.readdir(memoryDir);
  } catch {
    return;
  }
  for (const entry of entries.sort()) {
    if (!entry.endsWith(".md")) continue;
    const file = await readMemoryFile(path.join(memoryDir, entry));
    if (file) yield file;
  }
}

export async function queryByTag(tag: string, memoryDir: string): Promise<MemoryFile[]> {
  const results: MemoryFile[] = [];
  for await (const file of walkMemoryDir(memoryDir)) {
    if (file.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))) {
      results.push(file);
    }
  }
  return results;
}

export async function queryByFact(keyword: string, memoryDir: string): Promise<MemoryFile[]> {
  const results: MemoryFile[] = [];
  for await (const file of walkMemoryDir(memoryDir)) {
    if (file.facts.some((f) => f.toLowerCase().includes(keyword.toLowerCase()))) {
      results.push(file);
    }
  }
  return results;
}

export async function stats(memoryDir: string): Promise<{
  totalFiles: number;
  withFrontmatter: number;
  totalTags: number;
  totalFacts: number;
  allTags: string[];
}> {
  const files: MemoryFile[] = [];
  for await (const file of walkMemoryDir(memoryDir)) {
    files.push(file);
  }
  const allTags = new Set<string>();
  for (const f of files) {
    f.tags.forEach((t) => allTags.add(t));
  }
  return {
    totalFiles: files.length,
    withFrontmatter: files.filter((f) => f.frontmatter !== null).length,
    totalTags: allTags.size,
    totalFacts: files.reduce((sum, f) => sum + f.facts.length, 0),
    allTags: Array.from(allTags).sort(),
  };
}

// Update frontmatter in a memory file
export async function updateFrontmatter(
  filepath: string,
  updates: Partial<Frontmatter>,
): Promise<void> {
  const content = await fs.readFile(filepath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);
  const merged = { ...frontmatter, ...updates };
  const newFm = stringifyYaml(merged, { indent: 2 });
  await fs.writeFile(filepath, `---\n${newFm}---\n${body}`, "utf-8");
}

// CLI for quick testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const memoryDir = process.env.MEMORY_DIR ?? "/root/.openclaw/workspace/memory";
  const args = process.argv.slice(2);

  if (args[0] === "--stats") {
    stats(memoryDir).then((s) => {
      console.log(`Total files: ${s.totalFiles}`);
      console.log(`With frontmatter: ${s.withFrontmatter}`);
      console.log(`Total tags: ${s.totalTags}`);
      console.log(`Total facts: ${s.totalFacts}`);
      console.log(`Tags: ${s.allTags.join(", ")}`);
    });
  } else if (args[0] === "--query-tag" && args[1]) {
    queryByTag(args[1], memoryDir).then((files) => {
      files.forEach((f) => console.log(`${f.filepath}: ${f.tags.join(", ")}`));
    });
  } else if (args[0] === "--query-fact" && args[1]) {
    queryByFact(args[1], memoryDir).then((files) => {
      files.forEach((f) => console.log(`${f.filepath}: ${f.facts.join(", ")}`));
    });
  } else {
    console.log("Usage:");
    console.log("  --stats           Show memory stats");
    console.log("  --query-tag TAG   Query by tag");
    console.log("  --query-fact KEY  Query by fact keyword");
  }
}
