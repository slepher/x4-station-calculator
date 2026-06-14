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

- disabledConnectedGroupIds / excludedDefaultConnectedGroupIds
+ removed
```

Draft-only 状态：

```ts
interface GroupDraftInfo {
  isPinned: boolean
  baseline?: boolean
  enteredOtherGroupCoverage?: boolean
  excludedDefaultAssignmentSectorMacros: string[]
}
```

语义：
- `isPinned=true`：作为下次计算固定 hub 输入
- `isPinned=false`：不作为固定 hub 输入
- `baseline=true`：该 group 来自进入编辑前快照，不可真正删除
- `enteredOtherGroupCoverage=true`：unpinned baseline hub 已进入其他 hub coverage，不允许重新 pin
- `excludedDefaultAssignmentSectorMacros`：该 group 不可作为这些玩家 sector 的默认选中项，但仍可作为 Col 3 手动 option

`excludedDefaultAssignmentSectorMacros` 仅适用于有玩家空间站的 sector。非玩家星区没有玩家归属默认值，不进入该字段。

## Baseline Snapshot

进入编辑态时在 `SectorOverviewPanel` 保存：

```ts
interface SectorEditBaseline {
  groups: GroupDraftInfo[]
  coverageByGroupId: Record<string, Set<string>>
  anchorSectorMacros: Set<string>
}
```

baseline 的定义是“点击 [编辑] 前的当前显示状态”。

baseline 用途：
- UI 粗边框
- coverage 恢复来源
- baseline coverage 即使被其他 group 获取或因 jumpRange 缩小超出范围，也要能继续显示为可恢复候选
- 当其他 group 移除该 sector，或 jumpRange 调回覆盖范围时，可恢复为当前 group coverage

connection 不使用 baseline 恢复逻辑。

## SectorConfirmBar

参数顺序：`桥接 | 节点 | 阈值 | 覆盖`

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
- 计算结果态只读展示节点状态
- 编辑输入态按钮顺序为 `[取消] [计算] [添加]`
- [添加] 触发 hub 选择 popup，不传目标 group

## Hub 添加菜单

复制 `MapBindSectorMenu` 为 `SectorHubAddMenu.vue`，但语义改为添加 hub draft group。

显示规则：
- popup / popover 方式显示，锚定 [添加] 或使用 modal/dropdown overlay
- 不作为普通页面流元素显示
- 无搜索时只列玩家星区
- 搜索时遍历全地图 sectors，包含无玩家空间站 sector
- `showMapButton?: boolean` 默认 false
- 已是任意 group anchor 的 sector 不显示 `+`
- 点击 `+` 创建新的 `GroupDraftInfo`
- 新 group 默认 `isPinned=false`、`baseline=false`、可删除

## Unified Pill Rows

取消三 tab。每个 group 下按实际 jump 分组，每个 jump row 内混排三类 pill：

| 类型 | 颜色 | 数据来源 | 按钮 |
|---|---|---|---|
| coverage | 金色 | 当前 group active coverage | `×` |
| candidate | 半金 | 可进入当前 group coverage 的 sector | `+` 或 `→` |
| connected | 绿色 | hub anchor / connected group | `+` 或 `×` |

视觉叠加：
- baseline：粗边框
- 有玩家空间站：实心点
- 无玩家空间站：空心点
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

## Coverage / Candidate 规则

### 范围来源

coverage/candidate 使用当前 group 的 `jumpRange`。

候选星区：
- 当前 group anchor 的 `jumpRange` 内
- 不是当前 group active coverage
- 不是任意 hub anchor
- 有玩家空间站的 sector
- 或 baseline coverage 的可恢复项

非玩家星区可作为 hub anchor / 连接对象，但不作为玩家 coverage 默认归属问题处理。

### jumpRange 修改

修改 group jumpRange 时，采用 `MapBindingSectorGroup` 的覆盖联动语义：

- jumpRange 增大：
  - 新范围内符合条件的玩家星区自动加入当前 group active coverage
  - 显示为金色 coverage pill
- jumpRange 缩小：
  - 超出范围的非 baseline coverage 从当前 group active coverage 移出
  - baseline coverage 超出范围仍显示为候选/可恢复项
  - 候选超出范围后不显示
- jumpRange 改回覆盖 baseline coverage 时：
  - baseline coverage 可重新进入 active coverage

修改 coverage jumpRange 不影响连接。

### 跨 group 获取

candidate 可以多 group 共存，active coverage 排他。

当 sector S 在 group A 中为 active coverage，同时在 group B 中作为 candidate：
- group B 中 S 显示半金 candidate pill
- 按钮显示 `→`
- 点击 `→` 后，S 转入 group B active coverage
- group A 中：
  - 若 S 是 baseline coverage，保留为可恢复候选
  - 若 S 是非 baseline coverage，则从 active coverage 移出；若仍在 group A jumpRange 内，显示为候选

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
- 点击 `+` → 加入 `connectedGroupIds`
- 点击 `×` → 从 `connectedGroupIds` 移除

connection 不使用 baseline 行为，不使用 excluded/default-off 字段。

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
