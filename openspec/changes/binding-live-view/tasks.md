# tasks.md - binding-live-view

## 实施任务

### 1. store 接入 archive terraforming runtime

- [x] 在 `useTerraformingStore` 中读取当前 live archive 对应的 `terraforming_clusters`。
- [x] 通过 `selectedCluster.macro` 与 `SaveTerraformingCluster.clusterId` 关联 runtime。
- [x] 构造 archive runtime base state：stats、completedProjects、completedOneTimeEvents、rebates、activeProject、retainedProjects、missionComplete。
- [x] blueprint 模式或缺少 runtime 时保持现有行为。

### 2. 维护 synced executed baseline

- [x] 扩展 terraforming plan 持久结构，按 cluster 保存 `syncedExecutedBaseline`。
- [x] baseline 保存 archive guid/time、completedProjects、completedOneTimeEvents、stats、rebates、activeProjectId。
- [x] 实现 archive runtime 与 baseline 的比较逻辑。
- [x] 识别 archive 新增完成项、完成次数减少风险、stats/rebates/activeProject 变化。
- [x] 从 archive runtime 与 baseline 计算正向 `executedDelta`，作为唯一扣除输入。
- [x] 当前 cluster 没有 baseline 时，以空 baseline 比较 archive runtime，不自动写入 baseline。
- [x] 完成编辑或直接确认后，将 baseline 更新为当前 archive executed snapshot。
- [x] archive runtime 与 baseline 相同时，确保不会再次扣除同一批项目/一次性事件。
- [x] 提供明确的同步 baseline action 或确认保存路径，但不得静默吞掉未确认差额。
- [x] 增加调试 action，用于清空当前 cluster 已同步 baseline。

### 3. 实现队列扣除逻辑

- [x] 新增纯逻辑函数，对 `terraformingExecutionLog` 执行 `executedDelta.completedProjects` 扣除。
- [x] 仅对一次性 event 执行 `executedDelta.completedOneTimeEvents` 扣除。
- [x] 扣除函数不得使用 archive 全量 completed 作为可扣计数。
- [x] `executedDelta` 为空时，`remainingLog` 保持等于原 `terraformingExecutionLog`，不产生新的扣除项。
- [x] 可重复 event 不按 archive 扣除。
- [x] 输出 `remainingLog`、当前队列显示 entries、被扣除 entries、archive-only entries 和消费计数。
- [x] 当前队列显示 entries 保留原 `terraformingExecutionLog` 可视顺序，并将扣除项标记为已执行/已发生。
- [x] archive 中存在但队列中没有的完成项进入 archive-only executed display。
- [x] 多次执行 project 的减少/撤销/设值操作不得低于 archive runtime 已完成次数。

### 4. 扩展 replay 起始状态

- [x] 扩展 `replayExecutionLog()` options，支持 `baseState`。
- [x] `baseState.stats` 作为权威起始 stats。
- [x] `baseState.completedProjects` 作为 replay 起始 completed counts。
- [x] `baseState.completedEvents` 用于防止一次性 event 重复触发。
- [x] `baseState.rebates` 作为 replay 起始 cumulative rebates。
- [x] 无 baseState 时保持现有 replay 行为。

### 5. presenter 组装 task log runtime 视图

- [x] presenter 使用扣除后的 `remainingLog` 生成当前队列 timeline。
- [x] presenter 生成当前队列显示 entries，使非编辑态初始进入时扣除项依旧显示但带已执行/已发生标记。
- [x] presenter 生成 `executedEntries`，直接同步当前 archive runtime 全量已完成项目和一次性事件。
- [x] presenter 生成 archive sync notice。
- [x] presenter 生成 activeProject 和 retainedProjects 展示模型。
- [x] presenter 提供 task log 内部切换状态与切换 action。

### 6. 更新 task log UI

- [x] 在 `TerraformingResourcePanel` task log 内部增加“当前队列 / 已执行”切换栏。
- [x] 当前队列视图在非编辑态显示原队列可视顺序，扣除项依旧显示并标记为已执行/已发生。
- [x] 当前队列视图的 replay、确认合法性和操作入口只作用于未扣除 entries。
- [x] 已执行视图显示 archive runtime 同步出的已执行项目/一次性事件。
- [x] 已执行视图中的项目标记为“已执行”，一次性事件标记为“已发生”。
- [x] 队列外完成项通过 archive runtime 全量已执行列表展示，不加入当前队列。
- [x] 已执行视图不提供取消、拖拽、排序操作。
- [x] 保持右列面板结构，不改成三栏布局。
- [x] 增加调试按钮，用于清空当前 cluster 同步的已执行 baseline。

### 7. 编辑态接入扣除结果

- [x] 进入编辑态时使用 `remainingLog` 初始化 `draftExecutionLog`。
- [x] 被 archive 扣除的 entries 不进入 draft。
- [x] 完成编辑时只保存编辑后的未来 entries 到 `terraformingExecutionLog`。
- [x] 完成编辑后同步 `syncedExecutedBaseline` 到当前 archive executed snapshot。
- [x] 完成编辑后重新计算 replay；若 archive 未变化，不再重复扣除已同步项。

### 8. 文案与 i18n

- [x] 增加当前队列、已执行、已发生、archive 已存在、游戏中正在执行、正在取消等 i18n 文案。
- [x] 增加 archive 已执行数量、自动扣除数量、archive 回退风险、需要重新校验等提示文案。

### 9. 构建验证

- [x] 执行 `npm run build`。
- [x] 若出现编译错误，修复后重新执行 `npm run build`，直到通过或记录明确 blocker。
