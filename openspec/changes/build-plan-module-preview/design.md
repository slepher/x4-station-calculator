# build-plan-module-preview 设计

## 目标

把 preview 从旧的“责任 type 列表 + 再映射成 goals 展示”结构，改成“直接面向 UI 的 preview 项真相层”。

这次只覆盖 preview：

1. 明确拆分 `derived` 项与 `required` 项
2. 在 preview 阶段固定 `derived.moduleId`
3. 取消 preview → compat goals 的展示链路
4. preview 的 build-material root 改为完整展开产线，而不是 `autoFill` 结果

## 问题

当前 preview 存在三个混淆源：

1. 单一 `type` 同时承载目标、供给、需求三类语义
2. preview 结果会再被 presenter 映射回旧 `goals` 结构，导致 UI 继续依赖旧模型
3. `moduleId`、`target`、`derived`、`required` 的职责没有拆开，难以在 preview 阶段固定 module
4. preview 建图入口把 `autoFill` 计算出的模块集合当成 root，导致建材范围被数量求解结果污染

因此需要把 preview 真相层直接改造成面向展示和后续读取都清晰的结构。

## 方案

### 1. Preview 类型拆分

将旧的单一 `PreviewResponsibility` 拆成：

```ts
type PreviewItem = PreviewDerivedItem | PreviewRequiredItem
```

```ts
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

对应地：

```ts
interface PreviewLinePlan {
  groupId?: string
  groupName: string
  isUnmatched: boolean
  lineage: string
  items: PreviewItem[]
}
```

约束：

1. `derived` 和 `required` 不再共用同一类型
2. `derived` 必须有 `moduleId`
3. `required` 不允许承载 `moduleId`
4. `targets[]` 只存在于 `derived`

### 2. 合并规则

#### 2.1 Derived

同一条线内：

- 合并键：`groupId + wareId + moduleId`
- 行为：
  - 合并同键项
  - `derived[]` 去重
  - `targets[]` 追加
  - `relatedLineGroupIds` 合并去重

#### 2.2 Required

同一条线内：

- 合并键：`groupId + wareId`
- 行为：
  - 合并同键项
  - `required[]` 去重
  - `relatedLineGroupIds` 合并去重

#### 2.3 Derived / Required 不混合

即便同一条线、同一 `wareId` 同时存在供给与需求语义，也必须保留为两条 preview 项：

- 一条 `derived`
- 一条 `required`

### 3. Module 确认

preview 在构造 `derived` 项时直接确认 `moduleId`。这一步是 module 真相层的唯一生成入口。

#### 3.1 Lineage 生成

每条 logic-flow 产线先生成自己的 `lineage`：

```ts
const lineage = group.isLocked
  ? (group.lockedLineage || group.subCategory)
  : group.subCategory
```

若结果为空，则回落为：

```ts
'default'
```

说明：

1. 这与现有提交中 `lineage` 的来源保持一致
2. `lockedLineage` 优先于 `subCategory`
3. `subCategory` 持续承担 race / lineage 来源字段角色

#### 3.2 Derived moduleId 选择

规则：

1. 第一轮优先 `manual`
2. `manual` 有多个时先按 `lineage`
3. 若仍有多个，取第一个
4. 第二轮使用 `auto`
5. `auto` 只服从 `lineage`
6. 若仍有多个，取第一个

对于 unmatched：

1. 不绑定到真实 logic-flow group
2. 但仍按 `settings.racePreference` 确认 `moduleId`
3. UI 分组名仍保持“待规划产线 / Unplanned Line”

#### 3.3 Compute 不再重复生成 moduleId

preview 为 `derived` 项一旦选定 `moduleId`，compute 只允许读取，不允许重选。

即：

```text
preview
  -> 生成 lineage
  -> 生成 derived.moduleId

compute
  -> 读取 preview.items[].moduleId
  -> 不再重新根据 lineage / racePreference / producer 搜索改写 moduleId
```

约束：

1. compute 不得再次调用“为 preview 项挑选主要生产模块”的逻辑
2. compute 可以基于 preview 已选 `moduleId` 继续求主模块数量和辅助模块
3. compute 若需要 lineage，只能把它当作辅助上下文，不得覆盖 preview 已确认的 `moduleId`

### 4. Presenter / Vue 链路

旧链路：

```text
preview truth
  -> presenter 映射回 ProductionLineAllocation.goals
  -> Vue 继续按旧 goal.type 渲染
```

新链路：

```text
preview truth
  -> presenter 只做展示字段映射
  -> Vue 直接按 PreviewItem.kind / tags 渲染
```

约束：

1. preview 展示不再回退到旧 `goal.type`
2. preview 展示不再依赖 `target-production` / `derived-production` / `required-production`
3. presenter 不再二次拼装旧 preview 责任语义

### 4.1 Preview Root 范围

preview 的 build-material 图不再从 `expandGoalDependencies + autoFill` 的模块集合起图，而改为：

1. 先通过 production allocation 找出承接目标的目标产线
2. 对每条目标产线收集当前 logic-flow 已展开的非 isolated 模块节点
3. 将这组模块视为 preview root 模块集合
4. 用这组 root 模块的 `buildCost` 作为依赖图首层输入

约束：

1. preview root 只表达“完整产线结构的建材范围”
2. `autoFill` 不再参与 preview root 范围判定
3. compute 仍可基于 preview 结果继续做数量求解

### 5. 展示规则

#### 5.1 名称

- 若 item 有 `moduleId`，显示 module 名称
- 否则显示 ware 名称

由于 `required` 项没有 `moduleId`，它们天然显示 ware 名称。

#### 5.2 Tag

- `derived` 使用绿色 tag
- `required` 使用红色 tag

值映射：

| 值 | 中文 | English |
|----|------|----------|
| `target` | `目标` | `Target` |
| `production` | `材料` | `Production` |
| `build-material` | `建材` | `Material` |

#### 5.3 卡片计数

每条产线右上角数量改为：

- 当前 line 中已分配 `moduleId` 的去重种类数

不再表示 preview 项总数。

## 影响面

主要影响：

1. `src/types/build-plan.ts`
2. `src/store/logic/buildPlanProductionLine.ts`
3. `src/components/empire/presenters/useBuildPlanPresenter.ts`
4. `src/components/empire/ProductionLineAllocationSection.vue`
5. `src/locales/en.json`
6. `src/locales/zh-CN.json`

不影响：

1. compute 公式
2. scheme 结构
3. steps 结果

但会新增一个 compute 约束：

1. compute 不再二次生成 preview 项 `moduleId`

## 风险控制

1. preview 真相层与旧 compat 结构并存期间，必须避免 UI 同时消费两套语义
2. `derived` / `required` 拆分后，任何旧的 `goal.type` 分支都不应再参与 preview 展示
3. unmatched 选 module 只为 preview 固定 module，不代表它已经绑定到正式产线
4. 若 compute 仍保留旧的 producer 选择逻辑，必须避免其覆盖 preview 已选 `moduleId`
5. 若 preview 继续从 `autoFill` 模块集合起图，会把数量求解结果误当成结构范围，重新引入建材链路污染
