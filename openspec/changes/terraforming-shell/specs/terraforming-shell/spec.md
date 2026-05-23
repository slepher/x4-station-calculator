# terraforming-shell Specification

## Purpose

在 live-production 工作台中新增只读地球化面板，提供星区选择、任务列表浏览和资源消耗查看功能。

## ADDED Requirements

### Requirement: 地球化 Tab 渲染

**前提** live-production 工作台已激活

**当** tab bar 渲染

**那么** 在「总览」tab 之后、「transit」tab 之前插入「地球化」tab

**并且** 地球化 tab 图标复用总览的 `playerhqIconUrl`

**并且** tab hover/active 状态样式与现有 tab 一致

### Requirement: 地球化 Tab 切换

**前提** 用户点击地球化 tab

**当** `selectTerraforming` 被调用

**那么** store 设 `workbenchMode = 'terraforming'`

**并且** `activeStationId` 设为 `null`

**并且** 地球化 tab 渲染为 active 状态

### Requirement: 地球化 ContextToolbar（只读 HQ 信息）

**前提** 地球化 tab 激活

**当** toolbar 区域渲染

**那么** 显示一个只读 toolbar，包含从 HQ station 提取的以下信息：
- Station 名称（不可编辑）
- Station code（只读）
- 所属星区名称 + XYZ 坐标 popover
- 星区资源列表（只读图标）
- 光照 / 泊位吞吐量

**并且** 不显示 mode toggle、race preference、workforce 开关、empire gaps 开关、module scope cycler、import 按钮

**前提** HQ station 不存在

**当** toolbar 渲染

**那么** 隐藏 station 特定信息（名称/code），仅显示星区相关占位

### Requirement: 3 列布局

**前提** `workbenchMode === 'terraforming'`

**当** 主内容区渲染

**那么** 使用 `.main-layout` grid：col-span-3, col-span-5, col-span-4 (3:5:4)

**并且** grid 结构与 station mode 完全一致，切换时无抖动

### Requirement: 地球化数据加载

**前提** 游戏数据已加载（`folderName` 已知）

**当** 地球化 presenter 初始化

**那么** 通过 `loadTerraformingData(version)` 加载 `terraforming.json`

**并且** 获取 `clusters` 列表、`projects` 列表、`projectGroups` 列表、`stats` 列表

### Requirement: 星区选择面板（左列）

**前提** 地球化 tab 激活，terraform 数据已加载

**当** 左列渲染

**那么** 显示可选星区/星球列表

**并且** 每个星区显示其 `id`（从 `clusters` 取）和初始 stats 摘要

**并且** 支持点选切换当前星区

### Requirement: 任务列表面板（中列）

**前提** 地球化 tab 激活，星区已选中

**当** 中列渲染

**那么** 调用 `resolveAvailableTasks(cluster, state, data)` 获取任务树

**并且** 按 `projectGroups` 原始顺序分组显示每个任务

**并且** 每个任务显示：中文名、效果摘要、重复性标签 `[一次性]/[可重复]/[冷却:Ns]`、阻塞状态 `[BLOCKED]`

**并且** 阻塞项目标注阻断原因（conditions 不满足 → stat 约束、predecessors 未完成 → 需要 xxx）

### Requirement: 资源消耗面板（右列）

**前提** 地球化 tab 激活，星区已选中

**当** 右列渲染

**那么** 汇总当前星区所有项目所需的总资源消耗

**并且** 显示各 ware 的名称、数量

**并且** 按项目分组的消耗明细

### Requirement: Presenter 层

**前提** `useTerraformingPresenter` 存在

**当** 被调用

**那么** 接收 store 的 terraforming 状态与数据

**并且** 输出面向 UI 的组装数据：
- toolbar props（HQ station 上下文）
- sector panel props（clusters 列表）
- task list props（任务树）
- resource panel props（资源消耗）

**并且** Vue 组件通过 presenter 取数，不直接访问 store
