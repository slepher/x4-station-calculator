# build-plan-production-line 设计

## 目标

将建材产线计算提前到勾上 checkbox 时执行，C 按产线分配拆分，scheme 按建材/生产分组展示，依赖图融入 isolated 扩展。

## 领域术语

| 术语 | 含义 |
|------|------|
| 建材产线 | 依赖图中的产线，产出 C 或其他产线的 buildCost 所需建材 |
| 生产产线 | C 拆分后不属于建材分组的产线，产出目标产品 |
| 重叠产线 | 同时出现在依赖图和产线分配中的产线（groupId 相同） |
| isolated 扩展 | 依赖图 BFS 中检查产线 isolated 节点，搜索产出该 ware 的产线并加入图 |
| 提前计算 | 勾上 checkbox 时执行依赖图 + SCC + 分配，不等点击"计算" |
| 叠加相加 | 重叠产线的建材需求速率 + 生产需求速率直接相加 |
| ware（手工） | 用户手动添加的 ware 需求，同 wareId 合并（速率叠加） |
| module（手工） | 用户手动添加的模块，同 moduleId 合并（数量叠加） |
| derived ware | 系统自动推导的需求，同 wareId 合并（仅标记存在，无数值） |
| derived-build-material | 依赖图 BFS 中沿连线扩散发现的建材需求（`outputBuildTags` / `buildMaterialTags`） |
| derived-production | 依赖图 BFS 中通过 isolated 扩展发现的产出需求（`findGroupProducingWare`） |

## 问题

当前 build-plan 的建材产线计算在点击"计算建造方案"时才执行，用户无法在勾上"建材产线"后预览分配结果。C 作为整体 scheme 无法反映各产线的独立建造情况。依赖图仅沿 outputBuildTags 扩散，不覆盖产线 isolated 节点对应的上游产线。

## 方案

### 1. 核心架构

C 按产线分配拆分是**始终执行**的行为，不依赖建材产线 checkbox。建材产线 checkbox 控制的是"是否启用依赖图 + derivedWare + 分组展示"。

#### 勾上 checkbox（提前计算）

```
勾上 checkbox
  │
  ├─ C = expandGoalDependencies + autoFill（现有逻辑）
  │
  ├─ buildFlowPlanGraph(C, buildFlowView, groups) → 依赖图（含 isolated 扩展）
  │     │
  │     └─ SCC 检测
  │
  ├─ 建材产线分配预览（derived goals from isolated）
  │
  └─ 存入 store（buildFlowPlanGraphResult / buildFlowPlanAllocations）
```

#### 点击"计算建造方案"（两种模式共享同一入口）

```
点击"计算建造方案"
  │
  ├─ computeProductionLineAllocation(goals, flowGroups, buildFlowView)
  │     ├─ generateDerivedGoals() — upstream walk 找 isolated
  │     ├─ 三层匹配分配产线（L1 build-flow / L2 manual / L2.5 isolated / L3 unmatched）
  │     └─ ProductionLineAllocation[]（每产线一组）
  │
  ├─ splitCToLineSchemes(allocations, ...)
  │    按产线分配拆分为多个子 scheme（每产线独立 expand + autoFill）
  │    → 三域合并到已有 plan（ware/module 保留 + 叠加，derivedWare 替换）
  │
  ├─ [若有 graph] 重叠产线合并需求 → derivedWare 域合并
  │
  └─ makeSchemes() → 分组输出
       ├── [勾选时] 建材产线分组 + 生产产线分组
       └── [未勾选时] 单一分组（全为生产产线，无 derivedWare）
```

#### 产线 plan 三域合并模型

每条产线只有一个 plan，plan 内部按来源分三个隔离的合并域：

| 域 | 来源 | 带数值？ | 合并规则 | 重算行为 |
|----|------|----------|----------|----------|
| **ware** | 用户手动添加的 ware 需求 | 有（`ratePerHour`） | 同 wareId 速率叠加 | **保留** |
| **module** | 用户手动添加的模块 | 有（`count`） | 同 moduleId 数量叠加 | **保留** |
| **derivedWare** | 系统自动推导的下游需求 | **无**（仅标记存在，`ratePerHour=0`） | 同 wareId 合并（存在即标记） | **整份替换** |

- **域间不交叉**: ware 不与 derivedWare 合并，ware 也不与 module 合并
- **共存**: 同一 ware 可同时在 ware 域和 derivedWare 域存在，分别显示互不覆盖
- **derivedWare 无数值**: derivedWare 仅标记"产线需要提供该 ware"并参与 module 计算，不计入最终显示速率
- **derivedWare 两个子类型**:
  - `derived-build-material` — 沿 `outputBuildTags` / `buildMaterialTags` 连线扩散发现的建材需求
  - `derived-production` — 通过 isolated 扩展（`findGroupProducingWare`）发现的产出需求
  - 两者在 merge 行为上无区别（同属 derivedWare 域），但在 UI 上显示不同 tag（"建材"/"产出"）

```
一条产线 plan:
  ├─ ware:        [HullParts=30/m,  Claytronics=10/m]    ← manual, 保留
  ├─ module:      [HullPartsFab×2,  ClaytronicsFab×1]    ← manual, 保留
  └─ derivedWare: [HullParts, EnergyCells]                ← 重算时整份替换，仅标记存在
```

### 2. 依赖图构建算法变更

在现有 `buildFlowPlanGraph` 的 BFS 中融入 isolated 扩展：

```
输入: cModules, buildFlowView, groups(所有 logic-flow groups), modulesMap, waresMap
输出: BuildFlowPlanGraph

function buildFlowPlanGraph(cModules, buildFlowView, groups, modulesMap, waresMap):
  graph = { nodes: new Map(), edges: [], sccGroups: [] }
  graph.cModules = cModules
  graph.cBuildCostRates = computeBuildRates(cModules)
  cWares = Object.keys(graph.cBuildCostRates).filter(w => w !== 'energycells')

  // BFS queue: { wareIds, fromKey, fromLabel, isIsolatedExpansion }
  queue = [
    { wareIds: cWares, fromKey: '__C__', fromLabel: 'C buildCost', isIsolatedExpansion: false }
  ]
  addedGroups = new Set<string>()

  while queue not empty:
    { wareIds, fromKey, fromLabel, isIsolatedExpansion } = queue.shift()

    for each wid in wareIds:
      // 查找连线来源
      if !isIsolatedExpansion:
        conn = findOutputBuildConnection(wid, buildFlowView)
              || findLineBuildMaterialConnection(wid, buildFlowView, fromKey)
      else:
        conn = findGroupProducingWare(wid, groups, manual > auto)

      if !conn: continue

      targetKey = conn.sourceGroupId

      if !addedGroups.has(targetKey):
        // 新建产线节点
        node = {
          lineGroupId: targetKey,
          lineName: getGroupDisplayName(targetKey),
          trackedWares: new Set([wid]),
          modules: [], moduleIds: [], isSelfBootstrap: false,
          netProduction: {}
        }
        graph.nodes.set(targetKey, node)
        addedGroups.add(targetKey)

        // 1) 沿 outputBuildTags/lineBuildMaterial 继续扩散
        //    根据 B 是否在 buildFlowGroups 中决定扩散方式：
        //    无连线时忽略，不回退搜索其他来源，视为外部供应
        if isGroupInBuildFlowView(targetKey, buildFlowView):
          // B 在建材产线区有定义 → B 的 buildMaterialTags 作为建材来源
          // 只取有连线的 buildMaterialTags（无连线 = 不考虑建材如何解决）
          lineBuildWares = getGroupBuildMaterialWaresWithConnection(targetKey, buildFlowView)
        else:
          // B 不在建材产线区 → B 的建材来源通过 outputBuildTags 连线查找
          // 无连线 = 忽略，视为外部供应
          lineBuildWares = getGroupBuildCostWaresWithConnection(targetKey, buildFlowView)

        if lineBuildWares.length > 0:
          queue.push({
            wareIds: lineBuildWares,
            fromKey: targetKey,
            fromLabel: node.lineName + ' buildCost',
            isIsolatedExpansion: false
          })

        // 2) 检查 isolated 节点 → 搜索上游产线
        isolatedWares = getGroupIsolatedWares(targetKey, groups)
        if isolatedWares.length > 0:
          queue.push({
            wareIds: isolatedWares,
            fromKey: targetKey,
            fromLabel: node.lineName + ' isolated',
            isIsolatedExpansion: true
          })
      else:
        // 产线已存在，扩充追踪 ware
        node = graph.nodes.get(targetKey)
        node.trackedWares.add(wid)

      // 添加边
      graph.edges.push({
        fromLineKey: fromKey,
        toLineKey: targetKey,
        wareId: wid,
        sourceLabel: fromLabel
      })

  // SCC 识别
  graph.sccGroups = findSCCs(graph)

  return graph
```

**`findGroupProducingWare`（共用函数）**: 在所有 logic-flow groups 中搜索产出指定 ware 的产线：
- 先搜 manual 节点（`source === 'manual' && !isIsolated && node.wareId === wareId`）
- 再搜 auto 节点
- 返回第一个匹配的 `{ sourceGroupId }`
- **共用调用方**：
  1. 建材产线 isolated 扩展（本文档，`buildFlowPlanGraph` BFS）
  2. 非建材产线的 derived goal 搜索（`computeProductionLineAllocation` 中 `walkUpstream` → `findIsolatedNode` 重构为调用此函数）
- 提取为独立导出函数，便于后续统一修改搜索算法（如优先级规则、搜索范围等）
- 建议位置：`src/store/logic/productionLineSearch.ts`（新建）或 `src/store/logic/computeProductionLineAllocation.ts`（提取并导出）

**`getGroupIsolatedWares`**: 返回指定 groupId 的所有 isolated 节点的 wareId 列表。

**`isGroupInBuildFlowView`**: 判断 groupId 是否在 buildFlowGroups 中存在（建材产线区是否有定义）。

**`getGroupBuildMaterialWaresWithConnection`**: 返回指定 groupId 的 buildMaterialTags 中**有连线**的 wareId 列表。无连线的 buildMaterialTag 视为"不考虑建材如何解决"，不纳入扩散。

**`getGroupBuildCostWaresWithConnection`**: 对不在 buildFlowGroups 中的产线，返回其 buildCost 中通过 outputBuildTags **有连线**的 wareId 列表。无连线 = 忽略，视为外部供应。

### 3. Store 变更

#### 新增状态

```typescript
// useBlueprintProductionStore

// 提前计算结果
const buildFlowPlanGraphResult = shallowRef<BuildFlowPlanGraph | null>(null)
const buildFlowPlanAllocations = ref<ProductionLineAllocation[]>([])

// 计算状态
const buildFlowPlanLoading = ref(false)
```

#### 提前计算函数

```typescript
function computeBuildFlowPlanPreview(): void {
  if (!buildFlowMode.value) {
    buildFlowPlanGraphResult.value = null
    buildFlowPlanAllocations.value = []
    return
  }

  const deps = getComputeDeps()
  if (!deps) return

  buildFlowPlanLoading.value = true
  try {
    // Step 1: C modules
    const goals = buildGoals.value
    const baseModules = goals.flatMap(g => expandGoalDependencies(g, deps.modulesMap, deps.waresMap))
    const mergedC = mergeModules(baseModules)
    const autoFillC = calculateAutoFillModules({ ... })
    const cModules = mergeModules([...mergedC, ...autoFillC.autoIndustryModules, ...autoFillC.autoHabitationModules])

    // Step 2: Build dependency graph (含 isolated 扩展)
    const buildFlowView = getBuildFlowView()
    const graph = buildFlowPlanGraph(cModules, buildFlowView, logicFlowGroups, deps.modulesMap)
    buildFlowPlanGraphResult.value = graph

    // Step 3: 建材产线分配预览
    buildFlowPlanAllocations.value = computeBuildFlowPlanAllocations(graph, cModules, deps)
  } finally {
    buildFlowPlanLoading.value = false
  }
}
```

#### watch 触发

```typescript
watch(
  [buildFlowMode, buildGoals, logicFlowDependentData],
  () => { computeBuildFlowPlanPreview() },
  { immediate: true }
)
```

#### computePlan 变更

无论是否勾选建材产线，都走同一入口：

```
computePlan(goals):
  // Phase 1: 产线分配（始终执行）
  allocs = computeProductionLineAllocation(goals, flowGroups, buildFlowView)

  // Phase 2: C 按产线拆分（始终执行）
  lineSchemes = splitCToLineSchemes(goals, allocs, ...)

  // Phase 3: 若有依赖图（勾选建材产线时），处理 derivedWare + 重叠 + 分组
  graph = buildFlowPlanGraphResult.value
  if graph:
    lineSchemes = mergeOverlappingLines(graph.nodes, lineSchemes)
    // 为每产线补充 derivedWare 域
    lineSchemes = applyDerivedWare(lineSchemes, graph)
    // 分组输出：建材产线 + 生产产线
    buildPlan.value = makeSchemesWithGroups(lineSchemes, graph)
  else:
    // 无依赖图：不分组，无 derivedWare
    buildPlan.value = { schemes: lineSchemes, groups: 'single' }

  // 按三域模型合并到已有 plan：
  //   derivedWare → 整份替换
  //   ware/module → 保留原有，新增叠加
  buildPlan.value = mergeIntoExistingPlan(buildPlan.value, existingPlan)
```

### 4. C 按产线分配拆分

#### 合并规则

对每条产线，C 拆分的结果按三域模型写入 plan：

| 域 | 来源 | 行为 |
|----|------|------|
| **ware** | C 拆分中的 user goals | 同产线已有 ware 域合并（同 wareId 速率叠加），**不覆盖** |
| **module** | C 拆分中的 autoFill 模块 | 同产线已有 module 域合并（同 moduleId 数量叠加），**不覆盖** |
| **derivedWare** | 来自依赖图 trackedWares 的 `derived-rate` goal | **整份替换**该产线原有 derivedWare 域 |

关键约束：
- 同一条产线**不会**因多次触发计算而产生多个 plan
- 每次重算只刷新 derivedWare 域，ware/module 域保留用户手工内容
- derivedWare 域内同 wareId 合并（去重标记，无数值叠加）

#### 拆分逻辑

```
输入: goals, allocations(ProductionLineAllocation[]), modulesMap, waresMap
输出: ProductionLineScheme[]

function splitCToLineSchemes(goals, allocations, modulesMap, waresMap):
  result = []

  for each alloc in allocations:
    if alloc.isUnmatched: continue  // 待规划产线单独处理

    // 该产线的 goals
    lineGoals = alloc.goals

    // 独立计算模块
    baseModules = lineGoals.flatMap(g => expandGoalDependencies(g, modulesMap, waresMap))
    merged = mergeModules(baseModules)
    autoFill = calculateAutoFillModules({ plannedModules: merged, ... })
    lineModules = mergeModules([...merged, ...autoFill.autoIndustryModules, ...autoFill.autoHabitationModules])

    result.push({
      groupId: alloc.groupId,
      lineName: alloc.groupName,
      goals: lineGoals,
      modules: lineModules,
    })

  // 待规划产线
  unmatchedAlloc = allocations.find(a => a.isUnmatched)
  if unmatchedAlloc && unmatchedAlloc.goals.length > 0:
    // 同样独立计算
    ...

  return result
```

### 5. 重叠产线合并

#### 检测与合并

```
输入: 依赖图 nodes(Map<groupId, BuildFlowPlanLine>), 生产产线 schemes[]
输出: 分组后的 schemes

function mergeOverlappingLines(graphNodes, productionSchemes):
  buildLineGroupIds = new Set(graphNodes.keys())

  for each prodScheme in productionSchemes:
    if buildLineGroupIds.has(prodScheme.groupId):
      // 重叠：归入建材产线分组
      // 合并需求：建材需求速率 + 生产需求速率 叠加相加
      graphNode = graphNodes.get(prodScheme.groupId)
      mergedRates = mergeAdditive(graphNode.demandRates, prodScheme.targetRates)
      graphNode.demandRates = mergedRates
      // 标记为重叠
      graphNode.isOverlapping = true
      graphNode.productionGoals = prodScheme.goals
    else:
      // 纯生产产线
      productionGroupSchemes.push(prodScheme)

  // 建材产线分组
  buildGroupSchemes = makeSchemesFromGraph(graph)

  return {
    buildMaterialSchemes: buildGroupSchemes,   // 建材产线分组
    productionSchemes: productionGroupSchemes  // 生产产线分组
  }
```

#### 叠加相加

叠加相加操作始终在**同一域内**进行（derivedWare 对 derivedWare、ware 对 ware），跨域不叠加。

对于重叠产线：
- **derivedWare 域** = 依赖图 trackedWares（建材需求） + C 拆分生产需求（同 wareId 合并）
- **ware 域** = 用户手工添加的 ware 需求（保留不动）
- **module 域** = 用户手工添加的模块（保留不动）

```typescript
function mergeAdditive(
  rates1: Record<string, number>,
  rates2: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = { ...rates1 }
  for (const [ware, rate] of Object.entries(rates2)) {
    result[ware] = (result[ware] || 0) + rate
  }
  return result
}
```

### 6. 分组 Scheme 输出

#### 类型定义

```typescript
// src/types/build-plan.ts 新增

export interface BuildSchemeGroup {
  groupType: 'build-material' | 'production'
  groupLabel: string  // "建材产线" 或 "生产产线"
  schemes: BuildScheme[]
}
```

#### makeSchemesWithGroups

```
function makeSchemesWithGroups(graph, allocations, modulesMap, waresMap, settings):
  // 1. 建材产线 schemes（从依赖图）
  buildSchemes = makeSchemes(graph, modulesMap, waresMap, settings)

  // 2. 生产产线 schemes（C 拆分）
  productionSchemes = splitCToLineSchemes(goals, allocations, modulesMap, waresMap)

  // 3. 重叠检测与合并
  { buildMaterialSchemes, productionSchemes: pureProductionSchemes } =
    mergeOverlappingLines(graph.nodes, productionSchemes)

  // 4. 构建分组
  return [
    {
      groupType: 'build-material',
      groupLabel: t('build_plan.group_build_material'),
      schemes: buildMaterialSchemes
    },
    {
      groupType: 'production',
      groupLabel: t('build_plan.group_production'),
      schemes: pureProductionSchemes
    }
  ]
```

### 7. 建材产线分配预览

#### 数据来源

建材产线分配预览的 derived goal 来自依赖图中各产线的 trackedWares，按来源分为两个子类型：

| 子类型 | 来源 | 触发路径 |
|--------|------|----------|
| `derived-build-material` | BFS 沿 `outputBuildTags` / `buildMaterialTags` 连线扩散到该产线的 ware | `findOutputBuildConnection` / `findLineBuildMaterialConnection` |
| `derived-production` | BFS 中 isolated 扩展发现该产线需要提供某 isolated ware | `findGroupProducingWare` → 加入 `isolatedWares` |

#### 预览数据结构

```typescript
interface BuildFlowPlanAllocation {
  groupId: string
  groupName: string
  goals: BuildGoal[]  // 含 user goals 和 derived goals
}
```

#### 计算逻辑

```
function computeBuildFlowPlanAllocations(graph, cModules, deps):
  result = []

  for each [groupId, node] of graph.nodes:
    goals = []
    for each wareId in node.trackedWares:
      // 区分来源：isolatedWares 中的标记为产出，其余为建材
      if node.isolatedWares.has(wareId):
        goals.push({ type: 'derived-production', wareId, ratePerHour: 0 })
      else:
        goals.push({ type: 'derived-build-material', wareId, ratePerHour: 0 })

    // 检查该产线是否也分配了 user goals
    userGoalsForLine = getUserGoalsForGroup(groupId, buildGoals, allocations)
    goals = [...userGoalsForLine, ...goals]

    result.push({
      groupId,
      groupName: node.lineName,
      goals
    })

  return result
```

### 8. Presenter 变更

#### `useBuildPlanPresenter` 新增

```typescript
// 建材产线分配预览
buildFlowPlanAllocations: ComputedRef<ProductionLineAllocation[]>

// scheme 分组
schemeGroups: ComputedRef<BuildSchemeGroup[]>

// 提前计算 loading
buildFlowPlanLoading: ComputedRef<boolean>
```

### 9. UI 变更

#### BuildPlanConstraintsPanel.vue

在现有产线分配区域上方新增建材产线分配预览：

```html
<!-- 建材产线分配预览（勾上后显示） -->
<ProductionLineAllocationSection
  v-if="buildFlowMode && buildFlowPlanAllocations.length > 0"
  :allocations="buildFlowPlanAllocations"
  :goals="[]"
  :racePreference="racePreference"
  :title="t('build_plan.build_material_allocation')"
  :readonly="true"
/>

<!-- 现有产线分配区域 -->
<ProductionLineAllocationSection ... />
```

建材产线分配预览区为只读，不可编辑/删除 derived goals。

#### BuildPlanPanel.vue

scheme 卡片按分组渲染：

```html
<div v-for="group in schemeGroups" :key="group.groupType">
  <div class="scheme-group-header">{{ group.groupLabel }}</div>
  <div v-for="scheme in group.schemes" :key="scheme.label">
    <!-- 现有 scheme 卡片 -->
  </div>
</div>
```

### 10. 涉及文件

| 文件 | 角色 |
|------|------|
| `src/types/build-plan.ts` | 新增 `BuildSchemeGroup`、`BuildFlowPlanAllocation` 类型 |
| `src/store/logic/productionLineSearch.ts` | **新增** — 共用函数 `findGroupProducingWare`，供建材 isolated 扩展和非建材 derived 搜索共用 |
| `src/store/logic/buildFlowPlanGraph.ts` | 修改：BFS 融入 isolated 扩展、调用 `findGroupProducingWare`、新增 `getGroupIsolatedWares` |
| `src/store/logic/computeProductionLineAllocation.ts` | 修改：`findIsolatedNode`/`walkUpstream` 重构为调用 `findGroupProducingWare` |
| `src/store/logic/calculateBuildFlowPlan.ts` | 修改：C 拆分逻辑、重叠合并、`makeSchemesWithGroups` |
| `src/store/useBlueprintProductionStore.ts` | 新增 `buildFlowPlanGraphResult`、`buildFlowPlanAllocations`、`computeBuildFlowPlanPreview`、watch 触发 |
| `src/components/empire/presenters/useBuildPlanPresenter.ts` | 新增 `buildFlowPlanAllocations`、`schemeGroups`、`buildFlowPlanLoading` |
| `src/components/empire/BuildPlanConstraintsPanel.vue` | 新增建材产线分配预览区 |
| `src/components/empire/ProductionLineAllocationSection.vue` | 支持只读模式 + 标题 prop |
| `src/components/empire/BuildPlanPanel.vue` | scheme 卡片按分组渲染 |
| `src/locales/zh-CN.json` | 新增 `build_plan.group_build_material`、`build_plan.group_production`、`build_plan.build_material_allocation` |
| `src/locales/en.json` | 新增对应英文 |
| `analysis/scripts/build-plan/build-plan-production-line.ts` | **新增** — 命令行测试脚本，加载 flow fixture、反序列化、推导 BuildFlow 视图 + 默认连线、构建依赖图、输出分配组和 SCC 循环图 |

### 11. i18n

新增 key：

| key | zh-CN | en |
|-----|-------|-----|
| `build_plan.group_build_material` | 建材产线 | Build Material Lines |
| `build_plan.group_production` | 生产产线 | Production Lines |
| `build_plan.build_material_allocation` | 建材产线分配 | Build Material Allocation |

### 12. 命令行测试脚本

路径：`analysis/scripts/build-plan/build-plan-production-line.ts`

运行：`npx vite-node analysis/scripts/build-plan/build-plan-production-line.ts [options]`

参数：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--module="Name*N"` | 目标建筑（逗号分隔，`*N` 为数量） | - |
| `--ware="Name*R"` | 目标产量（逗号分隔，`*R` 为速率/h） | - |
| `--flow=<path>` | logic-flow fixture JSON 路径 | `tests/fixtures/logic-flow-module.json` |
| `--index=<N>` | 使用第几个 flow plan | `0` |
| `--json` | JSON 输出 | - |
| `--help` | 帮助 | - |

默认目标：Missile Component Production ×5

输出内容：
1. **产线组**：反序列化后的 ProductionLineGroup 列表（产出/isolated/上游节点）
2. **BuildFlow 视图**：分组、产出建材/材料标签
3. **BuildFlow 连线**：手动 assignments + 虚拟 virtualEdges
4. **依赖图**：节点（追踪 wares、自举标记）、边（消费→供给）
5. **SCC 循环图**：强连通分量列表

数据加载流程：
1. 读取 `--flow` 指向的 JSON 文件
2. 反序列化 `SavedFlowGroup` → `ProductionLineGroup`（含 isolated 节点、manual 节点 + auto 上游扩展）
3. 读取 `buildFlow.assignments`
4. 调用 `deriveBuildFlowView()` 推导 BuildFlow 分组视图
5. 调用 `computeVirtualEdges()` 补充默认连线
6. 组装 `BuildFlowPlanView`
7. 计算目标产线 C 模块
8. 调用 `buildFlowPlanGraph()` 构建依赖图
9. 输出分配结果和 SCC 循环图

### 13. 风险与约束

- 依赖图构建新增 isolated 扩展后，图可能变大，需注意性能（BFS 层级一般不深）
- 重叠产线的叠加相加是简单合并，不处理 & 约束（与现有 build-flow-plan 的 & 约束机制不同，需在实现时确认是否统一）
- C 拆分后各产线独立计算，模块可能有重复（与 build-flow-plan 一致，预期行为）
- 提前计算的 watch 需避免频繁重算（debounce 或 shallowRef 比对）
