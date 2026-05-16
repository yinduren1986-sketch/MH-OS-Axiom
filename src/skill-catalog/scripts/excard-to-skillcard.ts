//===========================================================
// excard-to-skillcard.ts
// 功能：ExCard .md 文件批量转换为 Skill Card JSON
//
// 映射规则：
//   name（EC-XXX-活动名）→ skill_id（kebab-case）
//   description → description
//   permissions[0] → constraints.risk_level
//   自动推断 → action_verb + target_object
//
// 返回码：
//   0  全部成功
//   1  全部失败（无文件处理）
//   2  部分成功（有失败项）
//===========================================================
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const EXCARD_DIR = "/root/.openclaw/workspace/ExCard";
const REGISTRY_DIR = "/root/.openclaw/workspace/openclaw-src/src/skill-catalog/registry";
const INDEX_FILE = "/root/.openclaw/workspace/openclaw-src/src/skill-catalog/index.json";
const REPORT_FILE = "/root/.openclaw/workspace/memos/2026-05-15/excard-convert-report.md";
const TODAY = new Date().toISOString().slice(0, 10);

// ── helpers ────────────────────────────────────────────────────────────────

/** 从文件名提取 skill_id（EC-XXX-活动名 → kebab-case） */
function nameToSkillId(name: string): string {
  // 去掉前缀，保留"活动名"部分
  const label = name.replace(/^EC-\d+-/, "");

  // 固定词表：name → action_verb
  const ACTION_MAP: Record<string, string> = {
    采集: "harvest",
    翻译飞书: "translate",
    早间简报: "send",
    公众号发布: "publish",
    腾讯文档写入: "write",
    飞书文档写入: "write",
    Get笔记: "note",
    标准文章: "write",
    文章润色: "polish",
    风格指纹: "extract",
    图像生成: "generate",
    RSS采集: "harvest",
    社交趋势同步: "sync",
    Wiki研究Ingest: "ingest",
    读图任务: "analyze",
    任务解析: "parse",
    长内容分片发送: "chunk",
    内容采集分发写作流水线: "run",
    经验教训归档标准: "archive",
    任务派发标准: "dispatch",
    参谋报告格式规范: "write",
    参谋笔杆子协作规范: "collaborate",
  };

  // 固定词表：label → target_object
  const TARGET_MAP: Record<string, string> = {
    采集: "rss",
    翻译飞书: "feishu",
    早间简报: "morning-brief",
    公众号发布: "wechat",
    腾讯文档写入: "tencent-doc",
    飞书文档写入: "feishu-doc",
    Get笔记: "getnote",
    标准文章: "article",
    文章润色: "article",
    风格指纹: "style",
    图像生成: "image",
    RSS采集: "rss-pipeline",
    社交趋势同步: "social-trend",
    Wiki研究Ingest: "wiki-research",
    读图任务: "image",
    任务解析: "task",
    长内容分片发送: "message",
    内容采集分发写作流水线: "content-pipeline",
    经验教训归档标准: "lesson",
    任务派发标准: "task",
    参谋报告格式规范: "report",
    参谋笔杆子协作规范: "collaboration",
  };

  const action = ACTION_MAP[label] ?? "run";
  const target = TARGET_MAP[label] ?? label.toLowerCase().replace(/\s+/g, "-");
  return `${target}-${action}`;
}

/** permissions[0] → risk_level */
/** Map permissions array to risk_level — return highest risk found across all entries.
 * high  : exec: shell | write: api
 * medium: write: filesystem
 * low   : everything else
 */
function permsToRiskLevel(perms: string[]): "low" | "medium" | "high" {
  let level: "low" | "medium" | "high" = "low";
  for (const p of perms) {
    if (p.includes("exec: shell") || p.includes("write: api")) return "high";
    if (p.includes("write: filesystem")) level = "medium";
  }
  return level;
}

/** 解析 YAML frontmatter（简化版，不引入 heavy dep） */
/** Parse YAML frontmatter — handles multi-line list blocks.
 * permissions:
 *   - read: api
 *   - write: filesystem
 * Strips 2/4-space indentation from list items.
 */
function parseFrontmatter(content: string): Record<string, unknown> {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;

  for (const rawLine of m[1].split(/\r?\n/)) {
    const line = rawLine.replace(/^  +/, "").replace(/^\s+/, "");
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      const [, key, val] = kv;
      if (val.trim().startsWith("-")) {
        const items = val
          .trim()
          .substring(1)
          .split(/\s+-\s*/)
          .filter(Boolean);
        result[key] = items;
        currentKey = key;
      } else if (val.trim() !== "") {
        result[key] = val.trim().replace(/^['"]|['"]$/g, "");
        currentKey = null;
      } else {
        currentKey = key;
        result[key] = [];
      }
    } else if (line.startsWith("-") && currentKey) {
      const item = line.replace(/^-\s*/, "").trim();
      const arr: string[] = Array.isArray(result[currentKey])
        ? (result[currentKey] as string[])
        : [];
      result[currentKey] = [...arr, item];
    }
  }
  return result;
}

// ── main ─────────────────────────────────────────────────────────────────

const files = readdirSync(EXCARD_DIR).filter((f) => f.endsWith(".md") && /^EC-\d+/.test(f));

const results: {
  file: string;
  skill_id: string;
  status: "created" | "skipped";
  reason?: string;
}[] = [];

for (const file of files) {
  const path = join(EXCARD_DIR, file);
  const content = readFileSync(path, "utf-8");
  const fm = parseFrontmatter(content);

  const name = String(fm["name"] ?? file.replace(".md", ""));
  const description = String(fm["description"] ?? "");
  const permissions: string[] = (fm["permissions"] as string[]) ?? [];

  const skill_id = nameToSkillId(name);

  // 已有 skill_id → 跳过
  const destPath = join(REGISTRY_DIR, `${skill_id}.json`);
  if (existsSync(destPath)) {
    results.push({ file, skill_id, status: "skipped", reason: "already exists in registry" });
    continue;
  }

  const risk_level = permsToRiskLevel(permissions);

  const card = {
    skill_id,
    action_verb: skill_id.split("-")[1] ?? "run",
    target_object: skill_id.split("-")[0] ?? "unknown",
    description,
    constraints: {
      risk_level,
      requires_confirmation: risk_level === "high",
      idempotent: false,
    },
    input_schema: {
      reason: {
        type: "string",
        required: true,
        source: "user",
        description: "执行原因/触发上下文",
      },
    },
    output_schema: { type: "object" },
    exec_log: { enabled: true, fields: ["skill_id", "timestamp"] },
  };

  writeFileSync(destPath, JSON.stringify(card, null, 2) + "\n", "utf-8");
  results.push({ file, skill_id, status: "created" });
}

// ── update index.json ────────────────────────────────────────────────────

const indexRaw = readFileSync(INDEX_FILE, "utf-8");
const index = JSON.parse(indexRaw) as { skills: { skill_id: string; file: string }[] };

const created = results.filter((r) => r.status === "created");
for (const r of created) {
  const entry = { skill_id: r.skill_id, file: `${r.skill_id}.json` };
  if (!index.skills.find((s) => s.skill_id === r.skill_id)) {
    index.skills.push(entry);
  }
}

writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2) + "\n", "utf-8");

// ── write report ──────────────────────────────────────────────────────────

const successCount = results.filter((r) => r.status === "created").length;
const skipCount = results.filter((r) => r.status === "skipped").length;

const lines = [
  `# ExCard → Skill Card 转换报告`,
  ``,
  `**日期：** ${TODAY}`,
  `**ExCard 目录：** \`${EXCARD_DIR}\``,
  `**Registry 目录：** \`${REGISTRY_DIR}\``,
  ``,
  `## 统计`,
  ``,
  `| 指标 | 数量 |`,
  `|------|------|`,
  `| ExCard 总数 | ${files.length} |`,
  `| 新建 Skill Card | ${successCount} |`,
  `| 跳过（已存在） | ${skipCount} |`,
  ``,
  `## 结果明细`,
  ``,
  `| 文件 | skill_id | 状态 | 原因 |`,
  `|------|----------|------|------|`,
  ...results.map((r) => `| ${r.file} | ${r.skill_id} | ${r.status} | ${r.reason ?? ""} |`),
  ``,
  `## 新建文件列表`,
  ``,
  ...created.map((r) => `- \`${r.skill_id}.json\``),
  ``,
  `## risk_level 映射规则`,
  ``,
  `| permissions[0] | risk_level |`,
  `|----------------|-----------|`,
  `| exec: shell / write: api | high |`,
  `| write: filesystem | medium |`,
  `| 其他 | low |`,
  ``,
].join("\n");

writeFileSync(REPORT_FILE, lines, "utf-8");

console.log(`✅ 完成：新建 ${successCount} / 跳过 ${skipCount} / 总计 ${files.length}`);
console.log(`📄 报告：${REPORT_FILE}`);
process.exit(skipCount > 0 && successCount === 0 ? 2 : 0);
