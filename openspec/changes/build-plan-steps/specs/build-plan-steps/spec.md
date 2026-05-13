# Build Plan Steps Specification

## Purpose

定义 build-plan 详情弹窗中 steps 的新职责边界：默认 compute 不再生成 steps，默认详情视图展示静态模块汇总，steps 仅在弹窗中按需生成并显示。

## ADDED Requirements

### Requirement: 默认 compute 阶段不得生成 steps

**前提** 用户执行 build-plan compute  
**当** 系统完成 scheme 求解  
**那么** 系统 MUST 产出静态 `BuildScheme` 结果  
**并且** MUST NOT 在默认 compute 阶段生成 steps  
**并且** MUST NOT 让 steps 成为 store 真相层的默认输出

#### Scenario: compute 仅输出静态 scheme

**前提** 用户点击“计算建造方案”  
**当** compute 完成  
**那么** 每个 `BuildScheme` 包含静态 `modules`、`totalDuration`、`totalCredits` 与 `moduleSummaries`  
**并且** 不包含已计算完成的 steps 结果

### Requirement: BuildScheme MUST 提供默认详情视图所需的 module summaries

**前提** 系统已完成默认 compute  
**当** 详情弹窗在非 steps 模式下展示 scheme  
**那么** 系统 MUST 从 `BuildScheme.moduleSummaries` 提供模块汇总数据  
**并且** Vue MUST NOT 自行从 `scheme.modules` 临时重建该视图真相

#### Scenario: 默认详情模式消费静态汇总

**前提** 用户打开 scheme 详情弹窗且未开启 steps  
**当** 弹窗渲染主体内容  
**那么** 主体使用 `moduleSummaries` 渲染模块手风琴  
**并且** 不依赖 step 列表

### Requirement: 默认详情模式 MUST 显示模块汇总手风琴

**前提** 用户打开 scheme 详情弹窗  
**当** steps 开关处于关闭状态  
**那么** 系统 MUST 保持手风琴交互风格  
**并且** 每个手风琴项 MUST 代表同种模块汇总  
**并且** 头部 MUST 显示：
- 模块名称
- 数量
- 总耗时
- 总花费

#### Scenario: 默认模式展开模块材料明细

**前提** steps 开关关闭  
**当** 用户展开某个模块汇总项  
**那么** 系统显示：
- 材料名称
- 总数量
- 总花费
- 单价

### Requirement: 默认详情模式状态栏 MUST 不显示 steps count

**前提** 用户正在查看 scheme 详情弹窗  
**当** steps 开关关闭  
**那么** 状态栏 MUST 只显示 `总耗时` 与 `总花费`  
**并且** MUST NOT 显示 `步骤数`

#### Scenario: 非 steps 模式隐藏步骤数

**前提** 弹窗已打开  
**当** steps 未开启  
**那么** 用户看不到任何 `步骤数` 字段  
**并且** 系统不得以 `0` 或 `-` 代替显示

### Requirement: 默认详情模式的时长和花费 MUST 使用静态汇总口径

**前提** 系统正在生成 `BuildScheme` 的默认详情数据  
**当** 计算 scheme 总耗时、模块耗时、scheme 总花费、模块花费与材料花费  
**那么** 系统 MUST 使用静态汇总公式  
**并且** MUST NOT 依赖 steps 顺序、库存抵扣或建造期间自产

#### Scenario: 静态时长与静态花费计算

**前提** 某 scheme 已有已求解模块数量  
**当** 系统生成默认详情汇总  
**那么** `totalDuration` 使用 `sum(module.buildTime × count)`  
**并且** `totalCredits` 使用 `sum(buildCost[ware] × count × ware.price)`

### Requirement: Module summaries MUST be pre-sorted by compute

**前提** 系统完成默认 compute  
**当** 系统输出 `moduleSummaries`  
**那么** 模块汇总 MUST 按以下顺序排序：
- `tier` 升序
- 同 tier 按 `module.name` 升序

**并且** 模块材料明细 MUST 按材料总花费降序排序

#### Scenario: Vue 直接消费已排序的汇总

**前提** `moduleSummaries` 已输出  
**当** Vue 渲染默认详情视图  
**那么** Vue 直接使用现有顺序  
**并且** 不再二次做业务排序

### Requirement: Steps MUST be computed lazily inside the modal

**前提** 用户打开 scheme 详情弹窗  
**当** 用户打开 steps 开关  
**那么** 系统 MUST 仅针对当前 scheme 懒计算 steps  
**并且** MUST 在弹窗内显示局部 loading  
**并且** MUST NOT 触发全局 build-plan loading

#### Scenario: 打开开关后切换为纯 steps 视图

**前提** 弹窗当前处于默认详情模式  
**当** 用户打开 steps 开关  
**那么** 主体切换为纯 step 列表  
**并且** 默认模式下的模块汇总主体不再显示

### Requirement: Steps result MUST stay out of store truth

**前提** 系统已为当前弹窗中的 scheme 计算出 steps  
**当** Vue 使用该结果显示 steps 模式  
**那么** steps 结果 MUST 仅存在于 Vue / presenter 范围  
**并且** MUST NOT 回写 `useBuildPlanStore`  
**并且** MUST NOT 覆盖 store 中 `BuildScheme.totalCredits`

#### Scenario: steps 结果只存在于局部 BuildStepsScheme

**前提** 当前弹窗已经完成 steps 计算  
**当** 其他页面或 store 读取 schemeGroups  
**那么** 它们仍读取默认静态 `BuildScheme`  
**并且** 不包含本次弹窗局部的 steps 结果

### Requirement: Vue MUST use a dedicated BuildStepsScheme view model

**前提** 详情弹窗需要显示 steps 模式  
**当** Vue / presenter 组装当前 scheme 的 steps 结果  
**那么** 系统 MUST 使用独立的 `BuildStepsScheme` 视图模型  
**并且** `BuildStepsScheme` MUST 以 `BuildScheme` 为基础引用或组合  
**并且** 该类型 MUST NOT 进入 store 真相层类型定义

#### Scenario: BuildStepsScheme 承载 steps-only 字段

**前提** 当前 scheme 已完成 steps 计算  
**当** Vue 切换为 steps 模式  
**那么** `BuildStepsScheme` 提供：
- `baseScheme`
- `steps`
- `stepsCount`
- `stepsTotalCredits`

### Requirement: Steps mode MUST display its own credits while keeping duration aligned

**前提** 用户已打开 steps 开关  
**当** 弹窗显示状态栏  
**那么** `总耗时` MUST 与默认模式保持一致  
**并且** `总花费` MUST 显示 steps 累计口径  
**并且** `步骤数` MUST 显示 steps 总数

#### Scenario: 打开 steps 后状态栏追加步骤数

**前提** 当前 scheme 已算出 steps  
**当** 弹窗渲染状态栏  
**那么** 用户看到 `总耗时`、`总花费`、`步骤数`  
**并且** `总花费` 来自 `BuildStepsScheme.stepsTotalCredits`

### Requirement: Steps generation MUST reuse the existing makeSchemeSteps algorithm

**前提** 系统为当前 scheme 按需生成 steps  
**当** 实现该生成逻辑  
**那么** 系统 MUST 复用 `makeSchemeSteps()` 核心算法  
**并且** MUST NOT 新增第二套 steps 生成算法  
**并且** MUST 将该函数迁出默认 compute 核心模块

#### Scenario: makeSchemeSteps 不再属于默认 compute

**前提** 默认 compute 已按新边界实现  
**当** 用户未打开 steps 开关  
**那么** 默认 compute 不依赖 `makeSchemeSteps()`  
**并且** 只有弹窗 steps 计算链路使用该函数

### Requirement: Energy Cells MUST be included in material display and cost accounting

**前提** 系统生成默认详情模式材料明细或 steps 模式材料明细  
**当** 某模块或某 step 的建造材料包含 `energycells`  
**那么** 系统 MUST 将 `energycells` 纳入材料展示  
**并且** MUST 将其纳入成本统计  
**并且** MUST NOT 再将其作为材料统计排除项

#### Scenario: Energy Cells 出现在默认模式材料明细中

**前提** 某模块建造成本包含 `energycells`  
**当** 用户展开默认模式的材料明细  
**那么** 用户能看到 `energycells` 的数量、单价与总花费

#### Scenario: Energy Cells 出现在 steps 模式明细中

**前提** 某 step 的建造材料包含 `energycells`  
**当** 用户查看 steps 明细  
**那么** `energycells` 参与该 step 的材料展示与总成本计算

### Requirement: Modal MUST handle empty-module fallback safely

**前提** 出现异常情况导致当前 scheme 模块为空  
**当** 用户打开详情弹窗  
**那么** 系统 MUST 直接显示空模板  
**并且** MUST NOT 显示 steps 开关

#### Scenario: 空模块 scheme 的兜底展示

**前提** 当前 scheme.modules 为空  
**当** 弹窗打开  
**那么** 主体进入空模板展示  
**并且** 用户不会进入默认模式或 steps 模式的正常交互流
