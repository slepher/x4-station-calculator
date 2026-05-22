# poi-performance Specification

## Purpose
TBD - created by archiving change poi-performance. Update Purpose after archive.
## Requirements
### Requirement: Save Sidebar Decoupled From Zoom

存档侧栏的分类数量与坐标列表 MUST NOT 因地图缩放状态变化而实时重算。

#### Scenario: save 分类数量不跟 overview 变化

- **前提** 用户已打开存档面板分类页
- **并且** 当前地图正在缩放
- **当** overview 状态在缩放过程中变化
- **那么** 侧栏分类数量 SHALL NOT 因该状态变化而重新派生整份存档 POI 分类数据

#### Scenario: save 坐标列表不跟 overview 变化

- **前提** 用户已打开某个存档 POI 分类的坐标列表
- **当** 地图正在缩放
- **那么** 坐标列表 SHALL NOT 因 overview 状态变化而重新派生整份分类数据

### Requirement: Save Overlay Source Stability

地图 save POI overlay 源数据 MUST NOT 依赖 `isClusterOverview`。

#### Scenario: 缩放过程中 overlay 源数组不因 overview 重建

- **前提** 用户已勾选若干 save POI 类别
- **当** 地图缩放导致 `isClusterOverview` 变化
- **那么** 系统 SHALL NOT 因该状态变化而重新 flatten 整份 overlay 源数据

### Requirement: Conditional Small Icon Sector Culling

条件小图标的 sector 命中裁切 MUST 仅在需要时参与。

#### Scenario: 总览态不计算命中 sector

- **前提** 当前处于 `isClusterOverview = true`
- **当** 地图计算 save POI 显示集合
- **那么** 条件小图标 SHALL 直接不参与计算
- **并且** 系统 SHALL NOT 为它们执行 sector 命中裁切

#### Scenario: 非总览态仅小图标命中 sector

- **前提** 当前处于 `isClusterOverview = false`
- **当** 地图计算 save POI 显示集合
- **那么** 大图标与恒常显示类 POI SHALL 直接参与计算
- **并且** 只有条件小图标 SHALL 进入 sector 命中裁切链

### Requirement: Large Icon Dynamic Scaling

大图标 MUST 保留动态缩放语义，小图标 MUST 保持固定基准尺寸。

#### Scenario: scale 小于等于 0.5 时大图标达到半个 cluster

- **前提** 当前 POI 属于放大图标类别
- **当** 地图缩放满足 `scale <= 0.5`
- **那么** 系统 SHALL 使该大图标目标达到 `1/2 cluster`

#### Scenario: 最大缩放时大图标回到基准尺寸

- **前提** 当前 POI 属于放大图标类别
- **当** 地图缩放达到 `maxScale`
- **那么** 系统 SHALL 使该大图标回到基准尺寸

#### Scenario: 中间缩放区间平滑过渡

- **前提** 当前 POI 属于放大图标类别
- **并且** 当前缩放位于 `0.5 < scale < maxScale`
- **当** 系统计算该图标尺寸
- **那么** 图标尺寸 SHALL 在上述两个锚点之间平滑过渡

### Requirement: Split Live Viewport And Settled Sector Bounds

地图 MUST 将实时屏幕裁切与延迟 sector 命中裁切分离。

#### Scenario: 拖动时恒常显示 POI 立即出现

- **前提** 用户正在拖动地图
- **当** 某个大图标或恒常显示类 POI 进入当前屏幕视窗
- **那么** 该 POI SHALL 立即参与实时屏幕裁切并显示
- **并且** SHALL NOT 等待拖动结束才出现

#### Scenario: 条件小图标使用延迟 sector 视窗范围

- **前提** 当前存在需要命中 sector 的条件小图标
- **当** 用户持续拖动或缩放地图
- **那么** 系统 SHALL 使用延迟结算的 sector 视窗范围参与命中裁切
- **并且** SHALL NOT 在每次瞬时位移或缩放变化时重算全部 sector 命中

### Requirement: Prebuilt Sector Macro Index

系统 MUST 在地图 store 初始化阶段预建 `sectorMacro` 索引供热路径使用。

#### Scenario: 初始化时建立 sectorMacro 索引

- **前提** 地图数据已加载
- **当** `useMapStore.initialize()` 执行
- **那么** 系统 SHALL 建立 `sectorMacro -> { clusterId, sectorId, sector }` 的索引

#### Scenario: 热路径优先使用 store 索引

- **前提** save POI overlay、存档列表或 owner override 需要按 macro 解析 sector
- **当** 这些路径执行解析
- **那么** 系统 SHALL 优先使用 store 中已建立的索引
- **并且** SHALL NOT 在热路径中反复全量遍历 `clusters -> sectors`

