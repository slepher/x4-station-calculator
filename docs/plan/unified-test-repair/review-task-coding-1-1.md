# Status

review_complete

# Task

`task-coding-1` parent review（覆盖 `task-coding-1.1` 产品 checkpoint 与 `task-coding-1.2` 文档 subtask）

# Reviewed commit

`7c622141914ae0e532833a98d0949d7a6decf475`，Base 为 `b62034868643b9d2a9af48ab0f634b067e80880d`。

该 immutable candidate 是 merge commit，历史明确包含：产品 checkpoint `5e8db7fe405088c54135cf3689e8b8c1b9081e26`、accepted plan/status sync `9c90a7ae` / `57465b5e` / `5f194889`，以及当前 docs subtask tree。

# Evidence

- Immutable/scope：`7c622141` 可解析为上述完整 SHA；coding worktree 在审查和验证后均 clean。`5e8db7fe..7c622141` 的 `src/` diff 为空，证明 parent candidate 保留已通过 subtask review 的产品 tree。产品 checkpoint 只改 4 个 product owned paths；`5f194889..7c622141` 只改 8 个 docs owned paths：两份 OpenSpec、`guide/empire/tabbar/`、`guide/functions.md`、两个 guide index 与 `sitemap.md`。`b6203486..7c622141` 另含明确要求纳入 candidate 的 dispatcher-owned accepted workflow artifacts；未混入 tests、fixture、配置或其他 product paths。
- Stable UI contract：`ProductionSidebar.vue` 提供 `production-sidebar`、`sidebar-toggle`、固定入口 IDs、`sidebar-sector` + `data-sector-id`、`sidebar-sector-toggle` + `data-sector-id`、`sidebar-station-list`、`sidebar-station` + `data-station-id`、`sidebar-add-station`、全部 context-menu action IDs 与 delete dialog/confirm/cancel IDs；实体名称、翻译和数组序号未进入 test-id。
- 现有行为与键盘：overview/station/Transit 继续走原 click 路由；sector collapse 仍由 `toggleSectorCollapse()` 与 `.stop` 隔离；context-menu/delete 状态机未被替换。新增 station/sector `tabindex`、Enter/Space handler；collapse、菜单动作、删除确认和 Sidebar toggle 使用原生 `<button>`。
- Reorder 主链：`ProductionSidebar.handleStationReorder()` -> `useProductionSidebarPresenter().emits.reorderStations()` -> `useBlueprintProductionStore.reorderStations()` -> `useEmpireDataStore.reorderStationsInEmpire()`。目标 tree 中 `reorderStationsInEmpire()` 只有该 1 个 product caller；Vue 未新增直接 store 调用。
- Invariant owner：blueprint facade 在写入前拒绝无 active empire、长度不等和未知 ID；`reorderStationsInEmpire()` 再以集合大小和成员完整性拒绝重复、缺失或混入 ID，校验后才替换 `empire.stations`。该链不写 `activeStationId`，故成功/失败均保持 active station ID。
- Live 边界：`useLiveProductionStore.ts` 不暴露 `reorderStations`，`LiveProductionWorkbenchView.vue` 不监听 `reorder-stations`；presenter 仅在 `hasSectors === false` 且 store 提供能力时启用 draggable，没有新增 live 跨星区排序语义。
- Simplicity/compatibility：复用已安装 `vuedraggable` 与现有领域 owner；没有新增导航 store、view-model/facade、selector adapter、旧 TabBar shim、第二份排序状态或兼容 fallback。ID -> `StationPlan` 的唯一转换位于 blueprint store ingress，最终集合不变量仍由领域 owner 保证。
- 文档一致性：`openspec/specs/station-tabs/spec.md` 定义 Sidebar 当前行为、稳定锚点、blueprint/live 边界与唯一 reorder owner；`openspec/changes/tab-2-sidebar/specs/sidebar-navigation/spec.md` 只保留迁移后的现行 delta；guide anchor/behavior/functions/index 与实际 component/presenter/store 符号一致；`sitemap.md` 明确 `tests/unified-unit/`、`tests/unified-e2e/` 为 current，`tests/unit/`、`tests/e2e/` 为 legacy migration source。
- 旧名称审计：`rg -n "overview-tab|station-tab|StationTabBar|SectorStationTabBar" guide/empire openspec/specs/station-tabs sitemap.md` exit `0`，恰有 2 条命中，分别位于 `openspec/specs/station-tabs/spec.md:94` 与 `guide/empire/tabbar/anchor.md:35`，均明确标注 migration-only，当前 anchor/behavior 不依赖旧名称。
- Product build：`npm run build` exit `0`；只有 Browserslist 数据陈旧和 chunk size warning。
- Focused unit：`npm run test:unit -- tests/unified-unit/production/reorder-stations.spec.ts tests/unified-unit/production/empire-store.spec.ts` exit `1`；两份 unchanged test-owned suite 均因 `@/store/useEmpireStore` 无法解析而在 collection 阶段失败，`0 tests`。候选未改 tests，运行后 parent owned paths 无 drift。
- Focused docs：`npx openspec validate station-tabs --type spec --strict` exit `0`；`npx openspec validate tab-2-sidebar --type change --strict` exit `0`。
- Full OpenSpec inventory：`npx openspec validate --all` exit `1`，Totals 为 `93 passed, 55 failed (148 items)`；本次改动的 `spec/station-tabs` 与 `change/tab-2-sidebar` 均在通过项，55 个失败均属于其他 spec/change。
- Whitespace：`git diff --check b62034868643b9d2a9af48ab0f634b067e80880d 7c622141914ae0e532833a98d0949d7a6decf475` exit `0`。

# Findings

无阻断 finding。

# Verdict

passed

# Changes

未修改 product、tests、Git index、commit 或分支；仅新增 review artifact：`/home/slepher/project/x4-station-calculator/docs/plan/unified-test-repair/review-task-coding-1-1.md`。

# Caveats

- 接受 deferred test-owned evidence：focused unit 当前没有执行任何断言，exact signature 是两份 unchanged spec 对已退役 `@/store/useEmpireStore` 的 collection drift。它不构成该 immutable product candidate 的 defect，也不能算产品测试通过；correction owner 为 `task-test-1`，allowed seam 是当前公开 blueprint store/presenter 与 test-owned paths，须保持完整排列校验、active station ID 和唯一领域 owner 不变量；focused tests 能收集并执行且在包含 `7c622141` 的 target-visible integrate revision 上 exit `0` 时闭合。
- Parent review 不替代 deferred downstream E2E；Sidebar 导航、菜单、collapse 与真实拖拽黑盒链由 `task-test-2` 在 target-visible integrate candidate 上闭合。
- `npx openspec validate --all` 的 55 个其他规范失败没有被记为通过；仅依据两份 changed focused specs 的 exit `0` 判定本 subtask 文档有效。这些 unrelated failures 不要求 `task-coding-1` 越界修改。
- 累计 Base diff 中的 `docs/plan/unified-test-repair/*` 不属于 parent implementation owned paths，但其 commit provenance 是 dispatcher-owned accepted plan/status sync，且本次 assignment 明确要求 candidate tree 包含它们；product/docs worker 自身 delta 均限制在修订后的 parent owned paths。
