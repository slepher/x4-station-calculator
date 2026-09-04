# Test Task Contract

- Task: `task-test-3`
- Bundle generation: `2`
- Plan: `plan-2.md`
- Context: `context-2.md`
- Kind: `test`
- Depends on: `task-coding-3, task-coding-4`
- Covers: `task-coding-3, task-coding-4`

## Bounded goal

建立 `tests/unit/**` 唯一产品 Unit 权威，同时保留所有旧 Unit 与旧 mixed skill test 原件。

## Owned paths

- `tests/unit/**`
- `tests/unified-unit/**`
- `tests/skills/**`
- `tests/legacy/unit/**`
- `tests/legacy/skills/x4-test/**`
- `tests/test-setup.ts`
- `vitest.config.ts`
- `package.json` 中 Unit/skill scripts

## Ordered work

1. 将当前 `tests/unit/**` 整体移到 `tests/legacy/unit/from-unit/**`。
2. 将当前 `tests/unified-unit/**` 移到新的 `tests/unit/**`。
3. 将 `tests/skills/**` 移到 `tests/legacy/skills/x4-test/**`；保留其已知失败证据，不修造已退役资产。
4. 从 legacy 逐项识别 canonical 缺失的现行行为，适配为新的 `tests/unit/**` case；原件不删除。
5. 修复 canonical Unit 的 import/mock/setup/fixture/过时预期，但不修改产品代码迎合旧实现。
6. Vitest 默认只 include `tests/unit/**/*.spec.ts` 并 exclude `tests/legacy/**`、E2E 和 skill tests。
7. 新增独立 `npm run test:skills`/config，只收集 active `tests/e2e-skills/**`。

## Blocking validation

- integrate 必须先从包含已接受 `task-coding-4` candidate 的 target HEAD 刷新，并运行 canonical BUG-001 focused case。
- `npm run test:unit`
- focused Unit collections/runs needed by failure clusters
- 确认默认 collection 无 `tests/legacy/**`、`tests/e2e-skills/**`
- 确认 `tests/unified-unit/` 不存在且 legacy 原件数量可核对
- `git diff --check`

`npm run test:skills` 的结果作为 workflow owner evidence；若失败，路由到 `task-coding-3` correction，不阻塞本产品 Unit 任务，也不得在本任务越权修 skill assets。

## Blocking self-validation

- Commands: `npm run test:unit -- tests/unit/current/build-flow-plan/buildPlanProductionLine.spec.ts -t "uses settings.racePreference for unmatched derived module selection"`; `npm run test:unit`; default collection check; legacy count check; `git diff --check`

## Completion

- `tests/unit/**` 是唯一默认产品 Unit suite 并通过。
- 旧 Unit 与旧 mixed skill tests 全部可在 `tests/legacy/**` 找到。
- 没有通过删除失败测试、跳过 canonical case 或建立兼容 include 来通过。
- `BUG-001` focused regression 在 target-visible source correction 上通过；该证据与完整 Unit/build evidence 交给 target owner 完成 bug closure。
