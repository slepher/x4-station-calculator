# request.md - binding-live-view

## 目标

将 live save binding 中解析出的 terraforming runtime 接入现有 terraforming task log 与 replay 流程。页面继续保留现有 `terraformingExecutionLog` / `draftExecutionLog` 队列命名与交互模型，但队列计算起点改为当前 archive 的地球化运行时状态，并在 task log 内提供“当前队列 / 已执行”切换视图，帮助用户识别哪些项目或一次性事件已经在游戏存档中执行。

## 已确认方案（审核重点）

### 1. 数据来源与命名边界

- archive runtime 来源为 `SaveArchive.terraforming_clusters[clusterId]`。
- `clusterId` 通过 save runtime 的 key 与 `terraforming.json.clusters[].macro` 关联。
- 不引入 `userFutureQueue` 等新队列命名。
- 现有正式队列继续使用 `terraformingExecutionLog`。
- 现有编辑态队列继续使用 `draftExecutionLog`。
- 新增 archive/baseline 相关状态时，命名应表达其来源和用途，例如：
  - `archiveRuntimeExecuted`
  - `syncedExecutedBaseline`
  - `archiveRuntimeBaseState`
- `已执行` 列表不是用户维护状态，而是从当前 archive runtime 直接同步生成。

### 2. archive runtime 起始点

新队列 replay SHALL 从存档中的起始点开始计算，而不是从 terraforming 静态初始状态开始。

起始点包含：

- `baseStats`: 来自 `SaveTerraformingCluster.stats` 的归一化结果；静态 `cluster.initialStats` 中存在但 save runtime 缺失的 stat 记为 `0`
- `baseCompletedProjects`: 来自 `SaveTerraformingCluster.completedProjects`
- `baseCompletedOneTimeEvents`: 来自 `SaveTerraformingCluster.events` 中属于一次性事件的完成次数
- `baseRebates`: 来自 `SaveTerraformingCluster.rebates`
- `activeProject`: 来自 `SaveTerraformingCluster.activeProject`
- `retainedProjects`: 来自 `SaveTerraformingCluster.retainedProjects`
- `missionComplete`: 来自 `SaveTerraformingCluster.missionComplete`

`baseStats` 是存档权威值。实现不得先从静态初始 stats 加 completed project effects 重新推导，再覆盖成存档 stats。若某 stat 在静态初始状态存在、但当前 save runtime 没有该字段，系统 SHALL 将其解释为该 stat 已被存档清零。

### 3. 已执行列表同步与 baseline

- `已执行` 视图 SHALL 直接显示当前 archive runtime 中已完成的 project 与已发生的一次性 event。
- 如果 archive 中存在已完成 project/event，但用户当前队列中没有对应 entry，该项仍 SHALL 出现在 `已执行` 视图。
- 这些补进项不加入 `terraformingExecutionLog`，不参与当前队列排序，不可作为用户队列 entry 被取消。
- 系统 SHALL 保存 `syncedExecutedBaseline`，作为后续 archive 变化比较基准。
- `syncedExecutedBaseline` SHALL NOT 在首次读取 archive runtime 时自动同步。
- 若当前 cluster 尚无 `syncedExecutedBaseline`，系统 SHALL 以空 baseline 与当前 archive runtime 比较，并将 archive 当前已完成 project / 一次性 event 作为待确认差额。
- 当 archive runtime 更新时，系统 SHALL 将新的 archive executed 状态与 `syncedExecutedBaseline` 比较：
  - 新增完成项表示游戏中已经执行，应进入已执行视图，并作为本次扣除当前队列的差额来源。
  - 完成次数减少表示 archive 回退或切换到不一致存档，应提示风险。
  - stats/rebates/activeProject 与 baseline 不一致时，应提示存档状态已变化并重新校验队列。
- 用户确认同步后，`syncedExecutedBaseline` 更新为当前 archive executed 状态。
- live 模式页面 SHALL 提供“导入”按钮，用于将蓝图当前 cluster 的 terraforming 设置导入 live plan 同一 cluster，仅清空当前 cluster 的 `syncedExecutedBaseline`，使 archive 已完成/正在执行状态重新进入用户确认流程。
- 非 live 模式 SHALL NOT 显示该“导入”按钮。

### 4. 队列扣除规则

扣除是 archive runtime 相对 `syncedExecutedBaseline` 发生变化时的一次性对账动作，不是每次打开页面都按 archive 全量已执行项重复扣除。

非编辑态显示与 replay 前，系统 SHALL 先比较当前 archive 已执行状态与保存的 `syncedExecutedBaseline`：

- 若两者相同，说明当前 `terraformingExecutionLog` 已经与 archive 对齐，系统 SHALL NOT 执行扣除。
- 若 archive 相比 baseline 有新增 project/一次性 event 完成次数，系统 SHALL 只用新增差额对 `terraformingExecutionLog` 执行自动扣除。
- 若用户通过编辑或自动生成确认了新的队列，并同步保存 baseline，则后续 archive 与 baseline 相同的情况下不再出现扣除项。

扣除规则：

- 从左到右扫描 `terraformingExecutionLog`。
- project entry：
  - 若 archive 相对 baseline 新增的同 project 完成计数仍有可扣数量，则该 entry 从当前队列中扣除。
  - 被扣除 entry 在 `已执行` 视图显示，标记为“已执行”。
  - 扣除数量消耗本次 archive 差额 completed project 的可扣计数。
  - 扣完后的 remaining entries 继续留在当前队列。
- event entry：
  - 仅扣除一次性事件。
  - archive 相对 baseline 新发生的一次性事件可扣除同名 event entry。
  - 被扣除 event 在 `已执行` 视图显示，标记为“已发生”。
  - 可重复事件不通过 archive completed events 扣除。
- archive 差额中额外存在但队列里没有的完成项：
  - 补进 `已执行` 视图。
  - 标记为 archive 已存在。
  - 不加入当前队列。

扣除后的队列才进入 replay。非编辑态初始进入 task log 时，被扣除的原队列 entry 依旧 SHALL 在当前队列显示列表中保留原位置，但标记为“已执行”或“已发生”；这些 entry 只用于解释 archive 扣除结果，不参与 replay、不参与确认合法性判断，也不可被当作待执行 entry 取消。

### 5. event 重新生成规则

- event 的权威未来序列仍由 replay 引擎根据当前状态和 remaining queue 自动生成。
- archive 只用于扣除已发生的一次性 event。
- 可重复 event 不从 archive 扣除，未来是否发生由 replay 重新判断。
- stale/misplaced event 的处理继续遵循现有 `terraforming-replay` 规则。
- 扣除完成后，系统 SHALL 以 archive 起始点 + remaining queue 重新生成未来 events。

### 6. task log 切换栏

右列 task log 不改为三栏结构。

task log 内部新增一个切换栏，用于在同一面板内切换：

- 当前队列：非编辑态初始显示原队列的可视顺序，其中已被 archive 扣除的 entry 依旧显示并标记为“已执行”/“已发生”，未扣除 entry 显示为仍需执行；replay 和确认只基于扣除后的 remaining queue。
- 已执行：直接显示当前 archive runtime 全量已完成 project 与一次性 event。扣除差额只影响当前队列扣除，不得作为已执行视图是否为空的唯一来源。

切换栏不得改变 task log 的面板布局归属，也不得把已执行项混入当前队列排序。

### 7. 非编辑态确认规则

- 如果扣除后的 remaining queue replay 合法，用户可以直接确认当前队列。
- 如果扣除后的 remaining queue replay 不合法，页面 SHALL 提醒用户进入编辑模式。
- 非编辑态初始进入时，当前队列显示列表 SHALL 保留被扣除 entry，并用“已执行”/“已发生”标记说明这些项已由 archive 覆盖。
- 若 archive 已执行状态与 `syncedExecutedBaseline` 相同，当前队列显示列表 SHALL 不再显示新的扣除项，直接展示已对齐后的 `terraformingExecutionLog`。
- 对多次执行 project，archive runtime 中已完成次数 SHALL 作为用户操作下限；用户不得通过减少次数、撤销或设置数量，把该 project 的完成次数降到 archive 已完成次数以下。
- 页面 SHALL 显示 archive 同步提醒，例如：
  - 存档已执行项目/事件数量。
  - 当前队列已自动扣除数量。
  - archive 相比 baseline 是否有新增执行项或回退风险。

### 8. 编辑态规则

- 进入编辑态时，`draftExecutionLog` SHALL 初始化为扣除后的 remaining queue。
- 被 archive 扣除的 entry 不进入 `draftExecutionLog`。
- 已执行视图继续作为只读 archive 基线展示。
- 用户只编辑未来队列。
- 完成编辑后，保存回 `terraformingExecutionLog` 的是编辑后的未来队列，不包含已执行项。
- 完成编辑或直接确认后，系统 SHALL 将 `syncedExecutedBaseline` 更新为当前 archive 已执行状态；因此下一次 archive 未变化时不会再次扣除同一批项目或事件。

### 9. activeProject 与 retainedProjects 展示

- 若 archive runtime 存在 `activeProject` 且 `activeProject.aborted !== true`，页面 SHALL 将该 project 作为当前正在执行内容，固定显示为“当前队列”视图第一项。
- 当前正在执行内容 SHALL 作为 replay timeline 的第一步参与当前队列与编辑态推演。
- 当前正在执行内容不可移动、不可取消、不可编辑，不进入 `draftExecutionLog`，也不得写入 `terraformingExecutionLog`。
- 当前正在执行内容在非编辑态和编辑态都 SHALL 固定显示为第一项，并使用当前队列 task log 的普通项目展开形式展示。
- 如果同一个 project 已经存在于 `terraformingExecutionLog` 的后续位置，当前队列显示 SHALL 将其提升为第一项，并避免在原位置重复显示。
- 若 `activeProject.aborted === true`，该 project SHALL NOT 被视为当前正在执行内容，也 SHALL NOT 固定为当前队列第一项。
- 若 `activeProject.aborted === true` 或 project 存在于 `retainedProjects`，并且同 project 出现在当前 log 队列中，页面 SHALL 在该 log entry 上标记“有进度”。
- `retainedProjects` 不应被视为已完成队列 entry，不独立加入当前队列，不进入 `draftExecutionLog`。
- active/retained 资源进度不得直接写入 `terraformingExecutionLog`。

### 10. 重复 project 的实例级交互

- 同一个 project 在 task log 中多次出现时，每一次执行 SHALL 保留独立 entry identity。
- 非编辑态 replay timeline 与编辑态 plan entries 都 SHALL 按执行实例绑定显示 id，而不是用 `projectId` 合并多次执行。
- 展开、状态显示、移除、拖拽、复制等 UI 状态和操作 SHALL 作用于点击到的 entry 实例。
- 编辑态点击移除重复 project 的某一项时，系统 SHALL 只移除该 entry，不得移除同 project 的其他执行实例。

## 边界

### In Scope

- `useTerraformingStore` 接入当前 archive 的 `terraforming_clusters` runtime。
- 扩展 terraforming replay 起始状态，支持从 archive base state 开始。
- 按 archive executed 状态扣除 `terraformingExecutionLog`。
- 维护 `syncedExecutedBaseline` 用于后续 archive 变化比较。
- task log 内部新增“当前队列 / 已执行”切换栏。
- 已执行视图直接显示 archive runtime 全量已完成 project 与一次性 event；被扣除队列项和队列外完成项都通过同一 archive runtime 来源出现。
- 非编辑态根据扣除后队列判断是否可直接确认。
- 编辑态从扣除后队列初始化 `draftExecutionLog`。
- activeProject、aborted、retainedProjects 的运行时状态提示。
- `npm run build` 无编译错误。

### Out of Scope

- 修改 rust parser 的 terraforming runtime 提取逻辑。
- 修改 `terraforming.json` 静态数据生成。
- 将 archive 历史完成项还原为真实历史执行顺序。
- 将已执行项写入 `terraformingExecutionLog`。
- 用户手动编辑 archive 已执行列表。
- 测试代码编写。
- 运行测试。

## 验收标准（DoD）

1. live archive 存在 `terraforming_clusters` 时，terraforming 页面以对应 cluster 的 runtime stats/completed/rebates 作为 replay 起点。
2. `terraformingExecutionLog` 命名和持久语义保持不变，不新增 `userFutureQueue` 命名。
3. project entry 只按 archive 相对 `syncedExecutedBaseline` 新增的 completed project 差额从当前队列中扣除。
4. 一次性 event entry 只按 archive 相对 `syncedExecutedBaseline` 新增的一次性 event 差额扣除。
5. 可重复 event 不按 archive 扣除，而是由扣除后的 replay 重新生成。
6. archive 中额外存在但队列中没有的完成项出现在“已执行”视图，但不加入当前队列。
7. archive runtime 中的 project/event 在“已执行”视图中分别标记为“已执行”/“已发生”；已执行视图不得只依赖本次扣除差额。
8. 已执行/已发生 entry 可以展开，但详情只显示资源消耗与交付清单，不显示折扣、建造和状态卡。
9. 非编辑态初始进入 task log 时，被扣除的原队列 entry 依旧在当前队列显示列表中保留原位置，并分别标记为“已执行”/“已发生”。
10. 被扣除 entry 不参与 replay、不参与确认合法性判断，也不可被当作待执行 entry 取消。
11. task log 内部提供“当前队列 / 已执行”切换栏，且不改成三栏布局。
12. 进入编辑态时，`draftExecutionLog` 使用扣除后的 remaining queue 初始化。
13. 完成编辑后，保存到 `terraformingExecutionLog` 的内容不包含已执行项。
14. 完成编辑或直接确认后，`syncedExecutedBaseline` 更新为当前 archive 已执行状态；archive 未变化时再次进入页面不再重复扣除。
15. `syncedExecutedBaseline` 可用于比较后续 archive runtime 变化，并能识别新增执行项与回退风险。
16. 非 aborted activeProject 作为 replay timeline 第一项固定显示在非编辑态和编辑态，且不可移动、不可取消、不可编辑，并保留普通 task log 展开形式。
17. aborted activeProject 不视为当前正在执行内容；aborted/retained 对应项目若出现在 log 队列中，仅在该 entry 上标记“有进度”。
18. 扣除后的 remaining queue 合法时，用户可直接确认；不合法时提示进入编辑模式。
19. 多次执行 project 的用户可操作次数不得低于 archive runtime 已完成次数。
20. 重复 project 在非编辑态和编辑态都保留实例级 display id；展开、状态、移除等行为不得按 `projectId` 串联或批量作用到全部重复项。
21. `npm run build` 成功。

## 未决项

无。
