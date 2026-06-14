# 自动星区划分增强 — 设计方案

## 架构概览

本次变更建立在 `auto-sector-group` 和 `auto-sector-group-link` 已有三列布局、UI draft、MST/bridge 流程之上。核心变化是把 Col 2 编辑态明确为“下一次计算输入编辑”，将范围/候选/连接合并到同一个 jump row 中，并把 Col 3 card option 扩展为所有命中范围 group 均可选择。

```
LiveProductionWorkbenchView.vue (overview mode)
├── Col 2 (5/12)
│   ├── SectorConfirmBar
│   │   ├── 桥接 | 节点 | 阈值 | 覆盖
│   │   └── [添加] → SectorHubAddMenu popup
│   ├── SectorGroupList
│   │   └── unified jump rows: coverage + candidate + connected
│   └── SectorOverviewPanel.vue
│       ├── baseline snapshot
│       ├── pinned/unpinned input
│       └── runCalculationFromEditInput()
└── autoGroup.ts
    ├── generateHubs
    ├── isPinned
    ├── excludedDefaultAssignmentSectorMacros
    └── all-hit assignment options
```

## 数据模型

### `GroupDraftInfo`

```diff
- recalcState: 'normal' | 'pin' | 'exclude'
+ isPinned: boolean

- disabledCoverageSectorMacros: string[]
+ excludedDefaultAssignmentSectorMacros: string[]

```

Draft-only 状态：

```ts
interface GroupDraftInfo {
  isPinned: boolean
  isNew: boolean
  baseline?: boolean
  enteredOtherGroupCoverage?: boolean
  excludedDefaultAssignmentSectorMacros: string[]
}
```

语义：
- `isPinned=true`：作为下次计算固定 hub 输入，覆盖/候选/连接可编辑
- `isPinned=false`：覆盖/候选/连接只读，不作为固定 hub 输入
- `isNew=true`：算法新建或编辑中 [添加] 的 group
- `baseline=true`：该 group 来自进入编辑前快照，不可真正删除
- `enteredOtherGroupCoverage=true`：unpinned baseline hub 已进入其他 hub coverage，不允许重新 pin
- `excludedDefaultAssignmentSectorMacros`：该 group 不可作为这些玩家 sector 的默认选中项，但仍可作为 Col 3 手动 option
- 连接只由 `connectedGroupIds` 表达：`+` 加入目标 group id，`×` 移除目标 group id

`excludedDefaultAssignmentSectorMacros` 仅适用于有玩家空间站的 sector。非玩家星区没有玩家归属默认值，不进入该字段。

## Baseline Snapshot

进入编辑态时在 `SectorOverviewPanel` 保存当前状态快照，用于 [取消] 时恢复。

进入编辑时，所有当前存在的 group 统一设为 `isPinned: true`、`baseline: true`。编辑中通过 [添加] 新建的 hub 同样 `isPinned: true`。

baseline 用途：
- 粗边框视觉：仅 coverage pill 中，进入编辑时已在 group coverage 中的 sector 显示粗边框（数据源为 `editSnapshot.coverageByGroupId`）
- 区分 baseline group（不可删除）与编辑新增 group（`isNew && !baseline` 可删除）
- [取消] 时恢复进入编辑前的完整状态

baseline 不提供 coverage 恢复/历史保留语义。coverage 被其他 group 获取、被移出或因 jumpRange 缩小超出范围后，按普通 candidate/coverage 规则显示或消失。

connection 不使用 baseline 行为。

## SectorConfirmBar

编辑态布局：
- Row 1: `[桥接下拉 保留☑] [节点☑] [阈值下拉] [覆盖下拉 保留☑]`
- Row 2: `[添加枢纽]` 左对齐，`[取消] [计算]` 右对齐

计算结果态：
- Row 1: 只读展示桥接/节点/阈值/覆盖状态，最右 `[编辑]` 按钮右对齐
- Row 2 不显示
- 节点 checkbox 与保留 checkbox 在结果态不显示

「保留」checkbox：
- 桥接「保留」☑ 和覆盖「保留」☑ 默认勾选
- 勾选：[计算] 时提交当前 coverage / bridge 数据
- 取消：完全由算法自动生成，不提交编辑中 coverage / bridge 数据
- 保留 checkbox 嵌入对应下拉字段框内，不作为独立控件
- 保留 checkbox 为三态总控（全选/部分选/全不选），联动所有 group 对应 checkbox
- 部分 group 开启、部分关闭时，保留 checkbox 显示 indeterminate 态

props / emits：

```ts
nodeEnabled: boolean
canDisableNode: boolean
```

```ts
(e: 'update:nodeEnabled', value: boolean): void
(e: 'add-hub'): void
```

规则：
- `canDisableNode=false` 时 checkbox disabled 且保持勾选
- `nodeEnabled=false` 时 `prefThreshold` 与 `prefJumpRange` 下拉 disabled
- [添加] 触发 hub 选择 popup，不传目标 group

## Hub 添加菜单

复制 `MapBindSectorMenu` 为 `SectorHubAddMenu.vue`，但语义改为添加 hub draft group。

显示规则：
- 使用 fixed overlay modal 显示（`fixed inset-0 z-50` + backdrop）
- 不作为普通页面流元素显示；点击背景或 Esc 关闭
- 无搜索时只列玩家星区（按 cluster 分组）
- 搜索时遍历全地图 sectors，包含无玩家空间站 sector
- sector 行仅显示 `●/○` + 星区名，不显示 raw sector_id
- 已是任意 group anchor 的 sector 不显示 `+`
- 点击 `+` 创建新的 `GroupDraftInfo`，菜单关闭
- 新 group 默认 `isPinned=true`、`baseline=false`、可删除

## Unified Pill Rows

取消三 tab。每个 group 下按实际 jump 分组，每个 jump row 内混排三类 pill：

| 类型 | 颜色 | 数据来源 | 按钮 |
|---|---|---|---|
| coverage | 金色 | 当前 group active coverage | `×` |
| candidate | 半金 | 可进入当前 group coverage 的 sector | `+` 或 `→` |
| connected | 绿色 | hub anchor / connected group | `+` 或 `×` |

视觉叠加：
- baseline 粗边框：仅 coverage pill，数据源为 edit-time snapshot
- 有玩家空间站：实心点 `●`（含定位星区 pill 和所有 pill）
- 无玩家空间站：空心点 `○`
- 连接只靠绿色区分，不显示额外 link 图标
- 不使用 inactive/default-off 的 dashed / 低透明样式

### Entry 模型

```ts
interface UnifiedPillEntry {
  type: 'coverage' | 'candidate' | 'connected'
  macro: string
  jump: number
  baseline: boolean
  hasPlayerStation: boolean
  connectedGroupId?: string
  action: 'add' | 'transfer' | 'remove' | null
}
```

按钮映射：
- `add` → `+`
- `transfer` → `→`
- `remove` → `×`

非 pin hub（`isPinned=false`）的所有 pill action 为 null，覆盖/候选/连接均只读显示。

### Per-group 保留 checkbox

每个 group 的 pin 按钮左边显示两个 checkbox：`[覆盖☑] [连接☑]`。

- 标签为 `覆盖` / `连接`，不使用"保留"标签，放置于 pin 按钮左侧
- group 未 pin（`isPinned=false`）时两个 checkbox SHALL 处于 disabled 状态
- 覆盖☑ 关闭时：coverage pill 保持显示但无 `×` 按钮；candidate pill 保持显示但无 `+`/`→` 按钮。视觉效果与 unpin 相同（只读）。
- 连接☑ 关闭时：connected pill 保持显示但无 `+`/`×` 按钮。视觉效果与 unpin 相同（只读）。
- 保留 toggle 是纯 UI 状态（v-show 控制），不触发数据重算，不修改任何 coverage/connected 数据。
- connected pill 始终可见，不受保留状态影响是否隐藏。

### 候选 pill 显示规则

- 候选 pill SHALL 仅在编辑态显示
- 计算结果态（非编辑态）不显示候选 pill

## Coverage / Candidate 规则

### 范围来源

coverage/candidate 使用当前 group 的 `jumpRange`。

候选星区：
- 当前 group anchor 的 `jumpRange` 内
- 不是当前 group active coverage
- 不是任意 hub anchor
- 包含有玩家空间站和无玩家空间站的 sector

非玩家星区可作为 hub anchor / 连接对象，但不作为玩家 coverage 默认归属问题处理。

### jumpRange 修改

修改 group jumpRange 时，采用 `MapBindingSectorGroup` 的覆盖联动语义：

- jumpRange 增大：
  - 仅新增跳数层（`prevRange < distance <= range`）内符合条件的玩家星区自动加入 coverage
  - 不在其他 group active coverage 中
  - 原有跳数层的覆盖和候选保持不变
- jumpRange 缩小：
  - 超出范围的 coverage 从 active coverage 移出
  - 若仍符合候选展示条件则显示为候选，否则不显示
- jumpRange 改回覆盖时，普通候选可通过 `+` 重新加入 active coverage
- baseline 不改变 jumpRange 缩小时的移出规则，只给仍存在的 baseline coverage pill 增加粗边框

修改 coverage jumpRange 不影响连接。

### 确认写入规则

`createAutoGroups` 按 `sectorMacro` 匹配已有 group（UUID 优先，fallback 到 sectorMacro），避免 standalone 重建时 UUID 变化导致重复。处理完所有 draft 后：

1. 移除不在 draft 中的废弃 group
2. 按最终 groups 的 coverage 重建 `sector → groupId` 映射
3. 所有 `stationPlans` 按 sector 重新分配到对应 group
4. standalone/bridge group 无 `hubStationCode` 时，按 hub score 从 archive 选最优站

### standalone 组 ID 复用

`applyStandaloneToResult` 创建 standalone group 时，若 draft 中已有同 `sectorMacro` 的 group，复用其 ID，防止多次独立成组产生重复 group。

candidate 可以多 group 共存，active coverage 排他。

当 sector S 在 group A 中为 active coverage，同时在 group B 中作为 candidate：
- group B 中 S 显示半金 candidate pill
- 按钮显示 `→`
- 点击 `→` 后，S 转入 group B active coverage，从 group A active coverage 移出
- group A 中 S 变为常规候选（若仍在 jumpRange 内）
- baseline 不改变转移后的保留/恢复规则

如果 S 只是其他 group candidate，不显示 `→`，显示普通 `+`。

## Connected 规则

hub anchor 统一作为绿色连接 pill 显示。

手动连接可操作范围：
- 当前 group anchor 到目标 hub anchor 距离 `<= 5`

自动连接范围：
- 使用桥接搜索跳数

显示与操作：
- `connectedGroupIds` 包含目标 group id → 绿色 active connected pill，按钮 `×`
- 5 跳内但未 connected → 绿色 candidate connected pill，按钮 `+`
- 点击 `+` 直接把目标 group id 加入 `connectedGroupIds`
- 点击 `×` 直接从 `connectedGroupIds` 移除目标 group id
- [计算] 输入直接使用编辑后的 `connectedGroupIds`

connection 不使用 baseline 行为，不使用 excluded/default-off 字段。

### 计算时连接规则

- [计算] 时，`connectedGroupIds` 视为固定的 MST 边
- Kruskal 算法仅在此基础上添加新边，不删除已存在边

## unpinned baseline hub

unpinned baseline hub 是“保留展示但不作为 hub 输入”的状态。

行为：
- 不参与 hub 计算
- 不参与 MST / bridge
- link 到 pinned hub 时计算中忽略
- 可以重新 pin，除非 `enteredOtherGroupCoverage=true`
- 允许作为其他 pinned hub 的 coverage/candidate 对象
- 如果被其他 pinned hub 吸收为 coverage，则设置 `enteredOtherGroupCoverage=true`，并禁止重新 pin

## 计算输入构建

点击 [计算] 时从编辑 draft 构建输入：

```ts
const pinnedGroups = groups.filter(g => g.isPinned)
const excludedHubAnchors = groups
  .filter(g => !g.isPinned)
  .map(g => g.sectorMacro)

const activeDefaultCoverage = group.coverageSectorMacros
  .filter(m => hasPlayerStation(m)
    ? !group.excludedDefaultAssignmentSectorMacros.includes(m)
    : true)

const activeConnections = group.connectedGroupIds
```

规则：
- `nodeEnabled=false` → `generateHubs=false`
- clean slate 没有 baseline/pinned group 时，不允许 `nodeEnabled=false`
- pinned group 的 active coverage 可作为默认 assignment 输入
- excluded 玩家 sector 不可让该 group 成为默认选中项
- 非玩家 coverage 全部保留
- 连接直接使用 `connectedGroupIds`

## Col 3 Assignment Option 生成

Col 3 仍为所有玩家星区生成 card，但 hub anchor 不生成普通 assignment card。

对 sector `S`：

1. 若 `S` 是任意 group anchor：跳过
2. 收集所有当前覆盖范围命中的 group：
   - `distance(group.anchor, S) <= group.jumpRange`
   - 全部成为 option
3. 若当前范围没有命中，收集可扩展命中的 group：
   - 计算所有 group 到 S 的 distance
   - 只保留最小 distance 的 group
   - 这些 option 标记 `extendsRange=true`
   - 不默认选中
4. 若仍没有 group option：
   - 若 S 是 baseline 星区，基线 group 可作为重新吸收 option/default
   - 若 S 不是 baseline 星区，仅保留 standalone 等用户选择项，不默认选中
5. standalone 始终作为最后 option

默认选择规则：
- excluded default group 不能默认选中
- 扩展命中 group 不能默认选中
- 当前范围命中且未 excluded 的 group 可按距离、score、稳定 key 选择默认
- 若所有可选 group 都被 excluded，则 `defaultOptionIndex=null`、`selectedOptionIndex=null`
- standalone 不作为自动兜底默认值

## Bridge 算法关系

本次不扩展 bridge 算法目标。

- 现有 bridge 仍处理 hub/group components 的连通
- 不把“所有玩家星区自动纳入 bridge 搜索”作为本次目标
- 无命中玩家星区通过 Col 3 option 暴露给用户，不自动 standalone
- 用户选择 standalone 或新增 hub 后，复用现有 `computeGroupGraph()` / bridge 流程重算 group 连接

## 非玩家星区 hub 与 transit

新建 hub 可以使用无玩家空间站的 sector。

确认提交沿用现有路径：

```text
createAutoGroups()
  -> createGroup()
  -> bindSectorGroup()
  -> updateGroup()
  -> setGroupConnection()
```

`bindSectorGroup()` 已有行为：
- 如果 group 有 `sectorMacro`，确保 `group.tradeStation` 存在
- 如果没有真实 `saveStationCode`，创建/保留一个无 saveStationCode 的 `TradeStationBinding`
- position 使用 anchor sector center

Live 继承路径：

```text
BindingSectorGroup.tradeStation
  -> buildTransitHubsFromBinding(binding.groups)
  -> empireFlowFacade
  -> Live transit workbench / TransitHubCenterDashboard
```

因此本变更不新增虚拟 stationPlan，不改变 save archive 原始记录。
