# Map Search Specification

## Purpose
定义 map 页面 sector 搜索、候选列表、命中高亮与聚焦行为，确保搜索规则与地图联动行为可验证。

## ADDED Requirements

### Requirement: Map Sector Search Entry
系统 MUST 在 map 页面左上角提供 sector 搜索入口，并以下拉候选承载搜索结果。

#### Scenario: 搜索入口位置
- **前提** 用户位于 map 页面
- **当** 页面完成渲染
- **那么** 系统 SHALL 在左上角显示 sector 搜索框
- **并且** 搜索框与左下角 `Scale` 面板形成对称布局

#### Scenario: 候选列表弹出方向
- **前提** 用户聚焦搜索框并产生候选结果
- **当** 系统展示候选列表
- **那么** 候选列表 SHALL 从搜索框下方向下弹出
- **并且** 不采用向右弹出的布局

### Requirement: Sector Search Matching Rules
系统 MUST 支持按 sector 名称与当前语言显示名搜索，并限制 id 匹配只用于 `cluster + 完整数字` 形式。

#### Scenario: 按 name 搜索
- **前提** 存在 sector，其 `name` 可与输入文本匹配
- **当** 用户输入普通搜索文本
- **那么** 系统 SHALL 返回对应 sector 候选

#### Scenario: 非英文 locale 按 localeName 搜索
- **前提** 当前 locale 不是 `en`
- **并且** 存在 sector 的当前语言显示名可与输入文本匹配
- **当** 用户输入该显示名文本
- **那么** 系统 SHALL 返回对应 sector 候选

#### Scenario: 英文 locale 仅按 name 搜索
- **前提** 当前 locale 为 `en`
- **当** 用户执行搜索
- **那么** 系统 SHALL 仅按 `name` 规则搜索
- **并且** SHALL 不额外增加独立的 `localeName` 搜索分支

#### Scenario: cluster id 完整数字匹配
- **前提** 存在 cluster id 为 `cluster_01`
- **当** 用户输入 `cluster 01`
- **那么** 系统 SHALL 允许该输入作为 id 搜索条件
- **并且** SHALL 命中 `cluster_01`

#### Scenario: cluster id 不允许前缀误命中
- **前提** 同时存在 `cluster_01` 与 `cluster_011`
- **当** 用户输入 `cluster 01`
- **那么** 系统 SHALL 不命中 `cluster_011`

#### Scenario: sector 前缀不参与 id 匹配
- **前提** 用户输入 `sector` 或 `sector + 数字`
- **当** 系统解析搜索条件
- **那么** 系统 SHALL 不将该输入视为 id 匹配条件
- **并且** 仅按 `name` 或 `localeName` 规则继续搜索

### Requirement: Search Result Highlight Policy
系统 MUST 按命中数量决定是否在地图中批量高亮 sector。

#### Scenario: 少量结果触发批量高亮
- **前提** 当前搜索结果数量小于 `10`
- **当** 地图渲染搜索结果态
- **那么** 系统 SHALL 高亮全部命中的 sector

#### Scenario: 大量结果不触发批量高亮
- **前提** 当前搜索结果数量大于等于 `10`
- **当** 地图渲染搜索结果态
- **那么** 系统 SHALL 不执行地图批量高亮
- **并且** SHALL 继续展示候选列表供用户选择

### Requirement: Candidate Selection Focus Behavior
系统 MUST 在用户点击候选后校正缩放并聚焦目标 sector。

#### Scenario: 低于 100% 时先抬升缩放
- **前提** 用户点击某个 sector 候选
- **并且** 当前地图 `scale < 100%`
- **当** 系统处理候选选择
- **那么** 系统 SHALL 先将地图缩放调整到 `100%`
- **并且** 随后聚焦目标 sector

#### Scenario: 高于等于 100% 时保持当前缩放
- **前提** 用户点击某个 sector 候选
- **并且** 当前地图 `scale >= 100%`
- **当** 系统处理候选选择
- **那么** 系统 SHALL 保持当前缩放不变
- **并且** 聚焦目标 sector

#### Scenario: 选中后保持明确选中态
- **前提** 用户已点击某个候选
- **当** 地图完成聚焦
- **那么** 系统 SHALL 为该 sector 保持明确的选中/高亮状态

#### Scenario: 选中后不改写搜索框输入
- **前提** 搜索框中已有用户输入
- **当** 用户点击某个候选
- **那么** 系统 SHALL 保持搜索框原始输入内容不变

#### Scenario: 选中后搜索框失焦
- **前提** 搜索框当前处于 focus 状态
- **当** 用户点击某个候选
- **那么** 系统 SHALL 关闭候选列表
- **并且** SHALL 让搜索框失焦

#### Scenario: 多结果时不自动聚焦首项
- **前提** 搜索返回多个结果
- **并且** 用户尚未点击候选
- **当** 地图展示搜索结果
- **那么** 系统 SHALL 不自动聚焦第一个结果

### Requirement: Search Clear Behavior
系统 MUST 在清空搜索时只清除搜索相关状态，不重置地图视图。

#### Scenario: 清空搜索回收高亮与选中态
- **前提** 当前存在搜索高亮或搜索选中态
- **当** 用户清空搜索框
- **那么** 系统 SHALL 清除搜索高亮
- **并且** SHALL 清除搜索选中态

#### Scenario: 清空搜索不重置视图
- **前提** 用户已对地图执行缩放或平移
- **当** 用户清空搜索框
- **那么** 系统 SHALL 保持当前地图缩放值不变
- **并且** SHALL 保持当前地图平移位置不变

### Requirement: Result Item Display Rules
系统 MUST 按当前语言与命中类型控制候选项的主显示与附加显示内容。

#### Scenario: 英文环境主显示 name
- **前提** 当前 locale 为 `en`
- **当** 系统渲染候选项
- **那么** 系统 SHALL 使用 `name` 作为主显示文本

#### Scenario: 非英文环境主显示 localeName
- **前提** 当前 locale 不是 `en`
- **当** 系统渲染候选项
- **那么** 系统 SHALL 使用当前语言的 `localeName` 作为主显示文本

#### Scenario: id 命中显示 sectorId
- **前提** 某个候选项由 `id` 规则命中
- **当** 系统渲染该候选项
- **那么** 系统 SHALL 额外显示 `sectorId`

#### Scenario: 非英文环境 name 命中显示原始 name
- **前提** 当前 locale 不是 `en`
- **并且** 某个候选项由 `name` 规则命中
- **当** 系统渲染该候选项
- **那么** 系统 SHALL 额外显示原始 `name`

#### Scenario: 英文环境 name 命中不显示重复附加文本
- **前提** 当前 locale 为 `en`
- **并且** 某个候选项由 `name` 规则命中
- **当** 系统渲染该候选项
- **那么** 系统 SHALL 不额外显示重复的 `name` 文本

#### Scenario: localeName 命中不显示附加文本
- **前提** 某个候选项由 `localeName` 规则命中
- **当** 系统渲染该候选项
- **那么** 系统 SHALL 不额外显示 secondary text

#### Scenario: id 命中时加宽候选列表
- **前提** 当前候选列表中存在 `id` 命中项
- **当** 系统渲染候选列表
- **那么** 系统 SHALL 增大候选列表宽度
- **并且** SHALL 尽量保证主显示名称完整可见
