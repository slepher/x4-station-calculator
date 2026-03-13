# X4 Map Tooltip Specification

## Purpose
定义 map 页面 sector hover tooltip 的显示内容、定位避让与交互边界，确保用户能够在地图上直接查看 sector 基础信息且不会被视口裁切。

## ADDED Requirements

### Requirement: Sector Hover Tooltip Entry
系统 MUST 在 map 页面为 sector 图元提供桌面端 hover tooltip 入口。

#### Scenario: Hover 地图 sector 显示 tooltip
- **前提** 用户位于 map 页面桌面端视图
- **并且** 地图中的 sector 六边形已渲染
- **当** 用户将鼠标悬停在某个 sector 六边形上
- **那么** 系统 SHALL 显示该 sector 的详情 tooltip

#### Scenario: 非地图入口不触发 sector tooltip
- **前提** 页面存在搜索候选列表或资源筛选候选列表
- **当** 用户悬停这些非地图列表项
- **那么** 系统 SHALL 不将其视为 sector hover tooltip 的触发入口

### Requirement: Sector Tooltip Content
系统 MUST 在 tooltip 中显示当前 UI 语言下的 sector 基础信息，并只使用当前已有数据源中的资源丰度信息。

#### Scenario: 显示 sector 标题信息
- **前提** 某个 sector 存在名称与所属势力信息
- **当** 系统渲染 tooltip
- **那么** 系统 SHALL 显示 sector 名称
- **并且** SHALL 显示所属势力名称

#### Scenario: 所属势力名称来自 factions.json
- **前提** 某个 sector 的 `owner` 字段存在
- **并且** `owner` 对应的 faction 记录存在于 `factions.json`
- **当** 系统渲染 tooltip
- **那么** 系统 SHALL 使用 `owner` 作为 faction id 查找 `factions.json`
- **并且** SHALL 使用该 faction 的 `nameId` 解析当前语言下的所属势力名称
- **并且** SHALL 不使用前端手写 owner 名称映射

#### Scenario: 显示 sunlight
- **前提** 某个 sector 存在 sunlight 信息
- **当** 系统渲染 tooltip
- **那么** 系统 SHALL 显示该 sector 的 sunlight

#### Scenario: 显示固定顺序资源列表
- **前提** 某个 sector 存在资源数据
- **当** 系统渲染 tooltip
- **那么** 系统 SHALL 按固定顺序显示资源项

#### Scenario: 资源项显示名称、丰度和颜色
- **前提** 某个资源存在于 sector 资源列表中
- **当** 系统渲染该资源行
- **那么** 系统 SHALL 显示资源名称
- **并且** SHALL 显示该资源的丰度文案
- **并且** SHALL 显示资源颜色块

#### Scenario: 不显示资源数值
- **前提** 某个资源具有内部 level 或其他数值字段
- **当** 系统渲染 tooltip
- **那么** 系统 SHALL 不显示资源数值

#### Scenario: 不显示缺失资源占位
- **前提** 某个 sector 不包含某种资源
- **当** 系统渲染 tooltip
- **那么** 系统 SHALL 不为该资源显示空白占位行

#### Scenario: Kha'ak 区块留空
- **前提** 当前变更范围不包含 `Potential Kha'ak Sources` 数据
- **当** 系统渲染 tooltip
- **那么** 系统 SHALL 不要求展示该区块内容

### Requirement: Tooltip Localization
系统 MUST 使用当前 UI 语言渲染 tooltip 中的名称与丰度文案。

#### Scenario: 使用当前语言显示标题和资源文案
- **前提** 用户已切换当前 UI 语言
- **当** 系统渲染 sector tooltip
- **那么** 系统 SHALL 使用当前语言显示 sector 名称、所属势力、资源名称与丰度文案

### Requirement: Tooltip Placement And Overflow Avoidance
系统 MUST 根据 sector 在视口中的位置自动选择 tooltip 的弹出方向，避免 tooltip 被地图视口裁切。

#### Scenario: 默认优先向下弹出
- **前提** hovered sector 周围存在充足可用空间
- **当** 系统计算 tooltip 位置
- **那么** 系统 SHALL 优先使用下方显示 tooltip

#### Scenario: 正交方向优先于斜角方向
- **前提** hovered sector 下方空间不足
- **当** 系统计算 tooltip 位置
- **那么** 系统 SHALL 优先在上、下、左、右四个正交方向中选择可用方向
- **并且** SHALL 不在仍有可用正交方向时提前使用斜角方向

#### Scenario: 四个正交方向都不足时再使用斜角方向
- **前提** hovered sector 周围的上、下、左、右四个正交方向都无法完整容纳 tooltip
- **当** 系统计算 tooltip 位置
- **那么** 系统 SHALL 继续尝试左上、右上、左下、右下四个斜角方向

#### Scenario: 右下角 sector 在必要时向左上避让
- **前提** hovered sector 位于地图视口右下区域
- **并且** 上、下、左、右四个正交方向都无法完整容纳 tooltip
- **当** 系统计算 tooltip 位置
- **那么** 系统 SHALL 改用左上或其他可用斜角方向
- **并且** SHALL 避免 tooltip 被视口裁切

#### Scenario: tooltip 不超出视口
- **前提** tooltip 即将显示
- **当** 系统完成位置计算
- **那么** 系统 SHALL 将 tooltip 约束在地图视口可见范围内

### Requirement: Tooltip Interaction Stability
系统 MUST 保持 tooltip 与现有地图交互共存，并避免 hover 闪烁。

#### Scenario: 从 sector 移到 tooltip 时保持显示
- **前提** 用户已 hover 某个 sector，tooltip 当前可见
- **当** 用户将鼠标从 sector 移动到 tooltip 本体
- **那么** 系统 SHALL 保持 tooltip 显示

#### Scenario: tooltip 不引入持久选中态
- **前提** 用户结束 hover
- **当** tooltip 关闭
- **那么** 系统 SHALL 不新增持久 sector 选中状态

#### Scenario: tooltip 不破坏现有地图交互
- **前提** 页面已启用地图搜索、资源筛选高亮、点击聚焦与拖拽缩放
- **当** 系统增加 sector hover tooltip
- **那么** 系统 SHALL 保持这些既有交互可用
