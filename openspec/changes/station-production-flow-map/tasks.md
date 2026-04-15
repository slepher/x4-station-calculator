# Station Production Flow Map - 实现任务

## Tasks

- [x] Task 1: 创建 StationProductionFlowMap 类
- [x] Task 2: 实现 compute 方法
- [x] Task 3: 实现 computeAll 方法
- [x] Task 4: 实现 getter 方法
- [x] Task 5: 迁移 helper 函数
- [x] Task 6: 移除 StationStateMap flow 相关字段
- [x] Task 7: 更新 stationComputeService
- [x] Task 8: 更新 useBlueprintProductionStore 和 useLiveProductionStore
- [x] Task 9: 更新 UI 组件
- [x] Task 10: 构建验证
- [x] Task 11: WareProductionFlow 移除价格字段，新增 volume 字段
- [x] Task 12: calculateProductionFlows 计算 volume 数据
- [x] Task 13: 价格从 waresMap 获取（Stage 2）
- [x] Task 14: StationFlowCache 增加 resolvedModules
- [x] Task 15: settings 不缓存，从 activeStation.settings 获取
- [x] Task 16: 构建验证（Phase 2）

---

## Phase 1: StationProductionFlowMap 基础架构（已完成）

Task 1-10 已完成，建立了 StationProductionFlowMap 作为 ProductionFlow 计算的独立层。

## Phase 2: 两阶段计算架构（已完成）

### Task 11: WareProductionFlow 移除价格字段

**文件**：`src/types/production-flow.ts`

**变更**：
- 移除 `minPrice`, `price`, `maxPrice`
- 新增 `productionVolume`, `consumptionVolume`, `netVolume`

### Task 12: calculateProductionFlows 计算 volume

**文件**：`src/store/logic/calculateProductionFlows.ts`

**变更**：
- 在 productionFlows 生成时计算 volume 数据
- `productionVolume = production × unitVolume`
- `consumptionVolume = consumption × unitVolume`
- `netVolume = netRate × unitVolume`

### Task 13: 价格从 waresMap 获取

**文件**：
- `src/store/logic/calculateWareFlowDerived.ts`
- `src/store/logic/analyzeEmpireWareFlow.ts`

**变更**：
- 函数签名增加 `waresMap` 参数
- 价格从 `waresMap[wareId]` 获取而非 productionFlows

### Task 14: StationFlowCache 增加 resolvedModules

**文件**：`src/store/state/StationProductionFlowMap.ts`

**变更**：
- `StationFlowCache` 结构：
  ```typescript
  interface StationFlowCache {
    resolvedModules: SavedModule[]  // planned + autoIndustry
    productionFlows: WareProductionFlow[]
  }
  ```
- `compute()` 输出 resolvedModules 和含 volume 的 productionFlows
- 新增 `getCache()` / `getResolvedModules()` 方法

### Task 15: settings 不缓存

**决策**：
- settings 从 `activeStation.settings` 获取，不缓存到 StationFlowCache
- Stage 2 实时派生使用 station.settings

### Task 16: 构建验证

**状态**：✅ 通过

## Phase 3: 移除 StationStateMap（部分完成）

### Task 17: 创建 stationContextService

**文件**：`src/store/logic/stationContextService.ts`

**内容**：
- 创建 `ActiveStationContext` 接口
- 实现 `getActiveStationContext(station, modulesMap, waresMap)`
- 整合 station + cache + 实时派生数据

**状态**：✅ 完成

### Task 18: 移除 StationStateMap（待继续）

**需要修改的调用点（35处）**：

| 文件 | 调用点数 | 改动类型 |
|------|----------|----------|
| stationComputeService.ts | 20+ | 大改动 |
| useBlueprintProductionStore.ts | 5 | 中改动 |
| useLiveProductionStore.ts | 4 | 中改动 |
| tests | 1 | 小改动 |

**改动方向**：
- `stationId` 参数 → 接收 `station` 对象
- `StationStateMap.get()` → 直接从 station 获取
- `StationStateMap.patch()` → 直接修改 station 属性
- `recomputeStation()` → `computeStationFlowCache()`

**风险**：
- 函数签名变更影响较大
- 需要更新测试

**状态**：⏳ 待继续