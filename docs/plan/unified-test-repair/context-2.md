# unified-test-repair 上下文（第 2 代）

- Context status: `ready`
- Supersedes: `context-1.md` 的目录权威、测试删除和 skill gate 决策
- Evidence target: `1c9fab8809fd8e31f8679a2f27a7021cc3f46e02`
- Collected: `2026-09-04`（Asia/Shanghai）

## 已确认目标

1. `tests/unit/**` 是唯一权威产品 Unit 目录；Unit 编写与 focused run 属于代码实现任务。
2. `tests/e2e/**` 是唯一权威产品 E2E 目录；E2E 只通过 `x4-e2e-test-*` 文档、实现和运行链路。
3. 旧测试不删除，统一迁移到 `tests/legacy/**`；legacy 不进入默认验证。
4. `x4-test`、`x4-test-doc`、`x4-test-doc-viewer`、`x4-test-impl`、`x4-test-run` 保留，但移出 active skill discovery 和 command routing。
5. skill 自测失败只阻塞拥有对应 skill/test/script 路径的任务，不得强迫产品 Unit/E2E 重构修复越界问题。
6. 本计划只准备后续执行合同；本会话不启动 codex-workflow。

## 当前事实

| 集合 | 当前 spec 数 | 第 2 代角色 |
| --- | ---: | --- |
| `tests/unit/**` | 85 | 旧产品 Unit 原件，先迁往 `tests/legacy/unit/from-unit/**` |
| `tests/unified-unit/**` | 108 | 权威 Unit 候选，迁往 `tests/unit/**` 后修复 |
| `tests/e2e/**` | 18 | 旧产品 E2E 原件，先迁往 `tests/legacy/e2e/from-e2e/**` |
| `tests/unified-e2e/**` | 60 | 权威 E2E 候选，迁往 `tests/e2e/**` 后修复 |
| `tests/skills/**` | 4 runnable specs + data specs | 旧 mixed test skill 自测，迁往 `tests/legacy/skills/x4-test/**` |
| `tests/e2e-skills/**` | 8 | 活跃 E2E skill 自测，使用独立 suite |

`vitest.config.ts` 当前仍以 `tests/unified-unit/**`、`tests/skills/**`、`tests/e2e-skills/**` 为 include，并排除 `tests/unit/**`；`playwright.config.ts` 当前仍指向 `tests/unified-e2e`。这些是实施任务必须翻转的配置，不是当前权威语义。

## 迁移规则

1. 先保留原件：当前 `tests/unit/**`、`tests/e2e/**` 分别整体移动到 source-specific legacy 子目录。
2. 再建立权威目录：`tests/unified-unit/**` 移到 `tests/unit/**`，`tests/unified-e2e/**` 移到 `tests/e2e/**`。
3. legacy 中仍有独立现行价值的行为，适配后复制为新的 canonical case；legacy 原件仍保留。
4. 重复、过期或仅绑定退役实现的测试不进入 canonical，但仍留在 legacy 并记录分类。
5. 完成后删除空的 `tests/unified-unit/`、`tests/unified-e2e/` 目录；不得建立第二套兼容入口。

## Gate 边界

产品测试任务的 blocking validation 必须落在其 owned paths 和 canonical suite。以下只记录、路由、延期，不阻塞当前产品测试任务：

- unchanged `tests/skills/**`、`tests/e2e-skills/**` 或 `skill-scripts/**` 失败；
- `tests/legacy/**` 失败；
- 任务无权修改的既有失败。

workflow/skill owner 修改活跃 skill 时仍必须通过自身 quick validation 与活跃 skill suite。该义务与产品测试任务分离。

## Active agent requirements

- 行为变更的实现任务没有 `tests/unit/**` focused evidence：reject。
- 新增或修改产品测试落在 `tests/unit/**` / `tests/e2e/**` 之外：reject。
- E2E 绕过 `e2e_tests.md`、`e2e_test_tasks.md` 或 `x4-e2e-test-*`：reject。
- active route 调用任何旧 `x4-test-*`：reject。
- 可迁移的旧测试被删除而不是移入 `tests/legacy/**`：reject。
- task-local blocking command 主要验证非 owned path：reject task contract。

## 保留的第 1 代证据

`context-1.md`、`plan-1.md`、`lanes-1.md`、原任务/评审文件及 `history/generation-1/status*.md` 保留为历史证据。其“unified 目录为 canonical”“允许删除旧测试”“skill suite 阻塞 task-test-1”三项不再有效。
