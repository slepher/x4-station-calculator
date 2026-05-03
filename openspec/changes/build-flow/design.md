# Build Flow - Design

## 目标

在不污染现有 `logicFlow.groups` / `FlowNode` 业务结构的前提下，为 `logic-flow` 增加一套"建筑流"派生视图和独立关系层。该层负责：

- 从现有产线推导建筑相关来源与目标
- 按关联关系对建筑材料自动分组
- 维护来源标签到目标标签的唯一绑定关系（组内）
- 支持拖拽 / 菜单 / 覆盖 / 解绑
- 以有向线形式可视化关系

## 分层策略

遵循仓库新的 `store -> presenter -> vue` 原则，本次新增逻辑应尽量采用：

- `store`
  - 负责基础状态与关系存储
  - 负责基于 `logicFlow.groups` 的原始派生计算
  - 负责建筑材料分组推导
- `presenter`
  - 负责面向 UI 组装分组、card、tag、目标列表、连线锚点数据
- `vue`
  - 负责渲染分组容器、card / tag / menu / edge
  - 只通过 presenter 读取展示数据和触发行为

本次不要求重构整个旧版 `logic-flow`，但新增"建筑产线区"逻辑不得继续扩散新的"Vue 直连 store 做复杂组装"的写法。

## 布局与可见性

工作台布局固定为：

- 顶部：`LogicFlowCandidateZone`
- 中部：`BuildFlowZone`
- 底部：`LogicFlowPlanningZone`

`BuildFlowZone` 默认常显，不提供折叠/展开控件。原因：

- 与当前页面连续工作台的视觉风格更一致
- 不引入额外 section 控件与状态
- 规划拖拽干扰问题通过"拖拽期间自动隐藏"解决即可

运行时可见性规则：

- 当拖拽上下文属于规划区相关拖拽时，`BuildFlowZone` 自动隐藏
- 拖拽结束后自动恢复显示
- 该状态只用于避免无关区域参与 hover / drop / 命中，不做持久化

### 分组容器布局

建筑产线区按分组渲染，每个分组是一个带边框/背景的容器。分组容器之间采用 CSS Grid 横向排列（1 组占满宽度，2 组各半宽，3+ 组每行最多 2 个换行，间距 20px）。

每个分组容器内部采用水平 flex 布局（`justify-between`）：

- **左列**：产线 card 竖向排列（`flex-col gap-16`），ml=92px，card 宽度 308px
- **右列**：该组的"产出区"双 card（建材区 + 材料区），mr=16px，垂直居中（`self-center`），宽度 160px

产线 card 间距 64px。产出区双 card 通过 `ml-auto` 推到右侧，`self-center` 垂直居中，双 card 之间竖向排列。

### Card 布局结构

每个产线 card 的内部布局为：

- 顶部整行：产线名称
- 下方横向区域（`flex justify-between`）：
  - 左侧列："产线建材"标签，竖向排列
  - 右侧列："产线原材料"标签，竖向排列，右对齐（`items-end`）

"产出区"拆分为两个 card：
- **建材区**（副标题"产出建材"）：标签内容 = 组内产线 sourceTags 并集
- **材料区**（副标题"产出材料"）：标签内容 = 组内产线 sourceTags 并集

两个 card 显示相同 wareId 集合，但各自独立作为连线目标。

### Tag 排版结构

标签常驻外伸按钮布局：

- `产线原材料`：文字左对齐，`+` 固定在右侧，按钮向 card 右边外伸
- `产线建材`：文字右对齐，`+` 固定在左侧，按钮向 card 左边外伸
- `产出建材`：文字右对齐，`+` 固定在左侧，按钮向 card 左边外伸
- `产出材料`：文字右对齐，`+` 固定在左侧，按钮向 card 左边外伸

标签初始填充为透明。当标签被连线绑定时，标签和按钮染为对应 ware 的颜色（8 色调色板，按 wareId 排序分配）。箭头颜色与连线/标签颜色一致，每条边独立着色。

## 数据模型

建议引入一套独立关系模型，避免向 `ProductionLineGroup` / `FlowNode` 混入建筑流字段。

### 分组模型

```ts
interface BuildFlowGroup {
  groupKey: string
  lineCards: BuildFlowLineCard[]
  outputBuildTags: BuildFlowTag[]
  outputMaterialTags: BuildFlowTag[]
}
```

其中：

- `groupKey` = 组内所有 lineCard.groupId 排序后以 `:` 连接，如 `"g1:g2:g3"`。确定性标识，分组重组时自然更新。
- `lineCards` = 该组内的所有产线 card
- `outputBuildTags` = 组内产线 sourceTags 并集（建材区标签）
- `outputMaterialTags` = 组内产线 sourceTags 并集（材料区标签）

注意：`outputBuildTags` 和 `outputMaterialTags` 的 wareId 集合相同，但分属不同 card，连线目标独立。

### 派生视图模型

```ts
interface BuildFlowLineCard {
  groupId: string
  title: string
  sourceTags: BuildFlowTag[]
  buildMaterialTags: BuildFlowTag[]
}

interface BuildFlowTag {
  tagId: string
  wareId: string
  label: string
}
```

其中：

- `sourceTags` = 产线原材料
- `buildMaterialTags` = 产线建材

注意：`BuildFlowOutputCard` 不再作为独立类型，产出区内容由 `BuildFlowGroup.outputBuildTags` 和 `BuildFlowGroup.outputMaterialTags` 承载。

### 关系模型

```ts
type BuildFlowTargetType = 'line-build-material' | 'output-build-material' | 'output-material'

interface BuildFlowAssignment {
  wareId: string
  sourceGroupId: string
  targetType: BuildFlowTargetType
  targetGroupId?: string
}
```

该结构满足以下约束：

- `wareId` 同时代表来源标签与目标标签的材料类型
- 来源端可一对多
- 目标端一对一
- 覆盖时按目标键定位旧关系并替换
- 解绑时按目标键删除

**注意**：`BuildFlowAssignment` 结构不变，不包含 groupKey。分组信息是推导结果，不需要持久化。

### 持久化模型

建筑流关系属于单条 `LogicFlowPlan` 的内容，而不是 `SavedFlowPlansState.list` 的同级全局数据。建议持久化结构：

```ts
interface BuildFlowPlanData {
  assignments: BuildFlowAssignment[]
}

interface LogicFlowPlan {
  id: string
  name: string
  groups: SavedFlowGroup[]
  settings: LogicFlowSettings
  buildFlow?: BuildFlowPlanData
  lastUpdated: number
}
```

这样可以保证：

- 保存当前方案时建筑流关系一并写入
- `Save As` 时建筑流关系自然复制到新方案
- 删除方案时不会遗留孤立关系
- 切换方案时建筑流关系自动随方案切换

## 推导流程

### 1. 现有产线扫描

从 `logicFlow.groups` 读取所有 group，并提取：

- 主要产品：`source === 'manual' && !isIsolated`
- 产线自身模块集合：用于汇总 `buildCost`
  - 模块口径：group 内所有 `!isIsolated && moduleId != null && modulesMap[moduleId].tier > 0` 的节点
  - 排除 `isIsolated`：孤立节点无模块，不参与建造
  - 排除 `tier === 0`：tier 0 的 ware 不是可建造模块（如能源电池），不能纳入 buildCost

### 2. 全局需求原材料

对全部现有产线自身模块的 `buildCost` 进行合并，得到：

```ts
Record<wareId, amount>
```

其 key 集合作为"需求原材料"集合。模块口径同 Step 1（排除 isolated 和 tier 0）。

### 3. 建筑产线筛选

若某条产线的主要产品中存在 `wareId ∈ demandMaterialSet`，则该产线进入建筑产线区。

### 4. 每卡片内容

对每个入选产线 group 计算：

- `产线原材料`
  - = 主要产品中命中 `demandMaterialSet` 的那些产物
- `产线建材`
  - = 该产线自身模块（`!isIsolated && tier > 0`）`buildCost` 材料集合与"现产原材料"的交集

### 5. 建筑材料分组

对入选产线执行递归扩散分组：

```
1. U = 全部入选产线 sourceTags 的 wareId 并集
2. visitedWares = ∅, result = []
3. while U - visitedWares 非空：
   a. 取 seed ∉ visitedWares
   b. BFS 扩散：
      - 找到 sourceTags 包含 seed 的所有产线 → 加入当前组
      - 收集这些产线 buildMaterialTags 中的 wareId
      - 对每个 ∈ U 且 ∉ visitedWares 的 wareId，继续扩散
   c. groupOutput = 当前组内产线 sourceTags 并集
   d. visitedWares ∪= groupOutput
   e. groupKey = 组内 groupId 排序后 join(':')
   f. result.push({ groupKey, lineCards, outputBuildTags, outputMaterialTags })
4. 返回 result
```

关键性质：

- 同一产线的所有 sourceTags 天然同组（因为它们通过同一产线的 buildMaterialTags 连通）
- 每条入选产线必属于且仅属于一个组
- 同一 wareId 只出现在一个组的产出区中

### 6. 产出区内容

每个分组的产出区拆分为两个 card：
- **建材区**（副标题"产出建材"）：标签 = 组内产线 sourceTags 并集
- **材料区**（副标题"产出材料"）：标签 = 组内产线 sourceTags 并集

两个 card 的标签 wareId 集合相同，但各自独立作为连线目标。

## 交互设计

### 来源标签交互

来源标签（产线原材料）需要具备两种入口：

- 拖拽到同 `wareId` 的目标标签（仅同组内）
- 点击常驻 `+` 打开目标菜单

目标菜单列表应只显示同组内同 `wareId` 的目标标签，包括：

- 同组内其他产线 card 中的同名 `产线建材`
- 同组内建材区中的同名 `产出建材`
- 同组内材料区中的同名 `产出材料`

### 跨组限制

- 拖拽投放时，若来源与目标不在同一组，投放无效
- 菜单列表不展示跨组目标
- 分组重组后，已存储的 assignment 如果变成跨组，在失效清理中自动删除

### 覆盖语义

若目标标签已存在关系：

- 新建关系前先删除旧目标关系
- 再写入新关系
- UI 连线同步切换

### 解绑语义

目标标签需提供解绑入口。解绑后：

- 删除目标对应关系
- 删除对应有向线
- 不影响来源标签和现有产线数据

### 目标键规则

由于绑定严格要求来源与目标 `wareId` 相同，关系中只保留单一 `wareId` 字段即可，不需要重复存储 `sourceWareId` / `targetWareId`。

目标唯一键建议如下：

```ts
line-build-material: `line:${targetGroupId}:${wareId}`
output-build-material: `output-build:${wareId}`
output-material: `output:${wareId}`
```

`output-build:{wareId}` 和 `output:{wareId}` 各自独立。同一 wareId 可同时分别连到建材区和材料区（一个起点可连任意终点，一个终点只能有一个起点）。

## 连线设计

连线使用 SVG overlay 方案（`BuildFlowEdgeLayer` 组件），在分组容器内部用绝对定位的 `<svg>` 元素绘制路径。

### 锚点标识

标签通过 `data-tag-id` 属性提供稳定 DOM 锚点：
- `build-flow-source:${groupId}:${wareId}` — 产线产出标签
- `build-flow-target:line:${targetGroupId}:${wareId}` — 产线建材标签
- `build-flow-target:output-build:${wareId}` — 产出建材标签
- `build-flow-target:output:${wareId}` — 产出材料标签

### 路由算法

每条边根据起点和终点的 X/Y 坐标关系采用不同的路由策略。

#### Gap 类型定义

分组容器内存在三种空间 gap：

- **产线产出 gap**：产线 card 右边缘到产出区 card 左边缘之间的水平空间。Mode A 的 midX 在此 gap 内按 source 均分分配。分配顺序（x 从小到大）：
  1. 只有产线建材终点的 source（纯 Mode B）
  2. 同时有产线产出终点和产线建材终点的 source（Mode A + B 混合）
  3. 只有产出终点的 source（纯 Mode A）
  4. 同类内按起点 y 从小到大排序
- **产线建材 gap**：产线 card 左边缘到 group 容器左边框之间的水平空间。Mode B 的 p3X 在此 gap 内按 source 均分分配，分配顺序按起点 y1 从小到大。
- **产线间 gap**：相邻产线 card 之间的垂直缝隙（card[i].bottom → card[i+1].top）。Mode B 的 p2Y 分配规则：
  1. 对每个 source，确定终点 y 范围：单终点为 `[sY, eY]`（起点到终点），多终点为 `[e1Y, enY]`（最小终点到最大终点）
  2. 筛选完全落在终点 y 范围内的产线间 gap（gap.start ≥ yMin && gap.end ≤ yMax）
  3. 从满足约束的候选 gap 中，选择中心点距起点 y1 最近的 gap
  4. 同一 gap 内的 source 按起点 y1 从小到大排序，依次均分 p2Y 位置

#### 共享原则

同一 source（sourceGroupId + wareId）共享 midX；同一 source 在同一 gap 内共享 p2Y、p3X。

#### Mode A（终点在右侧，x2 > x1）：3 段线
```
Start → P1(midX, y1) → P2(midX, y2) → End
```
- midX 在产线产出 gap 内按 source 均分分配
- 同一 source 的所有边共享同一个 midX
- 若 `|y1 - y2| < 4`（近乎水平），退化为直线

#### Mode B（终点在左侧，x2 ≤ x1）：5 段线
```
Start → P1(p1X, y1) → P2(p1X, p2Y) → P3(p3X, p2Y) → P4(p3X, y2) → End
```
- p1X (= midX)：与 Mode A 共享同一分配池（每个 source 一个值）
- p2Y：在产线间 gap 内按 source 均分（同一 source 共享 p2Y，不同 source 之间均分）
- p3X：在产线建材 gap 内按 source 均分（同一 source 共享 p3X）
- 每个 gap 内的 source 计数独立，ei 从 0 开始，不跨 gap 累计

#### 自身连接

同一 card 内产出 tag 左边缘直连建材 tag 右边缘。

### 响应机制

- `watch(edges)` 监听数据变化 → 调用重算
- `MutationObserver` 监测 tag DOM 变化
- `ResizeObserver` 监测容器尺寸变化
- `requestAnimationFrame` 确保 DOM 就绪后计算

### 颜色

每条边按 wareId 分配独立颜色（8 色调色板，wareId 排序后 index % 8），与标签颜色一致。箭头使用 per-color SVG marker defs。

## 涉及文件

| 文件/目录 | 角色 |
|---|---|
| `src/components/logic-flow/BuildFlowZone.vue` | 主组件：分组布局 + card/tag 渲染 + 菜单交互 + 响应式显示/隐藏 |
| `src/components/logic-flow/BuildFlowEdgeLayer.vue` | SVG 连线层：DOM 锚点定位 + 5 段式路由 + 颜色分配 |
| `src/components/logic-flow/presenters/useBuildFlowPresenter.ts` | Presenter：组装 card、tag、菜单、edge 数据 |
| `src/store/logic/buildFlowDerivation.ts` | 派生计算：需求原材料、入选产线、分组推导、assignments CRUD |
| `src/store/useLogicFlowStore.ts` | Store：状态管理、持久化、失效清理 |
| `src/types/x4.ts` | 类型定义：BuildFlowGroup、BuildFlowTag、BuildFlowAssignment 等 |

## Assignments 失效清理

当 groups 运行时数据发生变更时，已持久化的 assignments 可能引用不存在的来源或目标。系统需要在推导重新计算后执行失效清理。

### 清理时机

每次派生视图重新计算后（即 groups 变化触发 `demandMaterialSet`、入选产线、分组、产出区标签重新推导时），执行一轮失效清理。

### 清理规则

按以下优先级逐条检查 assignments 数组中的每条记录：

1. **来源产线不存在**：若 `sourceGroupId` 在当前 `groups` 中不存在，删除该 assignment。
2. **来源产线不再入选**：若 `sourceGroupId` 对应的产线不再属于建筑产线区（其主要产品不再命中 `demandMaterialSet`），删除该 assignment。
3. **来源标签失效**：若该产线的产线原材料中不再包含 `assignment.wareId`，删除该 assignment。
4. **目标产线不存在**（仅 `targetType === 'line-build-material'`）：若 `targetGroupId` 在当前 `groups` 中不存在，删除该 assignment。
5. **目标产线不再入选**（仅 `targetType === 'line-build-material'`）：若 `targetGroupId` 对应的产线不再属于建筑产线区，删除该 assignment。
6. **目标标签失效**：
   - `targetType === 'line-build-material'`：若目标产线的产线建材中不再包含 `assignment.wareId`，删除该 assignment。
   - `targetType === 'output-build-material'`：若建材区的产出建材中不再包含 `assignment.wareId`，删除该 assignment。
   - `targetType === 'output-material'`：若材料区的产出材料中不再包含 `assignment.wareId`，删除该 assignment。
7. **跨组绑定**（新增）：若来源产线与目标不在同一分组，删除该 assignment。

### 清理结果

- 被删除的 assignment 对应的连线同步移除。
- 清理不影响未被波及的 assignments。
- 清理后的 assignments 数组写回当前 `LogicFlowPlan.buildFlow`。

## 持久化与迁移

### LogicFlowPlan 类型变更

在 `LogicFlowPlan` 接口上新增可选字段 `buildFlow`：

```ts
interface BuildFlowPlanData {
  assignments: BuildFlowAssignment[]
}

interface LogicFlowPlan {
  id: string
  name: string
  groups: SavedFlowGroup[]
  settings: LogicFlowSettings
  buildFlow?: BuildFlowPlanData  // 新增
  lastUpdated: number
}
```

分组信息（`BuildFlowGroup`）不持久化，每次加载时从 groups 重新推导。

### Save 路径

当用户保存当前方案时（`savePlan()` / `saveAsPlan()`），将运行时 assignments 写入 `plan.buildFlow`：

- 若 assignments 非空，写入 `buildFlow: { assignments: [...] }`
- 若 assignments 为空，写入 `buildFlow: undefined`（不存储空壳）

### Load 路径

当用户加载方案时（`loadPlan()` → `applyPlan()`），从 `plan.buildFlow?.assignments` 读取并恢复到运行时状态：

- 加载后立即执行一轮失效清理（因为 groups 可能与保存时有差异）
- 清理后的结果作为当前运行时 assignments

### 迁移

`stateMigrations.ts` 需处理旧版 `LogicFlowPlan` 无 `buildFlow` 字段的情况：

- 旧版 plan 无 `buildFlow` 字段 → 正常加载，运行时 assignments 初始为空数组
- 不需要版本号变更：`buildFlow` 是可选字段，缺失时等价于空 assignments
- `importExport.ts` 中导出/导入逻辑需透传 `buildFlow` 字段

### 保存另存为

`saveAsPlan()` 复制当前 plan 时，`buildFlow` 随 `LogicFlowPlan` 一起复制到新 plan。

## Presenter 路径

Presenter 文件路径为 `src/components/logic-flow/presenters/useBuildFlowPresenter.ts`，遵循 empire 功能的 `use<Feature>Presenter.ts` 命名约定。

Presenter 职责：

- 接收 store 提供的派生数据（buildFlowGroups、demandMaterialSet）
- 接收 store 提供的 assignments
- 按分组组装 UI 直接消费的展示结构：分组列表、组内 card 列表、标签列表、菜单目标列表（组内过滤）、edge 锚点数据
- 提供行为方法：`bindAssignment()`、`unbindAssignment()`，供 Vue 组件调用

Vue 组件通过 presenter 取数和触发行为，不得直接访问 store。

## 风险与约束

- 旧版 `logic-flow` 目前仍有较多 Vue 直连 store 写法，本次新增功能应避免把新逻辑继续堆进现有大组件。
- `buildCost` 统计必须基于产线自身模块，而不是只看主要产品对应模块。
- 目标唯一性必须以"目标标签键"实现，而不是只按 `wareId` 实现；否则不同 card 上同名标签会互相污染。
- 连线锚点需要稳定且可重算，避免依赖文案文本或数组索引。
- `BuildFlowZone` 的自动隐藏必须彻底脱离命中树，避免隐藏但仍占据拖拽命中区域。
- 分组是动态推导结果，不持久化。分组重组时必须清理跨组 assignments。
- 分组容器内连线仍在同一 SVG 层渲染，需确保分组容器的 position 不会导致连线坐标系偏移。

---

## 增量功能：产线归档 (Archive)

### 目标

允许用户将建筑产线区内的产线"归档"，归档后的产线不再参与建筑产线区的计算与显示，但仍存在于规划区。用户可通过标题栏图标查看和恢复归档产线。

### 数据模型

在 `BuildFlowPlanData` 新增可选字段：

```ts
interface BuildFlowPlanData {
  assignments: BuildFlowAssignment[]
  archivedGroupIds?: string[]  // 新增：归档产线的 groupId 列表
}
```

### 派生计算调整

#### computeDemandMaterialSet

新增 `archivedGroupIds` 参数，排除归档产线的 buildCost：

```ts
export function computeDemandMaterialSet(
  groups: ProductionLineGroup[],
  modulesMap: Record<string, X4Module>,
  archivedGroupIds: Set<string>  // 新增参数
): Set<string>
```

逻辑变更：遍历 groups 时跳过 `archivedGroupIds.has(group.id)` 的产线。

#### deriveBuildFlowView

新增 `archivedGroupIds` 参数，透传至 `computeDemandMaterialSet`，并在筛选入选产线时排除归档产线：

```ts
export function deriveBuildFlowView(
  groups: ProductionLineGroup[],
  modulesMap: Record<string, X4Module>,
  groupDisplayNames: Map<string, string>,
  getWareLabel: (wareId: string) => string,
  archivedGroupIds: Set<string>  // 新增参数
): { ... }
```

### Store 新增

#### 状态

```ts
const archivedGroupIds = ref<string[]>([])
```

#### 方法

```ts
function archiveGroup(groupId: string): void {
  if (archivedGroupIds.value.includes(groupId)) return
  archivedGroupIds.value.push(groupId)
  // 清理该产线相关的 assignments
  buildFlowAssignments.value = buildFlowAssignments.value.filter(a => 
    a.sourceGroupId !== groupId && a.targetGroupId !== groupId
  )
}

function unarchiveGroup(groupId: string): void {
  const idx = archivedGroupIds.value.indexOf(groupId)
  if (idx === -1) return
  archivedGroupIds.value.splice(idx, 1)
}
```

#### 持久化

`saveCurrentPlan` 新增 `archivedGroupIds` 写入：

```ts
buildFlow: {
  assignments: [...buildFlowAssignments.value],
  archivedGroupIds: archivedGroupIds.value.length > 0 
    ? [...archivedGroupIds.value] 
    : undefined
}
```

`applyPlan` 新增恢复：

```ts
archivedGroupIds.value = plan.buildFlow?.archivedGroupIds 
  ? [...plan.buildFlow.archivedGroupIds] 
  : []
```

### UI 设计

#### 产线 Card 右上角 Archive 图标

在每个产线 card 标题行右侧添加 archive 图标（仅对非归档产线显示）：

- 图标：使用 archive-box 或类似图标
- 点击效果：调用 `archiveGroup(groupId)`
- 视觉：灰色小图标，hover 时高亮

#### 标题栏 Archive 图标

在 `BuildFlowZone` 标题行右侧添加 archive 图标：

- 仅当 `archivedGroupIds.length > 0` 时显示
- 图标样式与产线 card 的 archive 图标一致
- 点击效果：弹出 Modal 显示归档产线列表

#### Archive Modal

Modal 内容：

- 标题：已归档产线
- 列表：每条归档产线显示为简化版 card（只显示产线名称）
- 每条 card 右上角：点击恢复图标，调用 `unarchiveGroup(groupId)`，恢复后 card 从列表消失
- 若列表为空（全部恢复），Modal 自动关闭

### Presenter 调整

`useBuildFlowPresenter` 新增：

```ts
interface BuildFlowPresenterStore {
  // ...existing
  archivedGroupIds: ComputedRef<string[]>
  archiveGroup(groupId: string): void
  unarchiveGroup(groupId: string): void
}

// 新增返回
archivedLineCards: ComputedRef<BuildFlowLineCard[]>  // 归档产线的 card 数据
```

`archivedLineCards` 计算逻辑：从 `lineCards` 中筛选 `archivedGroupIds` 包含的产线。

### Locales 新增

```json
// zh-CN
{
  "build_flow_archive": "归档",
  "build_flow_unarchive": "恢复",
  "build_flow_archived_title": "已归档产线",
  "build_flow_archived_empty": "无归档产线"
}

// en
{
  "build_flow_archive": "Archive",
  "build_flow_unarchive": "Restore",
  "build_flow_archived_title": "Archived Lines",
  "build_flow_archived_empty": "No archived lines"
}
```

### 涉及文件

| 文件 | 改动 |
|---|---|
| `src/types/x4.ts` | `BuildFlowPlanData` 新增 `archivedGroupIds` |
| `src/store/logic/buildFlowDerivation.ts` | `computeDemandMaterialSet` / `deriveBuildFlowView` 新增参数 |
| `src/store/useLogicFlowStore.ts` | 新增 `archivedGroupIds` / `archiveGroup` / `unarchiveGroup`，修改 `saveCurrentPlan` / `applyPlan` |
| `src/components/logic-flow/presenters/useBuildFlowPresenter.ts` | 新增 `archivedLineCards` / archive 方法 |
| `src/components/logic-flow/BuildFlowZone.vue` | 新增 archive 图标 + Modal |
| `src/locales/zh-CN.json` / `en.json` | 新增 i18n 文本 |

### 行为边界

- 归档产线不参与"需求原材料"计算（buildCost 排除）
- 归档产线不显示在建筑产线区
- 归档时清理该产线相关的 assignments（来源或目标）
- 归档产线仍存在于规划区，不受影响
- 恢复归档产线后重新参与建筑产线区计算
