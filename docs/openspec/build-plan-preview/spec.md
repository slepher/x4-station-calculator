# Build Plan Preview Specification

## Purpose

定义 build-plan preview 阶段的完整行为规范：preview 负责责任分配、依赖图构建、SCC 检测；derived 项在 preview 阶段固定 moduleId；Vue 直接消费 preview 项。

## ADDED Requirements

### Requirement: Preview 阶段负责责任分配而非模块求解

**前提** 系统处于 build-flow 规划上下文
**当** 系统执行 preview
**那么** 系统 MUST 决定需要建造哪些产线
**并且** MUST 为每条产线分配责任
**并且** MUST 产出依赖图与 SCC
**并且** MUST NOT 在 preview 阶段产出最终主要模块数量、辅助模块数量或 steps

#### Scenario: logic-flow 为空时仍生成待规划 preview

**前提** 当前 build-plan 方案的 `logicFlowPlanId = null`
**当** 系统执行 preview
**那么** 系统 MUST 继续生成 PreviewResult
**并且** MUST 将全部目标落入 `isUnmatched = true` 的待规划产线
**并且** graph MUST 为 `null`
**并且** sccGroups MUST 为空

### Requirement: Checkbox 只控制是否按建筑材料需求规划建材产线

**前提** 系统处于 build-flow 规划上下文
**当** 用户切换"建材产线"checkbox
**那么** checkbox MUST 只控制"是否按建筑材料需求规划建材产线"
**并且** MUST NOT 被解释为进入或退出 build-flow mode

#### Scenario: 关闭 checkbox 时不生成 build-material graph / SCC

**前提** 用户关闭"建材产线"checkbox
**当** 系统执行 preview 或 compute
**那么** 系统 MAY 继续保留 production allocation preview
**并且** MUST NOT 生成仅用于建材产线规划的 build-material graph
**并且** MUST NOT 生成仅用于建材产线循环求解的 SCC
**并且** 该行为 MUST 被视为"关闭建材产线规划"的正常结果，而不是退出 build-flow 规划上下文

### Requirement: Preview 真相层必须拆分为 derived 项与 required 项

**前提** 系统执行 preview
**当** store 保存 preview 真相层结果
**那么** 系统 MUST 使用两种 preview 项类型表达结果
**并且** MUST 将供给侧项表示为 `derived` 项
**并且** MUST 将需求侧项表示为 `required` 项
**并且** MUST NOT 继续使用单一 type 字段同时承载目标、供给、需求语义

#### Scenario: 同一条线同时存在供给与需求语义

**前提** 同一条线、同一 wareId 同时存在供给侧与需求侧语义
**当** 系统生成 preview 项
**那么** 系统生成两条 preview 项：一条 derived，一条 required

### Requirement: Derived 项必须在 preview 阶段固定 moduleId

**前提** 系统正在生成 derived preview 项
**当** 该项被确认为有效供给项
**那么** 系统 MUST 为该项写入 moduleId
**并且** MUST NOT 允许没有 moduleId 的 derived 项进入 preview 真相层

#### Scenario: lineage 来源遵循 logic-flow 配置

**前提** 系统需要为某条 logic-flow 产线生成 lineage
**当** preview 开始为该线的 derived 项挑选 moduleId
**那么** 系统先按 `isLocked ? (lockedLineage || subCategory) : subCategory` 生成该线 lineage
**并且** 若结果为空，使用 `default`

#### Scenario: unmatched derived 项也固定 moduleId

**前提** 某条 derived 项未匹配到正式产线
**当** 系统将其归入 unmatched line
**那么** 系统仍按 settings.racePreference 为其确认 moduleId

### Requirement: Compute 必须尊重 preview 已选 moduleId

**前提** preview 已为 derived 项确认 moduleId
**当** compute 读取 preview 结果继续求解
**那么** compute MUST 直接读取该 moduleId
**并且** MUST NOT 再次根据 lineage、racePreference 或 producer 搜索重新生成 moduleId

### Requirement: Required 项只表达依赖确认而不绑定 moduleId

**前提** 系统正在生成 required preview 项
**当** 该项表达"这条线需要什么"
**那么** 系统 MUST 使用 wareId 表达依赖对象
**并且** MUST NOT 要求该项绑定 moduleId

### Requirement: Targets 只记录目标来源关联

**前提** 系统生成 derived preview 项
**当** 该项承接了用户目标或 fleet 派生产能
**那么** 系统 MUST 将这些来源记录到 targets[]
**并且** 每个来源 MUST 占一条 targets[] 数据
**并且** targets[] MUST 只包含 type / count? / ratePerHour?
**并且** targets[] MUST NOT 保存 moduleId 或 wareId
**并且** targets[] MUST NOT 出现在 required 项上

### Requirement: Preview 展示必须直接消费 preview 项

**前提** Vue 渲染 preview 区
**当** presenter 输出 preview 数据
**那么** presenter MUST 直接输出 preview 项展示数据
**并且** Vue MUST 直接消费 preview 项
**并且** MUST NOT 再将 preview 结果转回 ProductionLineAllocation.goals
**并且** MUST NOT 依赖旧 goal.type 渲染 preview 语义

### Requirement: Preview tag 必须使用固定颜色与文案

**前提** Vue 渲染 preview tag
**当** tag 来源于 derived 项
**那么** 系统 MUST 使用绿色 tag
**并且** 按如下值映射文案：target → 目标/Target，production → 材料/Production，build-material → 建材/Material

**前提** Vue 渲染 preview tag
**当** tag 来源于 required 项
**那么** 系统 MUST 使用红色 tag
**并且** 按如下值映射文案：production → 材料/Production，build-material → 建材/Material

### Requirement: 产线卡片计数必须显示 module 去重数

**前提** Vue 渲染 preview 产线卡片
**当** 系统显示卡片右上角数量
**那么** 该数量 MUST 表示当前 line 内已分配 moduleId 的去重种类数
**并且** MUST NOT 表示 preview 项数量

### Requirement: Preview build-material root 必须来自完整展开产线

**前提** 系统执行 preview 的 build-material 建图
**当** 系统确定依赖图 root 范围
**那么** 系统 MUST 从承接目标的完整展开产线收集 root 模块集合
**并且** MUST 使用这些模块的 buildCost 作为依赖图首层输入
**并且** MUST NOT 使用 autoFill 结果作为 preview root 模块集合

### Requirement: 依赖图 BFS 必须融入 isolated 扩展

**前提** preview 正在构建依赖图
**当** 一条产线 L 被加入图中
**那么** 系统检查 L 的 isolated 节点
**并且** 使用 manual > auto 优先级搜索产出该 ware 的产线
**并且** 新增边方向保持"消费方 → 供给方"
**并且** 若无连线则忽略，不回退搜索其他来源

### Requirement: 责任到产线的全局两轮分配

**前提** 系统需要将目标分配到产线
**当** preview 执行责任分配
**那么** 第一轮 MUST 先完成所有目标的 manual 全局分配
**并且** 第二轮 MUST 优先在已分配产线中查找 auto 节点
**并且** 第二轮 MUST 其次在未分配产线中查找 auto 节点
**并且** 仍未匹配 MUST 归入 unmatched

### Requirement: 用户目标区与 preview 区必须分离

**前提** 约束面板需要同时展示用户输入与 preview 分配结果
**当** Vue 渲染 build-plan 约束面板
**那么** 系统 MUST 保留独立"用户目标区"作为唯一可编辑输入区
**并且** preview 区 MUST 只展示分配结果
**并且** preview 区 MUST NOT 显示数量输入或删除按钮
