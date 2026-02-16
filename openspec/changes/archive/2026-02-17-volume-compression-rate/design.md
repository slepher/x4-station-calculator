## Context

在 X4 游戏的空间站规划中，仓储空间是有限资源。不同模块的生产效率不同，用户需要一个直观的指标来评估产线的体积效率。本设计文档描述如何在现有架构中添加体积压缩率计算和显示功能。

**当前架构**：
- `useGameDataStore.ts`：负责加载和预热游戏静态数据
- `FlowNode.vue`：显示产线节点，包含名称、状态标签等

**约束**：
- 压缩率数据应在初始化时预计算，避免运行时开销
- 显示逻辑应与现有 FlowNode 组件风格一致

## Goals / Non-Goals

**Goals:**
- 在 `useGameDataStore` 初始化时预计算每个模块的体积压缩率
- 在 FlowNode 组件底部 Subtitle 区域显示压缩率指标
- 提供直观的颜色编码（绿色=压缩，红色=膨胀）

**Non-Goals:**
- 不修改现有的模块数据结构
- 不影响其他视图或组件
- 不实现压缩率的排序或过滤功能

## Decisions

### D1: 数据存储方式

**决定**：使用独立的 `volumeCompressionMap: Record<string, number>` 存储压缩率

**理由**：
- 不污染现有的 `X4Module` 类型定义
- 便于按需查询，O(1) 时间复杂度
- 与现有的 `waresMap`、`modulesMap` 保持一致的模式

**替代方案**：
- 扩展 `X4Module` 类型添加 `volumeCompression` 字段 → 需要修改类型定义，影响范围更大
- 在组件中实时计算 → 每次渲染都需计算，性能开销

### D2: 计算时机

**决定**：在 `initialize()` 函数中，`buildModulesMap()` 之后调用 `buildVolumeCompressionMap()`

**理由**：
- 确保 `waresMap` 和 `modulesMap` 已准备就绪
- 一次性计算，后续无需重复
- 与语言切换无关，无需在 `changeLanguage()` 中重新计算

### D3: 忽略 energycells 的理由

**决定**：在消耗体积计算中忽略 `energycells`

**理由**：
- 太阳能是免费能源，不占用仓储空间（由太阳能板直接供应）
- 用户关注的是"实体资源"的体积效率
- 与游戏内实际仓储逻辑一致

### D4: 显示位置

**决定**：在 FlowNode 底部 Subtitle 区域显示，与 Race/Status 标签同行

**理由**：
- 不干扰主要信息（模块名称）的显示
- 与现有 UI 风格一致
- Subtitle 区域适合显示辅助指标

## Risks / Trade-offs

**风险**：模块数据更新时需要同步更新压缩率计算逻辑
→ **缓解**：压缩率计算逻辑封装在独立函数中，易于维护

**权衡**：预计算会增加初始化时间（约 1-2ms）
→ **接受**：对于一次性初始化，这个开销可忽略不计
