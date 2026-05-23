# terraforming-shell Request

## 目标

在 `live-production` 的总览 (overview) tab 之后新增「地球化」tab (shell)，包含 tab 栏入口、只读 HQ 上下文工具栏、3 列占位布局。主内容区的详细面板（任务列表、资源消耗等）不在本 change 范围。

## 已确认方案（审核重点）

### 入口与 Tab

- 地球化 tab **仅在 live-production 工作台显示**，蓝图产能界面不显示。
- tab 位置：总览 → **地球化** → transit → station。
- tab 类型：`ProductionTabItem.type` 新增 `'terraforming'`。
- `workbenchMode` 新增 `'terraforming'`。
- tab 图标复用总览图标 (`playerhqIconUrl`)。
- 点击地球化 tab → `workbenchMode = 'terraforming'`，`activeStationId = null`。
- 切换回其他 tab 时自动清除 terraforming 模式。
- 地球化 tab 状态通过 `useActiveViewStore.activeBindingWorkbench` 持久化到 localStorage，刷新不丢失。

### ContextToolbar（只读简化版）

- 独立组件 `TerraformingToolbar.vue`，复用 `LiveStationToolbar` 的 sector popover 和 resources 显示样式。
- 数据源：store 的 `terraformingHqArchiveStation`——由 `terraformingHqStationCode`（从 `tabSemanticsById` 找 `tag === 'playerhq'` 的 station id）通过现有 `getArchiveStationDataByCode` 管道获取完整 archive 数据。
- 显示内容（只读）：
  - Station 名称：优先 binding plan 的 name，回退到 save station code
  - Station code
  - 星区名称 + XYZ position popover
  - 星区资源列表
  - 光照 % / 泊位吞吐量 (默认 930000 m³/h = transportShipCapacity 62000 × 15)
- 不包含：mode toggle、race preference、workforce calc、show empire gaps、module scope cycler、import、编辑。

### 主内容区布局

- 3 列 grid，比例 3:5:4，复用 `.main-layout`，与 station mode 一致无抖动。
- 使用 `v-if="terraforming"` / `v-else-if="overview||transit"` / `v-else` 互斥链，确保只渲染一个面板区。
- 左/中/右列均为占位面板（地球化星区列表、任务列表占位、资源消耗占位），具体内容由后续 change 实现。

### 数据层

- **数据来源**：`terraforming.json` 通过 `useGameData.ts` 的统一 `import.meta.glob` 管线加载（`loadGameDataFiles`），存入 `useGameDataStore.terraformingData`。不在 `terraformingTaskResolver.ts` 中独立 `import.meta.glob`。
- **核心推理**：`terraformingTaskResolver.ts` 的 `resolveAvailableTasks` 等函数接收 `TerraformingData` 参数，由调用方传入。
- **Store** (`useLiveProductionStore`)：
  - `terraformingData`：直接读取 `gameData.terraformingData`
  - `terraformingSelectedClusterId`、`terraformingCompletedProjects`：ref
  - `terraformingSelectedCluster`、`terraformingCurrentStats`：computed
  - `terraformingHqStationCode`：从 `orderedStationsBySector` + `tabSemanticsById` 定位 HQ
  - `terraformingHqStationName`：HQ station 的 binding name（`orderedStationsBySector[].name`）
  - `terraformingHqArchiveStation`：通过 `getArchiveStationDataByCode` 获取完整 archive
- **Presenter** (`useTerraformingPresenter`)：接收 store 数据，组装 toolbar/sectorPanel/taskList/resourcePanel props。HQ 数据从 `terraformingHqArchiveStation` 直接读取（不手动查 `playerStationRecords`）。

## 边界

### In Scope

- Tab 栏新增「地球化」tab（仅 live-production）
- `TerraformingToolbar` 只读 HQ 工具栏
- `useTerraformingPresenter` 数据层
- Store 中地球化状态与 HQ 上下文 computed
- `terraforming.json` 纳入 `useGameData` 统一加载管线
- 3 列占位布局
- Tab 状态持久化 (`activeBindingWorkbench`)
- `npm run build` 无编译错误

### Out of Scope

- 主内容区详细面板（任务列表渲染、资源消耗表格等）
- 地球化项目的执行/完成/状态变更
- 地球化完成后的 effects 应用与 stats 刷新
- 测试编写

## 验收标准 (DoD)

1. 地球化 tab 出现在 live-production tab 栏中，位于「总览」之后
2. 蓝图产能界面不显示地球化 tab
3. 点击地球化 tab 后，toolbar 显示 HQ station 的只读信息（名称/code/星区/资源/光照/吞吐量）
4. 主内容区显示为 3 列占位布局 (3:5:4)
5. 从 overview/station/transit 切换到地球化 tab 再切回，状态不丢失
6. 刷新页面后地球化 tab 选中状态保持
7. `npm run build` 无编译错误
8. `terraforming.json` 无 Vite 双导入 warning

## 未决项

无。
