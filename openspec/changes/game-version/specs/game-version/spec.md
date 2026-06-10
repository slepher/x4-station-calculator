# Game Version Specification

## MODIFIED Requirements

### Requirement: Resource Version Configuration

资源管理配置 SHALL 独立于用户版本配置，用于 `scripts/` 下 distiller、data processor 和相关资源生成脚本。

#### Scenario: Resource config keeps physical resource versions only

**前提** 资源处理脚本读取 `x4-station-calculator.config.json`  
**那么** 配置 SHALL 只包含实际资源目录版本 `8.0` 与 `9.0`  
**并且** `8.0` SHALL 指向 `8.0-Diplomacy`  
**并且** `9.0` SHALL 指向 `9.0-Empire`  
**并且** 资源配置 SHALL NOT 为同一套 `9.0-Empire` 资源额外声明 `9.0-beta`

### Requirement: User Version Configuration

用户版本配置 SHALL 独立表达前端可选版本，并允许多个用户版本共享同一套资源目录与存储命名。

#### Scenario: User config exposes three selectable versions

**前提** 前端读取 `src/assets/versions.json`  
**那么** 用户版本列表 SHALL 包含 `8.0`、`9.0-beta`、`9.0` 三个可选版本  
**并且** `9.0-beta` SHALL 使用 `version = "9.0"` 与 `beta = true`  
**并且** `9.0` SHALL 使用 `version = "9.0"` 与 `beta = false`

#### Scenario: Both 9.0 user versions share resource folder

**前提** 用户选择 `9.0-beta` 或 `9.0`  
**那么** 游戏数据加载 SHALL 使用 `folder_name = "9.0-Empire"`  
**并且** i18n 游戏语言包 SHALL 从 `9.0-Empire` 目录加载

#### Scenario: 9.0-beta uses _v9_beta storage, 9.0 stable uses _v9 storage

**前提** 用户选择 `9.0-beta`  
**那么** 用户数据存取 SHALL 使用现有 `_v9_beta` localStorage keys  
**并且** save archive IndexedDB SHALL 使用现有 `x4_save_archive_db_v9_beta`

**前提** 用户选择 `9.0` 正式版  
**那么** 用户数据存取 SHALL 使用 `_v9` localStorage keys  
**并且** save archive IndexedDB SHALL 使用 `x4_save_archive_db_v9`

### Requirement: Default User Version

用户默认版本 SHALL 指向正式版 `9.0`。

#### Scenario: First visit uses 9.0 stable as effective default

**前提** 用户本地不存在 `x4_game_version`  
**当** `useGameDataStore` 初始化  
**那么** 当前用户版本 SHALL 为 `version = "9.0"`  
**并且** `beta = false`

### Requirement: Version Display Suffixes

版本展示 SHALL 只在 beta 用户版本上显示 beta/rc/mini 后缀。

#### Scenario: Stable 9.0 displays without prerelease suffix

**前提** 当前用户版本为 `version = "9.0"` 且 `beta = false`  
**当** StationToolbar 显示当前版本  
**那么** 文本 SHALL 显示为 `9.0`  
**并且** SHALL NOT 显示 `rc`、`beta` 或 `mini_version` 后缀

#### Scenario: Beta 9.0 may display prerelease suffix

**前提** 当前用户版本为 `version = "9.0"` 且 `beta = true`  
**当** 版本选择 UI 显示该选项  
**那么** 文本 MAY 使用 `beta_type` 与 `mini_version` 区分该 beta 用户版本

### Requirement: Store Initialization Order

依赖版本感知 storage key 的 store SHALL 在其显式 `init()` 方法中等待 `gameDataStore.initialize()` 完成后再加载本地数据。Store 创建时 SHALL NOT 执行任何 localStorage 读写。

#### Scenario: BuildPlan store loads after gameData is ready

**前提** `useBuildPlanStore` 有 `init()` 方法  
**当** `init()` 被调用  
**那么** SHALL 先等待 `gameData.isReady`  
**并且** SHALL 然后调用 `loadPlansFromStorage()` 使用版本感知的 storage key

#### Scenario: ShipBuild store does not load at creation

**前提** `useShipBuildStore` 被实例化  
**那么** SHALL NOT 在 store 创建时调用 `loadBlueprintsFromStorage()`  
**并且** SHALL 仅在 `initialize()` 中加载

### Requirement: Version Selection Beta Toggle

版本选择弹窗 SHALL 提供「显示 beta 版本」开关。

#### Scenario: Beta checkbox defaults based on current version

**前提** 打开版本选择弹窗  
**当** 当前版本不是 beta  
**那么** checkbox SHALL 默认不勾选  
**并且** 列表 SHALL 只显示稳定版

**前提** 打开版本选择弹窗  
**当** 当前版本是 beta  
**那么** checkbox SHALL 默认勾选  
**并且** 列表 SHALL 显示全部版本

#### Scenario: Unchecking beta toggles hides beta options

**前提** checkbox 勾选且当前选中为 beta 版本  
**当** 用户取消勾选  
**那么** beta 版本 SHALL 从列表中移除  
**并且** 选中 SHALL 自动切到第一个稳定版
