# Empire Production Summary Specification

## Purpose
扩展量化生产界面的输入来源，使其可以在普通 empire planning 与 save binding planning 之间切换，并在 binding source 下只读取规划 modules。

## ADDED Requirements

### Requirement: Production Source Selection

系统 MUST 支持选择量化生产数据源。

#### Scenario: 用户选择 empire source
- **前提** 用户位于量化生产界面
- **当** 用户选择 `empire` 数据源
- **那么** 系统 SHALL 使用当前 empire stations 作为生产计算输入

#### Scenario: 用户选择 save-binding source
- **前提** 用户位于量化生产界面
- **并且** 至少存在一个 save binding
- **当** 用户选择某个 save binding 作为数据源
- **那么** 系统 SHALL 使用该 binding 的 station views 作为生产计算输入

#### Scenario: binding 入口切换 production source
- **前提** 用户位于存档首页
- **当** 用户点击某个 `gameGuid` 的 binding 入口并成功进入 binding
- **那么** 量化生产界面 SHALL 将 active source 切换为该 `gameGuid` 对应的 `save-binding`
- **并且** SHALL 显示当前绑定存档对应的 binding 数据

### Requirement: Binding Planned Modules in Production

系统 MUST 在 save-binding 数据源下只使用 planned modules。

#### Scenario: save station 没有 planning layer
- **前提** 某个 save station 由 coverage 自动派生
- **并且** 没有对应 `SaveStationPlan`
- **当** 系统计算 save-binding source 的生产结果
- **那么** 该 save station SHALL 作为普通空间站映射到量化生产
- **并且** 该 save station SHALL 使用空 planned modules
- **并且** 对生产计算贡献为 0

#### Scenario: save station 已有 planning layer
- **前提** 某个 save station 已存在 `SaveStationPlan`
- **当** 系统计算 save-binding source 的生产结果
- **那么** 该 save station SHALL 作为普通空间站映射到量化生产
- **并且** 系统 SHALL 使用 `SaveStationPlan.modules`
- **并且** SHALL NOT 使用 save archive 中解析出的 save modules

#### Scenario: virtual station 参与生产计算
- **前提** binding 中存在 virtual station plan
- **当** 系统计算 save-binding source 的生产结果
- **那么** virtual station SHALL 作为普通空间站映射到量化生产
- **并且** 系统 SHALL 使用 virtual station 的 planned modules
- **并且** 在本阶段 SHALL NOT 要求量化生产 UI 对 virtual station 和 save station plan 做区别展示

#### Scenario: save station 不属于任何 binding group
- **前提** 当前 archive 中存在 player save station
- **并且** 该 save station 不在任何 `BindingSectorGroup.coverageSectorMacros` 派生范围内
- **当** 系统计算 save-binding source 的生产结果
- **那么** 系统 SHALL NOT 将该 save station 映射到量化生产

### Requirement: Binding Transit Hub Mapping

系统 MUST 将 binding 星区中转站映射为量化生产中的 transit hub，而不是普通生产空间站。

#### Scenario: 星区中转站映射为 transit hub
- **前提** binding group 存在 `TradeStationBinding`
- **当** 系统计算 save-binding source
- **那么** 系统 SHALL 将该 `TradeStationBinding` 映射为星区中转站 / transit hub
- **并且** SHALL NOT 将该 `TradeStationBinding` 映射为普通 station
- **并且** SHALL NOT 从该 `TradeStationBinding` 读取 planned modules 参与普通 station 生产计算
