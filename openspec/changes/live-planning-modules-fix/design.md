# Live Planning Modules Fix - Design

## 目标

本次设计的重点不是继续给 `live-planning-modules` 旧方案打补丁，而是把两类被混在一起的语义拆开：

- 产品语义：`recommendedModules` 到底是不是已经生效的 planned 模块
- 计算语义：industrial autoFill 的通用旧逻辑，与 live planning 专用 floor 逻辑如何隔离

## 分层策略

继续遵循仓库约束的 `store -> presenter -> vue` 三层结构。

- `store / logic`
  - 输出显式 `plannedModules` 与生效态 `effectivePlannedModules`
  - 计算 orphan-based recommended subset
  - 执行 live planning 专用 floor 逻辑，floor 模块经 `autoIndustryModules` 暴露
- `presenter`
  - 在 planned 列表中为 recommended subset 组装来源标记
  - 直接消费 `autoIndustryModules` / `autoHabitationModules` / `autoInfrastructureModules` 展示（不再从 `effectiveTargetModules` 中 filter delta）
  - 无 `archiveStation` 时不显示 diff 标注
- `vue`
  - 渲染单一 planning 列表
  - 对 recommended 项显示虚线前置等弱视觉标记

## 核心语义收口

### 1. recommended subset 不是候选池

旧文档的根本问题是同时出现了两种互相冲突的说法：

- recommended 是 UI 提示
- recommended 会直接参与 autoFill / flow / warePriority

本次 fix 明确统一为后一种：

- recommended subset 已纳入 planning 基线
- UI 上仍让用户看清“哪些 planned 模块来自 archive/reference 对齐规则”，但不再拆成独立区块

因此，后续文档与实现应避免再使用：

- “建议纳入规划”
- “点击后加入 planned”

而应使用：

- “planned 中的 reference-aligned 子集”
- “规划区中的推荐来源模块”

### 2. orphan 判定下沉到 store

一旦 recommended subset 已经是计算基线的一部分，orphan 就不再只是 UI 分类。

正确落点应为：

- store / planning 计算路径中先基于 `referenceModules` 判定 orphan subset
- 由这部分 subset 参与 effective planned baseline 的构造
- presenter 只消费结果，并在 planning 区中标记来源，不重新定义 orphan 真相

这可以避免：

- presenter 和 store 各自维护一套 orphan 规则
- UI 文案说“已纳入”，而 store 计算仍把它当成“未纳入”

### 3. effectivePlannedModules 成为正式边界

后续实现不再在各处临时做：

- `plannedModules + recommendedModules`
- `plannedModules + reference floor`
- `plannedModules + recommended + floor`

而是统一由 store 输出一份正式字段：

- `plannedModules`
  - 仅表示用户显式规划
  - 用于编辑、持久化、增删改交互
- `effectivePlannedModules`
  - 表示所有“应按 planned 语义处理”的模块集合
  - 顺序语义为：显式 planned -> recommended subset
  - 用于 flow 排序、ware priority、planned ware 判定、support module 推导
- `reference production floor`
  - 只进入 live planning 的 canonical / autoFill 基线
  - 不自动进入 `effectivePlannedModules`

这样可以避免在不同调用链上重复拼接并产生顺序偏差。

## autoFill 设计

### 1. 通用 industrial autoFill 回归 develop

通用 industrial autoFill 的职责应保持最小：

- 输入 `plannedModules`
- 识别 ware deficit
- 选择 producer
- 补齐上游生产模块

它不应额外承担：

- `referenceModules` 理解
- live archive floor
- producer 级参考配额分摊

因此：

- `calculateAutoIndustryModules` 恢复为 `develop` 语义
- `calculateAutoFillModules` 恢复为通用旧入口

### 2. floor 通过新函数单独处理

live planning 需要的 floor 行为应由新函数承担，例如：

```ts
calculateAutoIndustryModulesWithFloor(...)
```

该函数只服务于 live planning / reference-aware planning 路径。

建议流程：

1. 基于 `archive_total` 计算 reference production floor
2. 以 `effectivePlanned = max(plannedModules, floor)` 作为 autoFill 的产能基线（floor 模块的产能被计入以减少 deficit，但 floor 不在 plannedModules 条目内）
3. 以 `effectivePlanned` 为 planned 语义入口调用旧 `calculateAutoIndustryModules`，得到仅超出 baseline 的增量补完
4. 将 floor 中超出显式 planned 的部分合并回 `autoIndustryModules`
5. 产出：
   - `autoIndustryModules`（含 floor production 模块 + autoFill 补完的额外模块）
   - 可供后续 flow / habitation / infrastructure 使用的 planning 基准

注意：floor 模块**不进入** `effectivePlannedModules`，而是通过 `autoIndustryModules` 暴露。`effectivePlannedModules` 仅包含显式 planned + recommended subset。

### 3. 不保留工业 producer quota 状态机

由于本次 floor 语义已经由 `archive_total` 基线直接表达，工业模块不再需要一套“按 producer 配额消耗 reference quota”的复杂选择器。

因此设计上应删除或停止依赖以下工业语义：

- `remainingQuota`
- `exhaustedQuota`
- P1-P8 industrial producer reference 状态机

工业选择器只保留 develop 的普通 producer 选择语义即可。

如果后续仍需保留 reference-aware producer helper，也应收缩成“简单参考优先选型”，而不是缺口分摊状态机。

## warePriority 与 flow 排序

### 1. priority 语义

对于 recommended subset 产出的 ware：

- 在 priority 语义上，它们等同于 planned ware
- `resolved level = 2`

这意味着它们参与：

- planned 级可见性
- planned 级 buffer / filtering 语义

### 2. flow 列表顺序语义

当前讨论中“排序仅在 plannedModules 之后”描述混淆了两个概念：

- priority level
- flow list order

后续文档与实现应显式拆分：

- `warePriority` 只负责等级语义
- flow / presenter 层若要控制列表顺序，单独定义排序字段或分组顺序

建议的展示顺序：

1. 用户显式 plannedModules 产出
2. recommended subset 产出
3. 普通 auto 产出

## planning 区中的 recommended 项设计

由于 recommended subset 已属于 planned：

- 默认计算语义上它已经生效
- UI 上仍允许用户点击，将该项“转正”为显式 planned

本次固定采用：

- recommended 项与普通 planned 项共享同一列表
- UI 上只通过虚线前置等弱视觉样式区分来源
- 点击 recommended 项时，不做简单累加，而是把显式 planned 数量提升到该项当前目标总量

这样既保留“已生效”的计算真相，也保留用户把推荐项转成显式规划的可控交互。

## planned 区 count 交互规则

### 推荐模块输入限制

对于已存在于 `recommendedModules` 的 planned 模块：

- X4NumberInput `min = archiveTotal`，无法手动输入低于 archive 的值
- `handleUpdateModuleCount` 也会 clamp 到 `>= archive`
- `isBelowThreshold`（红色）仅在 `isRecommended` 为真且 `count < archive` 时生效
- × 按钮正常删除

### 非推荐模块

对于不存在于 `recommendedModules` 的 planned 模块：

- X4NumberInput `min = 1`
- 允许输入 `< archive`，auto region 会通过 floor 机制补全缺口
- 输入数量不标红（`isBelowThreshold` 不生效）

### recommended display 过滤规则

`computeRecommendedPlanningSubset` 中，只有 `plannedCount === 0` 的 orphan 模块才被加入 `recommendedDisplayModules`。用户已显式规划的模块（`plannedCount > 0`）不会进入推荐显示集，从而不被 `plannedDisplayModules` 的 `recommendedIds` 过滤掉，保持其在 planned 区的可见性。

## planned diff 显示规则

planned 区域的 diff 标注（`+N`/`-N`）按以下条件显示：

| 条件 | diff 显示 | 含义 |
|------|----------|------|
| `planned > archive` | `+ (planned - archive)` | 用户显式超出 archive（主动扩张） |
| `total < archive` | `- (planned - archive)`¹ | 总体仍低于 archive（建议值不足） |
| 其他（`total ≥ archive 且 planned ≤ archive`） | 不显示 | 已达标或超标，无需提示 |

¹ `total = planned + auto`，`archive` 为 archive 中该模块总数。

## auto diff 公式

`auto - max(0, archive - planned)`，始终显示（diff ≠ 0 时）。

## X4NumberInput 交互

通用数字输入组件 `X4NumberInput` 使用以下确认策略：

- `handleInput`：仅更新本地 `rawValue`，不 `emit`
- `handleBlur`：解析 `rawValue`，clamp 到 `[min, max]` 后 `emit('update:modelValue')`
- `updateValue`（箭头按钮）：即时 `emit`

这样避免用户在输入中间值时触发不必要的计算。

## 文档同步要求

本次 fix 是一个新的 planning change，而不是旧 change 的零散补充。

因此必须同步更新：

- `request.md`
- `design.md`
- `tasks.md`
- `specs/live-planning-modules-fix/spec.md`

并且不得继续沿用旧 change 中这些已失效表述：

- recommended = suggestion only
- 点击 recommended 添加到 planned
- autoFill 通用入口理解 reference floor
- “排序”指代 `warePriority`
- recommended 需要独立折叠区块
