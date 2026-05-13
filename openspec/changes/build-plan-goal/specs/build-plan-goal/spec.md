# Build Plan Goal Specification

## Purpose

定义 build-plan 目标体系的完整行为规范：BuildGoal 类型、方案持久化与 CRUD、Fleet goal、logic-flow 绑定与 active 隔离、产线自动分配。

## ADDED Requirements

### Requirement: BuildGoal 类型体系

**前提** 系统需要表达用户的建造规划目标
**当** 开发者定义 BuildGoal 类型
**那么** BuildGoal MUST 支持三种类型：
- `production-rate`: `{ wareId; ratePerHour }`
- `build-module`: `{ moduleId; count }`
- `fleet`: `{ buildTime; entries: FleetEntry[]; shipyardLCount; shipyardXLCount; wharfCount }`

**并且** 旧的 `{ type: 'fleet'; shipId: string; quantity: number }` MUST 已被替换

### Requirement: Fleet goal 始终唯一

**前提** 系统实现 Fleet goal
**当** 用户添加蓝图配方
**那么** 系统 MUST 始终只维护一个 fleet goal
**并且** MUST NOT 允许存在多个 fleet goal

### Requirement: Fleet 船厂分组

**前提** Fleet goal 存在
**当** 系统渲染 Fleet 卡片或计算派生 rate
**那么** entries MUST 按 ship.class 分为三组：大型船厂(ship_l)、超大型船厂(ship_xl)、船坞(ship_m+ship_s)
**并且** 每组标题 MUST 提供可编辑的 shipyardCount（最小 1）
**并且** 空组 MUST NOT 显示

### Requirement: Fleet 建造时间计算

**前提** Fleet goal 存在
**当** 系统计算建造时间
**那么** effectiveBuildTime MUST 由 buildTimeMode 决定：
- `actual` 模式：effectiveBuildTime = actualTotalBuildTime
- `planned` 模式：effectiveBuildTime = buildTime
**并且** buildTimeMode 默认 MUST 为 `'actual'`
**并且** buildTimeMode MUST 持久化到方案
**并且** 每组总建造时间 MUST 为 `ceil(sum(单艘buildTime × quantity) / shipyardCount)`
**并且** 派生 rate MUST 按 `Math.ceil(totalQty / effectiveBuildTime × 3600)` 计算

### Requirement: Fleet 建造时间模式 UI

**前提** Fleet goal 存在
**当** 系统渲染 FleetGoalCard 标题栏
**那么** MUST 使用原生 `<select>` 下拉菜单显示两个选项
**并且** 选项一 MUST 显示 `实际 (格式化时间)` 文本，value 为 `'actual'`
**并且** 选项二 MUST 显示 `规划 (格式化时间)` 文本，value 为 `'planned'`
**并且** 选中 `actual` 时 MUST 隐藏 buildTime 输入框
**并且** 选中 `planned` 时 MUST 显示 buildTime 输入框

### Requirement: Fleet 派生 rate 进入 preview/compute 管线

**前提** Fleet goal 存在
**当** 系统执行 preview
**那么** Fleet 派生的 rate MUST 基于 effectiveBuildTime 计算后展开为 production-rate 子目标
**并且** MUST 作为 target-production 责任进入 preview

### Requirement: 蓝图被删除时的降级

**前提** Fleet entry 引用的蓝图被删除
**当** 系统解析 Fleet goal
**那么** 该 entry MUST 显示 warning 状态
**并且** MUST 继续保留在对应 ship.class 分组中
**并且** MUST 显示舰船名称，而不是回退为 blueprint 标识
**并且** 材料需求和建造时间 MUST 按 0 计算
**并且** 列表行 MUST NOT 显示建造时间
**并且** 该 entry MUST NOT 支持展开
**并且** 数量 MUST 显示为固定值且 MUST NOT 允许修改
**并且** MUST NOT 自动移除该 entry

### Requirement: 删除最后一个 entry 自动移除 Fleet goal

**前提** Fleet goal 中只剩一个 entry
**当** 用户删除该 entry
**那么** 系统 MUST 自动从 buildGoals 中移除 fleet goal
**并且** Fleet 卡片 MUST 消失

### Requirement: 方案持久化

**前提** 用户添加了建造目标或编辑了方案属性
**当** 触发自动保存时机（buildGoals 变更、方案名编辑确认、切换逻辑产线方案）
**那么** 系统 MUST 将当前方案的 buildGoals、name、logicFlowPlanId、lastUpdated 写入 SavedBuildPlanGoalsState
**并且** localStorage key MUST 通过 `gameData.getStorageKey('build_plan_goals')` 获取

#### Scenario: 首次添加目标自动创建方案

**前提** `savedPlans.activeId` 为 `null`
**当** 用户添加第一个建造目标
**那么** 系统自动创建新 BuildPlanGoalSnapshot 并激活
**并且** 持久化到 localStorage

#### Scenario: 页面刷新后恢复方案

**前提** localStorage 中存在 SavedBuildPlanGoalsState 且 activeId 不为 null
**当** 页面加载时
**那么** 系统从 localStorage 读取并恢复 savedPlans 状态
**并且** 加载 activeId 对应方案的 buildGoals

### Requirement: 方案 CRUD

**前提** 系统提供方案管理功能
**当** 用户操作方案菜单
**那么** 新建 MUST 创建空方案并切换
**并且** 切换 MUST 加载目标方案的 buildGoals + 尝试还原 logicFlowPlanId
**并且** 删除当前激活方案 MUST 切换到下一个方案
**并且** buildMaterialPlanningEnabled MUST 在切换方案时保持不变

### Requirement: Build-plan 通过 snapshot 解析层读取 logic-flow

**前提** build-plan 需要执行 preview 或 compute
**当** 系统准备读取 logic-flow 数据
**那么** 系统 MUST 先通过独立 logic 模块解析本次使用的 logic-flow snapshot
**并且** useBuildPlanStore MUST NOT 直接把 useLogicFlowStore 的实时字段作为 build-plan 的业务输入源

#### Scenario: logic-flow 允许为空规划

**前提** 用户在 logic-flow 选择菜单中选择"无规划"
**当** 系统保存当前 build-plan 方案
**那么** `logicFlowPlanId` MUST 为 `null`
**并且** 该状态 MUST 被视为合法选择，而不是缺失值或错误状态
**并且** 后续 preview / compute MUST 继续运行

### Requirement: 同 active 复用

**前提** buildPlan.logicFlowPlanId === logicFlowStore.savedPlans.activeId
**当** build-plan 解析 logic-flow 输入
**那么** 系统 MUST 直接复用 active logic-flow 中已重建好的数据
**并且** MUST NOT 为同一 plan 再额外重建一份 snapshot

### Requirement: 非 active 重建

**前提** buildPlan.logicFlowPlanId !== logicFlowStore.savedPlans.activeId
**当** build-plan 解析 logic-flow 输入
**那么** 系统 MUST 按绑定 plan 重建一份 logic-flow snapshot
**并且** MUST 将结果保存到 useBuildPlanStore 自身状态
**并且** 后续 preview / compute MUST 只读取该副本

### Requirement: Active 隔离

**前提** build-plan 切换方案或刷新其读取源
**当** 读取的 plan 不是 active plan
**那么** 系统 MUST NOT 改变 logicFlowStore.savedPlans.activeId
**并且** MUST NOT 调用 logicFlowStore.loadPlan(...)
**并且** logic-flow UI 当前编辑上下文 MUST 保持不变

### Requirement: Active logic-flow 实时更新仅在同 active 时影响 build-plan

**前提** build-plan 已解析出 resolved logic-flow source
**当** active logic-flow 发生实时编辑变化
**那么** 只有在绑定 plan 与 active plan 相同时，该变化才会触发 preview 刷新
**并且** 绑定非 active plan 时，active logic-flow 的实时编辑 MUST NOT 干扰当前 build-plan

### Requirement: 产线自动分配三级匹配

**前提** 系统将 goal 分配到产线
**当** 执行分配算法
**那么** Layer 1 MUST 优先匹配 build-flow outputMaterialTag 连线
**并且** Layer 2 MUST 按 manual > auto 优先级匹配 logic-flow 节点（排除 isolated）
**并且** Layer 3 MUST 将未命中 goal 归入"待规划产线"

### Requirement: 派生 goal 生成

**前提** 用户添加 goal
**当** logic-flow 中存在 isolated 节点为其上游产品
**那么** 系统 MUST 自动生成 derived-production 类型目标
**并且** derived-production MUST 不持久化
**并且** goals 或 logic-flow 变化时 MUST 全量重算
