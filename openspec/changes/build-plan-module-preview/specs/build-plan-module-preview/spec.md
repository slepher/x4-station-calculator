# Build Plan Module Preview Specification

## Purpose

统一 build-plan preview 的 module 绑定与展示结构：preview MUST 直接输出 `derived` 项与 `required` 项两类真相层数据；`derived` 项在 preview 阶段确认 `moduleId`；Vue MUST 直接消费 preview 项而不是回退到旧 `goal` 兼容结构。

## ADDED Requirements

### Requirement: Preview build-material root 必须来自完整展开产线

**前提** 系统执行 build-plan preview 的 build-material 建图  
**当** 系统确定依赖图 root 范围  
**那么** 系统 MUST 从承接目标的完整展开产线收集 root 模块集合  
**并且** MUST 使用这些模块的 `buildCost` 作为依赖图首层输入  
**并且** MUST NOT 使用 `autoFill` 结果作为 preview root 模块集合

#### Scenario: target line root 不受 autoFill 污染

**前提** 某个目标模块所在产线已在 logic-flow 中展开出完整上游结构  
**当** preview 生成 build-material 依赖图  
**那么** 系统使用该产线当前已展开的非 isolated 模块节点作为 root 模块集合  
**并且** 不会因为 `autoFill` 临时补出的模块而扩大 preview 首层建材范围

### Requirement: Preview 真相层必须拆分为 derived 项与 required 项

**前提** 系统执行 build-plan preview  
**当** store 保存 preview 真相层结果  
**那么** 系统 MUST 使用两种 preview 项类型表达结果  
**并且** MUST 将供给侧项表示为 `derived` 项  
**并且** MUST 将需求侧项表示为 `required` 项  
**并且** MUST NOT 继续使用单一 `type` 字段同时承载目标、供给、需求语义

#### Scenario: 同一条线同时存在供给与需求语义

**前提** 同一条线、同一 `wareId` 同时存在供给侧与需求侧语义  
**当** 系统生成 preview 项  
**那么** 系统生成两条 preview 项  
**并且** 一条是 `derived` 项  
**并且** 一条是 `required` 项

### Requirement: Derived 项必须在 preview 阶段固定 moduleId

**前提** 系统正在生成 `derived` preview 项  
**当** 该项被确认为有效供给项  
**那么** 系统 MUST 为该项写入 `moduleId`  
**并且** MUST NOT 允许没有 `moduleId` 的 `derived` 项进入 preview 真相层

#### Scenario: lineage 来源遵循 logic-flow 配置

**前提** 系统需要为某条 logic-flow 产线生成 `lineage`  
**当** preview 开始为该线的 `derived` 项挑选 `moduleId`  
**那么** 系统先按 `isLocked ? (lockedLineage || subCategory) : subCategory` 生成该线 `lineage`  
**并且** 若结果为空，使用 `default`

#### Scenario: unmatched derived 项也固定 moduleId

**前提** 某条 `derived` 项未匹配到正式产线  
**当** 系统将其归入 unmatched line  
**那么** 系统仍按 `settings.racePreference` 为其确认 `moduleId`  
**并且** UI 分组名仍保持 unmatched 语义

### Requirement: Compute 必须尊重 preview 已选 moduleId

**前提** preview 已为 `derived` 项确认 `moduleId`  
**当** compute 读取 preview 结果继续求解  
**那么** compute MUST 直接读取该 `moduleId`  
**并且** MUST NOT 再次根据 `lineage`、`racePreference` 或 producer 搜索重新生成 `moduleId`  
**并且** MUST NOT 覆盖 preview 已确认的 `moduleId`

#### Scenario: compute 只读取 preview moduleId

**前提** 某条 `derived` 项在 preview 中已选定 `moduleId = M`  
**当** compute 计算该项的主模块与辅助模块  
**那么** 系统使用 `M` 作为该项对应的主要生产模块标识  
**并且** 不再重新挑选其他 module

### Requirement: Required 项只表达依赖确认而不绑定 moduleId

**前提** 系统正在生成 `required` preview 项  
**当** 该项表达“这条线需要什么”  
**那么** 系统 MUST 使用 `wareId` 表达依赖对象  
**并且** MUST NOT 要求该项绑定 `moduleId`

#### Scenario: required 项可单独存在

**前提** 某条 preview 项只由依赖确认生成  
**当** 它不对应任何目标来源  
**那么** 系统允许该 `required` 项独立存在  
**并且** 不为该项补写 `targets`

### Requirement: Targets 只记录目标来源关联

**前提** 系统生成 `derived` preview 项  
**当** 该项承接了用户目标或 fleet 派生产能  
**那么** 系统 MUST 将这些来源记录到 `targets[]`  
**并且** 每个来源 MUST 占一条 `targets[]` 数据  
**并且** `targets[]` MUST 只包含：
- `type`
- `count?`
- `ratePerHour?`

**并且** `targets[]` MUST NOT 保存 `moduleId`  
**并且** `targets[]` MUST NOT 保存 `wareId`  
**并且** `targets[]` MUST NOT 出现在 `required` 项上

#### Scenario: fleet-rate 进入 targets

**前提** 某条 `derived` 项承接了 fleet 派生产能  
**当** 系统生成该项  
**那么** 系统在 `targets[]` 中添加一条 `fleet-rate` 记录  
**并且** 该记录使用 `ratePerHour`

### Requirement: Preview 展示必须直接消费 preview 项

**前提** Vue 渲染 preview 区  
**当** presenter 输出 preview 数据  
**那么** presenter MUST 直接输出 preview 项展示数据  
**并且** Vue MUST 直接消费 preview 项  
**并且** MUST NOT 再将 preview 结果转回 `ProductionLineAllocation.goals`  
**并且** MUST NOT 依赖旧 `goal.type` 渲染 preview 语义

#### Scenario: preview 有 moduleId 时显示 module 名称

**前提** 某条 preview 项存在 `moduleId`  
**当** Vue 渲染该项  
**那么** 系统显示 module 名称  
**并且** 不显示 ware 名称

### Requirement: Preview tag 必须使用固定颜色与文案

**前提** Vue 渲染 preview tag  
**当** tag 来源于 `derived` 项  
**那么** 系统 MUST 使用绿色 tag  
**并且** 按如下值映射文案：
- `target` -> `目标` / `Target`
- `production` -> `材料` / `Production`
- `build-material` -> `建材` / `Material`

**前提** Vue 渲染 preview tag  
**当** tag 来源于 `required` 项  
**那么** 系统 MUST 使用红色 tag  
**并且** 按如下值映射文案：
- `production` -> `材料` / `Production`
- `build-material` -> `建材` / `Material`

#### Scenario: 绿色 tag 与红色 tag 分开渲染

**前提** 同一条线内同时存在 `derived` 项与 `required` 项  
**当** Vue 渲染 preview 区  
**那么** `derived` 项以绿色 tag 渲染  
**并且** `required` 项以红色 tag 渲染

### Requirement: 产线卡片计数必须显示 module 去重数

**前提** Vue 渲染 preview 产线卡片  
**当** 系统显示卡片右上角数量  
**那么** 该数量 MUST 表示当前 line 内已分配 `moduleId` 的去重种类数  
**并且** MUST NOT 表示 preview 项数量

#### Scenario: 多个 derived 项指向同一 module 时只计一次

**前提** 同一条 line 内有多个 `derived` 项  
**并且** 它们指向同一个 `moduleId`  
**当** 系统计算卡片数量  
**那么** 该 `moduleId` 只计一次
