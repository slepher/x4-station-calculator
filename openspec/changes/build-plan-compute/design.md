# build-plan-compute 设计

## 目标

为 build-plan compute 建立单一、稳定的数据流：compute 只读取 preview 结果并求解主要模块 / 辅助模块；默认 compute 不生成 steps；Vue 与 analysis script 只消费共享结果。

## 领域术语

| 术语 | 含义 |
|------|------|
| compute | 用户点击"计算建造方案"后执行的模块求解阶段 |
| 主要模块 | 用于满足目标产率的核心生产模块 |
| 辅助模块 | 由主要模块派生出的配套模块（habitation、autoIndustry 等） |
| PrimaryModuleSnapshot | SCC 迭代中用于比较稳定性的主要模块快照 |
| derived-build-material | 为其他建筑/产线提供建材的 preview 责任 |
| derived-production | 为其他产线提供产物的 preview 责任 |
| target-production | 用户目标在 preview 中的只读责任表示 |
| relatedLineGroupIds | preview 阶段已显式挂到某条责任上的产线集合 |
| 重叠产线 | 同一 groupId 同时出现在依赖图和责任分配中的产线 |
| 稳定 | 迭代中主要模块数量不再变化 |
| BuildScheme | compute 产出的默认静态方案真相层 |
| moduleSummaries | BuildScheme 中用于默认详情视图的模块汇总 |
| BuildStepsScheme | Vue/presenter 侧专用 steps 视图模型，不进入 store 真相层 |
| effectiveBuildTime | max(实际总花费, 设定buildTime)，用于 Fleet 派生 rate |
| 无规划 preview | `logicFlowPlanId = null` 时生成的 preview；lines 存在，但 `graph = null` |

## 问题

当前 build-plan compute 存在以下偏差：

1. compute 会重新按 goals 分配产线，而不是读取 preview 结果
2. 目标速率主要围绕 graph edge / demandSource 聚合，不是围绕"责任 → 相关产线集合 → 建筑集合"
3. 重叠产线在 scheme 层事后合并，而不是在求解前先合并责任
4. SCC 收敛看的是 `node.modules`（含辅助模块），不符合需求
5. 默认 compute 直接生成 steps，使 steps 成为默认真相层的一部分
6. `energycells` 被错误排除出部分材料统计与成本统计
7. analysis script 与 Vue 存在各自维护不同逻辑的风险

## 方案

### 1. 总体数据流

```text
用户点击"计算建造方案"
  → useBuildPlanStore.compute
    → 读取 previewResult
    → 合并单线责任
    → 基于相关产线集合求目标速率
    → 计算主要模块
    → 派生辅助模块
    → 若存在 SCC 则迭代直到主要模块稳定
    → 输出 BuildScheme（含 moduleSummaries，无 steps）
    → 分组为 BuildSchemeGroup[]

用户打开 scheme 详情弹窗
  → 默认展示 BuildScheme.moduleSummaries

用户打开 steps 开关
  → 弹窗局部 logic 调用 makeSchemeSteps()
  → 生成 BuildStepsScheme
  → 切换成纯 steps 列表
```

### 2. Compute 输入/输出契约

```typescript
interface ComputeInput {
  preview: PreviewResult
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  settings: StationSettings
}

interface ComputeResult {
  lines: ComputeLineResult[]
  schemeGroups: BuildSchemeGroup[]
}

interface ComputeLineResult {
  groupId?: string
  groupName: string
  mergedResponsibilities: PreviewResponsibility[]
  relatedLineGroupIds: string[]
  targetRates: Record<string, number>
  primaryModules: SavedModule[]
  auxiliaryModules: SavedModule[]
  allModules: SavedModule[]
}
```

约束：
1. ComputeInput 不再直接接收裸 goals
2. ComputeResult 必须显式分离 primaryModules / auxiliaryModules / allModules
3. BuildSchemeGroup 只是最终展示视图，不是求解真相层
4. 当 `preview.graph = null` 时，compute 仍需对 preview.lines 求解，分组退化为 production schemes

### 3. 单线求解模型

```text
该线全部责任
  → 合并责任
  → 取责任挂接到的相关产线集合
  → 收集这些相关产线的全部建筑
  → 对每个材料计算目标速率
  → 解主要模块
  → 派生辅助模块
```

### 4. 目标速率公式

#### 4.1 derived-build-material（建材供给）

```text
targetRate(material) =
   所有相关产线的所有建筑 buildCost 中，该材料总需求
   /
   所有相关产线的所有建筑总建造时间
```

需求维度：`module.buildCost[material] × module.count` 累加
时间维度：`module.buildTime × module.count` 累加

#### 4.2 derived-production（原料供给）

```text
targetRate(material) =
   sum(−netProduction[material] of all relatedLines)
   +
   sum(targetProduction.ratePerHour for this ware on this line)
```

需求维度：相关产线的模块运行时净消耗
与建造时间无关

#### 4.3 推荐函数边界

```ts
function mergeLineResponsibilities(line: PreviewLinePlan): PreviewResponsibility[]
function collectBuildingsForResponsibilities(responsibilities: PreviewResponsibility[], preview: PreviewResult): SavedModule[]
function computeTargetRatesFromBuildings(buildings: SavedModule[], modulesMap: Record<string, X4Module>): Record<string, number>
```

禁止旧规则：
1. per-source Math.max
2. 不分责任类型，统一用 sum(qty)/sum(time)
3. 只看本线建筑，不看责任挂接的相关产线集合

### 5. SCC / 循环依赖求解

#### 5.1 何时需要迭代

当 preview 依赖图存在 SCC 时，compute 不能单轮结束。

#### 5.2 迭代过程

```text
loop:
  1. 基于当前状态重算 SCC 内各线目标速率
  2. 重算各线主要模块数量
  3. 若主要模块数量与上一轮完全一致 → stable → break
```

#### 5.3 收敛判据

只看主要模块数量：

```text
primary modules unchanged → stable
```

PrimaryModuleSnapshot 建议：

```ts
type PrimaryModuleSnapshot = Map<string, string>
// key = lineGroupId
// value = "module_id:count;module_id:count"
```

要求：
1. 快照只包含主要模块
2. 不包含 autoFill / habitation / auxiliary 模块
3. SCC 迭代中比较 PrimaryModuleSnapshot 是否变化

### 6. 分组与重叠产线

最终输出分两组：

1. 建材产线组
2. 生产产线组

重叠产线规则：

1. 相同 groupId 只允许出现一次
2. 必须归入建材产线组
3. 其建材责任与生产责任必须合并求解
4. 不允许先分别求解两份 scheme 再在结果层事后拼接

构建顺序：

1. 先建材产线
2. 再生产产线
3. 组内按依赖拓扑序

### 7. BuildScheme 真相层

```typescript
interface BuildScheme {
  label: string
  description: string
  modules: SavedModule[]
  totalDuration: number
  totalCredits: number
  moduleSummaries: BuildSchemeModuleSummary[]
  // 其他现有静态字段保持原有职责
}

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
1. moduleSummaries 由 compute 直接生成，已排序
2. 模块排序：tier 升序 → module.name 升序
3. 材料排序：totalCredits 降序
4. Vue 不再二次排序

### 8. 默认模式详情视图

#### 8.1 状态栏

- 显示总耗时、总花费
- 不显示步骤数

#### 8.2 手风琴头部

- 模块名称、数量、总耗时、总花费

#### 8.3 展开区

- 材料名称、总数量、总花费、单价

#### 8.4 静态汇总口径

- totalDuration = `sum(module.buildTime × count)`
- totalCredits = `sum(buildCost[ware] × count × ware.price)`
- 材料数量 = `buildCost[ware] × count`
- 不考虑库存抵扣与建造期间自产

### 9. BuildStepsScheme 视图模型

```typescript
interface BuildStepsScheme {
  baseScheme: BuildScheme
  steps: BuildSchemeStep[]
  stepsCount: number
  stepsTotalCredits: number
}
```

约束：
1. BuildStepsScheme 只存在于 Vue / presenter 范围
2. 不放入 store 真相层类型定义
3. 不回写 useBuildPlanStore / buildPlan / schemeGroups
4. 不覆盖 BuildScheme.totalCredits

### 10. Steps 懒计算

- 详情弹窗打开时不计算 steps
- 用户打开 steps 开关时才计算
- 计算期间显示弹窗局部 loading
- 同一弹窗会话内可复用计算结果
- 当 scheme.modules 变化时局部缓存失效
- makeSchemeSteps() 从默认 compute 核心模块迁出，放到详情弹窗 steps 懒计算使用的局部 logic 模块
- 继续复用同一套 makeSchemeSteps() 算法，不允许再写第二套

### 11. Energy Cells 口径修正

energycells 只允许在"循环建材产线寻找"语义下作为特殊项；不得再从材料展示和成本统计中剔除。

需要统一修正：
1. moduleSummaries.materials 纳入 energycells
2. 静态 totalCredits 纳入 energycells
3. steps 明细纳入 energycells
4. steps 累计花费纳入 energycells

### 12. 单一共享入口

```ts
function computeBuildFlowPlanPreview(
  goals: BuildGoal[],
  groups: ProductionLineGroup[],
  buildFlowView: BuildFlowPlanView | null,
  buildMaterialPlanningEnabled: boolean,
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  settings: StationSettings,
): PreviewResult

function computeBuildFlowPlan(
  input: ComputeInput,
): ComputeResult
```

要求：
1. store 调用这两个入口
2. analysis script 调用这两个入口
3. presenter / Vue 不直接触碰求解细节

### 13. Store 边界

```ts
useBlueprintProductionStore
  - activeEmpire
  - activeStation
  - station planning / empire aggregation
  - save/load/dirty for empire

useBuildPlanStore
  - buildGoals
  - buildMaterialPlanningEnabled
  - buildPlan
  - previewResult
  - computeResult
  - schemeGroups
  - computeBuildPlanLoading
  - computeBuildFlowPlanPreview()
  - computePlan()
```

约束：
1. build-plan store 可以依赖 game-data 与 logic-flow store
2. build-plan store 不应反向依赖 useBlueprintProductionStore
3. Presenter 负责把两个 store 组合给 overview Vue

### 14. Steps 算法归属

makeSchemeSteps() 核心算法：

- 步骤拆分：每个 module.count 拆分成 N 个步骤（每步 moduleCount: 1）
- 按 tier 排序，低 tier 优先建造
- 累积计算：时长、资金、产量、库存
- 建材消耗优先级：需求量 → 库存抵扣 → 剩余需购买 → Credits 计算
- builtSoFar 跨产线传递（按拓扑序）
- 重叠产线只在建材组出现一次

该算法迁出默认 compute 核心模块后，只能被详情弹窗 steps 计算链路依赖。

### 15. 异常兜底

若出现意外情况导致当前 scheme 模块为空：

1. 详情弹窗直接显示空模板
2. 不显示 steps 开关
3. 该行为仅用于异常兜底，不改变正常流程定义

## 影响面

主要影响：
1. `src/types/build-plan.ts`
2. `src/store/logic/buildPlanProductionLine.ts`
3. `src/store/logic/calculateBuildFlowPlan.ts`
4. `src/store/useBuildPlanStore.ts`
5. `src/components/empire/presenters/useBuildPlanPresenter.ts`
6. `src/components/empire/BuildPlanConstraintsPanel.vue`
7. `src/locales/en.json`
8. `src/locales/zh-CN.json`

不影响：
1. preview 责任分配算法
2. build-flow graph 构建算法
3. build-flow 连线编辑交互
