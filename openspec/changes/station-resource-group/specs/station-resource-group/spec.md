# station-resource-group Specification

## Purpose

为资源高级筛选器提供从星区空间站或逻辑组网存档载入资源组配置的功能，简化用户配置流程。

## ADDED Requirements

### Requirement: Resource Group Loader Component

资源高级筛选器顶部新增载入组件，允许用户从星区或逻辑组网载入资源组配置。

#### Scenario: Display loader button

**前提** 用户打开资源高级筛选器面板
**当** 面板渲染完成
**那么** 在"新增组"按钮右侧显示载入按钮
**并且** 按钮显示当前状态（"自定义"或载入项名称）
**并且** 按钮右侧显示下拉箭头图标

#### Scenario: Open loader menu

**前提** 用户点击载入按钮
**当** 下拉菜单打开
**那么** 菜单在面板外部显示（fixed 定位，面板右侧 + 8px）
**并且** 显示"星区"分组标题
**并且** 显示"逻辑组网"分组标题
**并且** 显示各分组下可载入项列表

#### Scenario: Load sector stations as groups

**前提** 用户在下拉菜单中点击某个星区
**当** 执行载入操作
**那么** 清空当前所有组
**并且** 为该星区下每个有资源需求的空间站创建一个资源组
**并且** 每个组的资源标签为该空间站消耗的资源
**并且** 自动刷新候选

#### Scenario: Load logic flow plan as groups

**前提** 用户在下拉菜单中点击某个逻辑组网存档
**当** 执行载入操作
**那么** 清空当前所有组
**并且** 为该存档中每个有 tier0 资源的组创建一个资源组
**并且** 每个组的资源标签为该组展开后的 tier0 资源（不包括能量电池）
**并且** 自动刷新候选

#### Scenario: Filter empty items

**前提** 组件需要显示载入列表或创建组
**当** 计算载入数据
**那么** 星区分组：过滤掉没有资源需求的空间站和星区
**并且** 逻辑组网分组：过滤掉没有 tier0 资源的组和存档

#### Scenario: Close menu on outside click

**前提** 下拉菜单已打开
**当** 用户点击菜单外部区域
**那么** 菜单关闭

### Requirement: Data Source Integration

载入组件从现有数据源获取星区、空间站和逻辑组网存档信息。

#### Scenario: Get sector list

**前提** 组件需要显示星区列表
**当** 计算载入列表
**那么** 从 `useEmpireStore().sectors` 获取星区列表

#### Scenario: Get station resources

**前提** 用户选择某个星区
**当** 需要创建资源组
**那么** 获取该星区下所有空间站
**并且** 对每个空间站调用 `stationStateMap.getGroupedFlows(station.id).rateGroups.resources`
**并且** 提取每个 resource 的 `wareId` 作为组资源标签

#### Scenario: Get logic flow plan list

**前提** 组件需要显示逻辑组网存档列表
**当** 计算载入列表
**那么** 从 `useLogicFlowStore().savedPlans.list` 获取存档列表

#### Scenario: Get tier0 resources for group

**前提** 用户选择某个逻辑组网存档
**当** 需要创建资源组
**那么** 遍历存档中每个 SavedFlowGroup
**并且** 收集 isolated 节点的 wareId 用于跳过展开
**并且** 对每个 module 节点获取输出 wareId
**并且** 递归展开获取 tier0 资源（跳过 isolated 节点的展开路径）
**并且** 排除 energycells

### Requirement: Refresh Button Layout

刷新按钮与 pending 提示共享父元素，无待刷新时隐藏。

#### Scenario: Show refresh row when pending

**前提** 筛选条件已变更
**当** 需要显示刷新提示
**那么** 显示 `.advanced-refresh-row` 容器
**并且** 左侧显示 pending 提示文本
**并且** 右侧显示刷新按钮

#### Scenario: Hide refresh row when not pending

**前提** 筛选条件未变更或已刷新
**当** 不需要刷新
**那么** 隐藏整个 `.advanced-refresh-row` 容器