# request.md

## 目标

将星区功能从 BlueprintProduction 彻底剥离，使 BlueprintProduction 仅管理纯站点列表，LiveProduction 保留完整星区功能。

## 已确认方案（审核重点）

### 1. 组件重构

| 原组件 | 操作 | 新组件 | 功能 |
|--------|------|--------|------|
| `StationTabBar.vue` | 重命名 | `SectorStationTabBar.vue` | Overview、Transit、星区分组展开、Station 标签、右键菜单 |
| `StationTabBar.vue` | 新建 | `StationTabBar.vue`（简化版） | 仅 Station 标签列表、右键菜单、添加按钮（无星区） |
| `useStationTabBarModel.ts` | 重命名 | `useSectorStationTabBarModel.ts` | 星区分组计算、Transit 逻辑 |
| `useStationTabBarModel.ts` | 新建 | `useStationTabBarModel.ts`（简化版） | 仅站点列表计算（无星区） |

### 2. 组件分配

- `LiveProductionWorkbenchView.vue` → 使用 `SectorStationTabBar` + `useSectorStationTabBarModel`
- `BlueprintProductionWorkbenchView.vue` → 使用 `StationTabBar` + `useStationTabBarModel`

### 3. Store 剥离

**BlueprintProductionStore 移除的星区相关：**

- 移除属性：`sectors`、`sectorLinks`、`sectorInternalDataMap`、`sectorLinkCalcMap`、`activeTransitSectorId`
- 移除方法：`selectTransitSector`、`selectOverview`、`getLinkedSectors`、`getSupplyPlanningInput`、`getSectorInternalData`、`getSectorLinkCalc`、`getTransitHubViewModel`
- 移除计算属性：`orderedStationsBySector` → 改为 `orderedStations`（无星区分组）
- 移除视图数据：`empireGroupedFlows`（星区聚合视图）
- 调整 `isEmptyForSave`：移除对 `hasSectors` 的检查

**LiveProductionStore 保留全部星区功能：**

- 星区来自存档数据的 `groups`，是 Binding 的核心数据
- 保留 `sectors`、`selectTransitSector`、`renameBindingSector`、Transit Hub、Overview 视图等

### 4. 视图调整

**BlueprintProductionWorkbenchView.vue：**

- 移除 Transit Hub 视图（`TransitHubBuildPanel`、`TransitHubCenterDashboard`、`TransitHubMaterialsPanel`）
- 移除 Overview 视图（`EmpireWareFlowsDashboard`）
- 移除 `activeTransitSectorId` 相关逻辑
- 简化为：StationTabBar + Station 编辑视图（三栏布局不变）

### 5. 类型定义

- `ProductionTabItem` 类型保留 `sectorId` 字段（LiveProduction 使用）
- 新建简化类型或复用现有类型，确保 BlueprintProduction 的 TabBar 不依赖星区

## 边界

### In Scope

- 组件重命名与新建
- Store 属性/方法剥离
- BlueprintProductionWorkbenchView 视图简化
- 相关 import 路径更新

### Out of Scope

- LiveProduction 的星区功能（保留不动）
- 测试代码修改（后续 `/x4:test` 处理）
- 其他 Empire 管理功能

## 验收标准（DoD）

1. `BlueprintProductionWorkbenchView` 无星区相关代码
2. `useBlueprintProductionStore` 无 `sectors`/`sectorLinks`/`activeTransitSectorId` 等星区属性
3. `LiveProductionWorkbenchView` 正常显示星区 Transit Hub 和 Overview
4. `npm run build` 成功无编译错误
5. 现有 LiveProduction 相关 E2E 测试不受影响

## 未决项

无