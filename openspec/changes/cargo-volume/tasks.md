# Cargo Volume — Tasks

## Task 1: 类型重命名与新增字段

- [x] 文件: `src/types/production-workbench-contract.ts`
- [x] `LiveVolumeAllocationGroup` → `AllocationVolumeGroup`，新增 `hasArchiveStation: boolean`
- [x] `LiveVolumeAllocationItem` → `AllocationVolumeItem`，新增 `hasArchiveStation: boolean`
- [x] `LiveVolumeAllocationDetailSection` → `AllocationVolumeDetailSection`
- [x] `LiveVolumeAllocationDetailRow` → `AllocationVolumeDetailRow`
- [x] `LiveCargoOnlyItem` → `AllocationCargoOnlyItem`

## Task 2: 抽取共享 allocation 构建逻辑

- [x] 文件: `src/store/logic/buildAllocationVolumeGroups.ts`（新建）
- [x] 将 `buildAllocationDetailSections` 从 `useLiveProductionStore.ts` 移入，参数化 `hasArchiveData`
- [x] 导出 `buildAllocationVolumeGroups(params)`
- [x] 导出 `buildAllocationCargoOnlyItems(params)`
- [x] `buildAllocationDetailSections` 内部：drain/downstream/station-breakdown 的 `includeCurrentColumn` 改为 `hasArchiveData`
- [x] 当 `hasArchiveData === false` 时，drain/downstream 行的 `currentMinutes` 设为 `undefined`

## Task 3: Live Store 重构

- [x] 文件: `src/store/useLiveProductionStore.ts`
- [x] 重命名 `liveVolumeAllocationGroups` → `allocationVolumeGroups`
- [x] 重命名 `liveCargoOnlyItems` → `allocationCargoOnlyItems`
- [x] `allocationVolumeGroups` 调用 `buildAllocationVolumeGroups` 共享函数
- [x] `allocationCargoOnlyItems` 调用 `buildAllocationCargoOnlyItems` 共享函数
- [x] 每个 item 设 `hasArchiveStation = (archive !== null)`
- [x] 移除旧的 inline `buildAllocationDetailSections` 函数
- [x] 更新 `WareflowPresenterStore` 接口匹配的导出字段名

## Task 4: Blueprint Store 新增 allocation 数据

- [x] 文件: `src/store/useBlueprintProductionStore.ts`
- [x] 新增 `allocationVolumeGroups` computed
- [x] 新增 `allocationCargoOnlyItems` computed（返回 `[]`）
- [x] 导入并调用共享函数
- [x] 确保 store 的 return 对象包含这两个新属性

## Task 5: Presenter 接口重命名

- [x] 文件: `src/components/empire/presenters/useProductionWareflowPresenter.ts`
- [x] `WareflowPresenterStore.liveVolumeAllocationGroups` → `allocationVolumeGroups`
- [x] `WareflowPresenterStore.liveCargoOnlyItems` → `allocationCargoOnlyItems`
- [x] Props 字段对应重命名
- [x] `readMaybeComputed` fallback 中的字段名同步更新

## Task 6: StationWareFlowsDashboard props 重命名

- [x] 文件: `src/components/empire/StationWareFlowsDashboard.vue`
- [x] Props: `liveVolumeAllocationGroups` → `allocationVolumeGroups`
- [x] Props: `liveCargoOnlyItems` → `allocationCargoOnlyItems`
- [x] Import: `LiveStationAllocationView` → `StationAllocationView`
- [x] Import: `LiveCargoOnlyItem` → `AllocationCargoOnlyItem`
- [x] Import: `LiveVolumeAllocationGroup` → `AllocationVolumeGroup`
- [x] Computed: `hasLiveAllocationData` → `hasAllocationData`

## Task 7: 组件重命名与改造

### 7a: LiveStationAllocationView → StationAllocationView

- [x] 文件重命名: `LiveStationAllocationView.vue` → `StationAllocationView.vue`
- [x] 类型: `props.groups` → `AllocationVolumeGroup[]`
- [x] 类型: `props.cargoOnlyItems` → `AllocationCargoOnlyItem[]`
- [x] 新增 prop: `hasArchiveStation: boolean`
- [x] 组头条件渲染：`hasArchiveStation` → 显示 `Cur / Tar / Rec`；否则仅显示 `Rec`
- [x] 向 `StationAllocationRow` 传递 `hasArchiveStation`
- [x] 组件 name 等内部引用同步更新

### 7b: LiveStationAllocationRow → StationAllocationRow

- [x] 文件重命名: `LiveStationAllocationRow.vue` → `StationAllocationRow.vue`
- [x] 类型: `detailSections` → `AllocationVolumeDetailSection[]`
- [x] 新增 prop: `hasArchiveStation: boolean`
- [x] 进度条条件渲染: `v-if="hasArchiveStation"` 包裹 `bar-shell`
- [x] 无 archive 时 `bar-shell` 区域渲染空白占位 `bar-spacer`
- [x] 明细 header/row 统一固定 5 列 grid: `minmax(0, 1fr) 5.5rem 5.5rem 5.5rem 5.5rem`
- [x] 删除 4 种 `detail-head-*` CSS 变体类，统一为 `.detail-head`
- [x] 删除 4 种 `detail-row-*` CSS 变体类，统一为 `.detail-row`
- [x] 隐藏列渲染空 `<span>` 占位

### 7c: LiveStationCargoOnlyRow → StationCargoOnlyRow

- [x] 文件重命名: `LiveStationCargoOnlyRow.vue` → `StationCargoOnlyRow.vue`
- [x] 内部引用无变化（仅 update imports in parent）

## Task 8: 更新所有 import 引用

- [x] 全局搜索 `LiveStationAllocationView`，替换为 `StationAllocationView`
- [x] 全局搜索 `LiveStationAllocationRow`，替换为 `StationAllocationRow`
- [x] 全局搜索 `LiveStationCargoOnlyRow`，替换为 `StationCargoOnlyRow`
- [x] 全局搜索 `LiveVolumeAllocationGroup`，替换为 `AllocationVolumeGroup`
- [x] 全局搜索 `LiveVolumeAllocationItem`，替换为 `AllocationVolumeItem`
- [x] 全局搜索 `LiveVolumeAllocationDetailSection`，替换为 `AllocationVolumeDetailSection`
- [x] 全局搜索 `LiveVolumeAllocationDetailRow`，替换为 `AllocationVolumeDetailRow`
- [x] 全局搜索 `LiveCargoOnlyItem`，替换为 `AllocationCargoOnlyItem`
- [x] 全局搜索 `liveVolumeAllocationGroups`，替换为 `allocationVolumeGroups`
- [x] 全局搜索 `liveCargoOnlyItems`，替换为 `allocationCargoOnlyItems`
- [x] 检查无残留 `Live*` 引用

## Task 9: 验证

- [x] 执行 `npm run build`
- [x] 修复编译错误直至 build 通过
