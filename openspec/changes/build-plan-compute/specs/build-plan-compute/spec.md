# Build Plan Compute Specification

## Purpose

定义 build-plan compute 阶段的完整行为规范：compute 只读取 preview 结果并求解主要模块/辅助模块；默认输出静态 BuildScheme；目标速率按责任类型区分公式；SCC 收敛只看主要模块。

## ADDED Requirements

### Requirement: 当前代码实现不构成需求依据

**前提** 当前仓库中已存在 build-plan compute 相关实现
**当** 开发者审查、修改或扩展该功能
**那么** 系统需求 MUST 以本文档为准
**并且** MUST NOT 以当前代码行为反推需求正确性
**并且** 若代码与文档冲突，默认按文档修正代码

### Requirement: Compute 阶段只读取 preview 结果

**前提** 用户点击“计算建造方案”
**当** 系统执行 compute
**那么** 系统 MUST 只读取 preview 已分配结果
**并且** MUST NOT 重新决定责任归属
**并且** MUST NOT 再次调用按 goals 重新分配产线的逻辑
**并且** MUST NOT 在 Vue 层临时追加责任

#### Scenario: logic-flow 为空 preview 也能继续 compute

**前提** previewResult 已存在，且其来源为 `logicFlowPlanId = null`
**并且** `previewResult.graph = null`
**当** 用户点击“计算建造方案”
**那么** compute MUST 继续读取该 previewResult
**并且** MUST 对 unmatched preview lines 求解方案
**并且** MUST NOT 因 graph 为 `null` 而中断

### Requirement: 单条产线可同时承担三类责任且必须合并满足

**前提** 某条产线同时承接多种 preview 责任
**当** 系统对该产线执行 compute
**那么** 系统 MUST 在一次求解中合并满足全部责任
**并且** MUST NOT 先按责任类型拆成多次计算再拼接结果

### Requirement: 相关产线集合来自 preview 显式挂接结果

**前提** compute 需要知道某项责任涉及哪些产线
**当** 系统读取相关产线集合
**那么** 该集合 MUST 来自 preview 显式记录的挂接结果
**并且** MUST NOT 在 compute 阶段重新推导整图可达集合替代该结果

### Requirement: derived-build-material 目标速率按 buildCost 需求除以建造时间计算

**前提** 某条 derived 责任的标签包含 `build-material`
**当** 系统计算该 ware 的目标速率
**那么** 目标速率 MUST 等于所有相关产线建筑 `buildCost` 中该材料总需求除以所有相关产线建筑总建造时间

### Requirement: derived-production 目标速率按运营消耗加用户目标计算

**前提** 某条 derived 责任的标签包含 `production`
**当** 系统计算该 ware 的目标速率
**那么** 目标速率 MUST 等于相关产线运营消耗与同 ware 用户目标速率的合并结果
**并且** MUST NOT 使用 per-source `Math.max` 作为最终目标速率规则

### Requirement: Compute 阶段先求主要模块，再派生辅助模块

**前提** 系统已得到某条产线的目标速率
**当** 系统执行 compute
**那么** 系统 MUST 先求主要模块数量
**并且** MUST 再基于主要模块派生辅助模块数量
**并且** 辅助模块 MUST NOT 成为独立收敛变量

### Requirement: SCC 迭代只以主要模块数量稳定为收敛判据

**前提** 依赖图中存在 SCC
**当** 系统执行循环求解
**那么** 系统 MUST 迭代重算主要模块数量
**并且** 当相关产线的主要模块数量不再变化时 MUST 视为收敛
**并且** MUST NOT 以辅助模块数量作为单独收敛判据

### Requirement: 最终分组中重叠产线必须归入建材组且责任合并

**前提** 某条产线同时出现在建材依赖图和生产责任结果中
**当** 系统生成最终 scheme groups
**那么** 该产线 MUST 只出现一次
**并且** MUST 归入建材产线组
**并且** 建材责任与生产责任 MUST 在该组内合并求解

### Requirement: Vue 与 analysis script 必须共用同一计算入口

**前提** Vue 页面与 analysis script 都需要执行 build-plan 计算
**当** 两端调用 preview / compute 核心逻辑
**那么** 二者 MUST 复用同一套核心入口
**并且** MUST NOT 分别复制一套等价的 preview / compute 推导逻辑

### Requirement: Build-plan 真相层必须使用独立 store

**前提** 系统需要持有 build-plan 的持久化状态与计算状态
**当** 开发者组织真相层状态
**那么** build-plan 真相层 MUST 由独立 store 承载
**并且** MUST NOT 继续依附在 blueprint production 的旧职责容器中

### Requirement: Compute MUST output static BuildScheme only

**前提** 用户执行普通 compute
**当** 系统产出 BuildScheme
**那么** 系统 MUST 输出静态 `modules`、静态 `totalDuration`、静态 `totalCredits` 与 `moduleSummaries`
**并且** MUST NOT 在 compute 文档中继续定义 steps 详细方案

### Requirement: BuildScheme MUST provide pre-sorted module summaries

**前提** compute 产出 `BuildScheme`
**当** Vue 读取 `moduleSummaries`
**那么** 模块项 MUST 已排序
**并且** 材料项 MUST 已排序
**并且** Vue MUST NOT 再承担该排序责任

### Requirement: Energy Cells MUST be included in static material display and cost accounting

**前提** 系统生成 `BuildScheme` 的静态材料明细或静态成本统计
**当** 某模块建造成本包含 `energycells`
**那么** 系统 MUST 将 `energycells` 纳入材料展示
**并且** MUST 将其纳入静态成本统计

### Requirement: Steps detailed behavior MUST be defined by build-plan-steps

**前提** 系统存在 steps mode
**当** 开发者需要查阅或修改 steps 适用范围、算法、视图或懒计算逻辑
**那么** 系统 MUST 以 `build-plan-steps` 文档为准
**并且** `build-plan-compute` MUST 只保留 compute 与 steps 的边界说明
