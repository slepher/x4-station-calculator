# Request: Empire Production Summary

## 功能描述

在帝国总览界面添加生产汇总视图，聚合所有空间站的产出和消耗数据，帮助玩家快速了解帝国的整体生产状况。

## 业务背景

当前帝国总览界面只显示 "Coming Soon" 占位符，用户无法在帝国层面查看所有空间站的生产汇总。玩家需要：
- 快速识别帝国的产品盈余（哪些物品净产量为正）
- 了解运营缺口（哪些物品需要外部采购）
- 掌握补给需求（工人消耗的物品）

## 架构设计

### 缓存机制

在 EmpireStore 中添加 `stationFlowCache`：

```typescript
stationFlowCache: Map<stationId, GroupedFlows>
```

**初始化时机**：EmpireStore 初始化时，为所有空间站执行 `analyzeWareFlow` 并缓存结果。

**更新时机**：当空间站模块更新时，通过 `updateStationModules` 方法自动更新对应的缓存。

### 数据聚合逻辑

创建 `analyzeEmpireWareFlow` 函数，从缓存中汇总帝国级数据：

#### Step 1: 补给组

```typescript
for each station in stations:
  for each flow in stationFlowCache[station.id].rateGroups.supply:
    empireSupply[wareId].push(flow)
```

直接取各站的 `supply` 组，按 `wareId` 聚合。

#### Step 2: 候选数据

```typescript
for each station in stations:
  // 取 operations 组
  for each flow in stationFlowCache[station.id].rateGroups.operations:
    candidates[wareId].push(flow)
  
  // 取 positive 组，过滤 warePriority > 0
  for each flow in stationFlowCache[station.id].rateGroups.positive:
    if station.warePriority[wareId] > 0:
      candidates[wareId].push(flow)
```

#### Step 3: 聚合后归类

```typescript
for each wareId in candidates:
  netRate = sum(flow.netRate)
  
  if netRate > 0:
    归为产品组
  else:
    归为运营组
```

### 分组逻辑

| 组别 | 数据来源 | 条件 |
|------|---------|------|
| 补给组 | `rateGroups.supply` | 直接取 |
| 产品组 | `rateGroups.operations` + `rateGroups.positive`（过滤 priority>0） | 汇总后 netRate > 0 |
| 运营组 | `rateGroups.operations` + `rateGroups.positive`（过滤 priority>0） | 汇总后 netRate < 0 |

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
├── 太阳能电站 Alpha    +600/h (产出)
├── 贸易站 Beta         -50/h (消耗)
└── 船坞 Gamma          -50/h (消耗)
```

## UI 布局

- 左侧：Coming Soon
- 中间：`EmpireWareFlowsDashboard`（宽度与现有空间站布局一致）
- 右侧：Coming Soon

## 技术约束

1. **不包含体积视图**：帝国总览只需要数量视图和经济视图
2. **复用现有组件**：`CollapsibleDetailList` 等通用组件应复用
3. **缓存一致性**：确保空间站更新时缓存同步更新
4. **性能考虑**：初始化时批量计算所有空间站的流量分析

## 数据结构

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
