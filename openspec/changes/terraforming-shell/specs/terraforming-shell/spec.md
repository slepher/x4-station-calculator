# terraforming-shell Specification

## Purpose

在 live-production 工作台中新增地球化 shell（tab + toolbar + 3 列占位布局），主内容区详细面板由后续 change 实现。

## ADDED Requirements

### Requirement: 地球化 Tab 渲染

**前提** live-production 工作台已激活

**当** tab bar 渲染

**那么** 在「总览」tab 之后、「transit」tab 之前插入「地球化」tab

**并且** 地球化 tab 图标复用总览的 `playerhqIconUrl`

**并且** tab hover/active 状态样式与现有 tab 一致

**前提** 蓝图产能工作台已激活

**当** tab bar 渲染

**那么** 不显示地球化 tab（因 store 缺少 `selectTerraforming` 方法）

### Requirement: 地球化 Tab 切换与持久化

**前提** 用户点击地球化 tab

**当** `selectTerraforming` 被调用

**那么** store 设 `workbenchMode = 'terraforming'`，`activeStationId = null`

**并且** `activeViewStore.activeBindingWorkbench` 设为 `'terraforming'`，写入 localStorage

**前提** 页面刷新后

**那么** 从 localStorage 读取 `activeBindingWorkbench`，若为 `'terraforming'` 则恢复地球化 tab 选中状态

**前提** 用户切换到其他 tab (station/transit/overview)

**那么** `isTerraformingMode` 自动清除，`activeBindingWorkbench` 更新为对应值

### Requirement: 地球化 ContextToolbar（只读 HQ 信息）

**前提** 地球化 tab 激活

**当** toolbar 区域渲染

**那么** 显示只读 toolbar，包含从 HQ station archive 提取的以下信息：
- Station 名称（优先 binding name，回退 code）
- Station code（来自 archive）
- 所属星区名称 + XYZ 坐标 popover
- 星区资源列表
- 光照 % / 泊位吞吐量（默认 930000 m³/h）

**并且** 不显示 mode toggle、race preference、workforce 开关、empire gaps 开关、module scope cycler、import 按钮、编辑控件

**前提** HQ station 不存在

**那么** toolbar 中 station 名称/code 显示为 `-`，星区信息显示占位

### Requirement: 3 列占位布局

**前提** `workbenchMode === 'terraforming'`

**当** 主内容区渲染

**那么** 使用 `.main-layout` grid：col-span-3, col-span-5, col-span-4 (3:5:4)

**并且** 通过 `v-if`/`v-else-if`/`v-else` 互斥链确保仅 terraforming 面板渲染，不与其他面板同时显示

**并且** grid 结构与 station mode 完全一致，切换时无抖动

### Requirement: 地球化数据加载

**前提** 游戏数据通过 `useGameData` 统一管线加载

**那么** `terraforming.json` 作为 `GameDataFiles.terraforming` 字段随其他游戏数据一起加载

**并且** `useGameDataStore.terraformingData` 提供数据访问

**并且** `terraformingTaskResolver.ts` 不包含独立的 `import.meta.glob`

### Requirement: 星区选择面板（左列占位）

**前提** 地球化 tab 激活，terraform 数据已加载

**当** 左列渲染

**那么** 显示星区/星球列表（从 `clusters` 遍历），点选切换 `selectedClusterId`

### Requirement: 任务列表与资源消耗面板（中/右列占位）

**前提** 地球化 tab 激活

**那么** 中列显示「选择星区查看任务列表」占位文本

**并且** 右列显示「选择星区查看资源消耗」占位文本

### Requirement: Presenter 层

**前提** `useTerraformingPresenter` 存在

**当** 被调用

**那么** 接收 store 的 terraforming 状态与数据

**并且** toolbar 数据直接从 `terraformingHqArchiveStation`（通过 `getArchiveStationDataByCode` 管道）读取，不手动查找 `playerStationRecords`

**并且** 输出面向 UI 的组装数据：
- toolbar props（HQ station archive 上下文）
- sector panel props（clusters 列表）
- task list props（任务树，调用 `resolveAvailableTasks`）
- resource panel props（资源消耗聚合）

**并且** 遵循 `store → presenter → vue` 三层
