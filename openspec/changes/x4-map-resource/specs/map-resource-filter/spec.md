# Map Resource Filter Specification

## Purpose
定义 map 页面资源筛选面板、最低丰度配置、命中候选排序，以及与现有搜索高亮并存时的可验证行为。

## ADDED Requirements

### Requirement: Map Resource Filter Entry
系统 MUST 在 map 页面提供资源筛选入口，并在筛选激活时切换为侧栏工作态。

#### Scenario: 默认入口位置
- **前提** 用户位于 map 页面
- **当** 页面完成渲染
- **那么** 系统 SHALL 在右上角显示资源筛选面板
- **并且** SHALL 保持与左上搜索框并存

#### Scenario: 激活后切换侧栏布局
- **前提** 用户至少选中一个筛选项
- **当** 系统渲染页面布局
- **那么** 系统 SHALL 将地图与资源面板切换为左右并列布局
- **并且** SHALL 让地图位于左侧、资源栏位于右侧

#### Scenario: 工作态提供关闭按钮
- **前提** 当前存在至少一个已选筛选项
- **当** 系统渲染资源栏
- **那么** 系统 SHALL 在右上角显示关闭按钮
- **并且** 点击后 SHALL 清空全部已选筛选项

#### Scenario: 资源筛选面板结构
- **前提** 用户查看右上资源筛选面板
- **当** 系统渲染面板
- **那么** 系统 SHALL 依次显示资源 tag 区、资源配置区、命中候选框

### Requirement: Resource Tag Multi-Select
系统 MUST 支持按资源 tag 进行多选筛选，并将筛选语义定义为 `AND`。

#### Scenario: 资源与日光 tag 固定排序
- **前提** 系统渲染 tag 列表
- **当** 用户查看资源筛选入口
- **那么** 系统 SHALL 按 `ore / silicon / methane / hydrogen / helium / ice / rawscrap / nividium / sunlight` 顺序显示

#### Scenario: 未选中 tag 透明底
- **前提** 某个 tag 当前未选中
- **当** 系统渲染该 tag
- **那么** 系统 SHALL 使用透明背景
- **并且** SHALL 保留该 tag 的资源色边框

#### Scenario: 资源 tag 可多选
- **前提** 面板中存在多个资源 tag
- **当** 用户连续选择多个资源
- **那么** 系统 SHALL 保持这些资源同时处于选中状态

#### Scenario: 资源命中采用 AND 语义
- **前提** 用户已选中多个资源
- **当** 系统计算 sector 是否命中
- **那么** 系统 SHALL 要求 sector 同时满足全部已选资源条件

#### Scenario: 取消选中资源
- **前提** 某个资源 tag 当前处于选中状态
- **当** 用户再次点击该资源 tag
- **那么** 系统 SHALL 取消该资源的选中状态

#### Scenario: 日光 tag 作为特殊筛选项
- **前提** 用户点击 `日光` tag
- **当** 系统处理选中状态
- **那么** 系统 SHALL 将其视为独立筛选项
- **并且** SHALL 不纳入普通资源的 yield 联动逻辑

### Requirement: Per-Resource Minimum Yield Configuration
系统 MUST 允许每个已选资源独立设置最低丰度门槛。

#### Scenario: 已选资源显示独立下拉
- **前提** 用户已选中一个或多个资源
- **当** 系统渲染资源配置区
- **那么** 系统 SHALL 为每个已选资源显示独立的最低丰度下拉

#### Scenario: 新选中资源默认最低丰度
- **前提** 用户新选中某个资源
- **当** 系统初始化该资源的筛选配置
- **那么** 系统 SHALL 将其最低丰度设为 `lowest`

#### Scenario: 缺少资源时不命中
- **前提** 某个 sector 缺少用户已选中的其中一个资源
- **当** 系统判定该 sector 是否命中
- **那么** 系统 SHALL 将该 sector 视为不命中

#### Scenario: 按 yield 等级判定最低丰度
- **前提** 某个 sector 拥有已选资源
- **并且** 用户已为该资源设置最低丰度
- **当** 系统比较 sector 资源与筛选门槛
- **那么** 系统 SHALL 使用该资源的 `yield` 等级顺序进行比较

### Requirement: Batch Minimum Yield Update
系统 MUST 在已选普通资源数量大于等于 `2` 个时提供批量修改入口。

#### Scenario: 选中两项及以上时显示所有项控件
- **前提** 用户已选中大于等于 `2` 个普通资源
- **当** 系统渲染资源配置区
- **那么** 系统 SHALL 额外显示 `所有项` 的最低丰度下拉

#### Scenario: 所有项同步更新全部已选资源
- **前提** 用户已选中超过 `2` 个资源
- **并且** `所有项` 下拉当前可见
- **当** 用户修改 `所有项` 的最低丰度值
- **那么** 系统 SHALL 同步更新全部已选资源的最低丰度

### Requirement: Reachable Yield Constraint
系统 MUST 按当前过滤上下文禁用不可达的 yield 选项。

#### Scenario: 当前过滤可达上限影响下拉
- **前提** 用户已选中多个普通资源
- **当** 系统渲染某个资源的 yield 下拉
- **那么** 系统 SHALL 基于“保留其他资源条件、忽略当前资源自身门槛”计算该资源的可达上限
- **并且** SHALL 禁用高于该上限的选项

#### Scenario: 当前值超出可达上限时不自动改写
- **前提** 当前某个资源的已选值高于新的可达上限
- **当** 系统刷新该资源行
- **那么** 系统 SHALL 保留当前值不变
- **并且** SHALL 显示超出可达上限的警告

### Requirement: Sunlight Input Filter
系统 MUST 支持将 `日光` 作为特殊筛选项，并按百分比输入过滤 sector。

#### Scenario: 日光输入框默认值
- **前提** 用户首次选中 `日光` tag
- **当** 系统渲染配置区
- **那么** 系统 SHALL 显示日光输入框
- **并且** SHALL 默认填入 `100`

#### Scenario: 日光百分比映射
- **前提** sector 在 `maps.json` 中包含 `area.sunlight`
- **当** 系统使用日光条件进行比较
- **那么** 系统 SHALL 按 `1.0 = 100%` 映射

#### Scenario: 仅使用日光筛选时的候选排序
- **前提** 用户只启用 `日光` 筛选
- **当** 系统渲染命中候选
- **那么** 系统 SHALL 按 sector 日光百分比从高到低排序

### Requirement: Resource Match Candidate List
系统 MUST 在资源配置区下方展示满足条件的 sector 候选，并按资源 level 总分排序。

#### Scenario: 选中资源后显示命中候选框
- **前提** 用户至少选中一个资源
- **当** 系统渲染右上面板
- **那么** 系统 SHALL 显示命中候选框

#### Scenario: 候选仅包含满足全部条件的 sector
- **前提** 用户已选择资源并设置最低丰度
- **当** 系统生成命中候选
- **那么** 系统 SHALL 只包含满足全部已选资源及其门槛的 sector

#### Scenario: 按 level 总和排序
- **前提** 存在多个满足条件的 sector
- **并且** 当前存在至少一个普通资源筛选
- **当** 系统对命中候选排序
- **那么** 系统 SHALL 按已选资源在 sector 中的 `level` 总和从高到低排序

#### Scenario: 命中候选数量上限
- **前提** 满足条件的 sector 数量超过 `10`
- **当** 系统渲染命中候选框
- **那么** 系统 SHALL 最多显示前 `10` 个候选

#### Scenario: 点击候选聚焦目标 sector
- **前提** 命中候选框中存在某个 sector 候选
- **当** 用户点击该候选
- **那么** 系统 SHALL 聚焦并选中对应 sector
- **并且** SHALL 复用搜索候选点击的聚焦行为

### Requirement: Search And Resource Highlight Coexistence
系统 MUST 支持搜索命中与资源命中并存，并使用明确的高亮优先级。

#### Scenario: 搜索与资源筛选互不裁剪结果
- **前提** 用户同时使用左上搜索与右上资源筛选
- **当** 系统计算各自结果集
- **那么** 系统 SHALL 保持搜索结果与资源筛选结果各自独立

#### Scenario: 当前选中优先于全部高亮
- **前提** 某个 sector 当前处于选中状态
- **当** 地图渲染 sector 状态
- **那么** 系统 SHALL 让选中样式优先于搜索高亮与资源高亮

#### Scenario: 搜索高亮优先于资源高亮
- **前提** 某个 sector 同时命中搜索结果与资源筛选结果
- **当** 地图渲染该 sector
- **那么** 系统 SHALL 以搜索高亮作为主样式
- **并且** MAY 叠加较弱的资源提示样式

#### Scenario: 资源工作态改写内部填充色
- **前提** 当前存在资源或日光筛选
- **当** 地图渲染 sector 六边形内部填充
- **那么** 系统 SHALL 对命中项使用第一个已选筛选项颜色
- **并且** SHALL 将未命中项内部填充改为透明
