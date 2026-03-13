# Map Resource Filter Specification

## Purpose
定义 map 页面资源筛选面板、最低丰度配置、命中候选排序，以及多资源筛选时的 sector 饼图染色与数据流行为。

## ADDED Requirements

### Requirement: Map Resource Filter Entry
系统 MUST 在 map 页面提供资源筛选入口，并在筛选激活时切换为侧栏工作态。

#### Scenario: 默认入口位置
- **前提** 用户位于 map 页面
- **当** 页面完成渲染
- **那么** 系统 SHALL 在右上角显示“资源 + 过滤图标”的入口按钮
- **并且** SHALL 保持与左上搜索框并存
- **并且** SHALL 与搜索框处于同一地图覆盖层，而不是作为外层并列列块参与布局

#### Scenario: 点击按钮展开资源过滤面板
- **前提** 用户位于 map 页面
- **并且** 资源过滤面板当前未展开
- **当** 用户点击右上角资源入口按钮
- **那么** 系统 SHALL 直接切换为左右并列布局
- **并且** SHALL 在右侧资源栏中显示资源 tag 区、资源配置区、命中候选框
- **并且** SHALL NOT 先在地图右上角显示独立资源浮层

#### Scenario: 激活后切换侧栏布局
- **前提** 用户点击右上角资源入口按钮
- **当** 系统渲染页面布局
- **那么** 系统 SHALL 将地图与资源面板切换为左右并列布局
- **并且** SHALL 让地图位于左侧、资源栏位于右侧

#### Scenario: 工作态提供关闭按钮
- **前提** 用户当前处于资源工作态
- **当** 系统渲染资源栏
- **那么** 系统 SHALL 在右侧资源栏显示关闭按钮
- **并且** 点击后 SHALL 退出左右并列布局
- **并且** SHALL 回到只显示右上角资源入口按钮的默认状态

#### Scenario: 资源筛选面板结构
- **前提** 用户查看右侧资源栏
- **当** 系统渲染面板
- **那么** 系统 SHALL 依次显示资源 tag 区、资源配置区、命中候选框

### Requirement: Resource Panel Close Persistence
系统 MUST 在关闭资源过滤面板时保留面板配置，并只清理地图上的资源高亮表现。

#### Scenario: 关闭面板时保留筛选配置
- **前提** 用户已在资源过滤面板中选择资源、最低丰度或日光条件
- **当** 用户点击关闭按钮
- **那么** 系统 SHALL 保留当前面板中的已选资源、最低丰度和日光输入值
- **并且** SHALL NOT 因关闭动作重置这些配置

#### Scenario: 关闭面板时清理资源高亮
- **前提** 地图上当前存在由资源过滤产生的命中高亮
- **当** 用户点击关闭按钮
- **那么** 系统 SHALL 清理资源过滤产生的地图高亮数据
- **并且** SHALL NOT 清理当前选中 sector 或搜索高亮数据

#### Scenario: 同一页面会话内重新打开时恢复配置
- **前提** 用户在当前页面会话中关闭过资源过滤面板
- **并且** 关闭前面板中存在筛选配置
- **当** 用户再次点击资源入口按钮
- **那么** 系统 SHALL 按关闭前的配置内容重新渲染面板

#### Scenario: 刷新页面后不要求恢复
- **前提** 用户已在当前页面会话中配置资源过滤面板
- **当** 用户刷新页面
- **那么** 系统 MAY 丢失未持久化的面板配置

### Requirement: Resource Tag Multi-Select
系统 MUST 支持按资源 tag 进行多选筛选，并将筛选语义定义为 `AND`。

#### Scenario: 资源与日光 tag 固定排序
- **前提** 系统渲染 tag 列表
- **当** 用户查看资源筛选入口
- **那么** 系统 SHALL 按 `ore / silicon / methane / hydrogen / helium / ice / rawscrap / nividium / sunlight` 顺序显示

#### Scenario: 右上普通资源 tag 使用短 i18n
- **前提** 系统渲染右上角资源 tag 列表
- **当** 系统显示普通资源 tag
- **那么** 系统 SHALL 使用 `res.*` 字典短名
- **并且** SHALL NOT 在该区域显示普通资源的长名称

#### Scenario: 右上日光 tag 复用 energycells 短名
- **前提** 系统渲染右上角 `sunlight` tag
- **当** 用户查看该 tag 文案
- **那么** 系统 SHALL 显示 `res.energycells` 对应短名
- **并且** SHALL NOT 显示 `日光 / Sunlight`

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

#### Scenario: 配置区继续显示长 i18n
- **前提** 用户已选中一个或多个资源或 `日光`
- **当** 系统渲染下方配置区
- **那么** 系统 SHALL 对普通资源显示长名称
- **并且** SHALL 对 `sunlight` 配置项继续显示 `日光 / Sunlight`

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

#### Scenario: 进入工作态后显示命中候选框
- **前提** 用户已进入右侧资源工作态
- **当** 系统渲染右侧资源栏
- **那么** 系统 SHALL 显示命中候选框

#### Scenario: 空选择时显示默认前十候选
- **前提** 用户已进入右侧资源工作态
- **并且** 当前没有选中任何资源 tag 或日光 tag
- **当** 系统渲染命中候选框
- **那么** 系统 SHALL 显示默认前 `10` 条 sector 候选
- **并且** SHALL 按 `ore + silicon + methane + hydrogen + helium` 的 `level` 总和从高到低排序

#### Scenario: 候选仅包含满足全部条件的 sector
- **前提** 用户已选择资源并设置最低丰度
- **当** 系统生成命中候选
- **那么** 系统 SHALL 只包含满足全部已选资源及其门槛的 sector

#### Scenario: 按 level 总和排序
- **前提** 存在多个满足条件的 sector
- **并且** 当前存在至少一个普通资源筛选
- **当** 系统对命中候选排序
- **那么** 系统 SHALL 按已选资源在 sector 中的 `level` 总和从高到低排序

## MODIFIED Requirements

### Requirement: Search And Resource Highlight Coexistence
系统 MUST 支持搜索命中与资源命中并存，并在资源过滤激活时根据参与资源数量选择单色或饼图填充。

#### Scenario: 搜索高亮优先于资源高亮
- **前提** 某个 sector 同时命中搜索结果与资源筛选结果
- **当** 地图渲染该 sector
- **那么** 系统 SHALL 以搜索高亮为主样式
- **并且** SHALL 仅将资源过滤作为较弱提示叠加

#### Scenario: 资源过滤未激活时保持原始内部填充
- **前提** 当前没有激活任何资源或日光筛选
- **当** 地图渲染 sector
- **那么** 系统 SHALL 保持既有非资源过滤内部填充逻辑

#### Scenario: 单资源筛选时继续使用单色填充
- **前提** 当前资源过滤激活
- **并且** 当前只有一个参与染色的项目
- **当** 地图渲染命中 sector
- **那么** 系统 SHALL 继续使用单色内部填充

#### Scenario: 多资源筛选时改为饼图填充
- **前提** 当前资源过滤激活
- **并且** 当前存在两个或以上参与染色的普通资源
- **当** 地图渲染命中 sector
- **那么** 系统 SHALL 将 sector 内部渲染为多切片饼图
- **并且** SHALL NOT 再整块使用第一个资源颜色填充

#### Scenario: 未命中 sector 保持透明
- **前提** 当前资源过滤激活
- **并且** 某个 sector 不满足资源过滤条件
- **当** 地图渲染该 sector
- **那么** 系统 SHALL 让该 sector 的内部填充保持透明

### Requirement: Resource Pie Slice Ordering And Allocation
系统 MUST 按资源 tag 固定顺序和 sector `level` 现状生成多资源饼图切片，并为每个参与资源保留最小可见份额。

#### Scenario: 切片顺序遵循 tag 固定顺序
- **前提** 当前存在多个参与染色的普通资源
- **当** 系统生成 sector 的饼图切片
- **那么** 系统 SHALL 按资源 tag 固定顺序输出切片
- **并且** SHALL NOT 按 sector 中资源数值重新排序

#### Scenario: 切片基础权重来自 level
- **前提** 某个命中 sector 存在多个参与染色的普通资源
- **当** 系统计算切片大小
- **那么** 系统 SHALL 使用这些资源在该 sector 中的 `level` 作为基础权重

#### Scenario: 每个参与资源保留最小显示份额
- **前提** 某个命中 sector 存在多个参与染色的普通资源
- **当** 系统完成切片份额分配
- **那么** 系统 SHALL 为每个参与资源保留至少 `5%` 的可见份额

#### Scenario: 剩余份额按 level 比例分配
- **前提** 系统已为每个参与资源保留最小显示份额
- **当** 系统分配剩余饼图空间
- **那么** 系统 SHALL 按各资源 `level` 比例分配剩余份额

#### Scenario: level 总和为零时仍稳定可见
- **前提** 某个命中 sector 的参与染色资源 `level` 总和为 `0`
- **当** 系统生成饼图切片
- **那么** 系统 SHALL 仍为每个参与资源保留至少 `5%` 的可见份额
- **并且** SHALL 使用稳定规则分配剩余份额

### Requirement: Sunlight Exclusion In Mixed Resource Coloring
系统 MUST 在存在普通资源切片时排除 `日光` 染色，并只在没有普通资源参与时允许日光单独染色。

#### Scenario: 普通资源存在时排除日光切片
- **前提** 当前选中的染色条件同时包含 `日光` 与至少一个普通资源
- **并且** 某个命中 sector 存在普通资源参与染色
- **当** 系统生成该 sector 的染色结果
- **那么** 系统 SHALL 排除 `日光` 切片

#### Scenario: 只有日光参与时保留单独染色
- **前提** 当前没有普通资源参与染色
- **并且** `日光` 条件处于激活状态
- **当** 系统生成命中 sector 的染色结果
- **那么** 系统 SHALL 允许 `日光` 继续作为单独染色来源

### Requirement: Resource Filter Coloring Data Flow
系统 MUST 将资源过滤染色数据从单一颜色升级为可描述 sector 切片的结构，并由地图工作台传递给 SVG 画布。

#### Scenario: 面板向外输出 sector 染色描述
- **前提** 资源过滤面板已经根据当前条件计算出命中 sector
- **当** 面板向上游发送资源过滤表现数据
- **那么** 系统 SHALL 输出命中 sector 列表
- **并且** SHALL 输出每个命中 sector 的染色描述

#### Scenario: 地图工作台转发切片描述
- **前提** 地图工作台接收到资源过滤面板输出的 sector 染色描述
- **当** 地图工作台渲染 SVG 画布
- **那么** 系统 SHALL 将这些描述转发给 SVG 画布
- **并且** SHALL 保持搜索高亮与当前选中态输入结构不退化
