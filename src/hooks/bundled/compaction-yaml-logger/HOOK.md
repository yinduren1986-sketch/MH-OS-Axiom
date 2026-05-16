---
name: compaction-yaml-logger
description: "After each context compaction, writes structured facts to both the daily memory YAML block and the JSONL facts store. OSC Phase 2 Day 7 component."
homepage: https://docs.openclaw.ai
metadata:
  {
    "openclaw":
      {
        "emoji": "📝",
        "events": ["session:compact:after"],
        "requires": { "config": ["workspace.dir"] },
        "install": [{ "id": "bundled", "kind": "bundled", "label": "OSC Extension" }],
      },
  }
---

# Compaction Facts Logger

OSC (OpenClaw Semantic Core) Phase 2 Day 7 component.

## What It Does

On `session:compact:after`, this hook:

1. Extracts up to 5 key facts from the compaction summary text
2. Appends a YAML facts block to `memory/YYYY-MM-DD-daily.md`
3. Writes structured facts to `facts.jsonl` (factsStore)

## YAML Output Format (memory file)

```yaml
---
compaction:
  timestamp: "2026-05-15T02:00:00.000Z"
  tokens_before: 180000
  tokens_after: 45000
  tokens_saved: 135000
  message_count: 87
  facts_count: 5
---
```

## Facts Store Format (facts.jsonl)

```json
{
  "id": 1,
  "subject": "compaction",
  "predicate": "fact_1",
  "object": "...",
  "source": "agent:main:qqbot:direct:xxx",
  "confidence": 0.85,
  "tags": ["compaction", "auto-generated"],
  "created_at": "..."
}
```

## Requirements

- `workspace.dir` configured
- `memory/` directory writable
- Facts store auto-initializes on first write

## Query Facts

```bash
node src/db/factsStore.ts --stats
node src/db/factsStore.ts --query "keyword"
```
