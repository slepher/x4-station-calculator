# build-plan-steps 需求

## 目标

重写 build-plan 的 steps 方案文档，并将 steps 相关规则从 build-plan-compute 中独立出来，形成唯一完整来源：

1. steps 只作为详情弹窗中的按需视图，不属于 compute 真相层输出。
2. steps mode 仅适用于建材产线方案，不适用于生产产线方案。
3. steps mode 使用基于建材满足度的 greedy 增量算法，而不是旧的静态模块展开规则。
4. 所有 steps 的边界、算法、视图模型、交互和异常口径统一在本 change 中描述。

## 当前实现提醒

- 当前仓库中的 `build-plan-steps` 文档仍保留“继续复用 `makeSchemeSteps()`”的旧方案。
- 当前 `build-plan-compute` 文档中仍混有 steps 视图、steps 算法、steps 任务等细节。
- 这次修改后，凡是关于 steps 的完整方案，应以 `build-plan-steps` 文档为唯一准绳。
- `build-plan-compute` 只保留 compute 与 steps 的边界描述，不再承载 steps 详细方案。

## 已确认方案（审核重点）

### steps 的归属边界

- 默认 `compute` 阶段不生成 steps。
- 默认 `compute` 仍负责：
  - 求解 `scheme.modules`
  - 计算静态 `totalDuration`
  - 计算静态 `totalCredits`
  - 生成 `moduleSummaries`
- steps 只在详情弹窗内按需懒计算。
- steps 结果不得回写 `useBuildPlanStore`、`buildPlan`、`computeResult`、`schemeGroups` 等真相层数据。

### steps mode 适用范围

- steps mode 仅适用于建材产线方案。
- 生产产线方案不进入该 steps mode。
- 当当前 scheme 不属于建材方案时，详情弹窗不显示 steps 开关。

### steps mode 的核心算法

- steps mode 不再采用“按最终 `scheme.modules` 排序后逐个拆分”的旧静态展开语义。
- steps mode 改为类似旧 `greedyFill` 的增量建造语义：
  - 从空 built 状态开始
  - 根据建材目标 `rate` 计算每种建材当前满足度
  - 找出满足度最低的建材
  - 为该建材增加 1 个最佳生产建筑
  - 重新计算满足度
  - 循环往复，直到建材目标满足
- 满足度主循环结束后，再一次性补齐 greedy 主循环未显式补入、但最终 scheme 仍需要的建筑。

### steps mode 的满足度口径

- 只在“建材目标 ware 集合”内比较满足度。
- 满足度定义为：
  - `当前净产能 / 目标 rate`
- 只比较 steps 所属建材 scheme 的目标建材，不混入生产责任、自消费扩张或其他非建材目标。
- 不允许保留旧算法中的：
  - `hullparts` 硬编码起步规则
  - per-source `Math.max`
  - 将 `selfDemand` 与建材目标混在同一轮瓶颈选择中

### steps mode 的步骤语义

- greedy 主循环中的每一步，语义是“为当前最低满足度建材新增 1 个主建筑”。
- greedy 主循环不以“本轮 autoFill 增量”作为 steps 的核心语义。
- 主循环完成后，尾部补齐阶段需要单独标明这是“最终方案补齐”，而不是“满足度驱动选择”。

### 默认详情模式

- 详情弹窗默认展示模块汇总手风琴。
- 默认模式下状态栏显示：
  - `总耗时`
  - `总花费`
- 默认模式不显示 `步骤数`。
- 默认模式继续使用静态汇总口径，不考虑库存抵扣与建造期间自产。

### steps mode 视图

- steps 开关位于详情弹窗状态栏区域。
- 打开后切换为纯 steps 列表视图。
- steps 模式状态栏显示：
  - `总耗时`
  - `总花费`
  - `步骤数`
- steps 模式总耗时与默认模式保持一致。
- steps 模式总花费使用 step 累计口径。

### steps 数据载体

- steps 模式使用独立的 `BuildStepsScheme` 视图模型。
- `BuildStepsScheme` 至少承载：
  - `baseScheme`
  - `steps`
  - `stepsCount`
  - `stepsTotalCredits`
- 如需区分 greedy 步骤与尾部补齐步骤，可在 steps 项内增加明确 reason / source 字段，但仍然只属于 Vue / presenter 层。

### Energy Cells 口径

- `energycells` 必须纳入 steps 模式材料展示与成本统计。
- `energycells` 仅允许在“建材瓶颈搜索 / greedy 选材”语义下保留特殊处理。
- 不得再从 step 明细或 step 总成本中排除 `energycells`。

### 文档归属调整

- build-plan-steps：
  - 负责完整描述 steps 的边界、算法、视图、数据归属、交互和异常规则。
- build-plan-compute：
  - 只负责描述 compute 不生成 steps、compute 输出哪些静态字段，以及 compute 与 steps 的边界。

## 边界

### In Scope

- 重写 `build-plan-steps` 的 `request.md` / `design.md` / `spec.md` / `tasks.md`
- 将 steps 方案从 `build-plan-compute` 文档中迁出
- 补充 steps mode 仅适用于建材方案的规则
- 补充基于 greedy satisfaction 的新 steps 算法方案
- 补充“主循环结束后一次性补齐剩余建筑”的规则
- 同步 steps 的数据归属、视图模型、交互与异常口径

### Out of Scope

- 修改 preview 责任分配
- 修改 compute 主模块 / 辅助模块求解
- 修改 build-flow 图结构
- 编写测试代码
- 运行测试
- 修改运行时代码

## 验收标准（DoD）

1. `build-plan-steps` 文档能够单独完整描述 steps 方案，不依赖 `build-plan-compute` 的细节补充。
2. `build-plan-compute` 文档不再承载 steps 算法、steps 视图、steps 任务的完整方案。
3. 文档明确 steps mode 仅适用于建材产线方案。
4. 文档明确 steps mode 使用 greedy satisfaction 主循环，而不是旧的静态 `makeSchemeSteps()` 展开语义。
5. 文档明确 greedy 主循环结束后需要一次性补齐剩余建筑。
6. 文档明确 steps 结果只存在于弹窗局部视图层，不回写 store 真相层。
7. 文档明确 `energycells` 纳入 steps 材料展示与成本统计。
8. `request.md` / `design.md` / `spec.md` / `tasks.md` 之间不存在关于 steps 适用范围、算法归属和数据边界的冲突描述。

## 未决项

无
