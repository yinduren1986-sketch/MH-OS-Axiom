---
name: heartbeat_prompt_contribution
description: Conditional heartbeat — only contribute to prompt when high-priority pending todos exist. Otherwise skip silently to reduce noise.
trigger: heartbeat
---

# conditional-heartbeat

**类型**: bundled hook  
**Hook Name**: `heartbeat_prompt_contribution`  
**分支**: feat/semantic-core

## 功能

条件化心跳：只在有 pending high-priority todos 时才向 heartbeat prompt 注入内容，否则静默跳过。

## 触发条件

- 每次 OpenClaw 触发 `heartbeat_prompt_contribution` hook 时调用
- 检查 `todos.json` 是否有 `priority: "high"` 的 pending todo
- 有 → 返回轻量 prompt contribution
- 无 → `return undefined`（跳过，不响应）

## 返回值

```typescript
PluginHeartbeatPromptContributionResult = {
  prependContext?: string;  // 有 pending 时注入待办列表
  appendContext?: string;
}
```

## 日志

写入 `logs/conditional-heartbeat.log`（可选，用于调试）
