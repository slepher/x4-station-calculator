# Research View Specification

## ADDED Requirements

### Requirement: Sidebar Research Menu Item

`ProductionSidebar.vue` SHALL 在 fixedItems 中渲染 Research 菜单项，位于 Overview 和 Terraforming 之间。

#### Scenario: research item visible in blueprint mode

- **前提** 侧边栏处于蓝图模式 (`!hasSectors`)
- **当** fixedItems 被渲染
- **那么** research 菜单项出现在 overview 之后、terraforming 之前
- **并且** 点击后调用 `selectResearch()` 切换到 research workbench

#### Scenario: research item hidden in live mode

- **前提** 侧边栏处于实况模式 (`hasSectors === true`)
- **当** fixedItems 被渲染
- **那么** research 菜单项不出现

### Requirement: Research Workbench View

`BlueprintProductionWorkbenchView.vue` SHALL 在 `activeEmpireWorkbench === 'research'` 时渲染 `ResearchWorkbench` 组件。

#### Scenario: render research workbench

- **前提** `activeViewStore.activeEmpireWorkbench === 'research'`
- **当** workbench 视图渲染
- **那么** `ResearchWorkbench` 组件被挂载

### Requirement: Research Workbench Layout

`ResearchWorkbench.vue` SHALL 使用 3 列布局。

#### Scenario: three-column layout

- **前提** 研究数据已加载
- **当** 组件渲染
- **那么** 左栏渲染分类筛选 + conditional 开关
- **并且** 中栏渲染研究树（分组 + 节点卡片 + 依赖连线）
- **并且** 右栏渲染选中节点的详情面板

### Requirement: Category Filter and Conditional Toggle

左栏 SHALL 提供分组筛选按钮和 conditional 项显示开关。

#### Scenario: category filter

- **前提** 页面已渲染
- **当** 用户点击分组标签
- **那么** 中栏滚动到对应分组

#### Scenario: conditional toggle

- **前提** 页面已渲染
- **当** 用户开启"显示条件解锁项"开关
- **那么** conditional 组的节点出现在对应分组中
- **当** 用户关闭开关
- **那么** conditional 组节点隐藏

### Requirement: Research Tree Display

中栏 SHALL 按分组渲染研究节点卡片，节点间用连线展示依赖关系。

#### Scenario: node with cost

- **前提** 节点 `cost` 字段非空
- **当** 渲染该节点
- **那么** 显示研究时间（秒或格式化时长）和消耗资源种类数

#### Scenario: node with mission_progress dependency

- **前提** 节点依赖的一个或多个 ware 的 category 为 `mission_progress`
- **当** 渲染该节点
- **那么** 节点下方显示淡化备注标注 `"前置需完成 xxx（主线任务）"`

#### Scenario: abandoned nodes hidden

- **前提** 节点 category 为 `abandoned`
- **当** 渲染树
- **那么** 该节点不出现

#### Scenario: station module dependencies rendered as real edges

- **前提** `station_modules` 分组被渲染
- **当** 中栏展示空间站模块研究树
- **那么** 卡片样式保持当前 research node card 风格
- **并且** 不使用 `→` 文本表达依赖
- **并且** 从 `dock`、`production`、`storage` 到 `defence` 分别渲染 3 条独立连线
- **并且** 从 `dock`、`production`、`storage` 到 `habitation` 分别渲染 3 条独立连线
- **并且** 从 `defence` 到 `build`、从 `habitation` 到 `build` 分别渲染 2 条独立连线
- **并且** `welfare_1 -> welfare_2` 渲染为独立福利链连线
- **并且** `venture` 渲染为无连线的独立节点

### Requirement: Detail Panel

右栏 SHALL 以弹出面板形式展示选中节点的详细信息。

#### Scenario: click node opens detail

- **前提** 中栏渲染了研究节点
- **当** 用户点击节点
- **那么** 右栏显示详情面板，包含：
  - `name`（已翻译名称）
  - `researchTime`（研究耗时）
  - `cost`（资源消耗列表，ware 名称 + 数量）
  - `dependencies`（前置研究项列表）
  - `unlock` 描述（如有，解析 key+params 为可读文本）

#### Scenario: conditional unlock description

- **前提** 选中节点 `unlock` 非空
- **当** 渲染详情面板
- **那么** `unlock.key` 映射为 unlock 描述文本
- **并且** `unlock.params` 中的 game ID 参数被替换到描述文本中
  - `sectorMacro` → maps.json sector name
  - `shipWareId` / `itemWareId` → ware_index name
  - `npcNameId` → i18n registry name
  - `count` → 直接数字

### Requirement: Research Data Loader

`useGameDataStore` SHALL 加载 `research.json` 并暴露 `researchData` 响应式引用。

#### Scenario: load research.json

- **前提** app 初始化
- **当** `useGameDataStore.init()` 执行
- **那么** `research.json` 被加载，`researchData.items` 包含 57 条记录

### Requirement: Research Presenter

`useResearchPresenter` SHALL 接收 store 数据并输出视图模型。

#### Scenario: group items by group

- **前提** researchData 已加载
- **当** presenter 计算
- **那么** `groups` 输出包含每组的分组名和 items 数组
- **并且** `default` 组始终包含，`conditional` 组由 `showConditional` 标志控制

#### Scenario: resolve unlock text

- **前提** conditional 项含 `unlock.key`
- **当** presenter 计算
- **那么** `resolveUnlockText(key, params)` 返回包含解析后参数的描述结构
