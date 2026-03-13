# Map Station Placement Specification

## Purpose
定义 map 页面中的空间站工作面板、当前 empire 对象放置、原始坐标保存，以及面板关闭后的可见性回收规则。

## ADDED Requirements

### Requirement: Map Station Placement Entry
系统 MUST 在 map 页面提供空间站工作入口，并以左侧工作面板形式承载对象放置能力。

#### Scenario: 默认入口位置
- **前提** 用户位于 map 页面
- **当** 页面完成渲染
- **那么** 系统 SHALL 在左下角显示“空间站 + 图标”的入口按钮
- **并且** 按钮 SHALL 使用文字 + 图标形式
- **并且** 其地图覆盖层级 SHALL 与现有地图入口控件一致

#### Scenario: 点击入口展开工作面板
- **前提** 用户位于 map 页面
- **并且** 空间站面板当前未展开
- **当** 用户点击空间站入口按钮
- **那么** 系统 SHALL 切换为左侧工作面板 + 地图布局
- **并且** 左侧工作面板 SHALL 显示当前 empire 的可放置对象列表

#### Scenario: 左侧工作面板按 empire sector 分组
- **前提** 空间站面板已打开
- **当** 用户查看面板内容
- **那么** 系统 SHALL 按 `activeEmpire.sectors` 的当前排序显示分组
- **并且** 每个分组 SHALL 列出对应 `sector transit` 与其下属 `station`
- **并且** `station.sectorId` 为空的对象 SHALL 显示在“未分配”分组

#### Scenario: 空间站面板内搜索与清空
- **前提** 空间站面板已打开
- **当** 用户在面板搜索框输入关键词
- **那么** 系统 SHALL 仅过滤空间站面板中的对象列表
- **并且** SHALL NOT 影响地图右上角星区搜索框
- **当** 用户点击搜索框清空入口
- **那么** 系统 SHALL 清空面板搜索内容并恢复未过滤列表

#### Scenario: 面板滚动与列表文案精简
- **前提** 空间站面板已打开
- **当** 用户查看列表内容
- **那么** 系统 SHALL 使用整个面板主体共享的统一滚动容器
- **并且** SHALL NOT 为分组分别创建独立滚动区域
- **并且** 列表项 SHALL NOT 显示 `station`、`sector transit`、`未放置` 这类状态字样
- **并且** 列表拖拽入口 SHALL 以拖动手柄呈现，而不是“拖动到地图”文案
- **并且** 列表项左侧对象图标 SHALL 与星图 overlay 使用同源 SVG 与接近尺寸

#### Scenario: 关闭面板时隐藏空间站相关内容
- **前提** 用户当前处于空间站工作态
- **当** 用户关闭空间站面板
- **那么** 系统 SHALL 隐藏地图上的空间站相关 overlay、预览与拖拽辅助内容
- **并且** 基础星图 sector 渲染 SHALL 保持可见

### Requirement: Station And Sector Transit Placement Sources
系统 MUST 将当前 empire 的 `stations` 与 `sectors` 作为 map 放置对象源。

#### Scenario: 面板展示当前 empire 对象
- **前提** 当前存在 `activeEmpire`
- **当** 空间站面板渲染
- **那么** 系统 SHALL 展示当前 empire 的全部 `stations`
- **并且** 系统 SHALL 展示当前 empire 的全部 `sectors`

#### Scenario: Sector object acts as transit placement
- **前提** 面板中存在 empire `sector`
- **当** 用户查看该对象的地图用途
- **那么** 系统 SHALL 将其解释为“星区中转点”
- **并且** 其放置目标 SHALL 为任意地图 sector

### Requirement: Drag To Map Sector And Save Raw Position
系统 MUST 支持将 `station` 或 `sector transit` 拖入目标地图 sector，并以原始坐标保存落点。

#### Scenario: 拖拽预览与 overlay 使用类型图标
- **前提** 用户正在拖拽或查看已放置对象
- **当** 系统渲染拖拽 ghost、拖拽预览或地图 overlay
- **那么** 普通 `station` SHALL 使用 `factory.svg`
- **并且** `station.type === shipyard` SHALL 使用 `shipyard.svg`
- **并且** `sector transit` SHALL 使用 `tradestation.svg`

#### Scenario: 拖入 station 到地图星区
- **前提** 当前 empire 中存在某个 `station`
- **当** 用户将该 `station` 拖入任意目标地图 sector
- **那么** 系统 SHALL 为该 `station` 写入 `location`
- **并且** `location.cluster_id` SHALL 等于目标地图 sector 所属 cluster id
- **并且** `location.sector_id` SHALL 等于目标地图 sector id

#### Scenario: 拖入 sector transit 到地图星区
- **前提** 当前 empire 中存在某个 `sector`
- **当** 用户将该 `sector` 作为中转点拖入任意目标地图 sector
- **那么** 系统 SHALL 为该 `sector` 写入 `location`
- **并且** `location.sector_id` SHALL 指向被放入的目标地图 sector id

#### Scenario: 保存原始坐标
- **前提** 用户在目标地图 sector 内完成拖放
- **当** 系统计算落点
- **那么** `location.pos` SHALL 保存原始 `{x, z}` 坐标
- **并且** 系统 SHALL NOT 持久化归一化比例坐标

### Requirement: Placement Metadata Snapshot
系统 MUST 在写入 `location` 时同步快照目标地图 sector 的环境信息。

#### Scenario: 写入 sunlight 与 resources
- **前提** 用户已将对象放入目标地图 sector
- **当** 系统生成 `location`
- **那么** `location.sunlight` SHALL 等于目标地图 sector 的 sunlight
- **并且** `location.resources` SHALL 等于目标地图 sector 资源的 ware id 列表
- **并且** `location.resources` SHALL 仅保存字符串数组

### Requirement: Placement Update And Clear
系统 MUST 支持已放置对象的再次微调与清除位置。

#### Scenario: 已放置对象继续微调
- **前提** 某个 `station` 或 `sector transit` 已有 `location`
- **并且** 空间站面板当前处于打开状态
- **当** 用户继续拖动该对象
- **那么** 系统 SHALL 更新既有 `location`
- **并且** SHALL NOT 创建重复对象

#### Scenario: 面板内清除位置
- **前提** 某个对象当前已有 `location`
- **当** 用户在空间站面板执行清除位置/取消放置
- **那么** 系统 SHALL 移除该对象的 `location`
- **并且** 该对象 SHALL 恢复为未放置状态

#### Scenario: 点击已放置对象时 focus 到对象自身 overlay
- **前提** 某个 `station` 或 `sector transit` 当前已有 `location`
- **并且** 空间站面板已打开
- **当** 用户点击该对象在面板分组中的列表项
- **那么** 系统 SHALL focus 到该对象自身的地图 overlay 落点
- **并且** 系统 SHALL 高亮该对象自身 overlay
- **并且** SHALL NOT 额外高亮目标地图星区
- **并且** 已放置项 SHALL 以 tag 形式显示目标地图星区的本地化名称
- **并且** 清除位置操作 SHALL 以内嵌小图标形式出现在该 tag 内
- **并且** SHALL NOT 显示 `sector_id` 与坐标
