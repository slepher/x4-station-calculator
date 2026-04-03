# Map Refactory Specification

## Purpose

将当前集中在地图 SVG 容器组件中的多类职责拆分为地图域组件、组合式逻辑与纯工具模块，以提升可维护性、可测试性和局部修改安全性，同时保持现有地图行为与交互结果不变。

---

## ADDED Requirements

### Requirement: Map Rendering Module Boundary

地图 SVG 渲染实现 SHALL 按职责边界拆分，而不是继续集中在单一大型组件中。

#### Scenario: 地图容器仅负责组装

**前提** 地图 SVG 视图已完成重构
**当** 开发者查看 `MapSvgCanvas.vue`
**那么** 该组件仅负责接收 props、组合 composables、分发事件与组装图层组件
**并且** 不再直接内联主要几何算法、主要坐标换算算法与主要图层数据生成实现

#### Scenario: 图层组件只负责渲染

**前提** 地图 sector、link、overlay 图层已经拆分
**当** 开发者查看 `MapSectorLayer.vue`、`MapLinkLayer.vue`、`MapOverlayLayer.vue`
**那么** 每个图层组件只接收渲染所需 props
**并且** 只负责 SVG 模板输出
**并且** 不直接依赖顶层业务状态源

---

### Requirement: Map Domain Directory Layout

地图相关实现 SHALL 迁移到统一的地图域目录，而不是继续留在 `src/components/empire/` 下扩张。

#### Scenario: 地图组件目录归位

**当** 开发者查看地图组件目录
**那么** 地图组件位于 `src/components/map/`
**并且** 图层组件位于 `src/components/map/layers/`
**并且** 地图私有工具位于 `src/components/map/utils/`

#### Scenario: 组合式逻辑目录归位

**当** 开发者查看地图组合式逻辑
**那么** 地图 SVG 的布局、sector、links、overlays 逻辑位于 `src/composables/`
**并且** 文件名使用 `useMapSvg*` 约定

---

### Requirement: Pure Geometry And Coordinate Utilities

地图中的纯数学、纯坐标换算与纯样式映射 SHALL 从容器组件中抽离为独立纯工具模块。

#### Scenario: geometry 工具独立存在

**当** 开发者查看 `geometry.ts`
**那么** 其中包含 hex 顶点生成、world-to-screen fit、cluster 半径推导、polyline clip 与 spline 路径生成相关纯函数
**并且** 这些函数不依赖组件实例、props 或 emit

#### Scenario: coordinates 工具独立存在

**当** 开发者查看 `coordinates.ts`
**那么** 其中包含 sector ratio、cluster ratio、screen coordinate 与 gate raw position 的换算函数
**并且** 这些函数不依赖 DOM 或响应式上下文

#### Scenario: style 工具独立存在

**当** 开发者查看 `style.ts`
**那么** 其中包含地图 POI 颜色、icon 资源映射、icon 尺寸规则与 faction color filter 相关纯函数
**并且** 这些函数不会闭包读取组件 props

---

### Requirement: Map Composable Separation

地图 SVG 的布局、sector 渲染数据、links 几何数据与 overlay 渲染数据 SHALL 分别由独立 composable 生成。

#### Scenario: layout composable 提供统一布局结果

**当** 容器组件需要 cluster 布局、canvas 尺寸与 clip 定义
**那么** 这些结果来自 `useMapSvgLayout.ts`
**并且** 包含 `layoutState`、`clipDefs`、`canvasWidth`、`canvasHeight` 与 `sectorLayouts`

#### Scenario: sector composable 提供 sector 图层数据

**当** 容器组件需要 sector polygon、cluster polygon、resource pie 与 badge 数据
**那么** 这些结果来自 `useMapSvgSectors.ts`
**并且** 该 composable 同时负责 sector visual state 计算

#### Scenario: links composable 提供连线图层数据

**当** 容器组件需要 sector links、highways、gates 与 cross-cluster gate lines
**那么** 这些结果来自 `useMapSvgLinks.ts`
**并且** links 几何逻辑不与 overlay 或 sector 视觉逻辑混杂

#### Scenario: overlays composable 提供覆盖物图层数据

**当** 容器组件需要 placement overlays、save poi overlays、preview overlay 与 faction color filters
**那么** 这些结果来自 `useMapSvgOverlays.ts`
**并且** 该 composable 不承担 SVG 模板渲染职责

---

### Requirement: Links Geometry Isolation

highway 与 gate 相关几何处理 SHALL 被隔离到专门的 composable 与工具中，以降低局部修改风险。

#### Scenario: highway clip/smoothing 改动局部化

**前提** 未来需要修复 highway 的 clip 或 smoothing 行为
**当** 开发者定位相关实现
**那么** 主要修改范围集中在 `useMapSvgLinks.ts` 及其依赖的 geometry 工具
**并且** 不需要跨越 sector、overlay 与容器模板的大段代码追踪

#### Scenario: gate 连线逻辑独立

**当** 开发者调整 cross-cluster gate 配对或 sector link 起止点计算
**那么** 修改范围集中在 links 相关模块
**并且** 不影响 overlay 与 sector 图层实现边界

---

### Requirement: Links Geometry Testability

links 核心几何逻辑 SHOULD 具备独立补充单元测试的边界。

#### Scenario: 为 links 添加单测

**当** 开发者为地图 links 逻辑编写单元测试
**那么** 能够直接针对 `useMapSvgLinks.ts` 或其 geometry 工具验证：
**并且** sector highway 入口/出口映射正确
**并且** clip 后可见链生成正确
**并且** clipped chain smoothing 输出正确
**并且** superhighway sector link 的 from/to zone 对齐正确

---

## MODIFIED Requirements

### Requirement: Map SVG Container Structure

地图 SVG 容器的结构由“单文件集中实现”调整为“容器 + composables + layers + utils”的职责分层结构。

#### Scenario: 容器组件结构更新

**前提** 系统已从旧结构迁移到新结构
**当** 开发者维护地图 SVG 渲染
**那么** 默认应在 composables、utils 或 layers 中定位对应职责
**并且** 不再将新的纯工具或新的大型渲染数据生成逻辑直接堆积回容器组件
