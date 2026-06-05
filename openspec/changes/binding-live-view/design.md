# design.md - binding-live-view

## 架构

本 change 连接 save binding runtime 与现有 terraforming queue/replay/view，继续遵守 `store -> presenter -> vue` 三层结构。

```text
archive.terraforming_clusters
  -> useTerraformingStore
      -> archive runtime base state
      -> synced executed baseline
      -> deducted execution log
  -> useTerraformingPresenter
      -> current queue display
      -> executed display
      -> archive sync warning
  -> TerraformingResourcePanel / task log
```

不新增 view model/facade 层。Vue 组件只消费 presenter props 和 emit presenter action。

## 状态模型

### 现有队列保持原命名

现有正式队列继续使用：

```ts
terraformingExecutionLog: TerraformingExecutionEntry[]
```

编辑态继续使用：

```ts
draftExecutionLog: TerraformingDraftExecutionEntry[]
```

实现不得引入 `userFutureQueue` 这类新队列名称。

### archive runtime 状态

store 增加从当前 live archive 派生的运行时数据：

```ts
interface TerraformingArchiveRuntimeBaseState {
  clusterId: string
  stats: Record<string, number>
  completedProjects: Map<string, number>
  completedOneTimeEvents: Map<string, number>
  rebates: RebateKey[]
  activeProject?: SaveTerraformingProjectProgress
  retainedProjects: SaveTerraformingProjectProgress[]
  missionComplete: boolean
}
```

其中：

- `stats` 以 save runtime 为权威值；若静态 `cluster.initialStats` 中存在某 stat，而 save runtime `stats` 中缺失该 stat，则该 stat SHALL 归一化为 `0`，表示存档已将其清零而不是该 stat 不存在。
- `completedProjects` 来自 `SaveTerraformingCluster.completedProjects`。
- `completedOneTimeEvents` 只收录静态 project 定义中 `group === 'events'` 且 `repeatCooldown === null` 的 event。
- `rebates` 从 `SaveTerraformingCluster.rebates` 转成 replay 使用的 raw rebate key。
- `activeProject`、`retainedProjects` 仅用于运行时展示和提示，不写入持久队列。
- `activeProject.aborted !== true` 表示当前正在执行内容，展示层需要将其固定为“当前队列”的第一项。
- `activeProject.aborted === true` 与 `retainedProjects` 不表示当前正在执行内容；若同 project 出现在 log 队列中，仅给对应 entry 增加“有进度”标签。

### baseline 状态

store 在 terraforming plan 内维护 archive executed baseline。baseline 是 archive 已执行状态的快照，用于比较未来 archive 变化。

建议结构：

```ts
interface TerraformingExecutedBaselineByCluster {
  [clusterId: string]: TerraformingExecutedSnapshot
}

interface TerraformingExecutedSnapshot {
  archiveGuid: string
  archiveTime: number
  completedProjects: Record<string, number>
  completedOneTimeEvents: Record<string, number>
  stats: Record<string, number>
  rebates: Array<{ id: string; type: 'ware' | 'wareGroup'; value: number }>
  activeProjectId?: string
}
```

baseline 不代表用户输入，不进入 task log 排序，也不得在首次读取 archive runtime 时自动写入。
当当前 cluster 没有 baseline 时，比较逻辑以空 baseline 作为对照，archive runtime 中已有的 completed project / 一次性 event 全部视为尚未确认的 archive 差额。只有用户直接确认扣除后的队列，或完成编辑保存后，才将当前 archive executed snapshot 写入 baseline。

live task log 提供“导入”动作，用于将蓝图 plan 中的 terraforming 设置复制到当前 live plan，并清空当前 live plan 的 baseline。非 live 模式不显示该动作。导入后下一次比较同样按空 baseline 处理，archive 已完成/正在执行状态必须重新由用户确认，不得在导入动作中自动同步 baseline。

## 扣除模型

扣除函数应放在 store/logic 或 presenter 可复用的纯逻辑模块中，避免 Vue 模板内拼装业务语义。

扣除输入不是 archive 全量已执行项，而是 `archiveRuntimeExecuted - syncedExecutedBaseline` 的正向差额。若当前 cluster 没有 baseline，`syncedExecutedBaseline` 按空快照处理；若当前 archive 已执行状态与保存 baseline 相同，扣除差额为空，`remainingLog === terraformingExecutionLog`，当前队列不产生新的扣除标记。

输入：

```ts
interface DeductExecutionInput {
  executionLog: TerraformingExecutionEntry[]
  executedDelta: {
    completedProjects: Map<string, number>
    completedOneTimeEvents: Map<string, number>
  }
  projectMap: Map<string, TerraformingProject>
}
```

输出：

```ts
interface DeductExecutionResult {
  remainingLog: TerraformingExecutionEntry[]
  currentQueueDisplayEntries: TerraformingCurrentQueueDisplaySource[]
  deductedEntries: TerraformingExecutedDisplaySource[]
  archiveOnlyEntries: TerraformingExecutedDisplaySource[]
  consumedProjects: Map<string, number>
  consumedOneTimeEvents: Map<string, number>
}
```

扣除过程：

1. 克隆 archive 可扣计数。
   - 这里的可扣计数来自 `executedDelta`，不是 archive 全量 completed。
2. 从左到右扫描 `terraformingExecutionLog`。
3. project：
   - 如果不是 event，按 `executedDelta.completedProjects` 可扣计数扣除。
   - 可扣则进入 `deductedEntries`，否则进入 `remainingLog`。
4. event：
   - 只有 `group === 'events' && repeatCooldown === null` 可扣。
   - 只有 `executedDelta.completedOneTimeEvents` 中的新增次数可扣。
   - 可扣则进入 `deductedEntries`，否则进入 `remainingLog`。
   - 可重复 event 永远进入 `remainingLog`，后续由 replay 重新判断 stale/trigger。
5. 扫描结束后，archive 剩余未消费的 completed project/one-time event 生成 `archiveOnlyEntries`。

`deductedEntries` 与 `archiveOnlyEntries` 只用于解释本次相对 baseline 的扣除差额和同步提醒，不作为“已执行”视图的唯一来源。

非编辑态当前队列显示还需要 `currentQueueDisplayEntries`：

- 每个原始 `terraformingExecutionLog` entry 都保留可视顺序。
- 被扣除 entry 标记为 `executed` 或 `occurred`。
- 未扣除 entry 标记为 `pending`，并对应 remaining replay 中的待执行项。
- `currentQueueDisplayEntries` 是展示模型，不是新的持久队列命名。
- replay、确认合法性和编辑态初始化只使用 `remainingLog`。

完成编辑或直接确认后，保存动作同时更新：

```text
terraformingExecutionLog = remainingLog 或编辑后的 draft
syncedExecutedBaseline = current archive executed snapshot
```

更新后，如果 archive 没有继续变化，下一次进入非编辑态时 `executedDelta` 为空，不再对同一批项目/一次性事件重复扣除，也不再产生新的 deducted display entries。

## replay 起点扩展

`replayExecutionLog()` 当前从 `cluster.initialStats` 和空 completed/rebates 开始。该 change 需要扩展 options：

```ts
interface ReplayBaseState {
  stats?: Record<string, number>
  completedProjects?: Map<string, number>
  completedEvents?: Map<string, number>
  rebates?: RebateKey[]
}

interface ReplayOptions {
  mode?: 'committed' | 'draft'
  flags?: ReplayFlags
  baseState?: ReplayBaseState
}
```

规则：

- 无 `baseState` 时保持现有行为。
- 有 `baseState.stats` 时，`runningStats` 从归一化后的 archive runtime stats 开始；静态初始存在但 save runtime 缺失的 stat 按 `0` 参与 replay 与展示。
- 有 `baseState.completedProjects` 时，`runningCompleted` 从该 map 开始。
- 有 `baseState.completedEvents` 时，仅用于一次性 event 的“已发生”状态，防止 replay 重复生成一次性 event。
- 有 `baseState.rebates` 时，`runningRebates` 从该累计值开始。
- `baseState.stats` 是权威当前值，不通过 completed project effects 重新推导。

replay 输入永远使用扣除后的 `remainingLog`。

```text
archiveRuntimeBaseState + remainingLog -> replayExecutionLog -> final timeline/state
```

## presenter 输出

presenter 增加 task log 所需展示模型：

```ts
interface TerraformingArchiveSyncNotice {
  deductedCount: number
  archiveOnlyCount: number
  hasArchiveAdvance: boolean
  hasArchiveRollbackRisk: boolean
  message: string
}

interface TerraformingExecutedDisplayEntry {
  id: string
  projectId: string
  projectName: string
  kind: 'project' | 'one-time-event'
  status: 'executed' | 'occurred'
  count: number
  source: 'archive-runtime'
}

interface TerraformingCurrentQueueDisplayEntry {
  id: string
  projectId: string
  projectName: string
  status: 'pending' | 'executed' | 'occurred'
  source: 'remaining-queue' | 'deducted-from-archive'
  replayEntryId?: string
  runtimeStatus?: 'active' | 'has-progress'
  fixedFirst?: boolean
}
```

resource panel props 可增加：

- `taskLogMode`
- `setTaskLogMode`
- `currentQueueDisplayEntries`
- `executedEntries`
- `archiveSyncNotice`
- `archiveActiveProjectDisplay`
- `archiveRetainedProjectDisplays`

`taskLogMode` 仅控制 task log 内部切换栏，不改变三栏页面布局。

`archiveActiveProjectDisplay` 与 `archiveRetainedProjectDisplays` 不应在 task log 两栏切换栏上方渲染成独立区域。它们只用于当前队列行的运行时标记：

- 非 aborted `activeProject` 固定生成当前队列第一行，标记“存档执行中”。
- aborted `activeProject` 不生成固定第一行。
- aborted active / retained project 若对应到当前队列 entry，给该 entry 增加“有进度”标签。

## task log 交互

### 当前队列模式

非编辑态初始进入时，当前队列模式显示 `currentQueueDisplayEntries`。通常它保留原 `terraformingExecutionLog` 的可视顺序；若 archive runtime 存在非 aborted `activeProject`，该 active project SHALL 固定为第一项：

- 非 aborted `activeProject` 标记“存档执行中”，作为 replay timeline 的第一步参与当前队列与编辑态推演。
- 非 aborted `activeProject` 在非编辑态与编辑态都固定显示为第一项，不进入 `draftExecutionLog`，不可移动、不可取消、不可编辑。
- 非 aborted `activeProject` 保留当前队列 task log 的普通项目展开形式。
- 如果同 project 原本位于队列后续位置，显示层将其提升到第一项，并避免在原位置重复显示。
- 已被 archive 扣除的 project 仍显示在原位置，标记“已执行”。
- 已被 archive 扣除的一次性 event 仍显示在原位置，标记“已发生”。
- 已执行/已发生 entry 可展开，但详情只显示资源消耗与交付清单，不显示折扣、建造和状态卡。
- 未扣除 entry 显示为待执行，并展示对应 `remainingLog` replay 结果。
- aborted active project、retained project 不生成独立队列项；若同 project 出现在当前 log 队列中，标记“有进度”。

该显示模式用于解释为什么当前队列被 archive 扣除。真正参与 replay 和确认的是 `remainingLog`。

多次执行 project 的可操作数量下限来自 archive runtime：

- `archiveRuntimeBaseState.completedProjects[projectId]` 是该 project 的最低完成次数。
- 非编辑态 toggle、undo、set count 等操作 SHALL NOT 将有效完成次数降到该最低值以下。
- UI 数字输入的 min SHOULD 使用该最低值；presenter/action 层仍必须进行 clamp，不能只依赖控件限制。

如果 `remainingLog` 合法：

- 非编辑态可直接确认。

如果 `remainingLog` 不合法：

- 显示进入编辑模式提示。

### 已执行模式

显示 `executedEntries`：

- 数据源直接是当前 archive runtime 的全量已完成 project 与全量一次性 event。
- project 标记“已执行”。
- 一次性 event 标记“已发生”。
- 即使 archive runtime 与 baseline 已经相同，已执行模式仍然显示 archive runtime 中的已完成内容；相同只表示本次没有新的扣除差额。
- archive 中队列外已完成项不会获得独立的第三种列表来源或排序语义，只作为 archive runtime 全量已执行内容的一部分展示。
- 已执行/已发生 entry 可展开，但存档没有每次完成时的折扣与建造快照，因此展开详情只显示资源消耗与交付清单，不显示折扣、建造和状态卡。

已执行模式不承载 active/retained resource progress 的独立卡片；active/retained 只通过当前队列行的“存档执行中”或“有进度”标签表达。

已执行模式是只读视图：

- 不提供取消 entry。
- 不参与拖拽排序。
- 不写入 `terraformingExecutionLog`。

## 编辑态

进入编辑态时：

```text
draftExecutionLog = remainingLog
```

不是：

```text
draftExecutionLog = terraformingExecutionLog
```

原因是 archive 已经执行的项目/一次性事件不应再次出现在未来队列中。

完成编辑时：

- 保存编辑后的 draft entries 到 `terraformingExecutionLog`。
- 不把 deducted/archive-only entries 写回正式队列。
- 更新后继续以 archive base state 重新扣除和 replay。

## archive 变化比较

当 archive runtime 与 `syncedExecutedBaseline` 比较：

- project/event 完成次数增加：`hasArchiveAdvance = true`。
- project/event 完成次数减少：`hasArchiveRollbackRisk = true`。
- stats/rebates/activeProject 变化：触发重新校验提示。

比较结果由 presenter 转成用户可读 notice。

同步 baseline 的动作发生在用户直接确认扣除结果或完成编辑保存时。实现也可以保留明确的同步入口，但不得在用户未确认队列结果时静默更新 baseline，否则会吞掉本次 archive 差额并导致无法解释扣除。

当当前 cluster 没有 baseline 时：

- 比较逻辑 SHALL 使用空 baseline。
- archive runtime 中已有的 completed project / 一次性 event SHALL 被视为 archive advance。
- 系统 SHALL NOT 因为首次读到 archive runtime 就自动写入 baseline。

导入蓝图设置后，后续比较回到“无 baseline”规则；该动作不得清空 archive runtime，也不得将 archive 已完成/正在执行状态自动标记为已同步。

## active 与 retained 展示

`activeProject` 展示为 archive runtime 状态：

- 正常 active：游戏中正在执行。
- `aborted=true`：正在取消。
- 显示 scaled/submitted/inTransit/inTransitShipBatches。

`retainedProjects` 展示为存档保留资源进度，不参与队列扣除，不作为已完成。

## 兼容性

- archive 缺少 `terraforming_clusters` 时，archive runtime base state 为空，页面保持现有从静态初始状态 replay 的行为。
- baseline 缺失时，将当前 archive runtime 视为初始同步候选，并显示需要同步的提示。
- blueprint 模式没有 live archive runtime，保持现有行为。

## 非目标

- 不在 view 层还原历史顺序。
- 不把 archive completed project/event 插入 `terraformingExecutionLog`。
- 不支持用户编辑已执行列表。
- 不修改 rust parser。
