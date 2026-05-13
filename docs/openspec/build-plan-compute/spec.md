# Build Plan Compute Specification

## Purpose

定义 build-plan compute 阶段的完整行为规范：compute 只读取 preview 结果并求解主要模块/辅助模块；默认 compute 不生成 steps；目标速率按责任类型区分公式；SCC 收敛只看主要模块。

## ADDED Requirements

### Requirement: 当前代码实现不构成需求依据

**前提** 当前仓库中已存在 build-plan compute 相关实现
**当** 开发者审查、修改或扩展该功能
**那么** 系统需求 MUST 以本文档为准
**并且** MUST NOT 以当前代码行为反推需求正确性
**并且** 若代码与文档冲突，默认按文档修正代码

### Requirement: Compute 阶段只读取 preview 结果

**前提** 用户点击"计算建造方案"
**当** 系统执行 compute
**那么** 系统 MUST 只读取 preview 已分配结果
**并且** MUST NOT 重新决定责任归属
**并且** MUST NOT 再次调用"按 goals 重新分配产线"的逻辑
**并且** MUST NOT 在 Vue 层临时追加责任

#### Scenario: logic-flow 为空 preview 也能继续 compute

**前提** previewResult 已存在，且其来源为 `logicFlowPlanId = null`
**并且** `previewResult.graph = null`
**当** 用户点击"计算建造方案"
**那么** compute MUST 继续读取该 previewResult
**并且** MUST 对 unmatched preview lines 求解方案
**并且** MUST NOT 因 graph 为 null 而中断

### Requirement: 单条产线可同时承担三类责任且必须合并满足

**前提** 一条产线在 preview 中被分配责任
**当** 该线进入 compute 求解
**那么** 系统 MUST 将该线全部责任合并后统一求解
**并且** 责任类型至少包括：derived-build-material / derived-production / required-production / target-production
**并且** 同一条产线内 MUST NOT 按责任类型拆成多次计算后再拼接

### Requirement: 相关产线集合来自 preview 显式挂接结果

**前提** preview 已完成责任分配
**当** compute 需要确定某条责任关联哪些产线
**那么** 系统 MUST 使用 preview 阶段显式挂接到该责任上的相关产线集合
**并且** MUST NOT 在 compute 阶段临时重新推导不同的相关产线集合

### Requirement: derived-build-material 目标速率按 buildCost 需求除以建造时间计算

**前提** compute 正在求解某条产线的某种材料，且责任类型为 derived-build-material
**当** 系统根据责任收集到相关产线集合
**那么** 该材料目标速率 MUST 按如下公式计算：

`目标速率 = 所有相关产线的所有建筑 buildCost 中，对该材料总需求 / 所有相关产线的所有建筑总建造时间`

**并且** MUST NOT 使用 per-source Math.max 作为最终规则

### Requirement: derived-production 目标速率按运营消耗加用户目标计算

**前提** compute 正在求解某条产线的某种材料，且责任类型为 derived-production
**当** 系统根据责任收集到相关产线集合
**那么** 该材料目标速率 MUST 按如下公式计算：

`目标速率 = sum(−netProduction[material] from relatedLines) + sum(targetProduction.ratePerHour for same ware on this line)`

**并且** MUST NOT 使用 buildCost/time 公式
**并且** 当同一 ware 同时有 derived-production 与 target-production 时，MUST 在求解前合并速率

### Requirement: Compute 阶段先求主要模块，再派生辅助模块

**前提** 用户点击"计算建造方案"
**当** 系统执行 compute
**那么** 系统 MUST 先根据目标速率求主要模块数量
**并且** 再由主要模块派生辅助模块数量
**并且** MUST NOT 将辅助模块作为独立责任源重新参与责任分配
**并且** ComputeResult MUST 显式分离 primaryModules / auxiliaryModules / allModules

### Requirement: SCC 迭代只以主要模块数量稳定为收敛判据

**前提** preview 依赖图中存在 SCC / 循环依赖
**当** compute 对 SCC 进行求解
**那么** 系统 MUST 迭代重算主要模块数量
**并且** 当主要模块数量不再变化时视为稳定
**并且** MUST NOT 以辅助模块数量是否变化作为单独收敛判据

### Requirement: 最终分组中重叠产线必须归入建材组且责任合并

**前提** 同一 groupId 同时出现在依赖图与责任分配结果中
**当** 系统生成最终 scheme groups
**那么** 该产线 MUST 只出现一次
**并且** MUST 归入建材产线组
**并且** MUST 合并其建材责任与生产责任后再求解
**并且** MUST NOT 先分别求解两份 scheme 再在结果层事后拼接

### Requirement: Vue 与 analysis script 必须共用同一计算入口

**前提** 系统需要展示 build-plan 结果
**当** Vue 面板渲染或 analysis script 输出结果
**那么** 两者 MUST 使用同一套 preview / compute 核心计算入口
**并且** MUST NOT 各自维护不同责任分配、速率计算或分组逻辑

### Requirement: Build-plan 真相层必须使用独立 store

**前提** 系统实现 build-plan overview
**当** store 保存或更新 build-plan 相关状态
**那么** 系统 MUST 使用独立 build-plan store 作为以下状态的唯一真相层：buildGoals / buildMaterialPlanningEnabled / buildPlan / previewResult / computeResult / schemeGroups / loading 状态
**并且** useBlueprintProductionStore MUST NOT 继续作为 build-plan 真相层

### Requirement: 默认 compute 阶段不得生成 steps

**前提** 用户执行 build-plan compute
**当** 系统完成 scheme 求解
**那么** 系统 MUST 产出静态 BuildScheme 结果
**并且** MUST NOT 在默认 compute 阶段生成 steps
**并且** MUST NOT 让 steps 成为 store 真相层的默认输出

### Requirement: BuildScheme MUST 提供默认详情视图所需的 module summaries

**前提** 系统已完成默认 compute
**当** 详情弹窗在非 steps 模式下展示 scheme
**那么** 系统 MUST 从 BuildScheme.moduleSummaries 提供模块汇总数据
**并且** Vue MUST NOT 自行从 scheme.modules 临时重建该视图真相

### Requirement: Module summaries MUST be pre-sorted by compute

**前提** 系统完成默认 compute
**当** 系统输出 moduleSummaries
**那么** 模块汇总 MUST 按 tier 升序 → module.name 升序排序
**并且** 模块材料明细 MUST 按 totalCredits 降序排序

### Requirement: Steps MUST be computed lazily inside the modal

**前提** 用户打开 scheme 详情弹窗
**当** 用户打开 steps 开关
**那么** 系统 MUST 仅针对当前 scheme 懒计算 steps
**并且** MUST 在弹窗内显示局部 loading
**并且** MUST NOT 触发全局 build-plan loading

### Requirement: Steps result MUST stay out of store truth

**前提** 系统已为当前弹窗中的 scheme 计算出 steps
**当** Vue 使用该结果显示 steps 模式
**那么** steps 结果 MUST 仅存在于 Vue / presenter 范围
**并且** MUST NOT 回写 useBuildPlanStore
**并且** MUST NOT 覆盖 store 中 BuildScheme.totalCredits

### Requirement: Vue MUST use a dedicated BuildStepsScheme view model

**前提** 详情弹窗需要显示 steps 模式
**当** Vue / presenter 组装当前 scheme 的 steps 结果
**那么** 系统 MUST 使用独立的 BuildStepsScheme 视图模型
**并且** BuildStepsScheme MUST 以 BuildScheme 为基础引用或组合
**并且** 该类型 MUST NOT 进入 store 真相层类型定义

### Requirement: Steps mode MUST display its own credits while keeping duration aligned

**前提** 用户已打开 steps 开关
**当** 弹窗显示状态栏
**那么** 总耗时 MUST 与默认模式保持一致
**并且** 总花费 MUST 显示 steps 累计口径
**并且** 步骤数 MUST 显示 steps 总数

### Requirement: Steps generation MUST reuse the existing makeSchemeSteps algorithm

**前提** 系统为当前 scheme 按需生成 steps
**当** 实现该生成逻辑
**那么** 系统 MUST 复用 makeSchemeSteps() 核心算法
**并且** MUST NOT 新增第二套 steps 生成算法
**并且** MUST 将该函数迁出默认 compute 核心模块

### Requirement: Energy Cells MUST be included in material display and cost accounting

**前提** 系统生成默认详情模式材料明细或 steps 模式材料明细
**当** 某模块或某 step 的建造材料包含 energycells
**那么** 系统 MUST 将 energycells 纳入材料展示
**并且** MUST 将其纳入成本统计
**并且** MUST NOT 再将其作为材料统计排除项

### Requirement: Modal MUST handle empty-module fallback safely

**前提** 出现异常情况导致当前 scheme 模块为空
**当** 用户打开详情弹窗
**那么** 系统 MUST 直接显示空模板
**并且** MUST NOT 显示 steps 开关

### Requirement: 默认详情模式的时长和花费 MUST 使用静态汇总口径

**前提** 系统正在生成 BuildScheme 的默认详情数据
**当** 计算 scheme 总耗时、模块耗时、scheme 总花费、模块花费与材料花费
**那么** 系统 MUST 使用静态汇总公式
**并且** MUST NOT 依赖 steps 顺序、库存抵扣或建造期间自产
