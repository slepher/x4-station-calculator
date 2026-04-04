# poi-performance Change Request

## 目标

降低地图在拖动与缩放时的 save POI 性能开销，尤其是存档面板开启后因 POI 参与计算、sector 命中裁切、以及存档分类派生导致的卡顿。

## 已确认方案（审核重点）

### POI 数据源与显示层解耦

- 存档侧栏的分类数量与坐标列表不再跟随地图缩放状态实时重算
- 地图上的 POI 是否显示，继续由地图显示层根据缩放与视窗规则决定
- “只有放大到一定程度才显示小点”的功能保留在地图 overlay 链中，不迁回侧栏数据派生

### 条件小图标裁切规则

- 条件小图标仅指 `npcStation`、`xenonStation`、`khaakStation` 中的非放大图标
- `isClusterOverview = true` 时，不再计算命中 sector，直接只计算当前会显示的 POI，条件小图标整体不参与
- `isClusterOverview = false` 时，大图标和其他恒常显示类 POI 直接参与计算，只有条件小图标才走“命中 sector”裁切

### 大图标动态缩放

- 小图标保持固定小尺寸
- 大图标按缩放动态变化
- `scale <= 0.5` 时，大图标目标达到 `1/2 cluster`
- `scale = maxScale` 时，大图标回到基准尺寸
- 中间区间平滑过渡
- 大图标动态缩放与条件小图标 overview 显隐规则同时生效，互不替代

### 拖动与缩放的视窗裁切

- 实时屏幕视窗裁切与延迟 sector 命中裁切分离
- 拖动或缩放过程中，屏幕内的大图标/恒常显示 POI 应立即出现
- 只有条件小图标使用延迟结算的 sector 视窗范围，避免在热路径中反复重算全部 sector 命中
- `isClusterOverview = true` 时无需计算命中 sector
- `isClusterOverview = false` 时命中 sector 计算需要延迟结算，不跟每次缩放/拖动瞬时同步

### sectorMacro 解析索引

- `sectorMacro -> { clusterId, sectorId, sector }` 索引应在地图 store 初始化阶段预建
- 热路径中的 POI 投影、列表补全、owner override 等场景优先使用该索引
- 测试或无 store 注入场景允许回退到纯函数解析

### 存档 overlay 数据派生

- `savePoiOverlays` 不再依赖 `isClusterOverview`
- 缩放过程中不应因 overview 状态而整份重建 overlay 源数据
- overlay 源数据仅依赖存档、勾选类别与“剔除条件小站点”开关

## 边界

### In Scope

- save POI 地图 overlay 的性能优化
- 存档侧栏分类/坐标列表与缩放解耦
- 条件小图标的显示、裁切与 sector 命中规则
- `sectorMacro` 索引化
- 拖动/缩放时的 POI 参与计算路径优化

### Out of Scope

- 地图资源面板自身的渲染优化
- 非 save POI 的全局 Vue 渲染性能治理
- 重新设计 POI 图标视觉样式

## 验收标准（DoD）

1. 仅打开存档面板但不勾选任何 POI 类别时，缩放不再因侧栏分类/列表派生产生明显卡顿
2. 拖动地图时，屏幕内的大图标或恒常显示 POI 不再延迟到拖动结束才出现
3. `isClusterOverview = true` 时，条件小图标不参与 sector 命中计算
4. `isClusterOverview = false` 时，仅条件小图标参与 sector 命中裁切，大图标直接参与计算
5. `sectorMacro` 解析不再在热路径中重复全量遍历 `clusters -> sectors`
6. 缩放时 `savePoiOverlays` 不因 `isClusterOverview` 变化而整份重建
7. 大图标在 `scale <= 0.5` 时达到 `1/2 cluster`，并在 `scale = maxScale` 时回到基准尺寸

## 未决项

- 是否继续针对 `MapWorkbenchView`/资源面板做组件级渲染隔离，降低 pointermove 时的 Vue `_sfc_render` 扇出
