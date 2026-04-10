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

### Requirement: Binding Planned Modules in Production

系统 MUST 在 save-binding 数据源下只使用 planned modules。

#### Scenario: save station 没有 planning layer
- **前提** 某个 save station 由 coverage 自动派生
- **并且** 没有对应 `SaveStationPlan`
- **当** 系统计算 save-binding source 的生产结果
- **那么** 该 save station SHALL 使用空 planned modules
- **并且** 对生产计算贡献为 0

#### Scenario: save station 已有 planning layer
- **前提** 某个 save station 已存在 `SaveStationPlan`
- **当** 系统计算 save-binding source 的生产结果
- **那么** 系统 SHALL 使用 `SaveStationPlan.modules`
- **并且** SHALL NOT 使用 save archive 中解析出的 save modules

#### Scenario: virtual station 参与生产计算
- **前提** binding 中存在 virtual station plan
- **当** 系统计算 save-binding source 的生产结果
- **那么** 系统 SHALL 使用 virtual station 的 planned modules
- **并且** 在本阶段 SHALL NOT 要求量化生产 UI 对 virtual station 和 save station plan 做区别展示
