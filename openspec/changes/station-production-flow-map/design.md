# Station Production Flow Map - 设计文档

## 架构变更

### 1. 双层状态架构

```
┌─────────────────────────────────────────────────────────────┐
│                     StationStateMap                          │
│                                                              │
│  职责：站点状态管理 + 派生模块 + 分析计算                       │
│                                                              │
│  StationState {                                              │
│    stationId                                                 │
│    plannedModules      ← 用户输入                            │
│    lockedWares         ← 用户输入                            │
│    warePriority        ← 用户输入                            │
│    settings            ← 用户输入                            │
│    autoIndustryModules ← 派生结果                            │
│    actualWorkforce     ← 派生结果                            │
│    currentEfficiency   ← 派生结果                            │
│    warePriorityLevels  ← 派生结果                            │
│    stationAnalysis     ← 派生结果                            │
│  }                                                           │
│                                                              │
│  recompute(stationId, deps) → 调用 calculateProductionFlows │
│                              → 返回 autoIndustryModules 等   │
│                              → 不存储 productionFlows        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ stationId + deps
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   StationProductionFlowMap                   │
│                                                              │
│  职责：ProductionFlow 计算 + Empire/Sector 聚合               │
│                                                              │
│  flowsMap: Map<stationId, WareProductionFlow[]>              │
│  empireFlowsCache: WareProductionFlow[]                      │
│  sectorFlowsCache: Map<sectorId, WareProductionFlow[]>       │
│                                                              │
│  compute(stationId, deps)                                    │
│  ├─ 读取 StationPlan (plannedModules/settings)              │
│  ├─ 调用 calculateProductionFlows                           │
│  └─ 存入 flowsMap                                            │
│                                                              │
│  computeAll(empire, deps)                                    │
│  ├─ 遍历 empire.stations                                     │
│  ├─ 每个 station 执行 compute                                │
│  ├─ 计算 empireFlowsCache                                    │
│  └─ 计算 sectorFlowsCache                                    │
│                                                              │
│  getStationFlows(stationId) → WareProductionFlow[]          │
│  getSectorFlows(sectorId)   → WareProductionFlow[]          │
│  getEmpireFlows()           → WareProductionFlow[]          │
│  getGrouped(stationId)      → GroupedFlows                  │
└─────────────────────────────────────────────────────────────┘
```

### 2. 数据流分离

**StationStateMap 数据流**：
```
plannedModules + settings → autoIndustryModules + stationAnalysis
```

**StationProductionFlowMap 数据流**：
```
StationPlan → calculateProductionFlows → WareProductionFlow[]
                                        → flowsMap[stationId]
```

**聚合数据流**：
```
flowsMap.values() → merge flows → empireFlowsCache
                   → group by sector → sectorFlowsCache
```

### 3. 调用关系

```
useEmpireDataStore.loadEmpire()
    │
    ├─→ StationStateMap.fromPersisted(stationId, plan)  [循环所有 station]
    │       └─→ StationStateMap.recompute(stationId, deps)
    │
    └─→ stationComputeService.computeAllProductionFlows(empire, deps)
            └─→ StationProductionFlowMap.computeAll(empire, deps)
                    └─→ StationProductionFlowMap.compute(stationId, deps)  [循环]

stationComputeService.recomputeStation(stationId)
    │
    ├─→ StationStateMap.recompute(stationId, deps)
    └─→ StationProductionFlowMap.compute(stationId, deps)
            └─→ 重新计算 empireFlowsCache / sectorFlowsCache

useBlueprintProductionStore / useLiveProductionStore
    │
    └─→ stationComputeService.getProductionFlows(stationId)
            └─→ StationProductionFlowMap.getStationFlows(stationId)
    │
    └─→ stationComputeService.getGroupedFlows(stationId)
            └─→ StationProductionFlowMap.getGrouped(stationId)
```

## 关键决策

### 决策 1：完全独立设计

**问题**：StationProductionFlowMap 是否依赖 StationStateMap？

**决策**：完全独立，StationProductionFlowMap 直接读取 StationPlan 数据。

**理由**：
- 避免循环依赖
- 聚合计算需要遍历 empire.stations，StationStateMap 无法提供此数据
- 保持职责清晰：StationStateMap = 状态管理，StationProductionFlowMap = flow 计算

### 冰策 2：预计算聚合缓存

**问题**：聚合查询是实时计算还是预计算？

**决策**：载入时预计算 empire/sector 聚合，存入缓存。

**理由**：
- 聚合查询频繁（UI 实时显示）
- 实时遍历计算性能差
- 单站变更时只需更新相关缓存，无需全量重算

### 冰策 3：移除 StationStateMap.flow 相关字段

**问题**：是否渐进迁移或直接移除？

**决策**：直接移除 productionFlows 字段和相关 getter。

**理由**：
- 减少冗余存储
- 避免数据同步复杂性
- 单一真源原则：flow 数据只在 StationProductionFlowMap 中

### 冰策 4：聚合 contributions 溯源

**问题**：聚合 flow 的 contributions 如何标记来源？

**决策**：contributions 增加 `stationId` 字段标记来源。

**理由**：
- Empire/Sector 聚合需要追溯每个 contribution 的来源 station
- 便于 drill-down 查询具体 station 的 contribution

### 冄策 5：helper 函数迁移

**问题**：groupProductionFlows 等 helper 函数放哪里？

**决策**：迁移到 `StationProductionFlowMap.ts` 作为内部函数。

**理由**：
- 这些函数仅用于 flow 处理
- StationStateMap 不再需要这些函数
- 保持逻辑内聚

## 文件变更清单

### 新增文件

1. `src/store/state/StationProductionFlowMap.ts`
   - StationProductionFlowMap 类
   - compute / computeAll / getStationFlows / getSectorFlows / getEmpireFlows / getGrouped
   - helper: groupProductionFlows / filterProductionFlowsByPriority / convertProductionFlowToWareFlow

2. `src/types/production-flow.ts`（已存在，可能需要扩展）
   - Contribution 增加 `stationId` 字段（可选）

### 修改文件

1. `src/store/state/StationStateMap.ts`
   - 移除 `productionFlows` 字段
   - 移除 `getProductionFlows` / `getFilteredProductionFlows` / `getGroupedFlows` / `getFilteredGroupedFlows`
   - 移除 helper 函数
   - recompute() 返回计算结果但不存储 flows

2. `src/store/logic/stationComputeService.ts`
   - 导入 StationProductionFlowMap
   - 新增 computeAllProductionFlows / getEmpireFlows / getSectorFlows
   - getProductionFlows / getGroupedFlows 改为调用 stationProductionFlowMap

3. `src/store/useBlueprintProductionStore.ts`
   - 通过 stationComputeService 获取 flow 数据
   - loadEmpire 时调用 computeAllProductionFlows

4. `src/store/useLiveProductionStore.ts`
   - 通过 stationComputeService 获取 flow 数据
   - 激活 station 时调用 computeAllProductionFlows

5. `src/store/useEmpireDataStore.ts`（可选）
   - 如需 empire 聚合 getter，可通过 stationComputeService 访问

4. `src/components/empire/StationWareFlowsDashboard.vue`
   - 获取 flow 数据路径变更

5. `src/components/empire/StationPlanningPanel.vue`
   - 获取 grouped flows 路径变更

### 移除内容

- StationStateMap.ts 中的 helper 函数（迁移到 StationProductionFlowMap.ts）

## 潜在风险

### 风险 1：现有测试依赖 StationStateMap.productionFlows

**影响**：测试用例可能断言 productionFlows 字段。

**缓解**：
- 测试改为调用 StationProductionFlowMap.getStationFlows
- 或通过 store getter 间接访问

### 风险 2：computeAll 性能

**影响**：大量 station 时 computeAll 可能慢。

**缓解**：
- 首次载入异步计算（可选）
- 单站变更时增量更新缓存而非全量重算

### 风险 3：缓存一致性

**影响**：单站变更后聚合缓存可能不一致。

**缓解**：
- compute(stationId) 完成后立即更新 empire/sector 缓存
- 或标记脏数据，下次查询时重新计算