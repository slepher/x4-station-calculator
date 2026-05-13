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

**前提** 用户在 build-plan 面板操作建材规划 checkbox
**当** checkbox 被勾选或取消勾选
**那么** checkbox MUST 只表达“是否需要考虑生产建材的生产线的构建”
**并且** MUST NOT 表达“是否进入 build-flow 上下文”
**并且** 关闭 checkbox 时，用户目标与待规划产线 preview MUST 仍然存在

#### Scenario: 关闭 checkbox 时不生成 build-material graph / SCC

**前提** checkbox 未勾选
**当** 系统执行 preview
**那么** 系统 MUST 继续生成 allocation-only preview
**并且** MUST NOT 为建材规划生成 graph
**并且** MUST NOT 生成 sccGroups

### Requirement: Preview 真相层必须拆分为 derived 项与 required 项

**前提** preview 需要表达责任与依赖
**当** 系统构造 preview 数据
**那么** preview 真相层 MUST 拆分为 `PreviewDerivedItem` 与 `PreviewRequiredItem`
**并且** MUST NOT 继续使用单一 `PreviewResponsibility.type` 承载全部语义

#### Scenario: 同一条线同时存在供给与需求语义

**前提** 某条产线对同一 `wareId` 同时存在供给侧责任与需求侧依赖
**当** 系统生成 preview 项
**那么** 系统 MUST 生成两条 preview 项
**并且** 一条为 derived 项
**并且** 一条为 required 项
**并且** MUST NOT 将两种语义压缩到同一条 preview 项

### Requirement: Derived 项必须在 preview 阶段固定 moduleId

**前提** preview 需要为某条产线表达 derived 责任
**当** 系统生成 derived 项
**那么** 该项 MUST 绑定明确的 `moduleId`
**并且** derived 项内部 MUST 使用 `derived: []` 表达标签集合
**并且** 标签值 MUST 仅允许 `target`、`production`、`build-material`

#### Scenario: lineage 来源遵循 logic-flow 配置

**前提** 某条产线来自 logic-flow 中的 manual/auto 节点
**当** 系统为其选择 `moduleId`
**那么** 系统 MUST 先根据该产线的 lineage 约束筛选可用 producer module
**并且** manual 阶段 MUST 优先于 auto 阶段

#### Scenario: unmatched derived 项也固定 moduleId

**前提** 某条 derived 责任没有匹配到现有 logic-flow 产线
**当** 系统将其放入待规划产线
**那么** 系统 MUST 仍然为其确认 `moduleId`
**并且** 当存在 `settings.racePreference` 时 MUST 按该偏好选择 module

### Requirement: Compute 必须尊重 preview 已选 moduleId

**前提** preview 已为 derived 项确认 `moduleId`
**当** 后续进入 compute
**那么** compute MUST 直接读取该 `moduleId`
**并且** MUST NOT 在 compute 阶段重新选择 producer module

### Requirement: Required 项只表达依赖确认而不绑定 moduleId

**前提** preview 需要表达某条产线的输入依赖
**当** 系统生成 required 项
**那么** 该项 MUST NOT 绑定 `moduleId`
**并且** required 项内部 MUST 使用 `required: []` 表达标签集合
**并且** 标签值 MUST 仅允许 `production` 与 `build-material`

### Requirement: Targets 只记录目标来源关联

**前提** preview 需要保留用户目标来源
**当** 系统生成 derived 项
**那么** 系统 MAY 在该项上记录 `targets[]`
**并且** `targets[]` MUST 只表达与用户目标的关联
**并且** 没有关联来源的 preview 项 MUST NOT 写入 `targets[]`

### Requirement: Preview 展示必须直接消费 preview 项

**前提** Vue 需要展示产线 preview
**当** 组件渲染 preview 区
**那么** Vue MUST 直接消费 preview 真相层数据
**并且** MUST NOT 再回退到旧的 `ProductionLineAllocation.goals` 兼容结构

### Requirement: Preview tag 必须使用固定颜色与文案

**前提** Vue 渲染 preview 项标签
**当** 某项为 derived 或 required
**那么** derived tag MUST 使用绿色
**并且** required tag MUST 使用红色
**并且** `target`、`production`、`build-material` MUST 使用固定文案映射

### Requirement: 产线卡片计数必须显示 module 去重数

**前提** preview 卡片展示产线摘要
**当** 系统渲染卡片右上角计数
**那么** 该计数 MUST 表示当前卡片内 `moduleId` 的去重种类数

### Requirement: Preview build-material root 必须来自完整展开产线

**前提** preview 需要构建 build-material 依赖图
**当** 系统确定根建筑集合
**那么** 根集合 MUST 来自承接目标的完整展开产线
**并且** MUST NOT 使用 autoFill 结果作为 root 模块集合

### Requirement: 依赖图 BFS 必须融入 isolated 扩展

**前提** preview 需要沿建材连线扩展依赖
**当** BFS 追踪到某条产线缺少直接 build-flow 连线
**那么** 系统 MUST 检查 isolated 节点是否能提供对应 ware
**并且** 命中时 MUST 按 manual 优先、auto 次之的规则扩展
**并且** 未命中时 MUST 忽略该边
**并且** MUST NOT fallback 到其他未定义来源

### Requirement: 责任到产线的全局两轮分配

**前提** 系统需要将全部目标分配到产线
**当** 执行 preview 分配
**那么** 第一轮 MUST 完成所有 manual 分配
**并且** 第二轮 MUST 处理 auto 分配
**并且** auto 分配阶段 MUST 优先聚集到已分配的现有产线

### Requirement: 用户目标区与 preview 区必须分离

**前提** build-plan 面板同时存在目标输入与 preview 展示
**当** 用户查看或编辑规划
**那么** 用户目标区 MUST 作为唯一可编辑输入区
**并且** preview 区 MUST 只展示分配结果
**并且** preview 区 MUST NOT 显示数量输入或删除按钮
