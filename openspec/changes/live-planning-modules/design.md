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

## 不变区域

以下逻辑保持不变：

- `calculateAutoFillModules()` 的 P1–P8 优先级与配额规则
- `ArchiveModuleList` 的 live 模式展示
- `StationDashboard` 及其 building scope `effectiveModules` 语义
- `StationWareFlowsDashboard`
- 持久化数据结构本身

## Locale

本次变更需要为建议区补充文案 key，例如：

- `planning.recommended_modules`
- `planning.recommended_module_kinds`

具体命名以现有 locale 结构为准，但 request/spec/tasks 需保持一致。
