# resource-pie 设计说明

## 设计目标
在不改变既有资源过滤判定、候选排序和高亮优先级的前提下，为 map 页面补上“多资源命中态可视化”。
核心目标不是新增一套筛选规则，而是把当前“命中了哪些 sector”升级为“这些命中 sector 应该如何按资源现状被渲染”。

## 1. 整体思路

### 1.1 从单色覆盖升级为 sector 级切片描述
- 当前链路是：
  - `MapResourceFilterPanel` 计算命中 sector
  - 向上游输出 `highlight-change`
  - 同时额外输出单一 `primary-color-change`
  - `MapWorkbenchView` 将该颜色下发给 `MapSvgCanvas`
- 该链路只能表达“所有命中 sector 共用一个内部填充色”，无法表达多资源切片。
- 本次改动要把资源过滤的表现层输出升级为：
  - 命中 sector id 列表
  - 每个命中 sector 对应的 `fill mode`
  - 当 `fill mode = pie` 时的切片数组

### 1.2 保留旧行为作为兼容分支
- 不需要把所有资源命中都强制改为饼图。
- 兼容分支定义如下：
  - 未激活资源过滤：沿用现有地图内部填充逻辑
  - 激活资源过滤但该 sector 只有一个参与染色项目：沿用单色填充
  - 激活资源过滤且该 sector 有多个普通资源参与：改为饼图填充
- 这样可以把渲染复杂度限制在真正需要多切片的场景。

## 2. 数据设计

### 2.1 面板输出结构
- 在 `MapResourceFilterPanel` 内部保留现有筛选状态与命中计算逻辑。
- 新增一个面向表现层的计算结果，例如：
  - `resourceVisualState = { highlightedSectorIds, sectorFillById }`
- `sectorFillById[sectorId]` 需要能表达两类结果：
  - `solid`: 单色填充
  - `pie`: 切片数组
- 切片元素至少需要包含：
  - `ware`
  - `color`
  - `share`，范围 `0 ~ 1`

### 2.2 参与染色资源集合
- 参与染色的普通资源集合来自当前已选资源 tag，但必须按固定 tag 顺序过滤后输出。
- `日光` 不进入普通资源切片集合。
- 若当前 sector 对应的普通资源参与集合非空，则直接忽略 `日光` 染色。
- 只有当普通资源参与集合为空且日光筛选有效时，才允许返回日光单色填充。
- 这里的“参与染色”与“用于过滤”不是完全同义：
  - 过滤命中仍由既有逻辑决定
  - 染色集合只负责描述命中 sector 应如何显示

### 2.3 切片份额归一化
- 设参与染色的普通资源数量为 `n`，每个资源最小显示份额为 `0.05`。
- 若 `n * 0.05 < 1`：
  - 先给每个资源分配 `0.05`
  - 剩余份额 `1 - n * 0.05` 按各资源 `level / totalLevel` 分配
- 若 `totalLevel <= 0`：
  - 先给每个资源分配 `0.05`
  - 剩余份额按均分方式稳定分配
- 由于本次参与染色的普通资源数上限受现有 tag 数量限制，`0.05` 的下限可稳定满足全部资源并存场景。
- 结果需要在输出前做一次归一化校正，确保所有 `share` 求和为 `1`，避免 SVG path 累计误差导致首尾缝隙。

## 3. 渲染设计

### 3.1 SVG 画布职责
- `MapWorkbenchView` 只做状态持有与透传，不负责几何计算。
- `MapSvgCanvas` 负责根据 sector 中心点、sector 半径和切片份额生成扇形 path。
- 渲染时仍然以现有 sector 六边形为主容器：
  - 六边形边框、label、glow、hover hit target 保持不变
  - 饼图仅替代 sector 内部 fill 的生成方式

### 3.2 切片绘制方式
- 对每个命中 sector：
  - 先拿到 sector 中心 `cx/cy`
  - 使用一个内接圆半径作为饼图半径
  - 基于累计角度生成 `M cx cy -> A ... -> Z` 形式的扇形 path
- 六边形裁切保持两种可选实现：
  - 方案 A：让扇形半径直接落在六边形内接圆内，不额外裁切
  - 方案 B：让扇形使用现有 sector clipPath 再做裁切
- 推荐方案 B：
  - 与现有 highway clip/sector clip 体系一致
  - 即使未来调整饼图半径，也不会越出六边形边界

### 3.3 样式优先级
- 资源饼图只在 `resource` 视觉状态下显示。
- `selected` 与 `search` 状态继续优先于 `resource`：
  - 这两种状态不需要额外画饼图覆盖主视觉
  - 否则会削弱“选中”和“搜索命中”的识别度
- 因此资源饼图的实际显示条件是：
  - 当前 sector 处于 `resource` 状态
  - 不处于 `selected` 或 `search` 主态

## 4. 组件职责拆分

### 4.1 MapResourceFilterPanel
- 继续拥有：
  - 资源 tag 选中状态
  - 最低丰度与日光输入
  - 命中 sector 计算
  - 候选排序
- 新增：
  - 根据命中 sector 生成 `sectorFillById`
  - 发出新的资源表现事件，替代只输出 `primary-color-change` 的单色接口

### 4.2 MapWorkbenchView
- 将资源过滤表现状态升级为：
  - `resourceHighlightedSectorIds`
  - `resourceSectorFillById`
- 保留搜索高亮与当前选中态逻辑不变。
- 关闭资源面板时继续只清理资源表现态，不清理面板配置。

### 4.3 MapSvgCanvas
- 保留：
  - sector layout
  - hover payload
  - search/resource/selected 优先级判定
- 新增：
  - 识别某个 sector 是否存在 `solid` 或 `pie` 染色描述
  - 在 polygon 之前或之后插入对应的 fill 图层
  - 对 `pie` 模式生成多个切片 path

## 5. 风险与对策

- 风险：份额算法在低 `level` 或零 `level` 场景下不稳定。
  - 对策：固定先分配 `5%` 保底，再做比例分配，并在末尾做归一化校正。
- 风险：多 sector cluster 与单 sector cluster 的渲染分支不同，容易遗漏一边。
  - 对策：将“根据 sector 几何信息生成 fill 图层”的逻辑抽成同一套 helper，在两个渲染分支共用。
- 风险：继续沿用单一 `primary color` 会导致新旧状态并存时语义冲突。
  - 对策：直接把资源表现层升级为 sector 级结构，单色仅作为其中一种 fill mode。
- 风险：搜索态仍显示饼图会削弱搜索高亮识别。
  - 对策：保持 `selected > search > resource`，仅在纯 `resource` 状态渲染饼图。
