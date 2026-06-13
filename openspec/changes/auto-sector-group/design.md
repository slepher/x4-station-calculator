# 自动星区划分 — 设计方案

## 架构概览

```
LiveProductionWorkbenchView.vue (overview mode)
├── Col 1 (3/12)
│   ├── SaveUploadPanel.vue       ← 上传触发自动分析
│   ├── GroupCoverageJumpInput     ← 分组覆盖跳数，默认 2 (仅影响新 group)
│   ├── PrefThresholdInput         ← 预制容量 (hub 阈值)
│   └── SaveList.vue               ← 绑定按钮触发分组
├── Col 2 (5/12)
│   ├── SectorConfirmBar           ← [分组覆盖跳数] [默认容量] [重新计算]
│   └── SectorGroupList            ← 已有 group + 新 group 列表
│       └── (复用 MapBindingSectorGroup 形态，或抽取共享组件)
└── Col 3 (4/12)
    ├── AllocationConfirmBar       ← [确定] (全部解决后可用)
    ├── SectorAllocationList       ← 已分配 + 存疑卡片 (未决时)
    └── EmpireWareFlowsDashboard   ← 无未决时
```

## 核心模块

### 1. Hub Detection Module (新建)

**位置**：`src/store/logic/autoGroupHub.ts`

```typescript
interface HubDetectionConfig {
  containerThreshold: number  // 默认 5_000_000 m³
}

interface StationHubInfo {
  containerCap: number
  prodLines: number
  qualified: boolean    // cap >= threshold
  score: number         // qualified ? cap / (1 + ln(1+prod)) : cap
}

function detectStationHub(station, moduleCargo, config): StationHubInfo
function getSectorPureHub(sectorMacro, stations): {code, info} | null
```

### 2. Auto Grouping Algorithm (新建)

**位置**：`src/store/logic/autoGroup.ts`

```
autoGroup.ts
├── buildSectorDistanceMatrix()     ← 复用 saveBindingUtils BFS
├── groupCleanSlate()               ← 无已有 group 时
│   ├── Phase A: pure hub groups
│   ├── Phase B: impure Tier 1
│   └── Phase C: Tier 2
├── groupIncremental()              ← 已有 group 时
│   └── 每个 group 用自己的 jumpRange
├── detectScoreTies()               ← 等距 score<30%
└── resolveUncertain()              ← 用户选择后更新分配状态
```

**类型**：

```typescript
interface SectorAssignment {
  sectorMacro: string
  status: 'auto' | 'uncertain_tie' | 'uncertain_extend' | 'standalone'
  displayBucket: 'resolved' | 'unresolved'
  defaultGroupId?: string
  options: AssignmentOption[]
  selectedOptionIndex: number | null
}

interface AssignmentOption {
  type: 'absorb' | 'standalone'
  targetGroupId?: string
  distance: number
  extendsRange: boolean
  resultingGroupSize: number
}
```

### 3. 状态管理：UI Draft vs Store

Col 2/3 维护**纯 UI 草稿**，不直接写 store：

```
┌──────────────────────────────────────┐
│  UI Draft State (LiveProductionView) │
│  ┌──────────────────────────────────┐│
│  │ groups: GroupDraft[]             ││
│  │   - existing groups (readonly)   ││
│  │   - new groups (auto-generated)  ││
│  │   - jumpRange edits (pending)    ││
│  ├──────────────────────────────────┤│
│  │ assignments: SectorAssignment[]  ││
│  │   - selected options             ││
│  │   - auto-extended ranges         ││
│  └──────────────────────────────────┘│
│                                       │
│  确定写入: createAutoGroups()          │
│  └→ saveBindingStore.write()          │
└──────────────────────────────────────┘

ProductionSidebar:
  └→ 只读 saveBindingStore
  └→ 确定后一次性刷新 (与现有 confirmBinding() 模式一致)
```

### 4. 组件树

| 组件 | 职责 |
|---|---|
| `SectorGroupList.vue` (新建) | Col 2 星区列表，展示已有/新 group，支持 Pin/跳数编辑 |
| `SectorAllocationList.vue` (新建) | Col 3 统一分配列表，卡片内候选选项上下列表，点击切换（含独立成组） |
| `SectorConfirmBar.vue` (新建) | Col 2 顶部确定栏 |
| `AllocationConfirmBar.vue` (新建) | Col 3 顶部确定栏（跨 Col 2+3 顶部） |
| `LiveProductionWorkbenchView.vue` (修改) | overview 模式布局改造 |
| `SaveList.vue` (修改) | 绑定按钮行为 |
| `SaveUploadPanel.vue` (修改) | 上传后自动分析逻辑 |

### 5. 数据流

```
用户上传/绑定存档
  └→ liveStore.activateBinding(guid)
      └→ 判定: 是否有未分配 sector?
          ├─ 是 → 运行算法
          │   ├─ 已有 group → groupIncremental()
          │   └─ 无 group   → groupCleanSlate()
          └─ 否 → 不分析

算法输出 → UI Draft State
  ├─ groups → Col 2 SectorGroupList
  └─ assignments → Col 3 SectorAllocationList

用户交互 (Col 3 选候选 / Col 2 改跳数)
  └→ UI Draft 即时更新 (不写 store)
  └→ 不重排 Col 3 cards，不改变 card 的 displayBucket

用户点击 [确定]
  └→ saveBindingStore.createAutoGroups(draft)
      ├─ createGroup / bindSectorGroup / updateGroup
      ├─ setGroupConnection (自动连接)
      └─ 一次性 persist
  └→ ProductionSidebar 刷新

用户点击 [重新计算] (Col 2)
  └→ 用各 group 当前 jumpRange 重跑算法 → Col 3 重建
```

### 6. Col 3 card 身份与顺序稳定

`SectorAllocationList` 不得用当前选择状态动态分组。`displayBucket` 只在算法输出时确定：

```typescript
displayBucket = selectedOptionIndex === null ? 'unresolved' : 'resolved'
```

该表达式只用于创建 assignment 的初始显示身份。之后用户选择候选时：

- `selectedOptionIndex` 可以变化
- `status` 可以用于业务处理
- `displayBucket` 不变化
- card 在 Col 3 的相对顺序不变化
- Col 2 draft 可以实时刷新

只有用户显式点击 [重新计算]、上传/绑定新存档触发自动分组、或其他重新运行算法的入口，才允许重建 `assignments` 并重新计算 `displayBucket` 与显示顺序。

### 7. 扩展/回退机制

```
分配 triggered (col 3 selection)
  ├─ sector distance ≤ group.jumpRange → 无需扩展
  └─ sector distance > group.jumpRange
      └→ 记录 original_range = group.jumpRange
      └→ effective_range = max(original_range, distance)
      └→ BFS 扩展覆盖星区

撤销 triggered (undo)
  └→ 检查该 group 是否还有其他 sector 需要 current_range
      ├─ 是 → 保持 current_range
      └─ 否 → 回退到 max(original_range, 其他 sector 所需最小值)
```

### 8. 复用与兼容

- Col 2 星区列表形态与 `MapBindingSectorGroup.vue` 一致（可抽取共享组件或保持独立）
- 跳数计算复用 `saveBindingUtils.ts:getCoverageSectors()`
- 绑定写入复用 `saveBindingStore:createGroup/bindSectorGroup/updateGroup/setGroupConnection`
- `ProductionSidebar` 不改动，仅在确定后通过 store 响应式刷新

### 9. 单向超高速处理

- `maps.json` 中 `sector_links` 的 `render.lane_count` 字段标识方向性：
  - `lane_count >= 2` → 双向通道
  - `lane_count === 1` → 单向通道（货船不能往返，不建边）
- `from_zone_id` 不可靠（Grand Exchange 的两条双向超高速均指向同一方向）
- 仅 Savage Spur 存在 `lane_count === 1` 的单向超高速

### 10. 覆盖排他与 Anchor 互不侵犯

- 计算覆盖按 group 优先级（高分 hub 优先）依次进行
- 已被占用的星区不出现在后续 group 的覆盖中
- 纯 hub anchor 星区互不侵犯（不进入其他 group 覆盖）
- anchor 自身不包含在 `coverageSectorMacros` 中（单独展示）
- 仅处理 `playerStations.length > 0` 的星区（排除仅含 NPC 贸易站的 sector）

### 11. 确认后展示

- `autoGroupConfirmed` 状态标记
- 确认后 `SectorConfirmBar`、`AllocationConfirmBar` 隐藏
- `SectorGroupList` 从 store 读取 group（`isNew=false`, `isPinned=false` → 只读）
- Col 3 切换为 `EmpireWareFlowsDashboard`
- Standalone 组：创建 group + bindSectorGroup + 自动连接最近已有 group

### 12. 实时联动

**吸收联动**：
```
Col 3 用户选 absorb
  └→ applyAbsorbToResult(): 目标 group coverage 加入 sector
  └→ 旧 group coverage 移除该 sector
  └→ 若 extendsRange → jumpRange 扩展至距离值
  └→ Col 2 覆盖列表实时刷新

算法默认选中的 absorb
  └→ syncSelectedAbsorptionsToCoverage(): 目标 group coverage 同步加入 sector
  └→ anchor 自身不进入 coverage

切换回到 absorb（从 standalone）
  └→ 检测 sector 之前是 standalone（selectedOptionIndex 指向 standalone 选项）
  └→ 删除空的 standalone group
  └→ 其他 sector 只清除来源于该 standalone group 的派生候选
  └→ 若当前选中项被移除，则在剩余候选中重选最佳项
```

**独立成组联动**：
```
Col 3 用户选 standalone
  └→ applyStandaloneToResult(): 创建新 GroupDraftInfo
  └→ 覆盖排除已占用 sector
  └→ computeGroupGraph() 重算 MST
  └→ Col 2 立即显示新 group
  └→ Col 3 其他可覆盖 sector 追加 derived-from-standalone 候选
  └→ 原始候选保留，不因追加派生候选而删除
  └→ 若派生候选为当前最佳候选，则自动切换选中
```

### 13. 连接星区显示

- 连接星区混入覆盖列表，按跳数分组显示——不单独列出
- 仅通过颜色区分：覆盖 = amber，连接 = emerald
- Pill 样式完全对齐 `MapBindingSectorGroup`（rounded-full, gap-1, pill-height）

### 14. UUID 持久化

- `createAutoGroups` 直接使用草案 group 的 UUID（不再重新生成）
- `connectedGroupIds` 天然正确，无需 ID 翻译映射

### 15. 确认后页面刷新

- `runAutoGroup` 检测到已有 binding group 且无新未分配 sector → `autoGroupConfirmed = true`
- 确认状态：`SectorConfirmBar` / `AllocationConfirmBar` 隐藏，group 只读
