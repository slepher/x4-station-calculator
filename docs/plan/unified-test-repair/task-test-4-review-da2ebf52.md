# generation-2 task-test-4 F1 review

Status:
`review_complete`

Task:
`task-test-4` generation-2 reviewer；只复核 full reviewer finding F1 在 immutable candidate `da2ebf52` 的关闭情况。未修改产品、测试、fixture、配置、workflow 状态、git index 或 candidate。

Reviewed commit:
`da2ebf527fadd2c220d6f815e2c0fe4338bd97e4`

Evidence:

- 审查时 `HEAD` 为 candidate，`git status --short` 无输出；direct parent 为 `5c2983b1a1841286f80913d632ab84c678d4592e`，即上一份 full reviewer 报告提交。candidate 是单提交 delta，commit tree 为 `85b169a1b0e0a2c8bdfea8cb39e32f017a9b535c`。
- `git show --find-renames=50% --stat da2ebf52` 与 `git diff da2ebf52^ da2ebf52` 显示只移动 7 个 F1 `bug-*` 文件；没有 `src/**`、fixture、Playwright 配置或 `bugfix-*` 修改。
- 7 个原件现完整位于要求的 legacy 位置：

  | legacy 文件 | 历史场景数 | 对应 canonical 当前回归 |
  | --- | ---: | --- |
  | `tests/legacy/e2e/map/bug-advanced-resource-filter.spec.ts` | 1 | `tests/e2e/map/bugfix-advanced-resource-filter.spec.ts` |
  | `tests/legacy/e2e/ship/bug-abandon-selected-ship.spec.ts` | 1 | `tests/e2e/ship/bugfix-abandon-selected-ship.spec.ts` |
  | `tests/legacy/e2e/ship/bug-build-ship-equipment-panel.spec.ts` | 7 | `tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts` |
  | `tests/legacy/e2e/ship/bug-ship-build-panel-ship.spec.ts` | 2 | `tests/e2e/ship/bugfix-ship-build-panel-ship.spec.ts` |
  | `tests/legacy/e2e/ship/bug-ship-equipment-selector.spec.ts` | 1 | `tests/e2e/ship/bugfix-ship-equipment-selector.spec.ts` |
  | `tests/legacy/e2e/ship/bug-ship-level-blueprint.spec.ts` | 1 | `tests/e2e/ship/bugfix-ship-level-blueprint.spec.ts` |
  | `tests/legacy/e2e/ship/bug-ship-status-diff.spec.ts` | 1 | `tests/e2e/ship/bugfix-ship-status-diff.spec.ts` |

  合计恰为 full reviewer 指出的 7 文件、14 个 pre-fix/vacuous 场景。
- 对 parent 中原文件与 candidate 中 legacy 文件逐项做内容 diff：测试标题、步骤、注释和断言均保留。唯一语义性改动是 11 处目录深度修正：ship 文件的 `../../test-setup`、所有使用 fixture 的文件的 `../../fixtures/db.json` 改为 `../../../...`；map 文件另补齐 EOF newline。`bug-ship-equipment-selector.spec.ts` blob 前后完全相同。
- 移动后的全部相对引用均解析正确：`../../../test-setup` 对应 `tests/test-setup.ts`，`../../../fixtures/db.json` 对应 `tests/fixtures/db.json`；未发现其他相对 import/fixture 引用。
- 7 个 canonical `bugfix-*` 文件在 parent 与 candidate 的 blob id 逐项一致，证明当前回归没有被 candidate 改写或删除。相关 OpenSpec 仍保留当前行为：`openspec/specs/advanced-resource-filter/spec.md`、`openspec/changes/archive/2026-03-09-abandon-selected-ship/specs/abandon-selected-ship/spec.md`、`openspec/changes/archive/2026-03-05-build-ship-equipment-panel/specs/equipment-panel/spec.md`、`openspec/changes/archive/2026-03-09-ship-build-panel-ship/specs/ship-build-panel-ship/spec.md`、`openspec/changes/archive/2026-03-05-ship-equipment-selector/spec.md`、`openspec/changes/archive/2026-03-09-ship-level-blueprint/specs/ship-level-blueprint/spec.md`、`openspec/specs/ship-status-diff/spec.md`。历史提交 `9183c1bf`、`1725868e`、`cd7d46bf`、`5759882c`、`b7a9afb2`、`5541b657` 也显示 pre-fix 与 bugfix 文件原本成对记录修复。
- `npm exec playwright test -- --list` exit `0`，当前 canonical 收集为 `1005 tests in 71 files`。上一份 full reviewer 的同一 collection 为 `1019 tests in 78 files`；差值恰为 14 tests / 7 files。过滤输出只出现 7 个 `bugfix-*` 文件的 16 个当前回归，没有任何迁出的 `bug-*` 文件或其 14 个历史场景。`playwright.config.ts` 的 `testDir` 仍为 `./tests/e2e`，legacy 不会进入 canonical collection。
- focused 命令运行 7 个 `bugfix-*` 文件，实际收集 `16 tests`，结果 `1 passed, 15 failed`。15 个失败全部停在上一份 full reviewer 已归为 F3/F4 的 fixture/入口状态或 retired selector：不可见的 `map-resource-entry-button`、缺失的 `ship-build-filters` / `ship-build-panels`、缺失的 `Load` 入口；均未到达对应当前行为断言。该结果证明 current regression files 仍在 active suite，同时不构成 F1 移动导致的产品缺陷。
- focused Playwright 的 webServer 自动执行 production build，`vue-tsc -b` 与 Vite build 成功；`git diff --check da2ebf52^ da2ebf52` exit `0`。未运行完整 E2E。

Findings:

- 无 `changes_required` finding。F1 的原件保留、相对路径修正、canonical 排除和对应 current-regression 保留均闭环；未误删当前行为，也没有产品 bug 证据。

Verdict:
`passed`

Changes:
仅新增本报告 `docs/plan/unified-test-repair/task-test-4-review-da2ebf52.md`。

Caveats:

- 本 verdict 只关闭 candidate `da2ebf52` 对 full reviewer F1 的修正，不代表 `task-test-4` 完成。上一份 full reviewer 的 F2、F3、F4 与完整 `npm run test:e2e` gate 仍保持开放。
- focused run 的 15 个失败继续归 task-test-4 测试迁移 owner；应按既有 F3/F4 修复 setup、fixture 和 selector 后重跑，不升级为产品 bug。
