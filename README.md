# MH-OS-Axiom

**建立在 OpenClaw 之上的 AI Agent 操作系统扩展**

> 让 AI 真正理解"上下文"和"时间"，而非仅处理即时消息。

---

## 核心定位

MH-OS-Axiom 是老崔的个人 AI 助手二次开发项目，运行在 OpenClaw 平台上，为 AI Agent 提供：

- **语义记忆系统**（Semantic Memory）
- **时间推理引擎**（Temporal Reasoning）
- **条件化心跳调度**（Conditional Heartbeat）
- **可执行手册体系**（Executable Runbook）

---

## 架构一览

### 语义核心系统（Semantic Core）

| 模块                         | 功能                          | 状态 |
| ---------------------------- | ----------------------------- | ---- |
| `factsStore`                 | 结构化事实存储与召回          | ✅   |
| `compaction-yaml-logger`     | 压缩后自动写 facts 到 memory  | ✅   |
| `facts-aware-context-engine` | 查询 facts 注入 System Prompt | ✅   |

### 时间推理系统（Temporal Reasoning）

| 模块                       | 功能                                | 状态 |
| -------------------------- | ----------------------------------- | ---- |
| `timeParser`               | 自然语言时间解析（38/38 test pass） | ✅   |
| `weekday offset algorithm` | 跨周时间计算                        | ✅   |

### 条件化心跳（Conditional Heartbeat）

| 模块                            | 功能                               | 状态 |
| ------------------------------- | ---------------------------------- | ---- |
| `evaluator`                     | AND/OR/NOT 条件解析                | ✅   |
| `policyEngine`                  | Safety Gate + DEFAULT_POLICIES     | ✅   |
| `semanticRouter`                | continue/pause/query/idle 策略路由 | ✅   |
| `conditional-heartbeat` handler | 静默期跳过 + 语义意图检测          | ✅   |

### 可执行手册（Executable Runbook）

| 模块                | 功能                | 状态 |
| ------------------- | ------------------- | ---- |
| `Skill Catalog`     | 17 张 Skill 卡牌    | ✅   |
| `Pipeline Registry` | YAML 声明式流水线   | ✅   |
| `pipeline-executor` | DAG 执行 + 补偿机制 | ✅   |
| `Execution Log`     | 全链路 exec_id 追踪 | ✅   |

---

## 系统特性

**三层时间记忆**

- L1 当天层：对话内实时写入
- L2 月度层：每日 23:00 自动备份
- L3 永久层：决策原则/平台密钥/踩坑记录

**心跳静默期**：凌晨 0:00 - 06:00 默认跳过，非紧急不打扰

**语义路由**：消息先过语义分析，再决定是 continue / pause / query / idle

---

## 技术栈

- **平台**：OpenClaw（Node.js）
- **语言**：TypeScript
- **测试**：Jest（38/38 timeParser tests）
- **调度**：cron + conditional-heartbeat hook

---

## 运行要求

- OpenClaw 已安装（workspace = `/root/.openclaw/workspace/openclaw-src`）
- SSH 密钥配置（用于 GitHub Deploy Key）
- Node.js ≥ 18

---

## 开发分支说明

| 分支            | 用途                           |
| --------------- | ------------------------------ |
| `clean-runbook` | 主力开发分支（GitHub 默认）    |
| `feat/runbook`  | 本地开发历史（完整 commit 链） |

---

## 背景

老崔的 AI 助手（Amber）部署在腾讯轻量服务器（东京），IP：`118.195.11.137`。

Amber 的核心信条：**策略先于创意**，给老崔提供可落地、有逻辑的营销和决策支持。

---

_最后更新：2026-05-16_
