## Context

### 当前状态

- EmpireStore 管理多个空间站的数据，但只提供基本的 CRUD 操作
- 每个空间站的流量分析由 `useStationStore` 在激活时计算
- 帝国总览界面显示 "Coming Soon" 占位符
- StationStore 通过 watch 将本地状态同步到 EmpireStore.activeStation

### 约束

- 必须复用现有的 `analyzeWareFlow` 函数，避免重复计算逻辑
- 帝国视图不需要体积视图，只需数量和经济两个视图
- 需要保持与现有 `StationWareFlowsDashboard` 组件风格一致
- 切换 tab 时不应该触发缓存重新计算

## Goals / Non-Goals

**Goals:**
- 在 EmpireStore 中实现缓存机制，存储每个空间站的 `GroupedFlows`
- 实现帝国级数据聚合，按产品/运营/补给三组显示
- 创建 `EmpireWareFlowsDashboard` 组件，复用两级子模块结构
- 确保空间站更新时缓存同步更新
- 确保切换 tab 时不触发缓存重新计算

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
- 便于在 EmpireStore 中统一管理缓存

**替代方案**:
- 在 StationStore 中缓存：需要引入额外的空间站 ID 参数，增加复杂度
- 独立的缓存 Store：过度设计，增加维护成本

### Decision 2: 缓存更新策略

**选择**: 在 EmpireStore 中添加 watch 监听 `activeStation` 变化

**理由**:
- StationStore 已经通过 watch 将数据同步到 `activeStation`
- 在 EmpireStore 中监听可以统一处理缓存更新
- 可以通过比较 `stationId` 和 `lastUpdated` 避免不必要的更新

**实现细节**:

```typescript
let lastCacheUpdateTime: number = 0

watch(
  () => ({
    stationId: activeStation.value?.id,
    lastUpdated: activeStation.value?.lastUpdated
  }),
  (current, previous) => {
    if (!current.stationId) return
    
    // stationId 变化（切换 tab）→ 不更新缓存
    if (current.stationId !== previous?.stationId) {
      return
    }
    
    // 同一 station，lastUpdated 变化（数据修改）→ 更新缓存
    if (current.lastUpdated && current.lastUpdated !== lastCacheUpdateTime) {
      lastCacheUpdateTime = current.lastUpdated
      refreshStationFlowCache(current.stationId)
    }
  },
  { deep: true }
)
```

**替代方案**:
- 在 StationStore 的 watch 中调用缓存更新：需要跨 Store 调用，增加耦合
- 懒加载 + TTL：增加复杂度，且可能导致首次访问延迟

### Decision 3: 缓存删除策略

**选择**: 在 `deleteStation` 方法中删除对应缓存

**理由**:
- 保持缓存与数据一致性
- 避免内存泄漏

**实现**:

```typescript
function deleteStation(stationId: string) {
  // ... 现有逻辑 ...
  
  // 删除缓存
  stationFlowCache.delete(stationId)
}
```

### Decision 4: 组件复用策略

**选择**: 创建独立的 `EmpireWareFlowsDashboard`、`EmpireWareFlowGroup`、`EmpireWareFlow` 组件

**理由**:
- 帝国视图的分组逻辑与空间站视图不同（3组 vs 4组）
- 明细需要显示空间站名称，数据结构不同
- 保持组件职责单一，避免过度抽象

**替代方案**:
- 通过 props 控制分组逻辑：增加组件复杂度，难以维护
- 共享基础组件：当前差异较小，不值得抽象

### Decision 5: 数据聚合函数位置

**选择**: 创建独立的 `analyzeEmpireWareFlow.ts` 文件

**理由**:
- 与现有的 `analyzeWareFlow.ts` 保持一致的代码组织
- 聚合逻辑独立于 Store，便于测试和复用

### Decision 6: 产物过滤逻辑位置

**选择**: 在空间站缓存层过滤，而非聚合后过滤

**理由**:
- 产物优先级是空间站级别的概念，每个空间站有自己的优先级判断
- 如果在聚合后过滤，会导致跨空间站污染：空间站 A 的主要产物会影响空间站 B 的统计
- 在缓存层过滤后，聚合逻辑变得简单：直接取已过滤的数据

**实现**:

```typescript
// src/store/logic/filterGroupedFlowsByPriority.ts
export function filterGroupedFlowsByPriority(
  flows: GroupedFlows,
  priorityLevels: Record<string, number>
): GroupedFlows {
  return {
    flows: flows.flows.filter(f => {
      if (f.netRate <= 0) return true
      return (priorityLevels[f.wareId] ?? 0) > 0
    }),
    rateGroups: {
      positive: flows.rateGroups.positive.filter(f => 
        (priorityLevels[f.wareId] ?? 0) > 0
      ),
      operations: flows.rateGroups.operations,
      supply: flows.rateGroups.supply,
      resources: flows.rateGroups.resources
    },
    volumeGroups: flows.volumeGroups
  }
}
```

**调用位置**: `refreshStationFlowCache` 中，在 `analyzeWareFlow` 之后

**替代方案**:
- 在 `analyzeEmpireWareFlow` 中传入每个空间站的优先级函数：增加函数签名复杂度
- 在 `WareFlow` 中添加 `priorityLevel` 字段：需要修改现有数据结构

### Decision 7: 候选归类中的补给优先级

**选择**: 在 Step 3 归类阶段先判断 `wareId` 是否属于 `supply`，命中后直接归入补给组，并与已有补给聚合结果合并。

**理由**:
- 补给语义优先于产品/运营语义，避免同一 `wareId` 同时出现在补给组和产品/运营组
- 当候选集中出现补给资源时（例如运营组中出现同 `wareId`），需要保持分组唯一性与可解释性
- 与讨论结论一致：`supply` 命中后不再参与 `netRate` 的 products/operations 判定

**实现细节**:

```typescript
const supplyWareIdSet = new Set(supplyByWareId.keys())

for (const flow of candidateFlows) {
  if (supplyWareIdSet.has(flow.wareId)) {
    supplyMap.set(flow.wareId, mergeEmpireFlow(supplyMap.get(flow.wareId), flow))
    continue
  }
  if (flow.netRate > 0) products.push(flow)
  else if (flow.netRate < 0) operations.push(flow)
}
```

**替代方案**:
- 候选命中补给时直接丢弃：会损失该 `wareId` 的候选贡献数据
- 允许同一 `wareId` 多组并存：UI 与业务语义冲突，用户难以理解

## Risks / Trade-offs

### Risk 1: 初始化性能

**风险**: 帝国初始化时需要为所有空间站执行流量分析，可能导致延迟。

**缓解**: 
- 使用异步初始化，不阻塞 UI
- 显示加载状态
- 未来可考虑 Web Worker 或增量加载

### Risk 2: 缓存一致性

**风险**: 如果空间站数据通过非 watch 方式修改，缓存可能不一致。

**缓解**: 
- 确保所有空间站修改都通过 StationStore 的 watch 同步到 EmpireStore
- 在 `deleteStation`、`duplicateStation` 等方法中正确处理缓存

### Risk 3: 内存占用

**风险**: 大量空间站可能导致缓存占用较多内存。

**缓解**: 
- `GroupedFlows` 结构相对轻量
- 可在未来添加 LRU 缓存策略（如果需要）

### Risk 4: Watch 触发频率

**风险**: StationStore 的 watch 使用 `deep: true`，可能频繁触发。

**缓解**: 
- 通过 `lastUpdated` 时间戳比较，避免重复计算
- 只有数据真正变化时才更新缓存

### Risk 5: 补给优先归类后的数据一致性

**风险**: 候选与补给都包含同一 `wareId` 时，如果不做合并会出现重复项或统计偏差。

**缓解**:
- 以 `wareId` 为键维护补给聚合 Map
- 候选命中补给时执行合并（production/consumption/netRate/netValue/contributions 全量累加）

## Migration Plan

### 部署步骤

1. 扩展 EmpireStore，添加缓存机制和 watch
2. 创建 `analyzeEmpireWareFlow.ts` 聚合函数
3. 创建帝国视图组件
4. 更新 `StationWorkbench.vue`，替换 "Coming Soon"

### 回滚策略

- 移除帝国视图组件，恢复 "Coming Soon" 占位符
- 移除 EmpireStore 中的缓存相关代码和 watch
