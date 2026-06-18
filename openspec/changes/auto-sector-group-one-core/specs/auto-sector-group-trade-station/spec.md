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

#### Scenario: bridge hub 的候选列表

- **前提**：星区 E 成为 bridge plan 中的一个 unit anchor，星区内有 3 个玩家空间站
- **当**：bridge plan 被采用，该 unit 创建为 bridge group
- **那么**：候选列表包含全部 3 个站（不强制 qualified 阈值，与手动 hub 同规则）

#### Scenario: 不足 5 个候选且 pureHub 补充

- **前提**：星区 D 有 2 个 pureHub 和 4 个生产站（共 6 个玩家站），pureHub 的 score 排在第 4-6 位
- **当**：计算候选列表
- **那么**：返回前 3 个生产站（score 1-3）+ 2 个 pureHub（score 4-5），共 5 个候选
- **并且**：pureHub 通过替换最低分非 pureHub 进入 top 5，非追加
- **并且**：候选总数不超过 5

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

### Requirement: Hub Pill 容量显示

系统 SHALL 在 hub 的 trade station 药丸上显示选中站的 container 容量。

#### Scenario: 选中玩家站时显示容量

- **前提**：用户选中 player station "SYY-377"，其 containerCap = 21_500_000
- **当**：渲染 SectorGroupCard 的 anchor row
- **那么**：药丸显示 "SYY-377 21M"
- **并且**：容量为 `Math.floor(containerCap / 1_000_000)`，不显示 m³

#### Scenario: 虚拟交易站不显示容量

- **前提**：用户选中虚拟交易站
- **当**：渲染 SectorGroupCard 的 anchor row
- **那么**：药丸仅显示 "虚拟交易站"（无容量后缀）

### Requirement: 拖动落点虚边

系统 SHALL 在 hub card 拖拽排序时在落点位置显示虚线边框。

#### Scenario: 拖拽时显示落点

- **前提**：用户在 edit 或 result 模式下拖拽 hub card
- **当**：拖拽过程中
- **那么**：落点位置显示虚线天蓝边框 + 浅蓝背景
- **并且**：落点高度至少 48px，视觉可见

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

### Requirement: 保留 TradeStation 默认值

系统 SHALL 在重算时支持保留已保存的 trade station 作为默认值。

#### Scenario: 保留启用时的默认值

- **前提**：group 的 `tradeStationRetainEnabled === true` 且 `savedTradeStationCode` 存在
- **当**：recalculate 后计算 trade station 默认值
- **那么**：首选使用 `savedTradeStationCode` 作为默认值
- **并且**：用户仍可在 TradeStation tab 中手动更改

### Requirement: 确认按钮 Gate

系统 SHALL 仅在 bridge、assignment 和 trade station 全部解决时允许共用 `AutoSectorBar` 提交。

#### Scenario: 全部未完成 — 确认 disabled

- **前提**：存在 uncertain assignment、pending bridge decision 和 unresolved trade station
- **当**：渲染共用 `AutoSectorBar`
- **那么**：提交按钮 disabled

#### Scenario: allocation 完成但 trade station 未完成 — 确认 disabled

- **前提**：sector assignment 和 bridge 均已解决，但某些 group 的 trade station 未选择
- **当**：渲染共用 `AutoSectorBar`
- **那么**：共用 `AutoSectorBar` 的确认按钮 disabled
- **并且**：系统 SHALL NOT 写入 binding

#### Scenario: 全部完成 — 确认 enabled

- **前提**：所有 sector assignment、bridge plan、trade station 均已完成
- **当**：渲染共用 `AutoSectorBar`
- **那么**：提交按钮 enabled
- **并且**：点击提交 SHALL 写入并进入 confirmed 状态

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
