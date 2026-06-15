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
  autoGroupConfirmed?: boolean
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
