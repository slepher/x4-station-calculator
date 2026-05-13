# Build Plan Production Line Specification

## Purpose

统一 `build-plan-production-line` 的行为定义：`preview` 负责责任分配、依赖图、SCC；`compute` 负责读取 `preview` 结果并求解主要模块 / 辅助模块；Vue 与 analysis script 必须使用同一计算结果。

## ADDED Requirements

### Requirement: 当前代码实现不构成需求依据

**前提** 当前仓库中已存在 `build-plan-production-line` 相关实现  
**当** 开发者审查、修改或扩展该功能  
**那么** 系统需求 MUST 以本 change 文档为准  
**并且** MUST NOT 以当前代码行为反推需求正确性  
**并且** 若代码与文档冲突，默认按文档修正代码

#### Scenario: 当前代码与文档冲突时以文档为准

**前提** 当前实现行为与本 spec 描述不一致  
**当** 开发者决定后续改造方向  
**那么** 开发者按文档修正实现  
**并且** 不因兼容错误实现而回退需求定义

### Requirement: Preview 阶段负责责任分配而非模块求解

**前提** 系统处于 build-flow 规划上下文  
**当** 系统执行 preview  
**那么** 系统 MUST 决定需要建造哪些产线  
**并且** MUST 为每条产线分配责任  
**并且** MUST 产出依赖图与 SCC  
**并且** MUST NOT 在 preview 阶段产出最终主要模块数量、辅助模块数量或 steps

#### Scenario: 目标变化触发 preview

**前提** 用户已有 buildGoals  
**当** 用户修改目标模块或目标产物  
**那么** 系统立即执行 preview  
**并且** 结果中包含责任分配、依赖图、SCC

#### Scenario: checkbox 状态变化触发 preview

**前提** 系统处于 build-flow 规划上下文  
**当** 用户勾选或取消“建材产线”checkbox  
**那么** 系统自动重跑 preview  
**并且** 刷新责任分配、依赖图、SCC

### Requirement: Checkbox 只控制是否按建筑材料需求规划建材产线

**前提** 系统处于 build-flow 规划上下文  
**当** 用户切换“建材产线”checkbox  
**那么** checkbox MUST 只控制“是否按建筑材料需求规划建材产线”  
**并且** MUST NOT 被解释为进入或退出 build-flow mode

#### Scenario: 勾选 checkbox 启用建材产线规划

**前提** checkbox 当前未勾选  
**当** 用户勾选 checkbox  
**那么** preview 结果包含按建筑材料需求规划出的建材产线责任、依赖图与 SCC

#### Scenario: 取消 checkbox 移除建材产线规划

**前提** checkbox 当前已勾选  
**当** 用户取消 checkbox  
**那么** preview 结果移除按建筑材料需求规划出的建材产线责任、依赖图与 SCC

### Requirement: 单条产线可同时承担三类责任且必须合并满足

**前提** 一条产线在 preview 中被分配责任  
**当** 该线进入 compute 求解  
**那么** 系统 MUST 将该线全部责任合并后统一求解  
**并且** 责任类型至少包括：
- `derived-build-material`
- `derived-production` / `required-production`
- `target-production`

#### Scenario: 一条线同时承担建材与用户目标

**前提** 产线 L 同时承担 `derived-build-material` 与 `target-production`  
**当** 用户点击“计算建造方案”  
**那么** 系统先合并 L 的全部责任  
**并且** 用合并后结果统一计算 L 的主要模块与辅助模块

### Requirement: 相关产线集合来自 preview 显式挂接结果

**前提** preview 已完成责任分配  
**当** compute 需要确定某条责任关联哪些产线  
**那么** 系统 MUST 使用 preview 阶段显式挂接到该责任上的相关产线集合  
**并且** MUST NOT 在 compute 阶段临时重新推导不同的相关产线集合
**并且** MUST NOT 继续使用仅含 `goals` 的扁平 `ProductionLineAllocation` 作为 preview 真相层

#### Scenario: 责任挂接的相关产线在 compute 中直接复用

**前提** 某条责任在 preview 中已挂接 `[A, B, C]`  
**当** compute 读取该责任  
**那么** 系统使用 `[A, B, C]` 作为该责任的相关产线集合

### Requirement: Preview 真相层必须显式保存责任对象

**前提** 系统完成 preview  
**当** store 保存 preview 结果  
**那么** 系统 MUST 为每条产线显式保存责任对象集合  
**并且** 每条责任 MUST 至少包含：
- 责任类型
- 责任来源
- `relatedLineGroupIds`
**并且** MUST NOT 仅保存为扁平 `goals` 列表

#### Scenario: Store 保存可直接复用的 preview truth

**前提** preview 已完成  
**当** compute 或 presenter 读取 preview 结果  
**那么** 它们直接读取责任对象与 `relatedLineGroupIds`  
**并且** 不需要再临时猜测责任类型或相关产线

### Requirement: derived-build-material 目标速率按 buildCost 需求除以建造时间计算

**前提** compute 正在求解某条产线的某种材料，且责任类型为 `derived-build-material`  
**当** 系统根据责任收集到相关产线集合  
**那么** 该材料目标速率 MUST 按如下公式计算：

`目标速率 = 所有相关产线的所有建筑 buildCost 中，对该材料总需求 / 所有相关产线的所有建筑总建造时间`

**并且** MUST NOT 使用 per-source `Math.max` 作为最终规则

### Requirement: derived-production 目标速率按运营消耗加用户目标计算

**前提** compute 正在求解某条产线的某种材料，且责任类型为 `derived-production`  
**当** 系统根据责任收集到相关产线集合  
**那么** 该材料目标速率 MUST 按如下公式计算：

`目标速率 = sum(−netProduction[material] from relatedLines) + sum(targetProduction.ratePerHour for same ware on this line)`

**并且** MUST NOT 使用 buildCost/time 公式<br/>
**并且** 当同一 ware 同时有 `derived-production` 与 `target-production` 时，必须在求解前合并速率

#### Scenario: 多个相关产线共同决定目标速率

**前提** 责任挂接到相关产线 A、B、C  
**当** 系统计算材料 W 的目标速率  
**那么** 系统汇总 A、B、C 全部建筑对 W 的总需求  
**并且** 汇总 A、B、C 全部建筑总建造时间  
**并且** 用两者相除得到 W 的目标速率

### Requirement: Compute 阶段先求主要模块，再派生辅助模块

**前提** 用户点击“计算建造方案”  
**当** 系统执行 compute  
**那么** 系统 MUST 先根据目标速率求主要模块数量  
**并且** 再由主要模块派生辅助模块数量  
**并且** MUST NOT 将辅助模块作为独立责任源重新参与责任分配
**并且** MUST NOT 在 compute 阶段重新按原始 `goals` 再次执行产线分配

#### Scenario: 主要模块稳定后派生辅助模块

**前提** 某条产线主要模块数量已求得  
**当** 系统继续完成该线求解  
**那么** 系统根据主要模块结果派生辅助模块数量

### Requirement: SCC 迭代只以主要模块数量稳定为收敛判据

**前提** preview 依赖图中存在 SCC / 循环依赖  
**当** compute 对 SCC 进行求解  
**那么** 系统 MUST 迭代重算主要模块数量  
**并且** 当主要模块数量不再变化时视为稳定  
**并且** MUST NOT 以辅助模块数量是否变化作为单独收敛判据

#### Scenario: 主模块稳定即停止迭代

**前提** SCC 内各产线主要模块数量在本轮与上轮完全一致  
**当** 系统检查收敛状态  
**那么** 系统停止迭代  
**并且** 用稳定后的主要模块结果派生辅助模块

### Requirement: 依赖图 BFS 融入 isolated 扩展

**前提** preview 正在构建依赖图  
**当** 一条产线 L 被加入图中  
**那么** 系统检查 L 的 isolated 节点  
**并且** 使用 manual > auto 优先级搜索产出该 ware 的产线  
**并且** 新增边方向保持“消费方 -> 供给方”  
**并且** 若无连线则忽略，不回退搜索其他来源

#### Scenario: isolated 扩展找到新产线

**前提** 产线 L 有 isolated ware W  
**当** 系统找到产出 W 的产线 B 且 B 尚未入图  
**那么** B 被加入图中  
**并且** 系统添加边 `L -> B`

#### Scenario: isolated 扩展无连线时忽略

**前提** 产线 B 的 build material 或 output build 没有连线  
**当** preview 尝试继续扩展  
**那么** 该来源被忽略  
**并且** 系统不回退到其他搜索方式

### Requirement: 最终分组中重叠产线必须归入建材组且责任合并

**前提** 同一 `groupId` 同时出现在依赖图与责任分配结果中  
**当** 系统生成最终 scheme groups  
**那么** 该产线 MUST 只出现一次  
**并且** MUST 归入建材产线组  
**并且** MUST 合并其建材责任与生产责任后再求解
**并且** MUST NOT 先分别求解两份 scheme 再在结果层事后拼接

#### Scenario: 重叠产线不再重复出现在生产组

**前提** 产线 L 同时属于建材链路和生产责任  
**当** 系统输出最终 grouped schemes  
**那么** L 只在建材产线组出现  
**并且** 生产组不再出现第二张 L 卡片

### Requirement: Vue 与 analysis script 必须共用同一计算入口

**前提** 系统需要展示 build-plan 结果  
**当** Vue 面板渲染或 analysis script 输出结果  
**那么** 两者 MUST 使用同一套 preview / compute 核心计算入口  
**并且** MUST NOT 各自维护不同责任分配、速率计算或分组逻辑
**并且** presenter / Vue MUST NOT 再二次拼装 preview 责任结果

#### Scenario: analysis script 与 Vue 输出同源

**前提** 相同输入 goals 与 flow 数据  
**当** 用户查看 Vue 结果并运行 analysis script  
**那么** 两者使用同一核心计算入口  
**并且** 结果语义保持一致

### Requirement: Build-plan 真相层必须使用独立 store

**前提** 系统实现 build-plan overview  
**当** store 保存或更新 build-plan 相关状态  
**那么** 系统 MUST 使用独立 build-plan store 作为以下状态的唯一真相层：
- `buildGoals`
- `buildFlowMode`
- `buildPlan`
- `previewResult`
- `computeResult`
- `schemeGroups`
- preview / compute loading 状态

**并且** `useBlueprintProductionStore` MUST 保留 empire / station planning 领域职责  
**并且** `useBlueprintProductionStore` MUST NOT 继续作为 build-plan 真相层  
**并且** Presenter MAY 组合多个 store，但 Vue MUST 通过 presenter 消费这些结果

#### Scenario: overview 页面组合两个 store

**前提** 用户打开 blueprint production overview 页面  
**当** 页面渲染 build-plan 相关面板  
**那么** build-plan 相关输入、预览和计算结果来自独立 build-plan store  
**并且** empire flow、station planning、save/load 仍来自 `useBlueprintProductionStore`

### Requirement: Store / Presenter / Vue 职责必须分层

**前提** 系统实现 build-plan-production-line  
**当** 开发者调整 store、presenter 与 Vue 组件  
**那么** store MUST 保存 preview / compute 真相层结果  
**并且** presenter MUST 只做展示字段映射  
**并且** Vue MUST 只展示 presenter 输出  
**并且** presenter / Vue MUST NOT 重新拼装 preview 责任或 compute 求解逻辑

### Requirement: 用户目标区与 preview 区必须分离

**前提** 约束面板需要同时展示用户输入与 preview 分配结果  
**当** Vue 渲染 build-plan 约束面板  
**那么** 系统 MUST 保留独立“用户目标区”作为唯一可编辑输入区  
**并且** 建造目标区 MUST NOT 按产线分组  
**并且** 该区域只允许编辑和删除用户手动添加的 `production-rate` / `build-module`  
**并且** preview 区 MUST 只展示分配结果  
**并且** preview 区中的 `target-production` / `derived-build-material` / `derived-production` / `required-production` MUST 以 tag 方式展示  
**并且** preview 区 MUST NOT 显示数量输入或删除按钮

#### Scenario: preview 区中的 target-production 只显示“目标”tag

**前提** preview 某条责任类型为 `target-production`  
**当** 约束面板渲染该责任  
**那么** 界面显示“目标”tag  
**并且** 不显示数量输入  
**并且** 不允许用户直接删除该 preview 条目

#### Scenario: 约束面板直接展示 preview truth

**前提** checkbox 已勾选且 preview 已完成  
**当** 约束面板展示“建材产线分配”预览区  
**那么** presenter 直接从 preview truth 映射展示字段  
**并且** Vue 不再把 preview allocation 与 production allocation 二次合并
