# build-plan-production-line 设计

## 目标

为 `build-plan-production-line` 建立单一、稳定的数据流：

1. `preview` 负责责任分配、依赖图、SCC。
2. `compute` 负责读取 `preview` 结果并求解主要模块 / 辅助模块。
3. Vue 与 analysis script 只消费共享结果，不自行重建逻辑。
4. `build-plan` 真相层状态由独立 store 承载，不再混入 `useBlueprintProductionStore`。

## 领域术语

| 术语 | 含义 |
|------|------|
| preview | 在 build-flow 规划上下文中，根据目标变化或 checkbox 状态变化而重算的责任分配阶段 |
| compute | 用户点击“计算建造方案”后执行的模块求解阶段 |
| 责任 | 一条产线需要承担的供给义务 |
| `derived-build-material` | 为其他建筑 / 产线提供建材的 preview 责任 |
| `derived-production` | 为其他产线提供产物的 preview 责任 |
| `required-production` | 某条产线自身仍需要其他产线供给的 preview 责任 |
| `target-production` | 用户目标在 preview 中的只读责任表示 |
| 相关产线集合 | 在 preview 阶段已显式挂到某条责任上的产线集合 |
| 主要模块 | 用于满足目标产率的核心生产模块 |
| 辅助模块 | 由主要模块派生出的配套模块 |
| 重叠产线 | 同一 `groupId` 同时出现在依赖图和责任分配中的产线 |
| 稳定 | 迭代中主要模块数量不再变化 |

## 问题

当前文档同时混入了：

1. preview 与 compute 的职责
2. 责任分配与模块求解
3. 多套不一致的目标速率解释
4. 多套不一致的 SCC 收敛判据

导致实现者无法判断：

- 哪一步该决定责任归属
- 哪一步该计算模块数
- 目标速率按什么公式求
- Vue 与 analysis script 是否必须同源

当前代码也已经暴露出以下偏差，不能继续作为设计依据：

1. checkbox 被实现成 build-flow mode 开关
2. preview 未显式保存责任模型
3. compute 会重新按 goals 分配产线，而不是读取 preview 结果
4. 目标速率仍然主要围绕 graph edge / demandSource 聚合，不是围绕“责任 -> 相关产线集合 -> 建筑集合”
5. 重叠产线在 scheme 层事后合并，而不是在求解前先合并责任
6. SCC 收敛当前看的是 `node.modules`，包含辅助模块，不符合需求

因此：**设计以本文档为准，不以当前代码实现为准。**

## 方案

### 1. 总体数据流

```
build-plan store
  -> 持有 buildGoals / buildFlowMode / buildPlan / previewResult / computeResult / schemeGroups
  -> 监听目标模块 / 目标产物变化、checkbox 状态变化、logic-flow 变化
  -> preview
     -> 责任分配
     -> 依赖图
     -> SCC
     -> preview store result

用户点击“计算建造方案”
  -> build-plan store.compute
     -> 读取 preview result
     -> 合并单线责任
     -> 基于相关产线集合求目标速率
     -> 计算主要模块
     -> 派生辅助模块
     -> 若存在 SCC 则迭代直到主要模块稳定
     -> 输出最终 scheme groups

blueprint production store
  -> 保留 activeEmpire / station planning / empire aggregation / save-load
  -> 不再持有 build-plan preview / compute 真相层
```

补充约束：

1. `build-flow mode` 是常驻规划上下文
2. checkbox 不是 `build-flow mode` 开关
3. checkbox 只控制是否启用“按建筑材料需求规划建材产线”
4. checkbox 勾选 / 取消都会触发 preview 重算
5. `useBlueprintProductionStore` 不再持有 build-plan 真相层状态
6. overview 页面通过 presenter 组合 `useBuildPlanStore` 与 `useBlueprintProductionStore`

### 1.1 Store 边界

推荐拆分：

```ts
useBlueprintProductionStore
  - activeEmpire
  - activeStation
  - station planning / empire aggregation
  - save/load/dirty for empire

useBuildPlanStore
  - buildGoals
  - buildFlowMode
  - buildPlan
  - previewResult
  - computeResult
  - schemeGroups
  - buildFlowPlanLoading
  - computeBuildPlanLoading
  - computeBuildFlowPlanPreview()
  - computePlan()
```

约束：

1. build-plan store 可以依赖 game-data 与 logic-flow store
2. build-plan store 不应反向依赖 `useBlueprintProductionStore`，避免形成循环依赖
3. `useBlueprintProductionStore` 若仍需要展示 empire overview 流数据，保持原职责即可
4. Presenter 负责把两个 store 组合给 overview Vue；Vue 不直接拼装 store 间数据

### 2. Preview 阶段设计

#### 2.1 输入

- `buildGoals`
- logic-flow groups
- build-flow view
- checkbox 状态（是否按建筑材料需求规划建材产线）

#### 2.2 输出

preview 必须产出三类数据：

1. 责任分配结果
2. 依赖图
3. SCC

#### 2.3 责任分配结果结构

每条产线在 preview 中至少需要保存：

```ts
interface PreviewLineAssignment {
  groupId: string | undefined
  groupName: string
  responsibilities: PreviewResponsibility[]
}

interface PreviewResponsibility {
  type: 'derived-build-material' | 'derived-production' | 'required-production' | 'target-production'
  wareId?: string
  moduleId?: string
  count?: number
  ratePerHour?: number
  relatedLineGroupIds: string[]
  source: string
}
```

建议在正式实现中补齐更完整字段：

```ts
interface PreviewResult {
  buildMaterialPlanningEnabled: boolean
  lines: PreviewLinePlan[]
  graph: BuildFlowPlanGraph | null
  sccGroups: string[][]
}

interface PreviewLinePlan {
  groupId?: string
  groupName: string
  isUnmatched: boolean
  responsibilities: PreviewResponsibility[]
}

interface PreviewResponsibility {
  id: string
  type: 'derived-build-material' | 'derived-production' | 'required-production' | 'target-production'
  wareId?: string
  moduleId?: string
  count?: number
  ratePerHour?: number
  relatedLineGroupIds: string[]
  sourceRef: string
}
```

关键点：

1. 一条产线可同时拥有多条责任
2. 三类责任都在 preview 中确定
3. compute 不允许重新改写责任归属
4. 预览区中的 `target-production` 只作为分配结果展示，不承担原始目标编辑

与当前代码关系：

1. 当前 `ProductionLineAllocation.goals` 只能表达“某线挂了哪些 goal”
2. 不能表达显式责任类型、责任来源、相关产线集合
3. 因此 `ProductionLineAllocation` 不能继续充当 preview 真相层
4. 应新增独立 preview 结果类型，`ProductionLineAllocation` 最多作为过渡期 UI 兼容视图

#### 2.3.1 现有类型到新类型的映射

推荐映射方式：

| 现有类型 | 新定位 | 处理方式 |
|----------|--------|----------|
| `ProductionLineAllocation` | 兼容 UI 的过渡视图 | 不再作为真相层 |
| `BuildFlowPlanGraph` | preview 图结果 | 保留并继续复用 |
| `BuildGoal` | 输入目标定义 | 保留 |
| `PreviewResult` | preview 真相层 | 新增 |
| `PreviewLinePlan` | 单线责任真相层 | 新增 |
| `PreviewResponsibility` | 单条责任真相层 | 新增 |

#### 2.4 依赖图

preview 构建依赖图时：

1. 在 `build-flow mode` 中，只要目标模块 / 目标产物变化，或 checkbox 状态变化，就重建依赖图
2. checkbox 只控制依赖图是否包含“按建筑材料需求规划建材产线”对应的建材链路
3. 从目标模块集合的建材需求开始 BFS
4. 融入 isolated 扩展
5. 新增边方向保持“消费方 -> 供给方”
6. isolated 搜索产线优先级：
   - manual
   - auto
   
#### 2.6 目标到产线的全局分配算法

当前 `computeProductionLineAllocation` 采用逐 goal 顺序扫描：
- 每个 goal 独立走 manual → auto → unmatched
- 先匹配 manual 的产线，再匹配 auto 的产线
- 问题：auto 阶段无法区分"已分配产线"和"未分配产线"，只是按 flowGroups 数组顺序取第一个

改为全局两轮扫描分配：

```text
第一轮（manual 全局分配）：
  for each goal:
    扫描所有产线的 manual 节点 → 匹配则 assign，标记该产线为"已分配"

第二轮（auto 优先在已分配产线中查找）：
  扫描所有 未分配 的 goal:
    优先在"已分配"的产线中查找 auto 节点 → 匹配则 assign
    其次在其他"未分配"的产线中查找 auto 节点 → 匹配则 assign
    仍未匹配 → unmatched
```

效果：
1. 所有目标先走完 manual 分配，确保 manual 节点优先被利用
2. auto 阶段优先在已有 manual 分配的产线中找，将新目标聚集到已有产线
3. 避免新目标分散到多个产线
7. 若 build material / output build 无连线：
   - 直接忽略
   - 不回退搜索其他来源

#### 2.5 SCC

preview 完成依赖图后立即检测 SCC，并写入 store。

SCC 在 preview 阶段只负责：

1. 给 compute 提供迭代边界
2. 为未来 UI 保留循环依赖信息

preview 本身不求解最终模块数。

### 3. Compute 阶段设计

#### 3.1 原则

compute 只做求解，不做重新分配。

禁止行为：

1. 再次决定某个 goal 该归谁
2. 在 Vue 层临时追加责任
3. 在 analysis script 里维护第二套责任归属规则
4. 在 compute 阶段重新调用当前的 `computeProductionLineAllocation(goals, ...)`
5. 在 `useBlueprintProductionStore` 中继续保留 build-plan 真相层状态并与新 store 双写

#### 3.2 单线求解模型

对单条产线，compute 流程必须是：

```text
该线全部责任
  -> 合并责任
  -> 取责任挂接到的相关产线集合
  -> 收集这些相关产线的全部建筑
  -> 对每个材料计算目标速率
  -> 解主要模块
  -> 派生辅助模块
```

这意味着 compute 的正确输入应该是：

```ts
interface ComputeLineInput {
  groupId?: string
  groupName: string
  responsibilities: PreviewResponsibility[]
  relatedLineGroupIds: string[]
}
```

而不是当前代码里的：

- `goals`
- `ProductionLineAllocation[]`
- graph 上临时拼出来的 `requiredWaresByGroup`

#### 3.2.1 与当前代码的关系

当前实现中：

1. `computeBuildFlowPlanSchemeGroups()` 仍然接受 `goals`
2. 它内部重新调用 `computeProductionLineAllocation()`
3. `collectDemandSources()` 主要围绕 graph edge 聚合 demand

这些都只能视为过渡实现，不是最终设计。

#### 3.2.2 Compute 输入 / 输出契约

建议正式固定为：

```ts
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

要求：

1. `ComputeInput` 不再直接接收裸 `goals`
2. `ComputeResult` 必须显式分离 `primaryModules` 与 `auxiliaryModules`
3. `BuildSchemeGroup` 只是最终展示视图，不是求解真相层

#### 3.3 目标速率公式

两种责任类型使用不同的目标速率公式：

**derived-build-material（建材供给）:**

```text
targetRate(material) =
   所有相关产线的所有建筑 buildCost 中，该材料总需求
   /
   所有相关产线的所有建筑总建造时间
```

需求维度: `module.buildCost[material] × module.count` 累加  
时间维度: `module.buildTime × module.count` 累加

**derived-production（原料供给）:**

```text
targetRate(material) =
   sum(−netProduction[material] of all relatedLines)
   +
   sum(targetProduction.ratePerHour for this ware on this line)
```

需求维度: 相关产线的模块运行时净消耗（模块 outputs − inputs，负值表示消耗）  
与建造时间无关

这里的"相关产线"必须来自 preview 中该责任保存的 `relatedLineGroupIds`。

禁止旧规则：

1. per-source `Math.max`
2. 不分责任类型，统一用 sum(qty)/sum(time)
3. 只看本线建筑，不看责任挂接的相关产线集合

对现状代码的改造要求：

1. `collectDemandSources()` 可以保留为图辅助分析层
2. 但不能继续作为责任真相层
3. `planProductionForRates()` / `bootstrapFillForLine()` 的输入应改为"已按责任与相关产线集合算好的 target rates"
4. 目标速率不应继续直接从 graph edge / upstream line 模块推导为最终规则

#### 3.3.1 责任到目标速率的推荐函数边界

推荐新增明确边界的纯函数：

```ts
function mergeLineResponsibilities(
  line: PreviewLinePlan,
): PreviewResponsibility[]

function collectBuildingsForResponsibilities(
  responsibilities: PreviewResponsibility[],
  preview: PreviewResult,
): SavedModule[]

function computeTargetRatesFromBuildings(
  buildings: SavedModule[],
  modulesMap: Record<string, X4Module>,
): Record<string, number>
```

含义：

1. `mergeLineResponsibilities()` 负责单线责任合并
2. `collectBuildingsForResponsibilities()` 负责从 `relatedLineGroupIds` 展开建筑集合
3. `computeTargetRatesFromBuildings()` 负责 `sum(qty)/sum(time)` 公式

现有 `collectDemandSources()` / `computeGap()` 若继续存在，应退居辅助层，不再承担上述职责。

#### 3.4 主要模块与辅助模块

计算顺序固定：

1. 先根据目标速率求主要模块数量
2. 再根据主要模块派生辅助模块数量

辅助模块不是独立收敛变量。

当前代码中的 `node.modules` 混合了：

1. 主要模块
2. autoFill 产出的辅助模块

后续设计需要显式区分这两个层次，至少在 SCC 收敛判据上必须可分离。

### 4. SCC / 循环依赖求解

#### 4.1 何时需要迭代

当依赖图存在 SCC 时，compute 不能单轮结束。

#### 4.2 迭代过程

```text
loop:
  1. 基于当前状态重算 SCC 内各线目标速率
  2. 重算各线主要模块数量
  3. 若主要模块数量与上一轮完全一致 -> stable -> break
```

#### 4.3 收敛判据

只看主要模块数量：

```text
primary modules unchanged -> stable
```

不看辅助模块数量，原因：

1. 辅助模块由主要模块派生
2. 主要模块稳定后，辅助模块随之确定

对现状代码的改造要求：

1. 当前基于 `node.modules` 的稳定判断必须拆开
2. 需要单独保存或可推导“主要模块快照”
3. SCC 循环只比较主要模块快照是否变化

#### 4.3.1 主要模块快照建议结构

```ts
type PrimaryModuleSnapshot = Map<string, string>
// key = lineGroupId
// value = "module_id:count;module_id:count"
```

要求：

1. 快照只包含主要模块
2. 不包含 autoFill / habitation / auxiliary 模块
3. SCC 迭代中比较 `PrimaryModuleSnapshot` 是否变化

### 5. 分组与重叠产线

最终输出分两组：

1. 建材产线组
2. 生产产线组

重叠产线规则：

1. 相同 `groupId` 只允许出现一次
2. 必须归入建材产线组
3. 其建材责任与生产责任必须合并求解

构建顺序：

1. 先建材产线
2. 再生产产线
3. 组内按依赖拓扑序

### 6. UI / Script 一致性

必须存在单一共享入口，例如：

```text
computeBuildFlowPlanPreview(...)
computeBuildFlowPlan(...)
```

要求：

1. store 使用该入口
2. Vue 只展示该入口结果
3. analysis script 也调用该入口

禁止：

1. Vue 内部重新推导分组
2. analysis script 复制 store 逻辑
3. preview / compute 在不同地方各写一套变体

#### 6.1 推荐共享入口签名

建议最终固定为两个共享入口：

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

现状说明：

1. analysis script 已接到共享入口，这是可保留部分
2. 但 presenter 仍在把 preview allocation 与 production allocation 二次拼装
3. 说明 store 输出还不是最终真相层
4. 正确方向应是：store 直接输出可展示的 preview truth，presenter 只做轻量映射

### 7. 组件职责

#### Store

- 保存 preview 结果
- 驱动 compute
- 输出最终 grouped schemes

补充：

- Store 必须持有 preview truth，而不是只持有 graph + 派生 goals
- Store 必须作为唯一责任分配真相源

#### Presenter

- 仅做 UI 所需字段整理
- 不改写责任归属
- 不改写求解公式
- 用户目标区与 preview 区必须分开映射

补充：

- Presenter 不应再把 preview allocation 与 compute allocation 合并生成“伪 preview”
- Presenter 必须保留独立“用户目标区”数据，并将 preview 区映射为只读 tag 视图

#### Vue

- 仅展示 store / presenter 已提供结果
- 不得在组件内部重新定义 preview / compute 逻辑

## 基于当前代码的迁移设计

### 迁移目标

在尽量复用现有图构建、scheme 渲染、steps 生成能力的前提下，替换错误的真相层。

### 可复用部分

1. `buildFlowPlanGraph()` 及其 isolated 扩展
2. `makeSchemeSteps()` 及现有 steps 输出结构
3. `BuildSchemeGroup` / UI 卡片渲染骨架
4. analysis script 已接入共享入口的结构

### 必须替换或降级为辅助层的部分

1. `ProductionLineAllocation` 作为 preview 真相层的职责
2. `compute` 阶段重新调用 `computeProductionLineAllocation()`
3. `collectDemandSources()` 直接代表最终责任需求的职责
4. scheme 层事后重叠合并的求解方式
5. 基于 `node.modules` 的 SCC 收敛判断

### 推荐迁移顺序

1. 新增 preview truth 类型，显式保存 responsibilities + relatedLineGroupIds
2. Store 的 preview 结果改为输出 preview truth
3. compute 改为只吃 preview truth，不再吃裸 `goals`
4. 在 compute 内先合并责任，再生成 per-line targetRates
5. SCC 收敛改为只看主要模块快照
6. Presenter / Vue 删除二次责任拼装逻辑
7. analysis script 继续复用共享入口，但共享入口改为新真相层

### 迁移到现有文件的落点建议

#### `src/types/build-plan.ts`

新增：

1. `PreviewResult`
2. `PreviewLinePlan`
3. `PreviewResponsibility`
4. `ComputeInput`
5. `ComputeResult`
6. `ComputeLineResult`
7. `PrimaryModuleSnapshot`

保留但降级：

1. `ProductionLineAllocation` -> 过渡 UI 视图
2. `BuildSchemeGroup` -> 最终展示视图

#### `src/store/logic/buildPlanProductionLine.ts`

职责收敛为：

1. 生成 `PreviewResult`
2. 生成 `ComputeResult`
3. 暴露单一共享入口

不再承担：

1. 在 compute 内二次分配 goals
2. 将 preview 压扁回 `ProductionLineAllocation.goals`

#### `src/store/logic/calculateBuildFlowPlan.ts`

保留：

1. 图线求解辅助能力
2. steps / scheme 生成
3. bootstrap / SCC 求解底层算法

调整：

1. 输入改为显式 target rates / primary modules / auxiliary modules
2. 不再假设 graph edge demand 就是最终责任需求

#### `src/store/useBlueprintProductionStore.ts`

调整为：

1. state 保存 `previewResult`
2. state 保存 `computeResult`
3. checkbox / goals / flow 变化时只更新 `previewResult`
4. 点击 compute 时只消费 `previewResult`

#### `src/components/empire/presenters/useBuildPlanPresenter.ts`

删除：

1. 对 preview allocation 与 production allocation 的二次拼装

改为：

1. 从 `previewResult` 映射 UI 所需数据
2. 从 `computeResult` 映射 scheme groups

#### `analysis/scripts/build-plan/build-plan-production-line.ts`

保留：

1. fixture 解析
2. 命令行参数处理

改为：

1. 调用新 `computeBuildFlowPlanPreview()`
2. 调用新 `computeBuildFlowPlan()`
3. 输出 `previewResult` 与 `computeResult` 派生视图

## 实现约束

1. 单条产线三类责任必须在求解前合并
2. 相关产线集合必须来自 preview 显式挂接结果
3. 速率公式必须使用“总需求 / 总建造时间”
4. SCC 收敛只看主要模块数量
5. analysis script 与 Vue 必须共用单一计算入口
