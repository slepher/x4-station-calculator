# map-search 设计说明

## 设计目标
为 `MapWorkbenchView` / `MapSvgCanvas` 增加一套与空间站界面同模式的搜索交互，但保持地图页的独立行为边界：
- 搜索对象仅限 `sector`
- 候选列表只负责查找与选择
- 地图负责批量高亮、单项选中、缩放校正与视口聚焦

## 1. UI 设计

### 1.1 搜索框布局
- 在 `MapWorkbenchView` 左上角增加搜索面板。
- 样式层级与左下角 `zoom-panel` 对称，均以绝对定位覆盖在地图视口上方。
- 搜索结果列表采用下拉方式展开，避免复用空间站模块搜索的右侧弹出定位。

### 1.2 搜索交互分层
- 搜索输入框负责维护：输入值、聚焦态、候选显示态。
- 候选列表负责展示 sector 主标签与按命中类型决定的辅助识别信息：
  - `en` 下主显示 `name`
  - 非 `en` 下主显示 `localeName`
  - `id` 命中时显示 `sectorId`
  - 非 `en` 且 `name` 命中时显示原始 `name`
  - 英文环境 `name` 命中、以及 `localeName` 命中时不显示附加文本
- 当候选列表中包含 `id` 命中项时，列表宽度需要放大，避免主显示名称被右侧 id 过度挤压。
- 地图图元负责根据当前搜索状态区分：
  - 批量命中高亮
  - 单项选中高亮
  - 非命中常态

## 2. 数据与匹配设计

### 2.1 可搜索索引
- 基于 `maps.json` 当前已渲染的 cluster/sector 数据，构造一份扁平 `sectorSearchItems`。
- 每个 item 至少包含：
  - `sectorId`
  - `clusterId`
  - `name`
  - `displayName`（当前 locale 下解析后的显示名）
  - 可用于聚焦的几何中心信息
- 该索引与地图渲染共享同一份底层数据，避免出现搜索命中对象与绘制对象不一致。

### 2.2 匹配策略
- 普通文本优先走 `name/displayName` 的大小写不敏感包含匹配。
- 当 locale 为 `en` 时，只按 `name` 搜索，主显示也使用 `name`，不再额外跑 `localeName` 分支。
- `id` 匹配单独走受限解析：
  - 仅当输入满足 `cluster + 完整数字` 结构时启用
  - 将输入标准化后与 cluster id 做完整编号比对
  - 禁止 `sector + 数字` 走 id 匹配
- 最终搜索结果仍然落到 sector 维度，因为 UI 高亮和聚焦的对象是 sector。

### 2.3 cluster id 到 sector 结果映射
- 因为 id 搜索只开放 `cluster + 数字`，而地图最终操作对象是 sector，所以 cluster 命中后需要展开为该 cluster 下的 sector 结果。
- 这样可以同时满足：
  - 输入 `cluster 01` 能得到结果
  - 下拉项仍是可点击的 sector
  - 地图高亮与 focus 都继续以 sector 为单位执行

## 3. 地图联动设计

### 3.1 小结果集高亮
- 当过滤结果数 `< 10` 时，将命中的 `sectorId` 集合传给地图渲染层。
- `MapSvgCanvas` 根据集合为对应 sector 添加搜索高亮视觉态。
- 当结果数 `>= 10` 时，搜索高亮集合为空，只保留候选列表。

### 3.2 单项选中与聚焦
- 用户点击候选后，记录 `selectedSearchSectorId`。
- 地图层对 `selectedSearchSectorId` 使用高优先级样式，覆盖普通批量高亮态。
- `MapWorkbenchView` 负责根据目标 sector 的几何中心计算 pan 偏移，使其尽量进入视口中心。
- 候选点击后不改写搜索框原始输入值。
- 候选点击后主动使搜索框失焦，并关闭候选列表。

### 3.3 缩放校正
- 当前缩放体系内部使用相对缩放值，但用户规则以 `100%` 为阈值。
- 设计上需要提供一个“目标显示百分比到内部 scale”的转换入口。
- 候选点击时执行：
  - 若显示百分比 `< 100%`，先切到 `100%`
  - 再基于最终 scale 计算目标 pan
- 若已不小于 `100%`，直接用当前 scale 做聚焦计算。

## 4. 状态设计
- `searchQuery`: 当前输入值
- `isSearchFocused`: 搜索框聚焦态
- `searchResults`: 当前候选列表
- `searchResults.matchType`: 每个候选的命中来源（`name` / `localeName` / `id`）
- `highlightedSearchSectorIds`: 小结果集批量高亮集合
- `selectedSearchSectorId`: 用户已点击的单项结果
- 清空搜索时：
  - `searchQuery` -> 空
  - `searchResults` -> 空
  - `highlightedSearchSectorIds` -> 空
  - `selectedSearchSectorId` -> 空
  - `scale/pan` 保持原值

## 5. 风险与对策
- 风险：cluster id 搜索与 sector 结果维度不一致，导致交互语义混乱。
  - 对策：cluster 仅作为受限匹配入口，结果统一展开成 sector 项。
- 风险：地图几何中心未对外暴露，聚焦逻辑无法稳定复用。
  - 对策：从 `MapSvgCanvas` 产出的布局计算中同步导出 sector 中心信息给 workbench。
- 风险：批量高亮与单项选中样式冲突。
  - 对策：约定单项选中态优先级高于批量高亮态。
- 风险：清空搜索误触发地图复位。
  - 对策：将搜索状态清理与视图状态重置彻底解耦。
