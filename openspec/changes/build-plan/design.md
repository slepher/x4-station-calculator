# build-plan 设计

## 问题

Blueprint overview 视图当前仅显示单一线性建造步骤列表，缺少方案选择和对比能力。用户无法基于当前帝国产能获得多个递进建造方案。

## 方案

### 1. 类型定义

```typescript
enum BootstrapMode {
  None = 'none',                    // 不自举
  Joint = 'joint',                  // 联合自举
  CoupledIterative = 'coupled',     // 耦合迭代自举
  IsolatedSpecialized = 'isolated', // 孤立特种自举
}

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

**输入**: `CalculateBuildPlanInput`（goals、currentModules、currentNetProduction、settings、modulesMap、waresMap、bootstrapMode: BootstrapMode）

**输出**: `BuildPlan` → `schemes: BuildScheme[]`

#### 通用分支逻辑

`bootstrapMode` 决定方案数量和 bootstrap 层算法。所有模式共用目标产线 C 的初始计算：

```
1. 合并所有 production-rate / build-module 目标
2. expandGoalDependencies → merged3
3. calculateAutoFillModules → allMods3（目标产线）
4. C = allMods3
```

无目标时仅当 bootstrapMode ≠ None 才生成方案，否则空。

#### 不自举（BootstrapMode.None）

无 bootstrap 层：
- 当前产能 ≥ computeBuildRates(C)？→ 只输出方案3（C）
- 不足 → 输出方案2（输入建材）+ 方案3

#### 联合自举（BootstrapMode.Joint）

D = A+B 联合模块，通过 greedyFill 直接满足 C 的建材消耗：

```
1. C = expandGoalDependencies + autoFill → 完整目标产线（不做任何剔除）
2. targetRates = computeBuildRates(C) 的建材消耗速率
3. greedyFill(sources=[targetRates])
   → D 模块（含 A+B），自举约束自动确保 D 自身建材消耗被覆盖
4. 输出：方案1（D 联合自举）、方案2（C）
```

greedyFill 内部的 selfDemand 自动推导：D 已建模块产出 ∩ D 的 buildCost 消耗（剔除 energycells）→ 自举约束的 ware 集合。

#### 耦合迭代自举（BootstrapMode.CoupledIterative）

A↔B 外层循环迭代：

```
1. R_C_raw = computeBuildRates(C)
   建材模块 = A+B（产出 A ware 和 B ware 的模块）
   - A 模块产出：advancedcomposites, plasmaconductors
   - B 模块产出：hullparts, claytronics
   C' = C 剔除建材模块（剔除产出 A ware 或 B ware 的模块）
   wareList = computeBuildRates(C') 的 buildCost ware keys
   R_C = R_C_raw 过滤仅保留 wareList 中的 ware
   R_C_rest = R_C_raw 中不属于 wareList 的部分

   **建材模块定义**：A+B = 产出 A ware（advancedcomposites, plasmaconductors）或 B ware（hullparts, claytronics）的模块。
   **wareList 定义**：C'（非建材模块）的 buildCost wares = B 能生产的 ware（hullparts, claytronics）。
   **R_C 定义**：C 建材消耗中 B 能生产的 wares 的消耗率，由 A 满足。
   **R_C_rest 定义**：C 建材消耗中 B 不能生产的 wares 的消耗率（advancedcomposites, plasmaconductors），由 B 满足。

2. A 初始：greedyFill(sources=[R_C], fullBootstrap=false)
   → A 模块（满足 C 建材消耗中 B 能生产的部分：hullparts, claytronics）

3. B 需求（& 约束）：
   source1 = A buildCost 中 A 不能自产的 wares
   source2 = R_C_rest（C 建材消耗中 B 不能生产的部分：advancedcomposites, plasmaconductors）
   B 需同时满足两者 → demand[w] = max(source1[w] || 0, source2[w] || 0)
   一次性计算 B 主要模块列表（无 autoFill）

4. 迭代轮（& 约束）：
   greedyFill(sources=[C建材需求, B建材需求], fullBootstrap=false) → 追加 A
   （A 需同时满足 C 和 B 的建材需求，两者独立约束）
   重算 B（& 约束）
   B 主要模块产线数量不变？→ 退出
   B 变了 → 继续

5. 输出显示（三个独立 & 约束）：
   A 方案 targetRateSources:
   - C建材需求（materials 来自 C'）
   - B建材需求（materials 来自 B，过滤 wareList）
   - A_self_demand（materials 来自 A，过滤 wareList）
   
   输出：方案1（A）、方案2（B）、方案3（C）
```

**关键区分**：
- **迭代过程**：greedyFill 传入 C 和 B 作为独立 source（& 约束）
- **最终显示 & 约束**：所有方案输出均采用 `&`（独立约束）模式，每个约束独立检查满足率

**重要声明**：所有方案的最终输出均采用 `&`（独立约束）模式，不包含 `+`（数值相加）的约束。迭代过程和最终显示均为独立约束。

**greedyFill fullBootstrap 参数**：
- `true`（联合自举）：selfDemand = built 产出 ∩ built buildCost（全自举，剔除 energycells）
- `false`（耦合迭代）：selfDemand = built buildCost 中仅 source rates 包含的 ware

**R_C 过滤逻辑**：C' 仅用于推导 wareList，R_C 是对 R_C_raw 按 wareList 过滤，剔除建材模块自身 buildCost 对应的 ware。

#### 嵌套联合自举（BootstrapMode.NestedJoint）

A 先计算 → D（A+B 联合）自举 → C 目标产线：

```
1. R_C_raw = computeBuildRates(C)
   建材模块 = A+B（产出 A ware 和 B ware 的模块）
   - A 模块产出：hullparts, claytronics（A ware）
   - B 模块产出：advancedcomposites, plasmaconductors（B ware）
   C' = C 剔除建材模块（剔除产出 A ware 或 B ware 的模块）
   wareList = computeBuildRates(C') 的 buildCost ware keys
   R_C = R_C_raw 过滤仅保留 wareList 中的 ware
   R_C_rest = R_C_raw 中不属于 wareList 的部分

   **建材模块定义**：A+B = 产出 A ware（hullparts, claytronics）或 B ware（advancedcomposites, plasmaconductors）的模块。
   **wareList 定义**：C'（非建材模块）的 buildCost wares = A 能生产的 ware（hullparts, claytronics）。
   **R_C 定义**：C 建材消耗中 A 能生产的 wares 的消耗率（hullparts, claytronics）。
   **R_C_rest 定义**：C 建材消耗中 B 能生产的 wares 的消耗率（advancedcomposites, plasmaconductors）。

2. A 计算（一次性计算 + autoFill）：
   A_demand = R_C（C 建材消耗中 A 能生产的部分）
   aPrimaryModules = computeAModules(A_demand)（一次性计算，无 greedyFill）
   aAutoFill = calculateAutoFillModules(aPrimaryModules)
   aModules = merge(aPrimaryModules + aAutoFill)

3. D = A+B 联合自举：
   D 初始需求 = A buildCost + C 的 R_C_rest
   greedyFill(
     sources=[
       {label: 'A建材需求', rates: computeBuildRates(aModules)},
       {label: 'C_rest建材需求', rates: R_C_rest}
     ],
     fullBootstrap=true,
     currentEmpireModules=currentModules
   )
   → D 自动添加 A+B 模块，从空开始逐个添加
   （D 自身建材消耗中 D 能产出的部分需自给，fullBootstrap=true）
   
3. 输出显示（2 个方案）：
   D 方案 targetRateSources:
   - A建材需求（rates: A buildCost rates, materials: A buildCost 总量）
   - C_rest建材需求（rates: R_C_rest, materials: C buildCost 中 B ware 的总量）
   - D_self_demand（rates: D buildCost 中 D 能产出的 ware, materials: D buildCost 总量）
   
   A 方案（从 D 中提取）：
   - C建材需求（rates: R_C, materials: C' buildCost 总量）
   
   C 方案：
   - 目标产线

输出：方案1（D 联合自举）、方案2（A 子集）、方案3（C 目标产线）
```

**关键区分**：
- **D greedyFill 从空开始**：自动添加 A+B 模块，fullBootstrap=true
- **A 方案从 D 提取**：输出时从 D 中提取 A 类模块（产出 hullparts/claytronics）
- **A 和 B 独立约束**：R_C & R_C_rest，不用 + 连接
- **所有模块都需要 autoFill**：D greedyFill 内部 autoFill 处理运行时输入

#### 孤立特种自举（BootstrapMode.IsolatedSpecialized）

B 先建 → A 后建，但计算顺序 A 先算 → B 后算（B 需根据 A 的需求确定）：

```
1. R_C_raw = computeBuildRates(C)
   C' = C 剔除所有产出在 C buildCost 中的模块
   wareList = computeBuildRates(C') 的 buildCost ware keys
   R_C = R_C_raw 过滤仅保留 wareList 中的 ware
   R_C_rest = R_C_raw 中不属于 wareList 的部分

2. 计算 A（用 greedyFill）：
   greedyFill(sources=[R_C], fullBootstrap=false)
   → A 模块

3. 计算 B（一次性计算，不用 greedyFill，不自举）：
   B_demand_source1 = R_C_rest
   B_demand_source2 = A 模块 buildCost 中不属于 A 产出的 wares
   B_demand = { source1: R_C_rest, source2: B_demand_source2 }
   （& 表示两个来源独立满足，B 必须同时满足两者）
   根据 B_demand 一次性计算 B 模块列表

4. 输出：方案1（B 先建）、方案2（A 后建）、方案3（C）
```

关键：B 需同时满足（&）两个约束源——R_C_rest 和 A 的 buildCost 中 A 不能自产的部分。

#### `computeBuildRates` 规则

**`computeBuildRates` 规则**：
- 仅使用 `mod.buildCost`，无 fallback 到 `mod.inputs`
- 模块无 `buildCost` 则跳过（不将运行时输入混入建材消耗）
- `energycells` 不参与 rates 计算

**`buildMatModuleIds` 规则**：
- 所有模块统一判断：输出在 R3 中的 → 建材模块
- 不区分目标模块/非目标模块（无 `goalModIds` 跳过逻辑）
- 建材模块从 R3' 中剔除，其 buildCost 归入 r3Remaining

### 3. greedyFill（通用迭代引擎）

所有自举模式均使用 greedyFill 作为内部迭代引擎，输入 targetRateSources 因模式而异。

```
输入: targetRateSources: BuildRateSource[]（各来源的建材需求速率）
      fullBootstrap: boolean（true=全自举，false=仅自举 source 包含的 ware）
内部: targetRates = max_merge(all sources)

seed: 如果 targetRates 含 hullparts, 第一个瓶颈固定为 hullparts

循环（最多 60 次）:
  1. contextNet = net(currentEmpire + fullBuilt)
     fullBuilt = built + autoFill
  2. selfWares:
     fullBootstrap=true: fullBuilt 产出 ∩ fullBuilt 的 buildCost 消耗（剔除 energycells）
     fullBootstrap=false: fullBuilt 的 buildCost 消耗中仅 source rates 包含的 ware（剔除 energycells）
     selfDemand = computeBuildRates(fullBuilt) 中属于 selfWares 的消耗速率
  3. allSources = [...targetRateSources, { label: "self_demand", rates: selfDemand }]
  4. allMet = 对 allSources 中每个 source，contextNet[ware] >= source.rates[ware] for all wares?
  5. 全部满足 → 退出
  6. 否 → findLowestSatisfaction(contextNet)
     从 fullBuilt 的 buildCost 消耗率中找满足率最低的 ware
  7. 添加一个该 ware 的生产者到 builtSoFar
  8. autoFill(builtSoFar) → 当前支持模块
  9. deltaAuto = 当前 autoFill - 前一轮 autoFill（新模块）
  10. group = [新生产者, ...deltaAuto]
```

**greedyFill fullBootstrap 参数**：
- `true`（联合自举）：selfWares = fullBuilt 产出 ∩ fullBuilt buildCost 消耗（剔除 energycells）。D 的 buildCost 消耗了 D 自己能生产的建材，D 必须自给覆盖。
- `false`（耦合迭代/孤立特种）：selfWares = fullBuilt buildCost 消耗中仅 targetRateSources 各 source.rates 包含的 ware（剔除 energycells）。仅自举外部明确需要的 ware，不自举额外产出。
- `findLowestSatisfaction` 同样过滤：当 `fullBootstrap=false` 时，只考虑 sourceWares 的建材消耗率作为瓶颈候选。

**多 source 满足率检查**：每个 source（含 selfDemand）独立检查其所有 ware 的满足率 ≥ 100%。这是 `&`（且）约束的实现方式。

**能量电池排除**：
- `energycells` 不参与 `computeBuildRates` 计算（过滤）
- `findLowestSatisfaction` 中 `energycells` 不参与瓶颈计算
- 产出 `energycells` 的模块不出现在 `purposeModules`

**BuildRateSource 建材总量**：
- `BuildRateSource` 类型新增 `materials?: Record<string, number>` 字段
- 每个 source 显示对应的建材总量，而非方案级别的总量
- 例如 A 方案显示：C建材需求（C 的 materials）、B建材需求（B 的 materials）、A_self_demand（A 的 materials）

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

### 6. 方案标签（因自举模式而异）

| 自举模式 | 方案数 | 方案1 | 方案2 | 方案3 |
|---------|-------|-------|-------|-------|
| 不自举 | 1 | - | - | 目标产线 |
| 联合自举 | 2 | A+B 联合自举 | 目标产线 | - |
| 耦合迭代自举 | 3 | A 建材自举 | B 特种产线 | 目标产线 |
| 孤立特种自举 | 3 | B 特种孤岛 | A 建材自举 | 目标产线 |

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
- `bootstrapMode: Ref<BootstrapMode>`（独立参数，持久化，默认 `BootstrapMode.None`）
- `setBootstrapMode(mode: BootstrapMode)` action
- `buildPlan: Ref<BuildPlan | null>`（含 `schemes`）
- `empireCurrentNetProduction: ComputedRef<Record<string, number>>`
- `computePlan()` 调用新算法，传入 `bootstrapMode`
- 移除 `setTimeBudget`/`setCreditBudget`

### 10. 通用自举模式

`self-sufficient` checkbox 替换为 `BootstrapMode` 下拉框：

- **类型变更**：新增 `BootstrapMode` 枚举，`BuildGoal` 移除 `{ type: 'self-sufficient' }` 变体
- **Store**：新增 `bootstrapMode: Ref<BootstrapMode>` + `setBootstrapMode` action，持久化到 localStorage
- **算法**：`CalculateBuildPlanInput` 新增 `bootstrapMode: BootstrapMode`，算法根据模式走不同分支
- **UI**：左面板底部 dropdown 控制，与 production-rate / build-module 目标共存

#### 目标合并规则（通用）

- **其他目标存在 + bootstrapMode ≠ None**：无视当前产能，生成 bootstrap 方案 + 方案3
- **其他目标存在 + bootstrapMode = None**：当前产能足够则只出方案3，不足则出方案2+3
- **无其他目标 + bootstrapMode ≠ None**：生成 bootstrap-only 方案（无目标产线）
- **无其他目标 + bootstrapMode = None**：无方案

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

4. **通用自举模式 dropdown** — 计算按钮下方，四个选项：不自举、联合自举、耦合迭代自举、孤立特种自举

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
- `bootstrap_mode` / `bootstrap_none` / `bootstrap_joint` / `bootstrap_coupled` / `bootstrap_isolated`
- 各模式方案标签：`scheme_label_joint_a` / `scheme_label_joint_c` 等

### 13. 分析脚本

`analysis/scripts/findBuildPlanDefaults.ts`

```bash
# 默认：导弹部件×5
npx vite-node analysis/scripts/findBuildPlanDefaults.ts

# 指定模块和产量目标
npx vite-node analysis/scripts/findBuildPlanDefaults.ts --module="Missile Component Production*5" --ware="Hull Parts*1000"
```

- `--module="Name*N"` — 模块名称（`module.name`）模糊匹配，N 为数量
- `--ware="Name*R"` — 商品名称（`ware.name`）模糊匹配，R 为每小时产量
