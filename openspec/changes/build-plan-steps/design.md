# build-plan-steps 设计

## 目标

为 build-plan 详情弹窗建立两层清晰的数据边界：

1. store / compute 只产出默认静态 scheme 结果。
2. Vue 弹窗默认消费静态汇总数据。
3. steps 仅在弹窗中按需生成并以局部视图模型承载。

## 问题

当前 build-plan 详情链路存在以下边界混乱：

1. 默认 compute 阶段直接生成 steps，使 steps 成为默认真相层的一部分。
2. 详情弹窗默认以 steps 作为主体视图，无法在不生成 steps 的前提下稳定展示 scheme 细节。
3. `BuildScheme.totalCredits` 与 steps 累计成本缺乏语义隔离，容易被同一字段混用。
4. `makeSchemeSteps()` 留在核心 compute 模块中，强化了“steps 属于默认 compute”的错误边界。
5. `energycells` 在当前实现与相关说明中被错误排除出部分材料统计与成本统计。

因此，本 change 需要把“默认静态汇总视图”和“按需 steps 视图”拆开。

## 方案

### 1. 总体数据流

```text
用户点击“计算建造方案”
  -> build-plan compute
     -> 求解 modules
     -> 计算静态 totalDuration
     -> 计算静态 totalCredits
     -> 生成 moduleSummaries
     -> 返回 BuildScheme（无 steps）

用户打开 scheme 详情弹窗
  -> 默认展示 BuildScheme.moduleSummaries

用户打开 steps 开关
  -> 弹窗局部 logic 调用 makeSchemeSteps()
  -> 生成 BuildStepsScheme
  -> 切换成纯 steps 列表
```

关键边界：

1. 默认 compute 不生成 steps。
2. steps 懒计算不回写 store。
3. Vue 默认模式与 steps 模式消费不同的数据载体。

### 2. 真相层模型

#### 2.1 BuildScheme

`BuildScheme` 保持默认静态真相层语义，只新增默认详情视图需要的汇总字段。

建议结构：

```ts
interface BuildScheme {
  label: string
  description: string
  modules: SavedModule[]
  totalDuration: number
  totalCredits: number
  moduleSummaries: BuildSchemeModuleSummary[]
  // 其他现有静态字段保持原有职责
}
```

其中：

- `totalDuration` = 静态总建造时长
- `totalCredits` = 静态材料总成本
- `moduleSummaries` = 默认详情视图使用的已排序模块汇总

#### 2.2 Module Summary

```ts
interface BuildSchemeModuleSummary {
  moduleId: string
  moduleCount: number
  totalDuration: number
  totalCredits: number
  materials: BuildSchemeModuleMaterialSummary[]
}

interface BuildSchemeModuleMaterialSummary {
  wareId: string
  quantity: number
  totalCredits: number
  unitPrice: number
}
```

约束：

1. `moduleSummaries` 由 compute 直接生成。
2. `moduleSummaries` 已排序，Vue 不再二次排序。
3. 每个模块项的 `materials` 也必须已排序。

### 3. Vue 专用 steps 视图模型

#### 3.1 BuildStepsScheme

steps 不进入 store 真相层，改为 Vue / presenter 侧局部模型。

建议结构：

```ts
interface BuildStepsScheme {
  baseScheme: BuildScheme
  steps: BuildSchemeStep[]
  stepsCount: number
  stepsTotalCredits: number
}
```

约束：

1. `BuildStepsScheme` 只存在于 Vue / presenter 范围。
2. 不放入 `src/types/build-plan.ts` 这类 store 真相层类型文件。
3. 不回写 `useBuildPlanStore`、`buildPlan`、`schemeGroups`。

#### 3.2 BuildStepsScheme 与 BuildScheme 的关系

- 默认模式：直接使用 `BuildScheme`
- steps 模式：使用 `BuildStepsScheme.baseScheme` + `steps` 派生字段

这样可以避免两套完整 scheme 结构并行漂移。

### 4. 默认模式详情视图

默认模式仍采用手风琴交互，但语义改为“模块汇总项”。

#### 4.1 状态栏

- 显示 `总耗时`
- 显示 `总花费`
- 不显示 `步骤数`

#### 4.2 手风琴头部字段

- 模块名称
- 数量
- 总耗时
- 总花费

#### 4.3 展开区字段

- 材料名称
- 总数量
- 总花费
- 单价

### 5. steps 模式详情视图

steps 模式不混用默认模式主体，直接切换为纯 steps 列表。

#### 5.1 状态栏

- `总耗时`：沿用 `BuildScheme.totalDuration`
- `总花费`：显示 `BuildStepsScheme.stepsTotalCredits`
- `步骤数`：显示 `BuildStepsScheme.stepsCount`

#### 5.2 主体

- 保留现有 step 列表视图样式
- 不再显示默认模式的模块汇总主体

### 6. 静态汇总口径

#### 6.1 时长

- `BuildScheme.totalDuration` = `sum(module.buildTime × count)`
- `moduleSummary.totalDuration` = 当前模块总建造时长

总时长在默认模式与 steps 模式必须一致。

#### 6.2 花费

默认模式花费全部按静态材料总成本：

```text
module totalCredits = sum(buildCost[ware] × moduleCount × ware.price)
scheme totalCredits = sum(all module totalCredits)
material totalCredits = quantity × unitPrice
```

默认模式不考虑：

- 库存抵扣
- 建造期间自产
- steps 顺序

#### 6.3 排序

模块排序：

1. `tier` 升序
2. `module.name` 升序

材料排序：

1. `totalCredits` 降序

### 7. steps 懒计算

#### 7.1 触发方式

- 详情弹窗打开时不计算
- 用户打开 `steps` 开关时才计算
- 计算期间显示弹窗局部 loading

#### 7.2 缓存与失效

- 同一弹窗会话内可复用计算结果
- 当 `scheme.modules` 变化时，局部缓存失效
- 关闭弹窗后结果自然释放

### 8. makeSchemeSteps 的归属调整

当前 `makeSchemeSteps()` 属于旧边界的一部分，需要迁出默认 compute 核心模块。

调整后边界：

```text
store core compute
  -> 生成 BuildScheme
  -> 不依赖 makeSchemeSteps

vue/presenter local logic
  -> 引用 makeSchemeSteps
  -> 生成 BuildStepsScheme
```

约束：

1. 继续复用同一套 `makeSchemeSteps()` 算法。
2. 不允许再写第二套 steps 生成逻辑。
3. 该函数迁移后只能被详情弹窗 steps 计算链路依赖。

### 9. Energy Cells 口径修正

`energycells` 只允许在“循环建材产线寻找”语义下作为特殊项；不得再从材料展示和成本统计中剔除。

需要统一修正以下口径：

1. `moduleSummaries.materials` 纳入 `energycells`
2. 静态 `totalCredits` 纳入 `energycells`
3. steps 明细纳入 `energycells`
4. steps 累计花费纳入 `energycells`

### 10. 异常兜底

若出现意外情况导致当前 scheme 模块为空：

1. 详情弹窗直接显示空模板
2. 不显示 steps 开关
3. 该行为仅用于异常兜底，不改变正常流程定义

## 影响面

本 change 只调整以下层次：

1. build-plan compute 输出结构
2. build-plan 详情弹窗 presenter / local logic
3. steps 生成函数的模块归属
4. 相关 OpenSpec 文档

不影响：

1. preview 责任分配
2. compute 主模块 / 辅助模块求解
3. build-flow graph / SCC 主算法
