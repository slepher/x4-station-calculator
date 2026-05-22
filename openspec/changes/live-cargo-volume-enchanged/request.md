# Live Cargo Volume Enhanced

## 目标

将 `LiveStationAllocationView`（live cargo volume 的 allocation 视图）覆盖范围从"仅有 archive 的 station"扩展为"所有 station + transit-hub"，并在无 archive 时采用降级数据模式：`currentCount = 0`、`targetCount = recommendedCount`、取消 Fill From Current 卡片与 target 列。

### 变更动机

当前 `LiveStationAllocationView` 仅在 `workbenchMode === 'station' && archiveStation !== null` 时启用。而 transit-hub 和没有 archive 的 planning mode station 缺少进度条对比、展开时间明细等 allocation 能力。

## 已确认方案（审核重点）

### 1. 入口替换范围

1. `LiveStationAllocationView` 启用条件从"station + 有 archive"放宽为"station 或 transit-hub"。
2. transit-hub 侧由 `TransitHubCenterDashboard` 在 `live + volume` 时渲染 `LiveStationAllocationView`；planning + volume 继续使用现有 `TransitHubStorageView`。
3. station 侧由 `StationWareFlowsDashboard` 继续按 `useAllocationVolumeView` 判断，去掉 `visualMode` fallback。

### 2. 有无 archive 的两种数据模式

| 数据项 | 有 archive | 无 archive |
|--------|-----------|-----------|
| `currentCount` | `archiveStation.cargo` | `0` |
| `targetCount` | `archiveStation.targetCounts` (overrides.max) | `recommendedCount`（= `totalOccupiedCount`） |
| `recommendedCount` | `derivedProductionFlows.totalOccupiedCount` | 同 |
| `liveCargoOnlyItems` | 按 cargo ∉ productionFlows 判定 | `[]` |
| `detailSections` | 四卡片 + 全列（current/target/recommended） | 三卡片 + 去 target 列、去 Fill From Current |

### 3. 无 archive 时的 detail 行为

4. Fill From Current 卡片不产出。
5. Fill From Empty、Drain、Downstream 卡片中 `targetMinutes` 均为 `undefined`。
6. `LiveVolumeAllocationDetailSection` 新增 `includeTargetColumn` 字段；无 archive 时所有 section 设为 `false`。
7. `LiveStationAllocationRow` 按 `includeTargetColumn` 控制 target 列头和单元格的渲染与 grid 布局。

### 4. transit-hub 的去 action 化

8. `LiveStationAllocationRow` / `LiveStationAllocationView` 新增 `hideActions?: boolean` prop。
9. `hideActions = true` 时隐藏 `flow-action-rail` 和组头 spacer。
10. transit-hub 渲染时设置 `hideActions: true`；station 保持不变（`false` 默认）。

### 6. transit-hub Station Breakdown

11. transit-hub 的 detail 展开区新增 **Station Breakdown** section（默认折叠）。
12. 数据来源：`contributions` 中 `class === 'station'` 的条目。
13. 生产站行展示 `rate / target fill / recommended fill`（统一从空库存开始算填满时间，不显示 current 列）。
14. 消费站行展示 `rate / current drain / target drain / recommended drain`（与 Drain 卡片列一致）。
15. 列可见性：有 archive 时保留 target 列；无 archive 时去 target 列。与同 ware 的其他 section 保持一致。

### 5. 分层职责

11. Store：负责 `liveVolumeAllocationGroups` / `liveCargoOnlyItems` 在 station 和 transit 两模式下的数据组装。
12. Presenter：继续透传，合约不变。
13. Vue：`TransitHubCenterDashboard` 新增 allocation 视图分发；`LiveStationAllocationRow` / `LiveStationAllocationView` 新增 `hideActions` + `includeTargetColumn` 支持。

## 边界

### In Scope

- `useAllocationVolumeView` 放宽到 station + transit-hub
- station 无 archive 时 allocation 视图降级数据模式
- transit-hub `live + volume` 接入 `LiveStationAllocationView`
- `hideActions` prop 支持 transit-hub 隐藏 fav/lock
- `includeTargetColumn` 支持无 archive 时隐藏 target 列
- Fill From Current 按 `hasArchiveData` 条件产出
- `liveCargoOnlyItems` 无 archive 时返回空数组
- transit-hub detail 新增 Station Breakdown（per-station 时间维度，默认折叠，生产方 2 列 / 消费方 3 列）

### Out of Scope

- planning mode 旧 volume 视图结构改造
- quantity / economy / transport 视图
- 新增 presenter / view-model 层
- transit-hub 非 volume 面板的布局变化
- 测试编写与执行

## 验收标准（DoD）

1. station + 有 archive：allocation 视图行为与 live-cargo-volume 一致（四卡片 + 全列 + 进度条）。
2. station + 无 archive：progress bar 显示 `0 / recommendedCount`；detail 只有 Fill From Empty / Drain / Downstream 三卡片且无 target 列。
3. transit-hub + 有 archive：显示 progress bar（cargo / overrides.max / recommended），无 fav/lock 按钮。
4. transit-hub + 无 archive：progress bar 显示 `0 / recommendedCount`，三卡片去 target 列，无 fav/lock 按钮。
5. transit-hub planning + volume 继续渲染旧 `TransitHubStorageView`。
6. transit-hub allocation view 的 detail 展开区包含 Station Breakdown section，按站展示生产/消费时间维度，默认折叠。
7. `npm run build` 无编译错误。

## 未决项

无
