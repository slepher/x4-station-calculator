## Context

### 当前状态

- EmpireStore 管理多个空间站的数据，但只提供基本的 CRUD 操作
- 每个空间站的流量分析由 `useStationStore` 在激活时计算
- 帝国总览界面显示 "Coming Soon" 占位符

### 约束

- 必须复用现有的 `analyzeWareFlow` 函数，避免重复计算逻辑
- 帝国视图不需要体积视图，只需数量和经济两个视图
- 需要保持与现有 `StationWareFlowsDashboard` 组件风格一致

## Goals / Non-Goals

**Goals:**
- 在 EmpireStore 中实现缓存机制，存储每个空间站的 `GroupedFlows`
- 实现帝国级数据聚合，按产品/运营/补给三组显示
- 创建 `EmpireWareFlowsDashboard` 组件，复用两级子模块结构
- 确保空间站更新时缓存同步更新

**Non-Goals:**
- 不实现体积视图（帝国层面暂不需要）
- 不修改现有的 `analyzeWareFlow` 函数
- 不实现帝国级的仓储规划计算

## Decisions

### Decision 1: 缓存存储位置

**选择**: 在 EmpireStore 中添加 `stationFlowCache: Map<stationId, GroupedFlows>`

**理由**:
- 缓存与数据源（EmpireStore）同生命周期
- 避免在 StationStore 中引入跨空间站依赖
- 便于在 EmpireStore 的 `updateStationModules` 中同步更新缓存

**替代方案**:
- 在 StationStore 中缓存：需要引入额外的空间站 ID 参数，增加复杂度
- 独立的缓存 Store：过度设计，增加维护成本

### Decision 2: 缓存更新策略

**选择**: 在 `updateStationModules` 中主动更新缓存

**理由**:
- 保证数据一致性，避免缓存过期
- 更新时只需重新计算单个空间站，性能开销小

**替代方案**:
- 懒加载 + TTL：增加复杂度，且可能导致首次访问延迟
- 全量重算：性能开销大，不必要

### Decision 3: 组件复用策略

**选择**: 创建独立的 `EmpireWareFlowsDashboard`、`EmpireWareFlowGroup`、`EmpireWareFlow` 组件

**理由**:
- 帝国视图的分组逻辑与空间站视图不同（3组 vs 4组）
- 明细需要显示空间站名称，数据结构不同
- 保持组件职责单一，避免过度抽象

**替代方案**:
- 通过 props 控制分组逻辑：增加组件复杂度，难以维护
- 共享基础组件：当前差异较小，不值得抽象

### Decision 4: 数据聚合函数位置

**选择**: 创建独立的 `analyzeEmpireWareFlow.ts` 文件

**理由**:
- 与现有的 `analyzeWareFlow.ts` 保持一致的代码组织
- 聚合逻辑独立于 Store，便于测试和复用

## Risks / Trade-offs

### Risk 1: 初始化性能

**风险**: 帝国初始化时需要为所有空间站执行流量分析，可能导致延迟。

**缓解**: 
- 使用异步初始化，不阻塞 UI
- 显示加载状态
- 未来可考虑 Web Worker 或增量加载

### Risk 2: 缓存一致性

**风险**: 如果空间站数据通过非 `updateStationModules` 方法修改，缓存可能不一致。

**缓解**: 
- 确保所有空间站修改都通过 `updateStationModules` 或 `updateStationSettings`
- 添加缓存失效检测机制（可选）

### Risk 3: 内存占用

**风险**: 大量空间站可能导致缓存占用较多内存。

**缓解**: 
- `GroupedFlows` 结构相对轻量
- 可在未来添加 LRU 缓存策略（如果需要）

## Migration Plan

### 部署步骤

1. 扩展 EmpireStore，添加缓存机制
2. 创建 `analyzeEmpireWareFlow.ts` 聚合函数
3. 创建帝国视图组件
4. 更新 `StationWorkbench.vue`，替换 "Coming Soon"

### 回滚策略

- 移除帝国视图组件，恢复 "Coming Soon" 占位符
- 移除 EmpireStore 中的缓存相关代码
