# terraforming-view Specification

## Purpose

将 terraforming-shell 的 3 列占位布局替换为可交互面板：左列星区列表（accordion + i18n + objectives 进度）、中列任务树（分组 + 交互式完成 + 递归子节点渲染 + x-number-input 计数）、右列执行序列视图（按真实执行顺序逐条展示，支持单条取消与后续合法性校验，支持清空队列）。所有领域状态由 `useTerraformingStore` 提供（见 terraforming-store change），View 层通过 Presenter 组装 UI 数据。

## ADDED Requirements

### Requirement: 星区名称 i18n 显示

**前提** terraforming.json 已加载，maps.json 已加载

**当** 左列星区列表渲染

**那么** 每个星区的 displayName 通过 `cluster.macro` → `maps.clusters[mappedMacro].nameId` → i18n 翻译获取

**并且** 星区的 `partName` 显示在名称下方作为类型标签

**并且** displayName 映射由 Presenter 层组装为 `clusterDisplayNames: Map<string, string>`

### Requirement: 星区 Accordion 展开

**前提** 左列星区列表存在

**当** 用户点击某星区

**那么** 调用 `selectTerraformingCluster(clusterId)` 更新 `selectedClusterId`

**并且** 该星区展开显示 objectives 列表

**并且** 前一个展开的星区自动折叠

**当** 未选择任何星区时

**那么** 左列不展开任何信息，显示「选择星区查看详情」占位

### Requirement: Objectives 进度显示

**前提** 某星区已展开

**那么** 按 `cluster.objectives[]` 渲染列表，每项显示：
- step 编号
- action 类型 (objective.relocate / objective.neutralize / objective.build_project / objective.build_housing)
- 翻译后的描述文本 (textId 经 i18n，textReplaces 替换变量为已解析值)
- 完成标记: 已完成 ✅ / 未完成 ⬜

**并且** 完成判定规则（数据来源：`useTerraformingStore`）：
- `objective.relocate`: HQ 所在 sector 的 `cluster_id` === 当前 terraforming cluster 的 `macro` 去掉 `macro.` 前缀
- `objective.neutralize`: `terraformingCurrentStats[stat]` >= `stats[i].ranges` 中 `state >= 2` 的最小 `end` 值
- `objective.build_project`: projectId 在 `completedProjects` 中且计数 > 0
- `objective.build_housing`: `currentStats.population` >= 目标值（从 `cluster.values` 或 textReplaces 的 `$AMOUNT$` 提取）

### Requirement: 当前星区药丸标记

**前提** `useTerraformingStore` 已提供 HQ context（`hqClusterId`、`hqArchiveStation` 等），左列星区列表渲染

**当** terraforming cluster 的 macro（去掉 `macro.` 前缀）等于 HQ archive station 所属 sector 的 `cluster_id`

**那么** 该 cluster 行首显示 `🏷️ 当前星区` 药丸 tag

**当** HQ station 所属星区与 terraforming cluster 不匹配

**那么** 不显示药丸 tag

### Requirement: 任务树分组渲染

**前提** 已选择星区，`resolveAvailableTasks()` 返回 TaskTree

**那么** 中列按 `projectGroups` 原始顺序分组显示任务

**并且** 每组有标题（group 名称经 i18n 翻译）

**并且** 子任务通过缩进表示依赖树父子关系

**并且** 仅“同组强制前置”可以形成父子树

**并且** “跨组强制前置”不得把节点移出其自身 group

**并且** 跨组强制前置只作为依赖或阻塞信息展示

### Requirement: 任务节点信息展示

**前提** 任务树已渲染

**那么** 每个任务节点显示：
- 状态图标: ⬜ 可用未完成 / ❌ 阻塞 / ✅ 已完成
- 名称 (i18n 翻译后的 project name)
- 效果摘要 `(+2 temp, humidity=4)`
- 重复性标签: `[一次性]` (repeatCooldown === null) / `[可重复]` (repeatCooldown === 0) / `[冷却:Ns]` (repeatCooldown > 0)
- 依赖标注: `需要: 项目名` (type=project) 或 `需要: [组: 能源]` (type=group)
- 阻塞原因: `需要: XXX`（来自 taskNode.blockedReason）

**并且** 对可重复项目，若存在 `duration`，则直接显示在 `可重复` 或 `冷却` 标签后，并格式化为 `HH:MM:SS`

### Requirement: 游戏方块式状态与需求展示

**前提** stat 的 `ranges` 已包含完整 `start/end/state/rgb` 语义，项目条件已区分 state 边界与 value 边界

**当** 界面渲染 stat 卡片、项目条件或 objective neutralize 条件

**那么** 必须复用 `terraforming-blocks` change 中定义的统一 stat 展示语义

**并且** `terraforming-view` 不得在本规格中重复定义方块或数字型 stat 的具体视觉细节

### Requirement: 前置条件与 stat 条件视觉统一

**前提** 某项目存在 stat 条件或项目前置条件

**当** 中列任务节点渲染条件区

**那么** stat 条件与项目前置条件必须进入同一个 `condition-list`

**并且** 项目前置条件必须使用与 stat 条件一致的边框、背景、圆角和间距样式

**并且** 可用与阻塞前置条件使用同一文本格式，仅通过字体颜色区分状态

**并且** 阻塞区不得再重复输出已经由 stat 方块表达的 `temperature state...` / `humidity state...` 这类文字条件

### Requirement: 运行时 stat 一致性

**前提** terraforming 的 stat 计算由 `useTerraformingStore` 负责（见 terraforming-store change），View 层消费其输出

**当** 界面渲染状态卡片、项目条件、objective 进度与可用性

**那么** 所有 UI 展示 MUST 消费 `useTerraformingStore` 提供的同一份 `terraformingCurrentStats`，不得在 View/Presenter 层独立计算 stat

**并且** 至少包含：
- 项目 effects 应用后的 stat
- 派生 airpressure
- warming events 回推后的 temperature

**并且** 不允许出现“显示层把 stat 视为 0，但判定层把同一 stat 视为不存在”的不一致

### Requirement: 动态项目池可见性

**前提** 某项目来自 `SetupStatDependentProjects`，其存在性取决于当前 stat（stat 数据由 `useTerraformingStore` 提供）

**当** 当前 stat 跨越动态项目阈值

**那么** 中列任务列表必须动态增删对应项目

**并且** 不得仅因为该项目最初被静态注入过，就长期保留在 UI 中

### Requirement: Ignore Stat 隐藏语义

**前提** 当前 cluster 显式设置某个 `Ignore*` flag

**当** 界面渲染对应 stat 条件、状态卡片或进行项目可用性判定

**那么** 该 stat 必须被视为“被设计性忽略”

**并且** 不显示该 stat 的条件块

**并且** 不以该 stat 参与项目可用性判定

### Requirement: 任务完成交互

**前提** 中列任务列表渲染

**当** 用户点击一次性任务的 toggle

**那么** `completedProjects` 中该 projectId 的值在 0 和 1 之间切换（mutation 通过 `useTerraformingStore` 的 `setProjectCount` / `toggleProject` 执行）

**并且** 切换后自动 re-resolve

**当** 用户通过 x-number-input 修改可重复任务的完成次数

**那么** `completedProjects` 中该 projectId 的值更新为用户输入值

**并且** 设为 0 等效于从 completedProjects 移除

**并且** 修改后自动 re-resolve

**当** `completedProjects` 变更导致某任务不再满足条件/前置

**那么** 该任务状态变为阻塞

**并且** 执行按钮、撤销按钮、数量输入框在可交互状态下必须默认常显

**并且** 不得依赖 hover reveal 才显示这些主操作

### Requirement: 可重复项目上限基于执行前状态

**前提** 某可重复项目通过 `X4NumberInput` 调整完成次数

**当** 界面计算该项目的 `max` 上限

**那么** 必须按“当前计数下，再执行下一次之前的状态”判断还能追加几次

**并且** 若 `currentStats` 已经包含当前完成次数的 effect 结果，则 `max` 语义必须是：
- 先计算“还能再执行几次”
- 再加回当前 `count`

**并且** 不得把执行完成后的后状态直接误当成总可执行上限

### Requirement: completedProjects 类型变更

**前提** `useTerraformingStore` 提供 per-cluster `completedProjects`（`Map<string, number>`，见 terraforming-store change）

**当** 中列任务交互

**那么** 类型为 `Map<string, number>`（projectId → 完成次数）

**并且** 一次性任务计数限定为 0 或 1（UI 端 toggle 限制，不强制）

**并且** 可重复任务计数可为任意 ≥ 0 整数

**并且** `resolveAvailableTasks()` 适配该类型（`completedProjects.get(id) > 0` 判定是否完成）

### Requirement: 项目依赖条目持续显示

**前提** 某个 terraforming 项目存在前置项目依赖

**当** 中列任务节点渲染条件区

**那么** 依赖条目必须持续显示

**并且** 不得因为当前阻塞原因来自其他 stat 条件就隐藏该依赖条目

**并且** 若当前确实因依赖阻塞，可以切换为 blocked 样式

**并且** 若当前未被依赖阻塞，则保持 available 样式

### Requirement: 右列执行序列显示

**前提** 右列渲染，已选择星区

**那么** 必须按用户真实执行顺序逐条显示 terraforming 项目执行记录

**并且** 每次执行都是一条独立记录

**并且** 可重复项目每增加 1 次，必须新增 1 条记录，而不是只改变聚合 count

**并且** 右列不得再以 `资源汇总 / 交付清单 / 项目明细` 三个 tab 作为主视图

### Requirement: 单条执行记录展开明细

**前提** 右列渲染，已选择星区

**当** 用户展开某条执行记录

**那么** 必须展示该次执行自己的：
- wares 消耗
- price
- deliveries
- beforeStats
- afterStats

### Requirement: 相邻同组仅做视觉标记

**前提** 右列存在多条执行记录

**当** 若干记录在序列中相邻且同组

**那么** 允许显示该连续段的组名标记

**并且** 该标记只显示组名

**并且** 不得折叠记录

**并且** 不得合并记录

**并且** 不得跨越不相邻记录强行聚合

### Requirement: 单条取消与后续合法性校验

**前提** 用户尝试取消右列中的某条执行记录

**当** 系统预演取消该记录

**那么** 必须从该记录之后开始，逐条重新校验后续记录

**并且** 校验粒度是单条执行记录，而不是按组批量处理

**并且** 至少检查：
- stat 条件
- predecessors
- blockedProjects / blockedGroups
- removedProjects
- runtime project pool 可见性

**并且** 系统必须能够给出受影响的后续记录列表

**并且** 不得在 `executionTimeline` 渲染期为每条记录预先执行该预演

**并且** 取消预演必须在用户展开单条记录或触发撤销动作时按需计算

**并且** 单条预演结果可以按 `entryId` 缓存，但 execution log 变化后必须失效

### Requirement: Presenter 层新增 computed

**前提** `useTerraformingPresenter` 存在，数据源为 `useTerraformingStore`

**那么** 新增以下 assembled props:
- `clusterDisplayNames` (Map<clusterId, i18n name>)
- `clusterMatchesHq` (Record<clusterId, boolean>，基于 store 的 `hqClusterId` 计算)
- `objectivesProgress` (Array<{step, action, text, completed, targetVariable?}>)
- `completedProjectCounts` (通过 store 的 completedProjects 读写)
- `executionTimeline` / `cancelValidationPreview` / `groupMarkers`
- `statScaleModels` / `conditionScaleModels`（供统一 stat 展示组件渲染）

**并且** 所有面向 UI 的数据组装由 Presenter 层完成，不直接在 Vue 组件中操作 store 数据

### Requirement: 无 Range Stat 改为数字展示

**前提** 某个 terraforming stat 没有 `ranges`

**当** 该 stat 出现在 status 或 condition 展示中

**那么** 必须复用 `terraforming-blocks` change 中定义的数字型 stat 展示语义

### Requirement: 递归任务树深度

**前提** 任务树存在同组多层强制前置依赖（如 biosphere: genes → microbes → fauna → megafauna）

**当** 中列渲染任务树

**那么** 子节点通过递归组件 `TerraformingTaskNode` 渲染，支持任意深度的父子链

**并且** 每层子节点向左缩进 `ml-6`

**并且** 不得限制为仅渲染一层 children

### Requirement: blocked 状态非叠加样式

**前提** 任务节点为 blocked 状态

**当** 渲染 blocked 节点

**那么** 不应用元素级 `opacity`（避免嵌套叠加）

**并且** 不使用 `grayscale` 滤镜（避免影响 stat 方块颜色辨识）

**并且** 通过暗化任务名称和状态图标文字颜色表达 blocked

### Requirement: 右列清空队列

**前提** 右列执行序列存在至少一条记录

**当** 用户点击标题栏「清空任务」按钮

**那么** 执行序列全部清空

**并且** `terraformingCompletedProjects` 随 execution log 同步重置

**当** 执行序列为空

**那么** 清空按钮自动隐藏

### Requirement: objective.relocate sector 级判定

**前提** objective 的 `relocateTarget` 字段为 `"sector"`（由数据层标记）

**当** 计算 `objective.relocate` 的完成状态

**那么** 除 cluster 级匹配外，还需验证 HQ sector 的 `nameId` 与 objective 已解析的 `$LOCATION$` nameId 一致



### Requirement: Task price MUST 在操作按钮前显示

每个 task entry 在 task list 和 edit log 中 MUST 在操作按钮/输入框之前显示 material price。

#### Scenario: Task list 中的 price

**前提** task 的 `resources.price > 0`

**当** task list 渲染 task node

**那么** price 格式化为 `1,000,000 Cr` MUST 出现在 task-actions 区域的 toggle/input 左侧

#### Scenario: Edit log 中的 price

**前提** draft entry 的 price > 0

**当** edit log 渲染 draft task entry

**那么** price 格式化为 `1,000,000 Cr` MUST 出现在 draft-actions 区域的 remove/copy 按钮左侧

### Requirement: Wares 信息图标与 tooltip

一个带圆圈的 i 图标 MUST 出现在 price 之后，hover 时显示材料列表 tooltip。

#### Scenario: Hover 显示 tooltip

**前提** project 有 wares

**当** 用户 hover ⓘ 图标

**那么** 一个 tippy tooltip MUST 向上弹出（placement: top），显示：
- 每个 ware 名称（i18n 翻译）和数量
- flex 布局：ware 名称左对齐，数量右对齐

**并且** price MUST NOT 在 tooltip 中重复显示

### Requirement: Events MUST 可从 task list 拖拽

Task list 中的 event tasks（group: 'events'）MUST 可拖拽至 edit log 队列。

#### Scenario: Events 拖拽支持

**前提** 编辑模式已激活，task list 有可见 events

**当** events 区块渲染

**那么** events MUST 被包裹在 draggable 中，使用与普通 task 相同的 group `terraforming-tasks` 和 clone 配置

**并且** 每个 event card MUST 具有 `.drag-to-log` 手柄，位于 `task-actions` 中，位置与 TerraformingTaskNode 一致

### Requirement: Drag-to-log 手柄 hover 样式

Drag-to-log 手柄 MUST 具有 hover 和 grab 光标 CSS。

#### Scenario: 手柄外观

**前提** 编辑模式已激活

**当** 用户 hover drag-to-log 手柄

**那么** 光标 MUST 为 `grab`，文字颜色 MUST 变为浅色调

**当** 用户正在拖拽

**那么** 光标 MUST 为 `grabbing`
## MODIFIED Requirements

### Requirement: 星区面板 List/Item 双模式

Sector panel SHALL support list mode (browse all sectors) and item mode (view selected sector details).

#### Scenario: List 模式 — 星区列表

**前提** 用户进入地球化页面

**当** SectorPanel 处于 list 模式

**那么** 所有可地球化星区以列表展示
**并且** 已选中星区保持 `.active` 高亮
**并且** 点击星区条目进入 item 模式

#### Scenario: Item 模式 — 星区详情

**前提** 用户点击星区条目

**当** SectorPanel 切换到 item 模式

**那么** 标题栏显示返回按钮（更换船只 SVG icon）和星区名称
**并且** 按序显示 Objectives、Stats（TerraformingStatScale，单列）、Rebates（两列 grid-cols-2）
**并且** 点击返回按钮回到 list 模式，不清理 selectedClusterId

#### Scenario: 默认选中星区

**前提** 页面加载时 selectedClusterId 非空

**那么** SectorPanel 直接进入 item 模式

### Requirement: 面板浮动/固定双模式

Panels SHALL switch between floating and fixed mode based on queue edit state.

#### Scenario: 非编辑模式

**前提** queueEditState.editing 为 false

**那么** SectorPanel 浮动、TaskList 固定、ResourcePanel 浮动
**并且** 浮动面板：flex-col + max-height + overflow-y-auto + header sticky
**并且** 固定面板：无 max-h/flex-col，内容自然撑开

#### Scenario: 编辑模式

**前提** queueEditState.editing 为 true

**那么** SectorPanel 浮动、TaskList 浮动、ResourcePanel 固定

### Requirement: 动态面板高度

Panel max-height SHALL be calculated dynamically from viewport.

#### Scenario: 高度计算

**前提** 浏览器窗口大小为 H px

**当** 计算 panel-max-h

**那么** max-height = H - 32px
**并且** 切换 terraforming 模式、窗口 resize 时重新计算

### Requirement: 执行队列自动滚动展开

Execution queue SHALL auto-scroll to the last entry when a new entry is added in non-edit mode.

#### Scenario: 新增执行条目

**前提** 非编辑模式，executionTimeline 长度从 n 变为 n+1

**那么** 末条自动展开
**并且** 面板滚动到底部（先 nextTick 展开，再 nextTick 滚动）

### Requirement: Objective 数字格式化

Objective text SHALL format large numbers with locale-aware separators.

#### Scenario: 住宅目标数字

**前提** objective 文本经 textReplaces 解析后含 ≥ 4 位整数

**那么** 数字自动 `toLocaleString()` 格式化（如 `1000000000` → `1,000,000,000`）

### Requirement: 互斥依赖文案

Mutually exclusive dependency labels SHALL use exclusionary wording.

#### Scenario: 互斥项目显示

**前提** 项目有 `notCompleted` 依赖

**当** 渲染依赖行

**那么** 中文显示"互斥: 项目名"，英文显示 "Mutually exclusive: ProjectName"

### Requirement: 三栏布局始终可见

The three-column layout SHALL persist regardless of display mode.

#### Scenario: 面板始终渲染

**前提** 在 terraforming view 任意状态下

**那么** 三栏（SectorPanel | TaskList | ResourcePanel）始终以 `lg:col-span-3 | 5 | 4` 布局呈现
**并且** 未选中星区时 TaskList / ResourcePanel 显示各自的占位空状态

## REMOVED Requirements

### Requirement: Sector Accordion Expansion

**理由**: 手风琴展开模式被 list/item 双模式替代。

### Requirement: TaskList Global Stats Card

**理由**: Stats 和 Rebates 显示从 TaskList 移至 SectorPanel 的 item 模式。

**并且** 非 sector 级 relocate 保持原 cluster 级判定
