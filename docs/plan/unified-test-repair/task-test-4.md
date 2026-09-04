# Test Task Contract

- Task: `task-test-4`
- Bundle generation: `2`
- Plan: `plan-2.md`
- Context: `context-2.md`
- Kind: `test`
- Depends on: `task-test-3`

## Bounded goal

建立 `tests/e2e/**` 唯一产品 E2E 权威，在不丢失旧测试原件的前提下完成 locator、fixture、Live helper 和 Playwright 入口迁移。

## Owned paths

- `tests/e2e/**`
- `tests/unified-e2e/**`
- `tests/legacy/e2e/**`
- `playwright.config.ts`
- `package.json` 中 E2E scripts
- `CLAUDE.md`
- `sitemap.md`

## Ordered work

1. 将当前 `tests/e2e/**` 整体移到 `tests/legacy/e2e/from-e2e/**`。
2. 将当前 `tests/unified-e2e/**` 移到新的 `tests/e2e/**`，包括 Live helper，并修正 imports。
3. 从 legacy 逐项识别 canonical 缺失的真实浏览器行为，适配进 `tests/e2e/**`；原件不删除。
4. 继续按第 1 代已确认的 Sidebar stable test-id、fixture -> reload -> UI language、Live helper 和 fresh build 规则修复 canonical cases。
5. Playwright `testDir` 只指向 `tests/e2e`；legacy/unit/skill tests 不收集。
6. 更新 `CLAUDE.md`、`sitemap.md`，移除迁移中的 unified 路径说明。

## Blocking validation

- `npm run build`
- `npm exec playwright test -- --list`
- feature-scoped canonical E2E runs
- `npm run test:e2e` 在可启动 Chromium 的环境完整通过
- 确认 `tests/unified-e2e/` 不存在且 legacy 原件数量可核对
- `git diff --check`

浏览器环境不可用时记录 exact environment evidence 并交给可运行环境，不得把 launch failure 记为产品失败或通过。legacy E2E 失败不进入 gate。

## Blocking self-validation

- Commands: `npm run build`; `npm exec playwright test -- --list`; feature-scoped canonical E2E runs; `npm run test:e2e`; unified directory absence and legacy count checks; `git diff --check`

## Completion

- `tests/e2e/**` 是唯一 Playwright 产品 suite。
- 旧 E2E 原件全部位于 `tests/legacy/e2e/**`。
- active E2E 仍由 `e2e_tests.md`、`e2e_test_tasks.md` 与 `x4-e2e-test-*` 防止需求漂移。
