# MH-OS-Axiom

**建立在 OpenClaw 之上的 AI Agent 操作系统扩展**

> _An AI Agent operating system extension built on OpenClaw._

---
<img width="1672" height="941" alt="ChatGPT Image 2026年5月17日 22_42_59" src="https://github.com/user-attachments/assets/c7ac02cd-8dbb-4279-b32d-2aa3f00020f7" />

## Axiom — 不言自明的真理

_Unquestionable truth — the starting point of all reasoning._

古希腊数学家欧几里得用五条公理推演出整座几何大厦。

Euclid built an entire geometric system from five axioms.

公理不需要证明，因为它们本身就是证明的起点。

Axioms need no proof — they are the起点 of proof itself.

**MH-OS-Axiom 的核心假设只有一条：**

**The single core assumption of MH-OS-Axiom:**

> 一个真正有用的 AI，应该记得你说的话，理解时间的力量，在该出现的时候出现，在该安静的时候安静。

> A truly useful AI should remember what you said, understand the power of time, show up when it should, and stay quiet when it should.

基于这一条公理，推导出整套系统架构。

From this single axiom, the entire system architecture is derived.

---

## 旧的问题 — The Old Problem

大多数 AI 助手都是：**你问，它答，答完忘光。**

Most AI assistants work the same way: **you ask, it answers, then forgets.**

下一次对话，你们之间没有任何记忆桥梁。你说「上次那个继续弄」，它问「哪个上次」。

The next conversation starts with no memory bridge between you. You say "continue from last time" and it asks "which time?"

时间在这里是断裂的——每次对话都是孤岛，上下文无法跨次延续。

Time is fragmented here — every conversation is an isolated island, context cannot carry across sessions.

---

## 新的解法：三层时间记忆

## The New Solution: Three-Layer Temporal Memory

### L1 — 当天层（Within-Day）

**文件**：`memory/YYYY-MM-DD-daily.md`
**生命周期**：单次对话内
**机制**：对话中有结论时触发 `memory_add.py` 写入

During a conversation, conclusions trigger `memory_add.py` to write to today's memory file.

**召回**：L1 优先，精确匹配
**Recall**: L1 first, exact match.

---

### L2 — 月度层（Cross-Day）

**文件**：`memory/YYYY-MM-monthly.md`
**生命周期**：按月自然冷却
**机制**：每日 23:00 cron 自动从 L1 批量备份

Daily at 23:00, cron backs up L1 files into monthly archives for natural decay over time.

**召回顺序**：L1 → L2 → L3（查到这里找到就停）
**Recall order**: L1 → L2 → L3, stop at first hit.

---

### L3 — 永久层（Permanent）

**文件**：`MEMORY.md` + `MEMORY.private.md`
**生命周期**：永久
**机制**：

- 老崔明确说「这个要记住」→ 立即写入
- 同一个决策出现两次 → 泛化为规则
- 踩坑后找到正确路径 → 写入经验区

**Recall**: Always available. Principles, platform keys, lessons learned — all permanent.

**写入判断三问**：

1. 这个以后还会遇到吗？ / Will this come up again?
2. 别人做会踩同样的坑吗？ / Will others hit the same wall?
3. 这是临时结论还是可泛化的经验？ / Is this temporary or generalizable?

---

## 条件化心跳：不无谓唤醒

## Conditional Heartbeat: No Unnecessary Wake-ups

普通的 AI 服务：每30分钟心跳一次，不管有事没事。

Ordinary AI services: heartbeat every 30 minutes, regardless of有事 or 没事.

MH-OS-Axiom 的心跳是有条件的：

MH-OS-Axiom's heartbeat is conditional:

**有事 → 唤醒 → 执行 → 通知你**
**没事 → 安静 → 等下次信号**

**有事**: wake → execute → notify you.
**没事**: stay quiet → wait for next signal.

凌晨 2:00 到早上 6:00，默认不打扰。

2 AM to 6 AM — default silent mode, no interruptions.

不是功能削减，是基本的时间感知。

Not a feature reduction — basic time awareness.

---

## Skill Catalog：定义动作，不只是聊天

## Skill Catalog: Define Actions, Not Just Chat

传统的 AI 交互：发一条消息，等回复，靠模型猜你要什么。

Traditional AI interaction: send a message, wait for reply, rely on model to guess your intent.

MH-OS-Axiom 把动作写进卡牌，17 张标准化技能，每张卡有：

MH-OS-Axiom writes actions into cards — 17 standardized skills, each card has:

- **action_verb**（做什么）/ What it does
- **输入约束**（需要什么参数）/ Input constraints
- **输出格式**（返回什么结构）/ Output schema

然后由 Pipeline Registry 编排执行顺序，DAG 依赖 + 补偿机制，全程可回溯。

Then Pipeline Registry orchestrates execution order, DAG dependencies + compensation mechanisms, full traceability.

说「做」就做，不是聊天。

"Do" means do, not chat.

---

## 设计哲学 — Design Philosophy

> 不做更多功能的 AI，做更懂你的 AI。
> Not a more feature-rich AI — a more understanding AI.

记得住你说的，才能真的帮你。
Remember what you said, truly help you.

理解时间的上下文，才能在该出现的时候出现。
Understand temporal context, show up when you should.

把动作写成可执行的，才能不只是「给建议」。
Write actions as executable, not just "give recommendations."

---

## 技术栈 — Technical Stack

- **平台**：OpenClaw（Node.js / TypeScript）
- **记忆层**：L1/L2/L3 三层召回
- **调度**：Pipeline Registry（YAML DAG）+ executeStep 真实工具调用
- **心跳**：Conditional Heartbeat + Safety Gate
- **测试**：timeParser 38/38 全绿 / All 38 tests passing

---

## 项目状态 — Project Status

- 代码：MIT License，公开可取 / MIT License, open to all
- 文档：持续更新，欢迎贡献 / Documentation ongoing, contributions welcome
- 平台：运行在 OpenClaw 上（需要 Node.js ≥ 18）/ Runs on OpenClaw (Node.js ≥ 18 required)

---

## 核心原则 — Core Principle

**存哪说哪。** 每次把信息存进文件，立刻注明「去这里找」。知道存在哪约等于没存。

**Store where you say, say where you store.** Every time you save information to a file, note "find it here." Knowing where it is but not saying so means it doesn't exist.

<img width="1536" height="1024" alt="ChatGPT Image 2026年5月17日 22_52_59" src="https://github.com/user-attachments/assets/dde9902c-9010-4719-8b13-33b64993d53c" />

---

_最后更新 / Last updated: 2026-05-16_
