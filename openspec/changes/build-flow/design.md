# Build Flow - Design

## 目标

在不污染现有 `logicFlow.groups` / `FlowNode` 业务结构的前提下，为 `logic-flow` 增加一套“建筑流”派生视图和独立关系层。该层负责：

- 从现有产线推导建筑相关来源与目标
- 维护来源标签到目标标签的唯一绑定关系
- 支持拖拽 / 菜单 / 覆盖 / 解绑
- 以有向线形式可视化关系

## 分层策略

遵循仓库新的 `store -> presenter -> vue` 原则，本次新增逻辑应尽量采用：

- `store`
  - 负责基础状态与关系存储
  - 负责基于 `logicFlow.groups` 的原始派生计算
- `presenter`
  - 负责面向 UI 组装 card、tag、目标列表、连线锚点数据
- `vue`
  - 负责渲染 card / tag / menu / edge
  - 只通过 presenter 读取展示数据和触发行为

本次不要求重构整个旧版 `logic-flow`，但新增“建筑产线区”逻辑不得继续扩散新的“Vue 直连 store 做复杂组装”的写法。

## 布局与可见性

工作台布局固定为：

- 顶部：`LogicFlowCandidateZone`
- 中部：`BuildFlowZone`
- 底部：`LogicFlowPlanningZone`

`BuildFlowZone` 默认常显，不提供折叠/展开控件。原因：

- 与当前页面连续工作台的视觉风格更一致
- 不引入额外 section 控件与状态
- 规划拖拽干扰问题通过“拖拽期间自动隐藏”解决即可

运行时可见性规则：

- 当拖拽上下文属于规划区相关拖拽时，`BuildFlowZone` 自动隐藏
- 拖拽结束后自动恢复显示
- 该状态只用于避免无关区域参与 hover / drop / 命中，不做持久化

### Card 布局结构

每个产线 card 的内部布局为：

- 顶部整行：产线名称（使用 `getLogicFlowGroupDisplayName` 获取，与规划区产线名称一致）
- 下方横向区域（`flex justify-between`）：
  - 左侧列：“产线建材”标签，竖向排列
  - 右侧列：“产线原材料”标签，竖向排列，右对齐（`items-end`）

“产出区” card 内“现产原材料”标签竖向排列。

## 数据模型

建议引入一套独立关系模型，避免向 `ProductionLineGroup` / `FlowNode` 混入建筑流字段。

### 派生视图模型

```ts
interface BuildFlowLineCard {
  groupId: string
  title: string
  sourceTags: BuildFlowTag[]
  buildMaterialTags: BuildFlowTag[]
}

interface BuildFlowOutputCard {
  outputTags: BuildFlowTag[]
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
- `outputTags` = 现产原材料

### 关系模型

```ts
type BuildFlowTargetType = 'line-build-material' | 'output-material'

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

其 key 集合作为“需求原材料”集合。模块口径同 Step 1（排除 isolated 和 tier 0）。

### 3. 建筑产线筛选

若某条产线的主要产品中存在 `wareId ∈ demandMaterialSet`，则该产线进入建筑产线区。

### 4. 每卡片内容

对每个入选产线 group 计算：

- `产线原材料`
  - = 主要产品中命中 `demandMaterialSet` 的那些产物
- `产线建材`
  - = 该产线自身模块（`!isIsolated && tier > 0`）`buildCost` 材料集合与"现产原材料"的交集

### 5. 产出区内容

将全部入选产线的 `产线原材料` 去重并集，作为“现产原材料”。

## 交互设计

### 来源标签交互

来源标签（产线原材料）需要具备两种入口：

- 拖拽到同 `wareId` 的目标标签
- hover 后点击 `+` 打开目标菜单

目标菜单列表应只显示同 `wareId` 的目标标签，包括：

- 其他产线 card 中的同名 `产线建材`
- 产出区中的同名 `现产原材料`

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
output-material: `output:${wareId}`
```

## 连线设计

连线层需要能够根据关系记录定位两端锚点，因此 presenter 应为每个标签提供稳定的锚点标识。

建议锚点 key 设计：

```ts
source: build-flow-source:<groupId>:<wareId>
target(line): build-flow-target:line:<groupId>:<wareId>
target(output): build-flow-target:output:<wareId>
```

关系转边时：

- 起点 = `sourceGroupId + wareId`
- 终点 = `targetType + targetGroupId? + wareId`

连线层职责：

- 根据锚点 DOM 位置绘制 SVG 路径
- 布局变化时重算
- 覆盖 / 解绑时移除旧边

## 涉及文件

建议变更集中在以下区域：

| 文件/目录 | 角色 |
|---|---|
| `src/store/useLogicFlowStore.ts` 或相邻新 store 模块 | 持有建筑流关系状态与基础计算能力 |
| `src/components/logic-flow/presenters/useBuildFlowPresenter.ts` | 组装建筑产线区 card / tag / menu / edge 数据 |
| `src/components/logic-flow/LogicFlowWorkbenchView.vue` | 挂载建筑产线区 |
| `src/components/logic-flow/` 下新增建筑产线区组件 | 渲染 card、tag、菜单、解绑入口 |
| `src/components/logic-flow/` 下新增边组件 | 渲染建筑流有向线 |

## Assignments 失效清理

当 groups 运行时数据发生变更时，已持久化的 assignments 可能引用不存在的来源或目标。系统需要在推导重新计算后执行失效清理。

### 清理时机

每次派生视图重新计算后（即 groups 变化触发 `demandMaterialSet`、入选产线、产出区标签重新推导时），执行一轮失效清理。

### 清理规则

按以下优先级逐条检查 assignments 数组中的每条记录：

1. **来源产线不存在**：若 `sourceGroupId` 在当前 `groups` 中不存在，删除该 assignment。
2. **来源产线不再入选**：若 `sourceGroupId` 对应的产线不再属于建筑产线区（其主要产品不再命中 `demandMaterialSet`），删除该 assignment。
3. **来源标签失效**：若该产线的产线原材料中不再包含 `assignment.wareId`，删除该 assignment。
4. **目标产线不存在**（仅 `targetType === 'line-build-material'`）：若 `targetGroupId` 在当前 `groups` 中不存在，删除该 assignment。
5. **目标产线不再入选**（仅 `targetType === 'line-build-material'`）：若 `targetGroupId` 对应的产线不再属于建筑产线区，删除该 assignment。
6. **目标标签失效**：
   - `targetType === 'line-build-material'`：若目标产线的产线建材中不再包含 `assignment.wareId`，删除该 assignment。
   - `targetType === 'output-material'`：若产出区的现产原材料中不再包含 `assignment.wareId`，删除该 assignment。

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

新增 presenter 文件路径为 `src/components/logic-flow/presenters/useBuildFlowPresenter.ts`，遵循 empire 功能的 `use<Feature>Presenter.ts` 命名约定。

Presenter 职责：

- 接收 store 提供的派生数据（line cards、output card、demandMaterialSet）
- 接收 store 提供的 assignments
- 组装 UI 直接消费的展示结构：card 列表、标签列表、菜单目标列表、edge 锚点数据
- 提供行为方法：`bindAssignment()`、`unbindAssignment()`，供 Vue 组件调用

Vue 组件通过 presenter 取数和触发行为，不得直接访问 store。

## 风险与约束

- 旧版 `logic-flow` 目前仍有较多 Vue 直连 store 写法，本次新增功能应避免把新逻辑继续堆进现有大组件。
- `buildCost` 统计必须基于产线自身模块，而不是只看主要产品对应模块。
- 目标唯一性必须以“目标标签键”实现，而不是只按 `wareId` 实现；否则不同 card 上同名标签会互相污染。
- 连线锚点需要稳定且可重算，避免依赖文案文本或数组索引。
- `BuildFlowZone` 的自动隐藏必须彻底脱离命中树，避免隐藏但仍占据拖拽命中区域。
