# Auto Sector Group - 贸易站选择 Specification

## Purpose

为 auto-sector-group 结果中的每个 hub group 提供贸易站选择功能，允许用户从星区内玩家空间站中选择交易站或使用虚拟交易站。选择结果在提交时写入 `BindingSectorGroup.tradeStation`。

## ADDED Requirements

### Requirement: TradeStation 候选值计算

系统 SHALL 在自动分组计算完成后，为每个 group 的锚点星区计算贸易站候选列表。

#### Scenario: 自动生成 hub 的候选列表

- **前提**：星区 A 有 4 个玩家空间站，其中 2 个 pureHub（qualified 且 prodLines===0）、2 个生产站
- **当**：系统生成自动分组结果，星区 A 成为 hub anchor
- **那么**：候选列表包含全部 4 个站，按 score 降序排列为 top 5
- **并且**：top 5 中至少保留 2 个 pureHub（如星区内存在 >= 2 个 pureHub）

#### Scenario: 用户手动添加 hub 且有 qualified 站

- **前提**：星区 B 有 3 个玩家空间站，其中 1 个 qualified（>= 5M containerCap）但非 pureHub，2 个不 qualified
- **当**：用户手动在星区 B 添加 hub
- **那么**：候选列表仅包含 1 个 qualified 站

#### Scenario: 用户手动添加 hub 且无 qualified 站

- **前提**：星区 C 有 2 个玩家空间站，均不 qualified（containerCap < 5M）
- **当**：用户手动在星区 C 添加 hub
- **那么**：候选列表包含全部 2 个站（忽略阈值限制）

#### Scenario: 不足 5 个候选

- **前提**：星区 D 只有 2 个玩家空间站
- **当**：计算候选列表
- **那么**：返回这 2 个站（不强制 top 5）

### Requirement: TradeStation 默认值算法

系统 SHALL 根据候选站列表自动确定默认选中值。

#### Scenario: 最高分是 pureHub — 自动选中

- **前提**：候选站中 score 最高的是 pureHub（prodLines === 0），即使候选站中同时存在生产站
- **当**：计算默认值
- **那么**：该站被自动选中

#### Scenario: 混合 pureHub 和生产站且第一名不是 pureHub — 无默认

- **前提**：候选站中同时存在 pureHub 和生产站，且 score 最高的候选站不是 pureHub
- **当**：计算默认值
- **那么**：无默认值，需用户手动选择

#### Scenario: 全为生产站且第一名优势明显 — 自动选中

- **前提**：候选站全为生产站（prodLines > 0），第一名 score > 第二名 score × 1.3
- **当**：计算默认值
- **那么**：第一名被自动选中

#### Scenario: 全为生产站且差距不足 — 无默认

- **前提**：候选站全为生产站，第一名 score ≤ 第二名 score × 1.3
- **当**：计算默认值
- **那么**：无默认值，需用户手动选择

#### Scenario: 无玩家空间站 — 默认虚拟交易站

- **前提**：某个 hub group 的锚点星区没有玩家空间站
- **当**：计算默认值
- **那么**：该 group 的候选列表仅包含虚拟交易站
- **并且**：虚拟交易站被默认选中

### Requirement: TradeStation 选择 UI

系统 SHALL 在 Map 面板和 Live Col3 中提供 trade station 选择界面。

#### Scenario: Map 面板 TradeStation tab

- **前提**：自动分组计算已完成且已展示 Allocation tab
- **当**：用户解决完所有 sector allocation 不确定项
- **并且**：用户点击 TradeStation tab
- **那么**：显示所有成为 hub 的 group card（SectorTradeStationList）
- **并且**：每个 card 以 li 列表显示候选站（radio + score + containerCap）和虚拟交易站选项

#### Scenario: Live Col3 tab 结构

- **前提**：用户在 Live Production Overview 界面，自动分组已计算
- **当**：Col3 区域渲染
- **那么**：在未确认状态下显示 tab-bar（Allocation | TradeStation）
- **并且**：Allocation tab 内显示 AllocationConfirmBar + SectorAllocationList
- **并且**：TradeStation tab 内显示 AllocationConfirmBar + SectorTradeStationList

#### Scenario: 用户选择候选站

- **前提**：TradeStation tab 中显示某个 group 的候选列表
- **当**：用户点击某个候选站的 radio
- **那么**：该站被选中，selectedTradeStations 更新
- **并且**：该 group 标记为已解决

#### Scenario: 用户选择虚拟交易站

- **前提**：TradeStation tab 中显示某个 group 的候选列表
- **当**：用户点击"虚拟交易站"选项
- **那么**：选中虚拟站（UI/计算层 code = `__virtual__`），定位于星区中央
- **并且**：该 group 标记为已解决

#### Scenario: 无玩家空间站的 group card

- **前提**：某个 hub group 的锚点星区没有玩家空间站
- **当**：TradeStation tab 渲染该 group card
- **那么**：该 card 仅显示虚拟交易站选项
- **并且**：虚拟交易站默认选中

### Requirement: AllocationConfirmBar 改造

系统 SHALL 将 `AllocationConfirmBar` 的 props 从 `hasUncertain: boolean` 改为 `unresolved: string[]`，并使用全局确认 gate 控制确认按钮。

#### Scenario: 显示未解决项

- **前提**：Allocation tab 中存在未解决的 sector assignment
- **当**：渲染 AllocationConfirmBar
- **那么**：显示 `t('sector.allocation_unresolved')`
- **并且**：确认按钮 disabled

#### Scenario: 显示全部已解决

- **前提**：当前 tab 的所有项均已解决
- **并且**：全局确认 gate 也已解决
- **当**：渲染 AllocationConfirmBar
- **那么**：显示 `t('sector.all_resolved')`
- **并且**：确认按钮 enabled

#### Scenario: 当前 tab 已解决但全局仍有未解决项

- **前提**：Allocation tab 的 sector assignment 已解决
- **并且**：存在未解决的 trade station
- **当**：渲染 Allocation tab 的 AllocationConfirmBar
- **那么**：确认按钮 disabled

#### Scenario: 显示多种未解决

- **前提**：存在未解决的 sector assignment 和未解决的 trade station
- **当**：渲染 AllocationConfirmBar 并传入多个 i18n key
- **那么**：显示翻译后的多个字符串，以 `, ` 连接

### Requirement: 保留 TradeStation Checkbox

系统 SHALL 在 SectorConfirmBar 和 Edit 模式 group cards 中提供保留 trade station 的开关。

#### Scenario: SectorConfirmBar 中的保留 checkbox

- **前提**：SectorConfirmBar 渲染
- **当**：用户看到阈值/参数行
- **那么**：显示 `tradeStationRetainEnabled` checkbox（i18n key `sector.trade_station_retain`）

#### Scenario: Edit 模式 group card 中的保留开关

- **前提**：用户进入编辑模式
- **当**：渲染 SectorGroupCard
- **那么**：每个 group 显示 `tradeStationRetainEnabled` 开关
- **并且**：开关状态反映 `GroupDraftInfo.tradeStationRetainEnabled`

#### Scenario: 保留启用时的默认值

- **前提**：group 的 `tradeStationRetainEnabled === true` 且 `savedTradeStationCode` 存在
- **当**：recalculate 后计算 trade station 默认值
- **那么**：首选使用 `savedTradeStationCode` 作为默认值
- **并且**：用户仍可在 TradeStation tab 中手动更改

### Requirement: 确认按钮 Gate

系统 SHALL 仅在所有分配完成时启用确认按钮。

#### Scenario: 全部未完成 — 确认 disabled

- **前提**：存在 uncertain assignment、pending bridge decision 和 unresolved trade station
- **当**：渲染确认按钮
- **那么**：确认按钮 disabled

#### Scenario: allocation 完成但 trade station 未完成 — 确认 disabled

- **前提**：sector assignment 和 bridge 均已解决，但某些 group 的 trade station 未选择
- **当**：渲染确认按钮
- **那么**：Allocation tab 的确认按钮 disabled
- **并且**：TradeStation tab 的确认按钮 disabled
- **并且**：SectorConfirmBar 的确认按钮 disabled

#### Scenario: 全部完成 — 确认 enabled

- **前提**：所有 sector assignment、bridge plan、trade station 均已完成
- **当**：渲染确认按钮
- **那么**：所有确认按钮 enabled，点击任一均写入并跳转到 confirmed 状态

### Requirement: 重置按钮行为

系统 SHALL 按当前 tab 范围执行重置操作。

#### Scenario: Allocation tab 重置

- **前提**：用户在 Allocation tab
- **当**：点击重置
- **那么**：仅重置 sector assignment 选择（bridge plan + uncertain sector options）
- **并且**：trade station 选择不受影响

#### Scenario: TradeStation tab 重置

- **前提**：用户在 TradeStation tab
- **当**：点击重置
- **那么**：仅重置 trade station 选择为默认值
- **并且**：sector assignment 选择不受影响

### Requirement: 动态 Card 管理

系统 SHALL 在 groups 增删时同步更新 trade station card 列表。

#### Scenario: 新增 hub → 新增 card

- **前提**：TradeStation tab 中存在 N 个 group card
- **当**：用户手动添加一个新的 hub
- **那么**：card 列表自动增加对应的新 card

#### Scenario: 删除 hub → 移除 card

- **前提**：TradeStation tab 中存在 N 个 group card
- **当**：用户删除一个 hub group
- **那么**：card 列表自动移除对应的 card

### Requirement: 确认后持久化

系统 SHALL 在确认时将 trade station 选择写入 `BindingSectorGroup.tradeStation`。

#### Scenario: 选择玩家站

- **前提**：用户选择 `stationCode = "ABC123"` 的玩家空间站作为 trade station
- **当**：点击确认
- **那么**：`saveBindingStore.upsertTradeStation()` 被调用
- **并且**：`BindingSectorGroup.tradeStation.saveStationCode = "ABC123"`

#### Scenario: 选择虚拟站

- **前提**：用户选择虚拟交易站
- **当**：点击确认
- **那么**：`BindingSectorGroup.tradeStation.saveStationCode = undefined`
- **并且**：`position` 设为星区中央位置
- **并且**：系统 SHALL NOT 将 `__virtual__` 写入持久化结构

#### Scenario: 从已有玩家站改选虚拟站

- **前提**：某个 group 已有 `BindingSectorGroup.tradeStation.saveStationCode = "ABC123"`
- **当**：用户改选虚拟交易站并点击确认
- **那么**：该 group 的 `tradeStation.saveStationCode` 被清除为 `undefined`
- **并且**：`position` 更新为锚点星区中央位置

#### Scenario: 旧自动写入逻辑不得覆盖用户选择

- **前提**：auto-sector-group 提交过程中创建或更新 groups
- **当**：用户已在 TradeStation tab 选择某个玩家站或虚拟交易站
- **那么**：旧的 `hubStationCode` 自动绑定或 fallback best station 逻辑 SHALL NOT 覆盖该选择
