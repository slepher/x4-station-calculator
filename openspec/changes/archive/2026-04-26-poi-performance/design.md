# poi-performance Design

## Architecture

本次性能优化围绕 save POI 链路分三层收口：

1. 存档侧栏层：分类数量与坐标列表不再绑定缩放状态。
2. POI overlay 计算层：把“实时视窗裁切”和“延迟 sector 命中裁切”拆开，并按 POI 类型分流。
3. 图标尺寸层：保留大图标动态缩放，但使其与小图标裁切规则分离。
4. 地图索引层：将 `sectorMacro` 解析前移到 `useMapStore.initialize()`，避免热路径重复遍历地图结构。

## Decisions

### D1: 存档侧栏与缩放状态解耦

**决策**：`MapSaveCategoryMenu` 与 `MapSaveCoordList` 不再接收 `isClusterOverview` 作为数据派生输入。

**理由**：

- 侧栏统计与坐标列表不需要在滚轮缩放时实时反映地图 overview 状态
- 将其与缩放绑定会导致每次缩放都重跑整份 `SavePoiCategoryDataMap`
- 这类重算对地图交互无帮助，但会直接拖慢滚轮性能

### D2: overlay 源数据不依赖 overview

**决策**：`savePoiOverlays` 只依赖当前存档、可见类别和剔除开关，不再依赖 `isClusterOverview`。

**理由**：

- `isClusterOverview` 属于显示层状态，不应驱动 overlay 源数组整份重建
- overview 变化应在 overlay 计算层决定“哪些点要画”，而不是重新 flatten 一遍源数据

### D3: 条件小图标按两段规则计算

**决策**：

- `isClusterOverview = true`：只计算当前会显示的 POI，条件小图标整体排除
- `isClusterOverview = false`：大图标/恒常显示类 POI 直接参与计算，只有条件小图标走命中 sector 裁切

**理由**：

- 大图标与恒常显示类 POI 不需要 sector 命中前置过滤
- 只有条件小图标才需要 expensive 的 sector 级可见性裁切
- 把这两类 POI 分流后，可以明显减少热路径中的无意义计算

### D4: 屏幕视窗裁切与 sector 命中裁切拆分

**决策**：

- `viewportContentBounds` 继续使用实时 `live` 视窗范围
- `sectorViewportContentBounds` 使用延迟结算的 settled 视窗范围，仅供 sector 命中裁切使用

**理由**：

- 若直接冻结整个 POI 视窗范围，会导致新进入屏幕的大图标/恒常显示 POI 延迟到拖动结束才出现
- 实时屏幕裁切负责“点什么时候出现在屏幕上”
- 延迟 sector 命中裁切负责“条件小图标何时参与 expensive 计算”

### D5: `sectorMacro` 索引前移到 store 初始化

**决策**：在 `useMapStore.initialize()` 中预建 `sectorMacro` 索引，并提供 `resolveSectorByMacro()` 供地图热路径直接使用。

**理由**：

- `resolveMapSectorByMacro` 在 profile 中表现为热路径热点
- 这类静态映射应在初始化时建立，而不是在拖动/缩放阶段反复遍历 `clusters -> sectors`

### D6: 保留大图标动态缩放语义

**决策**：

- 小图标保持固定基准尺寸
- 大图标继续按缩放动态变化
- `scale <= 0.5` 时，大图标目标达到 `1/2 cluster`
- `scale = maxScale` 时，大图标回到基准尺寸
- 中间区间平滑过渡

**理由**：

- 大图标动态缩放属于已确认的地图显示语义，不能在性能优化过程中被意外抹掉
- 性能优化应只减少不必要的热路径计算，不改变既有的大图标信息层级表达

## Affected Artifacts

### 存档侧栏

- `src/components/map/MapSavePanel.vue`
- `src/components/map/MapSaveCategoryMenu.vue`
- `src/components/map/MapSaveCoordList.vue`

### overlay 与地图交互

- `src/components/map/MapWorkbenchView.vue`
- `src/components/map/MapSvgCanvas.vue`
- `src/composables/useMapSvgOverlays.ts`
- `src/components/map/utils/style.ts`

### 地图索引

- `src/store/useMapStore.ts`
- `src/components/map/mapSectorMacro.ts`
- `src/App.vue`

## Risks

### R1: HMR 下 store 形状不一致

新增 `useMapStore.resolveSectorByMacro()` 后，开发态热更新期间可能出现旧 store 实例没有新方法的情况，因此调用点需要有回退策略。

### R2: 日志与调试链污染 profile

若将调试日志直接绑定到渲染关键 computed，profile 可能被日志本身放大，因此调试逻辑需要避免额外强制访问主渲染链。
