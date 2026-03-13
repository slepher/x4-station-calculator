# x4-map-tooltip 设计说明

## 设计目标
为 `MapWorkbenchView` / `MapSvgCanvas` 增加一套 sector hover 详情 tooltip，在不改动现有地图主流程的前提下，为 sector 图元提供即时信息查看能力。该 tooltip 需要满足三个核心目标：
- 内容来自当前已存在地图数据，不引入新的数据源依赖
- 定位稳定，能够根据视口边缘自动避让
- 与搜索、资源筛选、选中、拖拽缩放等现有地图交互并存

## 1. 组件与职责分层

### 1.1 `MapSvgCanvas` 负责 hover 事件与几何锚点
- `MapSvgCanvas` 已经掌握 sector 图元的几何中心、半径和渲染数据，是最适合发出 sector hover 事件的位置。
- 该组件新增的职责应保持轻量：
  - 在 sector SVG 节点上接入 `mouseenter` / `mouseleave`
  - 产出 hovered sector 的基础信息
  - 产出 sector 的屏幕锚点或包围盒参考数据
- 不在 `MapSvgCanvas` 内直接渲染复杂 tooltip DOM，以避免把视图层浮层逻辑与 SVG 绘制耦合在一起。

### 1.2 `MapWorkbenchView` 负责 tooltip 单例状态与定位
- `MapWorkbenchView` 当前已经持有地图 viewport、缩放和平移状态，并负责地图外层 overlay UI。
- tooltip 适合作为 `MapWorkbenchView` 内的单例 HTML 浮层，由它统一管理：
  - 当前 hovered sector
  - tooltip 是否显示
  - tooltip 尺寸测量
  - 视口边界避让与最终定位
- 这样做可以直接复用 viewport 尺寸与容器边界信息，也避免为每个 sector 创建独立 tooltip 实例。

### 1.3 独立 tooltip 视图组件
- 建议新增一个 sector tooltip 视图组件，例如 `MapSectorTooltip.vue`，专门负责内容结构与样式。
- 该组件只接受结构化数据并输出面板，不承担位置计算。
- 这样可以让定位逻辑与内容渲染逻辑分离，后续如果补充 `Kha'ak` 区块也更容易扩展。

## 2. 数据组装设计

### 2.1 数据来源
- 基础 sector 数据继续来自 `maps.json`。
- sector 名称解析沿用当前地图里已有的 `resolveName` / i18n 翻译能力。
- 所属势力名称单独来自 `factions.json`：
  - 使用 sector 的 `owner` 作为 faction id
  - 查找对应 faction 的 `nameId`
  - 再通过当前游戏文本本地化解析 faction 显示名
- 不保留前端手写 owner 文案表，避免与游戏数据源重复维护。
- 资源颜色与丰度文案可复用资源筛选侧已经在使用的资源顺序和 yield 文案转换逻辑，避免 tooltip 与筛选面板出现两套资源命名规则。

### 2.2 tooltip 数据结构
- 进入 tooltip 组件前，建议在 workbench 层整理成统一 view model，至少包含：
  - `sectorId`
  - `title`
  - `ownerName`
  - `sunlightPercent`
  - `resources[]`
  - `anchorRect` 或等效定位锚点
- 其中 `ownerName` 应由 `factions.json` 的 `nameId` 解析结果提供，而不是直接使用 `owner` 原始 id。
- `resources[]` 中每个条目建议至少包含：
  - `wareId`
  - `label`
  - `yieldLabel`
  - `color`
- 资源列表按固定顺序输出，仅包含当前 sector 实际存在的资源。

### 2.3 留空区块处理
- `Potential Kha'ak Sources` 本次不提供内容，因此不应在设计上引入半成品推导逻辑。
- 最稳妥的做法是：
  - 第一版不渲染该区块
  - 或仅保留布局扩展位但默认不显示
- 为避免误导，推荐直接不渲染该区块。

## 3. 定位与边界避让设计

### 3.1 锚点与视口坐标系
- 地图内容当前放在带有 `transform: translate(...) scale(...)` 的 `map-content` 中。
- sector 几何数据本身已经是 SVG 内容坐标，因此 tooltip 定位需要最终落到 viewport 的 DOM 坐标系。
- 推荐由 `MapSvgCanvas` 提供 sector 的中心点或近似包围盒，再由 `MapWorkbenchView` 结合当前 transform 后的显示结果，计算 tooltip 相对于 `map-viewport` 的定位。

### 3.2 单例 tooltip 的象限选择
- tooltip 不做“跟随鼠标实时漂浮”，而是以 hovered sector 的锚点为中心，选择一个稳定象限弹出。
- 方向选择应采用分层优先级，而不是直接按某个斜角优先：
  - 默认先尝试下方
  - 下方不可用时，优先在上、下、左、右四个正交方向中选择可用方向
  - 仅当四个正交方向都无法完整容纳 tooltip 时，才继续尝试左上、右上、左下、右下四个斜角方向
- 每次显示前根据 tooltip 已测量尺寸与 viewport 剩余空间判断各方向是否可用。
- 若所有候选方向都存在不同程度溢出，则取溢出最小的方向，并再做边界钳制。

### 3.3 防裁切策略
- tooltip 最终位置应在 `map-viewport` 内进行 clamp。
- 需要同时考虑：
  - tooltip 面板宽高
  - 视口 padding
  - hovered sector 到 tooltip 的安全间距
- 这样即使 sector 靠近边缘，也能保证 tooltip 至少完整显示在视口内部。

## 4. 交互稳定性设计

### 4.1 hover 进入与离开
- sector `mouseenter` 时设置当前 hovered tooltip 数据。
- sector `mouseleave` 不应立即硬关闭，而应与 tooltip 本体 hover 状态协同，避免鼠标移动到 tooltip 上的瞬间闪烁消失。
- 可以用“sector hovered 或 tooltip hovered 任一为真则保持显示”的策略。

### 4.2 与拖拽缩放共存
- 当用户进行地图拖拽时，tooltip 可能需要隐藏或重新定位，避免浮层滞留在旧位置。
- 最简策略是：
  - 拖拽开始或 wheel 缩放时关闭 tooltip
- 这样能减少定位漂移带来的复杂性，也不会影响 tooltip 的核心价值。

### 4.3 与现有高亮和选中态共存
- tooltip 只是一种 hover 信息层，不应该改写 `selectedSectorId`。
- 搜索选中和资源筛选高亮优先级保持现状不变。
- 如需 hover 态视觉反馈，可以仅做轻量样式增强，避免与现有高亮颜色体系冲突。

## 5. 风险与对策
- 风险：SVG 坐标、CSS transform 与 viewport DOM 坐标换算不一致，导致 tooltip 偏移。
  - 对策：统一由 workbench 使用同一参考容器完成最终定位，并在实现中加入尺寸测量后再定位的流程。
- 风险：tooltip 在边缘或快速移动时闪烁。
  - 对策：引入 sector hover 与 tooltip hover 双状态协同，必要时加极短关闭延迟。
- 风险：资源命名、颜色和顺序与资源筛选面板不一致。
  - 对策：复用已有的资源顺序常量与 yield 文案映射逻辑，避免重复定义。
- 风险：缩放/拖拽后 tooltip 悬浮在旧位置，造成错位。
  - 对策：在拖拽与缩放过程中主动关闭 tooltip，等待下一次 hover 再重新计算。

## 6. 实现边界结论
- 本次设计选择“单例 HTML tooltip + SVG 事件上报 + workbench 统一定位”的方案。
- 不引入第三方 tooltip 定位库。
- 不实现移动端长按。
- 不实现 `Potential Kha'ak Sources` 内容推导。
- 不显示资源数值，只显示现有丰度文案。
