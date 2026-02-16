## Context

当前逻辑组网规划区（Logic Flow Planner）已具备基础的产线组管理和节点可视化功能，但在用户交互层面存在以下不足：
- 产线组标题仅显示自动计算的产物名称，用户无法自定义
- 节点间的依赖关系通过 SVG 连线展示，但悬停时无法直观看到完整的上下游链路
- 视图切换按钮位于工具栏左侧，与语言选择器距离较远，布局不够紧凑

## Goals / Non-Goals

**Goals:**
- 实现产线组标题编辑功能，UI 交互与 Toolbar 标题编辑一致
- 实现上下游高亮链路追踪，从悬停节点追踪至 T0 和 T3
- 调整视图切换按钮位置，紧贴语言选择器

**Non-Goals:**
- 不改变现有的产线组数据结构核心逻辑
- 不实现跨规划区的依赖追踪（当前仅支持单规划区内的高亮）
- 不修改 SVG 连线的绘制算法

## Decisions

### D1: 产线组标题编辑数据模型

**决策**: 在 `ProductionLineGroup` 接口中添加 `customName?: string` 字段

**理由**: 
- 保持向后兼容，现有数据无需迁移
- `customName` 为空时显示自动计算的名称，有值时显示用户自定义值
- 与 `store.currentPlanName` 的设计模式一致

**替代方案**:
- 使用 `name` 字段直接覆盖：破坏现有自动命名逻辑
- 使用独立的 `userTitleMap` Map：增加复杂度，不必要

### D2: 上下游高亮实现方式

**决策**: 在 `useLogicFlowStore` 中添加高亮状态和方法

**实现要点**:
1. 添加 `hoveredNodeId: string | null` 状态
2. 添加 `highlightedNodeIds: Set<string>` 计算属性
3. 添加 `highlightedConnectionIds: Set<string>` 计算属性
4. 追踪算法：递归遍历上游/下游，排除能量电池

**高亮范围**:
- 上游追踪：从当前节点递归找到所有输入依赖，直到 T0
- 下游追踪：从当前节点找到所有消费该产物的节点，直到 T3
- 排除规则：能量电池不参与高亮链路

### D3: 高亮样式实现

**决策**: 使用 CSS class 切换，通过 Vue 响应式绑定

**样式定义**:
- 容器高亮：`ring-2 ring-blue-500/50 bg-blue-500/5`
- 连线高亮：`stroke-blue-400 stroke-width-2`（提高透明度和线宽）

### D4: 视图切换按钮位置

**决策**: 将视图切换按钮从 `StationToolbar.vue` 左侧移动到右侧，紧贴 `LanguageSelector`

**布局调整**:
- 原位置：`[视图切换] [按钮组] ... [标题] ... [MissingTranslate] [LanguageSelector]`
- 新位置：`[按钮组] ... [标题] ... [视图切换] [LanguageSelector]`

## Risks / Trade-offs

**R1: 高亮性能** → 使用 Set 数据结构存储高亮 ID，O(1) 查找复杂度
**R2: 标题编辑与自动命名冲突** → 用户编辑后标题固定，不再自动更新，符合用户预期
**R3: SVG 连线高亮渲染** → 通过 Vue 响应式更新 class，避免手动操作 DOM
