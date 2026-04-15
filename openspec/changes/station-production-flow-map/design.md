# Station Production Flow Map - 设计文档

## 架构变更

### 1. 单层缓存架构（移除 StationStateMap）

```
┌─────────────────────────────────────────────────────────────┐
│                   StationProductionFlowMap                   │
│                                                              │
│  职责：缓存 resolvedModules + ProductionFlow + Empire/Sector 聚合 │
│                                                              │
│  StationFlowCache {                                          │
│    resolvedModules: SavedModule[]    // planned + autoIndustry │
│    productionFlows: WareProductionFlow[]                       │
│  }                                                             │
│                                                              │
│  cacheMap: Map<stationId, StationFlowCache>                  │
│  empireFlowsCache: WareProductionFlow[]                      │
│  sectorFlowsCache: Map<sectorId, WareProductionFlow[]>       │
│                                                              │
│  compute(stationId, input, deps)                             │
│  ├─ 计算 autoIndustryModules                                 │
│  ├─ resolvedModules = planned + autoIndustry                 │
│  ├─ 计算 productionFlows (含 volume，不含价格)                │
│  └─ 缓存到 cacheMap                                           │
│                                                              │
│  getCache(stationId) → StationFlowCache                      │
│  getResolvedModules(stationId) → SavedModule[]               │
│  getProductionFlows(stationId) → WareProductionFlow[]        │
│  getSectorFlows(sectorId) → WareProductionFlow[]             │
│  getEmpireFlows() → WareProductionFlow[]                     │
└─────────────────────────────────────────────────────────────┘
```

### 2. WareProductionFlow 结构变更

**移除字段**：
- `minPrice`, `price`, `maxPrice` - 价格在 Stage 2 计算

**新增字段**：
- `productionVolume: number` - production × unitVolume
- `consumptionVolume: number` - consumption × unitVolume  
- `netVolume: number` - netRate × unitVolume

```typescript
interface WareProductionFlow {
  wareId: string
  orderIndex: number
  tier: number
  transportType: TransportType
  unitVolume: number
  
  production: number
  consumption: number
  workforceConsumption: number
  netRate: number
  
  productionVolume: number      // 新增
  consumptionVolume: number     // 新增
  netVolume: number             // 新增
  
  contributions: ModuleFlowAtom[]
}
```

### 3. 两阶段计算架构

**Stage 1（缓存 - StationProductionFlowMap）**：
```
输入: plannedModules + settings + lockedWares + warePriority
输出:
  resolvedModules: planned + autoIndustry
  productionFlows: {
    wareId, tier, transportType, unitVolume,
    production, consumption, workforceConsumption, netRate,
    productionVolume, consumptionVolume, netVolume,  ← 含 volume
    contributions
  }
  
settings 不缓存，从 activeStation.settings 获取
```

**Stage 2（UI Composable 实时计算）**：
```
输入: productionFlows + waresMap + settings
输出:
  - 价格: minPrice, avgPrice, maxPrice (from waresMap)
  - groupedFlows: 分组展示
  - transportDemand: 运输需求计算
  - autoInfrastructureModules: 仓储/泊位计算
  - stationAnalysis: 成本/模块分析
```

### 4. ActiveStationContext 整合设计

```
activeStation.value (StationPlan)
  ├── modules: SavedModule[]           ← 用户直接编辑
  ├── settings: StationSettings        ← 用户直接编辑（不缓存）
  ├── lockedWares: string[]            ← 用户直接编辑
  └── warePriority: Record<string, number> ← 用户直接编辑

activeStationContext computed:
  ├── station: activeStation.value     ← 原始数据引用
  ├── cache: cacheMap[stationId]       ← 缓存数据
  │     ├── resolvedModules: planned + autoIndustry
  │     └── productionFlows: WareProductionFlow[] (含 volume)
  │
  └── derived (实时计算 - UI Composable):
        ├── prices: from waresMap
        ├── autoInfrastructureModules: computeStorageBerths(...)
        ├── stationAnalysis: analyze(resolved + autoInfra, settings)
        ├── actualWorkforce: computeWorkforce(resolvedModules)
        ├── groupedFlows: group(productionFlows)
        └── warePriorityLevels: resolvePriority(resolvedModules, warePriority)
```

### 5. 数据来源清晰化

| 数据 | 来源 | 计算时机 |
|------|------|----------|
| plannedModules | station.modules | 用户编辑 |
| **settings** | **station.settings** | **用户编辑，不缓存** |
| lockedWares | station.lockedWares | 用户编辑 |
| warePriority | station.warePriority | 用户编辑 |
| **resolvedModules** | planned + autoIndustry | **缓存**（Stage 1） |
| **productionFlows** | from resolvedModules | **缓存**（Stage 1，含 volume） |
| **volume数据** | flows × unitVolume | **缓存**（Stage 1） |
| prices | from waresMap | 实时派生（Stage 2） |
| autoInfrastructureModules | from flows + settings | 实时派生（Stage 2） |
| stationAnalysis | from modules + settings | 实时派生（Stage 2） |
| groupedFlows | from productionFlows | 实时派生（Stage 2） |

### 6. 调用关系

```
loadEmpire() / activateStation()
    │
    └─→ StationProductionFlowMap.computeAll(empire.stations, deps)
            └─→ for each station: compute(station.id, input, deps)

用户编辑 modules/settings/lockedWares/warePriority
    │
    └─→ StationProductionFlowMap.compute(stationId, input, deps)
            └─→ 更新缓存 + 更新聚合

UI 获取数据
    │
    └─→ store.activeStationContext (Stage 2 实时派生)
            ├─→ station (原始数据，含 settings)
            ├─→ cache.resolvedModules (缓存)
            ├─→ cache.productionFlows (缓存，含 volume)
            └─→ derived.* (实时派生，含 prices)
```

## 关键决策

### 决策 1：移除 StationStateMap

**问题**：StationStateMap 是否还有必要？

**决策**：完全移除 StationStateMap。

**理由**：
- 用户编辑直接反映到 `activeStation`，无需临时编辑态
- 无取消回滚需求
- 派生数据实时计算或缓存到 StationProductionFlowMap
- 减少数据同步复杂度

### 决策 2：settings 不缓存

**问题**：settings 是否缓存？

**决策**：settings 不缓存，直接从 `activeStation.settings` 获取。

**理由**：
- settings 频繁变更（bufferHours、priceMultiplier 等）
- 避免缓存同步问题
- Stage 2 实时计算直接使用 station.settings

### 冄策 3：WareProductionFlow 移除价格字段

**问题**：价格数据是否缓存？

**决策**：移除 `minPrice, price, maxPrice`，新增 `productionVolume, consumptionVolume, netVolume`。

**理由**：
- 价格依赖 waresMap，可能在 Stage 2 使用不同价格倍率
- volume 数据可在 Stage 1 计算（production × unitVolume）
- 分离关注点：Stage 1 计算流量，Stage 2 计算价值

### 冄策 4：resolvedModules 命名

**问题**：合并后的模块列表如何命名？

**决策**：命名为 `resolvedModules` = plannedModules + autoIndustryModules。

**理由**：
- "resolved" 表示"解析完成"的语义
- 与 planned（规划态）区分
- 包含所有实际会运行的模块（不含仓储/泊位）

### 冄策 5：缓存边界

**问题**：哪些数据缓存？哪些实时计算？

**决策**：
- **缓存**：resolvedModules、productionFlows（含 volume）
- **实时派生（Stage 2）**：prices、autoInfrastructureModules、stationAnalysis、groupedFlows

**理由**：
- resolvedModules 和 productionFlows 计算成本高，缓存
- volume 可在 Stage 1 计算（unitVolume 来自 waresMap）
- prices 依赖 Stage 2 的价格倍率，实时计算
- autoInfrastructureModules 依赖 settings.bufferHours，实时计算
- stationAnalysis/workforce/groupedFlows 可实时计算

### 冄策 6：聚合缓存

**问题**：empire/sector 聚合如何处理？

**决策**：预计算缓存，单站变更时增量更新。

**理由**：
- 聚合查询频繁（UI 实时显示）
- 实时遍历计算性能差

## 文件变更清单

### 修改文件

1. `src/types/production-flow.ts`
   - 移除 `minPrice, price, maxPrice` 字段
   - 新增 `productionVolume, consumptionVolume, netVolume` 字段

2. `src/store/state/StationProductionFlowMap.ts`
   - 新增 `StationFlowCache` 接口（resolvedModules + productionFlows）
   - compute() 输出 resolvedModules 和含 volume 的 productionFlows
   - 新增 `getCache(stationId)` / `getResolvedModules(stationId)` 方法
   - settings 不缓存

3. `src/store/logic/calculateProductionFlows.ts`
   - 移除价格字段填充
   - 新增 volume 字段计算（productionVolume, consumptionVolume, netVolume）

4. `src/store/logic/analyzeEmpireWareFlow.ts`
   - 价格从 waresMap 获取而非 productionFlows

5. `src/store/logic/calculateWareFlowDerived.ts`
   - 价格从 waresMap 获取而非 productionFlows

6. `src/store/logic/stationComputeService.ts`
   - 移除 StationStateMap 相关函数
   - 更新 getActiveStationContext 使用新 cache 结构
   - 移除 `getStationFlows` 改为 `getProductionFlows`

7. `src/store/useBlueprintProductionStore.ts`
   - 移除 StationStateMap 相关调用
   - settings 从 activeStation.settings 获取

8. `src/store/useLiveProductionStore.ts`
   - 同上

### 移除文件

- `src/store/state/StationStateMap.ts`

## 潜在风险

### 风险 1：测试依赖 StationStateMap

**影响**：现有测试可能依赖 StationStateMap。

**缓解**：更新测试使用新的数据获取方式。

### 风险 2：价格计算位置变更

**影响**：现有代码可能从 productionFlows 获取价格。

**缓解**：Stage 2 从 waresMap 获取价格。

### 风险 3：迁移过程复杂

**影响**：多个文件引用 StationStateMap。

**缓解**：逐步迁移，保持 build 通过。