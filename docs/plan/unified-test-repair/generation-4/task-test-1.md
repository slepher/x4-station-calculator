# task-test-1：current E2E 迁移与修复合同

- Task ID: `task-test-1`
- Task status: `ready`
- Kind: `test`
- Context: `context.md`
- Plan: `plan.md`
- Lanes: `lanes.md`
- Target branch: `develop`
- Target base: `da05d84514c90428fd4e51907df9b6424fa5ccff`
- Base: `da05d84514c90428fd4e51907df9b6424fa5ccff`
- Lane: `integrate`
- Execution strategy: `single-sup`
- Worker role: `sup_coding_worker`
- Depends on: `none`
- Covers: `none`

## Outcome

在一个共享生命周期 owner 中，把现有 current E2E 任务、fixture、helper、locator 和 assertion 迁移到最新 accepted specs/current code，并留下可复现、可分类、可复验的行为证据；不得由 test worker 修复或改写产品代码。

## Owned paths

- `tests/e2e/**`
- `tests/unified-e2e/**`
- `tests/legacy/e2e/**`
- `playwright.config.ts`
- `package.json` 中 E2E scripts
- `CLAUDE.md`
- `sitemap.md`

`src/**` 明确不属于本任务。不得修改 Unit/skill scripts、OpenSpec、状态/index、Git 配置或其他规划 artifact；只有发生合同定义的 infeasible item 时可创建同目录 `task-test-1-report-1.md`。

## Observable correctness boundary

- 测试只判断用户可见状态、真实 UI 交互结果和当前规范定义的持久化领域字段。
- `page.evaluate` 只可由 authoritative fixture helper 用于准备 archive/storage 或读取规范允许的最终领域状态；不得用它直接执行被测 mutation、drag/drop、group assignment 或构造 expected。
- expected candidate 不得从 `liveStore.autoGroupResult` 或其他被测输出反推；group identity 不得以 UUID 替代当前 `sectorMacro`/runtime groups authority。
- 不断言完整 UI-derived object、本地化字符串副产物、`undefined` representation 或私有组件/函数形状；只断言纠错所需领域字段。
- skip、注释失败 assertion、只检查 length/存在性、提高 timeout 或一次重跑成功，都不构成行为修复。

## Scope and migration requirements

1. 盘点并保留 target 上现有 canonical、unified 与 legacy E2E 原件；迁移而非无证据删除。
2. 复用 `loadLiveBindingFixture(page)` 及其 `transformSave` seam，覆盖同一 GUID/不同 archive time；不得新建平行 loader。
3. 将 stale edit/preview retain、独立 Exit 和 UUID identity 断言迁移为当前 `[查看 | 编辑 | 重算]`、retain/reset 与 `sectorMacro` 语义。
4. binding reset 前必须通过真实 UI 修改 virtual draft，再断言 reset 恢复 saved binding 初始领域口径。
5. 为 threshold、top-5、pure-qualified、zero-container 构造独立 fixture oracle；runtime group mapping 从当前可观察 groups 推导。
6. 把 draft 保留、重算归属、未分组提交删除、confirm/apply 的弱 length/存在性断言替换为对应领域结果。
7. existing virtual station 必须走真实 pointer drag/drop，观察 dragging class、合法 polygon、`.placement-preview--binding`、release 后 `position`、`sectorMacro`、`groupId`；不得直接改 store 充当 witness。
8. trade station 可移动，但 `sectorMacro` 固定 hub 且归 `tradeStation`；不得使用 fallback group 掩盖 invariant。
9. canonical collection 最终只指向 `tests/e2e/**`；旧原件迁入 `tests/legacy/e2e/**` 且默认不收集，`tests/unified-e2e/**` 不再存在。
10. 只同步与 E2E canonical 路径、helper 或命令直接相关的 `CLAUDE.md`、`sitemap.md`。

## Procedure

### 1. Preflight

- 验证当前 lane 的 `HEAD`/base 等于 `da05d84514c90428fd4e51907df9b6424fa5ccff`，upstream target branch 是 `develop`，并记录初始 dirty paths；不覆盖用户变动。
- 运行 `npm exec playwright test -- --list`，记录 current collection；随后运行下列 focused suites 和完整 E2E，建立 fresh baseline。失败命令不得被重跑成功覆盖。

### 2. Reproduce before classification

每个待迁移项先记录：scenario/acceptance ID、精确 command、fixture/context、用户操作、预期 observable、实际 observable、稳定性。然后分类：

- `stale`：断言与当前 accepted spec 冲突；迁移测试，不改产品。
- `test-owned`：fixture/helper/locator/oracle/witness/config 错误；在 owned paths 修复。
- `product`：先排除 stale/test-owned，并以真实 UI path 在 immutable base 上复现；暂停该 dependent acceptance，提交证据给 planner/reviewer，test worker 不碰 `src/**`。
- `unknown`：证据不足或环境不允许分类；继续最小复现，不能以 pass/skip 关闭。

### 3. Migrate cohesively

按 shared fixture -> binding/context/reset -> candidate oracle/runtime mapping -> draft/recompute/commit -> real drag/drop -> canonical collection/docs 的顺序串行修改和 focused rerun。helper 或 fixture 变更后必须复跑所有受影响 binding/core/map suites，不能只跑最后触达的 spec。

### 4. Product correction checkpoint

若 `core 5.3` 或其他 scenario 在 test-owned 前置修正后仍稳定违反当前规范：保留 trace/screenshot/actual domain state 与精确 command，返回 planner 在当前 generation 创建 `task-test-1-fix-M.md`。该 correction 必须由 coding lane、显式 `src/**` ownership、coding worker 和独立 reviewer 承担，路由为 `coding -> target -> integrate -> target`，并声明 `Returns to: task-test-1`。

恢复时先从含 accepted fix 的 target 刷新 integrate，把实际 fix ID 写入本任务 `Depends on` 与 `Covers`，再从原 reproduction 步骤开始复跑。禁止把 coding candidate 直接合入 integrate。

### 5. Intermittence and infeasibility

- 任一 scenario 先失败后通过时，保留全部结果并继续相同 focused suite、所有共享 helper 受影响 suites 与 full E2E；单次 pass 不改变分类或 closure。
- 如果环境、fixture 或当前规范缺口使任务不可执行，在完成所有安全 attempts 后创建 `task-test-1-report-1.md`，至少包含 `Report ID`、`Task`、`Base`、`Status: retained-failure`、`Failed acceptance IDs`、`Attempts`、`Blocker`、`Unmet acceptance`、`Evidence`、`Owner`、`Recovery conditions`、`Recovery commands`、`Independent acceptance still closable`。
- failure report 只阻塞 `Failed acceptance IDs` 及其依赖；其余独立项继续执行。不得删除 infeasible scenario 或宣称整个任务通过。

## Acceptance

- `TT1-A1`：current collection 与每项迁移都有 fresh reproduction/classification evidence。
- `TT1-A2`：binding mode、retain/reset、same-GUID/new-archive context lifecycle 由真实 UI 操作和领域 oracle 证明。
- `TT1-A3`：candidate filtering/threshold/top-5/pure-qualified/zero-container 使用独立 expected；group mapping 来自 runtime authority。
- `TT1-A4`：virtual drafts 在 recompute/confirm/apply 下的保留、重新归属和未分组删除均有领域结果断言。
- `TT1-A5`：existing virtual station 的真实 pointer path 完整通过 preview/drop witness；trade station hub/ownership invariant 通过。
- `TT1-A6`：canonical/legacy 目录、Playwright 配置、E2E scripts 和相关文档只有一个 current authority，历史原件未丢失。
- `TT1-A7`：所有 blocking validation 通过，或有 retained failure report 精确阻塞对应 acceptance；没有间歇性 pass、skip 或弱 oracle 被算作 closure。
- `TT1-A8`：若确认产品缺陷，accepted correction 已通过 target-mediated route，父任务 `Depends on`/`Covers` 已更新且 fresh rerun 通过；test worker 对 `src/**` 零改动。

## Blocking self-validation

- Commands: `npm exec playwright test -- --list`; `npm exec playwright test -- tests/e2e/auto-sector-group-one-binding`; `npm exec playwright test -- tests/e2e/auto-sector-group-one-core`; `npm exec playwright test -- tests/e2e/auto-sector-group-one-map`; `npm run test:e2e`; `npm run build`; `git diff --check`

按顺序执行并保留命令、exit code 与关键结果：

```bash
npm exec playwright test -- --list
npm exec playwright test -- tests/e2e/auto-sector-group-one-binding
npm exec playwright test -- tests/e2e/auto-sector-group-one-core
npm exec playwright test -- tests/e2e/auto-sector-group-one-map
npm run test:e2e
npm run build
git diff --check
```

若实际迁移后的 focused 文件路径不同，必须记录 old -> new 映射，并用新 canonical path 执行等价 focused command；不能静默省略。`npm run build` 不得触发 `npm run build-rust`，因为本任务不拥有 `rust-parser/src/*.rs`。

## Failure ownership

| Failure | Owner | Effect |
| --- | --- | --- |
| owned fixture/helper/locator/assertion/config | `task-test-1` / `sup_test_worker` | 阻塞对应 `TT1-*`，修复并复跑 |
| current behavior after test-owned causes excluded | coding correction / coding worker | 只暂停依赖 scenario；经 reviewer 与 target-mediated route 后返回本任务 |
| external runner/browser/environment | environment/workflow owner | retained failure report；只阻塞需要该环境的 acceptance |
| unrelated Unit/skill/product failure | corresponding external owner | 记录并继续，无依赖则不阻塞本任务 |

## Deferred closure owner

所有 retained failure 的 deferred closure owner 是 `develop` target owner。该 owner 只能在 failure report 的 recovery conditions 满足、精确 recovery commands 产生 fresh evidence、且对应 test reviewer 接受后关闭被阻塞 `TT1-*`；不得把历史结果或一次间歇性 pass 当作恢复。

## Exclusions

- 不修改 `src/**`、产品语义、OpenSpec、Unit/skill tests 或非 E2E scripts。
- 不新增测试框架、parallel helper/store bridge、fallback chain 或兼容 stale contract 的产品路径。
- 不要求 legacy tests 通过，不修复无关 failure，不创建 status/index/commit/delegate。

## Handoff

候选交给 test reviewer 时必须包含：immutable Base、changed paths、old -> new 原件映射、每个 `TT1-*` 的 reproduction/classification/validation evidence、所有 intermittent outcomes、产品 correction route（如有）及 retained failure report（如有）。reviewer 接受后只能从 integrate 进入 `develop` target；只要任一 dependent acceptance 未关闭，就不得报告 Goal 完成。
