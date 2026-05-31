# terraforming-log-edit Design

## 架构

本 change 延续 `store -> presenter -> vue` 三层结构：

```
数据层
  terraforming.json
    └── projects[].dependencies

store
  useLiveProductionStore
    └── 正式 terraformingExecutionLog

presenter
  useTerraformingPresenter
    ├── 正式 timeline 输出
    ├── 编辑模式状态
    ├── draftExecutionLog
    └── draft replay / validation

vue
  TerraformingTaskList
  TerraformingResourcePanel
    └── 只消费 presenter 输出与触发 presenter 行为
```

## 数据层依赖归一化

### 目标

将原本分散的动态阻塞、移除、触发语义转换为统一布尔依赖表达式，让 view 层只面对一种可执行性判断模型。

新增项目字段：

```ts
type TerraformingProjectDependency =
  | { all: TerraformingProjectDependency[] }
  | { any: TerraformingProjectDependency[] }
  | { completed: string }
  | { notCompleted: string }
  | { groupCompleted: string }
  | { groupNotCompleted: string }
```

其中：

- `all`：所有子依赖必须满足。
- `any`：任一子依赖满足即可。
- `completed`：项目已完成。
- `notCompleted`：项目未完成。
- `groupCompleted`：组前置标记，仅用于展示；evaluator 不用它阻塞执行。
- `groupNotCompleted`：组互斥标记，仅用于展示；evaluator 不用它阻塞执行。

### 转换规则

- 原 `predecessors`：
  - `type=group` 前置和同组项目前置保留在 `predecessors`，继续作为任务树结构凭据。
  - 跨组项目前置转成 `dependencies`，不参与任务树父子结构。
  - 若 `any=true` 的项目分支包含跨组前置，为保持 OR 语义，整组项目分支转成 `dependencies.any`；纯同组 `any=true` 前置可保留在 `predecessors`。
  - `type=group` 前置不在 UI 正文显示，执行可用性检查跳过它。
- 原 `blockedProjects`：
  - 对每个被阻塞项目追加 `completed(blocker)`。
- 原 `blockedGroups`：
  - 对组内每个项目追加 `completed(blocker)`。
- 原 `removedProjects`：
  - 对每个被移除项目追加 `notCompleted(remover)`。
- 原 `sideEffects[].project`：
  - 单一 source 生成目标项目时，若 source 与 target 同组，target 追加同组 `predecessors`；若跨组，target 追加 `dependencies.completed(source)`。
  - 多个 source 可生成同一目标时，不区分同组或跨组，统一追加 `dependencies.any(completed(sourceA), completed(sourceB), ...)`，不进入 `predecessors`。
  - 若 sideEffect 目标项目又通过 `blockedProjects` 或 `blockedGroups` 阻塞其他项目，则被阻塞项目追加条件 blocker：`any(notCompleted(sourceProject), completed(sideEffectProject))`。
  - 这表示“只有执行过会触发 blocker 的源项目时，才要求完成 blocker”。

### 条件 blocker 示例

`bio_jumpstart` 可能触发 `bio_cull`，`bio_cull` 阻塞 `agr_fertilize`，且 `agr_fertilize` 原前置为 `bio_tailored` 或 `bio_jumpstart`。输出为：

```json
"dependencies": {
  "any": [
    { "completed": "bio_tailored" },
    {
      "all": [
        { "completed": "bio_jumpstart" },
        { "completed": "bio_cull" }
      ]
    }
  ]
}
```

`ind_refineries_cheap` 可能触发 `ind_refineries_retrofit`，因此 `ind_refineries_retrofit` 输出为：

```json
"dependencies": {
  "completed": "ind_refineries_cheap"
}
```

若多个项目都可能触发同一个 sideEffect 目标项目，则目标项目输出为：

```json
"dependencies": {
  "any": [
    { "completed": "source_a" },
    { "completed": "source_b" }
  ]
}
```

`bio_toxicfruit_cull` 可能触发 `bio_parasites_cull`，`bio_parasites_cull` 阻塞 `food_luxury` 组。`agr_vineyards` 输出为：

```json
"dependencies": {
  "any": [
    { "completed": "bio_toxicfruit_genemod" },
    {
      "all": [
        { "completed": "bio_toxicfruit_cull" },
        { "completed": "bio_parasites_cull" }
      ]
    }
  ]
}
```

### 概率语义

页面不模拟概率，也不做随机分支。`sideEffects[].project` 在依赖语义上只用于生成条件 blocker；概率只影响已有 effect-list 的展示文案。

### 展示语义

- `completed` 显示为需要完成的项目。
- `notCompleted` 显示为互斥关系，例如 `互斥: 速效微生物群`，不得显示成“需要 速效微生物群”。
- `groupCompleted` / `groupNotCompleted` 不参与 evaluator 阻塞，edit log 中也不展示为正文依赖。
- edit log entry 若没有依赖、stat 变化或失效原因，则只显示标题行，不渲染空正文。

## 正式队列与 Draft 队列

### 正式队列

正式队列仍由 store 维护：

```ts
TerraformingExecutionEntry {
  id: string
  projectId: string
}
```

正式队列代表已经确认的执行顺序，非编辑模式中的执行、撤销、减少次数都必须保持该队列处于可重放状态。

### Draft 队列

draft queue 由 presenter 管理，不进入 store 持久状态：

```ts
interface TerraformingDraftExecutionEntry {
  id: string
  projectId: string
  enabled: boolean
  source: 'committed' | 'draft'
}
```

进入编辑模式时：

```ts
draftExecutionLog = committedLog.map(entry => ({
  ...entry,
  enabled: true,
  source: 'committed',
}))
```

新增/复制的 draft entry 使用 presenter 生成的临时 id。完成时，保留 committed entry 的旧 id；新增 entry 由 store 生成正式 id，或由提交操作统一规范化 id。

## Replay 与可执行性判断

### 轻量 evaluator

抽出共享轻量判断函数，供三个场景复用：

- 非编辑模式添加任务。
- 非编辑模式撤销/减少次数校验。
- 编辑模式 draft replay。

职责：

```ts
evaluateTerraformingProjectExecution(input): {
  valid: boolean
  reasons: string[]
}
```

判断范围：

- project 是否存在。
- 一次性项目是否已经在当前 replay counts 中完成。
- 统一依赖表达式是否满足。
- stat conditions 是否满足。
- 当前 project 是否在运行时项目池中。

不负责：

- 构建 TaskTree。
- 翻译 UI 文案。
- 计算资源、交付、建造、折扣、返还。

### Draft replay

编辑模式 replay 顺序：

```
base stats
completed = empty

for each draft entry:
  if disabled:
    mark disabled
    continue

  result = evaluate(entry.projectId, stats, completed)

  if valid:
    mark enabled-valid
    apply stat effects
    completed[projectId] += 1
  else:
    mark enabled-invalid
    do not apply effects
    continue
```

失效项不应用 effects，是为了避免后续预览建立在不可执行状态上。

### 复杂度策略

- 不在拖拽 hover 期间 replay。
- 只在进入编辑模式、drop 完成、插入、禁用/启用、删除、复制、全部禁用/全部启用后 replay。
- replay 可从变更 index 开始复用 prefix snapshot；首版可先全量 replay，后续优化不改变外部行为。

## 右列 UI

### 标题栏

非编辑模式：

```
任务队列                         [编辑]
```

编辑模式：

```
任务队列                         [取消] [完成]
```

完成按钮启用条件：

```ts
draftEntries.every(entry => entry.state !== 'enabled-invalid')
```

当完成按钮禁用时，显示原因：仍有 N 个启用任务失效。

### 队列内部操作 card

编辑模式下，队列顶部新增操作 card：

- `全部禁用`：将所有 draft entry 的 `enabled` 设为 false。
- `全部启用`：将所有 draft entry 的 `enabled` 设为 true，并触发 replay。

原标题栏「清空任务」不再存在。

### Draft entry card

编辑模式下每张 card 至少显示：

- 顺序号。
- 项目名。
- 当前状态：禁用 / 启用且有效 / 启用但失效。
- 依赖项。
- stat effects。
- 依赖 stat。
- 失效原因。
- 拖拽手柄。
- 禁用/启用操作。
- 可重复项目的复制操作。

编辑模式下不显示材料、交付、建造、折扣、返还明细。

### 重复项目操作

- 可重复项目显示复制按钮。
- 复制按钮在当前 entry 下方插入同 projectId 的 draft entry。
- 连续重复项目中：
  - 首条显示禁用按钮。
  - 后续条显示删除/撤销按钮。
- 删除/撤销后触发 replay。

### 一次性项目约束

一次性项目不允许在 draft 中存在多个启用 entry。中列点击执行时，如果 draft 中已经存在该项目启用记录，则不插入。

若通过异常路径产生重复启用 entry，后续 entry 应标为 `enabled-invalid`，原因是一次性项目已存在。

## 中列任务交互

### 非编辑模式

- 点击执行：调用轻量 evaluator 检查当前正式队列尾部状态，满足才追加正式 execution entry。
- 一次性项目：只允许从 0 变 1。
- 可重复项目增加：每增加 1 次都追加一条正式 entry。
- 点击取消或减少次数：不直接删除 count；必须尝试撤销该 project 最靠后的正式 entry，并对删除后的队列 replay 校验。
- 若删除后队列不可重放，则不允许撤销，并提示进入编辑模式处理。

### 编辑模式

- 点击执行：插入 draft queue 尾部。
- 点击取消：找到 draft queue 中该 projectId 最后一条 entry。
  - 若该 entry 属于后续重复项，则删除。
  - 否则设为 disabled。
- 中列 count 与完成状态基于 draft enabled count 展示。

## 非编辑模式撤销显示

非编辑模式右列不再显示撤销影响详情。每条正式 entry 只显示：

- 可撤销：显示撤销按钮。
- 不可撤销：按钮 disabled，并显示简短原因或 tooltip。

撤销校验仍使用 replay 删除候选 entry 后的正式 log；只是 UI 不展示完整影响列表。

## Presenter 输出

建议 presenter 新增或扩展以下输出：

```ts
interface TerraformingQueueEditState {
  editing: boolean
  canComplete: boolean
  invalidCount: number
  draftEntries: TerraformingDraftTimelineEntry[]
}

interface TerraformingDraftTimelineEntry {
  id: string
  projectId: string
  order: number
  enabled: boolean
  state: 'disabled' | 'enabled-valid' | 'enabled-invalid'
  reasons: string[]
  dependencies: string[]
  statLines: TerraformingStatLineModel[]
  repeatGroupRole: 'single' | 'first' | 'duplicate'
}
```

Vue 不直接读取 store 或 resolver；只消费这些结构。

## 任务树可见范围

任务树的输入 MUST 是 runtime cluster project ids，而不是全量 terraforming project 列表。基础范围来自当前 cluster 的 `projectIds`，再由运行时规则补充当前 stat 动态项目、已完成项目以及当前可见项目的 `sideEffects[].project` 目标项目。

同组非 `any` project predecessor 只有在 parent 与 child 都已经进入 runtime cluster 时才形成父子关系。不得为了显示潜在子项目而移除 runtime cluster 范围限制，否则会把其他星球或未进入当前流程的全局项目混入任务树，并可能放大跨项目依赖检查范围。

`ind_refineries_retrofit` 这类 sideEffect 目标项目的正确显示路径是：`ind_refineries_cheap` 先作为当前 runtime 可见项目存在，runtime project id 计算再将其 `sideEffects[].project` 加入任务树输入，最后 resolver 根据同组非 `any` predecessor 将 retrofit 挂到 cheap 下方。

## 风险与取舍

- 将 blocked/removed/sideEffect project 归一化到数据层会改变数据结构，必须同步更新 resolver 与 CLI。
- 编辑模式不模拟资源与折扣，因此编辑预览不能用于评估经济结果；这是刻意边界。
- 允许任意拖拽会产生临时 invalid 队列；UI 必须清楚展示 invalid 原因，而不是阻止拖拽。
- 非编辑模式仍应保持正式队列可重放，避免用户在普通模式下创建隐性坏队列。
