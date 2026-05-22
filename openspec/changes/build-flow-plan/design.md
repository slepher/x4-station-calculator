# build-flow-plan 设计

## 目标

将建造规划（build-plan）与建筑流（build-flow）整合。新增"建材产线" checkbox，利用 build-flow 中建材产出区(outputBuildTags)的连线关系自动推导依赖图并计算各产线模块数量。替代现有五种自举模式。

## 领域术语

| 术语 | 含义 |
|------|------|
| 依赖图 | 从 C 的 buildCost 出发，沿 outputBuildTags 连线扩散得到的有向图 |
| 图边方向 | 消费→供给（C 依赖 L → C→L），边从需求方指向供给方 |
| 追踪 ware 集合 | 图中某产线通过入边被要求产出的 wareId 集合 |
| 叶子 | 图的最下游供给端产线（只有入边，无出边或出边指向已处理节点） |
| 根 | 图的起点，即目标产线 C |
| SCC | 强连通分量，图中形成循环的产线集合 |
| selfWares | greedyFill 自举时，产线追踪 wares ∩ 自身 buildCost 的 ware 集合 |
| & 约束 | 多个需求源各自独立检查满足率 ≥ 100%，不合并求和 |

## 问题

当前 build-plan 使用五种自举模式（None/Joint/CoupledIterative/NestedJoint/IsolatedSpecialized）来解建材产线自引用问题。其本质是 A(B类建材)和 B(A类建材)之间的四种不同连接拓扑预设。但 build-flow 已引入用户自定义的建材产出区连线关系，两种体系并存产生冗余和混乱。

## 方案

### 1. 核心架构

```
用户输入              build-flow 数据
  │                      │
  ▼                      ▼
buildGoals          outputBuildTags connections
  │                      │
  ▼                      ▼
  C = expandGoalDependencies + autoFill
  │
  ▼
  buildFlowPlanGraph(C, buildFlowView) → 依赖图
  │
  ▼
  computeFlowPlanLines(graph) → 每条产线的模块数
  │
  ▼
  makeSchemes(lines) → BuildScheme[]
```

### 2. 类型定义

```typescript
// src/types/build-plan.ts 新增

/** 依赖图中的产线节点 */
interface BuildFlowPlanLine {
  lineGroupId: string           // logic-flow 中 ProductionLineGroup 的 id
  lineName: string              // 产线显示名（groupDisplayName）
  trackedWares: Set<string>     // 该产线需要产出的追踪 ware 集合（最终 = 所有入边 wareId 并集）
  modules: SavedModule[]        // 计算完成后确定的模块列表
  moduleIds: string[]           // 主要产出模块 id 列表（产出 trackedWares 的模块）
  isSelfBootstrap: boolean      // 是否需要自举（trackedWares ∩ 自身 buildCost ≠ ∅）
  netProduction: Record<string, number>  // 净产出速率
}

/** 依赖图中的边 */
interface BuildFlowPlanEdge {
  fromLineKey: string           // 消费方产线（需求方 groupId，对 C 使用特殊标识）
  toLineKey: string             // 供给方产线（groupI
  wareId: string                // 该边上传递的具体 ware
  sourceLabel: string           // 需求方标识（如 "C buildCost" 或产线名）
}

/** 依赖图 */
interface BuildFlowPlanGraph {
  nodes: Map<string, BuildFlowPlanLine>  // groupId → 产线节点（不含 C）
  edges: BuildFlowPlanEdge[]
  sccGroups: string[][]                  // 每组 SCC 含 groupId 数组
  cModules: SavedModule[]                // C（目标产线）的模块
  cBuildCostRates: Record<string, number> // C 的 buildCost rates
}

/** 旧 BootstrapMode 枚举 —— 算法永久保留，仅 Store/UI 暴露清除 */
// enum BootstrapMode { ... }  // MARK: 新算法稳定后清除
```

### 3. 图构建算法（`buildFlowPlanGraph`）

```
输入: cModules (SavedModule[]), buildFlowView (BuildFlowView), modulesMap, waresMap
输出: BuildFlowPlanGraph

function buildFlowPlanGraph(cModules, buildFlowView, modulesMap, waresMap):
  graph = { nodes: new Map(), edges: [], sccGroups: [] }
  
  // Step 1: C 的 buildCost
  graph.cModules = cModules
  graph.cBuildCostRates = computeBuildRates(cModules)
  cWares = Object.keys(graph.cBuildCostRates).filter(w => w !== 'energycells')
  
  // Step 2: BFS 扩散
  queue = [{ wareIds: cWares, fromKey: '__C__', fromLabel: 'C buildCost' }]
  addedGroups = new Set<string>()
  
  while queue not empty:
    { wareIds, fromKey, fromLabel } = queue.shift()
    for each wid in wareIds:
      // 查找 outputBuildTags 中的连线
      conn = findOutputBuildConnection(wid, buildFlowView)
      if !conn: continue  // 无连接，忽略
      
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
        
        // 计算该产线的 buildCost，加入扩散队列
        nodeModules = getLineModules(targetKey)  // 产线当前模块
        nodeBuildRates = computeBuildRates(nodeModules)
        nodeBuildWares = Object.keys(nodeBuildRates).filter(w => w !== 'energycells')
        if nodeBuildWares.length > 0:
          queue.push({
            wareIds: nodeBuildWares,
            fromKey: targetKey,
            fromLabel: node.lineName + ' buildCost'
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
  
  // Step 3: SCC 识别（Tarjan 或 Kosaraju）
  graph.sccGroups = findSCCs(graph)
  
  return graph
```

**`findOutputBuildConnection`**:
```
function findOutputBuildConnection(wareId, buildFlowView):
  // 只在 outputBuildTags 中查找（不含 outputMaterialTags）
  for each group in buildFlowView.buildFlowGroups:
    for each tag in group.outputBuildTags:
      if tag.wareId !== wareId: continue
      
      // 查找连线：assignment 优先，其次 virtualEdge
      for each assign in buildFlowView.assignments:
        if assign.wareId === wareId && assign.targetType === 'output-build-material':
          return { sourceGroupId: assign.sourceGroupId, isVirtual: false }
      for each ve in buildFlowView.virtualEdges:
        if ve.wareId === wareId && ve.targetType === 'output-build-material':
          return { sourceGroupId: ve.sourceGroupId, isVirtual: true }
  
  return null
```

**SCC 识别**: 使用标准 Tarjan 算法或 Kosaraju 算法。只有含 ≥ 2 个节点或自环（产线 buildCost 中有 ware 连回自身 outputBuildTag）的 SCC 才算有效 SCC。单节点无环不形成 SCC。

### 4. 产线计算（`computeFlowPlanLines`）

```
输入: graph (BuildFlowPlanGraph), modulesMap, waresMap, currentEmpireModules
输出: graph (nodes 中 modules 已填充)

function computeFlowPlanLines(graph, modulesMap, waresMap, currentModules):
  // Step 1: 构建拓扑序（叶子→根）
  sortedNodes = topologicalSort(graph)  // 叶子在前，根在后
  // sortedNodes 的每个元素是 DAG 节点或 SCC 组
  
  // Step 2: 逐节点/SCC 计算
  for each entry in sortedNodes:
    if entry is single node:
      computeDagNode(entry, graph, modulesMap, waresMap, currentModules)
    else if entry is SCC:
      computeSCC(entry, graph, modulesMap, waresMap, currentModules)
  
  return graph
```

#### 4.1 DAG 节点计算（`computeDagNode`）

```
function computeDagNode(node, graph, modulesMap, waresMap, currentModules):
  // 收集上游需求
  demandSources = []
  for each edge in graph.edges where edge.toLineKey === node.lineGroupId:
    if edge.fromLineKey === '__C__':
      rates = graph.cBuildCostRates  // 过滤仅保留 edge.wareId
      materials = getBuildMaterials(graph.cModules, edge.wareId)
    else:
      upstreamNode = graph.nodes.get(edge.fromLineKey)
      rates = computeBuildRates(upstreamNode.modules)  // 过滤仅保留 edge.wareId
      materials = getBuildMaterials(upstreamNode.modules, edge.wareId)
    demandSources.push({ label: edge.sourceLabel, rates, materials })
  
  if node.isSelfBootstrap:
    // 不应到达这里——自举节点在 SCC 内处理
    throw new Error('Self-bootstrap node in DAG')
  
  // 一次性计算
  node.modules = planProductionForRates(mergeDemands(demandSources), modulesMap, waresMap)
  node.modules = addAutoFill(node.modules)
  node.moduleIds = findPrimaryModuleIds(node.modules, node.trackedWares)
  node.netProduction = computeNetProduction(node.modules, currentModules)
```

#### 4.2 SCC 计算（`computeSCC`）

```
function computeSCC(sccGroup, graph, modulesMap, waresMap, currentModules):
  // sccGroup = [{ lineGroupId, ... }]
  sccNodeMap = Map: groupId → node
  
  // 预判定自举
  for each node in sccGroup:
    buildCostWares = computeBuildWares(node)  // 该产线当前模块的 buildCost ware 集合
    selfWares = intersection(node.trackedWares, buildCostWares)
    node.isSelfBootstrap = selfWares.size > 0
  
  // 外层迭代
  prevModuleCounts: Map<groupId, number[]>
  maxIterations = 60
  
  loop:
    stable = true
    
    // 按消费→供给顺序（入度大的先算）
    sortedInternal = sortByDependencyOrder(sccGroup, graph)
    
    for each node in sortedInternal:
      // 收集需求
      demandSources = collectDemandsFor(node, graph)
      
      if node.isSelfBootstrap:
        // greedyFill 自举
        result = greedyFillForLine(node, demandSources, graph, modulesMap, waresMap, currentModules)
      else:
        // 一次性计算
        result = planProductionForRates(mergeDemands(demandSources), modulesMap, waresMap)
        result = addAutoFill(result)
      
      node.modules = result.modules
      node.moduleIds = findPrimaryModuleIds(node.modules, node.trackedWares)
      
      // 检查变化
      newCounts = node.moduleIds.map(id => node.modules.filter(m => m.id === id).length)
      if !arraysEqual(newCounts, prevModuleCounts[node.lineGroupId]):
        stable = false
      prevModuleCounts[node.lineGroupId] = newCounts
    
    if stable: break
    if maxIterations-- <= 0: break  // 安全保护
```

#### 4.3 greedyFill 自举（`greedyFillForLine`）

```
function greedyFillForLine(node, demandSources, graph, modulesMap, waresMap, currentModules):
  built = []
  
  // selfWares 定义
  buildCostWares = computeBuildWaresForAllPotentialModules(node)  // 该产线所有潜在产出模块的 buildCost 候选
  selfWares = intersection(node.trackedWares, buildCostWares)
  
  maxIterations = 60
  while true:
    fullBuilt = built + autoFill
    contextNet = net(currentModules + fullBuilt)
    
    // selfDemand
    selfDemand = computeBuildRates(fullBuilt) 限制在 selfWares
    selfDemand = filterByWares(selfDemand, selfWares)
    
    // 合并所有 source（& 约束）
    allSources = [...demandSources, { label: 'self_demand', rates: selfDemand }]
    
    // 检查满足率
    allMet = allSources.every(src => 
      Object.keys(src.rates).every(w => contextNet[w] >= src.rates[w])
    )
    if allMet: break
    
    // 找最低满足率的瓶颈 ware
    bottleneckWare = findLowestSatisfaction(contextNet, allSources, selfWares)
    if !bottleneckWare: break
    
    // 添加一个生产者
    producer = findModuleForWare(bottleneckWare)
    built.push({ id: producer.id, count: 1 })
    
    // autoFill
    autoFill = calculateAutoFillModules(built)
    
    if maxIterations-- <= 0: break
  
  return { modules: built + autoFill }
```

### 5. 需求收集与 & 约束

`mergeDemands` 使用 & 约束汇总：

```typescript
function mergeDemands(sources: BuildRateSource[]): Record<string, number> {
  // 保留所有 source 作为独立检查
  // 这里仅返回合并后的 rates 用于 planProductionForRates 一次性计算
  // & 检查在后续的 checkSatisfaction 中执行
  const result: Record<string, number> = {}
  for (const src of sources) {
    for (const [ware, rate] of Object.entries(src.rates)) {
      result[ware] = Math.max(result[ware] || 0, rate)
    }
  }
  return result
}

/** & 约束满足率检查 */
function checkSatisfaction(netProduction, sources, currentModules):
  contextNet = mergeNet(netProduction, currentModules)
  return sources.every(src =>
    Object.keys(src.rates).every(w => (contextNet[w] || 0) >= src.rates[w])
  )
```

### 6. 方案生成（`makeSchemes`）

```
function makeSchemes(graph, modulesMap, waresMap, currentModules):
  schemes = []
  
  // 按叶子→根顺序收集产线
  sortedLines = topologicalSortLines(graph)
  
  for each line in sortedLines:
    scheme = makeSingleScheme(line, graph, modulesMap, waresMap, currentModules)
    schemes.push(scheme)
  
  // 最后是 C
  cScheme = makeSchemeForC(graph, currentModules)
  schemes.push(cScheme)
  
  return schemes
```

每个 scheme 的 `targetRateSources` = 该产线收到所有入边的需求 source 明细（保留 `&` 约束的完整信息）。

### 7. Store 变更

#### 新增状态

```typescript
// useBlueprintProductionStore
const buildFlowMode = ref<boolean>(false)  // "建材产线" checkbox 状态，不持久化

function setBuildFlowMode(mode: boolean): void
```

#### 移除状态（新算法稳定后，仅 Store/UI 暴露，算法代码保留）

```typescript
// BootstrapMode 相关——仅清除 Store 暴露，算法代码保留供验证脚本
// const bootstrapMode = ref<BootstrapMode>(BootstrapMode.None)
// function setBootstrapMode(mode: BootstrapMode): void
```

#### 计算接口变更

```typescript
// calculateBuildPlan 或新函数
function calculateBuildFlowPlan(input: CalculateBuildPlanInput, buildFlowView: BuildFlowView | null): BuildPlan
```

当 `buildFlowMode = true` 且有 `buildFlowView` 时走新算法，否则沿用简化逻辑。

### 8. Presenter 变更

#### `useBuildPlanPresenter` 新增

```typescript
// 输入
buildFlowView: ComputedRef<BuildFlowView | null>  // 来自 logicFlow store

// 状态
buildFlowMode: ComputedRef<boolean>

// 方法
setBuildFlowMode(mode: boolean): void
```

### 9. UI 变更

#### `BuildPlanConstraintsPanel.vue`

移除 bootstrapMode 下拉框，新增 checkbox：

```html
<!-- 原 bootstrapMode 下拉框位置 -->
<div class="build-flow-mode-toggle">
  <label>
    <input type="checkbox" :checked="buildFlowMode" @change="setBuildFlowMode($event.target.checked)" />
    {{ t('sector.build_plan.build_flow_mode') }}
  </label>
</div>
```

### 10. 涉及文件

| 文件 | 角色 |
|------|------|
| `src/types/build-plan.ts` | 新增 BuildFlowPlanGraph、BuildFlowPlanLine、BuildFlowPlanEdge 类型 |
| `src/store/logic/buildFlowPlanGraph.ts` | **新增** — 图构建算法、SCC 识别 |
| `src/store/logic/calculateBuildFlowPlan.ts` | **新增** — 产线计算、greedyFill、& 约束 |
| `src/store/logic/calculateBuildPlan.ts` | 修改 — 添加 build-flow-mode 分支；标记旧 bootstrapMode 代码待清除 |
| `src/store/useBlueprintProductionStore.ts` | 新增 buildFlowMode 状态；标记 bootstrapMode 待清除 |
| `src/components/empire/presenters/useBuildPlanPresenter.ts` | 新增 buildFlowMode、buildFlowView props |
| `src/components/empire/BuildPlanConstraintsPanel.vue` | 移除下拉框 → 新增 checkbox |
| `src/components/empire/BuildPlanPanel.vue` | 不变（兼容新方案输出） |
| `src/components/empire/BuildPlanStepsModal.vue` | 不变（兼容新方案输出） |
| `src/locales/zh-CN.json` | 新增 `sector.build_plan.build_flow_mode` |
| `src/locales/en.json` | 新增 `sector.build_plan.build_flow_mode` |

### 11. i18n

新增 key：
- `sector.build_plan.build_flow_mode`: zh-CN "建材产线" / en "Build Material Lines"

待清除 key（旧 bootstrapMode 相关——新算法稳定后删除）：
- `sector.build_plan.bootstrap_mode`
- `sector.build_plan.bootstrap_none` / `bootstrap_joint` / `bootstrap_coupled` / `bootstrap_isolated`
- 各模式方案标签：`scheme_label_joint_a` 等

### 12. 拓扑序排序算法

```
function topologicalSort(graph):
  // 构建入度表
  inDegree: Map<nodeKey, number>
  for each edge in graph.edges:
    inDegree[edge.toLineKey]++
  
  // Kahn 算法变体：先处理入度为 0 的节点（叶子）
  queue = nodes with inDegree === 0
  result = []
  
  // 合并 SCC 组
  sccMap = Map: nodeKey → sccGroupIndex
  
  while queue not empty:
    node = queue.shift()
    if sccMap.has(node):
      // SCC 组整体加入
      if sccGroup not yet in result:
        result.push(sccGroup)
        // 将 SCC 组中所有节点的出边目标入度减
        for each outEdge of sccGroup:
          decrement inDegree[outEdge.toLineKey]
          if inDegree === 0: queue.push(outEdge.toLineKey)
    else:
      result.push([node])  // 单节点
      for each outEdge of node:
        decrement inDegree[outEdge.toLineKey]
        if inDegree === 0: queue.push(outEdge.toLineKey)
  
  return result  // 叶子在前
```

### 13. 风险与约束

- 图构建依赖 build-flow 的 outputBuildTags 数据，若该数据未正确推导会导致图缺失
- SCC 内迭代需安全上限保护（60 轮），防死循环
- C 模块可能和下游产线模块有重复（独立计算），这是预期行为，不做去重
- 新算法需与现有 BuildScheme / BuildSchemeStep 结构兼容
- 旧 bootstrapMode 算法代码永久保留供验证脚本使用，仅清除 Store/UI/Presenter 暴露

## 增量计划

1. **Phase 1**: 新增类型定义 + 图构建算法（`buildFlowPlanGraph.ts`）
2. **Phase 2**: 产线计算算法（`calculateBuildFlowPlan.ts`）
3. **Phase 3**: Store + Presenter 接口变更
4. **Phase 4**: UI 变更（checkbox + 移除下拉框）
5. **Phase 5**: 集成 + 调试
6. **Phase 6**: 验证通过后清除旧 bootstrapMode 代码
