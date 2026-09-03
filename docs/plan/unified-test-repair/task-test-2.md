# Test Task Contract

- Task: `task-test-2`
- Bundle generation: `1`
- Phase artifact: `task-test-2.md`
- Plan: `plan-1.md`
- Lane manifest: `lanes-1.md`
- Context: `context-1.md`
- Evidence target: reviewed immutable `task-test-1` integrate checkpoint over accepted coding target
- Task kind: `test`
- Mode: `hard`
- Mode basis: 78 个现/旧 E2E spec 的价值裁剪、Sidebar locator 迁移和浏览器 fixture 链必须在同一 fresh-build candidate 上统一完成，避免重复场景和混合旧新 selector。
- Execution strategy: `single-sup`
- Worker role: `sup_coding_worker`
- Lane: `integrate`
- Worktree: `/home/slepher/project/x4-station-calculator/.worktree/integrate`
- Branch: `codex/unified-test-repair-g1-integrate`
- Base: dispatcher 绑定的 reviewed `task-test-1` checkpoint
- Depends on: `task-test-1`
- Covers: `task-coding-1, task-coding-2`

## Bounded goal

把 E2E 收敛到 `tests/unified-e2e/`：把仍有效的 TabBar 行为测试迁移为 Sidebar stable test-id 测试，迁移旧目录独有的真实浏览器边界，删除重复/退役/纯实现细节集成测试，并在当前源码 fresh build 上执行完整 canonical suite。

## Coverage objectives

1. Blueprint Sidebar：概览、station selection、create、rename、duplicate、delete confirm/cancel、折叠与 station reorder；重排后 DOM/持久顺序变化且 active ID 不变。
2. Live Sidebar：概览、station、Transit、Terraforming/Research/NPC Trade/Blueprint Recipe 等当前固定入口、星区折叠和受限 context menu。
3. 所有导航只使用 `context-1.md` 的 stable test-id + entity attribute；无 `.station-tab`、`.overview-tab`、旧 TabBar component 或依赖翻译文本的非文本元素 locator。
4. 普通 `beforeEach` 使用 db fixture -> reload -> UI 语言；Live 用例只调用唯一 `loadLiveBindingFixture(page)`，不手写 archive/records。
5. import/export、module/ware flow、map、ship 等保留用例只覆盖 unit 无法替代的浏览器集成边界；长链中重复验证的 store 计算下沉为 unit 或删除重复 E2E。
6. `tests/e2e/` 中 unified 缺失的当前行为迁移后删除源 spec；同一 feature/bug/bugfix 场景只保留最强的一条黑盒链。
7. 构建、preview/404、browser launch、fixture/setup、locator、产品 assertion 分开报告；环境失败不冒充产品失败。

## Owned paths

- `tests/unified-e2e/` 下所有测试 spec 与 test-only helper，但不含 coding-2 owned 的 `tests/unified-e2e/live/helpers/loadLiveBindingFixture.ts`
- `tests/e2e/`

产品、配置、shared fixture/seed、Live helper owner、unit、OpenSpec/guide/workflow 均只读。需要 helper 修复时返回 coding-2 finding；需要产品修复时走 coding fix route。

## Ordered work

1. 在 fresh build candidate 上先 `--list`，记录实际收集数量；浏览器可用时运行小型 Sidebar/live smoke，校验 harness。
2. 迁移所有旧 TabBar locator 到 stable test-id，先保留行为断言，不因布局变化删概览/station/menu/reorder 测试。
3. 统一 beforeEach 和 Live helper 调用，移除 unversioned key、手写 archive import、records 回填与语言直写。
4. 对 60 个 unified spec 逐项应用保留门：跨层用户行为保留；重复计算、私有 DOM、已归档 bug 实现细节删除或由现有 unit 覆盖。
5. 扫描 18 个 legacy E2E，迁移 unified 缺失的 current browser boundary，删除源文件；不维持双套。
6. 先按 workspace/feature 串行 focused-run，修复 test-owned timing/locator/fixture 问题；产品 assertion failure 停止并返回最小复现。
7. 在同一 immutable candidate 上运行完整 canonical E2E，记录 retries/skips/trace 和环境。

## Deletion evidence

每个删除 spec/describe 块必须归类并给出等价覆盖或退役权威：

- `retired-dom-or-component`
- `duplicate-browser-flow`
- `unit-is-sufficient`
- `archived-bug-detail`

不得用失败数量、执行时长或 Sidebar 布局变化单独作为删除理由。

## Stable test-id gate

- 必须使用：`production-sidebar`、`sidebar-toggle`、固定入口 ID、`sidebar-sector[data-sector-id]`、`sidebar-sector-toggle[data-sector-id]`、`sidebar-station-list`、`sidebar-station[data-station-id]`、菜单动作 ID、删除确认 ID。
- 可以使用 role/可见文本断言验证真正呈现给用户的文案；交互目标不得仅靠文本/i18n 选择。
- 禁止添加 selector wrapper/facade 只为翻译旧 class；直接使用稳定锚点。

## Blocking self-validation

- Commands: `npm run build`; `npm exec playwright test -- --list tests/unified-e2e`; feature-scoped Sidebar/live/import/map/ship runs with bounded workers; `npm exec playwright test -- tests/unified-e2e --workers=1`; `rg -n "station-tab|overview-tab|StationTabBar|SectorStationTabBar" tests/unified-e2e`; `find tests/e2e -type f -name '*.spec.ts'`; `git diff --check`

完整 E2E 是 blocking acceptance。若当前容器 Chromium sandbox 不可用，返回 exact unavailable evidence，任务保持未接受并交给可启动浏览器的执行环境；不得改成通过或删除测试规避。

## Required evidence

- exact target/integrate candidate、fresh build hash/time、Playwright collection list 与 initial/final case counts。
- 每个导航/菜单/reorder test-id 到 case mapping。
- legacy migration/deletion ledger，含等价 unit/E2E 或退役需求。
- feature/full commands、exit、browser/version/environment、retries/skips/traces；404/launch/setup/assertion 分类。

## Observable completion

- 完整 canonical E2E 在同一 immutable fresh-build candidate 通过，无未解释 skip/flaky retry。
- `tests/e2e/` 无 spec，Playwright 默认收集仅包含 canonical E2E。
- 无旧 TabBar locator、手写 Live archive/records、旧 storage key 或只验证私有 DOM 的残留测试。
- Sidebar 的原导航语义和 blueprint reorder 均由稳定 test-id 驱动的浏览器断言证明。

## Stop conditions

- candidate/target 可见性改变、browser/tooling 长期不可用、需要修改 product/config/shared fixture/Live helper、或测试暴露真实产品回归。
- 删除没有当前权威/等价覆盖，或必须新增依赖/selector framework 才能继续。

## Handoff

返回 `Status`、exact candidate、fresh-build/collection evidence、migration/deletion ledger、test-id coverage map、commands/exits、environment、product findings 和 residual risks。不得 stage/commit/merge、修产品或宣布 initiative complete。
