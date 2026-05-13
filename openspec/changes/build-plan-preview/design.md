# build-plan-preview 设计

## 目标

为 build-plan preview 建立清晰的职责边界：preview 负责责任分配、依赖图构建、SCC 检测；preview 真相层直接面向 UI 展示；derived 项在 preview 阶段固定 moduleId。

## 领域术语

| 术语 | 含义 |
|------|------|
| preview | 在 build-flow 规划上下文中，根据目标变化或 checkbox 状态变化而重算的责任分配阶段 |
| compute | 用户点击"计算建造方案"后执行的模块求解阶段（由 build-plan-compute 定义） |
| 责任 | 一条产线需要承担的供给或需求义务 |
| derived 项 | 表示"这条线承担什么"的 preview 项，必须绑定 moduleId |
| required 项 | 表示"这条线需要什么"的 preview 项，不绑定 moduleId |
| targets[] | derived 项与目标来源的关联记录 |
| lineage | 产线的种族/血统来源，用于 moduleId 选择：`isLocked ? (lockedLineage \|\| subCategory) : subCategory`，空值回落 `default` |
| 相关产线集合 | preview 阶段已显式挂到某条责任上的产线集合 |
| 依赖图 | 从 C 的 buildCost 出发，沿 outputBuildTags 连线扩散得到的有向图 |
| SCC | 强连通分量，图中形成循环的产线集合 |
| checkbox | "建材产线" checkbox，只控制是否启用建材产线规划；关闭时允许不生成 build-material graph / SCC |
| 无规划 | `logicFlowPlanId = null` 的 preview 上下文；不绑定任何 logic-flow，但仍生成待规划产线 preview |

## 问题

当前 preview 存在以下混淆源：

1. 单一 `type` 同时承载目标、供给、需求三类语义
2. preview 结果会被 presenter 映射回旧 `goals` 结构，UI 继续依赖旧模型
3. `moduleId`、`target`、`derived`、`required` 的职责没有拆开
4. preview 建图入口把 autoFill 模块集合当成 root，建材范围被数量求解结果污染
5. checkbox 的命名与状态边界必须避免被误读成 build-flow mode 开关

## 方案

### 1. Preview 类型拆分

```typescript
type PreviewItem = PreviewDerivedItem | PreviewRequiredItem

interface PreviewDerivedTarget {
  type: 'build-module' | 'production-rate' | 'fleet-rate'
  count?: number
  ratePerHour?: number
}

interface PreviewDerivedItem {
  kind: 'derived'
  wareId?: string
  moduleId: string
  derived: Array<'target' | 'production' | 'build-material'>
  targets?: PreviewDerivedTarget[]
  relatedLineGroupIds: string[]
  sourceRef: string
}

interface PreviewRequiredItem {
  kind: 'required'
  wareId: string
  required: Array<'production' | 'build-material'>
  relatedLineGroupIds: string[]
  sourceRef: string
}
```

约束：
1. derived 和 required 不再共用同一类型
2. derived 必须有 moduleId
3. required 不允许承载 moduleId
4. targets[] 只存在于 derived

### 2. PreviewLinePlan

```typescript
interface PreviewLinePlan {
  groupId?: string
  groupName: string
  isUnmatched: boolean
  lineage: string
  items: PreviewItem[]
}
```

### 3. PreviewResult

```typescript
interface PreviewResult {
  buildMaterialPlanningEnabled: boolean
  lines: PreviewLinePlan[]
  graph: BuildFlowPlanGraph | null
  sccGroups: string[][]
}
```

### 4. 合并规则

#### Derived

- 合并键：`groupId + wareId + moduleId`
- 行为：合并同键项，derived[] 去重，targets[] 追加，relatedLineGroupIds 合并去重

#### Required

- 合并键：`groupId + wareId`
- 行为：合并同键项，required[] 去重，relatedLineGroupIds 合并去重

#### Derived / Required 不混合

同一条线、同一 wareId 同时存在供给与需求语义时，必须保留两条 preview 项。

### 5. Module 确认

preview 在构造 derived 项时直接确认 moduleId。

#### 5.1 Lineage 生成

```ts
const lineage = group.isLocked
  ? (group.lockedLineage || group.subCategory)
  : group.subCategory
```

若结果为空，回落为 `default`。

#### 5.2 Derived moduleId 选择

1. 第一轮优先 manual
2. manual 有多个时先按 lineage
3. 若仍有多个，取第一个
4. 第二轮使用 auto
5. auto 只服从 lineage
6. 若仍有多个，取第一个

对于 unmatched：仍按 `settings.racePreference` 确认 moduleId，UI 分组名保持"待规划产线"。

#### 5.3 Compute 不再重复生成 moduleId

preview 为 derived 项一旦选定 moduleId，compute 只允许读取，不允许重选。

### 6. 依赖图构建

#### 6.1 入口

```ts
function buildFlowPlanGraph(
  cModules, buildFlowView, modulesMap, waresMap, getGroupDisplayName
): BuildFlowPlanGraph
```

#### 6.2 BFS 扩散

1. C = expandGoalDependencies + autoFill，计算 C 的 buildCost
2. 从 C 的 buildCost ware 集合出发 BFS
3. 沿 outputBuildTags 连线找产线 → 加节点 → 加边 → 取产线的 buildCost 继续扩散
4. 产线只加入图一次，追踪 ware 集合随扩散扩充
5. 无 outputBuildTag 连接的 ware → 忽略
6. 识别 SCC（Tarjan / Kosaraju）

#### 6.3 Isolated 扩展

preview 构建依赖图时融入 isolated 扩展：

1. 产线 L 被加入图中后，检查 L 的 isolated 节点
2. 使用 manual > auto 优先级搜索产出该 ware 的产线
3. 新增边方向保持"消费方 → 供给方"
4. 无连线则忽略，不回退搜索其他来源

#### 6.4 图类型

```typescript
interface BuildFlowPlanGraph {
  nodes: Map<string, BuildFlowPlanLine>
  edges: BuildFlowPlanEdge[]
  sccGroups: string[][]
  cModules: SavedModule[]
  cBuildCostRates: Record<string, number>
}
```

### 7. 责任到产线全局分配

```text
第一轮（manual 全局分配）：
  for each goal:
    扫描所有产线的 manual 节点 → 匹配则 assign，标记该产线为"已分配"

第二轮（auto 优先在已分配产线中查找）：
  扫描所有未分配的 goal:
    优先在"已分配"的产线中查找 auto 节点 → 匹配则 assign
    其次在其他"未分配"的产线中查找 auto 节点 → 匹配则 assign
    仍未匹配 → unmatched
```

### 8. Checkbox 语义

- checkbox 不是 build-flow mode 开关
- checkbox 只控制"是否按建筑材料需求规划建材产线"
- 勾选 / 取消都触发 preview 重算
- preview 结果包含或移除建材产线规划结果
- 关闭 checkbox 时，不生成仅服务于建材产线规划的 build-material graph / SCC；这属于关闭建材规划的设计行为，不代表退出 build-flow 规划上下文

### 8.1 无规划（logic-flow = null）

- `logicFlowPlanId = null` 时，preview 仍然执行
- 由于不存在可用 buildFlowView，preview 不建图、不生成 SCC
- 所有目标直接通过 allocation-only 分支进入 unmatched line
- `PreviewResult.graph = null`
- `PreviewResult.sccGroups = []`
- `PreviewResult.lines` 仍必须可供 Vue 直接渲染"待规划产线"

### 9. Preview Root 范围

- preview 的 build-material 图不再从 expandGoalDependencies + autoFill 的模块集合起图
- 先通过 production allocation 找出承接目标的目标产线
- 对每条目标产线收集当前 logic-flow 已展开的非 isolated 模块节点
- 将这组模块视为 preview root 模块集合
- 用这组 root 模块的 buildCost 作为依赖图首层输入

### 10. Presenter / Vue 链路

旧链路：`preview truth → presenter 映射回 ProductionLineAllocation.goals → Vue 按旧 goal.type 渲染`

新链路：`preview truth → presenter 只做展示字段映射 → Vue 直接按 PreviewItem.kind / tags 渲染`

约束：
1. preview 展示不再回退到旧 goal.type
2. presenter 不再二次拼装旧 preview 责任语义

### 11. 展示规则

#### 名称
- 有 moduleId 时显示 module 名称
- 否则显示 ware 名称

#### Tag
- derived 使用绿色 tag
- required 使用红色 tag

值映射：

| 值 | 中文 | English |
|----|------|---------|
| target | 目标 | Target |
| production | 材料 | Production |
| build-material | 建材 | Material |

#### 卡片计数
- 产线右上角数量 = line 内已分配 moduleId 的去重种类数

### 12. 用户目标区与 preview 区分离

- 用户目标区：唯一可编辑输入区，直接列原始 buildGoals
- preview 区：只读，展示分配结果
- preview 区中 target-production / derived-build-material / derived-production / required-production 以 tag 方式展示
- preview 区不显示数量输入，不允许删除

## 数据流

```text
build-plan store
  → buildGoals / buildMaterialPlanningEnabled / resolvedLogicFlowState
  → preview
    → 责任分配 (全局两轮)
    → 依赖图构建 (BFS + isolated 扩展)
    → SCC 检测
    → derived 项 moduleId 确认
    → previewResult

用户目标区 ← buildGoals (可编辑)
Preview 区 ← previewResult (只读)
```

## 影响面

主要影响：
1. `src/types/build-plan.ts`
2. `src/store/logic/buildPlanProductionLine.ts`
3. `src/store/logic/buildFlowPlanGraph.ts`
4. `src/components/empire/presenters/useBuildPlanPresenter.ts`
5. `src/components/empire/ProductionLineAllocationSection.vue`
6. `src/locales/en.json`
7. `src/locales/zh-CN.json`
