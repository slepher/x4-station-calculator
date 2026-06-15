# Tasks: Auto Sector Group - 贸易站选择

## 1. 类型与基础工具

- [x] 1.1 创建 `src/store/logic/tradeStationSelection.ts`
  - `TradeStationCandidate` 类型
  - `TradeStationSelection` 类型（玩家站 code 或 UI/计算层 `__virtual__`）
  - `selectCandidates(sectorMacro, stations, modulesByMacroId, config)` — top 5 + pureHub 约束，支持 `requireQualified` 参数
  - `determineDefault(candidates)` — 默认值算法（空候选默认虚拟、第一名 pureHub 优先、mixed 非 pureHub 第一名留空、全生产站 30% 阈值）

## 2. GroupDraftInfo 扩展

- [x] 2.1 `autoGroup.ts` — `GroupDraftInfo` 新增 `savedTradeStationCode?: string`、`tradeStationRetainEnabled?: boolean`
- [x] 2.2 `autoGroup.ts` — `groupCleanSlate()` / `groupIncremental()` 生成 group 时初始化新字段

## 3. Presenter 扩展

- [x] 3.1 `useAutoSectorGroupPresenter.ts`
  - `tradeStationCandidates: computed<Record<string, TradeStationCandidate[]>>`
  - `selectedTradeStations: ref<Record<string, TradeStationSelection | null>>`
  - `tradeStationRetainEnabled: ref`
  - `hasUnresolvedTradeStations: computed`
  - `unresolvedTradeStationGroups: computed<string[]>` — i18n keys
  - `handleSelectTradeStation(groupId, selection)`
  - `handleResetTradeStations()`
  - `handleMasterTradeStationRetain(enabled)`
  - `handleToggleTradeStationRetain(groupId)`
- [x] 3.2 `handleConfirm()` — 遍历 groups 调 `upsertTradeStation()`
- [x] 3.3 `handleConfirm()` — 玩家站持久化为 `saveStationCode`，虚拟站 `__virtual__` 持久化为 `saveStationCode: undefined` 且 position 为星区中心
- [x] 3.4 `handleConfirm()` — 若既有 trade station 绑定玩家站，改选虚拟站时清除旧 `saveStationCode`
- [x] 3.5 `handleResetAssignments()` — 仅重置 allocation，不影响 trade station

## 4. AllocationConfirmBar 改造

- [x] 4.1 props: `hasUncertain: boolean` → `unresolved: string[]`
- [x] 4.2 显示逻辑：`unresolved.length > 0 ? unresolved.map(k => t(k)).join(', ') : t('sector.all_resolved')`
- [x] 4.3 新增或复用全局 disabled/gate props，确认按钮 disabled 必须覆盖 allocation、bridge、trade station 三类 unresolved

## 5. SectorConfirmBar 扩展

- [x] 5.1 阈值/参数行新增 `tradeStationRetainEnabled` checkbox
- [x] 5.2 新增 prop `tradeStationRetainEnabled` 和 emit `update:trade-station-retain-enabled`

## 6. SectorGroupCard 扩展

- [x] 6.1 Edit 模式下每 group card 新增 `tradeStationRetainEnabled` 开关
- [x] 6.2 显示 saved trade station 名称（如有）

## 7. 新 Vue 组件

- [x] 7.1 `SectorTradeStationCard.vue`
  - props: `group`, `candidates`, `selected`, `disabled`
  - li 列表：候选站 radio（显示 score + containerCap）+ 虚拟交易站
  - 无玩家站时仅显示虚拟交易站并默认选中
  - emit `select`
- [x] 7.2 `SectorTradeStationList.vue`
  - props: `groups`, `candidates`, `selected`, `disabled`, `view`
  - 遍历所有成为 hub 的 groups 生成 SectorTradeStationCard

## 8. Map 面板改动

- [x] 8.1 `activeTab` 类型扩展为 `'hub' | 'allocation' | 'tradeStation'`
- [x] 8.2 新增 TradeStation tab（与 Allocation tab 同级）
- [x] 8.3 TradeStation tab 内放置 `AllocationConfirmBar` + `SectorTradeStationList`
- [x] 8.4 Allocation tab 内 `AllocationConfirmBar` 传入 `unresolvedAllocationGroups`
- [x] 8.5 tab 切换逻辑：allocation 解决后可手动切到 tradeStation
- [x] 8.6 初始 auto-switch 逻辑调整

## 9. Live Col3 改动

- [x] 9.1 Col3 未确认状态下改为 tab 结构（Allocation | TradeStation）
- [x] 9.2 Allocation tab：`AllocationConfirmBar` + `SectorAllocationList`
- [x] 9.3 TradeStation tab：`AllocationConfirmBar` + `SectorTradeStationList`

## 10. i18n

- [x] 10.1 `en.json`
  - `sector.allocation_unresolved`: "Sector allocation unresolved"
  - `sector.trade_station_unresolved`: "Trade station assignment unresolved"
  - `sector.all_resolved`: "All resolved"
  - `auto_sector.trade_station_tab`: "Trade Station"
  - `sector.trade_station_retain`: "Retain Trade Station"
  - `sector.virtual_trade_station`: "Virtual Trade Station"
- [x] 10.2 `zh-CN.json`
  - 对应中文翻译

## 11. 持久化与旧自动逻辑

- [x] 11.1 调整 `createAutoGroups()` 或提交流程，避免旧逻辑根据 `hubStationCode` / fallback best station 自动写入 trade station 并覆盖用户选择
- [x] 11.2 确认 `__virtual__` 只存在于 UI/计算层，不写入 `BindingSectorGroup.tradeStation.saveStationCode`
- [x] 11.3 确认虚拟站提交可以清除已有玩家站 `saveStationCode`

## 12. Build 验证

- [x] 12.1 `npm run build` 通过，无 compile error
