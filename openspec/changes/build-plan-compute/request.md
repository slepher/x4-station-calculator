# build-plan-compute 需求

## 目标

统一 build-plan compute 阶段的职责边界与数据模型：

1. compute 只读取 preview 已分配结果，不重新决定责任归属
2. compute 先求主要模块数量，再派生辅助模块数量
3. 目标速率公式按责任类型区分（derived-build-material vs derived-production）
4. SCC 迭代收敛只看主要模块数量
5. compute 输出静态 `BuildScheme`，不生成 steps
6. Vue 与 analysis script 必须共用同一套计算入口
7. 最终方案分建材产线组与生产产线组，重叠产线归入建材组并合并求解

## 历史偏差说明

- 早期实现中 compute 曾重新按 goals 分配产线，该行为已被修正
- 当前代码 `computeBuildFlowPlan()` 已只读 PreviewResult，不重新分配责任
- 旧的 `computeBuildFlowPlanSchemeGroups()` 已标记 `@deprecated`，内部已改为调用新流程
- 若未来代码再次出现与文档不符的偏差，仍以文档为准

## 已确认方案（审核重点）

### Compute 职责

- compute 只读取 preview 已分配结果
- 对每条产线，先合并其全部责任，再统一求解
- 同一条产线内不允许按责任类型拆成多次计算后再拼接
- 计算顺序：读取全部责任 → 收集建筑集合 → 计算目标速率 → 求主要模块 → 派生辅助模块

### 相关产线定义

- "相关产线"不是运行时再推导的整图可达集合
- 定义为：preview 阶段已经显式挂到该责任上的产线集合
- compute 使用 preview 保存的 `relatedLineGroupIds`

### 目标速率公式

**derived-build-material（建材供给）：**

`目标速率 = 所有相关产线的所有建筑 buildCost 中，对该材料总需求 / 所有相关产线的所有建筑总建造时间`

**derived-production（原料供给）：**

`目标速率 = sum(−netProduction[material] from relatedLines) + sum(targetProduction.ratePerHour for same ware)`

- 同一 ware 同时有 derived-production 与 target-production 时，必须在求解前合并速率
- 不允许使用 per-source Math.max 作为最终目标速率规则

### 主要模块与辅助模块

- 先根据目标速率求主要模块数量
- 再由主要模块派生辅助模块数量
- 辅助模块不是独立收敛变量
- compute 结果必须显式分离 primaryModules / auxiliaryModules / allModules

### SCC / 循环依赖

- 若依赖图中存在 SCC，compute 必须迭代求解
- 每轮基于当前结果重算主要模块数量
- 收敛判据只看主要模块数量
- 当相关产线的主要模块数量不再变化时，视为稳定
- 辅助模块由主要模块派生，不作为单独收敛判据

### 分组与重叠产线

- 最终 scheme 分两组：建材产线组、生产产线组
- 重叠产线（同一 groupId 同时出现在依赖图和责任分配中）：
  - 只能出现一次，必须归入建材产线组
  - 建材责任与生产责任必须合并求解
- 建造顺序：先建材产线，后生产产线，组内按依赖拓扑序

### BuildScheme 真相层字段

- `BuildScheme` 保留默认静态真相层语义
- `BuildScheme` 输出：
  - `modules`
  - `totalDuration`
  - `totalCredits`
  - `moduleSummaries`
- `moduleSummaries` 已排序：模块按 tier 升序 + name 升序，材料按 totalCredits 降序
- compute 不生成 steps；steps 的完整方案由 `build-plan-steps` 独立文档定义

### Energy Cells 口径

- compute 输出的静态材料展示与成本统计必须纳入 `energycells`
- `energycells` 仅在"循环建材产线寻找"语义下保留特殊处理

### 单一共享入口

- Vue 与 analysis script 必须共用同一套 preview / compute 核心计算入口
- 禁止 Vue 内部重新推导分组、analysis script 复制 store 逻辑

### Build-plan 真相层独立 Store

- build-plan 真相层状态由 `useBuildPlanStore` 承载
- `useBlueprintProductionStore` 保留 empire / station planning / save-load 职责
- 不再承担 build-plan 真相层

## 边界

### In Scope

- 统一 compute 职责边界
- 目标速率公式
- SCC 迭代与收敛判据
- 主要模块 / 辅助模块求解
- 分组与重叠产线
- BuildScheme 静态输出与 `moduleSummaries`
- Energy Cells 静态口径
- 单一共享入口
- Build Plan Store 拆分

### Out of Scope

- Steps 详细算法、steps mode 交互、steps 视图模型细节
- Preview 责任分配
- 修改 build-flow 数据模型
- 修改 build-flow 连线编辑交互
- 编写测试代码

## 验收标准（DoD）

1. compute 与 preview 职责边界明确
2. compute 不重新决定责任归属
3. 文档明确三类责任在单条产线内必须合并满足
4. 目标速率公式按责任类型区分
5. SCC 收敛只看主要模块数量
6. 重叠产线归入建材组且合并求解
7. compute 文档明确只输出静态 `BuildScheme`，不生成 steps
8. BuildScheme 包含 `moduleSummaries`（已排序）
9. 静态材料展示与成本统计纳入 `energycells`
10. Vue 与 analysis script 共用同一计算入口
11. `build-plan-compute` 与 `build-plan-steps` 之间不存在重复承载完整 steps 方案的冲突
12. `npm run build` 通过

## 未决项

无
