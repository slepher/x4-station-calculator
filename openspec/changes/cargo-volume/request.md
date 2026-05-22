# Cargo Volume — 通用 Allocation Volume 视图

## 目标

将 `live-cargo-volume` 中实现的 allocation volume 视图从仅支持 `live` 模式扩展为 `live` + `blueprint` 双模式通用。同时修复无 `archiveStation` 时的 UI 缺陷，并进行 `Live*` → 通用命名的全局重命名。

## 已确认方案（审核重点）

### 模式扩展

1. allocation volume 视图（原 `LiveStationAllocationView`）从仅 `visualMode === 'live'` 生效扩展为 `live` 和 `blueprint`（planning）均生效。
2. blueprint 模式下，`StationWareFlowsDashboard` 的 `isAllocationVolumeMode` 逻辑已满足条件（`workbenchMode === 'station'` → `useAllocationVolumeView = true`），只需 blueprint store 提供 `allocationVolumeGroups` 数据。
3. blueprint 无 `archiveStation`，因此 `currentCount = 0`，`targetCount` 退化为 `recommendedCount`，`hasArchiveStation = false`，`allocationCargoOnlyItems = []`。
4. `recommendedCount` 在两种模式下均来自 `DerivedProductionFlow.totalOccupiedCount`，数据链保持一致。

### 无 archiveStation 的 UI 行为

5. 进度条：当 `hasArchiveStation === false` 时（blueprint 全部；live 失去绑定时），`StationAllocationRow` 不渲染进度条（`<div class="bar-shell">`）。
6. 组头摘要：有 archive 时显示 `Cur / Tar / Rec m³`，无 archive 时仅显示 `Rec m³`。
7. 明细"当前"列：drain / downstream / station-breakdown 三个 section 的 `includeCurrentColumn` 从固定 `true` 改为条件 `hasArchiveData`。
8. 当 `hasArchiveData === false` 时，drain / downstream 行的 `currentMinutes` 设为 `undefined`，避免出现无意义的 `0m` 值。
9. `Fill From Current` section 在 `hasArchiveData === false` 时整段不显示（已有行为，维持不变）。

### 明细表格列固定位置

10. 当前明细表通过切换 4 种 `grid-template-columns` 变体来适配列可见性，导致"每小时量"列在位隐藏列腾出空间时右移。
11. 方案：统一使用固定 5 列 grid（`1fr | 5.5rem | 5.5rem | 5.5rem | 5.5rem`），隐藏列渲染为空 `<span>` 占位而非删除 column track，确保"每小时量"始终驻留在第 2 列位置。

### 全局重命名

12. `Live` 前缀已不再准确，进行全面重命名：
    - 类型：`LiveVolumeAllocationGroup` → `AllocationVolumeGroup`，`LiveVolumeAllocationItem` → `AllocationVolumeItem`，`LiveVolumeAllocationDetailSection` → `AllocationVolumeDetailSection`，`LiveVolumeAllocationDetailRow` → `AllocationVolumeDetailRow`，`LiveCargoOnlyItem` → `AllocationCargoOnlyItem`
    - 组件：`LiveStationAllocationView.vue` → `StationAllocationView.vue`，`LiveStationAllocationRow.vue` → `StationAllocationRow.vue`，`LiveStationCargoOnlyRow.vue` → `StationCargoOnlyRow.vue`
    - Store 属性：`liveVolumeAllocationGroups` → `allocationVolumeGroups`，`liveCargoOnlyItems` → `allocationCargoOnlyItems`
    - Presenter 接口字段同步更新
    - Dashboard props 同步更新

### 分层职责

13. Store：负责产出 `allocationVolumeGroups`（含 `hasArchiveStation` 标记）和 `allocationCargoOnlyItems`。
14. Presenter：透传数据，不做数据拼装或 fallback。
15. Vue：按 props 渲染，不做数据源回退。

## 边界

### In Scope

- allocation volume 视图在 blueprint（planning）volume 模式下激活
- 无 archiveStation 时隐藏进度条、组头仅显示 Rec、明细隐藏"当前"列
- 明细表格固定列位置（"每小时量"不右移）
- `Live*` → 通用命名的全局重命名
- 类型、组件、store、presenter、dashboard 同步重命名
- `npm run build` 无编译错误

### Out of Scope

- `quantity / economy / transport` 视图改造
- 新增 UI 功能或交互模式
- 测试编写与执行
- 保存格式迁移
- 新 i18n 文案

## 验收标准（DoD）

1. blueprint 模式下切换到 `volume` 视图时，显示 `StationAllocationView` 而非空态或旧 volume 视图。
2. blueprint 模式下各 ware 行不显示进度条，仅显示 ware 名称和 `recommendedCount`。
3. blueprint 模式下组头仅显示 `Rec xxx m³`。
4. blueprint 模式下 drain / downstream / station-breakdown 的明细表不显示"当前"列。
5. live 模式（有 archiveStation）下行为不变：进度条正常显示，组头显示 `Cur / Tar / Rec`，明细显示"当前"列。
6. 所有明细表中"每小时量"列位置固定，不因其他列显隐而左右偏移。
7. 所有 `Live*` 命名已被替换为通用命名，无残留。
8. `npm run build` 无编译错误。

## 未决项

无
