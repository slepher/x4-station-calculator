# tasks.md

## Implementation Tasks

### Phase 1: 组件重命名与新建

#### T1.1 重命名 StationTabBar → SectorStationTabBar

- [x] 文件：`src/components/empire/StationTabBar.vue` → `SectorStationTabBar.vue`
- [x] 更新组件内部无变化（仅文件名）
- [x] 更新 import 路径

#### T1.2 重命名 useStationTabBarModel → useSectorStationTabBarModel

- [x] 文件：`src/components/empire/composables/useStationTabBarModel.ts` → `useSectorStationTabBarModel.ts`
- [x] 更新函数名：`useStationTabBarModel` → `useSectorStationTabBarModel`
- [x] 更新 export 名称

#### T1.3 新建简化版 StationTabBar.vue

- [x] 创建 `src/components/empire/StationTabBar.vue`
- [x] 功能：仅 Station 标签列表、右键菜单、添加按钮
- [x] 移除：Overview tab、Transit tab、星区分组展开逻辑
- [x] Props 简化：移除 `expandedSectorId`，移除 `tabs` 中的 `sectorId` 处理

#### T1.4 新建简化版 useStationTabBarModel.ts

- [x] 创建 `src/components/empire/composables/useStationTabBarModel.ts`
- [x] 功能：仅计算站点列表（`orderedStations` → tabs）
- [x] 移除：星区分组计算、Transit 标签、Overview 标签

### Phase 2: Store 剥离

#### T2.1 移除 BlueprintProductionStore 星区属性

- [x] 移除以下属性和 computed：
  - `sectors`
  - `sectorLinks`
  - `sectorInternalDataMap`
  - `sectorLinkCalcMap`
  - `activeTransitSectorId`
  - `empireGroupedFlows`
  - `orderedStationsBySector` → 改为 `orderedStations`

#### T2.2 移除 BlueprintProductionStore 星区方法

- [x] 移除以下方法：
  - `selectTransitSector`
  - `selectOverview`
  - `getLinkedSectors`
  - `getSupplyPlanningInput`
  - `getSectorInternalData`
  - `getSectorLinkCalc`
  - `getTransitHubViewModel`

#### T2.3 调整 BlueprintProductionStore 其他逻辑

- [x] `isEmptyForSave`：移除 `hasSectors` 检查，仅检查 `hasStations`
- [x] `loadData`：移除 `sectorLinks` normalize 逻辑
- [x] `loadEmpire`：移除 `sectorLinks` validate 逻辑

### Phase 3: 视图适配

#### T3.1 更新 LiveProductionWorkbenchView import

- [x] import `StationTabBar` → `SectorStationTabBar`
- [x] import `useStationTabBarModel` → `useSectorStationTabBarModel`
- [x] 其他逻辑不变

#### T3.2 简化 BlueprintProductionWorkbenchView

- [x] import 使用新建的 `StationTabBar` 和 `useStationTabBarModel`
- [x] 移除 Transit Hub 视图模板
- [x] 移除 Overview 视图模板
- [x] 移除 `activeTransitSectorId` computed
- [x] 移除 `isOverview` computed
- [x] 移除 `transitHubModelRaw`、`transitHubWorkbenchModel`
- [x] 移除 `handleSelectTransit`、`handleSelectOverview`
- [x] 移除 Transit Hub 相关 handlers

#### T3.3 更新其他文件的 import

- [x] `ProductionWorkbenchView.vue` → 使用 `SectorStationTabBar`

### Phase 4: 构建验证

#### T4.1 运行 build

- [x] `npm run build` 成功无编译错误