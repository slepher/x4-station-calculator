# Build Plan Production Line Specification

## Purpose

将建材产线计算提前到勾上 checkbox 时执行，C 按产线分配拆分，scheme 按建材/生产分组展示，依赖图融入 isolated 扩展，产线唯一且重叠归建材分组。

## ADDED Requirements

### Requirement: 提前计算依赖图与分配

**前提** 用户在建造规划面板中勾上"建材产线"checkbox
**当** 系统检测到 checkbox 状态、buildGoals、logic-flow 或 build-flow 数据变化
**那么** 立即执行依赖图构建（含 isolated 扩展）、SCC 检测、建材产线分配
**并且** 结果存入 store（buildFlowPlanGraphResult、buildFlowPlanAllocations）
**并且** 点击"计算建造方案"仍需手动触发，基于已有依赖图生成完整 steps 明细

#### Scenario: 勾上 checkbox 触发提前计算

**前提** 用户已添加 buildGoals 且有活跃 logic-flow plan
**当** 用户勾上"建材产线"checkbox
**那么** 系统立即执行依赖图构建 + SCC 检测 + 建材产线分配
**并且** buildFlowPlanGraphResult 不为 null

#### Scenario: goals 变化触发重算

**前提** "建材产线"已勾上
**当** 用户添加或删除 buildGoal
**那么** 系统自动重算依赖图 + 分配

#### Scenario: 未勾上时无提前计算

**前提** "建材产线"未勾上
**那么** buildFlowPlanGraphResult 为 null
**并且** buildFlowPlanAllocations 为空数组

### Requirement: 依赖图 isolated 扩展

**前提** 依赖图 BFS 执行中
**当** 一条产线 L 加入图后
**那么** 检查 L 的 isolated 节点
**并且** 通过共用函数 `findGroupProducingWare` 在所有 logic-flow groups 中搜索产出该 ware 的产线 B（manual > auto 优先级）
**并且** B 已在图中则仅加边 L→B
**并且** B 不在图中则加入图、加边 L→B、递归检查 B 的 isolated
**并且** 新增边方向为消费→供给（与现有图一致）
**并且** B 自身建材来源：若 B 在 buildFlowGroups 中则用 buildMaterialTags 扩散；若 B 不在 buildFlowGroups 中则用 outputBuildTags 连线查找
**并且** 无连线时忽略，不回退搜索其他来源，视为外部供应

#### Scenario: isolated 扩展找到新产线

**前提** 产线 L 在依赖图中，L 有 isolated 节点 wareId=W
**当** `findGroupProducingWare(W, groups)` 返回产线 B
**并且** B 不在图中
**那么** B 加入图，新增边 L→B（wareId=W）
**并且** 递归检查 B 的 isolated 节点

#### Scenario: isolated 扩展产线已存在

**前提** 产线 L 在依赖图中，L 有 isolated 节点 wareId=W
**当** `findGroupProducingWare(W, groups)` 返回产线 B
**并且** B 已在图中
**那么** 仅新增边 L→B（wareId=W），不重复加入节点

#### Scenario: isolated 扩展无匹配产线

**前提** 产线 L 在依赖图中，L 有 isolated 节点 wareId=W
**当** `findGroupProducingWare(W, groups)` 返回 null
**那么** 该 ware 被忽略，不加边不加节点

#### Scenario: isolated 扩展 B 在 buildFlowGroups 中有定义

**前提** 产线 L 有 isolated 节点，搜索到产线 B 加入图
**当** B 在 buildFlowGroups 中有定义（buildMaterialTags 存在）
**那么** B 的建材来源按 buildMaterialTags 中有连线的标签继续扩散

#### Scenario: isolated 扩展 B 不在 buildFlowGroups 中

**前提** 产线 L 有 isolated 节点，搜索到产线 B 加入图
**当** B 不在 buildFlowGroups 中
**那么** B 的建材来源通过 outputBuildTags 连线查找

#### Scenario: isolated 扩展 B 的 buildMaterialTags 无连线

**前提** 产线 L 有 isolated 节点，搜索到产线 B 加入图
**当** B 在 buildFlowGroups 中，但 B 的某个 buildMaterialTag 无连线
**那么** 该 buildMaterialTag 被忽略，视为外部供应，不回退搜索其他来源

#### Scenario: isolated 扩展 B 的 outputBuildTags 无连线

**前提** 产线 L 有 isolated 节点，搜索到产线 B 加入图
**当** B 不在 buildFlowGroups 中，B 的某 buildCost ware 在 outputBuildTags 中无连线
**那么** 该 ware 被忽略，视为外部供应，不回退搜索其他来源

### Requirement: 共用搜索函数

**前提** 多处逻辑需要在 logic-flow groups 中搜索产出指定 ware 的产线
**当** 调用 `findGroupProducingWare(wareId, groups)`
**那么** 返回 `{ sourceGroupId }` 或 null
**并且** 搜索优先级：manual 节点 > auto 节点
**并且** 建材产线 isolated 扩展和非建材 derived goal 搜索共用此函数

### Requirement: C 按产线分配拆分

**前提** 用户点击"计算建造方案"
**当** 系统生成 scheme
**那么** C 不再作为单一整体 scheme
**并且** C 按产线分配拆分为多个子 scheme
**并且** 每个子 scheme 对应一条已分配的产线
**并且** 每个产线根据自己分配到的 goals 独立 expandGoalDependencies + autoFill
**并且** 未分配到任何产线的 goals 归入"待规划产线"

#### Scenario: 多产线分配后 C 拆分

**前提** buildGoals 分配到产线 A 和产线 B
**当** 用户点击"计算"
**那么** 生成产线 A scheme 和产线 B scheme（各自独立计算模块）
**并且** 不生成整体 C scheme

### Requirement: 产线唯一性

**前提** 一条产线按 groupId 在依赖图和产线分配中均出现
**当** 系统构建 scheme 分组
**那么** 该产线归入建材产线分组
**并且** 只出一个 scheme
**并且** 建材需求速率 + 生产需求速率叠加相加

#### Scenario: 重叠产线归入建材分组

**前提** 产线 L 同时出现在依赖图（产出建材）和产线分配（产出目标产品）
**当** 系统构建 scheme 分组
**那么** L 归入建材产线分组
**并且** L 的 scheme 同时满足建材需求和生产需求（速率叠加相加）
**并且** 生产产线分组中不包含 L

#### Scenario: 非重叠产线归入生产分组

**前提** 产线 M 仅出现在产线分配中，不在依赖图中
**当** 系统构建 scheme 分组
**那么** M 归入生产产线分组

### Requirement: scheme 分组展示

**前提** scheme 生成完成
**当** UI 渲染 scheme 卡片
**那么** 按"建材产线"和"生产产线"两大分组展示
**并且** 建造顺序：先建材后生产
**并且** 组内按依赖拓扑序

#### Scenario: 两大分组渲染

**前提** 存在建材产线 schemes 和生产产线 schemes
**当** BuildPlanPanel 渲染
**那么** 先渲染"建材产线"分组标题和卡片
**然后** 渲染"生产产线"分组标题和卡片

### Requirement: 建材产线分配预览

**前提** 用户勾上"建材产线"checkbox
**当** 约束面板渲染
**那么** 在现有产线分配区域上方显示建材产线分配预览
**并且** 格式与现有产线分配区域一致（目标展示目标，derived 展示 derived）
**并且** derived goal 来源为依赖图产线的 isolated 节点
**并且** 建材产线分配预览为只读（不可编辑/删除）

#### Scenario: 勾上后显示建材分配预览

**前提** 用户勾上"建材产线"
**当** 依赖图包含产线 L（trackedWares = [hullparts]）
**那么** 建材产线分配预览中显示产线 L
**并且** L 的 goals 中包含 derived-rate hullparts

#### Scenario: 未勾上时不显示

**前提** 用户未勾上"建材产线"
**那么** 建材产线分配预览区不显示

### Requirement: 待规划产线不参与建材分组

**前提** 某些 goals 未匹配到任何产线
**当** 系统构建 scheme 分组
**那么** 待规划产线（unmatched）不参与建材分组检查
**并且** 始终归入生产产线分组

### Requirement: SCC 数据存储

**前提** 依赖图构建完成
**当** SCC 检测执行
**那么** SCC 数据存入 store（buildFlowPlanGraphResult.sccGroups）
**并且** 供 computePlan 内部计算使用
**并且** 预留未来 UI 标注循环依赖（当前不展示）
