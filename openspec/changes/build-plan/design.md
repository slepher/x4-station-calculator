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
  purposeModules: string[]   // 主要目的产物 ware ID（不含 energycells）
  primaryModuleIds: string[] // 产出 purposeModules 中 ware 的模块 ID 列表
  modules: SavedModule[]
  targetRates: Record<string, number>       // max_merge of all targetRateSources
  targetRateSources: BuildRateSource[]      // 各来源的建材需求速率
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

#### 目标合并规则

- **有 self-sufficient + 有其他目标**：合并所有其他目标 → 方案3 → 无视当前产能，直接生成方案1+2+3
- **无 self-sufficient + 有其他目标**：合并所有其他目标 → 方案3 → 当前产能足够则只出方案3，不足则生成方案1+2+3
- **仅 self-sufficient**：只生成方案1

#### self-sufficient 目标

```
expandGoalDependencies + calculateAutoFillModules → allMods
makeScheme → 方案1（自给自足）
```

#### 目标产量 / 目标建筑（production-rate / build-module）

所有其他目标合并后执行一次：

```
Phase 1 — allMods3：
  1. 合并所有目标的 expandGoalDependencies → merged3
  2. calculateAutoFillModules → allMods3
  3. R3 = computeBuildRates(allMods3)（仅 buildCost，无 fallback 到 inputs）
  4. purposeWareSet = 所有目标的产物 ware ID 集合
  5. 识别建材模块：allMods3 中输出在 R3 中的模块（不区分目标/非目标模块）
  6. R3' = allMods3 - 建材模块
  7. R3'M = computeBuildRates(R3')
  8. 无 self-sufficient 且当前产能 ≥ R3'M？→ 是则只显示方案3

Phase 2 — 方案2（目标建材）：
  9. whichWares = R3'M.keys，targetRates = R3
     R2 必须满足 R3 对 R3'M 全部 ware 的产能需求（用 R3 的速率，非 R3'M 速率）
  10. planProductionForRates + autoFill → allMods2
  11. R2 = computeBuildRates(allMods2)

Phase 3 — 方案1（自给自足）：
  12. r3Remaining = R3.keys \ R3'M.keys（R3 中有但 R3'M 中没有的 ware）
  13. scheme1Target = max_merge(R1建材, R2建材, r3Remaining)
  14. greedyFill(sources=[R1建材, R2建材, r3Remaining]) → 自给自足产线
```

**`computeBuildRates` 规则**：
- 仅使用 `mod.buildCost`，无 fallback 到 `mod.inputs`
- 模块无 `buildCost` 则跳过（不将运行时输入混入建材消耗）
- `energycells` 不参与 rates 计算

**`buildMatModuleIds` 规则**：
- 所有模块统一判断：输出在 R3 中的 → 建材模块
- 不区分目标模块/非目标模块（无 `goalModIds` 跳过逻辑）
- 建材模块从 R3' 中剔除，其 buildCost 归入 r3Remaining

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
- `energycells` 不参与 `computeBuildRates` 计算（过滤）
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

### 6. 方案标签

| 方案 | 标签 | 说明 |
|------|------|------|
| 方案1 | 自给自足 | 基础建材产线 |
| 方案2 | 目标建材 | 满足方案3建材需求的模块组 |
| 方案3 | 目标产线 | 目标产物系列模块 |

### 7. UI 方案卡片

方案卡片显示内容：
- **摘要行**：`4.09h │ 1.20M │ 20 steps`
- **主要模块**：`primaryModuleIds` 对应的模块（如 Missile Component Production ×5）
- **配套模块**：非 primaryModuleIds 的模块（如 Energy Cell Production ×1）
- **主要产出**：`netProduction` 中 purposeModules 对应 ware 的净产出速率（如 Missile Components 1337.6/h）
- **建材消耗**：`buildMaterialTotals`（过滤 energycells），如 Hull Parts ×79227

`primaryModuleIds` 由 `makeScheme` 根据 `purposeModules`（ware集合）匹配模块输出计算：
```typescript
const purposeWareSet = new Set(purposeModules)
const primaryModuleIds = mergedModules
  .filter(m => mod && Object.keys(mod.outputs).some(w => purposeWareSet.has(w)))
  .map(m => m.id)
```

### 8. UI 步骤明细

- **逐步展开**：每个 step 独立一行，不合并相同模块
- **累计数量**：只显示累计数（如 `2`），不显示 `+1=2`
- **材料明细**：CSS grid 列对齐，表头+数据行格式

表头列：
| Materials | ×Count | Stock | Self-prod/h | +Produced | Buy | Unit |

- **energycells 保留**：材料明细中不过滤 energycells

### 9. Store 变更

- `buildGoals: Ref<BuildGoal[]>`（代替原 buildConstraints，不再含 self-sufficient 变体）
- `selfSufficient: Ref<boolean>`（独立参数，持久化）
- `setSelfSufficient(val: boolean)` action
- `buildPlan: Ref<BuildPlan | null>`（含 `schemes`）
- `empireCurrentNetProduction: ComputedRef<Record<string, number>>`
- `computePlan()` 调用新算法
- 移除 `setTimeBudget`/`setCreditBudget`

### 10. selfSufficient 分离

`self-sufficient` 从 `BuildGoal[]` 分离为独立 boolean 参数：

- **类型变更**：`BuildGoal` 移除 `{ type: 'self-sufficient' }` 变体，仅保留 `production-rate` 和 `build-module`
- **Store**：新增 `selfSufficient: Ref<boolean>` + `setSelfSufficient` action，持久化到 localStorage
- **算法**：`CalculateBuildPlanInput` 新增 `selfSufficient: boolean`，算法从参数读取而非 goals 数组
- **UI**：左面板底部 checkbox 控制，与 production-rate / build-module 目标共存
- **目标合并规则**更新：
  - `selfSufficient=true + 有其他目标`：合并所有其他目标 → 方案3 → 无视当前产能，直接生成方案1+2+3
  - `selfSufficient=false + 有其他目标`：合并所有其他目标 → 方案3 → 当前产能足够则只出方案3
  - `selfSufficient=true + 无其他目标`：只生成方案1（自给自足）
  - `selfSufficient=false + 无其他目标`：无方案

### 11. 约束面板 UI 重构

#### 布局（上→下）

1. **BuildGoalSearchBox** — 组合搜索框
   - 样式对标 `MapSavePoiSearchControl.vue`：左侧搜索输入 + 右侧 category dropdown
   - Category 选项：product（商品）/ module（模块）
   - 切换 category 时清空搜索输入
   - Teleport to body 弹层，显示分组搜索结果
   - 点击结果直接添加到目标列表（不经过中间确认）

2. **目标卡片列表** — `WarePlanningItem` 组件
   - 样式对标 `StationPlanningItem`：颜色条 + 名称 + 数量输入 + × 删除
   - 颜色条：使用 `module_group.color_rgb`（通过 `X4Ware.group` → `localizedModuleGroupsMap` 映射）
   - production-rate 目标：显示 ware 翻译名，数量为 ratePerHour（整数，min=1）
   - build-module 目标：显示 module 翻译名，数量为 count（整数，min=1）
   - 点击搜索结果添加时默认数量：
     - production-rate：`findModuleForWare(wareId, racePreference).outputs[wareId]` 的整数值
     - build-module：1

3. **计算按钮** — 保持

4. **self-sufficient checkbox** — 计算按钮下方，勾选即启用，与目标共存

5. **方案计数 + warnings** — 保持

#### BuildGoalSearchBox 弹层

- **product 模式**：分组显示 ware，用 `X4Ware.group` 映射到 `localizedModuleGroupsMap` 做分组 header
- **module 模式**：复用 `generateFilteredModulesGrouped()` 分组逻辑
- 每个结果项：color-indicator（module_group.color_rgb）+ 翻译名 + DLC tag（active/inactive）

#### 涉及新文件

| 文件 | 说明 |
|------|------|
| `BuildGoalSearchBox.vue` | 组合搜索框（左input+右类型下拉+Teleport弹层） |
| `WarePlanningItem.vue` | 目标卡片（对标StationPlanningItem样式） |
| `src/store/logic/searchWare.ts` | `generateFilteredWaresGrouped()` 商品分组搜索 |

#### 涉及类型变更

| 类型 | 说明 |
|------|------|
| `LocalizedX4Ware` | 含 `localeName`，对标 `LocalizedX4Module` |
| `WareGroupResult` | 含 `group` + `displayLabel` + `wares`，对标 `ModuleGroupResult` |
| `GroupedWareItem` | 含 `displayLabel` + `moduleGroup`，对标 `GroupedModuleItem` |

#### 涉及 Store 变更

| Store | 变更 |
|-------|------|
| `useGameDataStore` | 新增 `localizedWaresMap` ref + 暴露 |
| `useGameData.ts` | 新增 `buildLocalizedWaresMap()` |

### 12. i18n

`sector.build_plan` 命名空间，新增 key：
- `primary_modules` / `derived_modules`
- `main_production` / `build_materials`
- `produced` / `stock` / `self_prod` / `buy` / `unit_price`
- `build` / `cumulative` / `step_cost` / `cumulative_cost`

### 13. 分析脚本

`analysis/scripts/findBuildPlanDefaults.ts`

```bash
# 默认：导弹部件×5
npx tsx analysis/scripts/findBuildPlanDefaults.ts

# 指定模块和产量目标
npx tsx analysis/scripts/findBuildPlanDefaults.ts --module="Missile Component Production*5" --ware="Hull Parts*1000"
```

- `--module="Name*N"` — 模块名称（`module.name`）模糊匹配，N 为数量
- `--ware="Name*R"` — 商品名称（`ware.name`）模糊匹配，R 为每小时产量
