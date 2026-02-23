# Import Logic Flow Specification

## Purpose
提供从逻辑组网到空间站/帝国的导入能力，确保导入行为可预测、可确认、可回滚，并与现有保存体系兼容。

## ADDED Requirements

### Requirement: Logic Flow Import Entry
系统 SHALL 在空间站页面与帝国总览页面提供逻辑组网导入入口，并保持入口位置一致性。

#### Scenario: Show import button in station page
- **前提** 用户位于空间站页面
- **当** 工具栏渲染完成
- **那么** 系统 SHALL 将“导入”按钮放置在菜单栏最右侧
- **并且** 系统 SHALL 保持该按钮右对齐

#### Scenario: Show import button in empire overview
- **前提** 用户位于帝国总览页面
- **当** 上下文工具栏渲染完成
- **那么** 系统 SHALL 显示与空间站页面风格一致的“导入”按钮
- **并且** 系统 SHALL 将该按钮放置在最右侧并右对齐

### Requirement: Import Source Selection
系统 SHALL 支持从逻辑组网已保存方案中选择导入源。

#### Scenario: Block import when no logic flow plans
- **前提** 逻辑组网不存在任何可用方案
- **当** 用户尝试打开导入执行流程
- **那么** 系统 MUST 阻止导入提交
- **并且** 系统 SHALL 显示“空方案不可导入”提示

#### Scenario: Select plan and group for station import
- **前提** 逻辑组网至少存在一个可用方案
- **当** 用户在空间站导入弹窗完成选择
- **那么** 系统 SHALL 要求用户选择“方案 + 规划区”
- **并且** 仅在选择完整时允许继续

#### Scenario: Select plan for empire import
- **前提** 逻辑组网至少存在一个可用方案
- **当** 用户在帝国导入弹窗完成选择
- **那么** 系统 SHALL 允许用户选择一个方案作为导入源
- **并且** 系统 SHALL 将该方案中的规划区批量映射到空间站

### Requirement: Import Selector UI Constraints
系统 SHALL 在不改变既有导入逻辑的前提下，按上下文维持或调整选择界面形态。

#### Scenario: Switch empire import to load-empire style via current template
- **前提** 用户从帝国总览进入逻辑组网导入
- **当** 导入选择界面打开
- **那么** 系统 SHALL 呈现“加载帝国”界面形态
- **并且** 系统 SHALL 通过直接改造当前导入模板实现该形态（不新增并行模板）
- **并且** 系统 MUST NOT 提供删除操作入口

#### Scenario: Keep detail preview in empire import cards
- **前提** 帝国导入方案卡片已渲染
- **当** 用户浏览方案卡片信息
- **那么** 系统 SHALL 展示详情预览信息（更新时间、统计摘要、预览条目）
- **并且** 当预览条目超出展示上限时，系统 SHALL 展示 `+N more...` 提示

#### Scenario: Use mixed selector pattern in station import
- **前提** 用户从空间站页面进入逻辑组网导入
- **当** 导入选择界面打开并进行方案与规划区选择
- **那么** 系统 SHALL 保持一级选择为下拉控件
- **并且** 系统 SHALL 在选中方案后将二级区展示为“加载帝国”同风格内容区

#### Scenario: Show only non-empty groups in station level-2 area
- **前提** 用户在空间站导入中已选中一个方案
- **当** 系统渲染二级规划区内容区
- **那么** 系统 SHALL 仅展示包含 `manual` 节点的可导入规划区
- **并且** 系统 MUST NOT 展示空规划区

#### Scenario: Direct import action per station group
- **前提** 空间站导入二级内容区已展示可导入规划区
- **当** 用户点击某个规划区的直接导入按钮
- **那么** 系统 SHALL 直接以该规划区作为导入源进入后续导入流程
- **并且** 系统 MUST NOT 依赖“先选中后统一继续”的二段式操作

#### Scenario: Show empty-state when no importable groups in station
- **前提** 用户在空间站导入中选择了一个无可导入规划区的方案
- **当** 系统渲染二级规划区内容区
- **那么** 系统 SHALL 显示空态提示“该方案下暂无可导入的规划区”
- **并且** 系统 SHALL 不展示可触发导入的规划区操作项

#### Scenario: Keep detail preview in station group cards
- **前提** 空间站导入二级内容区已展示可导入规划区
- **当** 用户浏览规划区卡片信息
- **那么** 系统 SHALL 展示详情预览信息（节点统计、关键预览条目）
- **并且** 当预览条目超出展示上限时，系统 SHALL 展示 `+N more...` 提示

#### Scenario: Remove bottom continue flow in import modal
- **前提** 用户进入帝国或空间站导入弹窗
- **当** 可导入卡片已渲染
- **那么** 系统 MUST NOT 以底部“继续”按钮作为导入触发入口
- **并且** 系统 SHALL 仅通过卡片内直接导入动作触发流程

#### Scenario: Do not add extra query capabilities in level-2 area
- **前提** 空间站导入二级选择区已展示
- **当** 用户浏览可选内容
- **那么** 系统 MUST NOT 新增搜索能力
- **并且** 系统 MUST NOT 新增分页或排序能力

#### Scenario: Preserve existing import business logic
- **前提** 用户完成导入选择并确认执行
- **当** 系统进入导入映射与写入流程
- **那么** 系统 SHALL 复用现有导入业务逻辑
- **并且** 系统 MUST NOT 引入新的映射规则或执行分支

### Requirement: Import Confirmation Flow
系统 SHALL 在执行导入前提供上下文匹配的确认流程。

#### Scenario: Conditionally confirm empire import with SmartSaveDialog
- **前提** 用户在帝国总览触发导入
- **当** 系统按“新建按钮同源规则”判定需要保存确认
- **那么** 系统 SHALL 复用 `SmartSaveDialog`
- **并且** 系统 SHALL 提供“保存并导入 / 放弃并导入”操作

#### Scenario: Skip SmartSaveDialog when confirmation is not required
- **前提** 用户在帝国总览触发导入
- **当** 系统按“新建按钮同源规则”判定不需要保存确认
- **那么** 系统 MUST NOT 弹出 `SmartSaveDialog`
- **并且** 系统 SHALL 直接进入导入执行流程

#### Scenario: Confirm station import with dedicated dialog
- **前提** 用户在空间站页面触发导入
- **当** 用户继续导入
- **那么** 系统 SHALL 显示独立导入确认弹窗
- **并且** 系统 SHALL 提供“导入为新空间站 / 覆盖当前空间站”操作

### Requirement: Shared Save-Confirm Decision Logic
系统 SHALL 让“新建按钮”与“导入按钮”共享同一保存确认判定逻辑。

#### Scenario: Reuse one decision source for new and import
- **前提** 系统存在“是否需要保存确认”的判定逻辑
- **当** 新建按钮与导入按钮触发该判定
- **那么** 两者 SHALL 使用同一逻辑入口
- **并且** 两者 SHALL 得到逐条件一致的判定结果

#### Scenario: Move component-level decision logic to store
- **前提** 判定逻辑当前位于 Vue 组件层
- **当** 需要在新建与导入之间复用
- **那么** 系统 SHALL 将判定逻辑上提至 store
- **并且** 组件层 SHALL 仅调用 store 的判定结果

#### Scenario: Active station context switch MUST NOT mark dirty
- **前提** 当前帝国业务数据未发生变化，且已处于“已保存”状态
- **当** 用户仅在空间站页面与帝国总览之间切换（`activeStationId` 变化）
- **那么** 系统 MUST NOT 将该切换判定为 dirty
- **并且** 新建/导入路径 SHALL 保持“不需要保存确认”的判定结果

### Requirement: Mapping from Manual Nodes to Planned Modules
系统 SHALL 将逻辑组网节点按既定规则映射为站点模块计划。

#### Scenario: Import one group into station
- **前提** 用户选择一个规划区并确认导入
- **当** 系统执行映射
- **那么** 系统 SHALL 将该规划区内每个 `manual` 节点映射到目标站 `plannedModules`
- **并且** 同一模块 SHALL 进行计数聚合

#### Scenario: Import full plan into empire
- **前提** 用户在帝国导入中选择一个方案并确认导入
- **当** 系统执行映射
- **那么** 系统 SHALL 为方案中每个非空规划区创建一个空间站
- **并且** 每个空间站 SHALL 仅包含对应规划区 `manual` 节点映射结果

### Requirement: Empty Group Skip and Warning Summary
系统 SHALL 对跳过与忽略项进行统一汇总告警。

#### Scenario: Skip empty groups during empire import
- **前提** 被导入方案包含无 `manual` 节点的规划区
- **当** 系统执行帝国导入
- **那么** 系统 SHALL 跳过空规划区，不创建对应空间站
- **并且** 系统 SHALL 将跳过信息写入 warning 汇总

#### Scenario: Show warning summary after import
- **前提** 本次导入包含被跳过或被忽略的条目
- **当** 导入映射执行完成
- **那么** 系统 SHALL 弹出 warning 汇总弹窗
- **并且** 汇总内容 SHALL 覆盖本次导入全部 warning

### Requirement: Isolated Locking Compatibility
系统 SHALL 仅对可操作资源执行锁定，并忽略不支持的资源类型。

#### Scenario: Lock isolated container wares
- **前提** 导入范围中存在 `isolated` 且运输类型为 `container` 的资源
- **当** 导入写入站点状态
- **那么** 系统 SHALL 将这些资源写入站点锁定集合

#### Scenario: Ignore non-container isolated wares
- **前提** 导入范围中存在 `isolated` 且运输类型非 `container` 的资源
- **当** 导入写入站点状态
- **那么** 系统 SHALL 忽略这些资源的锁定操作
- **并且** 系统 SHALL 将忽略信息写入 warning 汇总

### Requirement: Save Behavior after Import
系统 SHALL 保持导入后的非自动保存策略。

#### Scenario: Do not auto-save after import
- **前提** 用户完成任一导入流程
- **当** 导入结果应用成功
- **那么** 系统 MUST NOT 自动执行保存
- **并且** 用户 SHALL 通过现有保存入口手动保存

### Requirement: Shared Default Group Name Logic
系统 SHALL 使用统一默认组名算法，避免 store 层写入显示默认值。

#### Scenario: Reuse default group name algorithm across UI
- **前提** 规划区 `group.name` 为空
- **当** 任一 UI 位置需要显示组名
- **那么** 系统 SHALL 调用同一通用默认名函数
- **并且** 该函数 SHALL 基于“最高 tier 的 `manual` 节点优先规则”返回展示名称

#### Scenario: Prevent store from persisting derived display name
- **前提** 用户未显式编辑 `group.name`
- **当** 逻辑组网发生手动投放或节点变更
- **那么** store MUST NOT 将默认显示名写回 `group.name`
