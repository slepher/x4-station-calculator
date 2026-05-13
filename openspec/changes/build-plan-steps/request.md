# build-plan-steps 需求

## 目标

调整 `build-plan` 中 steps 的职责边界与详情弹窗展示：

1. 默认 `compute` 阶段不再生成 steps。
2. 建造方案详情弹窗默认展示“模块汇总手风琴”，只在用户打开开关后按需计算并展示 steps。
3. 默认静态汇总结果与按需 steps 结果必须分层存储，steps 结果不得回写 store 真相层。

## 当前实现提醒

- 当前仓库中的 build-plan 详情弹窗仍默认依赖 compute 产出的 `steps`。
- 当前与 steps 相关的文档和实现中，仍存在“compute 阶段最后生成 steps”的旧描述。
- 本 change 的需求、设计、验收标准以本文档为准。
- 若当前代码或旧文档与本文档冲突，默认按本文档修正。

## 已确认方案（审核重点）

### compute 与 steps 的职责边界

- 默认 `compute` 阶段跳过 steps 生成。
- 默认 `compute` 仍然负责：
  - 求解 `scheme.modules`
  - 计算静态 `totalDuration`
  - 计算静态 `totalCredits`
  - 生成默认详情视图所需的 `moduleSummaries`
- steps 不再属于默认 compute 真相层输出。
- steps 改为详情弹窗中针对当前 scheme 的按需懒计算结果。

### 默认详情弹窗模式

- 详情弹窗打开时，`steps` 开关默认关闭。
- 开关关闭时，弹窗保持现有手风琴风格，但每项语义改为“同种模块汇总项”，不再显示逐 step 列表。
- 弹窗标题继续保持方案级标题，不改成模块名称。
- 状态栏在默认模式下只显示：
  - `总耗时`
  - `总花费`
- 默认模式下不显示 `步骤数`。

### 默认模式手风琴内容

- 默认模式下，每个手风琴项代表一种模块汇总。
- 手风琴头部显示：
  - 模块名称
  - 数量
  - 总耗时
  - 总花费
- 展开后显示材料汇总明细：
  - 材料名称
  - 总数量
  - 总花费
  - 单价

### 默认模式的计算口径

- 默认模式总耗时与模块项耗时均按静态汇总公式计算：
  - `sum(module.buildTime × count)`
- 默认模式总花费与模块项花费均按静态材料总成本计算：
  - `sum(buildCost[ware] × count × ware.price)`
- 默认模式材料明细也按静态总量聚合：
  - 材料数量 = `buildCost[ware] × count`
  - 材料总花费 = `材料数量 × 单价`
- 默认模式不考虑库存抵扣与建造期间自产。

### 默认模式排序规则

- `moduleSummaries` 必须由 compute 直接产出已排序结果。
- 模块排序规则：
  - 先按 `tier` 从小到大
  - 同 tier 按 `module.name` 从小到大
- 材料明细排序规则：
  - 按材料总花费从高到低

### steps 开关与 steps 模式

- `steps` 开关位于详情弹窗标题栏下方的状态栏区域。
- 开关打开后，弹窗主体切换为纯 step 列表视图，不保留默认模式下的模块汇总手风琴主体。
- steps 模式下状态栏显示：
  - `总耗时`
  - `总花费`
  - `步骤数`
- steps 模式总耗时与默认模式保持一致。
- steps 模式总花费允许与默认模式不同，显示 step 累计口径。

### steps 数据边界

- steps 结果只服务当前弹窗中的当前 scheme。
- steps 结果不得回写 `useBuildPlanStore`、`buildPlan`、`schemeGroups` 等 store 真相层数据。
- 默认静态 `BuildScheme.totalCredits` 不得被 steps 结果覆盖。
- steps 模式需要单独字段承载自己的总花费。

### Vue 侧专用类型

- 新增 Vue / presenter 侧专用类型 `BuildStepsScheme`。
- `BuildStepsScheme` 以 `BuildScheme` 为基础引用 / 组合。
- `BuildStepsScheme` 至少承载：
  - `baseScheme`
  - `steps`
  - `stepsCount`
  - `stepsTotalCredits`
- `BuildStepsScheme` 仅在 Vue / presenter 范围内存在，不进入 store 真相层类型定义。

### BuildScheme 真相层字段

- `BuildScheme` 保留默认静态真相层语义。
- `BuildScheme` 需要新增正式字段 `moduleSummaries`，用于默认详情视图。
- `BuildScheme` 不新增 `stepsTotalDuration`。
- `BuildScheme.totalDuration` 继续作为唯一总时长字段。

### steps 核心算法与代码归属

- steps 模式必须复用现有 `makeSchemeSteps()` 核心算法，不允许再写第二套 step 算法。
- 但 `makeSchemeSteps()` 不应继续留在默认 compute 核心模块中。
- 该函数需要从当前核心 build-plan compute 模块迁出，放到只被详情弹窗 steps 懒计算使用的局部 logic 模块。

### Energy Cells 口径

- `energycells` 不再被排除在材料展示和成本统计之外。
- 默认模式材料明细与成本统计必须纳入 `energycells`。
- steps 模式 step 明细与 step 总成本也必须纳入 `energycells`。
- 若当前实现仅将 `energycells` 作为“产线寻找特殊项”之外，还错误排除了材料统计，则需修正该实现偏差。

### 交互与异常场景

- steps 开关打开后，如当前 scheme 尚未计算 steps，弹窗显示局部 loading，不影响全局 loading。
- 同一弹窗会话内可复用已算出的 steps 结果。
- 若当前弹窗对应的 `scheme.modules` 发生变化，已缓存的 steps 结果必须失效。
- 若出现异常情况导致模块为空，则弹窗直接展示空模板，不显示 steps 开关；该场景仅作为意外兜底展示，不作为正常流程。

## 边界

### In Scope

- 移除默认 compute 阶段的 steps 生成职责
- 为 `BuildScheme` 新增默认详情视图所需的 `moduleSummaries`
- 明确默认模式与 steps 模式的显示字段、排序、成本和时长口径
- 新增 Vue / presenter 层专用 `BuildStepsScheme`
- 将 steps 懒计算限制在详情弹窗局部
- 调整 `makeSchemeSteps()` 的代码归属
- 修正 `energycells` 在材料统计与成本统计中的口径
- 更新相关 OpenSpec 文档以反映以上结论

### Out of Scope

- 修改 build-plan preview / responsibility / SCC 主算法
- 修改 build-flow 交互模型
- 编写测试代码
- 运行测试
- 变更弹窗整体视觉风格
- 持久化详情弹窗的 steps 开关状态

## 验收标准（DoD）

1. 文档明确说明默认 `compute` 跳过 steps 生成。
2. 文档明确说明 `BuildScheme` 默认输出仍包含静态总耗时、静态总花费和 `moduleSummaries`。
3. 文档明确说明详情弹窗默认显示模块汇总手风琴，打开开关后切换为纯 step 列表。
4. 文档明确说明默认模式状态栏不显示 `步骤数`，steps 模式才显示 `步骤数`。
5. 文档明确说明默认模式总花费使用静态材料总成本，steps 模式总花费使用 step 累计口径。
6. 文档明确说明 steps 结果只存在于 Vue / presenter 层，不回写 store 真相层。
7. 文档明确说明新增 `BuildStepsScheme`，并且该类型不进入 store 真相层类型定义。
8. 文档明确说明 `moduleSummaries` 由 compute 直接产出已排序结果。
9. 文档明确说明 `energycells` 必须纳入材料展示和成本统计。
10. `request.md` / `design.md` / `spec.md` / `tasks.md` 之间不存在关于 steps 生成时机和数据边界的旧冲突描述。

## 未决项

无
