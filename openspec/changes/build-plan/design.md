# build-plan 设计

## 问题

Blueprint overview 视图当前仅显示单一线性建造步骤列表，缺少方案选择和对比能力。用户无法基于当前帝国产能获得多个递进建造方案。

## 方案

### 1. 类型定义

```typescript
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

interface BuildScheme {
  label: string
  description: string
  purposeModules: string[]   // 主要目的产物（不含 energycells）
  steps: BuildSchemeStep[]
  totalDuration: number
  totalCredits: number
  stepsCount: number
  isFeasible: boolean
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
  9. planProductionForRates + autoFill → allMods2
  10. R2 = buildRates(allMods2)

Phase 3 — 方案1：
  11. r3Remaining = R3 - R3'
  12. scheme1Target = max_merge(R2.rates, r3Remaining)  // 非叠加
  13. greedyFill + autoFill → 自给自足产线
```

### 3. greedyFill（方案1贪婪循环）

```
seed: 如果 targetRates 含 hullparts, 第一个瓶颈固定为 hullparts

循环（最多 30 次）:
  1. contextNet = net(currentEmpire + builtSoFar)
  2. allMet = contextNet[ware] >= targetRates[ware] for all wares?
  3. 是 → 退出
  4. 否 → findLowestSatisfaction(contextNet)
     从已建模块的 buildCost 消耗率中找满足率最低的 ware
  5. 添加一个该 ware 的生产者到 builtSoFar
  6. autoFill(builtSoFar) → 当前支持模块
  7. deltaAuto = 当前 autoFill - 前一轮 autoFill（新模块）
  8. group = [新生产者, ...deltaAuto]
```

**能量电池排除**：`findLowestSatisfaction` 中 `energycells` 不参与瓶颈计算；产出 `energycells` 的模块不出现在 `purposeModules`。

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

### 7. Store 变更

- `buildGoals: Ref<BuildGoal[]>`（代替原 buildConstraints）
- `buildPlan: Ref<BuildPlan | null>`（含 `schemes`）
- `empireCurrentNetProduction: ComputedRef<Record<string, number>>`
- `computePlan()` 调用新算法
- 移除 `setTimeBudget`/`setCreditBudget`

### 8. UI 变更

| 组件 | 变更 |
|------|------|
| `BuildPlanConstraintsPanel.vue` | 移除预算输入，保留目标管理和计算按钮 |
| `BuildPlanPanel.vue` | 重写为方案卡片列表 |
| `BuildPlanStepsModal.vue` | **新增**浮动窗口，展示方案详细步骤 |
| `BlueprintProductionWorkbenchView.vue` | 集成新三栏布局 |
| `EmpireWareFlowsDashboard.vue` | 不变 |

### 9. 分析脚本

`analysis/scripts/findBuildPlanDefaults.ts` — 运行 `npx tsx analysis/scripts/findBuildPlanDefaults.ts`，输出导弹部件×5 在空帝国下的完整方案明细。
