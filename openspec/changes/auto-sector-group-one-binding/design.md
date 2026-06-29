# auto-sector-group-one-binding Design

## 架构

```text
useLiveProductionStore
  owns current shared draft
  owns initAutoGroupDraft()
  owns needsAutoGroupRecalc

useAutoSectorGroupPresenter
  reads store refs
  assembles UI state
  orchestrates explicit user actions

Vue panels
  render and emit
```

Store 是共享 draft 的所有者。Presenter 可以保留交互 handler，但不得创建第二份跨面板共享数据。

## Store 状态

```ts
autoGroupResult: ShallowRef<AutoGroupResult | null>
calculationMode: Ref<'result' | 'edit'>
prefJumpRange: Ref<number>
bridgeSearchJumpRange: Ref<number>
prefThreshold: Ref<number>
calcBaselinePillState: Ref<CalcBaselinePillState | null>
calculationBaseline: Ref<CalculationBaseline | null>
needsAutoGroupRecalc: Computed<boolean>
virtualStationDrafts: Ref<BindingStationPlan[]>
virtualStationDraftInitializedKey: Ref<string | null>
```

Presenter 仍可持有 UI 辅助状态，但共享草案和重置快照不得离开 live store。当前设计保留以下 presenter-local 状态：

- `nodeEnabled`: 下一次计算是否允许生成新 pure hub。
- `showHubAddMenu`: 添加 hub 菜单显示状态。
- `activeTab`: AutoSectorGroupPanel 内的 `hub | allocation | tradeStation` 当前页。

`bridgeRetainEnabled` / `coverageRetainEnabled` / `tradeStationRetainEnabled` 为派生态，不是独立真值；它们由当前 `autoGroupResult.groups` 聚合得出。mixed 状态时，新增 hub 默认取 `false`。

`needsAutoGroupRecalc`：

```ts
appliedAutoGroupArchiveTime === undefined
  || appliedAutoGroupArchiveTime < selectedArchive.meta.time
```

## 初始化

`initAutoGroupDraft()`：

1. 无 active binding 或 selected archive 时清空 draft。
2. `needsAutoGroupRecalc=true`：
   - binding 有 groups：incremental。
   - binding 无 groups：clean slate。
3. `needsAutoGroupRecalc=false`：
   - `buildAssignmentsFromBinding()`。
   - 不运行 grouping algorithm。
   - 不改变 group 结构。
4. 富化本地化名称、颜色上下文、trade station 展示状态。
5. 预计算所有 player sector 的 station 候选列表 `sectorStationCandidates`。
6. 写入 `calcBaselinePillState`。
7. 设置 `calculationMode='result'`。

### sectorStationCandidates 预计算

`AutoGroupResult` 新增 `sectorStationCandidates: Record<string, TradeStationCandidate[]>`，为每个 player sector 预计算 station 候选列表。

- 在 `groupCleanSlate` / `groupIncremental` / `buildAssignmentsFromBinding` 生成 result 时，遍历所有 player sector 的空间站，使用 `selectTradeStationCandidates` 生成候选列表。
- 候选列表按 score 排序，与 Trade Station 栏使用同一数据源。
- Vue Trade Station 栏从该预计算数据按当前 hub group 的 `sectorMacro` 过滤显示。
- Standalone option 显示从该预计算数据取该 sector 排序最靠前且 `containerCap > 0` 的候选，显示 station code 和 containerCap（格式与 Trade Station 栏一致）。
- 不存在 `containerCap > 0` 的候选时，standalone option 只显示「独立成组」不附带空间站信息。

初始化只由 store 生命周期和 active context 切换触发。组件挂载和 tab 切换不得调用初始化。

### Virtual station draft 初始化

Virtual station draft 使用与 `autoGroupResult` 相同的 active binding/archive context key，例如：

```text
gameGuid:archiveTime
```

当 `autoGroupResult.groups` 生成后，store 同步处理 virtual station draft：

1. 当前 context 尚未初始化 virtual station draft 时，从 `activeBinding.stationPlans` 中读取 `saveStationCode === undefined` 的 plans，并 clone 到 `virtualStationDrafts`。
2. 当前 context 已初始化时，保留现有 `virtualStationDrafts`，不得因组件挂载、Map/Live 切换或打开 Virtual Station tab 覆盖用户编辑。
3. 每次 groups 变化后，按当前 groups 的 anchor/coverage 重算 virtual station 的 `groupId`；无命中时保留 draft 并标记为未分组。

[计算] / [快速计算] 会重新生成 `autoGroupResult.groups`，但不会清空 `virtualStationDrafts`。重算完成后只更新归属结果。

## Snapshot 与基线

### calculationBaseline

`calculationBaseline` 是 [重置] 的数据源。

更新时间点：

1. live store `setAutoGroupResult(result)` 时克隆 `result` 与当前 `virtualStationDrafts` 写入。
2. Store 初始化或 active context 切换生成 result 后，经 `setAutoGroupResult()` 写入。
3. 用户显式 [计算] / [快速计算] 生成 result 后，经 `setAutoGroupResult()` 写入。
4. 确认成功后 SHOULD 更新为确认后的 result，避免 [重置] 回退到确认前。

使用点：

- [重置] 调用 `handleResetAssignments()`。
- `handleResetAssignments()` 通过 live store 从 `calculationBaseline` clone 恢复 `autoGroupResult` 与 `virtualStationDrafts`。
- 该恢复不改变 active binding、selected archive 或 liveMode。

### calcBaselinePillState

`calcBaselinePillState` 是 saved binding UI diff 基线，不是 [重置] 数据源，也不是计算结果快照。

更新时间点：

1. active binding/archive 初始化时，从当前 `SaveBindingPlan.groups` 写入。
2. 显式 [计算]、[快速计算]、[重置]、pin / unpin 不覆盖该基线。
3. 确认成功后，先保存 binding，再从保存后的 `SaveBindingPlan.groups` 刷新。

用途：

- `SectorGroupList` 的 `baselineCoverageByGroupId`。
- `SectorGroupList` 的 `baselineConnectedGroupIdsByGroupId`。
- group 新增高亮。
- coverage/connected pill 的粗边框、removed pill 等“与 saved binding 比较”的展示。

身份口径：

- baseline map key 使用 hub `sectorMacro`，不使用 runtime group id。
- card 读取 baseline 时优先使用 `group.sectorMacro`，仅无 `sectorMacro` 时 fallback 到 `group.id`。
- saved binding 的 `connectedGroupIds` 也按 hub `sectorMacro` 解释；UI 中 runtime group id 与 sectorMacro 不一致时，比较逻辑 SHALL 以 `sectorMacro` 对齐。

### SaveBinding Version 2 Group Identity

`BindingSectorGroup` 不再持久化独立 `id` 字段。group 身份由定位星区 `sectorMacro` 决定。

迁移规则：

1. 读取旧版 state 时，建立旧 `group.id -> group.sectorMacro` 映射。
2. 每个 group 输出时删除 `id` 字段，仅保留 `sectorMacro`。
3. `connectedGroupIds` 中的旧 group id 替换为对应 `sectorMacro`。
4. `stationPlans.groupId` 中的旧 group id 替换为对应 `sectorMacro`。
5. 无 `sectorMacro` 的旧 group 不能形成定位星区组，迁移时不作为有效 group 输出。

运行时 `GroupDraftInfo.id` 仍作为 UI/算法引用字段存在，但其值 SHALL 等于 group 的 `sectorMacro`，不得再使用随机 auto uuid。

### 不再使用 edit restore snapshot

旧设计中的 `editSnapshot` / “取消恢复进入编辑前状态”不再作为最终口径。当前编辑态直接修改 shared draft：

- [编辑] 只设置 `calculationMode='edit'`。
- [退出] 只设置 `calculationMode='result'`。
- [退出] 不恢复 coverage、connection、assignment、trade station 或颜色。
- 追加 range 内候选后 SHALL 移除非 standalone 的扩展候选，与 `buildAssignmentResult` 的 range 内/扩展不共存语义对齐。
- result 模式下扩展 absorb 导致 hub range 扩大时，受影响 assignment 的选择按 R3 更新。edit 模式下 card 直接修改跳数只维护候选结构，不因更优、更近或平局自动切换其他 sector 的选择。
- 用户若要回到最近计算结果，必须使用 [重置]。

### Assignment selection identity

`SectorAssignment` 的真实选择状态使用 stable sector identity：

- `selectedSectorMacro=null` 表示未解决或无当前选择。
- `selectedSectorMacro === assignment.sectorMacro` 表示选择 standalone / 独立成组。
- `selectedSectorMacro === option.targetGroupId` 表示选择吸收到目标 hub group；当前 one-binding 口径下 `targetGroupId` SHALL 等于 hub `sectorMacro`。

`selectedOptionIndex` 暂时保留为 presenter/UI 兼容字段，由 `selectedSectorMacro` 映射到当前 `options` 得出。任何会插入、删除或重排 assignment options 的逻辑，必须先保留 `selectedSectorMacro`，再重算 `selectedOptionIndex`；不得把 option 下标作为领域选择真值。

Vue allocation 列表的选择事件 SHALL 传递 `selectedSectorMacro`。Presenter 可以在调用既有算法函数前把该 sector 映射为当前 option index，但事件边界和领域状态都不得依赖旧 index。

## Presenter

Presenter 使用：

```ts
const liveStore = useLiveProductionStore()
const refs = storeToRefs(liveStore)
```

Handler 规则：

- 读写 `liveStore.autoGroupResult`。
- 读写 `liveStore.virtualStationDrafts`，但 UI 展示结构由 presenter 组装。
- 计算按钮可以运行纯算法并更新共享 draft。
- 颜色修改只改共享 draft，不直接写 binding。
- 独立成组、bridge 等路径导致 shared draft 新增 hub 时，presenter/store 交互必须保留 one-map 颜色规则产生的 `group.color`；binding 层不另行定义颜色算法。
- 确认按钮执行最终持久化，并返回成功/失败状态给 panel。

## Button 行为

### 展示模式

| 按钮 | 行为 |
| --- | --- |
| 详情 | `liveMode='calculate'`，不计算 |
| 地图 | 进入 Map binding 面板，Map 复用 shared draft |

详情按钮状态：

- `needsAutoGroupRecalc=true` 时显示红点和 tooltip。
- `autoGroupResult=null` 时禁用。

### Live sidebar 入口

Live sidebar 在固定菜单和动态星区/站点列表之间的分隔线区域新增“星区编辑详情”入口。该入口是持久化 workbench 菜单项，而不是临时按钮：

- `ActiveViewState.activeBindingWorkbench` 新增星区编辑详情专用值，例如 `auto-sector-group`。
- 点击入口设置 `activeBindingWorkbench='auto-sector-group'`，由 `useActiveViewStore` 现有 `x4_station_active_view` 持久化。
- `useLiveProductionStore.workbenchMode` 将该值解析为星区编辑详情模式，并渲染 `AutoSectorGroupPanel layout="columns"`。
- 该模式进入详情/计算视图，但计算语义仍等同展示模式 [详情]。
- 不运行分组算法。
- 不调用 `initAutoGroupDraft()`。
- 不修改 binding 或 shared draft。
- `autoGroupResult=null` 时置灰禁用。
- `needsAutoGroupRecalc=true` 时显示红点提示。
- `activeBindingStation` 变化时，星区编辑详情必须加入固定模式保护列表，避免选择站点或星区后被自动改写为 `station` / `overview`。
- AutoSectorBar [返回] 或用户点击其他 sidebar 菜单时，应显式切回对应 workbench 值。

图标使用与 `blueprint.svg`、`tlt_research.svg` 一致的 128pt 单色 SVG 风格：粗圆环外框，内部用星区节点、连接线和编辑笔表达“星区分组编辑”。该入口只在 Live/save-binding sidebar 显示；Map binding 面板继续通过自己的 binding-sector 流程进入自动分组面板。

### AutoSectorBar

| 按钮/控件 | edit 模式 | result 模式 |
| --- | --- | --- |
| 返回 | emit `back` | 同 edit |
| 地图 | emit `map`，进入 Map binding | 同 edit |
| 桥接跳数 | 更新 `bridgeSearchJumpRange`，不得小于覆盖跳数 | 可作为下一次计算参数 |
| 覆盖跳数 | 更新 `prefJumpRange`，必要时抬高桥接跳数 | 可作为下一次计算参数 |
| Hub 阈值 | 更新 `prefThreshold` | 可作为下一次计算参数 |
| 节点 | 控制下一次计算是否生成新 pure hub | 只作为下一次计算输入 |
| 计算 | 运行 `runCalculationFromEditInput()`，更新 result 和 `calculationBaseline` | 同 edit |
| 快速计算 | 运行同一计算路径 | 同 edit |
| 重置 | 从 `calculationBaseline` 恢复 | 同 edit |
| 提交 | 直接提交，不依赖当前模式 | 通过 gate 后提交 |

### Pin / Unpin Draft Transform

pin / unpin 是 shared draft 的即时变换，不是持久化提交动作，也不是 baseline 捕获动作。

设计约束：

1. `autoGroupResult.groups` 保留当前 hub/group card；unpin 不从当前 hub 列表删除 group。
2. unpin 只将 group `isPinned=false`；pin 只将 group `isPinned=true`。
3. unpin 为该 group 的 `sectorMacro` 新增/恢复 assignment，并默认选中 standalone option；pin 移除该 `sectorMacro` 对应 assignment。
4. unpin 生成的 assignment 设 `displayBucket='unpin'`，并携带 `unpinOrder` 记录 unpin 先后顺序。assignment 列表展示时将 `displayBucket='unpin'` 的 card 放在最上方，unpin 组内按 `unpinOrder` 排列。
5. `displayBucket` 扩展为三态：`'resolved' | 'unresolved' | 'unpin'`。`'unpin'` 在排序时优先于 `'resolved'` 和 `'unresolved'`；`'resolved'` 和 `'unresolved'` 之间保持原 `displayBucket` 顺序。
6. `displayBucket` 在 assignment 创建时确定，用户选择 absorb 或 standalone option 后 SHALL NOT 改变。只有 unpin 创建 assignment 时设为 `'unpin'`，pin 删除 assignment 时移除；显式 [计算] 重建 assignments 时按 `selectedOptionIndex` 重新确定 `'resolved' | 'unresolved'`。
7. unpin 生成 assignment options 时复用标准 assignment 展示规则：当前范围内命中的 absorb 候选全部显示；无当前范围命中时只显示最小扩展候选；超过 `MAX_UNCERTAIN_JUMP` 的 absorb 候选不显示。
8. pin / unpin 不修改 group 顺序、coverage、connections、trade station、virtual station draft 或其他 assignment 选择。
9. `isPinned=false` 只影响下一次显式 [计算] 的 base input：`buildRecalculateBaseGroups()` SHALL 只读取 `isPinned=true` 的 groups。
10. 显式 [计算] 后，如果此前 unpin 的 sector 被算法重新选为 hub，则它是新的计算结果 hub：需要清除该 sector 的 unpin 展示状态，并将对应 group 归一为 pinned hub 状态。
11. 用户在 assignment 中显式点击"独立成组"时，才调用既有 `applyStandaloneToResult()`，并保留它自动计算 coverage 与 derived candidates 的行为。
12. `applyStandaloneToResult()` 追加 derived absorb candidates 时 SHALL 覆盖 range 内和扩展两种距离：距离 `≤ prefJumpRange` 的追加 `extendsRange=false`；距离 `> prefJumpRange` 且 `≤ MAX_UNCERTAIN_JUMP` 的追加 `extendsRange=true`；距离 `> MAX_UNCERTAIN_JUMP` 的不追加。目标 sector 已有 range 内命中时 SHALL NOT 追加扩展候选。
13. 追加候选后 `selectedOptionIndex` 和 `status` 的更新规则采用"新 hub 相对当前选中项是否更优"的比较，不强制切换到全局 best：
    - 新 hub 在 range 内（`extendsRange=false`）且当前已有 range 内 absorb 选中项：新 hub 比当前选中项更优（距离更近，或同距离 score 更高）时切换到新 hub，`status='auto'`；不更优或产生平局时保持不变。
    - 新 hub 在 range 内且当前为 `uncertain_tie`（`selected=null`）：新 hub 明确打破原有平局时选中新 hub，`status='auto'`；仍平局时保持 `null` 和 `uncertain_tie`。
    - 新 hub 在 range 内且当前为显式 standalone 选择（`selected` 指向 standalone option，`status='standalone'`）：只追加 option，不自动切换选择。standalone 是用户显式意图，不等于 `selected=null` 的 uncertain 状态。
    - 新 hub 为扩展候选（`extendsRange=true`）且无其他 range 内命中：`selectedOptionIndex=null`，`status` 保持 `uncertain_extend`，与 `buildAssignmentResult` 的 uncertain_extend 语义对齐。
    - 新 hub 为扩展候选且存在其他 range 内命中：`selectedOptionIndex` 和 `status` 保持不变。
14. pin / unpin 入口只属于 hub/group card；assignment card 不显示 pin / unpin 按钮。
15. result/edit 模式的 hub/group card 都显示 pin / unpin 按钮；result 模式不得隐藏该按钮。
16. pin / unpin 可以在 result/edit 模式触发，但都只写 live store 的 shared draft，不直接写 `saveBindingStore`。
17. 单纯 pin / unpin 不改变可持久化字段时，dirty comparison 应将其视为 `hasChanges=false`。
18. absorb 一个 sector 到其他 group 时，如果该 sector 同时存在自身 hub group，则删除所有同 `sectorMacro` 的自身 hub group，清理其他 group 的 `connectedGroupIds` 和 assignment options 中指向被删除 group 的引用。
19. unpin assignment 被用户选择 absorb 到其他 group 后，SHALL 只更新 `selectedOptionIndex` 和 `status`，SHALL NOT 改变 `displayBucket` 或 `unpinOrder`；该 assignment 继续留在 unpin 顶部位置。

实现边界：

- store/logic 层提供纯 result transform，负责保持 `groups`、`assignments`、connections 与 options 的一致性。
- presenter 只负责响应 UI action、取得 `sectorGraphInfo` 并写回 live store shared draft。
- Vue 层只消费 presenter 提供的 assignment 顺序；不直接重新解释 pin/unpin 领域状态。
- Vue 组件只从 hub/group card 发出 pin / unpin action，不直接拼装 assignment 或修改 store。

### Group card jumpRange 增量重算

Group card 上的 jumpRange 修改 SHALL 增量重算受影响 assignment，不重建全部 assignments。

受影响 sector 判定：

- 增大跳数（oldRange → newRange, newRange > oldRange）：距离该 hub 在 `(oldRange, newRange]` 的 sector。
- 减小跳数（oldRange → newRange, newRange < oldRange）：距离该 hub 在 `(newRange, oldRange]` 的 sector。
- 距离 `≤ min(oldRange, newRange)` 的 sector 不重算。

重算内容：

- 对每个受影响 sector，使用 `buildAssignmentResult` 逻辑重新生成该 sector 的 options（包含所有 hub 的候选，该 hub 的 `extendsRange` 按新 jumpRange 计算）。
- Group card jumpRange 修改属于 edit 模式底层编辑。对每个受影响 sector，只维护 options / `extendsRange` / R2 候选不共存状态。`selectedOptionIndex` 不因更优、更近或平局自动切换；仅当当前选中 option 因本次跳数变化失效时清除。
- `displayBucket` 不变。

### SectorGroupStatBar

| 按钮/控件 | 行为 |
| --- | --- |
| 编辑 | 切换到编辑视图（`calculationMode='edit'`），不改变数据 |
| 退出 | 切换到结果视图（`calculationMode='result'`），不改变数据 |
| 添加枢纽 | 切换 `showHubAddMenu` |
| 桥接保留 | 同步所有 group 的 `connectionRetainEnabled`；主开关由 groups 聚合得出 |
| 覆盖保留 | 同步所有 group 的 `coverageRetainEnabled`；主开关由 groups 聚合得出 |
| 交易站保留 | 同步所有 group 的 `tradeStationRetainEnabled`；主开关由 groups 聚合得出 |

### Confirm

`handleConfirm()` 返回 boolean：

- edit 模式：返回 `false`。
- 无 result：返回 `false`。
- trade station 未解决：返回 `false`。
- uncertain assignment 未解决且 popup 未打开：打开二次确认 popup，返回 `false`。
- 二次确认后或无 uncertain assignment：执行 `doConfirm()`，返回 `true`。

二次确认 popup：

- 使用 `AutoSectorGroupPanel` 本地样式或共享按钮样式定义主次按钮，不依赖其他 SFC 的 scoped class。
- [取消] 关闭 popup 并保持 `showConfirmPopup=false`。
- [确定] 关闭 popup 后继续 `doConfirm()`。

确认成功后：

1. 写入 groups、coverage、connections、colors、trade station。
2. 按最终 groups 重算 `virtualStationDrafts` 归属。
3. 同步无 `saveStationCode` 的 virtual station plans：
   - draft 中存在且 binding 中不存在：创建。
   - draft 中存在且 binding 中存在：更新。
   - binding 中存在但 draft 中不存在：删除。
   - 仍未分组的 draft：不写回；若 binding 中存在对应旧 plan，则删除。
4. 带 `saveStationCode` 的 station plans 不参与 virtual station 同步。
5. 写入 `appliedAutoGroupArchiveTime`。
6. 保存 binding。
7. 同步 live flow。
8. 将 result groups 规范化为保存后的 baseline UI 状态：`baseline=true`，清理 `isNew`、新增高亮和跨覆盖临时提示，保留用户确认后的顺序和字段。
9. 从保存后的 `SaveBindingPlan.groups` 刷新 `calcBaselinePillState`。
10. 更新 `calculationBaseline` 为确认后的 autoGroupResult 与 virtual station drafts。
11. 重新计算 dirty 状态；若 draft 与 binding 一致，`hasChanges=false`。
12. 确认成功后确认按钮置灰，不跳转。

`hasChanges` 只表示 shared draft 相对已保存 binding 是否有未保存修改。uncertain assignment、未分配提示和二次确认 gate 不得在确认成功后单独让 `hasChanges=true`。

### Tab 自动切换

`switchToFirstUnresolvedTab()`：

1. pending bridge 或 uncertain assignment -> `allocation`。
2. unresolved trade station -> `tradeStation`。
3. 否则 -> `hub`。

触发时机：

- 初次 `autoGroupResult` 有 groups 时，仅执行一次。
- [计算] 后执行。
- [快速计算] 后执行。

## SaveBindingPlan

新增字段：

```ts
appliedAutoGroupArchiveTime?: number
bridgeSearchJumpRange?: number
prefJumpRange?: number
prefThreshold?: number
```

`normalizeState()` 必须显式保留这些字段。

## Live 双模式

### 展示模式

布局：`[存档 3fr] | [星区 4fr] | [资源 5fr]`

星区列顶部展示：

- 桥接跳数
- 覆盖跳数
- Hub 阈值
- 详情按钮
- 地图按钮

详情按钮只设置 `liveMode='calculate'`。

### 计算模式

布局：`[星区 5fr] | [分配 4fr] | [交易站 3fr]`

使用 `AutoSectorGroupPanel layout="columns"`。确认成功后确认按钮置灰，不跳转。

## Map 共享关系

Map 面板不拥有自己的 draft。进入 binding 阶段时读取 live store 共享 draft。Map 的具体 UI 和颜色渲染由 map change 定义。

## Assignment 变更规则汇总

全量重建 assignments 仅发生于显式 [计算] / [快速计算]。以下为增量变更规则：

### R2: Extension vs Range-internal Coexistence

- range 内命中与扩展候选不共存于同一 sector 的 options。
- 新增 range 内命中 → 移除该 sector 所有 `extendsRange=true` 的 absorb option。
- 最后 range 内消失 → `buildAssignmentResult` 自动补充扩展候选。
- 已有 range 内命中时 → 独立成组不追加扩展候选。

### R3: Selection Update After Options Change

| 当前状态 | 新 hub range 内 & 更优 | 不更优/平局 | 新 hub 扩展 & 无 range 内 |
| --- | --- | --- | --- |
| `selected=null, uncertain_extend` | 选中, `auto` | 平局→`null, uncertain_tie` | `null, uncertain_extend` |
| `selected=null, uncertain_tie` | 打破平局才选, `auto` | 仍平局→保持 `null` | 保持 `null` |
| 已选中 range 内 absorb | 更优才切 | 保持 | 保持 |
| 已选中 standalone | **只加不切** | 保持 | 保持 |

### R4: JumpRange Change

**result 模式**（扩展 absorb 触发）：
- result 模式没有直接增减 range 的 card 编辑。
- 用户显式选择扩展 absorb 后，目标 hub 的 range 扩大到覆盖该 sector。
- 对同距离受影响 sector 重算 options + `selectedOptionIndex`（按 R3）。

**edit 模式**（card 直接修改跳数）：
- 只重算受影响 sector 的 options（extendsRange 更新 + R2）。
- **不自动选新的**。仅当原选中项因跳数变化失效时清除选择。

- 距离 `≤ min(old, new)` 不重算。

### R5: Unpin Assignment

- `displayBucket='unpin'` + `unpinOrder` 维持顶部位置。
- absorb 后不清除 `displayBucket`/`unpinOrder`。
- standalone 后 `displayBucket` 从 `'unpin'` 改为 `'resolved'`。
- pin 后 assignment 从列表移除。

### R6: Edit Mode Direct Operations

edit 模式原则：options 可随 groups/coverage/hub/jumpRange 的结构变化维护；`selectedOptionIndex` 只允许在用户直接操作的 sector 或原选中 option 被删除/失效的 sector 上修改。不得因更优、更近、平局、range 内/扩展变化，对其他 sector 自动切换选择。

| 操作 | 行为 |
| --- | --- |
| 加入 coverage | 修改目标 group coverage；该 sector 的 `selectedOptionIndex` 指向该 group 的 absorb option |
| 移出 coverage | 修改目标 group coverage；该 sector 的 `selectedOptionIndex` 清除 |
| 新增 hub | 对 eligible sectors 追加该 hub 的 absorb option（R1）。range 内时移除扩展候选（R2）。其他 sector 的 **`selectedOptionIndex` 不动** |
| 移除 hub（未被选中） | 删除该 hub 的 option。无 range 内时补充扩展候选（R2 反向）。**`selectedOptionIndex` 不动** |
| 移除 hub（被选中） | 删除该 hub 的 option；选中项指向被删除 hub 的 sector 清除 `selectedOptionIndex=null` |
| connected toggle | 只改 `connectedGroupIds` |
| 修改跳数 | 更新 extendsRange + R2。不自动选；原选中失效则清除 |
