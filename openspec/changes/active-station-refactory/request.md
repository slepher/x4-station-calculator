# Active Station Refactory 需求

## 目标

重构 production workbench store 中 `bindingStation`、`archiveStation`、`activeStation` 的职责边界，消除“当前实体”和“当前可编辑 plan”混用带来的分支扩散。

本次变更的核心目标是固定一条统一规则：

- `activeStation = bindingStation | archiveStation`

并将“当前页面实体”和“当前可编辑实体”拆成两条清晰链路，使 `station` / `transit` 页面都能稳定消费统一实体，而编辑逻辑只依赖专门的可编辑入口。

本次不仅要求 `useLiveProductionStore` 完成该收口，还要求 `useBlueprintProductionStore` 暴露兼容的同名边界，使两个 production store 在主路径上保持一致。

## 已确认方案（审核重点）

### 1. `activeStation` 固定为当前页面实体

`activeStation` 表示当前页面正在查看的实体，不再额外承担“可编辑 plan”语义。

它的来源固定为：

1. 优先使用 `bindingStation`
2. `bindingStation` 不存在时 fallback 到 `archiveStation`

`station` 与 `transit` 模式下都必须成立该规则；`overview` 下为 `null`。

### 2. `bindingStation` / `archiveStation` 都覆盖 station 与 transit

`bindingStation` 表示当前实体在 binding 侧的原始来源。

- `station` 模式下可以是普通 `BindingStationPlan`
- `transit` 模式下可以是 transit trade-station 对应的 binding 实体

`archiveStation` 表示当前实体在 archive/save 侧的原始来源。

- `station` 模式下对应普通站点 archive
- `transit` 模式下对应 trade-station 的 archive 映射

两者都是“当前实体来源”，不负责 UI 组装，也不直接表达编辑能力。

### 3. 单独引入 `editableStationPlan`

新增 `editableStationPlan`，专门表示当前页面可编辑的 planning 实体。

当前确认规则：

- `station` 模式下：`editableStationPlan` 指向当前普通站点的 binding plan
- `transit` 模式下：`editableStationPlan = null`

`editableStationPlan` 只用于承接模块、锁定、优先级、设置等 plan 编辑入口，不再让这些入口直接依赖 `activeStation`。

### 4. 本次不为未来 transit 可编辑预留额外字段钩子

本次不为未来 transit 可编辑提前增加 `sourceKind` 等扩展字段。

若未来确实需要 transit 可编辑，再基于当时的真实需求扩展 `editableStationPlan` 映射与字段，不在本次文档中预埋未使用结构。

### 5. `mode === 'transit'` 只用于模式行为分流

`mode === 'transit'` 或 `workbenchMode === 'transit'` 可以继续用于：

- 页面区域切换
- transit 专属 dashboard / toolbar / flow 逻辑
- transit 专属 settings 写入路径

但不应继续用于重复判断“当前实体是谁”。

只要在处理的是“当前实体来源”或“当前页面实体”，都应优先走：

- `bindingStation`
- `archiveStation`
- `activeStation`

这里的要求是一次性收敛，不接受“先把 `activeStation` 收敛、但 `archiveStation` 或其他来源链路内部暂时继续保留 `station/transit` 实体选源分支”的半完成状态。

只要某段逻辑仍在通过 `mode === 'station'` / `mode === 'transit'` 决定“当前 archive 实体是谁”或“当前 binding 实体是谁”，就说明实体来源链路尚未真正收口。

### 6. 页面消费边界以现有实际页面为准

`station` 页面与 `transit` 页面都消费“当前实体”，但它们对编辑能力的需求不同。

`station` 页面消费：

- `activeStation`
- `editableStationPlan`
- `context`
- `stationState(entityType = 'station')`

`transit` 页面消费：

- `activeStation`
- `context`
- `stationState(entityType = 'transit')`

`transit` 页面不消费 station plan 编辑入口。

### 7. `context` / `stationState` 继续作为页面标准出口

页面与 presenter 的正式消费出口继续是：

- `session`
- `context`
- `stationState`

本次重构不把 `activeStation` 直接提升为页面唯一出口；`activeStation` 是统一实体抽象，`context` / `stationState` 仍是页面标准消费对象。

### 8. blueprint store 与 live store 保持同构边界

虽然 blueprint store 没有 transit 页面，也没有 archive fallback，但它仍需提供与 live store 对齐的主语义：

- `activeStation` 表达当前页面实体
- `editableStationPlan` 表达当前可编辑 planning 实体

在 blueprint 下，两者当前可以指向同一个普通站点对象，但编辑入口仍必须统一依赖 `editableStationPlan`，不能继续直接把 `activeStation` 当作 mutation target。

### 9. 本次要求一步到位完成实体来源收口

本次 change 不接受“先部分收敛，后续再继续抽象”的实施方式。

必须一次性达到以下状态：

1. `bindingStation` 的实体解析收口完成
2. `archiveStation` 的实体解析收口完成
3. `activeStation` 只做 `bindingStation | archiveStation` 统一抽象
4. `mode === 'transit'` 不再承担实体选源职责

若 `archiveStation`、`bindingStation` 或其他来源计算内部仍残留用 `mode` 重新判断当前实体的逻辑，则视为本次变更未完成。

## 边界

### In Scope

- 梳理 `useLiveProductionStore` 中 `bindingStation` / `archiveStation` / `activeStation` / `editableStationPlan` 的职责边界
- 梳理 `useBlueprintProductionStore` 中 `activeStation` / `editableStationPlan` 的兼容边界
- 让 `activeStation` 真正收敛为 `bindingStation | archiveStation`
- 将 station plan 编辑入口从 `activeStation` 迁移到 `editableStationPlan`
- 结合 `LiveProductionWorkbenchView.vue` 与 presenter 实际消费点整理页面依赖模型
- 保证 blueprint store 与 live store 的 station 编辑主路径一致
- 更新相关 OpenSpec 文档，使后续 `/x4:apply` 可直接执行

### Out of Scope

- 新增 transit 可编辑能力
- 为未来 transit 可编辑增加预埋字段或兼容结构
- 生产流算法重写
- 页面视觉改版
- 新增测试代码与测试执行

## 验收标准（DoD）

1. 文档中明确区分“当前页面实体”和“当前可编辑 plan”
2. `activeStation` 的定义固定为 `bindingStation | archiveStation`
3. `bindingStation` 与 `archiveStation` 都明确覆盖 `station` 与 `transit` 两类来源
4. `editableStationPlan` 被定义为独立概念，并明确当前仅在 `station` 模式存在
5. 文档明确说明 `transit` 页面仍消费 `activeStation`，但不消费 station plan 编辑入口
6. 文档明确说明 `mode === 'transit'` 只保留模式/行为分流职责，不再作为实体选源主路径
7. blueprint store 与 live store 都明确区分 `activeStation` 和 `editableStationPlan`
8. `bindingStation` 与 `archiveStation` 内部都不再残留以 `mode` 作为实体选源主路径的实现方案
9. `request.md`、`spec.md`、`design.md`、`tasks.md` 四份文档之间的术语和边界保持一致

## 未决项

无
