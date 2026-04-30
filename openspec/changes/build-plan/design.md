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

A+B 视为联合模块，内部通过 greedyFill 直接满足 C 的建材消耗：

```
1. C' = C 剔除产出在 C 的 buildCost 中的模块（建材模块）
2. targetRates = computeBuildRates(C') 的建材消耗速率
3. greedyFill(sources=[targetRates]) → 联合模块（含 A+B）
4. 输出：方案1（A+B 联合模块）、方案2（C）
```

A+B 的 autoFill 运营模块消耗由 A 的产出（电子黏土+船体部件）覆盖——greedyFill 在迭代中自动处理。

#### 耦合迭代自举（BootstrapMode.CoupledIterative）

A↔B 外层循环迭代，所有内部迭代均使用 greedyFill：

```
1. C' = C 剔除建材模块
2. R_C = computeBuildRates(C')

3. 第一轮：
   3a. greedyFill(sources=[R_C]) → A 模块（自举阶段，外部供应 B 产出）
   3b. autoFill(A) → A_autoFill
   3c. 计算 B 的需求：
       - R_A_mat = A.buildCost + A_autoFill.buildCost 中 B 产出部分
       - R_C_mat = R_C 中 B 产出部分
   3d. greedyFill(sources=[
         { label: "A建材需求(B产出)", rates: filterBOutputs(R_A_mat) },
         { label: "C建材需求(B产出)", rates: filterBOutputs(R_C) }
       ]) → B 模块（& 约束：同时满足 A 和 C）
   3e. autoFill(B) → B_autoFill

4. 迭代轮（A 和 B 各自所有 source 满足率 ≥ 100% 时收敛）：
   4a. R_A_demand = [
         source_label: "C+B",
         rates: R_C + computeBuildRates(B+B_autoFill)  // C 和 B 对 A 产出的消耗（数值相加）
       ],
       [
         source_label: "A_autoFill",
         rates: computeBuildRates(A_autoFill)  // A 自身运营模块对 A 产出的消耗
       ]
   4b. 检查 A 产出对 R_A_demand 所有 source 的满足率 ≥ 100%？
   4c. 检查 B 产出对 [A建材需求(B产出), C建材需求(B产出)] 所有 source 的满足率 ≥ 100%？
   4d. 全部满足 → 收敛，否则：
   4e. greedyFill(sources=R_A_demand) → 追加 A 模块
   4f. 回到 3c 重新计算 B

5. 输出：方案1（A）、方案2（B）、方案3（C）
```

迭代收敛后 A 的产出同时满足 (C+B) & A_autoFill 两个 source 的约束。

#### 孤立特种自举（BootstrapMode.IsolatedSpecialized）

B→A→C 单向顺序，无循环依赖：

```
1. 第一轮 — B：
   1a. 由 C 的建材消耗估算 A 的材料需求
   1b. greedyFill(sources=[A 材料需求中 B 的产出]) → B 模块（外部供应 A 产出）
   1c. autoFill(B) → B_autoFill

2. 第二轮 — A（自迭代）：
   2a. R_A = computeBuildRates(C) + computeBuildRates(A_autoFill)
   2b. greedyFill(sources=[R_A]) → A 模块（仅需满足 C + 自身）
   2c. autoFill(A) → A_autoFill
   2d. 更新 A 检查满足率 → 不满足则迭代追加 A

3. 第三轮 — C：
   3a. 输出方案3（C 目标产线）

4. 输出：方案1（B）、方案2（A）、方案3（C）
```

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

**多 source 满足率检查**：不只检查 targetRates（max_merge 后的），每个 source 独立检查其所有 ware 的满足率 ≥ 100%。这是 `&`（且）约束的实现方式。

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
npx tsx analysis/scripts/findBuildPlanDefaults.ts

# 指定模块和产量目标
npx tsx analysis/scripts/findBuildPlanDefaults.ts --module="Missile Component Production*5" --ware="Hull Parts*1000"
```

- `--module="Name*N"` — 模块名称（`module.name`）模糊匹配，N 为数量
- `--ware="Name*R"` — 商品名称（`ware.name`）模糊匹配，R 为每小时产量
