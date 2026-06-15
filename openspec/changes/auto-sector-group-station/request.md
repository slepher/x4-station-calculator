# 请求：Auto Sector Group - 贸易站选择

## 目标

在 auto-sector-group 结果计算完成后，为每个 hub group 提供贸易站（Trade Station）选择控件。用户可以手动选择该 group 锚点星区内的玩家空间站作为交易站，或使用虚拟交易站（定位于星区中央）。该选择在提交时写入 `BindingSectorGroup.tradeStation`。

## 已确认方案（审核重点）

### 1. 候选值算法

- 对 hub group 锚点星区的 **玩家空间站** 使用 `detectStationHub()` 计算 score
- 按 score 降序取 top 5
- 硬性约束：top 5 中 `isPureHub`（qualified 且 prodLines===0）的站至少保留 2 个（如星区内存在 >= 2 个 pureHub）；不足则从后续 pureHub 补充

**用户手动添加的 hub 的特殊规则：**
- 如星区内存在 qualified 站 → 候选仅从 qualified 站中选择
- 如星区内无 qualified 站 → 候选从所有玩家站中选择（忽略阈值）

### 2. 默认值算法

默认值按以下优先级判断，前序命中后不再进入后续分支：

| 条件 | 行为 |
|------|------|
| 锚点星区无玩家空间站 | 仅显示虚拟交易站，并默认选中虚拟交易站 |
| 最高分站是 `isPureHub` | 直接选中该站 |
| 最高分不是 `isPureHub`，且同时存在 `isPureHub` 和生产站 | **无默认值**，用户手动选择 |
| 全为生产站，第一名 score > 第二名 × 1.3 | 选中第一名 |
| 全为生产站，差距不满足 30% | **无默认值**，用户手动选择 |

### 3. Card 选项

每个成为 hub 的 group 都需要一个 trade station card。每个 group card 以 `<li>` 列举：
- 候选玩家空间站（radio 选一个），显示 score 和 containerCap
- **虚拟交易站**（`__virtual__`，定位于星区中央）
- 如锚点星区无玩家空间站，则 card 仅显示虚拟交易站，并默认选中

### 4. UI 布局

**Map 面板 (`AutoSectorGroupMapPanel.vue`)：**
- 新增第3个 tab `activeTab = 'hub' | 'allocation' | 'tradeStation'`
- tab 顺序：Hub → Allocation → TradeStation
- Allocation tab 和 TradeStation tab 内各自放置 `AllocationConfirmBar`
- tradeStation tab 仅在未确认状态下展示
- 初次计算完成以及点击计算后，自动跳转到首个有未解决内容的 tab（allocation > tradeStation）
- Map: 全部解决后跳转到 hub tab；Live Col3: 全部解决后跳转到 allocation tab

**Live Col3 (`SectorOverviewPanel.vue`)：**
- 未确认状态下 Col3 改为 tab 结构（Allocation | TradeStation）
- 各 tab 内各自放置 `AllocationConfirmBar`

### 5. AllocationConfirmBar 改造

```typescript
// 旧 props
hasUncertain: boolean

// 新 props
unresolved: string[]  // i18n keys 数组
```

显示规则：
- `unresolved.length > 0` → `unresolved.map(k => t(k)).join(', ')`
- `unresolved.length === 0` → `t('sector.all_resolved')`
- status 文本可以按当前 tab 传入局部 unresolved key
- 确认按钮必须使用全局 gate：`disabled = unresolvedGlobal.length > 0 || disabled`

Allocation tab 传入 `['sector.allocation_unresolved']`，TradeStation tab 传入 `['sector.trade_station_unresolved']`。

### 6. 保留 (Retain) Trade Station

- SectorConfirmBar 阈值 `param-field` 的 label 改为 `sector.trade_station_short`（"交易站"/"Trade Station"），与桥接控件模式一致：同一 box 内 label + dropdown + checkbox
- result 模式仅显示 flat 值；edit 模式显示 dropdown + `保留` checkbox（`sector.retain`）
- `tradeStationRetainEnabled` checkbox 支持三态 indeterminate，与 group cards 双向联动
- Edit 模式下 group cards 显示 `tradeStationRetainEnabled` 开关（SectorGroupCard 内）
- GroupDraftInfo 新增 `tradeStationRetainEnabled` 字段
- 保留的 trade station 仅在计算时提供默认选中值；用户手动选择始终优先于 retain 默认值
- 虚拟交易站 code `__virtual__` 仅用于 UI/计算层，不得写入最终持久化结构

### 7. 确认按钮 Gate

确认按钮启用条件（三者全部满足）：
1. `hasUncertainAssignments === false`
2. `hasPendingBridgeDecision === false`
3. `hasUnresolvedTradeStations === false`

新增 `hasUnresolvedTradeStations`：存在需要选择 trade station 的 group 但 `selectedTradeStations[groupId]` 为 `null`。

`selectedTradeStations` 语义：
- `null`：未决，不允许确认
- `{ stationCode: '__virtual__' }`：已选择虚拟交易站，允许确认；最终持久化时 `saveStationCode` 写入 `undefined`
- `{ stationCode: '<player-station-code>' }`：已选择玩家空间站，允许确认；最终持久化时写入该 code

所有确认按钮（SectorConfirmBar、Allocation tab、TradeStation tab）都必须使用同一个全局 gate。Allocation tab 即使自身 allocation 已解决，只要 trade station 未解决，确认按钮也必须 disabled。

### 8. 重置行为

- Allocation tab 的重置按钮：仅重置 sector assignment 选择（bridge plan + uncertain sector options）
- TradeStation tab 的重置按钮：仅重置 trade station 选择，恢复为默认值

### 9. 统一确认

SectorConfirmBar 和 AllocationConfirmBar 的确认按钮功能等价，均为调用 `handleConfirm()`。

### 10. 持久化与旧自动写入逻辑

- `handleConfirm()` 必须按 `selectedTradeStations` 显式写入每个 hub group 的 trade station
- 选择玩家空间站时，最终 `BindingSectorGroup.tradeStation.saveStationCode` 为玩家站 code
- 选择虚拟交易站时，最终 `BindingSectorGroup.tradeStation.saveStationCode` 为 `undefined`，`position` 为锚点星区中心
- 现有 `createAutoGroups()` 内自动绑定 `hubStationCode` 或 fallback best station 的逻辑必须被移除、绕过或由新 selection 覆盖，不能绕过用户选择
- 如既有 group 已绑定玩家 trade station，用户改选虚拟交易站时必须清除旧 `saveStationCode`

## 边界

### In Scope

- 新组件 `SectorTradeStationList.vue` / `SectorTradeStationCard.vue`
- 候选值/默认值算法 `tradeStationSelection.ts`（复用 `detectStationHub`、`rankStationHubs`）
- Map 面板新增 TradeStation tab
- Live Col3 改为 tab 结构
- AllocationConfirmBar 改造（`hasUncertain` → `unresolved: string[]`）
- SectorConfirmBar 新增 `tradeStationRetainEnabled` checkbox
- SectorGroupCard 新增 `tradeStationRetainEnabled` 开关
- Presenter 新增 trade station 相关状态和方法
- GroupDraftInfo 新增 `tradeStationRetainEnabled` 字段
- `handleConfirm()` 调用 `upsertTradeStation()` 写入 trade station
- 调整 `createAutoGroups()` 或提交流程，避免旧自动 trade station 写入逻辑覆盖新选择
- 虚拟交易站提交时清除旧 `saveStationCode` 并写入星区中心 position

### Out of Scope

- 地图 Canvas 覆盖层
- 其他已有功能的重构
- 测试代码（由 `/x4:test` 负责）
- NPC 贸易站选择（本次仅处理玩家空间站）

## 验收标准（DoD）

1. 自动分组完成后，TradeStation tab 显示所有成为 hub 的 group card
2. 自动生成 hub（有 pureHub）和用户手动添加 hub 的候选列表正确
3. 用户手动添加 hub 且星区无 qualified 站时，候选不设阈值限制
4. 默认值按算法正确选中或留空
5. 无玩家空间站的 hub group 仅显示虚拟交易站且默认选中
6. 用户可手动选择候选站或虚拟交易站
7. tradeStation 选择未完成时所有确认按钮 disabled
8. sector assignment、bridge decision 和 trade station 全部完成后确认可用
9. 确认后 trade station 选择写入 `BindingSectorGroup.tradeStation`
10. 虚拟交易站不会把 `__virtual__` 写入持久化，最终 `saveStationCode` 为 `undefined`
11. 保留 checkbox 正确控制默认选中已有 tradeStationCode
12. 重置按钮仅重置当前 tab 的选择
13. `npm run build` 通过

## 未决项

无
