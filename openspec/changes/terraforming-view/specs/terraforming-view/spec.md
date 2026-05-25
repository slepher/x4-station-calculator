# terraforming-view Specification

## Purpose

将 terraforming-shell 的 3 列占位布局替换为可交互面板：左列星区列表（accordion + i18n + objectives 进度）、中列任务树（分组 + 交互式完成 + x-number-input 计数）、右列执行序列视图（按真实执行顺序逐条展示，并支持单条取消与后续合法性校验）。

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

**并且** 完成判定规则：
- `objective.relocate`: HQ 所在 sector 的 `cluster_id` === 当前 terraforming cluster 的 `macro` 去掉 `macro.` 前缀
- `objective.neutralize`: `terraformingCurrentStats[stat]` >= `stats[i].ranges` 中 `state >= 2` 的最小 `end` 值
- `objective.build_project`: projectId 在 `completedProjects` 中且计数 > 0
- `objective.build_housing`: `terraformingHousingBuilt` >= 目标值（从 `cluster.values` 或 textReplaces 提取）

### Requirement: 当前星区药丸标记

**前提** HQ archive station 数据已加载，左列星区列表渲染

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

**那么** 使用与游戏一致的彩色方块形式展示 state

**并且** 每个方块对应一个实际 value，而不是一个 state

**并且** 若条件来自 `condition.min/max`，则按 state 区间高亮需求方块

**并且** 若条件来自 `condition.minvalue/maxvalue`，则按 value 阈值映射后高亮需求方块

**并且** 当前 stat 卡片显示完整 value 色带

**并且** 项目条件和 objective neutralize 也显示完整 value 色带，而不是仅显示命中区间

**并且** 若某个命中的 state 覆盖多个 value，则必须展开显示该 state 对应的全部同色方块

**并且** 不得把 `condition.min/max` 误解释为真实 value 区间

**并且** 命中条件的连续 value 区间必须在完整色带外叠加空心外框

**并且** 外框与方块本体之间保留固定视觉间距，圆角与内部方块圆角保持匹配

**并且** 不再依据“当前值是否满足条件”切换单独的空心/实心判定；当前 stat 的完整状态图已经承担该职责

**并且** 无 `ranges` 的 stat（例如 `population`）改为数字展示，不显示方块

### Requirement: 前置条件与 stat 条件视觉统一

**前提** 某项目存在 stat 条件或项目前置条件

**当** 中列任务节点渲染条件区

**那么** stat 条件与项目前置条件必须进入同一个 `condition-list`

**并且** 项目前置条件必须使用与 stat 条件一致的边框、背景、圆角和间距样式

**并且** 可用与阻塞前置条件使用同一文本格式，仅通过字体颜色区分状态

**并且** 阻塞区不得再重复输出已经由 stat 方块表达的 `temperature state...` / `humidity state...` 这类文字条件

### Requirement: 运行时 stat 一致性

**前提** terraforming 的部分 stat 需要通过项目 effect 之外的运行时规则派生

**当** 界面渲染状态卡片、项目条件、objective 进度与可用性

**那么** 必须基于同一份运行时 stat 结果

**并且** 至少包含：
- 项目 effects 应用后的 stat
- 派生 airpressure
- warming events 回推后的 temperature

**并且** 不允许出现“显示层把 stat 视为 0，但判定层把同一 stat 视为不存在”的不一致

### Requirement: 动态项目池可见性

**前提** 某项目来自 `SetupStatDependentProjects`，其存在性取决于当前 stat

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

**那么** `completedProjects` 中该 projectId 的值在 0 和 1 之间切换

**并且** 切换后自动 re-resolve

**当** 用户通过 x-number-input 修改可重复任务的完成次数

**那么** `completedProjects` 中该 projectId 的值更新为用户输入值

**并且** 设为 0 等效于从 completedProjects 移除

**并且** 修改后自动 re-resolve

**当** `completedProjects` 变更导致某任务不再满足条件/前置

**那么** 该任务状态变为阻塞

### Requirement: 可重复项目上限基于执行前状态

**前提** 某可重复项目通过 `X4NumberInput` 调整完成次数

**当** 界面计算该项目的 `max` 上限

**那么** 必须按“当前计数下，再执行下一次之前的状态”判断还能追加几次

**并且** 若 `currentStats` 已经包含当前完成次数的 effect 结果，则 `max` 语义必须是：
- 先计算“还能再执行几次”
- 再加回当前 `count`

**并且** 不得把执行完成后的后状态直接误当成总可执行上限

### Requirement: completedProjects 类型变更

**前提** Store 中 `terraformingCompletedProjects` 存在

**当** 中列任务交互

**那么** 类型为 `Map<string, number>`（projectId → 完成次数）

**并且** 一次性任务计数限定为 0 或 1（UI 端 toggle 限制，不强制）

**并且** 可重复任务计数可为任意 ≥ 0 整数

**并且** `resolveAvailableTasks()` 适配新类型（`completedProjects.get(id) > 0` 判定是否完成）

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

**前提** `useTerraformingPresenter` 存在

**那么** 新增以下 assembled props:
- `clusterDisplayNames` (Map<clusterId, i18n name>)
- `clusterMatchesHq` (Record<clusterId, boolean>)
- `objectivesProgress` (Array<{step, action, text, completed, targetVariable?}>)
- `housingBuilt` 读写（绑定 store `terraformingHousingBuilt`）
- `completedProjectCounts` (兼容 `Map<string, number>` 的读写接口)
- `executionTimeline` / `cancelValidationPreview` / `groupMarkers`
- `statScaleModels` / `conditionScaleModels`（供方块组件渲染）

**并且** 所有面向 UI 的数据组装由 Presenter 层完成，不直接在 Vue 组件中操作为 store 数据

### Requirement: 无 Range Stat 改为数字展示

**前提** 某个 terraforming stat 没有 `ranges`

**当** 该 stat 出现在 status 或 condition 展示中

**那么** 不得渲染 state 方块

**并且** 必须改为显示数字值

**并且** 在 condition 场景中必须同时显示需求文本

### Requirement: 条件方块的当前值表达

**前提** 某个 condition 使用方块展示

**当** 当前值命中需求区间

**那么** 仅当前命中的那一格显示边框高亮

**并且** 不得通过位移表达高亮

**当** 当前值未命中需求区间

**那么** 需求方块整体显示为空心

**并且** 不得额外补出当前值所在方块
