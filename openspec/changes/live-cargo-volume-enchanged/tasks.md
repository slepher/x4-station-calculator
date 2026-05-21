# Live Cargo Volume Enhanced - Tasks

## Task 1: 类型扩展

- [x] 文件：`src/types/production-workbench-contract.ts`
- [x] `LiveVolumeAllocationDetailSection` 新增 `includeTargetColumn: boolean`

## Task 2: Store — useAllocationVolumeView 放宽

- [x] 文件：`src/store/useLiveProductionStore.ts`
- [x] `useAllocationVolumeView` 从 `station + archive` 改为 `station 或 transit`

## Task 3: Store — buildAllocationDetailSection 扩展

- [x] 文件：`src/store/useLiveProductionStore.ts`
- [x] 新增 `includeTargetColumn: boolean` 参数
- [x] 写入 `LiveVolumeAllocationDetailSection.includeTargetColumn`

## Task 4: Store — buildAllocationDetailSections 支持 hasArchiveData

- [x] 文件：`src/store/useLiveProductionStore.ts`
- [x] 新增 `hasArchiveData: boolean` 参数
- [x] 无 archive 时：跳过 Fill From Current section
- [x] 无 archive 时：所有 section `includeTargetColumn = false`，所有行 `targetMinutes = undefined`

## Task 5: Store — liveVolumeAllocationGroups 扩展

- [x] 文件：`src/store/useLiveProductionStore.ts`
- [x] transit 模式下使用 `activeTransitState.derivedProductionFlows`（stationState 已自动切换）
- [x] `targetCount`：有 archive → `targetMap.get()`；无 archive → `recommendedCount`
- [x] `buildAllocationDetailSections` 传入 `hasArchiveData`

## Task 6: Store — liveCargoOnlyItems 扩展

- [x] 文件：`src/store/useLiveProductionStore.ts`
- [x] 无 archive 时直接返回 `[]`（现有 `!archive` 守卫已处理，无需改动）

## Task 7: LiveStationAllocationRow — hideActions + includeTargetColumn

- [x] 文件：`src/components/empire/LiveStationAllocationRow.vue`
- [x] 新增 `hideActions?: boolean` prop
- [x] `v-if="!hideActions"` 包裹 `flow-action-rail`
- [x] 按 `section.includeTargetColumn` 控制 target 列头和单元格渲染
- [x] CSS grid 按 `includeCurrentColumn × includeTargetColumn` 四种组合计算

## Task 8: LiveStationAllocationView — hideActions 透传

- [x] 文件：`src/components/empire/LiveStationAllocationView.vue`
- [x] 新增 `hideActions?: boolean` prop
- [x] 透传 `hideActions` 给 `LiveStationAllocationRow`
- [x] 组头 spacer 按 `hideActions` 条件渲染

## Task 9: TransitHubCenterDashboard — 接入 allocation 视图

- [x] 文件：`src/components/empire/transit-hub/TransitHubCenterDashboard.vue`
- [x] 新增 props：`useAllocationVolumeView`、`liveVolumeAllocationGroups`、`liveCargoOnlyItems`
- [x] `live + volume` → 渲染 `LiveStationAllocationView`（`hideActions: true`）
- [x] `planning + volume` → 继续渲染旧 `TransitHubStorageView`

## Task 10: 父组件透传 + Presenter 更新

- [x] 文件：`src/components/empire/LiveProductionWorkbenchView.vue`
- [x] 从 presenter 取 `liveVolumeAllocationGroups` / `liveCargoOnlyItems` / `useAllocationVolumeView` 并透传
- [x] 文件：`src/components/empire/presenters/useProductionWareflowPresenter.ts`
- [x] `useAllocationVolumeView` 从 `station + archive` 改为 `station 或 transit`

## Task 11: 构建验证

- [x] 执行 `npm run build`（通过）
