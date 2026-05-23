# terraforming-shell Design

## 架构

```
src/
├── components/empire/
│   ├── LiveProductionWorkbenchView.vue          # 修改: v-if/v-else-if/v-else 互斥链
│   ├── SectorStationTabBar.vue                 # 修改: terraforming tab 图标/点击
│   ├── context_toolbar/
│   │   └── TerraformingToolbar.vue              # 新增: 只读 HQ toolbar
│   └── presenters/
│       ├── useProductionTabbarPresenter.ts      # 修改: 条件插入 terraforming tab
│       ├── useProductionToolbarPresenter.ts     # 修改: workbenchMode 类型 + 'terraforming'
│       ├── useProductionDashboardPresenter.ts   # 修改: 同上
│       ├── useProductionPlanningPresenter.ts    # 修改: 同上
│       ├── useProductionWareflowPresenter.ts    # 修改: 同上
│       └── useTerraformingPresenter.ts          # 新增: 地球化 presenter
├── store/
│   ├── useActiveViewStore.ts                   # 修改: 新增 activeBindingWorkbench
│   ├── useLiveProductionStore.ts               # 修改: terraforming 状态/actions/computeds
│   ├── useGameDataStore.ts                     # 修改: 暴露 terraformingData
│   └── logic/
│       ├── useGameData.ts                      # 修改: GameDataFiles + terraforming 字段
│       └── terraformingTaskResolver.ts          # 修改: 移除 loadTerraformingData (glob)
└── types/
    ├── production-ui.ts                         # 修改: type 加 'terraforming'
    └── production-workbench-contract.ts         # 修改: workbenchMode 加 'terraforming'
```

## 调用链

```
LiveProductionWorkbenchView
  ├── SectorStationTabBar
  │     └── useProductionTabbarPresenter
  │           └── store.selectTerraforming?() → isTerraformingMode = true
  │
  ├── workbenchMode === 'terraforming' 时:
  │   ├── TerraformingToolbar
  │   │     └── useTerraformingPresenter → toolbar.props (HQ archive data)
  │   └── 3 列占位面板
  │
  ├── workbenchMode === 'overview' || 'transit' 时: 现有逻辑
  └── workbenchMode === 'station' 时 (v-else): 现有逻辑
```

## 数据流

```
terraforming.json
    ↓ (useGameData.ts 统一 import.meta.glob 管线)
useGameDataStore.terraformingData
    ↓
useLiveProductionStore
    ├── terraformingData (computed, 直读 gameData.terraformingData)
    ├── terraformingSelectedClusterId (ref)
    ├── terraformingSelectedCluster (computed)
    ├── terraformingCurrentStats (computed)
    ├── terraformingCompletedProjects (ref)
    ├── terraformingHqStationCode (computed, tabSemanticsById → playerhq tag)
    ├── terraformingHqStationName (computed, orderedStationsBySector[].name)
    └── terraformingHqArchiveStation (computed, getArchiveStationDataByCode)
    ↓
useTerraformingPresenter
    ├── toolbar.props (从 terraformingHqArchiveStation 直接取)
    │     ├── hqStationName ← terraformingHqStationName
    │     ├── stationCode ← archive.code
    │     ├── sectorName ← archive.sector.name
    │     ├── sectorNameId ← archive.sector.nameId
    │     ├── position ← archive.position
    │     ├── sectorResources ← archive.sector.resources
    │     ├── sectorSunlight ← archive.sector.sunlight
    │     └── singleBerthThroughput ← 930000
    ├── sectorPanel.props (clusters list + selectedClusterId)
    ├── taskList.props (resolveAvailableTasks)
    └── resourcePanel.props (projectResources/totalResources/deliveries)
    ↓
Vue 组件 (TerraformingToolbar + 占位面板)
```

## Tab 持久化

- `useActiveViewStore` 新增 `activeBindingWorkbench` 字段 (类型: `'overview' | 'station' | 'transit' | 'terraforming'`)
- 存储于 localStorage key `x4_station_active_view`
- `useLiveProductionStore.isTerraformingMode`：writable computed，读写映射到 `activeViewStore.activeBindingWorkbench`
- `selectTerraforming()` → `isTerraformingMode = true` → `activeBindingWorkbench = 'terraforming'`
- `selectStation()`/`selectTransitSector()` → `isTerraformingMode = false`

## Tab 条件显示

- `TabbarPresenterStore.selectTerraforming` 为 optional 方法
- `useProductionTabbarPresenter` 仅在 `store.selectTerraforming` 存在时插入地球化 tab
- `useLiveProductionStore` 有该方法（live-production），`useBlueprintProductionStore` 无该方法（蓝图产能）
- 蓝图产能界面因不满足条件而不显示地球化 tab

## 模块职责

### useTerraformingPresenter

- **输入**：store 的 terraforming 数据与状态
- **输出**：
  - `toolbar`：HQ station 只读上下文（名称优先 binding name，回退 code）
  - `sectorPanel`：clusters 列表 + selectedClusterId
  - `taskList`：`resolveAvailableTasks()` 结果
  - `resourcePanel`：项目资源/交付聚合
- HQ 数据不手动从 `playerStationRecords` 拼，走 `getArchiveStationDataByCode` 统一管道

### TerraformingToolbar

- 只读工具栏，复用 `LiveStationToolbar` 的 sector popover/resource 样式
- props: hqStationName, stationCode, sectorName, sectorNameId, position, sectorResources, sectorSunlight, singleBerthThroughput, hasHqStation
- 无 mode toggle / settings / import / 编辑

### 主内容区 (占位)

- 内联于 `LiveProductionWorkbenchView.vue`，使用 `.panel-card`/`.panel-header`/`.panel-content` 样式
- 左列：星区列表（clusters 遍历 + 点击 selectCluster）
- 中列/右列：占位文本
