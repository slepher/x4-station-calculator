# Build Plan Fleet Specification

## Purpose

为 build-plan 约束面板引入 Fleet goal，允许用户基于已保存的飞船蓝图配方设定持续造船目标，按船厂建造能力分组，将蓝图材料需求按有效建造时间展开为 production-rate 进入现有 preview/compute 管线。

## ADDED Requirements

### Requirement: Fleet goal 数据模型

**前提** 系统需要表达"持续造船"的规划目标
**当** 开发者定义 Fleet goal 类型
**那么** BuildGoal MUST 新增分支 `{ type: 'fleet'; buildTime: number; entries: FleetEntry[]; shipyardLCount: number; shipyardXLCount: number; wharfCount: number }`
**并且** FleetEntry MUST 包含 `shipId`、`blueprintId`、`quantity`
**并且** MUST 删除旧的 `{ type: 'fleet'; shipId: string; quantity: number }` 分支
**并且** `buildTime` 默认 MUST 为 3600，最小 MUST 为 600
**并且** `shipyardLCount` / `shipyardXLCount` / `wharfCount` 默认 MUST 为 1，最小 MUST 为 1

#### Scenario: 创建 Fleet goal

**前提** buildGoals 中无 fleet goal
**当** 用户通过搜索添加第一个蓝图配方
**那么** 系统创建 `{ type: 'fleet', buildTime: 3600, entries: [{ shipId, blueprintId, quantity: 1 }], shipyardLCount: 1, shipyardXLCount: 1, wharfCount: 1 }`

#### Scenario: 追加蓝图配方到已有 Fleet

**前提** buildGoals 中已有 fleet goal
**当** 用户添加新的蓝图配方
**那么** 系统追加新 FleetEntry 到 entries 数组
**并且** 若 blueprintId 已存在则 quantity 递增

### Requirement: Fleet goal 始终唯一

**前提** 系统实现 Fleet goal
**当** 用户添加蓝图配方
**那么** 系统 MUST 始终只维护一个 fleet goal
**并且** MUST NOT 允许存在多个 fleet goal

### Requirement: 船厂分组

**前提** Fleet goal 存在
**当** 系统渲染 Fleet 卡片或计算派生 rate
**那么** entries MUST 按 ship.class 分为三组：
- 大型船厂 (shipyard_l)：ship_l
- 超大型船厂 (shipyard_xl)：ship_xl
- 船坞 (wharf)：ship_m + ship_s
**并且** 每组标题 MUST 显示船厂类型名称
**并且** 每组标题 MUST 提供可编辑的 shipyardCount（最小 1）
**并且** 空组（无 entries）MUST 仍显示标题和 shipyardCount
**并且** 不同类型的船厂 MUST 可并行建造飞船

#### Scenario: 飞船按船厂分组

**前提** Fleet 中有 ship_l 和 ship_m 的 entries
**当** Fleet 卡片渲染
**那么** ship_l 的 entries 显示在"大型船厂"组下
**并且** ship_m 的 entries 显示在"船坞"组下

#### Scenario: 修改船厂数量

**前提** Fleet goal 存在
**当** 用户修改某组 shipyardCount
**那么** 系统更新对应字段并触发 preview 重算

### Requirement: 建造时间计算

**前提** Fleet goal 存在
**当** 系统计算建造时间
**那么** 单艘建造时间 MUST 来自 production.time（通过 resolveBlueprintMaterialCost 获取）
**并且** 每组总建造时间 MUST 为 `ceil(sum(单艘buildTime x quantity) / shipyardCount)`
**并且** 实际总花费 MUST 为 `max(所有组总建造时间)`
**并且** 有效建造时间 (effectiveBuildTime) MUST 为 `max(实际总花费, 设定buildTime)`

#### Scenario: 多船厂并行缩短建造时间

**前提** 大型船厂组有 2 个船厂，组内 entries 总建造时间为 1000s
**当** 系统计算组总建造时间
**那么** 组总建造时间 = ceil(1000 / 2) = 500s

#### Scenario: 实际花费超过设定时间

**前提** 实际总花费为 1200s，设定 buildTime 为 3600s
**当** 系统计算 effectiveBuildTime
**那么** effectiveBuildTime = max(1200, 3600) = 3600s

#### Scenario: 实际花费小于设定时间

**前提** 实际总花费为 5000s，设定 buildTime 为 3600s
**当** 系统计算 effectiveBuildTime
**那么** effectiveBuildTime = max(5000, 3600) = 5000s

### Requirement: Fleet 卡片展示

**前提** buildGoals 中存在 fleet goal
**当** 约束面板渲染 Goals 区
**那么** Fleet 卡片 MUST 始终显示在 Goals 区顶部
**并且** Fleet 标题栏 MUST 显示固定文案 "Fleet"、可编辑的 buildTime、实际总花费和 effectiveBuildTime
**并且** Fleet 标题栏 MUST NOT 是展开/收起控件

#### Scenario: Fleet 卡片标题栏

**前提** Fleet goal 存在，buildTime = 3600，actualTotalBuildTime = 1200
**当** 约束面板渲染
**那么** 标题栏显示 "Fleet"、可编辑 buildTime、实际总花费 1200s、有效建造时间 3600s

### Requirement: Blueprint 条目展示

**前提** Fleet goal 存在
**当** 约束面板渲染 Fleet 卡片
**那么** 每个 FleetEntry MUST 默认收起
**并且** 收起时 MUST 显示总建造时间
**并且** 展开时 MUST 额外显示单艘建造时间和材料明细
**并且** 材料明细 MUST 按 wareId 合并显示总量
**并且** ware 名称 MUST 使用 i18n 翻译
**并且** quantity MUST 可编辑（行内数字输入 + 步进）
**并且** 展开/收起状态 MUST 为组件内部状态，不持久化

#### Scenario: 收起条目显示总建造时间

**前提** 条目 buildTime = 182s，quantity = 5
**当** 条目处于收起状态
**那么** 显示总建造时间 910s

#### Scenario: 展开条目显示单艘时间和材料

**前提** 条目处于收起状态
**当** 用户点击条目
**那么** 条目展开显示单艘建造时间 182s 和材料明细

### Requirement: Rate 汇总区

**前提** Fleet goal 存在
**当** 约束面板渲染 Fleet 卡片
**那么** Rate 汇总区 MUST 始终可见
**并且** 品种格式 MUST 为 `wareName x totalQty`
**并且** 每种 ware 的 rate MUST 按 `Math.ceil(totalQty / effectiveBuildTime x 3600)` 计算
**并且** Rate MUST 按 ware tier 从高到低排序
**并且** Rate MUST 标记为 target-production，不可编辑不可删除
**并且** energycells rate MUST 正常显示和参与规划

#### Scenario: 多 entry 同种材料合并

**前提** Fleet 中有两条 entry，分别需要 hullparts 950 和 hullparts 4433
**当** effectiveBuildTime = 7200
**那么** hullparts 品种显示 "Hull Parts x 5383"，rate = Math.ceil(5383 / 7200 x 3600) = 2692/h

### Requirement: Fleet 派生 rate 进入 preview/compute 管线

**前提** Fleet goal 存在
**当** 系统执行 createBuildFlowPlanPreview
**那么** Fleet 派生的 rate MUST 基于 effectiveBuildTime 计算后展开为 production-rate 子目标
**并且** MUST 作为 target-production 责任进入 preview
**并且** 与用户手动添加的同 wareId production-rate MUST 各自独立
**并且** compute 求解时 MUST 按现有规则合并速率
**并且** energycells rate MUST 正常参与，现有管线的 energycells 排除逻辑自然生效

#### Scenario: Fleet rate 与用户手动 rate 共存

**前提** Fleet 派生 hullparts 2692/h，用户手动添加 hullparts 100/h
**当** preview 执行
**那么** 产生两条 target-production 责任
**并且** compute 求解时合并速率为 2792/h

### Requirement: 蓝图被删除时的降级处理

**前提** Fleet entry 引用的蓝图被删除
**当** 系统解析 Fleet goal
**那么** 该 entry MUST 显示 warning 状态
**并且** 该 entry 的材料需求和建造时间 MUST 按 0 计算
**并且** Rate 汇总区 MUST NOT 包含该 entry 的贡献
**并且** MUST NOT 自动降级到 default production cost
**并且** MUST NOT 自动移除该 entry

#### Scenario: 蓝图缺失的 entry

**前提** Fleet 中有 entry 引用已删除的蓝图
**当** 用户查看 Fleet 卡片
**那么** 该 entry 显示红色 warning 标记
**并且** 材料明细为空，建造时间为 0

### Requirement: 删除最后一个 entry 自动移除 Fleet goal

**前提** Fleet goal 中只剩一个 entry
**当** 用户删除该 entry
**那么** 系统 MUST 自动从 buildGoals 中移除 fleet goal
**并且** Fleet 卡片 MUST 消失
**并且** 派生 rate MUST 全部消失

### Requirement: Fleet 专用 store 方法

**前提** 系统实现 Fleet goal
**当** 开发者操作 Fleet goal
**那么** useBuildPlanStore MUST 提供以下方法：
- `addFleetEntry(shipId, blueprintId)` — 自动创建/追加 Fleet goal（创建时 shipyardCount 默认 1）
- `removeFleetEntry(blueprintId)` — 移除 entry，entries 为空时移除 Fleet goal
- `updateFleetBuildTime(seconds)` — 更新 buildTime，最小值 600
- `updateFleetEntryQuantity(blueprintId, qty)` — 更新 entry quantity
- `updateFleetShipyardCount(groupType, count)` — 更新船厂数量，最小值 1

**并且** 所有方法变更后 MUST 自动触发 preview 重算

### Requirement: Presenter 预解析 Fleet 视图

**前提** 系统渲染 Fleet 卡片
**当** presenter 组合 buildPlanStore 和 shipBuildStore
**那么** presenter MUST 预解析并暴露 FleetGoalView
**并且** FleetGoalView MUST 包含 groups（FleetShipyardGroup[]）、actualTotalBuildTime、effectiveBuildTime
**并且** FleetShipyardGroup MUST 包含 type、label、shipyardCount、entries、groupTotalBuildTime
**并且** FleetEntryView MUST 包含 buildTime（单艘）和 totalBuildTime
**并且** FleetMergedRate MUST 包含 totalQty
**并且** FleetGoalCard MUST 只负责渲染，不直接查询 store

### Requirement: Fleet goal 变更触发 preview 重算

**前提** 系统处于 build-flow 规划上下文
**当** 以下任一变更发生
- 添加 Fleet entry
- 删除 Fleet entry
- 修改 Fleet buildTime
- 修改 Fleet entry quantity
- 修改 Fleet shipyardCount
**那么** 系统 MUST 自动执行 preview 重算

### Requirement: 搜索框类别新增 fleet

**前提** 用户使用搜索框
**当** 搜索框类别下拉渲染
**那么** MUST 在 `product | module` 后追加 `fleet` 选项
**并且** 选择 fleet 时 MUST 渲染 FleetGoalSearchBox 替代 BuildGoalSearchBox

### Requirement: 蓝图材料解析携带建造时间

**前提** 系统解析蓝图材料
**当** resolveBlueprintMaterialCost 被调用
**那么** 返回值 MUST 包含 `{ materials: Record<string, number>; buildTime: number }`
**并且** buildTime MUST 来自 `ship.production.find(p => p.method === blueprint.materialMethod)?.time || 0`
