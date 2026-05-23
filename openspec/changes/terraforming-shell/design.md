# terraforming-shell Design

## 架构

```
src/
├── components/empire/
│   ├── LiveProductionWorkbenchView.vue    # 修改: 新增 terraforming 模式分支
│   ├── SectorStationTabBar.vue            # 修改: 兼容 terraforming tab 类型
│   ├── context_toolbar/
│   │   └── TerraformingToolbar.vue        # 新增: 只读 HQ station 工具栏
│   └── terraforming/                      # 新增目录
│       ├── TerraformingSectorPanel.vue     # 新增: 星区选择面板 (左列)
│       ├── TerraformingTaskList.vue        # 新增: 任务列表面板 (中列)
│       └── TerraformingResourcePanel.vue   # 新增: 资源消耗面板 (右列)
├── components/empire/presenters/
│   ├── useProductionTabbarPresenter.ts    # 修改: 在 overview 后插入 terraforming tab
│   ├── useProductionToolbarPresenter.ts   # 修改: 新增 terraforming toolbar 分支
│   └── useTerraformingPresenter.ts       # 新增: 地球化 presenter
├── store/
│   ├── useLiveProductionStore.ts          # 修改: 新增 terraforming 状态/actions
│   └── logic/
│       └── terraformingTaskResolver.ts    # 已有: 核心推理引擎 (复用)
└── types/
    ├── production-ui.ts                   # 修改: type 加 'terraforming'
    └── production-workbench-contract.ts   # 修改: workbenchMode 加 'terraforming'
```

## 调用链

```
LiveProductionWorkbenchView
  ├── workbenchMode === 'terraforming' 时:
  │   ├── TerraformingToolbar
  │   │   └── useTerraformingPresenter → toolbar props
  │   ├── TerraformingSectorPanel (Left: col-span-3)
  │   │   └── useTerraformingPresenter → sector panel props
  │   ├── TerraformingTaskList (Middle: col-span-5)
  │   │   └── useTerraformingPresenter → task list props
  │   └── TerraformingResourcePanel (Right: col-span-4)
  │       └── useTerraformingPresenter → resource panel props
  └── 已有: overview / transit / station 分支 (不改变)
```

## 模块职责

### useTerraformingPresenter.ts

- 输入: store 的 `terraformingData`, `selectedClusterId`, `terraformingState`
- 输出:
  - **toolbarProps**: HQ station 的只读 context 数据
  - **sectorPanelProps**: clusters 列表 (id, name, initialStats 摘要)
  - **taskListProps**: `resolveAvailableTasks()` 结果，按 group 分组
  - **resourcePanelProps**: 资源消耗汇总
- 调用顺序：
  1. 加载 `terraformingData`（惰性加载，首次访问时）
  2. 当 `selectedClusterId` 变化时，计算 task list 和 resource panel
- HQ 查找逻辑：遍历 `orderedStationsBySector`，定位 `tabSemanticsById[id].tag === 'playerhq'` 的 station

### useLiveProductionStore.ts 新增

- 状态：
  - `terraformingSelectedClusterId: Ref<string | null>` — 当前选中的星区
  - `terraformingCompletedProjects: Ref<Set<string>>` — 已完成项目（占位，后续 change 实现持久化）
  - `terraformingCurrentStats: ComputedRef<Record<string, number>>` — 当前 stats
- Actions:
  - `selectTerraforming()` — 设 `workbenchMode = 'terraforming'`
  - `selectTerraformingCluster(clusterId: string)` — 选星区
- Computed:
  - `terraformingHqContext` — HQ station 的基础信息 (name, code, sectorId, position, resources, sunlight)
  - `terraformingData` — 根据版本加载的 terraforming 数据

### TerraformingToolbar.vue

- 只读工具栏组件
- Props 来自 presenter: hqStationName, stationCode, sectorName, sectorNameId, position, sectorResources, sectorSunlight, singleBerthThroughput
- 复用 `LiveStationToolbar` 的 sector popover、resources 显示
- 不含交互控件 (no v-model, no emits for editing)

### TerraformingSectorPanel.vue（左列）

- 星区列表，每个条目显示星区名称 + 初始属性摘要
- 点击 → `selectTerraformingCluster(id)`
- 当前选中星区高亮

### TerraformingTaskList.vue（中列）

- 调用 `resolveAvailableTasks()` 获得任务树
- 按 group 折叠分组，每组显示 group 名称
- 每个项目行：名称、效果摘要、重复标签、阻塞标记、依赖提示
- 一次性/可重复/冷却 用不同样式/标签区分

### TerraformingResourcePanel.vue（右列）

- 汇总所有项目所需资源
- 表格：ware 名称 | 总量 | 所属项目
- 按 ware 聚合，支持展开 per-project 明细

## 数据流

```
terraforming.json (glob 加载，gameDataStore.folderName 提供版本)
        │
        ▼
    useLiveProductionStore
        ├── terraformingData (TerraformingData)
        ├── selectedClusterId
        ├── terraformingState (currentStats, completedProjects)
        └── terraformingHqContext (HQ station info)
        │
        ▼
    useTerraformingPresenter
        ├── terraformingData → resolveAvailableTasks(cluster, state, data)
        ├── terraformingData.stats → stats metadata
        ├── terraformingHqContext → toolbar props
        └── 组装 → sectorPanelProps / taskListProps / resourcePanelProps
        │
        ▼
    Vue 组件 (TerraformingToolbar, TerraformingSectorPanel, TerraformingTaskList, TerraformingResourcePanel)
```

## store → presenter → vue 三层

- **store** (`useLiveProductionStore`): 管理领域状态 (selectedClusterId, completedProjects, terraformingData 缓存)
- **presenter** (`useTerraformingPresenter`): 组装 UI 数据、调用 `resolveAvailableTasks`、格式化文本
- **vue**: 渲染，通过 presenter 取数，不直接访问 store

## 任务列表展示规则

- 分组顺序：按 `terraforming.json` 中 `projectGroups` 的原始顺序
- 排序：每个 group 内，available 优先于 blocked，同状态按名称字母序
- 重复标签：
  - `repeatCooldown === null` → `[一次性]`
  - `repeatCooldown === 0` → `[可重复]`
  - `repeatCooldown > 0` → `[冷却: Ns]`
- 阻塞原因：
  - conditions: `{stat} >= {min} (当前: {val})` / `{stat} <= {max} (当前: {val})`
  - predecessors: `需要: {项目名}`
