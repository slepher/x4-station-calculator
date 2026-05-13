# build-plan-steps 设计

## 目标

为 build-plan 的 steps 建立独立且完整的方案文档，使 steps 脱离 compute 主文档，成为只服务详情弹窗的局部视图能力，并覆盖新的建材 greedy 增量规则。

## 问题

当前 steps 文档和相关变更说明存在三类混乱：

1. steps 边界混乱：`build-plan-compute` 与 `build-plan-steps` 同时描述 steps，职责重复。
2. steps 算法混乱：旧文档仍假设复用 `makeSchemeSteps()`，而该算法本质是静态展开，不符合新的 greedy 建材步骤语义。
3. steps 适用范围混乱：旧文档默认所有 scheme 都可切到 steps 模式，没有体现“仅建材方案适用”的新限制。

因此，这次文档重写需要同时解决“归属单一化”和“方案更新”两个问题。

## 方案

### 1. 文档边界重构

重构后的职责如下：

```text
build-plan-compute
  -> preview / compute 真相层
  -> 主要模块 / 辅助模块求解
  -> BuildScheme 静态输出
  -> 与 steps 的边界说明

build-plan-steps
  -> 详情弹窗 steps mode 的唯一完整来源
  -> steps 适用范围
  -> steps 算法
  -> steps 视图模型
  -> steps 交互与异常口径
```

要求：

1. `build-plan-compute` 不再承担 steps 算法和视图细节。
2. `build-plan-steps` 必须足够完整，单独可读。

### 2. 总体数据流

```text
用户点击“计算建造方案”
  -> compute
     -> 求解 modules
     -> 计算 totalDuration
     -> 计算 totalCredits
     -> 生成 moduleSummaries
     -> 返回 BuildScheme（无 steps）

用户打开详情弹窗
  -> 默认展示 moduleSummaries

用户切换到 steps mode
  -> 判定当前 scheme 是否为建材方案
  -> 若不是建材方案：不提供 steps mode
  -> 若是建材方案：
     -> 弹窗局部计算 BuildStepsScheme
     -> 先执行 greedy satisfaction 主循环
     -> 每轮回放主建筑 + autoFill diff
     -> 再按剩余主模块种类执行 ordered tail-fill
     -> 渲染纯 step 列表
```

### 3. steps mode 适用范围

steps mode 不是通用的 scheme 视图，而是建材方案专用视图。

#### 3.1 允许进入的场景

- 当前 scheme 属于建材产线组
- 当前 scheme 对应建材责任求解结果

#### 3.2 不允许进入的场景

- 当前 scheme 属于生产产线组
- 当前 scheme 没有建材目标 rate 语义
- 当前 scheme 模块为空

UI 约束：

1. 非建材 scheme 不显示 steps 开关。
2. 空模块 scheme 不显示 steps 开关。

### 4. 数据模型

#### 4.1 BuildScheme

`BuildScheme` 继续作为 compute 的静态真相层：

```ts
interface BuildScheme {
  label: string
  description: string
  modules: SavedModule[]
  totalDuration: number
  totalCredits: number
  moduleSummaries: BuildSchemeModuleSummary[]
}
```

#### 4.2 BuildStepsScheme

steps 使用独立视图模型：

```ts
interface BuildStepsScheme {
  baseScheme: BuildScheme
  steps: BuildSchemeStep[]
  stepsCount: number
  stepsTotalCredits: number
}
```

约束：

1. `BuildStepsScheme` 只存在于 Vue / presenter 层。
2. 不进入 store 真相层类型定义。
3. 不回写 `useBuildPlanStore`、`buildPlan`、`computeResult`、`schemeGroups`。

### 5. greedy satisfaction 主循环

#### 5.1 目标

steps mode 要表达“建材产线如何一步一步长出来”，而不是“最终模块如何按静态顺序展开”。

#### 5.2 输入语义

steps greedy 主循环需要的最小输入：

1. 当前建材 scheme 的目标建材 rates
2. 当前建材 scheme 的最终 `BuildScheme.modules`
3. 当前建材 scheme 的 isolated ware 集合
4. 模块生产能力、建造耗时、建造材料

重点：

1. 目标比较集合只包含建材目标 ware。
2. 不混入生产责任、自消费扩张目标或其他非建材语义。

#### 5.3 主循环规则

```text
built = []

loop:
  1. 用 built 计算当前净产能
  2. 对每个目标建材计算 satisfaction = currentNet / targetRate
  3. 找出 satisfaction 最低的建材
  4. 为该建材选择最佳 producer
  5. 增加 1 个主建筑
  6. 基于当前主建筑集合运行 autoFill
  7. 计算本轮主建筑 + autoFill diff
  8. 记录一步
  9. 若所有目标建材都满足 -> break
```

补充约束：

1. 每轮 `autoFill` 必须与正式 compute 共享 isolated ware 约束。
2. 若某个 ware 被 isolated，steps 中的 `autoFill` 不得自动补该 ware 的上游建筑。

#### 5.4 必须排除的旧行为

新算法不允许继续沿用以下旧 `greedyFill` 语义：

1. `built.length === 0` 时强制 `hullparts` 起步。
2. 用 per-source `Math.max` 合并目标速率。
3. 在瓶颈选择中把 `selfDemand` 与建材目标并列混算。
4. 让 greedy step 的主语义依赖本轮 autoFill 增量。

### 6. 尾部补齐阶段

greedy 主循环结束时，不保证已经把最终 scheme 的所有建筑都逐步选完。

因此需要单独的 tail-fill 阶段：

```text
greedy done
  -> compare(final scheme.modules, built)
  -> find remaining primary modules
  -> for each remaining primary module type:
       add remaining primary count
       run autoFill again
       append primary + autoFill diff as one tail-fill batch
  -> if support-only modules still remain:
       append support fallback steps
```

约束：

1. tail-fill 的第一优先级是“最终 scheme 仍需要，但 greedy 主循环未显式补入”的主模块。
2. tail-fill 必须按主模块种类分批执行，而不是把剩余模块一次性平铺到末尾。
3. 每个 tail-fill batch 都要重新跑一次 `autoFill diff`，保持与 greedy 主循环一致的增量语义。
4. tail-fill 步骤要和 greedy 步骤在 reason 语义上区分开。
5. tail-fill 仍然只属于 steps 视图层，不反向影响 compute 真相层。


### 7. 默认模式与 steps mode 的关系

#### 7.1 默认模式

- 主体：模块汇总手风琴
- 状态栏：总耗时 + 总花费
- 不显示步骤数
- 使用静态汇总口径

#### 7.2 steps mode

- 主体：纯 step 列表
- 状态栏：总耗时 + 总花费 + 步骤数
- 总耗时沿用 `BuildScheme.totalDuration`
- 总花费使用 steps 累计口径

### 8. steps 懒计算与缓存

#### 8.1 触发

- 弹窗打开时不计算
- 用户切换到 steps mode 时才计算

#### 8.2 局部状态

- 计算期间显示弹窗局部 loading
- 同一弹窗会话内可复用结果
- 当 `scheme.modules` 变化时缓存失效
- 关闭弹窗后局部结果释放

### 9. Energy Cells 口径

`energycells` 的处理分成两层：

1. greedy 选材语义层：
   - 允许在建材瓶颈搜索中保留特殊处理
2. steps 展示与成本层：
   - 必须纳入材料展示
   - 必须纳入 step 成本统计
   - 必须纳入 stepsTotalCredits

### 10. 异常兜底

若当前 scheme 不满足 steps mode 前提：

1. 模块为空
2. 非建材 scheme
3. 缺少合法的建材目标输入

则：

1. 不进入正常 steps mode
2. 不显示 steps 开关或直接停留在默认模式
3. 不将异常兜底行为写回真相层

## 影响面

本 change 的文档影响面：

1. `openspec/changes/build-plan-steps/*`
2. `openspec/changes/build-plan-compute/*`

运行时实现影响面仅作为后续 apply 参考，不在本次文档改动中展开。
