# OSC 项目状态文档

> **项目**: OpenClaw Semantic Core (OSC)
> **分支**: `feat/runbook`（合并后）
> **更新**: 2026-05-16
> **状态**: Phase 4-5 完成，集成收尾

---

## 一、已完成内容（Phase 1-5 全览）

### Phase 1-3（原有，feat/semantic-core）

| 模块                        | 文件                                               | 状态          |
| --------------------------- | -------------------------------------------------- | ------------- |
| timeParser                  | `src/utils/timeParser.ts`                          | ✅ 38/38 测试 |
| memoryParser                | `src/utils/memoryParser.ts`                        | ✅            |
| factsStore                  | `src/db/factsStore.ts`                             | ✅ JSONL实现  |
| facts-aware context engine  | `src/context-engine/facts-aware-context-engine.ts` | ✅            |
| compaction-yaml-logger hook | `src/hooks/bundled/compaction-yaml-logger/`        | ✅            |
| factsSchema                 | `src/db/factsSchema.sql`                           | ✅            |

### Phase 4（新建，feat/semantic-core → merge to feat/runbook）

| 模块                          | 文件                                        | 测试        |
| ----------------------------- | ------------------------------------------- | ----------- |
| heartbeat condition evaluator | `src/cron/heartbeat-condition/evaluator.ts` | ✅ 15/15    |
| Safety Gate policyEngine      | `src/safety/policyEngine.ts`                | ✅ 6/6      |
| rollback test script          | `scripts/rollback_test.sh`                  | ✅ 实跑通过 |

### Phase 5（新建）

| 模块                                        | 文件                                                 | 测试        |
| ------------------------------------------- | ---------------------------------------------------- | ----------- |
| semantic intent router                      | `src/utils/semantic-router/semanticRouter.ts`        | ✅ 26/26    |
| semanticRouter → conditional-heartbeat 集成 | `src/hooks/bundled/conditional-heartbeat/handler.ts` | ✅ 实跑通过 |

---

## 二、施工中发现的新问题

### ⚠️ 问题1：GitHub 认证缺失，无法自动 push

**现象**: `git push origin feat/runbook` 失败，无认证
**影响**: 分支合并后需要{{user}}手动 push，或者配 SSH key
**建议**: 配置 `git config --global credential.helper store` 或使用 SSH

---

### ⚠️ 问题2：Subagent Gateway 断连（jinhua 两次）

**现象**: `pipeline-executor-impl` 任务执行到一半 gateway 1006 断连
**实际情况**: 代码实际已写入（488行），只是回报时断连
**影响**: 任务被标记为失败，但实际已完成
**建议**: subagent 长任务增加心跳汇报，或任务完成后写本地文件再断连

---

### ⚠️ 问题3：后台编辑失败（误报）

**现象**: `evaluator.ts` 编辑失败提示（{{user}}后台）
**实际**: 文件在 git 分支上正常（17文件已合并），疑似后台环境分支不匹配
**根因**: 后台编辑器可能在 `main` 分支打开，而文件只在 `feat/semantic-core` 存在
**建议**: 后台编辑前确认分支是 `feat/runbook` 或 `feat/semantic-core`

---

### ⚠️ 问题4：Phase 5 intent 写入机制未完成

**现象**: `semanticRouter` 集成完成，但 intent 写入链路（dispatch → `.recent_intent.json`）还没接上
**当前**: handler 读 `.recent_intent.json`，但 echoreply dispatch 脚本还未写入该文件
**状态**: 功能已就绪，等待 dispatch 脚本改造
**影响**: 当前 intent 策略默认降级为 idle（静默），不打扰用户

---

## 三、当前分支状态

```
feat/runbook（HEAD = c196a047）
├── 37张 Skill Card（R1）
├── Pipeline Registry + executeStep真实调用（R2）
├── Execution Log + 补偿日志（R3）
├── 条件化心跳 + Safety Gate（凌晨2-6点强制跳过）
├── heartbeat condition evaluator（AND/OR，支持> < ==）
├── policyEngine（Safety Gate，block rm -rf/凭证外发/高危邮件）
├── semanticRouter（意图分类：continue/pause/query/idle）
├── semanticRouter → heartbeat hook 集成（strategy-aware消息）
└── rollback_test.sh ✅
```

---

## 四、待完成事项

- [ ] dispatch 脚本写入 `.recent_intent.json`（intent 传递链路）
- [ ] GitHub push（需 SSH 认证或手动 push）
- [ ] Phase 5 自治维护（factExtractor / conflictDetector）— 延后

---

## 五、经验教训

1. **subagent 长任务要写本地文件再断连** — jinhua 的教训，代码写入了但没回执
2. **多分支协同时，合并前先确认文件路径归属** — 同一文件在两分支路径相同可直接 merge
3. **后台编辑失败不一定是文件损坏** — 先 `git status` + `git branch` 确认分支再下结论
4. **最小路径测试** — 每个新模块独立写 test，跑过再合入，不在生产环境试错

---

_2026-05-16 13:53_
