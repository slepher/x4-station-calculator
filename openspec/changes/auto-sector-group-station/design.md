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
}
```

## Decisions

### D1: 候选筛选复用 `detectStationHub`

直接对星区内玩家空间站调用 `detectStationHub()`，复用既有 hub score 逻辑。无需为新控件单独设计评分体系。

### D2: 虚拟站 code 仅用于 UI/计算层

虚拟交易站在 `selectedTradeStations` 中使用 `stationCode = '__virtual__'` 表示“已选择虚拟站”。该值不得传入最终持久化结构。

最终提交时：
- 玩家空间站 → `saveStationCode = stationCode`
- 虚拟交易站 → `saveStationCode = undefined`，`position = getSectorCenterPosition(...)`
- 如既有 trade station 曾绑定玩家站，改选虚拟交易站时必须清除旧 `saveStationCode`

### D3: AllocationConfirmBar 改造为 i18n-key 数组

将 `hasUncertain: boolean` 替换为 `unresolved: string[]`，保留扩展性。未来如需要同时显示多种未解决类型，只需传入多个 key。

按钮 disabled 不只看当前 tab 的 `unresolved`。所有确认按钮必须接收全局 unresolved/gate，确保任一 tab 中点击确认都满足 allocation、bridge、trade station 三类问题全部解决。

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

现有 `createAutoGroups()` 会在 group 创建/绑定时自动写入 trade station。该旧行为必须被调整，不能绕过 `selectedTradeStations`：
- 推荐方案：`createAutoGroups()` 只负责 group/coverage/connection，不再根据 `hubStationCode` 或 fallback best station 写 trade station
- `handleConfirm()` 在 `createAutoGroups()` 后遍历 `selectedTradeStations` 写入 trade station
- 如果保留旧自动创建虚拟 trade station 作为基础结构，后续 selection 写入必须覆盖它，并能清除旧 `saveStationCode`

## Data Flow

```
runAutoGroup() / runCalculationFromEditInput()
  │
  ├→ autoGroupResult 生成
  │   └→ groups[] 含 hubStationCode, savedTradeStationCode, tradeStationRetainEnabled
  │
  ├→ tradeStationCandidates 计算
  │   ├→ 遍历 groups
  │   │   ├→ auto hub（有 hubStationCode）→ 星区所有玩家站
  │   │   ├→ user-added hub → 有 qualified → 仅 qualified 站
  │   │   └→ user-added hub → 无 qualified → 全部玩家站
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
