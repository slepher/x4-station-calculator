# x4-map-tooltip 需求说明

## 目标
为 map 页面增加 sector hover 详情 tooltip，让用户在桌面端将鼠标悬停到星区时，可以直接查看该星区的基础资源信息，而不必先通过搜索或筛选进入其他交互。

tooltip 需要优先保障信息可读性与边界避让稳定性：内容使用当前 UI 语言显示，浮出方向应根据可用空间自动调整，避免被地图视口裁切。

## 已确认方案（审核重点）

### 1. 触发方式与适用范围
- 触发对象是地图中的 sector 六边形区域。
- 仅在桌面端提供 hover tooltip。
- 搜索候选列表、资源筛选候选列表、以及其他非地图 sector 元素不属于本次 tooltip 入口。

### 2. tooltip 展示内容
- tooltip 顶部显示 sector 名称。
- tooltip 顶部同时显示所属势力名称。
- tooltip 显示 sunlight。
- tooltip 显示资源列表。
- 资源列表按固定顺序展示。
- 每个资源项显示：
  - 资源名称
  - 当前资源丰度文案
  - 资源颜色块
- 本次不显示资源数值。
- `Potential Kha'ak Sources` 区块本次留空，不提供内容。

### 3. 数据来源与文案规则
- tooltip 内容使用当前地图数据源中已存在的信息。
- 所属势力名称不使用前端手写映射。
- 所属势力名称必须通过 sector 的 `owner` 作为 faction id，在 `factions.json` 中找到对应记录后，使用其 `nameId` 解析为当前语言文本。
- `owner` 视为一定能在 `factions.json` 中命中，不需要 fallback。
- 资源丰度使用当前数据中的 yield / 丰度档位，不额外推导新数值。
- 文案随当前 UI 语言切换。
- 若 sector 不包含某种资源，则不显示该资源行。

### 4. 定位与边界避让
- tooltip 采用浮层方式显示，不嵌入 sector 图元内部。
- tooltip 需要根据 sector 在视口中的位置自动选择弹出方向。
- 默认优先尝试下方弹出。
- 在下方空间不足时，优先在上、下、左、右四个正交方向内选择可用方向。
- 仅当上、下、左、右四个方向都无法完整容纳 tooltip 时，才继续尝试左上、右上、左下、右下四个斜角方向。
- 例如位于右下角且正交方向空间都不足的 sector，应允许向左上方向弹出。

### 5. 交互稳定性
- tooltip 不应破坏现有地图搜索、资源筛选高亮、点击聚焦与拖拽缩放行为。
- 鼠标从 sector 移动到 tooltip 本体时，tooltip 保持显示，避免闪烁。
- tooltip 关闭后，不引入新的选中态或持久状态。

## 边界

### In Scope
- map 页面 sector hover tooltip 的显示与隐藏。
- tooltip 的内容组装与当前语言显示。
- tooltip 的固定资源顺序与资源丰度文案显示。
- tooltip 的边界避让与自动弹出方向选择。
- 保持 tooltip 与现有地图交互共存。

### Out of Scope
- 移动端长按、点击替代交互。
- `Potential Kha'ak Sources` 的算法、数据推导与展示内容。
- 在 tooltip 中显示资源精确数值。
- 修改地图底层数据结构。
- 重新设计 map 页其他 UI 面板样式或布局。

## 验收标准（DoD）
- 桌面端鼠标 hover 到地图 sector 六边形时，会显示该 sector 的详情 tooltip。
- tooltip 显示当前 UI 语言下的 sector 名称、所属势力、sunlight 与资源列表。
- 所属势力名称来自 `factions.json` 中对应 faction 的 `nameId` 解析结果，而不是前端手写翻译表。
- 资源列表按固定顺序展示，且每项显示资源名、丰度文案与颜色块。
- tooltip 不显示资源数值。
- 缺失的资源不会显示空白占位行。
- tooltip 会根据视口边缘自动调整弹出方向，避免被地图视口裁切。
- tooltip 方向选择优先级为：默认下方，其次上/下/左/右，最后才是左上/右上/左下/右下。
- 位于右下区域且正交方向空间不足的 sector，其 tooltip 可以向左上等斜角可用方向弹出。
- 鼠标从 sector 移到 tooltip 本体时，tooltip 不会立刻闪烁消失。
- 启用 tooltip 后，地图搜索、资源筛选高亮、点击聚焦、拖拽和平移缩放行为保持可用。
- `Potential Kha'ak Sources` 本次不显示内容，也不阻塞 tooltip 主体上线。

## 未决项
无。
