# Active Station Refactory - 设计文档

## 设计目标

本次重构不是修改 production flow 算法，而是收紧 production workbench store 的实体边界。

当前问题是：

- `bindingStation`
- `archiveStation`
- `activeStation`

三者既在表达“当前实体来源”，又部分承担“当前可编辑对象”职责，导致 `station` / `transit` 分支在 store 内部重复扩散。

本方案的目标是固定四个概念：

1. 当前工作台模式
2. 当前实体来源
3. 当前页面实体
4. 当前可编辑 planning 实体

其中 live store 是主要问题场景，但 blueprint store 也必须同步到同一套 station 编辑边界，否则 presenter 主路径会再次分叉。

## 页面消费事实

设计必须以现有页面真实消费点为准，而不是只以 store 内部命名推导。

### 1. `overview` 页面

`overview` 页面不消费当前站点实体，也不消费当前可编辑 plan。

它只依赖：

- `session.workbenchMode`
- empire 级展示数据

因此本次设计不围绕 `overview` 建模实体。

### 2. `station` 页面

`station` 页面真实消费四类信息：

1. 当前实体信息
2. 当前可编辑 planning 实体
3. 当前上下文 `context`
4. 当前主状态 `stationState(entityType = 'station')`

其中：

- toolbar 需要当前实体名称、sector、position、settings 等实体视角信息
- planning panel 需要可编辑 planning 模块入口
- wareflow 需要 station 主状态与交互入口
- dashboard 需要 station 主状态与 archive 辅助信息

因此 `station` 页面同时需要“统一实体”和“可编辑 plan”。

### 3. `transit` 页面

`transit` 页面也明确消费当前实体，但不消费 station plan 编辑入口。

它真实依赖：

1. 当前实体信息
2. 当前上下文 `context`
3. 当前主状态 `stationState(entityType = 'transit')`

其中：

- transit toolbar 需要当前实体标题、位置、sector、settings
- transit build panel / archive list 需要 transit 当前实体关联的 archive / infrastructure 展示
- transit center dashboard 需要 transit flow
- 右侧 dashboard 需要当前实体模块展示与 settings

因此 transit 页面必须保留 `activeStation`，但不需要 `editableStationPlan`。

## 目标架构

### 1. 模式层

模式层只回答“当前页面是哪一种工作台模式”。

正式出口继续使用：

- `session.workbenchMode`

它只负责：

- `overview` / `station` / `transit` 页面切换
- station/transit 行为分流

它不再负责：

- 决定当前实体来源
- 决定当前实体对象 shape

### 2. 来源层

来源层只回答“当前实体从哪里来”。

保留两个来源对象：

- `bindingStation`
- `archiveStation`

约束如下：

- `bindingStation` 表达当前实体在 binding 侧的来源
- `archiveStation` 表达当前实体在 archive 侧的来源
- 它们都覆盖 `station` 与 `transit`
- 它们不直接表达页面模式
- 它们不直接表达编辑能力

这里的关键不是“名称分出来”，而是“实体解析真的收口”。

因此最终设计要求是：

- `bindingStation` 内部不再残留用 `mode` 直接决定当前实体的分叉主路径
- `archiveStation` 内部也不再残留用 `mode` 直接决定当前实体的分叉主路径

如果只是把 `activeStation` 表面改成统一抽象，但 `bindingStation` 或 `archiveStation` 仍各自保留一套 `station/transit` 实体选源逻辑，那么该设计不算完成。

### 3. 当前实体层

当前实体层只回答“当前页面正在看谁”。

保留：

- `activeStation`

并固定规则：

```text
activeStation = normalize(bindingStation) ?? normalize(archiveStation)
```

也就是说：

- `bindingStation` 优先
- `archiveStation` 仅作为 fallback
- `activeStation` 是统一实体抽象
- `station` 与 `transit` 页面都拥有 `activeStation`

`activeStation` 不再承担“可编辑 plan”职责。

并且要强调：

- `activeStation` 的统一，不允许建立在“下层来源对象仍未收口”的前提上
- 只有当 `bindingStation` / `archiveStation` 都已经完成统一实体解析后，`activeStation = bindingStation | archiveStation` 才算真实成立

### 4. 可编辑实体层

新增：

- `editableStationPlan`

该对象只回答“当前页面有哪些 planning 写入口可以使用”。

当前规则：

- `station` 模式下：指向普通站点 binding plan
- `transit` 模式下：`null`

本次明确不为未来 transit 可编辑预留 `sourceKind` 等扩展字段；未来若需求出现，再基于当时场景扩展。

在 blueprint store 下：

- 只有 `station` / `overview`
- 没有 archive fallback
- 没有 transit 页面

但仍要保留同名 `editableStationPlan`，用于和 live store 对齐 station 编辑主路径。

### 5. 页面标准输出层

页面和 presenter 的正式消费出口仍是：

- `session`
- `context`
- `stationState`

其中：

- `context` 表达当前实体的附加上下文
- `stationState` 表达当前实体主状态

`activeStation` 为它们提供统一实体语义，但不替代它们成为唯一页面出口。

## 字段边界

### 1. `activeStation`

`activeStation` 面向统一实体语义，至少应能稳定承载：

- `id`
- `name`
- `type`
- `settings`
- `sectorId` 或可推导的当前实体空间归属
- 页面展示需要的基础字段

它可以来自 binding 归一化，也可以来自 archive fallback 归一化。

### 2. `editableStationPlan`

`editableStationPlan` 面向 station plan 编辑入口，至少需要承载当前已使用的编辑字段：

- `id`
- `name`
- `type`
- `sectorId`
- `modules`
- `settings`
- `lockedWares`
- `warePriority`

不额外增加未来导向字段。

## 迁移策略

### 1. 将实体解析与编辑入口拆开

先将 store 内对 `activeStation` 的两类职责拆开：

- 统一实体解析职责保留在 `activeStation`
- 可编辑 plan 目标迁移到 `editableStationPlan`

### 2. station plan 编辑动作统一改读 `editableStationPlan`

以下入口应统一切换到 `editableStationPlan`：

- `plannedModules`
- `lockedWares`
- `warePriority`
- station module actions
- station ware rule actions
- station 侧 settings 写入口

该规则同时适用于：

- `useLiveProductionStore`
- `useBlueprintProductionStore`

### 3. transit 保留统一实体，不走 station plan 编辑链

transit 页面仍走：

- `bindingStation`
- `archiveStation`
- `activeStation`
- `context`
- `stationState(entityType = 'transit')`

但不再借用 station plan 编辑主路径。

### 4. mode 分支收缩为行为分流

保留 `workbenchMode === 'transit'` 的地方，应只剩：

- 页面区块切换
- transit 特有 flow / dashboard / toolbar 计算
- transit 特有 settings 写入

若分支目的是“决定当前实体是谁”，则应迁移为统一来源链路处理。

这里不接受“先保留来源层里的模式分支，后续再收”。

本次变更必须一步到位达到：

- 来源层不再用 `mode` 选当前实体
- 实体层不再重复发明来源逻辑
- mode 只保留页面和行为语义

## 风险与约束

### 1. 风险：当前 store 内有大量编辑逻辑默认依赖 `activeStation`

若只改命名、不改写入口依赖，仍会保留职责混用问题。

因此本次重构必须把实际 mutation target 也一并收口。

### 1.1 风险：表面统一 `activeStation`，但来源层仍残留 mode 分支

如果只把 `activeStation` 写成统一抽象，而 `bindingStation` / `archiveStation` 仍在内部通过 `mode` 决定实体来源，那么：

- 表面 API 看起来统一
- 实际实体解析仍然分散
- 后续任何边界讨论都会再次失真

因此这类“半收口”状态在本次必须视为未完成，而不是后续优化项。

### 2. 风险：transit 页面虽然不可编辑 plan，但仍高度依赖当前实体

若错误地把 transit 下的 `activeStation` 删除，会直接破坏 toolbar 与 dashboard 的统一实体输入。

因此本次重构必须保留 transit 下的 `activeStation`。

### 3. 约束：不提前为未来需求增加未使用结构

本次不增加未来导向字段或额外兼容层。

若未来 transit 可编辑，再单独扩展 `editableStationPlan` 的来源，不在本次预埋。

## 结果形态

重构完成后，关系应稳定为：

```text
bindingStation / archiveStation = 当前实体来源
activeStation = 当前页面实体
editableStationPlan = 当前可编辑 planning 实体
workbenchMode = 当前页面模式
context / stationState = 页面正式消费出口
```

这样可以保证：

- `station` / `transit` 页面都能共享当前实体模型
- station plan 编辑入口不再与 transit 展示链混杂
- blueprint store 与 live store 的 station 编辑主路径保持兼容
- 未来若 transit 可编辑，只需扩展 `editableStationPlan` 来源，不必重新定义 `activeStation`
