## Why

逻辑组网规划区存在三个用户体验问题：
1. 产线组标题无法自定义编辑，只能显示自动计算的产物名称
2. 鼠标悬停节点时无法直观看到完整的上下游依赖链路
3. 视图切换按钮位置分散，与语言选择器距离较远

## What Changes

- **产线组标题编辑**：在规划区产线组标题上添加编辑功能，UI 交互与 Toolbar 标题编辑一致（点击编辑、空值回退、失焦取消）
- **上下游高亮**：鼠标悬停节点时，同时高亮其上下游产线组容器及 SVG 连线，追踪至 T0 和 T3（能量电池除外）
- **视图切换位置调整**：将"量化生产/逻辑组网"视图切换按钮移动到语言选择器左边，紧贴语言选择区

## Capabilities

### New Capabilities
- `production-line-title-edit`: 产线组标题编辑功能，支持用户自定义标题并持久化
- `production-line-highlight-chain`: 产线组上下游高亮链路追踪功能

### Modified Capabilities
- `logical-flow-planner`: 新增标题编辑和上下游高亮交互需求
- `station-dashboard`: 视图切换按钮位置调整

## Impact

- **前端组件**：`ProductionLineGroup.vue`（标题编辑 + 高亮样式）、`StationToolbar.vue`（视图切换按钮位置）、`LogicFlowPlanningZone.vue`（高亮状态管理）
- **Store**：`useLogicFlowStore.ts`（添加 `customName` 字段、高亮状态追踪方法）
- **类型定义**：`ProductionLineGroup` 接口添加 `customName` 可选字段
