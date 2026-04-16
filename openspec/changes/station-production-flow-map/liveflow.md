# Live Flow 双 FlowMap 架构设计

## 背景

useLiveProductionStore 需支持 planning/live 双模式，两种模式使用不同数据源：
- **planning 模式**：使用 bindingStation 数据，有 auto-fill 计算
- **live 模式**：使用 archiveStation 数据，直接展示存档实际模块，无 auto-fill

同时，两种模式都需要 empire 级别聚合数据（`EmpireWareFlowsDashboard` 展示）。

## 需求确认

### 1. 双 FlowMap 实例
- `planningFlowMap`：全局单例（现有），用于 planning 模式
- `liveFlowMap`：新建独立实例，用于 live 模式

### 2. liveFlowMap 特性
- 数据源：`archiveStation.modules`（存档实际模块）
- Settings：借用 `binding.settings`，若无 binding 用 default settings
- **不持久化**：settings 仅用于计算，不保存
- 计算流程：跳过 auto-fill → 直接用 modules 计算 flow → 跳过事后生成模块
- 结果：只有 `productionFlows`，`autoIndustryModules = []`

### 3. 聚合需求
- **planning 模式**：binding 多站点聚合 → `planningEmpireGroupedFlows`
- **live 模式**：archive 多站点聚合 → `liveEmpireGroupedFlows`
- 切换 mode 时，`EmpireWareFlowsDashboard` 显示对应聚合结果

### 4. 切换行为
- planning → live：显示 archive 实际模块的 flows（只读）
- live → planning：显示 binding plan 的 flows（可编辑）

## 设计方案

### 1. StationProductionFlowMap 改造

从单例改为可实例化类，支持 skipAutoFill 选项：

```typescript
// src/store/state/StationProductionFlowMap.ts

export class StationProductionFlowMap {
  private caches: Map<string, StationFlowCache> = new Map()
  
  compute(stationId, input, deps, options?: { skipAutoFill?: boolean }) {
    // 若 skipAutoFill=true：
    //   - 跳过 calculateAutoFill()
    //   - 跳过事后生成模块
    //   - autoIndustryModules = []
    //   - 直接用 plannedModules 计算 productionFlows
  }
  
  getCache(stationId): StationFlowCache | null
  getProductionFlows(stationId): WareProductionFlow[]
  clear()
  remove(stationId)
}

// 全局单例（供 planning 模式使用）
export const stationProductionFlowMap = new StationProductionFlowMap()
```

### 2. useLiveProductionStore 改造

```typescript
// 新增 liveFlowMap 实例
const liveFlowMap = new StationProductionFlowMap()

// 根据 mode 选择 FlowMap
const activeFlowMap = computed(() => {
  return mode.value === 'planning' ? stationProductionFlowMap : liveFlowMap
})
```

### 3. 两套聚合数据

```typescript
// planning 聚合（binding 多站点）
const planningEmpireGroupedFlows = computed(() => {
  // 遍历 binding.stationPlans
  // 用 planningFlowMap.compute() 计算
  // 用 analyzeEmpireWareFlow() 聚合
  return buildSaveBindingProductionFlows(binding, playerStationRecords, ...)
})

// live 聚合（archive 多站点）
const liveEmpireGroupedFlows = computed(() => {
  // 遍历 archive 中所有站点
  // 每个 station 用 liveFlowMap.compute(stationId, {
  //   plannedModules: archive.modules,
  //   settings: binding?.settings ?? DEFAULT_STATION_SETTINGS,
  // }, deps, { skipAutoFill: true })
  // 
  // 用 analyzeEmpireWareFlow() 聚合
})
```

### 4. Overview 页面数据源

```typescript
// EmpireWareFlowsDashboard 接收的数据
const empireGroupedFlows = computed(() => {
  if (mode.value === 'planning') return planningEmpireGroupedFlows.value
  return liveEmpireGroupedFlows.value
})
```

### 5. Station 页面数据源

```typescript
// StationWareFlowsDashboard 接收的数据
const productionFlows = computed(() => {
  const stationId = activeStationId.value
  if (!stationId) return []
  
  if (mode.value === 'planning') {
    return planningFlowMap.getProductionFlows(stationId)
  }
  return liveFlowMap.getProductionFlows(stationId)
})

const warePriorityLevels = computed(() => {
  const stationId = activeStationId.value
  if (!stationId) return {}
  
  const cache = activeFlowMap.value.getCache(stationId)
  return cache?.warePriorityLevels || {}
})
```

### 6. live 模式计算流程

```typescript
function computeLiveStationFlows(archive: ArchiveStationData) {
  const modules = archive.modules // 存档实际模块
  const settings = bindingStation.value?.settings ?? DEFAULT_STATION_SETTINGS
  
  liveFlowMap.compute(archive.code, {
    plannedModules: modules, // 直接用存档模块
    settings,
    lockedWares: [],
    warePriority: {}
  }, deps, { skipAutoFill: true })
  
  // 结果：
  // - productionFlows：基于存档模块的真实 flow
  // - autoIndustryModules = []
  // - autoHabitationModules = []
  // - autoInfrastructureModules = []
}
```

### 7. workbench contract 数据源切换

```typescript
const workbench: ProductionWorkbenchStoreContract = {
  // ...
  
  getProductionFlows() {
    if (mode.value === 'planning') {
      return planningEmpireGroupedFlows.value?.flows || []
    }
    return liveEmpireGroupedFlows.value?.flows || []
  },
  
  getWarePriorityLevels() {
    const stationId = activeStationId.value
    if (!stationId) return {}
    
    const cache = activeFlowMap.value.getCache(stationId)
    return cache?.warePriorityLevels || {}
  },
  
  getAutoModules() {
    if (mode.value === 'live') return [] // live 模式无 auto modules
    return activeStationState.value.autoIndustryModules
  }
}
```

## 实施步骤

### Phase L1: StationProductionFlowMap 类化
1. 将现有单例代码改为 class
2. 新增 `options: { skipAutoFill?: boolean }` 参数
3. 实现 skipAutoFill 分支逻辑
4. 保留现有单例导出

### Phase L2: useLiveProductionStore 双 FlowMap
1. 新增 `liveFlowMap` 实例
2. 新增 `activeFlowMap` computed
3. 新增 `liveEmpireGroupedFlows` computed

### Phase L3: 数据源切换
1. `productionFlows` 改为从 `activeFlowMap` 获取
2. `empireGroupedFlows` 改为根据 mode 切换
3. `getAutoModules()` 根据 mode 返回空数组

### Phase L4: 清理旧代码
1. 移除单一 `stationProductionFlowMap` 直接引用
2. 确保所有 computed 正确响应 mode 变化

## 注意事项

1. live 模式下，archive.modules 可能包含存档中所有模块类型（包括 habitat、infrastructure）
2. 计算时使用 binding.settings（若存在），否则 default settings
3. live 模式的 FlowMap cache 不会持久化，切换站点时自动清理
4. live 模式下 WarePriorityLevels 仅用于展示，无交互功能