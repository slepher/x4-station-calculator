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
