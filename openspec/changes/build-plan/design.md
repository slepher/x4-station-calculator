# build-plan 设计

## 问题

Blueprint overview 视图当前仅显示单一线性建造步骤列表，缺少方案选择和对比能力。用户无法基于当前帝国产能获得多个递进建造方案。

## 方案

### 1. 类型定义

```typescript
interface BuildMaterial {
  wareId: string
  quantity: number
  currentProdRate: number
  stockBefore: number             // 步开始前该物资的库存
  producedDuringBuild: number     // 本步建造期间的自产量
  estimatedTime: number
  creditsNeeded: number
}

interface BuildSchemeStep {
  order: number
  moduleId: string
  moduleCount: number     // 恒为 1（count 已展开为独立步骤）
  moduleBuildTime: number  // 单步建造时间（秒）
  materials: BuildMaterial[]
  estimatedDuration: number   // 累计耗时
  estimatedCredits: number    // 累计花费
  reason: string              // 所属组原因
  groupIndex: number          // 组索引
}

interface BuildRateSource {
  label: string
  rates: Record<string, number>
}

interface BuildScheme {
  label: string
  description: string
  purposeModules: string[]   // 主要目的产物（不含 energycells）
  modules: SavedModule[]
  targetRates: Record<string, number>       // max_merge of all targetRateSources
  targetRateSources: BuildRateSource[]      // 各来源的建材需求速率（方案1建材、方案2建材、方案3剩余建材）
  netProduction: Record<string, number>     // 方案完工后（含 context）的净产出
  steps: BuildSchemeStep[]
  totalDuration: number
  totalCredits: number
  stepsCount: number
  isFeasible: boolean
  totalModuleBuildTime: number              // 所有模块建造时间之和
  buildMaterialTotals: Record<string, number>  // 建材消耗总量
}

interface BuildGroup {
  reason: string          // 组原因（如 "Build mat: claytronics"）
  modules: SavedModule[]
}
```

### 2. 算法（`calculateBuildPlan`）

**输入**: `CalculateBuildPlanInput`（goals、currentModules、currentNetProduction、settings、modulesMap、waresMap）

**输出**: `BuildPlan` → `schemes: BuildScheme[]`

#### 自举目标（self-sufficient）

```
expandGoalDependencies + calculateAutoFillModules → allMods
makeScheme → 方案1
```

#### 目标产量 / 目标建筑（production-rate / build-module）

```
Phase 1 — allMods3：
  1. expandGoalDependencies → 目标模块
  2. calculateAutoFillModules → allMods3
  3. R3 = buildRates(allMods3)
  4. 识别建材模块（产出在 R3 中的非目标模块）→ 从 allMods3 剔除
  5. scheme3' = allMods3 - 建材模块
  6. R3' = buildRates(scheme3')
  7. 当前产能 ≥ R3'？→ 是则只显示方案3

Phase 2 — 方案2：
  8. whichWares = R3'.keys，targetRates = R3
     R2 必须满足 R3 对 R3' 全部 ware 的产能需求（用 R3 的速率，非 R3' 速率）
     即 R3 = ABC XYZ，R3' = ABC → R2 按 R3[ABC] 速率产 ABC，不存在 R2 覆盖不了需要 R1 兜底的情况
  9. planProductionForRates + autoFill → allMods2
  10. R2 = buildRates(allMods2)

Phase 3 — 方案1：
  11. r3Remaining = R3.keys \ R3'.keys（R3 中有但 R3' 中没有的 ware，即建材模块自身的建材消耗）
  12. scheme1Target = max_merge(R1建材, R2建材, r3Remaining)  // 非叠加，取 max
  13. greedyFill(sources=[R1建材, R2建材, r3Remaining]) → 自给自足产线
      greedyFill 分别验证每个 source 的满足率，全部满足才退出
```

### 3. greedyFill（方案1贪婪循环）

```
输入: targetRateSources: BuildRateSource[]（各来源的建材需求速率）
内部: targetRates = max_merge(all sources)

seed: 如果 targetRates 含 hullparts, 第一个瓶颈固定为 hullparts

循环（最多 60 次）:
  1. contextNet = net(currentEmpire + builtSoFar)
  2. allMet = 对每个 source，contextNet[ware] >= source.rates[ware] for all wares?
  3. 全部满足 → 退出
  4. 否 → findLowestSatisfaction(contextNet)
     从已建模块的 buildCost 消耗率中找满足率最低的 ware
  5. 添加一个该 ware 的生产者到 builtSoFar
  6. autoFill(builtSoFar) → 当前支持模块
  7. deltaAuto = 当前 autoFill - 前一轮 autoFill（新模块）
  8. group = [新生产者, ...deltaAuto]
```

**能量电池排除**：
- `energycells` 不参与 `buildRates` 计算（`computeBuildRates` 中过滤）
- `findLowestSatisfaction` 中 `energycells` 不参与瓶颈计算
- 产出 `energycells` 的模块不出现在 `purposeModules`

### 4. 消耗与生产时序

```
步开始：  库存[ware] -= 消耗量（不足部分购买，creditsNeeded > 0）
建造中： 已有模块（builtSoFar）持续产出，累加到库存
步结束： 本步模块完工，加入 builtSoFar
```

`builtSoFar` **按步累加**（不是按组），`count > 1` 展开为独立步骤。

### 5. 递进上下文

- 方案1 context = currentModules（帝国现有模块）
- 方案2 context = currentModules + 方案1 模块
- 方案3 context = currentModules + 方案1 + 方案2 模块

### 6. 每步输出格式

```
#N  ModuleName ×1
    建造: X.XXh  累计: X.XXh  步骤费: XXX  累计费: XXX
    材料明细:
      WareName  ×qty  自产: rate/h  +produced  买: credits  (单价: price)
```

- **自产** = builtSoFar 对该物资的净产出速率（含所有前置方案的已建模块）
- **+produced** = 本步建造期间的自产量
- **买** = 算法内部库存不足时的购买金额。`0` 表示算法库存充足

### 7. 方案1产能验证格式

```
── 方案1 产能对各方案需求的满足率 ──
── 方案1建材 ──
  建造总时间: X.XXh  模块数: N
  ✓ WareName  ×totalQty  需要: XXX.X/h  产能: XXX.X/h  满足: XXX%
── 方案2建材 ──
  建造总时间: X.XXh  模块数: N
  ✓ WareName  ×totalQty  需要: XXX.X/h  产能: XXX.X/h  满足: XXX%
── 方案3剩余建材 ──
  建造总时间: X.XXh  模块数: N
  ✓ WareName  ×totalQty  需要: XXX.X/h  产能: XXX.X/h  满足: XXX%
```

- **×totalQty** = 该方案对该物资的建材消耗总量
- **需要** = 该来源的建材消耗速率
- **产能** = 方案1完工后的净产出速率
- **energycells 不显示**

### 8. Store 变更

- `buildGoals: Ref<BuildGoal[]>`（代替原 buildConstraints）
- `buildPlan: Ref<BuildPlan | null>`（含 `schemes`）
- `empireCurrentNetProduction: ComputedRef<Record<string, number>>`
- `computePlan()` 调用新算法
- 移除 `setTimeBudget`/`setCreditBudget`

### 9. UI 变更

| 组件 | 变更 |
|------|------|
| `BuildPlanConstraintsPanel.vue` | 移除预算输入，保留目标管理和计算按钮 |
| `BuildPlanPanel.vue` | 重写为方案卡片列表 |
| `BuildPlanStepsModal.vue` | **新增**浮动窗口，展示方案详细步骤 |
| `BlueprintProductionWorkbenchView.vue` | 集成新三栏布局 |
| `EmpireWareFlowsDashboard.vue` | 不变 |

### 10. 分析脚本

`analysis/scripts/findBuildPlanDefaults.ts` — 运行 `npx tsx analysis/scripts/findBuildPlanDefaults.ts`，输出导弹部件×5 在空帝国下的完整方案明细。
