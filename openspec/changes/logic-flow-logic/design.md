# logic-flow-logic 设计

## 目标

为 `logic-flow` 与 `build-plan` 之间建立清晰的领域边界：

1. `logic-flow` 负责定义并输出节点语义与责任真值。
2. `build-plan` 只消费该真值，不再自行重演推导。
3. 胶水脚本与网页通过同一共享入口获得一致解释结果。

## 背景

当前代码链路大致分为四层：

1. `logicFlowStream.ts`
   - 定义上游推导规则
   - 遇到 `isolated` 时停止扩展
2. `hydrateSavedFlowGroups.ts`
   - 从 `SavedFlowGroup` 还原完整 `ProductionLineGroup[]`
3. `buildFlowDerivation.ts`
   - 生成 build-flow 标签、分组与虚拟边
4. `computeProductionLineAllocation.ts`
   - 再次从 `groups` 与 `goals` 反向推导责任归属

问题不在第 1 层，而在第 4 层：

- 第 1 层已经知道 `isolated` 是显式边界。
- 第 4 层却把 `isolated` 仅当作“生成 derived / required 的触发信号”，随后又允许 manual / auto 非 isolated 节点重新抢走责任。
- 结果是 `logic-flow` 的领域语义被 `build-plan` 二次解释冲掉。

因此，这次设计的核心不是“调优分配优先级”，而是把第 4 层中属于领域解释的部分收回到 `logic-flow`。

## 领域语义模型

### 1. 节点语义

#### `manual + !isolated`

表示用户显式声明：

- 本组负责生产该 ware
- 该节点参与本组后续上游推导
- 该节点可作为本组显式生产责任依据

#### `manual + isolated`

表示用户显式声明：

- 本组在此 ware 处截断
- 该 ware 作为外部输入存在
- 本组不生产该 ware
- 对该 ware 的上游推导在本组终止

这是一个“边界声明”，不是一个普通生产节点。

#### `auto + !isolated`

表示系统根据显式节点向上游补出的推导结果：

- 它是结构性辅助信息
- 它说明“如果继续推导，本组可由该模块生产该 ware”
- 它不是用户声明
- 它不能覆盖显式 `isolated` 的边界语义

### 2. 停止推导规则

`logicFlowStream.computeExpandUpstream()` 中已有核心规则：

- 若组中已存在 `wareId === X && isIsolated === true` 的节点
- 则对 `X` 的上游扩展立即停止

本次设计将该规则提升为全链路规则：

- 节点补全时停止
- 责任解释时也必须视为边界
- 责任归属不能跨越这个边界再被别组 auto 节点重解释

## 目标架构

### 1. 新增共享真值模块

建议新增模块，例如：

- `src/store/logic/logicFlowResponsibility.ts`

该模块属于领域逻辑层，不依赖 Vue / Pinia / analysis script。

### 2. 输入

最小输入建议：

```ts
interface ResolveLogicFlowResponsibilitiesInput {
  groups: ProductionLineGroup[]
  buildFlowView: BuildFlowView | null
  modulesMap: Record<string, X4Module>
  modulesByOutputMap: Record<string, X4Module[]>
  goals: BuildGoal[]
}
```

其中：

- `groups` 必须是 hydrate 之后的完整组
- `buildFlowView` 用于消费用户 build-flow assignment
- `goals` 仅作为目标驱动输入，不负责重定义节点语义

### 3. 输出

最小输出建议：

```ts
interface LogicFlowResponsibilityResult {
  groupFacts: LogicFlowGroupFact[]
  responsibilities: LogicFlowResponsibility[]
}

interface LogicFlowGroupFact {
  groupId: string
  manualProducedWareIds: string[]
  isolatedWareIds: string[]
  autoProducedWareIds: string[]
}

interface LogicFlowResponsibility {
  ownerGroupId: string
  responsibilityType: 'production' | 'required' | 'build-material'
  wareId: string
  sourceKind: 'explicit-manual' | 'explicit-isolated-boundary' | 'build-flow-assignment' | 'derived-from-goal'
  boundaryGroupId?: string
  relatedGroupIds: string[]
}
```

关键点：

- 输出必须显式区分“事实”和“解释结果”
- `groupFacts` 反映组内真实结构
- `responsibilities` 反映最终责任归属
- 若某责任由显式 isolated 边界决定，必须能从输出中看出来

## 迁移边界

### 1. 留在 `logic-flow` 的内容

应归入新共享模块或与其协同的内容：

- 识别 `manual / auto / isolated` 各自含义
- 判定某条上游路径是否被显式 isolated 截断
- 判定某责任是否应归属于边界所在组
- 使用 build-flow assignment 解释产线之间的显式供给关系

### 2. 迁出 `build-plan` 的内容

`computeProductionLineAllocation.ts` 中以下内容应迁出：

- `buildCoveredSet()`
- `walkUpstream()`
- `generateDerivedGoals()`
- `findGroupWithIsolatedWare()` 驱动的 derived / required 生成语义
- manual / auto / isolated 多轮匹配分配策略

原因：

- 这些逻辑都在重新解释节点领域语义
- 它们不属于 build-plan 展示层或求解层

### 3. 留在 `build-plan` 的内容

`build-plan` 应只负责：

- 调用共享真值模块
- 将责任真值格式化为 `PreviewResult`
- 继续完成 preview / compute 的后续求解
- 为 UI 或脚本输出派生展示结构

也就是说：

- `build-plan` 可以格式化
- 但不能重新解释节点语义

## 脚本复用方式

胶水脚本未来应走这条路径：

```text
读取 export
-> hydrateSavedFlowGroups()
-> deriveBuildFlowView()
-> resolveLogicFlowResponsibilities()
-> build-plan preview/print adapter
```

脚本不应直接调用一套只服务 Vue store 的私有分配逻辑，更不应复制 `manual -> auto -> isolated` 的扫描规则。

## 风险与约束

### 风险 1：把“事实层”和“展示层”继续混在一起

若新模块直接输出 UI 结构，会再次让领域逻辑与 presenter 耦合。

约束：

- 新模块只输出领域事实与责任结果
- UI 标签、文案、排序留给上层

### 风险 2：继续把 auto 节点当成和显式边界同等级的真值

这会再次产生“isolated 被 auto 覆盖”的问题。

约束：

- 显式 `isolated` 是边界声明
- `auto` 仅是推导结果
- 责任解释不可让 `auto` 覆盖显式边界

### 风险 3：build-plan 保留旧逻辑分叉

若新模块引入后，旧的 `computeProductionLineAllocation()` 仍保留同等真值地位，会产生双轨系统。

约束：

- 新模块落地后，旧逻辑要么删除，要么降级为过渡适配层
- 不允许长期并行维护两套责任解释规则

## 结果

本次设计完成后，系统边界应变为：

- `logic-flow` 决定语义与边界
- 共享 logic 模块输出责任真值
- `build-plan` 与胶水脚本共同消费该真值

这使后续无论是修正 `Energy Cells (required-production)` 归属，还是继续扩展 build-plan，都不再需要在多个调用点重复实现同一套领域规则。
