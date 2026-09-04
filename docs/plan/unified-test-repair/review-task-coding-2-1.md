# Review

Status: completed

Task: `task-coding-2.1` under parent `task-coding-2`

Reviewed commit: `f3625da701b726dfcfd60a3abca70306c466d989`；base target `7c622141914ae0e532833a98d0949d7a6decf475`；唯一 parent / lane sync parent `f61fbf0708aafaf9e893dbbc6d404769a97d74c3`。审查时 `/home/slepher/project/x4-station-calculator/.worktree/coding` 为 clean；候选相对 parent 的精确 diff 仅含 `vitest.config.ts`、`tests/test-setup.ts`。

Evidence:

- `vitest.config.ts:test.include` 精确为 `tests/unified-unit/**/*.spec.ts`、`tests/skills/unit/**/*.spec.ts`、`tests/e2e-skills/unit/**/*.spec.ts`，并以 `tests/unit/**` 明确 exclude。文件枚举分别为 108、4、4 个 spec；legacy `tests/unit/**` 为 85 个 spec。`npm run test:unit -- --run tests/unit/active-view/activeViewStore.spec.ts` 返回 exit `1`、`No test files found`，输出同时显示上述 include/exclude，证明 legacy spec 不在 collection。
- 当前 Vitest `4.1.8` 不支持 `--list`；`npm run test:unit -- --list` 返回 exit `1`、`Unknown option --list`。因此 collection resolution 由配置输出、文件枚举及 legacy focused filter 交叉证明，不把该 CLI 能力缺失计为候选失败。
- `npm run test:unit -- --run tests/unified-unit/production/reorder-stations.spec.ts`：exit `1`；唯一失败为 unchanged spec 在 collection 阶段无法解析既有 `@/store/useEmpireStore`，`0 tests`。按指定边界 defer 给后续 test owner，不视为候选通过，也不归责本候选。
- `npm run test:unit -- --run tests/skills/unit tests/e2e-skills/unit`：exit `1`；8 files 中 6 passed、2 failed，73 tests 中 66 passed、7 failed。7 项失败仅落在 unchanged `tests/skills/unit/validate-test-impl-assets.spec.ts` 与 `tests/skills/unit/validate-test-results-run.spec.ts` 对既有 skill asset/script 的约束；exact signatures 为缺失配对 e2e asset、缺失 `skill-scripts/validate_test_results.py` 及其 5 个 run cases 无法执行。按指定边界 defer 给 skill asset/script owner，不视为候选通过，也不归责本候选。
- `npm run test:unit -- --run tests/e2e-skills/unit/e2e-fixture-patch.spec.ts`：exit `0`；1 file、5 tests passed，证明共享 setup 未隐藏该 canonical skill suite，现有 fixture patch 的 key/shape 仍可消费。
- `npm exec playwright test -- --list tests/unified-e2e/production/station-dashboard.spec.ts`：exit `0`；成功导入 `tests/test-setup.ts` 并列出 1 file 的 33 tests，证明 `@playwright/test` 的动态加载未破坏 Playwright import。
- `npm exec tsc -- --noEmit`：exit `0`；但仓库 `tsconfig.json` 的 project references 不包含 tests。focused `npm exec tsc -- --noEmit --module ESNext --moduleResolution bundler --target ES2023 --types node,vitest/globals tests/test-setup.ts`：exit `2`，在 `tests/test-setup.ts:5-6` 返回两项 TS2339：`Property 'beforeEach' does not exist on type 'typeof globalThis'`。
- `git diff --quiet f61fbf0708aafaf9e893dbbc6d404769a97d74c3 f3625da701b726dfcfd60a3abca70306c466d989 -- tests/fixtures tests/seeds`：exit `0`；fixtures/seeds 未变。现有 `tests/fixtures/db.json` shape 仍为 `vsn` 加 `x4_save_bindings`、`x4_empire_data`、`x4_logic_flow_plans`、`x4_ship_blueprints`，其内部 version/shape 与现有 seed generator 输出一致；本候选未引入第二份 fixture、版本 adapter、fallback 或产品算法复制。
- `git diff --check f61fbf0708aafaf9e893dbbc6d404769a97d74c3 f3625da701b726dfcfd60a3abca70306c466d989` 与最终 `git diff --check`：exit `0`。候选没有产品源码、test scenario、docs、workflow、依赖或新 framework 变更。

Findings:

1. `tests/test-setup.ts:5-6`，symbol `globalThis.beforeEach`：Pinia lifecycle hook 由 ambient global capability probe 决定，而不是由同文件已使用的 Vitest environment boundary 明确决定；该写法在 changed-file focused TypeScript 检查中产生 TS2339，项目级 `tsc` 的 exit `0` 只是因为 tests 未被其 project references 覆盖。合同依据是 `task-coding-2.1` 的 shared setup 精确性、required TypeScript evidence，以及 `audit-implementation-simplicity` 的 context/lifecycle ownership 要求。correction owner 为 `task-coding-2.1`；allowed path 为 `tests/test-setup.ts`。最小修正应在 `process.env.VITEST === 'true'` 分支中从 `vitest` 获取并注册 `beforeEach`，在相反分支才动态加载 `@playwright/test`，不要添加 global mock、adapter 或新 abstraction。必须保留这些 invariant：每个 Vitest test 前建立 fresh Pinia；Vitest 不加载 `@playwright/test`；Playwright 保留现有 extended `page` fixture 与错误收集语义。focused validation：上述 changed-file `tsc` exit `0`；`e2e-fixture-patch.spec.ts` 仍为 5 passed；Playwright focused `--list` 仍成功列出 33 tests。closure observable：TS2339 消失，两个 runner 仍只加载各自拥有的 hook/runtime，且候选 diff 仍限制在 allowed path。

Verdict: changes_required

Changes: 本 reviewer 未修改 product/tests，未 stage/commit/merge；仅创建本 review artifact。需要 coding correction 仅修改 `tests/test-setup.ts`，关闭 Finding 1 后提交新的 immutable candidate 复审。

Caveats: reorder 与 7 项 skill smoke failures 是指定的 unowned transitional failures，保持 deferred；它们不能作为候选 pass 证据。Vitest `--list` 在当前版本不可用，未声明该检查通过。fixtures/seeds 在本候选中 unchanged；current-version physical storage-key 注入仍属于 parent `task-coding-2` 后续 helper/test workflow 的闭环，不由本候选虚报完成。
