# Build Scheme Steps

## 概述

Steps 是建造方案的核心输出，描述了从"空白状态"到"完成建造"的每一步操作。

**生成时机**：用户点击"计算建造方案"后，在 **compute 阶段最后**，由 `makeSchemeSteps()` 生成。

**与 Preview 的关系**：Preview 阶段 **不生成 steps**，只负责责任分配、依赖图、SCC 检测。

## 数据流

```
用户点击"计算建造方案"
  → computeBuildFlowPlan()
    → computeLineResult() (求解模块数量)
      → primaryModules (主要模块数量)
      → auxiliaryModules (辅助模块数量)
    → makeSchemesWithGroups()
      → makeSchemeFromLine()
        → makeSchemeSteps() ← 步骤在此生成
```

## 类型定义

### BuildSchemeStep

```typescript
interface BuildSchemeStep {
  order: number              // 步骤序号 (1, 2, 3...)
  moduleId: string           // 模块 ID
  moduleCount: number        // 该步建造数量 (固定为 1)
  moduleBuildTime: number    // 单个模块建造时间 (秒)
  materials: BuildMaterial[] // 该步所需的建材明细
  estimatedDuration: number  // 累积总时长 (秒)
  estimatedCredits: number   // 累积总资金消耗
  reason: string             // 产线名称
  groupIndex: number         // 所属分组索引
}
```

### BuildMaterial

```typescript
interface BuildMaterial {
  wareId: string              // 商品 ID
  quantity: number            // 该步总需求量
  currentProdRate: number     // 当前产量率 (per hour)
  stockBefore: number         // 建造前库存量
  producedDuringBuild: number // 建造期间产出量
  estimatedTime: number       // 估算时间 (当前为 0)
  creditsNeeded: number       // 需购买的Credits 数量
}
```

## 步骤生成算法

### makeSchemeSteps()

位置：`src/store/logic/calculateBuildFlowPlan.ts:173-247`

**输入**：
- `groups: BuildGroup[]` - 已求解的模块分组
- `modulesMap` / `waresMap` - 游戏数据
- `settings` - 站点设置
- `contextModules?: SavedModule[]` - 上下文已有模块

**核心逻辑**：

```typescript
function makeSchemeSteps(groups, modulesMap, waresMap, settings, contextModules) {
  let builtSoFar = contextModules ? [...contextModules] : []
  let cumDuration = 0
  let cumCredits = 0
  let stock = new Map<string, number>()

  for (const group of groups) {
    // 1. 按 tier 排序，优先建造低 tier 模块
    const sorted = group.modules.sort((a, b) => 
      (modulesMap[a.id]?.tier || 0) - (modulesMap[b.id]?.tier || 0)
    )

    for (const m of sorted) {
      const mod = modulesMap[m.id]
      
      // 2. 拆分 count 为多个单步
      for (let ci = 0; ci < m.count; ci++) {
        // 3. 计算当前净产量
        const net = calculateNetProduction(builtSoFar, modulesMap, ...)
        
        // 4. 计算该步建材消耗
        const materials = computeMaterialsForStep(mod, net, stock, waresMap)
        
        // 5. 累积库存（产出商品）
        for (const [wareId, rate] of Object.entries(net)) {
          if (rate > 0) {
            stock.set(wareId, 
              (stock.get(wareId) || 0) + rate * buildTimeH
            )
          }
        }
        
        // 6. 累积时长和资金
        cumDuration += buildTime
        cumCredits += materials.reduce((s, mat) => s + mat.creditsNeeded, 0)
        
        // 7. 更新已建造列表
        builtSoFar = mergeModules([...builtSoFar, { id: m.id, count: 1 }])
        
        // 8. 生成步骤
        result.push({
          order: result.length + 1,
          moduleId: m.id,
          moduleCount: 1,
          moduleBuildTime: buildTime,
          materials,
          estimatedDuration: cumDuration,
          estimatedCredits: cumCredits,
          ...
        })
      }
    }
  }
  return result
}
```

### 建材消耗计算

```typescript
function computeMaterialsForStep(mod, net, stock, waresMap) {
  const buildTimeH = mod.buildTime / 3600
  
  return Object.entries(mod.buildCost).map(([wareId, totalQty]) => {
    const prodRate = Math.max(0, net[wareId] || 0)
    const warePrice = waresMap[wareId]?.price || 0
    const prevStock = stock.get(wareId) || 0
    
    // 优先使用库存
    const coveredByStock = Math.min(totalQty, prevStock)
    const deficitQty = totalQty - coveredByStock
    
    // 扣减库存
    stock.set(wareId, prevStock - coveredByStock)
    
    // 建造期间产出量
    const produced = prodRate * buildTimeH
    
    // 需购买的Credits
    const creditsNeeded = deficitQty * warePrice
    
    return {
      wareId,
      quantity: totalQty,
      currentProdRate: prodRate,
      stockBefore: prevStock,
      producedDuringBuild: produced,
      creditsNeeded,
    }
  })
}
```

## 关键特性

### 1. 一次性模块数量确定

Steps 的输入是 **已确定的模块数量**（来自 compute 求解）：

- `primaryModules`: 主要生产模块
- `auxiliaryModules`: 配套模块（habitation、autoIndustry 等）

Steps **不重新计算数量**，只是将数量拆分成建造步骤。

### 2. 步骤拆分规则

每个 `module.count` 拆分成 N 个步骤：

- 每步 `moduleCount: 1`
- 按 tier 排序，低 tier 模块优先建造
- 同 tier 内按原始顺序

### 3. 累积计算逻辑

| 维度 | 计算方式 |
|------|---------|
| **时长** | `cumDuration += buildTime` |
| **资金** | `cumCredits += sum(creditsNeeded)` |
| **产量** | 每步后重新计算 `calculateNetProduction(builtSoFar)` |
| **库存** | `stock[wareId] += rate × buildTimeH` |

### 4. 建材消耗优先级

```text
需求量 → 库存抵扣 → 剩余需购买 → Credits 计算
  |        |           |            |
  |    stock.get()  deficitQty  deficitQty × price
  |
  来自 mod.buildCost
```

**注意**：
- 库存优先抵扣
- 建造期间产出量不计入抵扣（只用于展示）
- 实际消耗 = `deficitQty = quantity - coveredByStock`

### 5. Energy Cells 特殊处理

```typescript
if (wareId === 'energycells') continue  // 不计入 buildMaterialTotals
```

Energy Cells 不计入建造材料统计，但仍参与每步的消耗计算。

## 与 Compute 的关系

### Compute 阶段输出

```typescript
interface ComputeLineResult {
  groupId?: string
  groupName: string
  mergedResponsibilities: PreviewResponsibility[]
  relatedLineGroupIds: string[]
  targetRates: Record<string, number>
  primaryModules: SavedModule[]    ← 主要模块数量
  auxiliaryModules: SavedModule[]  ← 辅助模块数量
  allModules: SavedModule[]        ← 全部模块（合并）
}
```

### Steps 生成时机

在 `makeSchemeFromLine()` 中：

```typescript
function makeSchemeFromLine(node, graph, modulesMap, waresMap, settings, builtSoFar) {
  // node.modules 已由 compute 求解完成
  const groups: BuildGroup[] = node.buildGroups || 
    [{ reason: node.lineName, modules: node.modules }]
  
  const steps = makeSchemeSteps(groups, modulesMap, waresMap, settings, builtSoFar)
  
  return {
    label: node.lineName,
    modules: node.modules,      // 来自 compute
    steps,                       // 来自 makeSchemeSteps
    totalDuration: steps[-1].estimatedDuration,
    totalCredits: steps[-1].estimatedCredits,
    ...
  }
}
```

## 与 Preview 的边界

| 阶段 | 输出 | 是否生成 steps |
|------|------|---------------|
| **Preview** | PreviewResult（责任、graph、SCC） | ❌ 不生成 |
| **Compute** | ComputeResult（模块数量、schemeGroups） | ✅ 在此生成 |

**Preview 禁止行为**（见 spec.md）：
- MUST NOT 在 preview 阶段产出最终主要模块数量
- MUST NOT 在 preview 阶段产出辅助模块数量
- MUST NOT 在 preview 阶段产出 steps

## 多产线场景

### builtSoFar 跨产线传递

```typescript
function makeSchemesWithGroups(graph, allocations, ...) {
  const builtSoFar: SavedModule[] = []
  
  for (const entry of topologicalOrder(graph)) {
    for (const groupId of entry) {
      const node = graph.nodes.get(groupId)
      
      // 传入已建造模块作为上下文
      buildSchemes.push(
        makeSchemeFromLine(node, graph, ..., builtSoFar)
      )
      
      // 更新已建造列表
      builtSoFar.push(...node.modules)
    }
  }
}
```

**效果**：
- 后续产线的 steps 会考虑前面产线已建造模块的产量
- 依赖图拓扑序保证上游产线先建造
- SCC 内产线按任意顺序（循环依赖）

### 重叠产线处理

```typescript
// Overlapping lines are already solved in graph nodes with merged responsibilities
const productionAllocations = allocations.filter(
  a => !a.groupId || !graphGroupIds.has(a.groupId)
)
```

重叠产线（同时属于建材链和生产责任）：
- 只在建材组出现一次
- 责任合并后统一求解
- 不在两组重复出现

## 数据流完整图

```
Preview 阶段 (preview)
  createBuildFlowPlanPreview()
  ↓
  PreviewResult {
    lines: PreviewLinePlan[]
    graph: BuildFlowPlanGraph
    sccGroups: string[][]
  }
  ↓
Compute 阶段 (compute)
  computeBuildFlowPlan(preview)
  ↓
  computeLineResult() → ComputeLineResult {
    primaryModules    ← 求解
    auxiliaryModules  ← 求解
    allModules        ← 合并
  }
  ↓
  makeSchemesWithGroups()
  ↓
  makeSchemeFromLine() → BuildScheme {
    modules: node.modules  ← 来自 compute
    steps: makeSchemeSteps() ← 在此生成
  }
  ↓
  BuildSchemeGroup[] {
    groupType: 'build-material' | 'production'
    schemes: BuildScheme[]
  }
```

## 参考文件

| 文件 | 关键函数 |
|------|---------|
| `src/store/logic/buildPlanProductionLine.ts` | `computeBuildFlowPlan()`, `computeLineResult()`, `makeSchemesWithGroups()` |
| `src/store/logic/calculateBuildFlowPlan.ts` | `makeSchemeSteps()`, `makeSchemeFromLine()` |
| `src/types/build-plan.ts` | `BuildSchemeStep`, `BuildMaterial`, `BuildScheme` |