# poi-performance Tasks

## Phase 1: 存档侧栏解耦

### T1.1 解除缩放派生

- [x] `MapSaveCategoryMenu` 不再依赖 `isClusterOverview`
- [x] `MapSaveCoordList` 不再依赖 `isClusterOverview`
- [x] 验证未勾选 POI 时存档面板缩放不再明显卡顿

## Phase 2: save POI overlay 计算分流

### T2.1 拆分 overlay 源数据与显示层逻辑

- [x] `savePoiOverlays` 不再依赖 `isClusterOverview`
- [x] 总览态小图标剔除下放到 overlay 计算层

### T2.1a 保留大图标动态缩放语义

- [x] 小图标保持固定基准尺寸
- [x] 大图标在 `scale <= 0.5` 时达到 `1/2 cluster`
- [x] 大图标在 `scale = maxScale` 时回到基准尺寸
- [x] 中间区间保持平滑过渡

### T2.2 拆分实时视窗裁切与延迟 sector 裁切

- [x] 引入实时 `viewportContentBounds`
- [x] 引入延迟结算的 `sectorViewportContentBounds`
- [x] 修正拖动时新进入屏幕的恒常显示 POI 不应延迟出现

### T2.3 条件小图标按 overview 状态分流

- [x] `isClusterOverview = true` 时不计算命中 sector
- [x] `isClusterOverview = false` 时仅条件小图标走命中 sector
- [x] 大图标与恒常显示 POI 直接参与计算

## Phase 3: sectorMacro 索引

### T3.1 前移索引构建

- [x] 在 `useMapStore.initialize()` 预建 `sectorMacro` 索引
- [x] 暴露 `resolveSectorByMacro()` 供地图链消费
- [x] 保留无 store 注入测试场景的回退解析

## Phase 4: 验证与文档

### T4.1 性能回归验证

- [x] 验证拖动地图已明显顺滑
- [x] 验证缩放不再因存档 overlay 整份重建而出现原有级别卡顿

### T4.2 文档同步

- [x] 补充本 change 的 `request.md`
- [x] 补充本 change 的 `design.md`
- [x] 补充本 change 的 `tasks.md`
- [x] 增补受影响 feature 的 delta spec
