# Status

review_complete

# Task

`task-coding-1` / `task-coding-1.1` 独立 coding review

# Reviewed commit

`5e8db7fe405088c54135cf3689e8b8c1b9081e26`，基于 `b62034868643b9d2a9af48ab0f634b067e80880d`。目标 commit 可精确解析，且其唯一 parent 正是该 Base；审查时 candidate worktree clean。

# Evidence

- 范围：`git diff --name-status b62034868643b9d2a9af48ab0f634b067e80880d 5e8db7fe405088c54135cf3689e8b8c1b9081e26` 仅列出 `src/components/empire/BlueprintProductionWorkbenchView.vue`、`src/components/empire/ProductionSidebar.vue`、`src/components/empire/presenters/useProductionSidebarPresenter.ts`、`src/store/useBlueprintProductionStore.ts`，全部位于六个 contract owned paths 内；`LiveProductionWorkbenchView.vue` 与 `useLiveProductionStore.ts` 未改。
- 调用链：`ProductionSidebar.handleStationReorder()` 把 `ProductionTabItem[]` 投影为 station IDs；`useProductionSidebarPresenter().emits.reorderStations()` 仅做 UI 到 store 的 `{ id }` 边界转换；`useBlueprintProductionStore.reorderStations()` 解析当前 `StationPlan`；唯一领域写入由 `useEmpireDataStore.reorderStationsInEmpire()` 完成。Vue 未为此新增直接 store 调用。
- 全 caller 检查：目标 commit 中 `reorderStationsInEmpire` 只有 `useBlueprintProductionStore.reorderStations()` 一个 product caller；其余命中为定义/导出。未发现第二份排序状态或旁路写入。
- 排序不变量：blueprint facade 先拒绝无 active empire、长度不等和未知 ID；领域 owner 再以 ID set 拒绝重复、缺失或混入成员，全部校验通过前不写入。成功时只替换 `empire.stations`，链路不写 `activeStationId`，故 active station ID 保持不变。
- Live 边界：live store 未暴露 `reorderStations`，live view 未接入 `reorder-stations`；presenter 仅在 `hasSectors === false` 且 store 具备该能力时启用 draggable，因此未引入 live 跨星区排序语义。
- UI 契约：已提供 `production-sidebar`、`sidebar-toggle`、`sidebar-sector` + `data-sector-id`、`sidebar-sector-toggle` + `data-sector-id`、`sidebar-station-list`、`sidebar-station` + `data-station-id`、`sidebar-add-station`、`sidebar-context-menu`、四个 `sidebar-menu-*`、`sidebar-delete-dialog`、`sidebar-delete-confirm`、`sidebar-delete-cancel`；既有 fixed IDs 继续由 `getFixedTestId()` 提供。实体名称、翻译和序号未编码进 test-id。
- 行为/可达性：overview/station/Transit 的 click 路由未被替换；sector collapse 仍由原 `toggleSectorCollapse()` 且使用原 `.stop` 隔离；context-menu 与 delete confirmation 状态机保持原函数，只把菜单动作改为原生 `<button>`。新增 station/sector `tabindex` 与 Enter/Space 处理，collapse/menu/dialog 控件为原生 button。
- 简洁性：复用已安装 `vuedraggable` 与既有 `reorderStationsInEmpire()`；没有新增依赖、导航 store、view-model/facade、selector adapter、旧 TabBar shim、兼容 fallback 或隐藏状态通道。新增 ID→领域对象转换位于 store ingress owner，且领域 owner 保留最终集合不变量校验。
- 旧实现审计：changed product paths 中没有 `station-tab`、`overview-tab`、`StationTabBar` 或 `SectorStationTabBar` 命中。
- `npm run build`：exit `0`；仅有 Browserslist 数据陈旧与 chunk size 警告。
- `npm run test:unit -- tests/unified-unit/production/reorder-stations.spec.ts tests/unified-unit/production/empire-store.spec.ts`：exit `1`；两份 suite 均在收集阶段因 `@/store/useEmpireStore` 无法解析而失败，结果为 `0 tests`。candidate 未修改 tests，且命令后六个 owned paths 相对 reviewed commit 无 drift。
- `git diff --check b62034868643b9d2a9af48ab0f634b067e80880d 5e8db7fe405088c54135cf3689e8b8c1b9081e26`：exit `0`。

# Findings

无阻断 finding。

# Verdict

passed

# Changes

未修改 product、tests、Git index 或分支状态；仅新增本 review artifact：`docs/plan/unified-test-repair/review-task-coding-1-1-1.md`。

# Caveats

- 接受一项 deferred downstream evidence：focused unit 的 exact failure signature 为两份 unchanged test-owned spec 引用已退役 `@/store/useEmpireStore`，在 collection 阶段 `0 tests`。它不能证明排序行为通过测试，但也不是该 immutable product candidate 的 defect；owner 为后续 test task，closure gate 是把测试迁移到当前公开 store/presenter seam 后，在包含本 candidate 的 target-visible revision 上重跑对应 focused/canonical unit tests。
- `task-coding-1.md` 内仍记载旧 `Evidence target/Base` `af17710661c1e5c8a23a01b83c00be641fa96ede`；本 review 按用户明确指定且已验证为目标 commit 唯一 parent 的 `b62034868643b9d2a9af48ab0f634b067e80880d` 执行。
