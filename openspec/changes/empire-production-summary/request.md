# Request: Empire Production Summary

## 功能描述

在帝国总览界面添加生产汇总视图，聚合所有空间站的产出和消耗数据，帮助玩家快速了解帝国的整体生产状况。

## 业务背景

当前帝国总览界面只显示 "Coming Soon" 占位符，用户无法在帝国层面查看所有空间站的生产汇总。玩家需要：
- 快速识别帝国的产品盈余（哪些物品净产量为正）
- 了解运营缺口（哪些物品需要外部采购）
- 掌握补给需求（工人消耗的物品）

## 架构设计

### 空间站数量功能

#### 数据结构

在 `StationPlan` 中添加 `count` 字段：

```typescript
interface StationPlan {
  id: string;
  name: string;
  type?: StationType;
  count: number;  // 新增：空间站数量，默认为 1
  modules: SavedModule[];
  settings: StationSettings;
  lastUpdated: number;
  lockedWares?: string[];
  warePriority?: Record<string, number>;
  minerals?: string[];
}
```

#### 数量语义

| count 值 | 含义 |
|----------|------|
| null | 从 storage 加载时，默认设为 1 |
| 0 | 不参与帝国计算（临时禁用） |
| 1 | 默认值，单个空间站 |
| N > 1 | N 个相同配置的空间站，产出和消耗乘以 N |

**数据迁移**：从 localStorage 加载 `StationPlan` 时，如果 `count` 为 `null` 或 `undefined`，自动设为 `1`。

#### UI 绑定

`ContextToolbar` 中的 `stationCount` 输入框需要绑定到 `activeStation.count`：

```typescript
const stationCount = computed({
  get: () => empireStore.activeStation?.count ?? 1,
  set: (val: number) => {
    if (empireStore.activeStation) {
      empireStore.activeStation.count = val
      empireStore.activeStation.lastUpdated = Date.now()
    }
  }
})
```

#### 聚合逻辑影响

在 `analyzeEmpireWareFlow` 中，每个空间站的数据需要乘以 `count`：

```typescript
for each station in stations:
  if (station.count === 0) continue  // 跳过不参与计算的空间站
  
  const multiplier = station.count
  for each flow in stationFlowCache[station.id].rateGroups.supply:
    empireSupply[wareId].push({
      ...flow,
      production: flow.production * multiplier,
      consumption: flow.consumption * multiplier,
      // ... 其他字段也乘以 multiplier
    })
```

### 缓存机制

在 EmpireStore 中添加 `stationFlowCache`：

```typescript
stationFlowCache: Map<stationId, GroupedFlows>
```

#### 缓存更新时机

| 时机 | 方法 | 缓存操作 |
|------|------|---------|
| 初始化 | `initialize()` | 为所有空间站创建缓存 |
| 加载帝国 | `loadEmpire()` | 清空旧缓存 + 为新帝国所有空间站创建缓存 |
| 创建空间站 | `createStation()` | 创建新缓存（空模块） |
| 删除空间站 | `deleteStation()` | 删除对应缓存 |
| 复制空间站 | `duplicateStation()` | 创建新缓存 |
| 数据变化 | EmpireStore watch | 监听 activeStation 变化，更新缓存 |

#### 缓存更新 Watch 实现

在 EmpireStore 中添加 watch，监听 `activeStation` 的变化：

```typescript
let lastCacheUpdateTime: number = 0

watch(
  () => ({
    stationId: activeStation.value?.id,
    lastUpdated: activeStation.value?.lastUpdated
  }),
  (current, previous) => {
    if (!current.stationId) return
    
    // 情况1：stationId 变化（切换 tab）→ 不更新缓存
    if (current.stationId !== previous?.stationId) {
      return
    }
    
    // 情况2：同一 station，lastUpdated 变化（数据修改）→ 更新缓存
    if (current.lastUpdated && current.lastUpdated !== lastCacheUpdateTime) {
      lastCacheUpdateTime = current.lastUpdated
      refreshStationFlowCache(current.stationId)
    }
  },
  { deep: true }
)
```

**关键点**：切换 tab 时 `stationId` 会变化，此时不更新缓存，避免不必要的计算。

### 数据聚合逻辑

创建 `analyzeEmpireWareFlow` 函数，从缓存中汇总帝国级数据：

#### Step 1: 补给组

```typescript
for each station in stations:
  if (station.count === 0) continue
  
  const multiplier = station.count
  for each flow in stationFlowCache[station.id].rateGroups.supply:
    empireSupply[wareId].push(flow * multiplier)
```

直接取各站的 `supply` 组，按 `wareId` 聚合，乘以 `count`。

#### Step 2: 候选数据

```typescript
for each station in stations:
  if (station.count === 0) continue
  
  const multiplier = station.count
  // 取 operations 组
  for each flow in stationFlowCache[station.id].rateGroups.operations:
    candidates[wareId].push(flow * multiplier)
  
  // 取 positive 组，过滤 warePriority > 0
  for each flow in stationFlowCache[station.id].rateGroups.positive:
    if station.warePriority[wareId] > 0:
      candidates[wareId].push(flow * multiplier)
```

#### Step 3: 聚合后归类

```typescript
for each wareId in candidates:
  // 先判断是否属于补给组
  if supplyWareSet.has(wareId):
    归为补给组
    continue

  netRate = sum(flow.netRate)
  
  if netRate > 0:
    归为产品组
  else:
    归为运营组
```

### 分组逻辑

| 组别 | 数据来源 | 条件 |
|------|---------|------|
| 补给组 | `rateGroups.supply` + candidates 中 `wareId ∈ supplyWareSet` | 优先归类，乘以 count |
| 产品组 | `rateGroups.operations` + `rateGroups.positive`（过滤 priority>0） | `wareId ∉ supplyWareSet` 且汇总后 netRate > 0 |
| 运营组 | `rateGroups.operations` + `rateGroups.positive`（过滤 priority>0） | `wareId ∉ supplyWareSet` 且汇总后 netRate < 0 |

### 视图设计

| 视图 | 分组名称 |
|------|---------|
| 数量视图 | 产品 / 运营 / 补给 |
| 经济视图 | 产品收入 / 运营支出 / 补给 |

**注意**：补给组可能显示为"补给收入"或"补给支出"，取决于净产量的正负。

### 组件结构

复制 `StationWareFlowsDashboard` 的两级子模块结构：

```
EmpireWareFlowsDashboard (主容器)
├── EmpireWareFlowGroup (分组容器 - 一级子模块)
│   ├── CollapsibleDetailList (可折叠列表 - 复用)
│   └── EmpireWareFlow (单个资源流项 - 二级子模块)
│       ├── CollapsibleDetailList (明细展开 - 复用)
│       └── 明细显示空间站名称和产出/消耗量
```

### 产物明细

明细应显示：
- 空间站名称
- 该空间站对该物品的产出/消耗量

**示例**：

```
物品：能量电池
净产量：+500/h

明细：
├── 太阳能电站 Alpha (x2)  +1200/h (产出)
├── 贸易站 Beta            -50/h (消耗)
└── 船坞 Gamma             -50/h (消耗)
```

## UI 布局

- 左侧：Coming Soon
- 中间：`EmpireWareFlowsDashboard`（宽度与现有空间站布局一致）
- 右侧：Coming Soon

## 技术约束

1. **不包含体积视图**：帝国总览只需要数量视图和经济视图
2. **复用现有组件**：`CollapsibleDetailList` 等通用组件应复用
3. **缓存一致性**：确保空间站更新时缓存同步更新
4. **性能考虑**：切换 tab 时不触发缓存重新计算
5. **数量为 0**：空间站不参与帝国聚合计算

## 数据结构

### StationPlan 扩展

```typescript
interface StationPlan {
  // ... 现有字段
  count: number;  // 新增：空间站数量，默认为 1，0 表示不参与计算
}
```

### EmpireWareFlow

```typescript
interface EmpireWareFlow {
  wareId: string;
  orderIndex: number;
  tier: number;
  transportType: TransportType;
  unitVolume: number;
  
  // 汇总数据
  production: number;      // 所有空间站产出总和
  consumption: number;     // 所有空间站消耗总和
  workforceConsumption: number; // 所有空间站工人消耗总和
  netRate: number;         // 净产量
  
  // 经济数据
  unitPrice: number;
  netValue: number;
  
  // 明细 - 包含空间站信息
  contributions: EmpireFlowAtom[];
}

interface EmpireFlowAtom extends ModuleFlowAtom {
  stationId: string;
  stationName: string;
  stationCount: number;  // 该空间站的数量
}
```

### EmpireGroupedFlows

```typescript
interface EmpireGroupedFlows {
  flows: EmpireWareFlow[];
  empireGroups: {
    products: EmpireWareFlow[];   // 产品组
    operations: EmpireWareFlow[]; // 运营组
    supply: EmpireWareFlow[];     // 补给组
  };
}
```

## 验收标准

1. 帝国总览界面显示 `EmpireWareFlowsDashboard` 组件
2. 数量视图按产品/运营/补给三组显示
3. 经济视图按产品收入/运营支出/补给三组显示
4. 点击物品可展开明细，显示各空间站的贡献
5. 空间站模块更新后，帝国总览数据同步更新
6. 切换 tab 不触发缓存重新计算
7. ContextToolbar 中的数量输入框正确绑定到 `station.count`
8. 数量为 0 的空间站不参与帝国聚合计算
9. 数量 > 1 的空间站，产出和消耗按倍数计算
10. **产物过滤逻辑仅针对空间站**：如果某样产物不属于该空间站的主要产物（priorityLevel === 0），即使在另一个空间站被标记为主要产物，也不应该被统计进总览的产物产量之中

## 新增需求：产物过滤逻辑优化

### 问题背景

当前实现中，`analyzeEmpireWareFlow` 使用全局的 `getWarePriorityLevel` 函数判断产物优先级：

```typescript
// 当前错误实现
const plannedWareSet = new Set<string>()
activeEmpire.value.stations.forEach(station => {
  station.modules.forEach(m => {
    // 收集所有空间站的计划产物
  })
})

const getWarePriorityLevel = (wareId: string): number => {
  if (plannedWareSet.has(wareId)) return 2  // 全局判断
  return 0
}
```

**问题**：如果 Claytronics 在空间站 A 是主要产物，那么空间站 B 的 autoIndustryModule 顺带产出的 Claytronics 也会被统计进总览产物。

### 解决方案

在空间站缓存层进行过滤，而非聚合后过滤：

```typescript
function refreshStationFlowCache(stationId: string) {
  // ... 现有计算逻辑 ...
  
  const warePriorityLevels = buildResolvedWarePriority(...)
  
  const groupedFlows = analyzeWareFlow(...)
  
  // 包装层：根据该空间站的优先级过滤
  const filteredFlows = filterGroupedFlowsByPriority(groupedFlows, warePriorityLevels)
  
  stationFlowCache.value.set(stationId, filteredFlows)
}
```

### 过滤规则

| priorityLevel | netRate > 0 | 处理方式 |
|---------------|-------------|---------|
| 0 | 是 | 忽略（不进 products，不进 operations） |
| 1 | 是 | 进入 products（副产物） |
| 2 | 是 | 进入 products（主产物） |
| 任意 | 否 | 进入 operations |

### 影响范围

1. **`refreshStationFlowCache`**：添加过滤包装
2. **`analyzeEmpireWareFlow`**：移除 `getWarePriorityLevel` 参数，直接聚合缓存数据
3. **`useEmpireStore.empireGroupedFlows`**：移除全局 `getWarePriorityLevel` 函数

### 新增函数

```typescript
// src/store/logic/filterGroupedFlowsByPriority.ts
export function filterGroupedFlowsByPriority(
  flows: GroupedFlows,
  priorityLevels: Record<string, number>
): GroupedFlows {
  return {
    flows: flows.flows.filter(f => {
      // netRate <= 0 的保留（operations/resources/supply）
      if (f.netRate <= 0) return true
      // netRate > 0 且 priorityLevel > 0 的保留
      return (priorityLevels[f.wareId] ?? 0) > 0
    }),
    rateGroups: {
      positive: flows.rateGroups.positive.filter(f => 
        (priorityLevels[f.wareId] ?? 0) > 0
      ),
      operations: flows.rateGroups.operations,  // 不变
      supply: flows.rateGroups.supply,          // 不变
      resources: flows.rateGroups.resources     // 不变
    },
    volumeGroups: flows.volumeGroups  // 不变
  }
}
```
