# Archive Modules Display Specification

## Purpose

为 Live 界面中对应 save station 的空间站提供一个 tab 切换界面，允许用户在"规划模块"和"存档实际模块"之间切换查看。

## ADDED Requirements

### Requirement: Station Planning Panel Wrapper

当空间站对应一个 save station 时，StationPlanningPanel 外层需要包裹一个 tab 切换组件，提供两个视图。

#### Scenario: Save Station Has Two Tabs

**前提** 当前选中的 station 对应一个 save station（saveStationCode 有值且存档中存在 modules 数据）

**当** 用户查看左侧面板

**那么** 左侧面板显示两个 tab：规划（Plan）和存档（Archive）

**并且** 默认选中规划 tab

**并且** 规划 tab 内显示原有的 StationPlanningPanel

#### Scenario: Virtual Station Has No Tabs

**前提** 当前选中的 station 是虚拟空间站（无 saveStationCode 或存档中无 modules 数据）

**当** 用户查看左侧面板

**那么** 左侧面板直接显示 StationPlanningPanel（无 tab 切换）

### Requirement: Archive Module List Display

存档 tab 需要显示存档中该空间站的实际模块列表，按模块分组显示。

#### Scenario: Modules Grouped By Group

**前提** 用户切换到存档（Archive）tab

**并且** 存档空间站有 modules 数据

**当** 存档 tab 显示模块列表

**那么** 模块按 `group` 字段分组显示

**并且** 每个分组显示分组标题

**并且** 组内模块按 picker 排序逻辑排序

#### Scenario: Module Item Display

**前提** 存档 tab 显示模块列表

**当** 每个模块项渲染

**那么** 模块项显示：颜色指示器 + 模块名称 + 数量

**并且** 颜色指示器颜色根据模块 group type 决定（参照 StationModulePicker）

#### Scenario: Empty Archive Modules

**前提** 用户切换到存档（Archive）tab

**并且** 存档空间站无 modules 数据

**当** 存档 tab 显示

**那么** 显示空状态提示

### Requirement: I18n Support

所有显示文本需要支持 i18n。

#### Scenario: Tab Labels I18n

**前提** 用户切换语言

**当** tab 组件渲染

**那么** 规划 tab 显示：
- zh-CN: 规划
- en: Plan

**并且** 存档 tab 显示：
- zh-CN: 存档
- en: Archive

#### Scenario: Group Name I18n

**前提** 用户切换到存档 tab

**当** 分组标题渲染

**那么** 分组名称通过 `localizedModuleGroupsMap[group].localeName` 显示

#### Scenario: Module Name I18n

**前提** 用户切换到存档 tab

**当** 模块名称渲染

**那么** 模块名称通过 `localizedModulesMap[module_id].localeName` 显示

### Requirement: Tab State Persistence

Tab 切换状态需要保持在当前会话中。

#### Scenario: Tab Switch State

**前提** 用户选中存档 tab

**当** 用户切换到其他 station 后返回同一 station

**那么** tab 状态根据实现策略保持（可选择：每个 station 独立状态或全局状态）

### Requirement: Data Source Resolution

需要正确解析 save station 的 modules 数据源。

#### Scenario: Resolve Save Station Modules

**前提** 当前 station 有 saveStationCode

**当** 组件需要获取存档模块数据

**那么** 通过 saveStationCode 在 playerStationRecords 中查找匹配记录

**并且** 从 PlayerStationEntry.modules 获取模块列表

**并且** 使用 modulesByMacroId 映射 ref 到 module_id, type, group