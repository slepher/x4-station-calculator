# Build Plan Steps Specification

## Purpose

定义 build-plan 详情弹窗中 steps mode 的完整行为规范：steps 仅作为局部懒计算视图存在，且只适用于建材方案；其步骤生成采用基于建材满足度的 greedy 增量算法，并在主循环后按剩余主模块分批补齐剩余建筑。

## ADDED Requirements

### Requirement: Steps documentation MUST be owned by build-plan-steps

**前提** 系统同时存在 `build-plan-compute` 与 `build-plan-steps` 两个 change  
**当** 开发者查阅或修改 steps 方案  
**那么** steps 的完整规则 MUST 以 `build-plan-steps` 文档为准  
**并且** `build-plan-compute` MUST NOT 继续承载 steps 的完整算法与视图方案

### Requirement: Steps MUST stay out of compute truth

**前提** 用户执行普通 compute  
**当** 系统产出 `BuildScheme`  
**那么** 系统 MUST NOT 在默认 compute 阶段生成 steps  
**并且** steps 结果 MUST NOT 成为 store 真相层默认输出

#### Scenario: compute only returns static scheme

**前提** 用户点击“计算建造方案”  
**当** compute 完成  
**那么** 每个 `BuildScheme` 只包含静态 `modules`、`totalDuration`、`totalCredits` 与 `moduleSummaries`  
**并且** 不包含已计算完成的 steps 结果

### Requirement: Steps mode MUST apply only to build-material schemes

**前提** 用户打开某个方案的详情弹窗  
**当** 系统判断该方案是否可进入 steps mode  
**那么** 只有建材产线方案 MUST 允许进入 steps mode  
**并且** 生产产线方案 MUST NOT 进入该 steps mode

#### Scenario: production scheme hides steps toggle

**前提** 当前 scheme 属于生产产线组  
**当** 用户打开详情弹窗  
**那么** 系统不显示 steps 开关  
**并且** 弹窗保持默认模块汇总模式

### Requirement: Steps mode MUST use greedy satisfaction loop

**前提** 当前 scheme 是建材方案且用户打开 steps mode  
**当** 系统生成步骤列表  
**那么** 系统 MUST 从空 built 状态开始执行 greedy 主循环  
**并且** 每轮 MUST 基于建材目标 rate 计算每种建材满足度  
**并且** MUST 选出满足度最低的建材  
**并且** MUST 为该建材新增 1 个最佳生产建筑
**并且** MUST 在新增主建筑后立刻执行一次 `autoFill`
**并且** MUST 将本轮新增主建筑与本轮新增 `autoFill` 模块一起记录为本轮 steps 增量

#### Scenario: greedy step records primary module plus autoFill diff

**前提** 当前处于 greedy 主循环  
**当** 系统记录一个 steps 项  
**那么** 该步骤的主决策语义是“为当前最低满足度建材新增 1 个主建筑”  
**并且** 步骤内容 MUST 还原该次新增触发的 `autoFill diff`  
**并且** MUST NOT 将旧静态模块拆分顺序作为主决策依据

### Requirement: Satisfaction comparison MUST be limited to build-material targets

**前提** steps mode 正在比较各建材满足度  
**当** 系统选择下一轮 bottleneck ware  
**那么** 系统 MUST 只在当前建材 scheme 的目标建材集合内比较  
**并且** MUST NOT 混入生产责任、自消费扩张或其他非建材目标

### Requirement: Old greedyFill shortcuts MUST NOT define new steps behavior

**前提** 开发者参考旧 `greedyFill` 实现  
**当** 系统定义新的 steps greedy 规则  
**那么** 系统 MUST NOT 依赖以下旧行为：
- `hullparts` 硬编码起步规则
- per-source `Math.max`
- 将 `selfDemand` 与建材目标混为同一瓶颈集合
- 忽略每轮 `autoFill` 回放

### Requirement: autoFill in steps MUST respect isolated wares

**前提** steps mode 正在执行 greedy 主循环或 tail-fill 补齐  
**当** 系统为当前主模块增量运行 `autoFill`  
**那么** `autoFill` MUST 与正式求解使用同一 isolated ware 约束  
**并且** MUST NOT 为被 isolated 的 ware 自动展开补链

### Requirement: Steps MUST tail-fill remaining primary modules in ordered batches

**前提** greedy 主循环已经达到建材目标满足状态  
**当** 系统检查最终 `BuildScheme.modules` 与 greedy 已建模块差异  
**那么** 系统 MUST 先按剩余主模块种类逐类补齐  
**并且** 每补一类主模块时 MUST 再执行一次 `autoFill diff`  
**并且** 这些步骤 MUST 与 greedy 步骤在语义上区分

#### Scenario: remaining primary module batches append after satisfaction convergence

**前提** greedy 主循环已结束  
**并且** 最终 scheme 中仍存在未被 greedy 显式补入的模块  
**当** 系统完成 steps 生成  
**那么** 系统 MUST 先按主模块种类依次追加尾部步骤  
**并且** 每个尾部步骤都包含该次主模块补入触发的 `autoFill diff`  
**并且** 用户可区分它们属于“最终方案补齐”而非“最低满足度驱动”


### Requirement: Vue MUST use a dedicated BuildStepsScheme view model

**前提** 详情弹窗需要展示 steps mode  
**当** Vue / presenter 组装当前 scheme 的 steps 结果  
**那么** 系统 MUST 使用独立的 `BuildStepsScheme` 视图模型  
**并且** 该类型 MUST NOT 进入 store 真相层类型定义

#### Scenario: BuildStepsScheme carries steps-only fields

**前提** 当前 scheme 已算出 steps  
**当** 弹窗切换到 steps mode  
**那么** `BuildStepsScheme` 至少提供：
- `baseScheme`
- `steps`
- `stepsCount`
- `stepsTotalCredits`

### Requirement: Steps MUST be computed lazily inside the modal

**前提** 用户打开 build-plan 详情弹窗  
**当** 用户尚未打开 steps 开关  
**那么** 系统 MUST NOT 预先计算 steps  
**并且** MUST 在用户切换到 steps mode 时才进行局部计算

#### Scenario: modal shows local loading for steps

**前提** 当前建材 scheme 首次进入 steps mode  
**当** 系统尚未完成 steps 计算  
**那么** 弹窗显示局部 loading  
**并且** MUST NOT 触发全局 build-plan loading

### Requirement: Steps result MUST stay out of store truth

**前提** 当前弹窗已算出 steps  
**当** 其他页面或 store 读取 build-plan 真相层  
**那么** 它们仍只读取默认静态 `BuildScheme`  
**并且** MUST NOT 读取本次弹窗局部 steps 结果

### Requirement: Steps mode MUST display its own credits while keeping duration aligned

**前提** 弹窗处于 steps mode  
**当** 系统渲染状态栏  
**那么** `总耗时` MUST 与默认模式保持一致  
**并且** `总花费` MUST 使用 steps 累计口径  
**并且** `步骤数` MUST 显示 steps 总数

### Requirement: Energy Cells MUST be included in steps material display and cost accounting

**前提** 系统生成某个 step 的材料明细  
**当** 该 step 的建造材料包含 `energycells`  
**那么** 系统 MUST 将 `energycells` 纳入材料展示  
**并且** MUST 将其纳入成本统计  
**并且** MUST NOT 从 stepsTotalCredits 中排除

### Requirement: Modal MUST handle unsupported steps cases safely

**前提** 当前 scheme 不满足进入 steps mode 的前提  
**当** 用户打开详情弹窗  
**那么** 系统 MUST 安全停留在默认模式  
**并且** MUST NOT 呈现错误的 steps 交互入口

#### Scenario: empty-module scheme hides steps toggle

**前提** 当前 scheme.modules 为空  
**当** 用户打开详情弹窗  
**那么** 系统显示空模板  
**并且** 不显示 steps 开关
