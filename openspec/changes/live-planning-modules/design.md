# live-planning-modules 设计文档

## 架构概览

本次变更严格遵循 `store → presenter → vue` 三层结构。

- store 负责领域状态、运行时 UI 状态和可复用业务能力
- presenter 负责 archive 差异、orphan 推荐和 UI 输入数据组装
- vue 负责渲染 planned/recommended/auto/archive 四个区块

## 术语澄清

- 本文若提到“有效模块集合 / effective modules”，其语义是 planning / flow 对照用集合：
  - `max(plannedModules + autoModules, archive.modules + archive.building.modules)`
- 其中 `max` 为按 `moduleId` 逐项比较 count 后取较大值。
- 这一定义不等同于 `StationDashboard` 的 `effectiveModules` prop。
- `StationDashboard` 那套 `effectiveModules` 仅属于 dashboard building scope 展示语义，不属于本文设计范围。

### 阶段与层次代词

为了避免把两个不同维度的“阶段”混在一起，本文统一使用：

- **推导阶段**
  - 指单个 station 的业务计算顺序
  - 包括：
    - `产业推导阶段`：确定 `autoIndustryModules`
    - `支撑推导阶段`：确定 `autoHabitationModules`、最终 flow、`autoInfrastructureModules`
- **缓存真源层**
  - 指 `StationDerivedMap` 及其继续向 sector / empire / transit 聚合暴露的数据源
  - 这里保存的应该是可继续参与聚合的最终 canonical planning flow
- **当前站展示层**
  - 指 `productionStationShared` 等为当前 active station 组装 UI 状态的层
  - 它可以补充展示字段，但不应与缓存真源层持有两套不同的 flow 真相

设计约束：

- “先产业、后支撑”属于**推导阶段分界**
- “DerivedMap / shared / vue”属于**层次分界**
- 这两个分界不属于同一个概念，不能互相替代

```
archiveStation + planningUiState (store)
     │
     ▼
useProductionPlanningPresenter
     │  compute archiveTotalMap
     │  compute auto diff annotation / auto count warning
     │  compute recommendedModules
     │  compute orphanArchiveModuleIds
     │  compute planned item diff annotation
     ▼
StationPlanningPanelWrapper
     │  planning/live 互斥开关不变
     │  planning 模式下向 StationPlanningPanel 传入推荐区与差异数据
     ▼
StationPlanningPanel
     │  planned 区显示 +/-N / 红色告警
     │  recommendedModules 区默认折叠
     │  auto 区显示原始 auto 数量 + 彩色差异
     │  archive 区继续纯参考
     ▼
StationPlanningItem
```

## 数据流

### 1. archiveTotalMap

在 presenter 中计算，key = moduleId，value = 存档总量（built + building）。

```ts
const archiveTotalMap = computed(() => {
  const map: Record<string, number> = {}
  for (const m of liveModules.value) map[m.id] = (map[m.id] || 0) + m.count
  for (const m of liveBuildingModules.value) map[m.id] = (map[m.id] || 0) + m.count
  return map
})
```

### 2. auto 区主数字与差异标记

在 presenter 中为 auto 模块组装两层信息：

1. 主数字 `auto_count`
2. 名称后的 `diffAnnotation`

```ts
diff = auto_count - archive_total
```

规则：

- 主数字继续显示 `auto_count`
- `diff > 0` 时，名称后显示绿色 `+N`
- `diff < 0` 时，名称后显示红色 `-N`
- `diff = 0` 时不显示额外标记
- `auto_count < archive_total` 时，count 主数字显示为红色

这里的 `+/-N` 只表达“相对 archive 当前数量的差异”，主数字仍表达 auto 原始计算值。

### 3. planned 差异数据

presenter 为 `plannedModules` 提供两类差异信息：

- `threshold`：`archiveTotalMap[module.id]`
  - 供 `planned.count < archive_total` 时渲染红色 count
- `diffAnnotation`
  - `planned.count > archive_total` 时显示绿色 `+N`
  - `planned.count < archive_total` 时显示红色 `-N`
  - `planned.count = archive_total` 时不显示额外标记
  - 渲染在模块名称后，表达“相对 archive 的差异数量”

为了与 auto 区一致，planned 区的差异表达建议统一收敛为：

- 主数字始终显示该区块的主数量语义
- 名称后显示彩色差异
- 红色或其他强调样式只用于表达风险/不足，不承担“差异值本身”的数字语义

### 4. recommendedModules

presenter 使用**设计 A：轻 DTO**：

- `recommendedModules: SavedModule[]`
- `orphanArchiveModuleIds: Set<string>`

`recommendedModules` 中每项的 `count` 表示推荐差额，而不是 archive 原始总量：

```ts
recommended_count = archive_total - planned_count
```

仅当模块同时满足以下条件时，才会进入 `recommendedModules`：

- `planned_count < archive_total`
- 该模块命中 orphan 判定

如果 `plannedModules` 中不存在该模块，则视为 `planned_count = 0`。

`recommendedModules` 中的模块保持 archive 区同样的点击语义：

- 若 planned 中不存在，则以 `archive_total` 加入
- 若 planned 中已存在且小于 `archive_total`，则提升到 `archive_total`
- 若 planned 中已存在且不小于 `archive_total`，则不变

### 5. orphan 判定

orphan 判定在 presenter 层完成，不改变 store 领域数据。

输入集合：
- `archive.modules`
- `archive.building.modules`

判定规则：
- 遍历 archive 中的模块
- 读取该模块的产出 ware
- 若其**任一产出**在 archive **其他模块**中不存在“模块本身消费关系”，则该模块记为 orphan

约束：
- 只看模块本身消费关系
- 不看工人等非模块消耗
- 不考虑闭环模块

产出结果：
- `orphanArchiveModuleIds: Set<string>`

### 6. 减少 auto 语义困惑的展示方案

如果 auto 区继续显示 auto 原始数量，用户最容易追问的是“为什么我点一下，加入到 planned 的数量比我看到的 auto 数量更大”。因此设计上需要明确回答两个问题：

1. auto 原始计算是多少？
2. 点击加入 planned 后会补到多少？

建议方案：

- auto 区主数字回答问题 1
- 模块名称后的 `+/-N` 回答“auto 相对 archive 的差异”
- 分组标题下增加一行简短说明，明确：
  - 主数字 = auto 计算结果
  - 名称后小字 = 相对现有建筑的差异
- 如现有组件支持 tooltip，可在模块项补充：
  - `auto raw`
  - `archive current`
  - `click add -> planned = max(auto raw, archive current)`

该方案尽量不引入新的数据列或第二套 count 主字段，避免进一步加重阅读负担。

### 7. recommended 区折叠状态

折叠状态由 `useLiveProductionStore` 管理，而不是由组件本地状态管理。

- 状态为全局运行时单例
- 对所有 station 通用
- 不写入持久化存储

### 8. 辅助模块的 reference-aware priority

当前系统里，工业 auto 模块与辅助 auto 模块并不是同一套选择器：

- 工业模块通过 `calculateAutoFillModules` + `findBestProducerWithRef`
- habitation 模块通过 `findBestHabitat`
- infrastructure 模块通过 `calculateInfrastructureModules`

新增需求不是要求三类辅助模块照搬工业模块的“按 ware 配额消耗”算法，而是要求它们具备同样的 reference-aware selection 语义：在 live 模式下，优先贴近 `archive.modules + archive.building.modules` 中已经存在或正在建造的辅助模块类型。

### 9. 三类辅助模块的能力维度

辅助模块的候选优先级仍然遵循“reference -> existing/planned -> db”的来源顺序，但比较候选优劣时使用各自的能力指标：

- 仓储模块：`cargo.capacity`
- 工人模块：`workforce.capacity`
- 港口模块：`dockingCount` / 泊位能力

这意味着：

- 仓储模块不再只按“数据库中最大的同类 storage”直接挑选，而要先看 archive/building 里是否已有对应 storage 类型
- 工人模块不再只按“现有模块池或数据库中的 habitation”粗选，而要先看 archive/building 里的 habitation 参考
- 港口模块不再只按“planned pier / 同族 E-Large pier / 任意 E-Large pier”直接回退，而要先看 archive/building 里的 pier 参考

### 10. 辅助模块的选择顺序

三类辅助模块统一采用以下语义顺序：

1. 参考模块池：archive/building 中出现过的同类候选
2. 参考模块池内部先同族，再非同族
3. 若参考池不足，再看 existing/planned 中的同类候选
4. existing/planned 中先同族，再非同族
5. 最后退回数据库候选

这里的“同类”按模块职责划分：

- storage 只在相同 `cargo.type` 下比较
- habitation 只在 habitation 集合内比较
- pier 只在 pier 集合内比较

### 11. 辅助模块的计数规则

reference-aware priority 只决定“选哪种模块”，不改变“缺口怎么换算成数量”的方式：

- 仓储模块继续按容量缺口计算 `count`
- 工人模块继续按工人容量缺口计算 `count`
- 港口模块继续按泊位缺口计算 `count`

因此这次设计的重点是把“候选来源优先级”扩展到辅助模块，而不是改变基础设施与 habitation 的缺口模型本身。

### 12. 两阶段求值而不是固定点循环

这里需要明确区分两件事：

1. 工业模块数量是怎么估算出来的
2. 最终 flow / workforce / infrastructure 是怎么落盘展示的

`autoIndustryModules` 的数量计算并不依赖第二阶段求出来的 `actualWorkforce`。它只依赖 `considerWorkforceForAutoFill` 这个开关：

- 开启时，按“带工人加成”的理论效率估算单模块产出
- 关闭时，按“无工人加成”的理论效率估算单模块产出

因此这里不存在需要不断回代 `worker -> industry -> worker` 的固定点循环。真正需要后置到第二阶段的，是 worker 对最终 flow 的影响。

### 13. 最终计算顺序

统一采用以下单向顺序：

1. 第一阶段：只计算 `autoIndustryModules`
2. 第二阶段：
   - 先计算 canonical 生产模块基准：
     - `canonicalBaseModules = max(planned + autoIndustry, archive.modules + archive.building.modules)`
   - 基于 `canonicalBaseModules` 计算 `autoHabitationModules`
   - 基于 `canonicalBaseModules + autoHabitation` 重算最终 `productionFlows`
   - 从这份最终 flow 中得到最终 `actualWorkforce` / `currentEfficiency`
   - 再基于最终 flow 计算 `autoInfrastructureModules`

约束：

- `autoHabitationModules` 不反向触发 `autoIndustryModules` 重算
- `autoInfrastructureModules` 不反向触发 `autoIndustryModules` 或 `autoHabitationModules` 重算
- blueprint 与 live 允许内部都走两阶段，但最终对外暴露的结果语义必须一致

这里必须注意阶段二内部的顺序：虽然 habitation 已经被后移到第二阶段，但如果它仍然按 `planned + autoIndustry` 这个较小基准计算，而不是按 canonical 的 `max(...)` 基准计算，就会导致最终 efficiency 按更大的 canonical 模块总量计算、但 habitation 模块数仍按较小基准补齐，最终表现为“打开工人效率后工人模块数量仍不足”。

### 14. store/shared 层职责调整

为了让 live 与 blueprint 最终结果一致，shared 层应承担最终阶段的统一求值，而不是让 live 和 blueprint 各自拼接不同阶段结果。

职责建议如下：

- `StationDerivedMap`
  - 属于缓存真源层
  - 可以在内部复用“产业推导阶段 / 支撑推导阶段”的计算顺序
  - 但对外保存的必须是可继续参与 aggregation 的最终 canonical planning flow
- `productionStationShared`
  - 属于当前站展示层
  - 负责当前 active station 的最终展示态组装
  - 不应与缓存真源层分叉出另一套聚合基准 flow
- `useLiveProductionStore` / `useBlueprintProductionStore`
  - 都只消费 shared 层给出的最终结果
  - transit / sector / empire 聚合则继续消费缓存真源层中的统一 canonical planning flow

## 组件变更

### StationPlanningPanelWrapper

- planning/live 互斥开关保持不变
- planning 模式下新增传递：
  - `archiveTotalMap`
  - `recommendedModules`
  - `recommendedExpanded`
  - auto 区主数字与弱化差异所需字段
- live 模式下 `ArchiveModuleList` 完全不变

### StationPlanningPanel

- 结构调整为：
  1. planned 区
  2. `recommendedModules` 建议区
  3. auto 各区
  4. `<hr>`
  5. archive 参考区
- `recommendedModules` 区默认折叠，折叠态只显示推荐模块种类数
- 展开态显示推荐模块列表，每项 count 为推荐差额
- `recommendedModules` 中的模块可点击，点击行为与 archive 模块一致
- auto 区主数字显示 auto 原始计算数量
- auto 区名称后显示相对 archive 的彩色 `+/-N`
- auto 区在 `auto_count < archive_total` 时，count 主数字显示为红色
- archive 区仍保留纯参考职责，不显示 orphan icon 或额外 orphan 标签
- archive 区展示结构保持当前实现不变

### StationPlanningItem

- 新增 `diffAnnotation?: string`
- 保留 `threshold?: number`
- `diffAnnotation` 同时支持 planned / auto 的 `+/-N`
- `+N` 使用绿色
- `-N` 使用红色
- `threshold` 继续用于 `count < archive_total` 的红色告警
- auto 区可复用同一套 `diffAnnotation` 表达形式，保持名称后小字的一致性

## Store 变更

### 运行时 UI 状态

`useLiveProductionStore` 需要新增一个不持久化的运行时状态，例如：

```ts
recommendedModulesExpanded: boolean
```

要求：
- 默认 `false`
- 所有 station 共用
- reload 后恢复默认值

### 选择器能力扩展

store / logic 层需要补充辅助模块专用的 reference-aware selector，或者把现有 `findBestHabitat`、`findBestStorage`、`findPreferredPierModule` 抽象成支持 referenceModules 的统一能力。

要求：

- 输入中可接收 `referenceModules`
- 仅在 live planning 有 archive/building 数据时启用参考池
- 无参考池时保持现有 fallback 语义
- 不引入新的 UI 中间层，仍由 store 负责领域计算、presenter 负责展示组装

## 不变区域

以下逻辑保持不变：

- `calculateAutoFillModules()` 的 P1–P8 优先级与配额规则
- `ArchiveModuleList` 的 live 模式展示
- `StationDashboard` 及其 building scope `effectiveModules` 语义
- `StationWareFlowsDashboard`
- 持久化数据结构本身

以下逻辑的目标保持不变，但候选选择方式要接入 reference-aware priority：

- habitation 数量仍由工人容量缺口驱动
- infrastructure 的 storage 数量仍由容量缺口驱动
- infrastructure 的 pier 数量仍由泊位缺口驱动

## Locale

本次变更需要为建议区补充文案 key，例如：

- `planning.recommended_modules`
- `planning.recommended_module_kinds`

具体命名以现有 locale 结构为准，但 request/spec/tasks 需保持一致。
