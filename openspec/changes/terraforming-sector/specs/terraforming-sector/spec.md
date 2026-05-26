# Terraforming Sector Display Specification

## ADDED Requirements

### Requirement: Sector Panel List/Item Dual Mode

Sector panel SHALL support two display modes — list mode for browsing all sectors and item mode for viewing a selected sector's details.

#### Scenario: List mode — sector list display

**前提** 用户进入地球化页面

**当** SectorPanel 处于 list 模式

**那么** 所有可地球化星区以列表形式展示
**并且** 已选中的星区保持高亮（`.active` class）
**并且** TaskList 和 ResourcePanel 始终显示（未选中时显示占位空状态）
**并且** 星区条目不再支持手风琴展开（点击行为改为切换到 item 模式）

#### Scenario: Item mode — select sector

**前提** 用户在 list 模式下

**当** 点击某个星区条目

**那么** SectorPanel 切换到 item 模式
**并且** 标题栏显示星区名称
**并且** 标题栏左侧显示返回按钮（更换船只 SVG icon）
**并且** 显示选中星区的 Objectives 列表
**并且** 显示 Stats（复用 TerraformingStatScale，单列 grid-cols-1）
**并且** 显示 Rebates 列表

#### Scenario: Back from item to list

**前提** 用户在 item 模式下

**当** 点击标题栏左侧的返回按钮

**那么** SectorPanel 切换到 list 模式
**并且** selectedClusterId 保持不变（选中星区在 list 中高亮）
**并且** TaskList 和 ResourcePanel 保持当前内容不变

#### Scenario: Switch sector in item mode

**前提** 用户在 list 模式下，星区 A 已选中高亮

**当** 点击星区 B

**那么** SectorPanel 切换到 item 模式显示星区 B
**并且** TaskList 和 ResourcePanel 更新为星区 B 的内容

#### Scenario: Default selected sector

**前提** 页面加载时已有默认选中的星区（selectedClusterId 不为空）

**那么** SectorPanel 直接进入 item 模式显示该星区
**并且** TaskList 和 ResourcePanel 显示对应内容

### Requirement: Stats and Rebates in Sector Panel

Stats and rebates display SHALL be in SectorPanel's item mode, positioned after Objectives.

#### Scenario: Stats display in item mode

**前提** 用户在 item 模式下，选中星区有 stat 数据

**那么** Objectives 下方显示 Stats 区域（复用 TerraformingStatScale，compact/centered，单列）

#### Scenario: Rebates display in item mode

**前提** 用户在 item 模式下，选中星区有 active rebates

**那么** Stats 下方显示 Rebates 区域

#### Scenario: No global stats card in TaskList

**前提** 已完成改造

**那么** TerraformingTaskList.vue 中不再渲染全局 stats-card 区域

### Requirement: Three-Column Layout Persistence

The three-column layout SHALL persist regardless of display mode.

#### Scenario: Panels always visible

**前提** 在 terraforming view 任意状态下

**那么** 三栏（SectorPanel | TaskList | ResourcePanel）始终以 `lg:col-span-3 | 5 | 4` 布局呈现

## MODIFIED Requirements

### Requirement: TerraformingSectorPanel Props Extension

Sector panel SHALL accept stat/rebate display props.

#### Scenario: Extended props

**那么** 接收 `statScaleModels`, `currentStats`, `statDisplayNames`, `activeRebates`

### Requirement: Back Button Preserves Selection

The back button in item mode SHALL return to list mode without clearing selectedClusterId.

#### Scenario: Back preserves selection

**前提** 用户在 item 模式下查看星区 A

**当** 点击返回按钮

**那么** SectorPanel 切换到 list 模式，星区 A 保持高亮

## REMOVED Requirements

### Requirement: Sector Accordion Expansion

**理由**: 手风琴展开模式被 list/item 双模式替代。

### Requirement: Panel Visibility Toggle

**理由**: 改为三栏始终显示，通过内容（占位/数据）区分有无选中星区。
