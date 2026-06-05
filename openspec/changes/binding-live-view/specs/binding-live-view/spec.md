# Binding Live View Specification

## Purpose

将 live save binding 中的 terraforming runtime 作为 terraforming task log 的现实基线，使现有队列从当前存档状态继续 replay，并在 task log 内部区分当前队列与 archive 已执行项目/一次性事件。

## ADDED Requirements

### Requirement: Archive Runtime Base State

系统 SHALL 将当前 live archive 中的 terraforming runtime 作为 terraforming replay 的可选起始状态。

#### Scenario: use archive runtime as replay base

- **前提** 当前 live archive 包含 `terraforming_clusters[clusterId]`
- **并且** 当前选中 terraforming cluster 的 `macro` 与该 `clusterId` 匹配
- **当** 页面计算当前 task log replay
- **那么** replay SHALL 从 archive runtime 的 `stats`、`completedProjects`、一次性 `events` 和 `rebates` 开始
- **并且** replay SHALL NOT 从静态 `cluster.initialStats` 和空 completed 状态开始

#### Scenario: archive stats are authoritative

- **前提** archive runtime 包含 `stats`
- **当** 构造 replay 起始状态
- **那么** `stats` SHALL 直接作为权威起始值
- **并且** 系统 SHALL NOT 先用 completed project effects 从静态初始状态重新推导 stats 再覆盖

#### Scenario: missing archive stat that exists initially is zero

- **前提** 静态 `cluster.initialStats` 包含 `toxicity = 3`
- **并且** archive runtime 的 `stats` 不包含 `toxicity`
- **当** 构造 replay 起始状态
- **那么** `baseState.stats.toxicity` SHALL 为 `0`
- **并且** 系统 SHALL NOT 将该 stat 视为不存在

#### Scenario: missing archive runtime keeps existing behavior

- **前提** 当前 archive 不包含匹配的 `terraforming_clusters`
- **当** 页面计算 terraforming replay
- **那么** 系统 SHALL 保持现有从静态 cluster 初始状态计算的行为

### Requirement: Preserve Existing Queue Names

系统 SHALL 保留现有 terraforming 队列命名与持久语义。

#### Scenario: keep committed queue name

- **前提** 系统保存正式 terraforming 队列
- **当** 引入 archive runtime 基线
- **那么** 正式队列 SHALL 继续使用 `terraformingExecutionLog`
- **并且** 系统 SHALL NOT 引入 `userFutureQueue` 作为新队列命名

#### Scenario: keep draft queue name

- **前提** 用户进入 task log 编辑模式
- **当** 系统初始化编辑态队列
- **那么** 编辑态队列 SHALL 继续使用 `draftExecutionLog`

### Requirement: Executed Items Synced From Archive

已执行列表 SHALL 直接同步自当前 archive runtime，并作为后续 archive 变化比较的基准来源。

#### Scenario: show archive completed project in executed view

- **前提** archive runtime 的 `completedProjects` 包含 `project_a` 完成 1 次
- **当** 用户打开 task log 的已执行视图
- **那么** 已执行视图 SHALL 显示 `project_a`
- **并且** 该项 SHALL 标记为已执行

#### Scenario: show archive one-time event in executed view

- **前提** archive runtime 的 `events` 包含一次性 event `event_a` 完成 1 次
- **当** 用户打开 task log 的已执行视图
- **那么** 已执行视图 SHALL 显示 `event_a`
- **并且** 该项 SHALL 标记为已发生

#### Scenario: archive-only executed item does not enter queue

- **前提** archive runtime 包含已完成 `project_a`
- **并且** `terraformingExecutionLog` 中没有 `project_a`
- **当** 系统生成已执行视图
- **那么** `project_a` SHALL 出现在已执行视图
- **并且** `project_a` SHALL NOT 被插入 `terraformingExecutionLog`
- **并且** `project_a` SHALL NOT 参与当前队列排序

#### Scenario: executed view uses archive runtime instead of delta

- **前提** archive runtime 的 `completedProjects` 包含 `project_a` 完成 1 次
- **并且** `syncedExecutedBaseline` 也包含 `project_a` 完成 1 次
- **当** 用户打开 task log 的已执行视图
- **那么** 已执行视图 SHALL 显示 `project_a`
- **并且** 系统 SHALL NOT 仅使用 `archiveRuntimeExecuted - syncedExecutedBaseline` 的差额作为已执行视图数据源

### Requirement: Deduct Queue By Archive Executed Counts

系统 SHALL 在 replay 前使用 archive 相对 `syncedExecutedBaseline` 的新增已执行项目和新增一次性事件扣除 `terraformingExecutionLog`。

#### Scenario: deduct completed project from current queue

- **前提** `syncedExecutedBaseline` 中 `project_a` 完成次数为 0
- **并且** archive runtime 显示 `project_a` 已完成 1 次
- **并且** `terraformingExecutionLog` 中包含一个 `project_a` entry
- **当** 系统计算当前队列
- **那么** 该 `project_a` entry SHALL 从当前队列扣除
- **并且** 非编辑态当前队列显示列表 SHALL 继续在原位置显示该 entry，并标记为已执行
- **并且** 该 entry SHALL 出现在已执行视图并标记为已执行
- **并且** 扣除后的 remaining queue SHALL 用于 replay

#### Scenario: partial deduction for repeated project

- **前提** `syncedExecutedBaseline` 中 `project_a` 完成次数为 1
- **并且** archive runtime 显示 `project_a` 已完成 2 次
- **并且** `terraformingExecutionLog` 中包含两个 `project_a` entry
- **当** 系统计算当前队列
- **那么** 第一个可扣 `project_a` entry SHALL 被扣除
- **并且** 非编辑态当前队列显示列表 SHALL 继续显示被扣除 entry 并标记为已执行
- **并且** 第二个 `project_a` entry SHALL 保留在 remaining queue

#### Scenario: deduct only one-time event

- **前提** `syncedExecutedBaseline` 中一次性 event `event_a` 未发生
- **并且** archive runtime 显示一次性 event `event_a` 已发生
- **并且** `terraformingExecutionLog` 中包含 `event_a`
- **当** 系统计算当前队列
- **那么** `event_a` SHALL 被扣除
- **并且** 非编辑态当前队列显示列表 SHALL 继续在原位置显示该 event，并标记为已发生
- **并且** `event_a` SHALL 显示在已执行视图
- **并且** 扣除后的 replay SHALL 根据 remaining queue 重新生成未来 events

#### Scenario: do not deduct repeatable event from archive

- **前提** archive runtime 包含可重复 event `event_repeat`
- **并且** `terraformingExecutionLog` 中包含 `event_repeat`
- **当** 系统计算当前队列
- **那么** 系统 SHALL NOT 因 archive runtime 扣除该 event
- **并且** 该 event 的未来状态 SHALL 由 replay 引擎重新判断

#### Scenario: do not deduct when archive matches baseline

- **前提** archive runtime 的 completed project 与一次性 event 计数和 `syncedExecutedBaseline` 相同
- **并且** `terraformingExecutionLog` 中包含 `project_a`
- **当** 系统计算当前队列
- **那么** 系统 SHALL NOT 因 archive 全量已完成状态扣除 `project_a`
- **并且** 当前队列显示列表 SHALL NOT 产生新的已执行扣除标记
- **并且** replay SHALL 直接使用现有 `terraformingExecutionLog`

#### Scenario: repeated project cannot be reduced below archive completed count

- **前提** archive runtime 显示 `project_a` 已完成 2 次
- **并且** 页面中 `project_a` 的有效完成次数为 3
- **当** 用户将 `project_a` 的次数设置为 0 或连续撤销该项目
- **那么** 系统 SHALL 将 `project_a` 的有效完成次数保留为至少 2
- **并且** 系统 SHALL NOT 从队列操作中删除 archive runtime 已完成的 2 次
- **并且** UI 数字输入 SHOULD 以 2 作为最小值

### Requirement: Task Log Mode Toggle

task log SHALL 在同一面板内部提供当前队列与已执行视图切换。

#### Scenario: switch between current queue and executed view

- **前提** task log 已渲染
- **当** 用户点击切换栏的“当前队列”
- **那么** task log SHALL 显示当前队列可视列表
- **并且** 被 archive 扣除的 entries SHALL 依旧显示并标记为已执行或已发生
- **并且** 未扣除 entries SHALL 显示为仍需执行并承载扣除后的 replay 结果
- **当** 用户点击切换栏的“已执行”
- **那么** task log SHALL 显示 archive runtime 同步出的已执行 project 与一次性 event

#### Scenario: deducted entries do not affect replay in current queue view

- **前提** 非编辑态当前队列显示列表包含一个已标记为已执行的 deducted entry
- **当** 系统计算 replay、确认合法性或进入编辑模式
- **那么** 该 deducted entry SHALL NOT 参与 replay
- **并且** 该 deducted entry SHALL NOT 参与确认合法性判断
- **并且** 该 deducted entry SHALL NOT 进入 `draftExecutionLog`

#### Scenario: do not change to three-column layout

- **前提** task log 增加当前队列/已执行切换
- **当** 页面渲染 terraforming 三栏布局
- **那么** 右列 task log SHALL 保持原面板结构
- **并且** 系统 SHALL NOT 将 task log 改成三栏切换布局

#### Scenario: executed view is read-only

- **前提** 用户打开已执行视图
- **当** 页面显示已执行 entries
- **那么** 已执行 entries SHALL NOT 提供取消按钮
- **并且** 已执行 entries SHALL NOT 支持拖拽排序
- **并且** 已执行 entries SHALL NOT 写入 `terraformingExecutionLog`

#### Scenario: executed entry expands with consumed resources and delivery list

- **前提** 用户打开已执行视图
- **并且** 已执行 project `project_a` 有资源消耗
- **当** 用户展开 `project_a`
- **那么** 页面 SHALL 显示资源消耗列表
- **并且** 页面 SHALL 显示交付清单
- **并且** 页面 SHALL NOT 显示折扣卡
- **并且** 页面 SHALL NOT 显示建造卡
- **并且** 页面 SHALL NOT 显示状态卡

#### Scenario: repeated current queue entries keep instance identity

- **前提** 当前队列中存在同一 project 的多个执行实例
- **当** 页面显示非编辑态 task log timeline
- **那么** 每个显示 entry SHALL 使用对应执行实例的独立 id
- **并且** 展开状态 SHALL 只作用于被点击的 entry
- **并且** 状态显示 SHALL 对应该 entry 的 replay 步骤
- **并且** 系统 SHALL NOT 仅用 `projectId` 合并这些重复 entries

### Requirement: Edit Mode Starts From Deducted Queue

编辑模式 SHALL 从 archive 扣除后的 remaining queue 开始。

#### Scenario: initialize draft from remaining queue

- **前提** `terraformingExecutionLog` 中部分 entries 已被 archive runtime 扣除
- **当** 用户进入编辑模式
- **那么** `draftExecutionLog` SHALL 使用扣除后的 remaining queue 初始化
- **并且** 被扣除 entries SHALL NOT 进入 `draftExecutionLog`

#### Scenario: remove one repeated draft entry

- **前提** 用户处于编辑模式
- **并且** `draftExecutionLog` 中存在同一 project 的多个执行实例
- **当** 用户点击其中一个重复 project entry 的移除操作
- **那么** 系统 SHALL 只移除被点击的 entry 实例
- **并且** 系统 SHALL 保留同 project 的其他 draft entries
- **并且** 系统 SHALL NOT 按 `projectId` 移除所有重复项

#### Scenario: save edited future queue only

- **前提** 用户在编辑模式中修改 draft queue
- **当** 用户完成编辑
- **那么** 系统 SHALL 只将编辑后的未来 entries 保存到 `terraformingExecutionLog`
- **并且** 系统 SHALL NOT 将 archive 已执行 entries 写入 `terraformingExecutionLog`
- **并且** 系统 SHALL 将 `syncedExecutedBaseline` 更新为当前 archive executed snapshot

#### Scenario: save repeated draft entries with instance ids

- **前提** 用户处于编辑模式
- **并且** draft 中存在新建的重复 project entries
- **当** 用户完成编辑并保存
- **那么** 保存到 `terraformingExecutionLog` 的 entries SHALL 保留各自的实例 id
- **并且** 后续非编辑态 timeline SHALL 能按实例 id 展开和显示状态
- **并且** 系统 SHALL NOT 将新建 entries 保存为空 id 或仅保存为 `projectId`

#### Scenario: no repeated deduction after edit save

- **前提** 用户完成编辑后 `syncedExecutedBaseline` 已更新为当前 archive executed snapshot
- **并且** archive runtime 没有继续变化
- **当** 用户再次进入非编辑态 task log
- **那么** 系统 SHALL NOT 再次扣除同一批已执行 project 或一次性 event
- **并且** 当前队列显示列表 SHALL 不再显示新的扣除项

### Requirement: Archive Executed Baseline Comparison

系统 SHALL 保存已同步 archive executed baseline，并使用它检测后续 archive runtime 变化。

#### Scenario: detect archive advance

- **前提** baseline 中 `project_a` 完成次数为 1
- **并且** 新 archive runtime 中 `project_a` 完成次数为 2
- **当** 系统比较 archive runtime 与 baseline
- **那么** 系统 SHALL 标记 archive 有新增执行项
- **并且** 新增完成次数 SHALL 可用于扣除当前队列

#### Scenario: detect archive rollback risk

- **前提** baseline 中 `project_a` 完成次数为 2
- **并且** 新 archive runtime 中 `project_a` 完成次数为 1
- **当** 系统比较 archive runtime 与 baseline
- **那么** 系统 SHALL 标记 archive 回退或不一致风险

#### Scenario: sync baseline after user confirmation

- **前提** 当前 archive runtime 与 baseline 存在差异
- **当** 用户直接确认扣除后的队列或完成编辑保存
- **那么** `syncedExecutedBaseline` SHALL 更新为当前 archive runtime 的 executed snapshot

#### Scenario: missing baseline compares against empty snapshot

- **前提** 当前 cluster 没有 `syncedExecutedBaseline`
- **并且** archive runtime 的 `completedProjects` 包含 `project_a` 完成 1 次
- **当** 系统比较 archive runtime 与 baseline
- **那么** 系统 SHALL 按空 baseline 计算差额
- **并且** `project_a` SHALL 被视为 archive 新增完成项
- **并且** 系统 SHALL NOT 在用户确认或完成编辑保存前自动写入 `syncedExecutedBaseline`

#### Scenario: import blueprint settings resets archive confirmation

- **前提** 当前 cluster 已保存 `syncedExecutedBaseline`
- **并且** 页面处于 live 模式
- **并且** 蓝图 plan 中存在 terraforming 设置
- **当** 用户点击“导入”按钮
- **那么** 系统 SHALL 将蓝图 terraforming 设置导入当前 live plan
- **并且** 系统 SHALL 清空当前 live plan 的 `syncedExecutedBaseline`
- **并且** 系统 SHALL NOT 删除 archive runtime 中的已完成项目、已发生事件或正在执行项目
- **并且** 系统 SHALL NOT 在导入时自动确认 archive 已执行状态
- **并且** 系统 SHALL NOT 修改 `terraformingExecutionLog`

#### Scenario: hide blueprint import outside live mode

- **前提** 页面不处于 live 模式
- **当** task log 渲染
- **那么** 页面 SHALL NOT 显示“导入”按钮

### Requirement: Active And Retained Runtime Display

页面 SHALL 将 archive runtime 中的非 aborted active project 展示为当前队列首项，并将 aborted/retained 进度作为对应 log entry 的额外标签展示。

#### Scenario: display non-aborted active project as fixed current queue head

- **前提** archive runtime 包含 `activeProject`
- **并且** `activeProject.aborted !== true`
- **当** 页面显示 terraforming task log 或项目状态
- **那么** 该 project SHALL 固定显示为“当前队列”视图第一项
- **并且** 该 project SHALL 标识为游戏中正在执行
- **并且** 该 project SHALL 作为 replay timeline 第一项参与后续队列推演
- **并且** 该 project SHALL 使用当前队列 task log 的普通项目展开形式
- **并且** 该 project SHALL NOT 提供取消按钮
- **并且** 该 project SHALL NOT 支持拖拽排序
- **并且** 该 project SHALL NOT 进入 `draftExecutionLog`
- **并且** 该 project SHALL NOT 写入 `terraformingExecutionLog`

#### Scenario: display active project as fixed edit head

- **前提** archive runtime 包含非 aborted `activeProject.projectId = project_a`
- **当** 用户进入编辑模式
- **那么** `project_a` SHALL 显示为编辑态 task log 第一项
- **并且** `project_a` SHALL NOT 支持拖拽排序
- **并且** `project_a` SHALL NOT 提供删除或复制操作
- **并且** 保存编辑结果时 `project_a` SHALL NOT 写入 `terraformingExecutionLog`
- **并且** 添加任务到首位 SHALL 将新任务插入到 `project_a` 之后

#### Scenario: promote queued active project to current queue head

- **前提** archive runtime 包含非 aborted `activeProject.projectId = project_a`
- **并且** `terraformingExecutionLog` 中的 `project_a` 位于第一项之后
- **当** 页面显示“当前队列”视图
- **那么** `project_a` SHALL 显示为当前队列第一项
- **并且** `project_a` SHALL NOT 在原队列位置重复显示

#### Scenario: display aborting active project

- **前提** archive runtime 包含 `activeProject.aborted = true`
- **并且** `terraformingExecutionLog` 包含同 project entry
- **当** 页面显示“当前队列”视图
- **那么** 该 entry SHALL NOT 固定为第一项
- **并且** 该 entry SHALL 标记为“有进度”
- **并且** 该 entry SHALL NOT 标记为当前正在执行

#### Scenario: retained project marks matching queue entry as progressed

- **前提** archive runtime 包含 `retainedProjects`
- **并且** `terraformingExecutionLog` 包含同 project entry
- **当** 系统生成当前队列和已执行视图
- **那么** retained project SHALL NOT 作为独立卡片显示在 task log 两栏上方
- **并且** retained project SHALL NOT 被写入 `terraformingExecutionLog`
- **并且** retained project SHALL NOT 被视为已完成 entry
- **并且** 当前队列中的同 project entry SHALL 标记为“有进度”
