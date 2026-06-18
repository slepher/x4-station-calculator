# auto-sector-group-one Design

## 最终合并说明

本文件是 auto-sector-group 系列 design 的自包含合并版。完成本 change 后，旧 design 文档可以删除或归档；架构和实现决策以本文为准。

下方分为两部分：

1. 最终统一设计：去除旧文档冲突后的当前实现目标。
2. 来源设计全文：保留旧文档中 design 级上下文，便于删除旧目录后追溯。

若来源设计与最终统一设计冲突，以最终统一设计为准。

## 最终统一设计
## 架构边界

最终结构遵守项目的新方案：

```text
store -> presenter -> vue
```

### store

`useLiveProductionStore` 是当前 active binding/archive 的唯一共享 draft 所有者：

- 持有 `autoGroupResult`
- 持有 `calculationMode`
- 持有 `prefJumpRange`
- 持有 `bridgeSearchJumpRange`
- 持有 `prefThreshold`
- 持有 `calcBaselinePillState`
- 暴露 `needsAutoGroupRecalc`
- 暴露 `initAutoGroupDraft()`
- 暴露 `buildAssignmentsFromBinding()`

store 负责领域状态、计算输入、初始化路径和 archive time 对比，不为某个 Vue 组件定制 UI 结构。

### presenter

`useAutoSectorGroupPresenter` 是 UI 连接与交互编排层：

- 通过 `storeToRefs(liveStore)` 读取共享 draft。
- 为 Live 和 Map 面板组装可直接渲染的数据。
- 处理 edit/cancel/calculate/confirm/color/trade station/assignment 等用户交互。
- 可以持有局部交互状态，例如当前 tab、弹窗、hover、临时选择。
- 不得创建第二份跨面板共享 draft。
- 不得让 Live 和 Map 面板各自拥有互不相通的 auto group 结果。

### vue

Vue 组件只负责渲染和事件转发：

- `SectorOverviewPanel.vue` 渲染 Live 展示模式与计算模式。
- `AutoSectorGroupPanel.vue` 在 Live 和 Map 中复用。
- `MapWorkbenchView.vue` 使用共享 draft 或持久化 binding 生成地图颜色。
- Vue 不直接拼装 store 领域状态。

## 共享状态

最终共享状态如下：

```ts
autoGroupResult: ShallowRef<AutoGroupResult | null>
calculationMode: Ref<'result' | 'edit'>
prefJumpRange: Ref<number>
bridgeSearchJumpRange: Ref<number>
prefThreshold: Ref<number>
calcBaselinePillState: Ref<CalcBaselinePillState | null>
needsAutoGroupRecalc: Computed<boolean>
```

`needsAutoGroupRecalc` 由 binding 上次应用的 archive time 与当前 selected archive time 对比得出：

```ts
appliedAutoGroupArchiveTime === undefined
  || appliedAutoGroupArchiveTime < selectedArchive.meta.time
```

该 flag 只说明当前 binding/archive 是否需要重新计算，不代表面板应该在挂载时自动运行算法。

## 初始化路径

`initAutoGroupDraft()` 是共享 draft 的唯一初始化入口：

1. 没有有效 `selectedArchive` 或 `activeBinding` 时，清空 `autoGroupResult`。
2. `needsAutoGroupRecalc === true` 时：
   - binding 已有 groups，使用 `groupIncremental()`。
   - binding 没有 groups，使用 `groupCleanSlate()`。
3. `needsAutoGroupRecalc === false` 时：
   - 使用 `buildAssignmentsFromBinding()` 从现有 binding groups 构建 assignment 视图。
   - 不重新运行分组算法。
   - 不重新决定 group 结构。
4. 生成本地化名称、颜色稳定上下文和 trade station 默认状态。
5. 写入 `calcBaselinePillState`。
6. 将 `calculationMode` 置为 `'result'`。

初始化发生在 store 初始化、active binding 切换或 selected archive 切换时。Live/Map 面板挂载、切 tab、进入详情模式时不得额外调用 `initAutoGroupDraft()`。

## 数据模型

### SaveBindingPlan

```ts
interface SaveBindingPlan {
  appliedAutoGroupArchiveTime?: number
  bridgeSearchJumpRange?: number
  prefJumpRange?: number
  prefThreshold?: number
}
```

新增字段必须同步保留在 `useSaveBindingStore.ts` 的 `normalizeState()` 中，否则刷新后会丢失。

### BindingSectorGroup

```ts
interface BindingSectorGroup {
  color?: string
  tradeStation?: TradeStationBinding
}
```

`color` 用于地图显示稳定性；`tradeStation` 表示该 hub group 的交易站选择。虚拟交易站不得把 `__virtual__` 写入持久化结构。

### GroupDraftInfo

```ts
interface GroupDraftInfo {
  id: string
  name: string
  sectorMacro?: string
  jumpRange: number
  originalJumpRange: number
  coverageSectorMacros: string[]
  connectedGroupIds: string[]
  excludedDefaultAssignmentSectorMacros: string[]
  isNew: boolean
  isPinned: boolean
  coverageRetainEnabled: boolean
  connectionRetainEnabled: boolean
  tradeStationRetainEnabled?: boolean
  hubScore?: number
  savedTradeStationCode?: string
  selectedTradeStation?: TradeStationSelection | null
  color?: string
  baseline?: boolean
  enteredOtherGroupCoverage?: boolean
  source?: 'auto' | 'manual' | 'bridge'
}
```

以下旧概念被移除：

- `recalcState`
- per-group `exclude`
- `disabledCoverageSectorMacros`
- `excludedDefaultConnectedGroupIds`
- bridge marker 持久化字段

## 核心计算

### clean slate

clean slate 用于没有既有 group 的 binding：

- 从玩家空间站中识别 pure hub。
- 只统计 container cargo 容量。
- 合并已建模块和在建模块。
- 使用阈值和生产线数量计算 hub score。
- 为 pure hub 创建初始 group。
- 将覆盖跳数内玩家星区分配给最近 hub。
- 距离相同且 score 不足以决胜时生成 unresolved assignment。

### incremental

incremental 用于已有 group 的 binding：

- 既有 groups 作为 baseline input。
- 既有 group 保留自己的 `jumpRange`。
- 新增玩家星区按当前 group 覆盖与扩展规则生成 assignment。
- 新增 hub 或 bridge group 按当前参数补充。

### MST 与 bridge

`computeGroupGraph()` 对 group anchors 计算两两距离，并在 `bridgeSearchJumpRange` 内用 Kruskal MST 生成连接：

- 写入双向 `connectedGroupIds`。
- 用户保留的连接作为固定边输入。
- MST 只补齐缺失连接，不删除固定连接。
- 单向 superhighway 不作为双向可达边。
- bridge unit 基于有效双向连通 component，而不是 raw cluster。
- 多个 bridge plan 时先阻塞普通 assignment。
- 单个有效 bridge plan 可自动采用。
- bridge group 最终作为普通 `BindingSectorGroup` 持久化。

## 编辑态

编辑态表示“下一次计算输入编辑”，不是直接编辑最终 binding：

- 进入编辑态时保存 snapshot。
- 当前显示 group 变为 `baseline=true`。
- baseline group 默认 `isPinned=true`。
- baseline group 取消固定后仍保留展示，不物理删除。
- 手动新增 hub 或 bridge hub 可以删除。
- 取消编辑恢复 snapshot。
- 显式点击“计算”才把编辑态输入送回算法。
- 取消节点生成时不得生成新的 pure hub。

## Live UI

Live 有两个模式：

- 展示模式：`[存档 3fr] | [星区 4fr] | [资源 5fr]`
- 计算模式：`[星区 5fr] | [分配 4fr] | [交易站 3fr]`

展示模式顶部显示桥接跳数、覆盖跳数、Hub 阈值，只读展示当前参数。详情按钮只进入计算模式，不运行算法。地图按钮进入 Map binding 视图。确认成功后计算模式返回展示模式。

## Map UI

Map binding 阶段复用 `AutoSectorGroupPanel` 和同一 presenter：

- compact 侧栏布局。
- Hub / Allocation / Trade Station 三类视图。
- pill 和 assignment sector name 点击后 emit focus 事件。
- 父级 `MapWorkbenchView` 负责将地图居中到对应 sector。
- Hub 列表支持拖拽排序，排序只改变 groups 数组顺序，不触发计算。

## 颜色

Hub color 是地图显示辅助，不是不可变用户决策：

- 用户选择色卡后作为预设颜色。
- 如果后续计算发现颜色与 faction 色或近邻 hub 色冲突，系统可以重新分配。
- 自动分配使用 30 色 UI palette 和 27 色 auto palette。
- 避免自身 anchor/coverage faction 色。
- 避免 5 跳内 hub 颜色和 5 跳内 hub faction 色。
- 允许 5 跳外复用颜色。
- 使用 CIEDE2000 / ΔE 阈值逐步放宽。
- transparent 只表示清空，不得持久化为颜色值。

地图染色在 binding 模式下从共享 draft 生成，非 binding 模式下从持久化 active binding 生成。

## 交易站

每个 hub group 都需要 trade station 选择：

- 自动 hub 候选来自 anchor sector 内玩家站，最多 top 5，并保护 pure hub。
- 手动 hub 和 bridge hub 优先 qualified 站；没有 qualified 时列出全部玩家站。
- 没有玩家站时使用虚拟交易站。
- 默认值根据 pure hub、score 优势和保留设置计算。
- 未解决 trade station 会阻止确认。
- `__virtual__` 只存在于 UI/计算层，持久化时写 sector center position，不写 `saveStationCode`。

## 确认

确认前必须满足：

- 没有 pending bridge decision。
- 所有必须解决的 sector assignment 已解决，或用户明确确认当前选择。
- 所有 hub group 已选择 trade station。

确认动作：

1. 通过 `createAutoGroups()` 写入 groups、coverage、connections、colors、range 参数。
2. 写入 trade station 选择。
3. 记录 `appliedAutoGroupArchiveTime`。
4. 保存 binding state。
5. 保留当前 `autoGroupResult` 作为共享 draft。
6. Live 计算模式下确认成功后返回展示模式。

# 来源 Design 全文

## 来源：旧三文档合并基线：auto-sector-group-merged

承接 auto-sector-group、auto-sector-group-link、auto-sector-group-enchanted 的核心算法、编辑态、bridge、assignment、confirm 与早期测试规划。

# 自动星区划分合并版 — 设计方案

## 架构概览

```
LiveProductionWorkbenchView.vue (overview)
├── Col 1
│   ├── SaveUploadPanel
│   ├── pref jump range / threshold controls
│   └── SaveList
├── Col 2
│   ├── SectorConfirmBar
│   │   ├── 桥接 | 节点 | 阈值 | 覆盖
│   │   └── [添加] hub popup / [取消] / [计算] / [编辑]
│   ├── SectorGroupList
│   │   └── unified jump rows: coverage + candidate + connected
│   └── SectorOverviewPanel
│       ├── baseline snapshot
│       ├── edit input draft
│       └── runCalculationFromEditInput()
└── Col 3
    ├── bridge plan cards
    ├── SectorAllocationList
    └── EmpireWareFlowsDashboard
```

核心 store/logic：

```
autoGroupHub.ts
├── detectStationHub()
└── getSectorPureHub()

autoGroup.ts
├── groupCleanSlate()
├── groupIncremental()
├── computeGroupGraph()
├── buildBridgePlanOptions()
├── applyBridgePlanToDraft()
├── applyStandaloneToResult()
└── applyAbsorbToResult()

saveBindingUtils.ts
├── buildSectorGraphFromMaps()
├── getCoverageSectors()
└── buildSectorPath()
```

Vue 组件仍遵守 `store -> presenter -> vue` 三层结构。Vue 不直接拼装 store 数据，面向 UI 的展示结构由 presenter 或组件所属的 presentation state 负责。

## 数据模型

### GroupDraftInfo

```ts
interface GroupDraftInfo {
  id: string
  name: string
  sectorMacro?: string
  jumpRange: number
  originalJumpRange: number
  coverageSectorMacros: string[]
  connectedGroupIds: string[]
  excludedDefaultAssignmentSectorMacros: string[]
  isNew: boolean
  isPinned: boolean
  coverageRetainEnabled: boolean
  connectionRetainEnabled: boolean
  hubScore?: number
  hubStationCode?: string
  baseline?: boolean
  role?: 'normal' | 'bridge'
  enteredOtherGroupCoverage?: boolean
}
```

语义：
- `isPinned=true`：作为下一次计算固定 hub 输入。
- `isPinned=false`：保留展示但不参与 hub、MST、bridge 计算。
- `baseline=true`：进入编辑态前已存在的 group，不可真正删除。
- `isNew=true && !baseline`：编辑中新增或算法生成的 group，可删除。
- `enteredOtherGroupCoverage=true`：unpinned baseline hub 已被其他 pinned hub 吸收，不允许重新 pin。
- `excludedDefaultAssignmentSectorMacros`：仅保存有玩家空间站的 sector，表示该 group 不可作为对应 sector 的默认选项。

### AutoGroupResult

```ts
interface AutoGroupResult {
  groups: GroupDraftInfo[]
  assignments: SectorAssignment[]
  bridgePlans: BridgePlanOption[]
  selectedBridgePlanId?: string
  playerSectorMacros: string[]
}
```

### SectorAssignment

```ts
interface SectorAssignment {
  sectorMacro: string
  status: 'auto' | 'uncertain_tie' | 'uncertain_extend' | 'standalone'
  displayBucket: 'resolved' | 'unresolved'
  options: AssignmentOption[]
  selectedOptionIndex: number | null
}
```

`displayBucket` 只在生成 assignment 时确定。用户选择 option 后不重新分类、不移动 card。

### BridgePlanOption

```ts
interface BridgePlanOption {
  id: string
  recommended: boolean
  selected: boolean
  units: BridgePlanUnit[]
  planScore: number
  totalJump: number
  maxJump: number
  stableKey: string
}
```

## E1 编辑基线 (Edit Baseline)

触发时机：用户点击 Col 2 [编辑]。

进入编辑态时 `SectorOverviewPanel.handleEnterEdit()` 保存 `editSnapshot`：
- `result`: 完整 `AutoGroupResult` deep clone（含 `groups[].connectedGroupIds`）
- `coverageByGroupId`: 每个 group 的覆盖星区列表
- `connectedGroupIdsByGroupId`: 每个 group 的连接目标 group ID 列表
- `prefJumpRange`, `bridgeSearchJumpRange`, `prefThreshold`

E1 基线用途：
- [取消] 恢复进入编辑前完整状态。
- baseline group (`baseline=true`) 不可真正删除。
- 判断 baseline sector 在无当前命中、无扩展命中时是否可以按 baseline group 重新吸收。
- 视觉 diff 见下方 E1/E2 Diff 视觉规范。

## E2 计算基线 (Calculation Baseline)

触发时机：用户点击 [计算]。

计算前捕获编辑态最终配置为 E2 基线，保存到独立 ref `calcBaselinePillState`（不随 `editSnapshot` 清空而丢失）。E2 基线用于计算结果态 diff 展示。

### E2 基线数据

```
calcBaselinePillState = {
  coverageByGroupId:    group.id → [...计算前的 coverageSectorMacros]
  connectedGroupIdsByGroupId: group.id → [...计算前的 connectedGroupIds]
}
```

### E2 基线 Pill 展示（计算结果态）

计算结果态中 pill 三种边框，详见下方 E1/E2 Diff 视觉规范。本章节保留作为概念总览，精确样式以视觉规范表为准。

### E2 基线注入流程

```
runCalculationFromEditInput()
  ├─ 1. buildRecalculateBaseGroups() → 提交数据（遵循 retain + link 独立判决规则）
  ├─ 2. 从提交数据构建 preCalcBaseline（仅 pinned group，link 已是双向）
  ├─ 3. groupIncremental / groupCleanSlate
  ├─ 4. 按 ID 匹配: result.groups[id].baseline = preCalc.has(id)
  ├─ 5. calcBaselinePillState ← preCalcBaseline 的 coverage + connections
  └─ 6. setAutoGroupResult(), clear editSnapshot
```

结果态 `SectorGroupList` 通过 `baselineCoverageByGroupId` / `baselineConnectedGroupIdsByGroupId` props 接收 E2 基线数据（来自 `calcBaselinePillState`），与编辑态共用 `buildUnifiedPills()` 中的 baseline 判定 + 新增 removed pill 回填逻辑。

### E1/E2 Diff 视觉规范

新增 = 加粗强调 + 左实心，baseline = 普通，removed = 虚线。编辑态下 baseline 变为候选/unlink 视为变更（加粗）。

#### Pill

| 状态 | 边框 | 左实心 | 说明 |
|------|------|--------|------|
| baseline | `border-width: 1px` | 无 | 未变更的 E1/E2 基线项 |
| new（coverage） | `border-2` | `amber-300/30` | 编辑态新增覆盖 / 结果态算法新增 |
| new（connected） | `border-2` | `emerald-300/30` | 编辑态新增连接 / 结果态算法新增 |
| new（candidate from baseline） | `border-2` | `amber-300/20` | 编辑态 baseline coverage 被 `×` 变成候选 |
| new（unlink from baseline） | `border-2` | `emerald-300/30` | 编辑态 baseline link 被 `×` 变 unlink |
| removed | `border-dashed opacity-60` | 无 | E2 基线存在但计算结果中消失 |
| candidate / unlinked（非 baseline） | 单线 | 无 | 普通候选/可连接，非变更 |

#### Group Card

| 状态 | 边框 | 说明 |
|------|------|------|
| new | `border-2` + `border-l-[3px] border-l-sky-400` | 算法新增 group |
| baseline | 单线 | 已持久化 / 计算基线 group |
| unpinned baseline | `border-slate-600/30`（原有样式） | 编辑态 unpinned baseline |

## SectorConfirmBar

编辑态：
- Row 1：`桥接` 下拉与保留 checkbox、`节点` checkbox、`阈值` 下拉、`覆盖` 下拉与保留 checkbox。
- Row 2：左侧 [添加枢纽]，右侧 [取消] [计算]。

结果态：
- 只读展示桥接、节点、阈值、覆盖状态。
- 最右显示 [编辑]。
- 不显示节点 checkbox 与保留 checkbox。

规则：
- `nodeEnabled=false` 时不生成新 pure hub，并禁用阈值/覆盖下拉。
- `canDisableNode=false` 时节点 checkbox disabled 且保持勾选。
- 桥接/覆盖保留 checkbox 为三态总控，联动每个 group 的保留状态。
- per-group `[覆盖☑] [连接☑]` 位于 pin 按钮左侧；group 未 pinned 时 disabled。
- 保留 toggle 是 UI 状态，不触发数据重算。

## Hub 添加菜单

`SectorHubAddMenu.vue` 从 `MapBindSectorMenu` 复制并改造：
- fixed overlay modal 显示，点击背景或 Esc 关闭。
- prop 隐藏“定位地图”按钮。
- 无搜索时列出玩家星区。
- 搜索时遍历全地图 sector，包含无玩家空间站 sector。
- sector 行显示玩家站点状态点和星区名，不显示 raw macro。
- 已是任意 group anchor 的 sector 不显示添加按钮。
- 点击添加后创建 `GroupDraftInfo` 并关闭菜单。

新增 hub 默认：
- `isPinned=true`
- `baseline=false`
- `isNew=true`
- 可删除

## Unified Pill Rows

每个 group 按 jump 分组，单行混排：

| 类型 | 颜色 | 来源 | 操作 |
|---|---|---|---|
| coverage | 金色 | 当前 group active coverage | `×` |
| candidate | 半金色 | 可加入当前 group coverage 的 sector | `+` 或 `→` |
| connected | 绿色 | hub anchor 或 connected group | `+` 或 `×` |

```ts
interface UnifiedPillEntry {
  type: 'coverage' | 'candidate' | 'connected'
  macro: string
  jump: number
  baseline: boolean
  removed: boolean
  wasInBaseline: boolean
  hasPlayerStation: boolean
  connectedGroupId?: string
  connectedGroupName?: string
  action: 'add' | 'transfer' | 'remove' | null
  covered?: boolean
}
```

显示规则：
- candidate 只在编辑态显示。
- 结果态不显示 candidate。
- 非 pinned group 所有 action 为 null，只读展示。
- group 覆盖保留关闭时，coverage/candidate 显示但无 action。
- group 连接保留关闭时，connected 显示但无 action。
- connected pill 始终可见，不受保留状态影响隐藏。
- 结果态 E2 基线中存在但计算结果中移除的 coverage/connected 以虚线 (`.pill--removed`) 保留展示。
- baseline 在编辑态（E1）和结果态（E2）共用 `buildUnifiedPills()` 中的 `wasInBaseline` / `baseline` / `removed` 判定，视觉规范见上文 E1/E2 Diff 视觉规范。

## Coverage / Candidate 行为

候选条件：
- 在当前 group anchor 的 `jumpRange` 内。
- 不是当前 group active coverage。
- 不是任意 hub anchor。
- 可包含玩家和非玩家 sector。

jumpRange 增大：
- 仅新增跳数层内的玩家 sector 自动加入 active coverage。
- 不抢占其他 group active coverage。
- 原有层级的 coverage/candidate 保持。

jumpRange 缩小：
- 超出范围的 coverage 从 active coverage 移出。
- 若仍满足候选展示条件则显示 candidate。

跨 group 转入：
- sector S 在 group A active coverage，同时在 group B candidate 中显示 `→`。
- 点击后 S 转入 group B active coverage，并从 group A active coverage 移出。
- group A 中 S 若仍在范围内则显示普通 candidate。

## Connected 行为

手动连接可操作距离固定 5 跳。

已连接：
- `connectedGroupIds` 包含目标 group id。
- 显示绿色 active connected pill。
- 按钮 `×` 断开，并双向同步。

未连接候选：
- 目标 hub anchor 5 跳内。
- 显示绿色 candidate connected pill。
- 按钮 `+` 连接，并双向同步。

计算时：
- 用户保留的 `connectedGroupIds` 作为固定 MST 边。
- Kruskal 仅补充新边，不删除固定边。

连接保留（`connectionRetainEnabled`）提交规则：
- 每条 link 独立判决，不整体处理。
- 对 group A 的 `connectedGroupIds` 中的每个 connId（目标 group B）：
  - `A.connectionRetainEnabled || B.connectionRetainEnabled` 为 true → 该 link 双向提交
  - 两者都为 false → 该 link 不提交
- 示例：A retain ON，B retain OFF，C retain OFF。A↔B 提交（A 侧带动），A↔C 提交（A 侧带动），B↔C 不提交（两侧都 OFF）。

E2 基线使用提交数据构建：
- 提交 link 双向输出，E2 baseline `connectedGroupIdsByGroupId` 自然两侧都有。
- E2 baseline 不再需要二次双向扩展。

## 自动分组流程

### Clean Slate

1. 检测所有玩家 sector 的 hub 信息。
2. 若 `generateHubs=true`，pure hub 建组。
3. 对已有 pinned / 手动新增 hub 建立初始 groups。
4. 运行 `computeGroupGraph()`。
5. 若断裂，运行 `buildBridgePlanOptions()`。
6. bridge 方案为 1 个时自动采用；多个时进入 Col 3 bridge gate。
7. bridge 采用后丢弃之前普通 assignments，基于新 groups 重新生成。
8. 生成玩家 sector assignment cards。

### Incremental

1. 从已有 binding groups 映射为 draft groups。
2. 已持久化 groups 进入编辑态时 `isPinned=true`。
3. 只对未归组玩家 sector 生成 assignment。
4. 使用每个 group 自己的 jumpRange。
5. 运行 MST/bridge 流程。

## MST / Bridge 设计

`computeGroupGraph(groups, sectorGraph, sectorClusterMap, maxDistance)`：
- 清空当前 draft groups 的非固定连接。
- 对有 anchor 的 groups 计算 pairwise distance。
- 对 `distance <= maxDistance` 的边按 weight、stable key 排序。
- 运行 Kruskal。
- 写入双向 `connectedGroupIds`。

`buildBridgePlanOptions()`：
- 输入断裂 components、玩家 sector、hub score、sector graph。
- bridge unit 按同 cluster 内有效双向可达 component 划分。
- 输出能减少断裂分量数量的方案。
- 若无法连通全部 components，但至少合并两个 components，也可作为有效方案。
- 若存在更大连通覆盖，只保留最大覆盖方案。
- 最多保留 5 个。

评分：
- unit score = unit 内 station hub score 最大值。
- plan score = units 的 unit score 最小值。
- 排序：`planScore desc` -> `totalJump asc` -> `maxJump asc` -> `units.length asc` -> `stableKey asc`。

`applyBridgePlanToDraft()`：
- 每个 bridge unit 创建普通 `GroupDraftInfo`。
- 单 sector unit 直接使用该 sector 作为 anchor。
- 多 sector unit 使用用户选中的 center sector。
- bridge group `role='bridge'` 仅用于 UI，不持久化。
- 采用后重新 `computeGroupGraph()` 并重新生成普通 assignments。

## Assignment Option 生成

对每个玩家 sector S：
1. S 是任意 group anchor 时不生成 card。
2. 收集 `distance(group.anchor, S) <= group.jumpRange` 的所有 groups。
3. 若命中非空，全部成为 options。
4. 若命中为空，取最小扩展距离层 groups 作为 options，标记 `extendsRange=true`。
5. 若仍无 options，baseline sector 可得到 baseline group option；非 baseline sector 只保留 standalone。
6. standalone 追加到最后。

默认选择：
- 当前范围命中且不在 `excludedDefaultAssignmentSectorMacros` 的 group 可默认选中。
- 扩展 option 不默认。
- excluded group 不默认但可手动选。
- standalone 不自动兜底。

## 确认写入

`createAutoGroups(draft)`：
1. UUID 优先匹配已有 group，必要时按 `sectorMacro` 兜底。
2. 创建/更新最终 groups。
3. 移除不在 draft 中的废弃 groups。
4. 按 coverage 重建 `sector -> groupId`。
5. 重新分配 `stationPlans`。
6. 写入双向 `connectedGroupIds`。
7. 对无真实 `saveStationCode` 的 hub，通过 `bindSectorGroup` 保留 `tradeStation` transit hub。

确认后：
- `autoGroupConfirmed=true`。
- 隐藏 `SectorConfirmBar` / `AllocationConfirmBar`。
- Col 2 只读展示 store-derived groups。
- Col 3 显示 `EmpireWareFlowsDashboard`。

## 测试影响

Unit 层覆盖算法和数据写入：
- hub detection
- clean slate / incremental
- MST / bridge
- all-hit assignment options
- standalone ID 复用
- non-player hub transit

E2E 层覆盖用户路径：
- 自动触发分组
- bridge gate
- 编辑输入态
- hub 添加
- unified pill 操作
- Col 3 option/default
- 确认写入和资源视图切换

## 来源：Map 集成增量：auto-sector-group-map

补充 Map binding-sector 层的面板复用、focus-sector、compact UI、拖拽排序与生产入口替换。

# 自动星区划分接入 Map — 设计方案

## 架构概览

本 change 不引入新的自动分组算法，所有算法复用 `auto-sector-group-merged` 中已实现的 `src/store/logic/autoGroup.ts`。核心改动是架构层重组：将 `SectorOverviewPanel.vue` 的核心逻辑提升为 presenter，将自动计算触发检查下沉到 `liveProductionStore`，并创建 map 上层 wrapper 替换 Map 的 Step 2。

```
Before:
  MapSavePanel    → MapBindingSectorGroup (1424行, 手动编辑, 无自动分组)
  MapBindingPanel → MapBindingSectorGroup (遗留无生产入口)
  SectorOverviewPanel (962行, 直接访问 store, 无复用)

After:
  MapSavePanel    → AutoSectorGroupMapPanel (map wrapper)
  MapBindingPanel 删除（无生产入口遗留组件）
  SectorOverviewPanel → useAutoSectorGroupPresenter → live 三列布局

Shared UI combinations:
  Col 2 = SectorConfirmBar + SectorGroupList + Hub menu
  Col 3 = SectorAllocationList + AllocationConfirmBar
```

不新增 Col 2 / Col 3 unit wrapper。Col 2 和 Col 3 保持为现有组件组合，上层 Vue 负责不同容器形态：live 是三列布局，map 是 tab 布局。

## Presenter 抽取设计

### useAutoSectorGroupPresenter.ts

文件位置：`src/components/empire/presenters/useAutoSectorGroupPresenter.ts`

```ts
export function useAutoSectorGroupPresenter() {
  // === 响应式状态 ===
  const prefJumpRange = ref(DEFAULT_JUMP_RANGE)
  const bridgeSearchJumpRange = ref(DEFAULT_BRIDGE_SEARCH_JUMP_RANGE)
  const prefThreshold = ref(DEFAULT_HUB_CONFIG.containerThreshold)
  const nodeEnabled = ref(true)
  const bridgeRetainEnabled = ref(true)
  const coverageRetainEnabled = ref(true)
  const showHubAddMenu = ref(false)
  const autoGroupResult = ref<AutoGroupResult | null>(null)
  const postBridgeBaseline = ref<AutoGroupResult | null>(null)
  const autoGroupConfirmed = ref(false)
  const calculationMode = ref<'result' | 'edit'>('result')
  const editSnapshot = ref<EditSnapshot | null>(null)
  const calcBaselinePillState = ref<CalcBaselinePillState | null>(null)

  // === 计算属性 ===
  const canDisableNode: ComputedRef<boolean>
  const playerSectorMacros: ComputedRef<string[]>
  const sectorGraphInfo: ComputedRef<SectorGraphInfo>
  const activeBindingPlan: ComputedRef<SaveBindingPlan | null>
  const hubAddMenuFilteredSectorMacros: ComputedRef<string[]>

  // === 方法 ===
  function runAutoGroup()
  function enterEditMode()
  function cancelEdit()
  function runCalculationFromEditInput()
  function addHubDraft(sectorMacro: string)
  function removeHubDraft(groupId: string)
  function togglePin(groupId: string)
  function updateGroupJumpRange(groupId: string, range: number)
  function selectAssignmentOption(sectorMacro: string, optionIndex: number)
  function selectBridgePlan(planId: string)
  function confirmAndWrite()
  function clearAutoGroupCheckFlagAfterRun()

  return { /* 所有状态、computed、方法 */ }
}
```

### 抽取范围

| 从 SectorOverviewPanel | 迁移到 Presenter | 保留在组件 |
|------------------------|-----------------|-----------|
| 所有 `ref()` 声明 | yes | no |
| 所有 `computed()` 派生 | yes | no |
| `runAutoGroup()` 及其调用的子逻辑 | yes | no |
| `enterEditMode()`, `cancelEdit()` | yes | no |
| `runCalculationFromEditInput()` | yes | no |
| `confirmAndWrite()` | yes | no |
| add/remove/toggle group 方法 | yes | no |
| coverage/connection 修改方法 | yes | no |
| assignment option / bridge plan 选择 | yes | no |
| `getSectorDisplayName()` | yes | no |
| hubAddMenu 打开/关闭控制 | yes | 菜单组件本身 |
| 自动分组 flag 消费与清除 | yes | no |
| DOM 操作 / 模板绑定 | no | yes |
| CSS class / 布局 | no | yes |

## 自动计算触发检查

### liveProductionStore 职责

`useLiveProductionStore` 负责判断当前 binding 是否需要自动分组计算。检查逻辑不执行自动分组算法，只设置 flag。

检查条件：
- 当前 binding 存在
- 当前 archive 中存在玩家资产 sector
- 至少一个有玩家资产的 sector 未被当前 binding 的任意 group anchor 或 coverage 覆盖

触发时机：
- 页面刷新后 store / archive 恢复完成
- 手动切换 active binding
- 上传新存档或 archive timing 变化导致 active binding / selected archive 切换

建议状态：

```ts
const autoSectorGroupCheck = ref<{
  needed: boolean
  reason: 'refresh' | 'binding-switch' | 'archive-timing-switch'
  gameGuid: string
} | null>(null)

function checkAutoSectorGroupCoverageForActiveBinding(reason: AutoSectorGroupCheckReason): void
function clearAutoSectorGroupCheck(): void
```

Presenter 监听 `autoSectorGroupCheck`。当 flag 表示当前 active binding 需要计算时，presenter 调用 `runAutoGroup()`；执行完成后调用 `clearAutoSectorGroupCheck()` 清除 flag。

## Map Wrapper 设计

### 文件位置

`src/components/map/AutoSectorGroupMapPanel.vue`

该组件只负责 map 容器形态，不作为 Col 2 / Col 3 的 unit wrapper。

### Props & Emits

```ts
const props = defineProps<{
  gameGuid: string
}>()

const emit = defineEmits<{
  (e: 'select-group', sectorGroupId: string): void
  (e: 'focus-sector', sectorMacro: string): void
  (e: 'fit-sectors', sectorMacros: string[]): void
}>()
```

### Map Context 模板结构

```
<div class="auto-sector-group-map-panel">
  <!-- 完成态：不显示 tab / allocation，仅显示 Col 2 完成态 -->
  <template v-if="autoGroupConfirmed">
    <SectorConfirmBar mode="result" view="map" ... />
    <SectorGroupList
      view="map"
      :show-select-group-button="true"
      @select-group="emit('select-group', $event)"
      @focus-sector="emit('focus-sector', $event)"
      ...
    />
  </template>

  <template v-else>
    <div class="tab-bar">
      <button :class="{ active: activeTab === 'hub' }" @click="activeTab = 'hub'">
        {{ t('auto_sector.hub_tab') }}
      </button>
      <button
        :class="{ active: activeTab === 'allocation' }"
        :disabled="calculationMode === 'edit'"
        @click="activeTab = 'allocation'"
      >
        {{ t('auto_sector.allocation_tab') }}
      </button>
    </div>

    <div v-show="activeTab === 'hub'">
      <SectorConfirmBar mode="result|edit" view="map" ... />
      <SectorGroupList view="map" @focus-sector="..." ... />
    </div>

    <div v-show="activeTab === 'allocation'">
      <SectorAllocationList view="map" @focus-sector="..." ... />
      <AllocationConfirmBar ... />
    </div>
  </template>
</div>
```

### Live Context

Live 不使用 map wrapper。`SectorOverviewPanel` 保持三列布局，但通过 presenter 获取状态和动作：

```
<div class="grid grid-cols-12 gap-8">
  <div class="col-span-3"><SaveUploadPanel /> <SaveList /></div>
  <div class="col-span-5"><SectorConfirmBar mode="result|edit" view="live" /> <SectorGroupList view="live" /></div>
  <div class="col-span-4">
    <template v-if="autoGroupConfirmed">
      <EmpireWareFlowsDashboard />
    </template>
    <template v-else>
      <SectorAllocationList view="live" />
      <AllocationConfirmBar />
      <div v-if="calculationMode === 'edit'" class="allocation-overlay" />
    </template>
  </div>
</div>
```

## Tab 与完成态机制

- Tab 切换仅改变 `v-show` 显示状态，不触发数据重新计算
- `activeTab` 是 map wrapper 内部 ref，不持久化
- Map 编辑态规则：Hub tab 为编辑态时，分配方案 tab disabled，不能切换到 `SectorAllocationList`
- Live 编辑态规则：Col 3 保留 `SectorAllocationList` 内容但加遮罩层 + 禁用操作
- 完成态规则：live 与 map 都不显示 `SectorAllocationList`；map 同时不显示 tab
- 完成态下 map 在每个 group 上显示进入 station binding 的按钮，按钮图标保持原 `MapBindingSectorGroup` 图标
- 完成态下 map 不再提供旧的单 group 编辑按钮
- 分配方案 tab 中的 assignment card 选择会即时反映到 Hub tab 的 draft 中（共享 presenter 状态）

## Context 适配策略

### 子组件 view prop

所有相关子组件新增 `view: 'map' | 'live'` prop。`SectorConfirmBar` 保留现有 `mode: 'result' | 'edit'` 表示计算状态。

| 组件 | view='map' 行为 | view='live' 行为 |
|------|----------------|-----------------|
| `SectorConfirmBar` | 隐藏阈值/覆盖控件行的冗余标签，紧凑排列 | 当前样式不变 |
| `SectorGroupList` | pill 缩小 2px，行间距缩小 4px，@focus-sector emit，可显示进入 station binding 按钮 | 当前样式不变，无 focus-sector |
| `SectorAllocationList` | card 宽度自适应侧边栏，sector 名可点击聚焦 | 当前样式不变 |
| `SectorHubAddMenu` | 使用 MapBindSectorMenu（teleported popup + 定位按钮） | 当前 SectorHubAddMenu（fixed overlay） |

### 紧凑样式 Tokens

```css
/* map 模式下的紧凑变量覆盖 */
.auto-sector-group-map-panel {
  --binding-pill-height: 22px;        /* live: 26px */
  --binding-pill-gap: 4px;            /* live: 6px */
  --group-card-padding: 8px;          /* live: 12px */
  --confirm-bar-gap: 4px;             /* live: 8px */
}
```

## Focus-Sector 事件链

```
SectorGroupList pill @click.stop="emit('focus-sector', macro)"
  ↓ (仅在 view='map' 时绑定)
AutoSectorGroupMapPanel relay: emit('focus-sector', macro)
  ↓ (MapSavePanel 已有 relay)
MapWorkbenchView.onBindingFocusSector(sectorMacro)
  ↓
resolveMapSectorByMacro() + mapStore.resolveSectorByMacro()
  ↓
focusSector(sectorId)  // 平移 + 缩放动画
```

`SectorGroupList.vue` 内部已有点击 pill 的逻辑（`buildUnifiedPills()` 返回的 entries），需要新增：pill 的 `@click` handler 在 `view='map'` 时额外调用 `emit('focus-sector', entry.macro)`。

## 拖拽排序设计

### 集成方式

在 `SectorGroupList.vue`（`view='map'` 时）中包裹 group 列表：

```vue
<draggable
  v-model="presenter.autoGroupResult.groups"
  item-key="id"
  handle=".drag-handle"
  :animation="200"
>
  <template #item="{ element: group }">
    <div class="group-card">
      <div class="drag-handle">::</div>
      <!-- group pill rows -->
    </div>
  </template>
</draggable>
```

- 使用 `vuedraggable@4`（项目已有依赖，`MapBindingSectorGroup` 当前使用）
- `handle` 限制拖拽触发区域（拖拽手柄），避免与 pill 点击冲突
- `v-model` 直接绑定 `autoGroupResult.groups` 数组
- 排序仅改变数组顺序，不触发重算
- 排序权威状态是数组顺序；确认写入时按 drafts 数组顺序保存
- `order` 不作为排序依据；如保存时仍需填充兼容旧 schema，则机械写入数组 index

## Hub 添加菜单上下文切换

```ts
const hubAddMenuComponent = computed(() => {
  return view === 'map' ? MapBindSectorMenu : SectorHubAddMenu
})

const hubAddMenuProps = computed(() => {
  if (view === 'map') {
    return {
      open: showHubAddMenu.value,
      triggerEl: addHubBtnRef.value,
      filteredSaveSectors: ...,
      // MapBindSectorMenu 特有 props
    }
  }
  return {
    open: showHubAddMenu.value,
    playerSectorMacros: ...,
    // SectorHubAddMenu 特有 props
  }
})
```

两个菜单组件共享的核心逻辑（扇区过滤、已 anchor 排除、hub draft 创建）均在 presenter 中，菜单组件只负责 UI 展示和事件 emit。

## 文件影响地图

```
src/
├── components/
│   ├── empire/
│   │   ├── presenters/
│   │   │   └── useAutoSectorGroupPresenter.ts    [新增] Presenter 层
│   │   ├── sector-overview/
│   │   │   ├── SectorOverviewPanel.vue           [重构] 使用 presenter
│   │   │   ├── SectorGroupList.vue               [修改] +view prop, +draggable, +focus-sector, +select-group button
│   │   │   ├── SectorAllocationList.vue          [修改] +view prop, +focus-sector
│   │   │   ├── SectorConfirmBar.vue              [修改] +view prop
│   │   │   ├── SectorHubAddMenu.vue              [修改] +view prop 或保留不变
│   │   │   └── AllocationConfirmBar.vue          [不变]
│   │   └── LiveProductionWorkbenchView.vue       [不变或仅保持 overview mode 引用 SectorOverviewPanel]
│   ├── store/
│   │   └── useLiveProductionStore.ts             [修改] 自动分组检查 flag
│   └── map/
│       ├── AutoSectorGroupMapPanel.vue           [新增] map wrapper
│       ├── MapSavePanel.vue                      [修改] 替换 binding-sector
│       ├── MapBindingPanel.vue                   [删除] 无生产入口遗留组件
│       └── MapBindingSectorGroup.vue             [删除]
└── locales/
    ├── en.json                                   [修改] +auto_sector.hub_tab/allocation_tab
    └── zh-CN.json                                [修改] +auto_sector.hub_tab/allocation_tab
```

## 测试影响

- 新增 presenter 层后，现有 `tests/unit/auto-sector-group/autoGroup.spec.ts` 应继续通过（只测算法，不依赖 presenter）
- Map 侧后续测试文档需要覆盖：自动检查 flag、tab 状态、完成态 group 按钮、pill focus、拖拽数组顺序
- 本 change 的 implementation tasks 不包含测试编写任务

## 来源：Hub 颜色增量：auto-sector-group-color

补充 hub color 自动分配、用户色卡、持久化和地图染色。

# Hub 色卡与地图染色 — 设计方案

## 架构概览

```
src/
├── store/logic/hubColor.ts          # 色板定义 + 三阶段分配算法
├── store/useSaveBindingStore.ts     # continue: 添加 color 到 normalizeState
├── components/empire/sector-overview/
│   └── SectorGroupCard.vue          # continue: 添加色卡控件
├── components/empire/presenters/
│   └── useAutoSectorGroupPresenter.ts # continue: 计算时调用分配算法
├── composables/useMapSvgSectors.ts  # continue: 接收 sectorGroupColorMap，绘制内部六边形
├── components/map/layers/
│   └── MapSectorLayer.vue           # continue: 渲染内部六边形
└── types/x4.ts                      # continue: BindingSectorGroup 加 color
```

## 参考

- `src/components/test/ColorTestPage.vue`：仅作为 `vue-color` 选色器、预设色板、popover 交互和样式覆写的参考页面；正式功能仍在 `SectorGroupCard.vue` 与 presenter/store 链路中实现。

## 数据模型

### BindingSectorGroup（`types/x4.ts`）

```ts
export interface BindingSectorGroup {
  // ... existing fields
  color?: string  // HEX like "#F44E3B"
}
```

### GroupDraftInfo（`store/logic/autoGroup.ts`）

```ts
interface GroupDraftInfo {
  // ... existing fields
  color?: string
}
```

### normalizeState（`useSaveBindingStore.ts`）

在 group 映射中添加：

```ts
color: group.color
```

## 色板定义（`store/logic/hubColor.ts`）

```ts
// UI 展示用：30 色
export const HUB_PALETTE: string[] = [
  '#F44E3B', '#FE9200', '#FCDC00', '#DBDF00', '#A4DD00', '#68CCCA', '#73D8FF', '#AEA1FF', '#FDA1FF', '#FFFFFF',
  '#D33115', '#E27300', '#FCC400', '#B0BC00', '#68BC00', '#16A5A5', '#009CE0', '#7B64FF', '#FA28FF', '#000000',
  '#9F0500', '#C45100', '#FB9E00', '#808900', '#194D33', '#0C797D', '#0062B1', '#653294', '#AB149E', 'transparent',
]

// 自动分配用：27 彩色
export const HUB_COLORFUL: string[] = [
  '#F44E3B', '#FE9200', '#FCDC00', '#DBDF00', '#A4DD00', '#68CCCA', '#73D8FF', '#AEA1FF', '#FDA1FF',
  '#D33115', '#E27300', '#FCC400', '#B0BC00', '#68BC00', '#16A5A5', '#009CE0', '#7B64FF', '#FA28FF',
  '#9F0500', '#C45100', '#FB9E00', '#808900', '#194D33', '#0C797D', '#0062B1', '#653294', '#AB149E',
]
```

## 分配算法

```
stabilizeHubColors(groups):
  1. fixed = []
  2. For each group with color:
       if color is valid against self faction colors (ΔE > 5)
          and not duplicate with fixed/5-hop hub colors (ΔE > 5):
         fixed.add(group.color)
       else:
         mark for reassignment
  3. For each null/new/conflicting group:
       group.color = pickHubColor(group, fixed)
       fixed.add(group.color)

stabilizeEditedHubColor(group, groups):
  1. Used only after [计算] and before submit.
  2. One user operation can add one hub or change coverage for one hub.
  3. If new coverage sectors were added and every newly added coverage faction color has ΔE > 5 from group.color:
       keep group.color.
  4. If group is new, color is null, or the current color conflicts with self faction colors / 5-hop hub context:
       group.color = pickHubColor(group, fixed colors from other hubs)
  5. Never change colors of other hubs in this interactive path.

pickHubColor(group, fixedColors):
  1. selfFactionColors = anchor sector faction + coverage sector factions
     ownerless/missing/unparseable colors are skipped
  2. Stage 1 candidates:
       For threshold in [20, 15, 10, 5, 0]:
         candidates = HUB_COLORFUL filtered by ΔE(candidate, every selfFactionColor) >= threshold
         Stop when candidates.length >= 5
  3. Stage 2 avoidColors:
       fixed colors of 5-hop hubs
       central/anchor sector faction colors of 5-hop hubs
  4. For threshold in [20, 15, 10, 5]:
       valid = candidates filtered by ΔE(candidate, every avoidColor) >= threshold
       If valid not empty: return maximin(valid, avoidColors)
  5. Return maximin(candidates, avoidColors)
  6. Fallback only when no candidate can be parsed: generate random color
```

- `ΔE` = culori `differenceCiede2000()`
- `maximin(candidates, existing)`: 选与 existing 中最近颜色的距离最大者
- 只比较 5 跳以内 hub；5 跳外 hub 允许重复颜色
- 随机颜色：用 `hsl(random, 50-80%, 35-65%)` 生成，确保可用性

## UI — SectorGroupCard 色卡

### 位置

`group-title-row` 内，group name 之后、详情按钮之前。

```html
<div class="group-title-row">
  <span class="group-name">{{ group.name }}</span>
  <button class="color-chip" :style="{ background: group.color }" @click="openPicker" />
  <button v-if="showSelectGroupButton" class="..." @click="selectGroup">详情</button>
</div>
```

### 色卡样式

- 16×16 圆角方块 (`border-radius: 4px`)
- 有颜色：`background: group.color`
- 无颜色：`border: 1px dashed #475569; background: transparent`
- 编辑态：`cursor: pointer`
- 非编辑态：`pointer-events: none`

### 选色器

**SketchPicker 组件配置：**

```html
<SketchPicker
  :model-value="group.color || '#3b82f6'"
  :preset-colors="HUB_PALETTE"
  :disable-alpha="true"
  @update:model-value="onColorUpdate"
/>
```

**Popover 行为：**

```html
<div class="popover" @click="(e) => {
  if ((e.target as HTMLElement).closest('.preset-color')) closePopover()
}">
  <SketchPicker ... />
</div>
```

- CSS 覆写：260px 宽、10×3 Grid、选中蓝环
- 点预设色块 → `group.color` 更新并 dismiss
- 点透明预设 → `group.color = undefined` 并 dismiss；不保存 `0x00000000`
- SV/Hue 取色区拖拽不 dismiss
- 点外部 overlay / Esc → dismiss

## 计算集成

在 `runCalculationFromEditInput()` 或等效位置：

```
计算完成后：
  collect anchor/coverage faction colors
  collect 5-hop hub color and anchor faction context
  stabilizeHubColors(result.groups)
```

点击 [计算] 后到提交前：

```
新增 hub:
  stabilizeEditedHubColor(newGroup, result.groups)

调整某 hub 覆盖星区:
  stabilizeEditedHubColor(changedGroup, result.groups)
```

该交互路径一次只处理当前被调整的一个 hub，不做全局颜色重排。

从已保存 binding 恢复为 result 时不单独补色；缺色 group 保持缺色状态，直到用户点击 [计算] 后进入统一的 `stabilizeHubColors(result.groups)` 流程。

## 地图染色

采用独立 layer 架构，避免 Hub 内六边形污染 `MapSectorLayer` 的 faction polygon / resource pie / badge / hover target 等职责。

### 文件结构

```
src/components/map/layers/
├── MapSectorLayer.vue             # faction sector polygon + resource pie + badge
└── MapSectorGroupColorLayer.vue   # hub coverage 内六边形（独立 layer）
```

### 数据流

- `useMapSvgSectors` 输出 `clusterPolygons`（已含各 sector 中心坐标、半径）
- `AutoSectorGroupMapPanel` ← `useAutoSectorGroupPresenter.sectorGroupColorMap`（provide）
- `MapSvgCanvas` inject `sectorGroupColorMap` → 传给 `MapSectorGroupColorLayer`
- `MapSectorGroupColorLayer` 接收 `clusterPolygons` + `sectorGroupColorMap` + `hexPoints`，渲染全尺寸六边形替代 faction 色（fill-opacity 0.35, no stroke）

### 渲染层级

```
<MapSectorLayer />              <!-- faction/base sector polygon -->
<MapSectorGroupColorLayer />    <!-- hub color inner hex -->
<MapOverlayLayer />             <!-- station overlays -->
```

覆盖星区互斥，一个星区最多属于一个 hub，因此 `sectorGroupColorMap` 不需要处理多 hub 同 sector 优先级。`color` 为 undefined 时不生成内部六边形；透明预设也通过 undefined 表示。

## 样式覆写（SketchPicker）

```css
.vc-sketch-picker { width: 260px; }
.presets { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; padding: 10px 10px 8px; }
.preset-color { width: 100% !important; height: auto !important; aspect-ratio: 1; margin: 0 !important; }
.preset-color[aria-selected="true"] { box-shadow: 0 0 0 2px #1e293b, 0 0 0 4px #60a5fa !important; z-index: 1; }
```

需在 `main.ts` 中引入：
```ts
import 'vue-color/style.css'
```

## 来源：Trade Station 增量：auto-sector-group-station

补充 hub trade station 候选、默认值、选择、gate、重置、保留与持久化。

# Design: Auto Sector Group - 贸易站选择

## Architecture

### 组件层级

```
AutoSectorGroupMapPanel (Map)
├── SectorConfirmBar          ← Hub tab 内（+ tradeStationRetainEnabled）
├── tab-bar (Hub | Allocation | TradeStation)
│   ├── Hub tab
│   │   ├── HubAddMenu
│   │   └── SectorGroupList
│   ├── Allocation tab
│   │   ├── AllocationConfirmBar  ← unresolved=["sector.allocation_unresolved"]
│   │   └── SectorAllocationList
│   └── TradeStation tab
│       ├── AllocationConfirmBar  ← unresolved=["sector.trade_station_unresolved"]
│       └── SectorTradeStationList
│           ├── SectorTradeStationCard (group 1)
│           └── SectorTradeStationCard (group N)

SectorOverviewPanel (Live Col3)
├── col2: SectorConfirmBar + SectorGroupList  ← 不变
└── col3: tab-bar (Allocation | TradeStation) ← 新增
    ├── Allocation tab
    │   ├── AllocationConfirmBar
    │   └── SectorAllocationList
    └── TradeStation tab
        ├── AllocationConfirmBar
        └── SectorTradeStationList (同上)
```

### Presenter 新增状态

```typescript
// useAutoSectorGroupPresenter.ts

// 候选数据：groupId → TradeStationCandidate[]
const tradeStationCandidates = computed<Record<string, TradeStationCandidate[]>>()

// 用户选择：groupId → TradeStationSelection | null
// null 表示未决；'__virtual__' 表示已选择虚拟站
const selectedTradeStations = ref<Record<string, TradeStationSelection | null>>({})

// stationCode → containerCap，用于 hub pill 容量显示
const tradeStationCaps = computed<Record<string, number>>()

// 全局确认 gate：allocation / bridge / tradeStation 三者均解决
const hasGlobalUnresolved = computed<boolean>()

// 保留开关
const tradeStationRetainEnabled = ref(false)

// 未解决项
const hasUnresolvedTradeStations = computed<boolean>()
const unresolvedTradeStationGroups = computed<string[]>()  // i18n keys

// 方法
function handleSelectTradeStation(groupId: string, selection: TradeStationSelection)
function handleResetTradeStations()  // 恢复默认值
function handleMasterTradeStationRetain(enabled: boolean)  // 全局保留
function handleToggleTradeStationRetain(groupId: string)  // 单 group 保留
```

### 新增类型

```typescript
// tradeStationSelection.ts

interface TradeStationCandidate {
  stationCode: string
  macro: string
  score: number
  containerCap: number
  prodLines: number
  hasProduction: boolean  // prodLines > 0
  hasVolume: boolean      // containerCap > 0
  isPureHub: boolean      // qualified && prodLines === 0
}

interface TradeStationSelection {
  type: 'player' | 'virtual'
  stationCode: string  // 玩家空间站 code，虚拟站在 UI/计算层为 '__virtual__'
}
```

### GroupDraftInfo 扩展

```typescript
interface GroupDraftInfo {
  // ... existing fields ...
  savedTradeStationCode?: string    // 上次提交的 trade station code
  tradeStationRetainEnabled?: boolean  // 当前是否保留
  selectedTradeStation?: { type: 'player' | 'virtual'; stationCode: string } | null  // 当前 UI 选中
  source?: 'auto' | 'manual' | 'bridge'  // hub 来源，替代原 role + isManualHub
}
```

## Decisions

### D1: 候选筛选复用 `detectStationHub`

直接对星区内玩家空间站调用 `detectStationHub()`，复用既有 hub score 逻辑。无需为新控件单独设计评分体系。

`selectTradeStationCandidates()` 取 top 5，纯 hub 不足 2 时用后续 pureHub **替换**最低分非 pureHub（非追加），保持候选总数 ≤ 5。

### D2: 虚拟站 code 仅用于 UI/计算层

虚拟交易站在 `selectedTradeStations` 中使用 `stationCode = '__virtual__'` 表示“已选择虚拟站”。该值不得传入最终持久化结构。

最终提交时：
- 玩家空间站 → `saveStationCode = stationCode`
- 虚拟交易站 → `saveStationCode = undefined`，`position = getSectorCenterPosition(...)`
- 如既有 trade station 曾绑定玩家站，改选虚拟交易站时必须清除旧 `saveStationCode`

### D3: AllocationConfirmBar 改造为 i18n-key 数组

将 `hasUncertain: boolean` 替换为 `unresolved: string[]`（局部 tab 状态），新增 `globalUnresolved: boolean` prop（全局确认 gate）。

- status 文本：仅按当前 tab 传入局部 unresolved key
- 确认按钮 disabled：`unresolved.length > 0 || globalUnresolved || edit_disabled`
- 全局 gate 由 presenter 的 `hasGlobalUnresolved` 提供，覆盖 allocation、bridge、tradeStation 三类未解决项
- `handleConfirm()` 内部也防御式检查 `hasGlobalUnresolved`，不单依赖 UI disabled

### D4: SectorConfirmBar 阈值字段改造

- `param-field` 的 label 由 `sector.default_threshold_short`（"阈"/"Hub"）改为 `sector.trade_station_short`（"交易站"/"Trade Station"）
- result 模式：`[交易站] [flat 显示值]` — 不显示 checkbox
- edit 模式：`[交易站] [dropdown] [☑ 保留]` — dropdown + checkbox 在同一 box，与桥接控件模式一致
- `tradeStationRetainEnabled` checkbox 仅 edit 模式可见，具备三态 indeterminate（随 group cards 联动）

### D5: TradeStation Card 显示

- 候选站显示 `stationCode`（而非 `macro`）
- 每项显示 containerCap 格式化值
- 虚拟站选项独立 `<li>`，与候选站并列
- `SectorTradeStationList` 遍历所有 hub groups（groups 中有 `sectorMacro` 的），不区分有无 candidates
- 无候选站（锚点星区无玩家站）时仍渲染 card，仅显示虚拟交易站并默认选中
- hub 药丸（`SectorGroupCard` anchor row）上显示选中站的容量：`Math.floor(containerCap / 1_000_000) + 'M'`，虚拟站不显示

### D6: Tab 自动跳转逻辑

**Map panel：**
- 计算后跳转到首个有未解决内容的 tab（allocation > tradeStation）
- 所有已解决 → hub tab
- 初始 `autoGroupResult` 变化时相同逻辑

**Live Col3：**
- 同 map 逻辑
- 所有已解决 → allocation tab

### D4: 确认按钮统一入口但分 tab 放置

Map 面板和 Live Col3 的确认按钮在各自 tab 内通过 `AllocationConfirmBar` 呈现，事件均路由到 presenter 的同一个 `handleConfirm()`。SectorConfirmBar 上的确认按钮功能相同。

全局 gate：
```typescript
const hasGlobalUnresolved = computed(() =>
  hasUncertainAssignments.value ||
  hasPendingBridgeDecision.value ||
  hasUnresolvedTradeStations.value
)
```

### D5: tab 切换逻辑

- 初次计算完成后，如有未解决 allocation → 自动切到 Allocation tab
- Allocation 解决后 → 用户可手动切换到 TradeStation tab
- TradeStation tab 始终可点击（不 block），但确认按钮在 unresolved 时 disabled
- 编辑模式下 allocation tab disabled（现有逻辑），tradeStation tab 同等待遇

### D6: 保留 (Retain) 语义

- retain 开启时，`GroupDraftInfo.savedTradeStationCode` 只用于初始化 `selectedTradeStations[groupId]` 默认值
- 用户在 trade station tab 中的手动选择始终优先于 retain 默认值
- retain 不绕过 unresolved gate；如没有可用 `savedTradeStationCode` 且算法无法确定默认值，该 group 仍为 `null`

### D7: 默认值优先级

`determineDefault()` 按顺序判断：
1. 候选为空 → 默认虚拟交易站
2. 第一名是 `isPureHub` → 默认第一名
3. 第一名不是 `isPureHub`，且候选中同时存在 pureHub 和生产站 → `null`
4. 全为生产站且第一名 score > 第二名 score × 1.3 → 默认第一名
5. 其他情况 → `null`

### D8: 提交流程覆盖旧自动 trade station 写入

`createAutoGroups()` 只负责 group/coverage/connection，不再根据 `hubStationCode` 或 fallback best station 写 trade station。`bindSectorGroup()` 创建 tradeStation 基础结构（无 `saveStationCode`）。所有 trade station 写入（玩家站 → `upsertTradeStation`，虚拟站 → `unbindTradeStation`）由 `handleConfirm()` 按 `selectedTradeStation` 显式执行。

### D9: Hub 身份字段统一为 source

`GroupDraftInfo` 不再使用 `role` 和 `isManualHub` 两个独立字段表达 hub 来源，统一为 `source: 'auto' | 'manual' | 'bridge'`：

| 来源 | 设值点 | 候选规则 |
|------|--------|---------|
| `'auto'` | `groupCleanSlate` / `groupIncremental` | 星区所有玩家站，无 qualified 限制 |
| `'manual'` | `handleAddHubDraft` | 有 qualified → 仅 qualified；无 → 全部玩家站 |
| `'bridge'` | `applyBridgePlanToDraft` | 同 manual，不强制 qualified 阈值 |

`skipQualifiedThreshold = group.source !== 'auto'`。

## Data Flow

```
runAutoGroup() / runCalculationFromEditInput()
  │
  ├→ autoGroupResult 生成
  │   └→ groups[] 含 hubStationCode, savedTradeStationCode, tradeStationRetainEnabled
  │
  ├→ tradeStationCandidates 计算
  │   ├→ 遍历 groups
  │   │   ├→ source === 'auto' → 星区所有玩家站（不设 qualified 阈值）
  │   │   ├→ source === 'manual' → 有 qualified → 仅 qualified；无 → 全部玩家站
  │   │   └→ source === 'bridge' → 同 manual，不强制 qualified 阈值
  │   └→ 每星区调 selectCandidates() + determineDefault()
  │
  ├→ selectedTradeStations 设默认值
  │   ├→ 无玩家站 → { type:'virtual', stationCode:'__virtual__' }
  │   ├→ 如 retained 且 savedTradeStationCode 存在 → 使用 savedTradeStationCode
  │   └→ 否则 → 使用 determineDefault() 结果，无法默认则为 null
  │
  └→ 渲染
      ├→ Hub tab: SectorGroupList
      ├→ Allocation tab: SectorAllocationList + AllocationConfirmBar
      └→ TradeStation tab: SectorTradeStationList + AllocationConfirmBar

用户交互 → handleSelectTradeStation(groupId, selection)
用户点击确认 → handleConfirm()
  └→ 遍历 groups
      ├→ selectedTradeStations[groupId] === null → 不允许进入 confirm
      ├→ stationCode === '__virtual__' → 持久化 saveStationCode=undefined，position=星区中心
      └→ stationCode 为玩家站 code → 持久化 saveStationCode=该 code，position=玩家站位置
  └→ 写入 saveBindingStore
```

### Recalculation 时保留交易站信息

`runCalculationFromEditInput()` 生成新的 `AutoGroupResult` 后，需将前次 draft groups 中的 `savedTradeStationCode` 和 `tradeStationRetainEnabled` 按 group ID 匹配回填到新 groups，确保 `applyTradeStationDefaultsToResult()` 中 retain 逻辑生效。

## File Impact

### 新增

| 文件 | 行数估计 | 职责 |
|------|---------|------|
| `src/store/logic/tradeStationSelection.ts` | ~120 | `selectCandidates()`, `determineDefault()`, 类型导出 |
| `src/components/empire/sector-overview/SectorTradeStationCard.vue` | ~180 | 单 group 卡片：li 候选站 + 虚拟站 |
| `src/components/empire/sector-overview/SectorTradeStationList.vue` | ~100 | 列表包装器：遍历 groups 生成 cards |

### 修改

| 文件 | 改动范围 |
|------|---------|
| `useAutoSectorGroupPresenter.ts` | +~200 行：新增 trade station 状态、computed、方法 |
| `autoGroup.ts` | +2 行：GroupDraftInfo 新增字段 |
| `useSaveBindingStore.ts` | 调整 `createAutoGroups()` 旧自动 trade station 写入逻辑，或提供提交后覆盖/清除旧 code 的明确能力 |
| `AutoSectorGroupMapPanel.vue` | +~60 行：第3个 tab、tab 切换逻辑 |
| `SectorOverviewPanel.vue` | +~40 行：Col3 tab 结构 |
| `AllocationConfirmBar.vue` | ~10 行：props 改造 |
| `SectorConfirmBar.vue` | +~15 行：新增 tradeStationRetainEnabled checkbox |
| `SectorGroupCard.vue` | +~20 行：Edit 模式 tradeStationRetain 开关 |
| `src/locales/en.json` | +6 keys |
| `src/locales/zh-CN.json` | +6 keys |

## 来源：最新共享草案口径：auto-sector-group-draft

最终修正共享 draft 所有权、初始化生命周期、archive time 重算策略、Live 双模式与面板不自动计算规则。

# Binding 模式共享草案 — 设计方案

## 架构概览

将 6 个核心 group 编辑状态从 presenter 局部实例搬入 `useLiveProductionStore`（Pinia 单例），实现 live 面板和 map 面板状态共享。Store 在初始化/上下文切换时完成初始数据生成，Live 和 Map 面板直接读取 store 中已算好的值；计算模式内用户显式点击「计算」时，由 presenter 编排交互输入并更新共享 draft。

```
liveStore (Pinia 单例)  ← 数据生产层
  ├─ autoGroupResult       ShallowRef<AutoGroupResult | null>
  ├─ calculationMode       Ref<'edit' | 'result'>
  ├─ prefJumpRange         Ref<number>
  ├─ bridgeSearchJumpRange Ref<number>
  ├─ prefThreshold         Ref<number>
  ├─ needsAutoGroupRecalc  Computed<boolean>
  ├─ initAutoGroupDraft()  → 双路径决策：分组算法 vs 从 binding 构建
  └─ buildAssignmentsFromBinding() → 从已有 binding 构建 assignments

useAutoSectorGroupPresenter()  ← view 连接 + 面板交互编排层
  ├─ SectorOverviewPanel  (live 模式)  → 同一份 liveStore
  └─ AutoSectorGroupPanel (map 模式) → 同一份 liveStore

MapWorkbenchView  ← 从 liveStore 读取 sectorGroupColorMap
```

## 草案作用域与数据流

`liveStore` 只维护一份全局唯一的 binding draft，不按 `gameGuid` 缓存多份草案。所有状态均表示当前 active binding/archive 的草案状态。

Store 初始化时（或 activeBinding / archive 切换时）调用 `initAutoGroupDraft()`，根据 `needsAutoGroupRecalc` 分两条路径生成 `autoGroupResult`：

- **有变化 flag** → 运行分组算法（`groupCleanSlate` / `groupIncremental`）→ 生成结果
- **没有变化 flag** → 调用 `buildAssignmentsFromBinding()` 从已有 binding groups 构建 assignments → 不重新决定分组结构

Live 面板和 Map 面板读取 store 中的共享 draft 进行渲染。「详情」按钮仅切换显示模式，不执行计算；计算模式内用户主动点击「计算」时，仍由 presenter 编排交互输入并调用纯算法更新共享 draft。

## 数据模型

### SaveBindingPlan 新增字段（`types/x4.ts`）

```ts
export interface SaveBindingPlan {
  // ... existing fields
  appliedAutoGroupArchiveTime?: number  // 已应用 auto group 的存档 time
}
```

### normalizeState 保留（`useSaveBindingStore.ts`）

```ts
appliedAutoGroupArchiveTime: item.appliedAutoGroupArchiveTime as number | undefined,
```

### liveStore 新增（`useLiveProductionStore.ts`）

```ts
import { DEFAULT_JUMP_RANGE, DEFAULT_BRIDGE_SEARCH_JUMP_RANGE, type AutoGroupResult, type GroupDraftInfo, groupCleanSlate, groupIncremental, enrichAutoGroupResult } from './logic/autoGroup'
import { DEFAULT_HUB_CONFIG } from './logic/autoGroupHub'
import { buildSectorGraphFromMaps } from './logic/saveBindingUtils'

// 状态
const autoGroupResult = shallowRef<AutoGroupResult | null>(null)
const calculationMode = ref<'result' | 'edit'>('result')
const prefJumpRange = ref(DEFAULT_JUMP_RANGE)
const bridgeSearchJumpRange = ref(DEFAULT_BRIDGE_SEARCH_JUMP_RANGE)
const prefThreshold = ref(DEFAULT_HUB_CONFIG.containerThreshold)

// 变化 flag
const needsAutoGroupRecalc = computed(() => {
  const archive = saveStore.selectedArchive
  if (!archive) return false
  const binding = saveBindingStore.activeBinding
  const archiveTime = archive.meta?.time ?? 0
  const applied = binding?.appliedAutoGroupArchiveTime
  return applied === undefined || applied < archiveTime
})

// ===== 数据生产方法 =====

/** 从已有 binding groups 构建 assignments（不跑分组算法） */
function buildAssignmentsFromBinding(): AutoGroupResult | null {
  // 读取 binding.groups 转为 GroupDraftInfo[]
  // 构建 sectorGraph → 为每个覆盖星区计算所有候选 group
  // 构建 SectorAssignment[]，根据已有 coverage 设定默认选中
  return { groups, assignments, bridgePlans: [], playerSectorMacros }
}

/** 初始化草案 — 双路径决策，并由 enrichAutoGroupResult 富化 */
function initAutoGroupDraft() {
  if (needsAutoGroupRecalc.value) {
    result = groupCleanSlate(...) 或 groupIncremental(...)
  } else {
    result = buildAssignmentsFromBinding()
  }
  // 纯函数富化：名称 i18n 翻译、hub 颜色、交易站默认选择
  autoGroupResult.value = enrichAutoGroupResult(result, {
    getSectorName: (macro) => i18n.global.t(sector.nameId) || macro,
    getFactionColor: (macro) => sector.owner_color || cluster?.owner_color,
    archive, modulesByMacroId, prefThreshold, prefJumpRange
  }, sectorGraph, sectorClusterMap)
  calculationMode.value = 'result'
}
```

`enrichAutoGroupResult` 是 `autoGroup.ts` 中的纯函数，接收 deps 对象，不依赖 store 或 i18n 实例。
`buildAssignmentsFromBinding` 是 store 内部函数，仅做数据转换。

| 方法 | 位置 | 职责 |
|------|------|------|
| `groupCleanSlate` / `groupIncremental` | `autoGroup.ts` | 纯函数，生成原始分组结果 |
| `buildAssignmentsFromBinding` | `useLiveProductionStore.ts` | 从持久化 groups 构建 assignments |
| `enrichAutoGroupResult` | `autoGroup.ts` | 纯函数，富化：名称翻译、颜色、交易站默认 |
| `initAutoGroupDraft` | `useLiveProductionStore.ts` | 编排：计算 → 富化 → 存储 |

Live 和 Map 面板不调用这些初始化方法，只读取 `autoGroupResult`。Presenter 可保留当前面板交互 handler，但这些 handler 必须以 `liveStore.autoGroupResult` 作为唯一共享 draft 数据源。

```ts
export function useAutoSectorGroupPresenter() {
  const liveStore = useLiveProductionStore()
  const { autoGroupResult, calculationMode, prefJumpRange, bridgeSearchJumpRange, prefThreshold, needsAutoGroupRecalc } = storeToRefs(liveStore)

  // presenter 本地 computed / handler（使用 liveStore 共享 draft）
  const hasGlobalUnresolved = computed(() => /* 从 autoGroupResult 重算 */)
  // ...

  // handler 直接读写 liveStore 共享 draft，持久化动作 delegate 到 saveBindingStore
  function handleColorChange(id, color) { /* 更新 liveStore.autoGroupResult */ }
  function handleConfirm() { /* 写入 saveBindingStore */ }

  return { autoGroupResult, /* ... */, handleColorChange, handleConfirm }
}
```

### handleConfirm

记录 `appliedAutoGroupArchiveTime`，不覆盖 `autoGroupResult`（保留计算结果中的 assignments 供后续编辑查看）。确定栏始终显示，不因确认状态隐藏。

### MapWorkbenchView — sectorGroupColorMap

```ts
const sectorGroupColorMap = computed<Record<string, string>>(() => {
  const isBinding = bindingContextStage.value === 'select-sector'
                 || bindingContextStage.value === 'select-station'
  if (isBinding && liveStore.autoGroupResult) {
    return buildColorMap(liveStore.autoGroupResult.groups)
  }
  const binding = saveBindingStore.activeBinding
  if (!binding) return {}
  return buildColorMap(binding.groups)
})
```

binding 模式下始终从 `liveStore.autoGroupResult` 渲染草案（确认后 `autoGroupResult` 与 `activeBinding` 数据一致）。非 binding 模式下从 `saveBindingStore.activeBinding` 渲染。

### handleColorChange

```ts
function handleColorChange(groupId: string, color: string | undefined) {
  // 只更新 autoGroupResult，不修改 draftBinding
  const result = liveStore.autoGroupResult
  if (!result) return
  groups[idx] = { ...groups[idx]!, color }
  liveStore.autoGroupResult = { ...result, groups, assignments: result.assignments }
}
```

### 停止自动计算

Store 在初始化及 activeBinding/archive 切换时调用 `initAutoGroupDraft()` 生成数据。Live 面板、Map 面板及其他系统组件均不因挂载、面板切换或详情模式切换触发独立计算。

### Live 面板模式切换（SectorOverviewPanel）

```ts
const liveMode = ref<'display' | 'calculate'>('display')
```

Live 面板不触发计算，只切换显示模式。数据由 store 在初始化时生成。

**展示模式**：`liveMode = 'display'`
```
[SaveUploadPanel 3fr] | [SectorOverviewBar + SectorGroupList 4fr] | [EmpireWareFlowsDashboard 5fr]
```
- 星区列表列顶部：`SectorOverviewBar.vue`（桥接跳数、覆盖跳数、Hub 阈值纯数值只读）
- 「详情」→ `liveMode = 'calculate'`（红点在详情按钮上）
- 「地图」→ 设置 `isSavePanelOpen=true, mapSavePanelLayer='binding-sector', mapBindingGameGuid=guid, setActiveView('maps')`
- `LiveOverviewToolbar` 已移除，overview 界面不再显示 context toolbar

**计算模式**：`liveMode = 'calculate'`

三列复用 `AutoSectorGroupPanel`（`layout="columns"`），读取 `liveStore.autoGroupResult` 渲染。

统一 Bar `AutoSectorBar` 跨全宽位于列上方，合并原 `SectorConfirmBar` + `AllocationConfirmBar`。

**Live 布局（单行）**：
```
[返回] [地图] [桥接[5]跳 ☑] [节点 ☑] [覆盖[2]跳 ☑] [Hub[5M] ☑]  [退出][计算][+]      ← edit
[返回] [地图] [桥接[5]跳 ☑] [节点 ☑] [覆盖[2]跳 ☑] [Hub[5M] ☑]  未决:2+1 [重置][提交][计算] ← result
```

按钮统一 `calc-btn` 风格（edit/result 一致）。

**Map 布局（两行）**：
```
[桥接[5] ☑] [节点 ☑]
[覆盖[2] ☑] [Hub[5M] ☑]
                                [取消][计算][+]             ← edit
                                2+1 [重置][提交][计算][编辑] ← result
```

参数 dropdown 和 checkbox 在 result/edit 两态均可用，不再由 `calculationMode` 控制。

result 模式按钮：未决计数 + [重置] [提交] [计算] [编辑]

**Live HubAddMenu**：`mode="overlay"` 弹出模式。`fixed inset-0 z-50` 全屏遮罩 + 居中对齐面板（无金边、无定位按钮、紧凑宽度 w-96）。

**搜索结果去重**：搜索从 `filteredSearchAllSectors` 取数，排除已在 "存档星区候选" 中的 sector。

编辑模式（`calculationMode === 'edit'`）：

**重置**：`handleResetAssignments` 从 `calculationBaseline` 恢复（每次计算完成或确认后保存的快照）。

**确认**：仅检查所有 hub 是否有交易站。sector 分配未完成时弹出二次确认 popup，用户确认后仍可提交。

**`calculationBaseline` 保存时机**：
- `initAutoGroupDraft()` 完成
- `runCalculationFromEditInput()` 完成
- `handleConfirm()` 完成
- 编辑内容实时修改当前 draft，不保留 snapshot
- "取消"→"退出"，仅退出编辑模式，不做状态恢复
- Col 2（分配栏）不再禁用/遮罩，正常显示当前草稿状态
- 编辑操作立即反应到 draft

编辑操作联动：

| 操作 | 分配栏变化 |
|------|-----------|
| 添加新 hub | 该 sector 从分配列表移除；其他 sector 新增该 hub 候选 |
| 移除 hub | 该 sector 回到分配列表；其他 sector 移除该 hub 候选（若选中则变空） |
| sector 移出覆盖 | 该 sector 移除对应 absorb 选项（若选中则变空） |
| sector 加回覆盖 | 该 sector 新增对应 absorb 选项 |
| 修改跳数 | 覆盖星区变化 → 涉及 sector 的选项增减（选中项不在了则变空） |

**Baseline 统一语义**：

Baseline = `initAutoGroupDraft()` 完成时的持久化状态快照（hub + 覆盖 + 连接），生成后不再改变。

| 来源 | baseline |
|------|----------|
| binding 中已有 group（`buildAssignmentsFromBinding` / `buildStoreGroups`） | `true` |
| 算法生成新 hub（`groupCleanSlate` / `groupIncremental`） | `false` |
| bridge 产生新 hub（`applyBridgePlanToDraft`） | `false` |
| 用户手动添加的 hub（`handleAddHubDraft`） | `false` |

`calcBaselinePillState` 在 `initAutoGroupDraft()` 时写入，存储初始覆盖和连接用作 UI 的加粗基线展示。后续 `runCalculationFromEditInput` 不再重写基线。

**Map 模式**：

Map 进入 binding 阶段直接读取 `liveStore.autoGroupResult` 渲染，不通过 `liveMode` 切换。`gameGuid` watcher 不需要调用额外初始化方法（store 已在上下文切换时自动初始化）。

## 注意

- `autoGroupResult` 用 `shallowRef`：整体替换触发更新
- Pinia setup store 暴露到 store 实例后，handler 中使用 `liveStore.autoGroupResult = nextResult` 这类属性赋值；组件需要 ref 时由 presenter 使用 `storeToRefs(liveStore)` 转出
- Presenter 的 computed（`hasGlobalUnresolved`、`tradeStationCaps` 等）留在 presenter，自动响应 liveStore ref
