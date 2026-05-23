# terraforming-shell Tasks

## 1. 类型定义扩展

- [x] 1.1 `src/types/production-ui.ts`: `ProductionTabItem.type` 加 `'terraforming'`
- [x] 1.2 `src/types/production-workbench-contract.ts`: `ProductionSessionState.workbenchMode` 加 `'terraforming'`

## 2. Store 扩展 (`useLiveProductionStore`)

- [x] 2.1 新增 `terraformingSelectedClusterId` ref
- [x] 2.2 新增 `terraformingCompletedProjects` ref
- [x] 2.3 新增 `terraformingCurrentStats` computed (从 selectedCluster 的 initialStats + completedProjects 的 effects 计算)
- [x] 2.4 新增 `terraformingData` computed (惰性加载 terraforming.json, 基于 gameDataStore.folderName)
- [x] 2.5 HQ station context 由 presenter 从 store 数据组装 (不在 store 中单独暴露)
- [x] 2.6 新增 `selectTerraforming()` action
- [x] 2.7 新增 `selectTerraformingCluster(clusterId)` action
- [x] 2.8 `session` computed 中 `workbenchMode` 支持 `'terraforming'`

## 3. Tabbar Presenter 修改

- [x] 3.1 `useProductionTabbarPresenter.ts`: tabs computed 在 overview 后插入 `{ id: 'terraforming', type: 'terraforming', name: '地球化' }`
- [x] 3.2 `selectTerraforming` emit → 调用 store.selectTerraforming()

## 4. Tab Bar 组件修改

- [x] 4.1 `SectorStationTabBar.vue`: `getTabIcon` 支持 `type === 'terraforming'` → 返回 `playerhqIconUrl`
- [x] 4.2 `SectorStationTabBar.vue`: `getTabIconClass` 支持 `type === 'terraforming'` → `'icon-green'`
- [x] 4.3 `SectorStationTabBar.vue`: tab click 处理 → `type === 'terraforming'` 时 emit selectTerraforming
- [x] 4.4 `terraforming-tab` class 和 active 状态

## 5. Presenter 新增 (`useTerraformingPresenter`)

- [x] 5.1 创建 `src/components/empire/presenters/useTerraformingPresenter.ts`
- [x] 5.2 实现 `toolbarProps` (HQ station 只读 context 数据)
- [x] 5.3 实现 `sectorPanelProps` (clusters 列表, selectedClusterId)
- [x] 5.4 实现 `taskListProps` (调用 `resolveAvailableTasks`, 按 group 分组)
- [x] 5.5 实现 `resourcePanelProps` (汇总所有项目的 resources/deliveries)
- [x] 5.6 遵循 `store -> presenter -> vue` 三层，不在 presenter 暴露 store ref

## 6. TerraformingToolbar 组件

- [x] 6.1 创建 `src/components/empire/context_toolbar/TerraformingToolbar.vue`
- [x] 6.2 只读显示：station name, station code, sector name (+ XYZ popover), sector resources, sunlight, berth throughput
- [x] 6.3 复用 `LiveStationToolbar` 的 sector popover 和 resources 显示逻辑
- [x] 6.4 不包含 mode toggle / settings / import / 编辑功能

## 7. 主内容区组件 (占位, 内容不在本 change 范围)

- [x] 7.1 左列：星区列表占位 (内联渲染 clusters 列表 + 选择)
- [x] 7.2 中列：任务列表占位 ("选择星区查看任务列表")
- [x] 7.3 右列：资源消耗占位 ("选择星区查看资源消耗")

## 8. LiveProductionWorkbenchView 集成

- [x] 8.1 引入 `TerraformingToolbar`
- [x] 8.2 引入 `useTerraformingPresenter`
- [x] 8.3 新增 `useTerraformingPresenter` 调用
- [x] 8.4 新增 `<div v-if="workbenchMode === 'terraforming'">` 分支 (toolbar + 3列 grid)
- [x] 8.5 与现有 overview/transit/station 分支并列，不改变已有分支

## 9. 地球化 tab 切换行为

- [x] 9.1 `selectTerraforming()` → `isTerraformingMode = true`, `activeStationId = null`
- [x] 9.2 `selectStation()` / `selectTransitSector()` 自动清除 `isTerraformingMode`
- [x] 9.3 `TerraformingToolbar` 支持 `hasHqStation` prop, 无 HQ 时显示占位

## 10. 构建验证

- [x] 10.1 `npm run build` 无编译错误
