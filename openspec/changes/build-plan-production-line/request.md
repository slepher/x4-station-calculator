# build-plan-production-line 需求

## 目标

统一 `build-plan-production-line` 的职责边界：

1. `preview` 阶段负责**分配产线责任**，不是计算最终模块数。
2. `compute` 阶段负责读取 `preview` 已分配结果，计算每条产线最终需要多少主要模块、多少辅助模块。
3. Vue 展示与 `analysis/scripts/build-plan/build-plan-production-line.ts` 必须基于同一套结果，不允许各自维护不同逻辑。

## 当前实现提醒

- 当前代码实现已知存在 bug 与设计偏差
- 本 change 的需求、设计、验收标准以文档为准
- 审查与修改代码时，不得以当前代码行为反推需求
- 若代码与文档冲突，默认代码错误，需调整代码而非回退文档

## 已确认方案（审核重点）

### 两阶段模型

- `preview` = 责任分配阶段
- `compute` = 模块求解阶段
- `build-flow mode` 是常驻规划上下文，不由 checkbox 控制进入或退出
- checkbox 只控制：是否按建筑材料需求规划建材产线
- 以下变化都会触发 `preview` 重算：
  - 目标模块变动
  - 目标产物变动
  - checkbox 勾选
  - checkbox 取消
- 点击“计算建造方案”时执行 `compute`

### preview 阶段职责

- 决定需要建造哪些产线
- 给每条产线分配责任
- 每条产线可同时承担三类责任，且三类责任在后续计算时必须合并满足：
  - `derived-build-material`
  - `derived-production` / `required-production`
  - `target-production`
- 每条责任必须显式携带“相关产线集合”
- `preview` 同时产出：
  - 责任分配结果
  - 依赖图
  - SCC
- `preview` 不产出：
  - 主要模块数量
  - 辅助模块数量
  - 最终 steps / 费用 / 时间
- checkbox 勾选时，`preview` 结果包含“按建筑材料需求规划建材产线”产生的责任、依赖图与 SCC
- checkbox 取消时，`preview` 结果移除上述建材产线规划结果

### compute 阶段职责

- `compute` 只读取 `preview` 已分配结果，不重新决定责任归属
- 对每条产线，先合并其全部责任，再统一求解
- 同一条产线内不允许按责任类型拆成多次计算后再拼接
- 计算顺序必须是：
  1. 读取该线全部责任
  2. 根据责任挂接到的“相关产线集合”收集建筑集合
  3. 对每个目标材料计算目标速率
  4. 用目标速率求主要模块数量
  5. 由主要模块派生辅助模块数量

### 相关产线定义

- “相关产线”不是运行时再推导的整图可达集合
- “相关产线”定义为：`preview` 阶段已经显式挂到该责任上的产线集合

### 目标速率公式

**derived-build-material（建材供给）** 按如下公式：

`目标速率 = 所有相关产线的所有建筑 buildCost 中，对该材料总需求 / 所有相关产线的所有建筑总建造时间`

**derived-production（原料供给）** 按如下公式：

`目标速率 = sum(−netProduction[material] from relatedLines) + sum(targetProduction.ratePerHour for same ware)`

- 同一 ware 同时有 `derived-production` 与 `target-production` 时，必须在求解前合并速率
- 不允许再使用 per-source `Math.max` 作为最终目标速率规则

### 循环依赖 / SCC

- 若依赖图中存在 SCC / 循环依赖，则 `compute` 必须迭代求解
- 每轮基于当前结果重算主要模块数量
- 收敛判据只看**主要模块数量**
- 当相关产线的主要模块数量不再变化时，视为稳定
- 辅助模块由主要模块派生，不作为单独收敛判据

### 依赖图规则

- 在 `build-flow mode` 中，只要目标模块 / 目标产物变化，或 checkbox 状态变化，就重算依赖图
- checkbox 的作用仅是控制依赖图是否包含“按建筑材料需求规划建材产线”这部分内容
- 依赖图 BFS 需要融入 isolated 扩展
- 新增边方向保持“消费方 → 供给方”
- isolated 扩展搜索产线优先级：
  - manual 节点优先
  - auto 节点兜底
- 若无连线，则忽略，不允许 fallback 到其他来源

### 分组与展示

- 最终 scheme 分两组：
  - 建材产线
  - 生产产线
- 重叠产线（同一 `groupId` 同时出现在依赖图和责任分配中）：
  - 只能出现一次
  - 必须归入建材产线组
  - 其建材责任与生产责任必须合并满足
- 建造顺序：
  - 先建材产线
  - 后生产产线
  - 组内按依赖拓扑序

### 约束面板

- 保留独立“用户目标区”作为唯一可编辑输入区
- 建造目标区不按产线分组，只直接列原始 `buildGoals`
- 用户目标区只显示用户手动添加的 `production-rate` / `build-module`
- 用户目标区仍可修改数量、删除目标
- 勾上“建材产线”后，显示只读预览区
- 预览区展示 `preview` 分配结果
- 预览区不承担原始目标编辑
- `target-production` / `derived-build-material` / `derived-production` / `required-production` 在预览区均显示为 tag
- 预览区不显示数量输入，不允许删除
- 待规划产线（unmatched）不参与建材分组检查

### 一致性要求

- Vue 与 `analysis/scripts/build-plan/build-plan-production-line.ts` 必须共用同一套核心计算入口
- 不允许：
  - script 一套
  - store 一套
  - Vue 再二次拼装一套

### 基于当前代码的改造方向

- 不得继续使用现有 `ProductionLineAllocation.goals` 充当 preview 真相层
- 必须新增显式责任模型，至少能表达：
  - 责任类型
  - 责任来源
  - 责任挂接的相关产线集合
- `compute` 阶段不得再次调用“按 goals 重新分配产线”的逻辑
- 重叠产线不得在 scheme 结果层事后拼接，必须在求解前先合并责任
- SCC 收敛判据不得继续依赖“主模块 + 辅助模块”的合并结果，只能看主要模块

## 边界

### In Scope

- 统一 `preview` / `compute` 职责边界
- 明确责任分配模型与相关产线模型
- 明确目标速率公式
- 明确 SCC 迭代与收敛判据
- 明确依赖图 isolated 扩展规则
- 明确最终分组展示规则
- 明确 Vue / analysis script 共用单一计算入口
- 更新 OpenSpec 文档以反映以上结论

### Out of Scope

- 修改 build-flow 基础数据模型
- 修改 build-flow 连线编辑交互
- checkbox 状态持久化
- SCC 的 UI 特殊标记样式
- 编写测试代码
- 运行测试

## 验收标准（DoD）

1. `preview` 与 `compute` 的职责边界在文档中明确，不再混写
2. 文档明确说明三类责任在单条产线内必须合并满足
3. 文档明确说明“相关产线”来自 `preview` 显式挂接结果
4. 文档明确说明目标速率使用 `总需求 / 总建造时间`
5. 文档明确说明循环依赖只以“主要模块数量稳定”为收敛判据
6. 文档明确说明 Vue 与 analysis script 必须共用同一计算入口
7. 文档明确说明当前代码实现有 bug，需求以文档为准
8. `request.md` / `design.md` / `spec.md` / `tasks.md` 之间不存在互相冲突的旧描述

## 未决项

无
