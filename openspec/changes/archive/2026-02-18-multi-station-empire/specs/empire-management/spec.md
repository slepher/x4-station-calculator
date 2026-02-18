# Empire Management Specification

## Purpose
描述帝国管理能力，包括多站数据结构、V1→V2 数据迁移、分站 CRUD 操作。

## Requirements

### Requirement: 帝国数据结构 (Empire Data Structure)
系统 SHALL 使用 V2 数据结构存储帝国方案：
- **version**: 固定为 2，用于数据迁移判断
- **activeEmpireId**: 当前激活的帝国 ID
- **activeStationId**: 当前激活的分站 ID，null 表示选中帝国总览
- **empires**: 帝国方案数组，每个包含 id、name 和 stations

#### Scenario: 初始化帝国数据
- **前提** localStorage 中无数据
- **当** 系统初始化时
- **那么** 系统 SHALL 创建默认的空帝国方案
- **并且** activeStationId SHALL 为 null

### Requirement: V1 到 V2 数据迁移 (V1 to V2 Migration)
系统 SHALL 自动检测并迁移 V1 数据格式：
- 检测 localStorage 中 `version` 字段
- V1 数据自动包装为包含单个工业站的 V2 帝国方案
- 迁移后删除旧的 `x4_station_data` 键

#### Scenario: V1 数据迁移
- **前提** localStorage 中存在 `x4_station_data` 且 version 为 1
- **当** 系统初始化时
- **那么** 系统 SHALL 将 V1 数据迁移为 V2 格式
- **并且** 原有的方案列表 SHALL 成为新帝国的分站列表
- **并且** 每个分站 type SHALL 设为 'industrial'

### Requirement: 分站类型定义 (Station Type Definition)
系统 SHALL 支持以下分站类型：
- **industrial**: 工业站，运行完整的 calculateAutoFill 逻辑
- **supply**: 补给站，仅生成补给模块
- **transit**: 中转站（预留类型）
- **shipyard**: 船厂（预留类型）

#### Scenario: 创建工业站
- **前提** 用户点击标签栏 [+] 按钮
- **当** 系统创建新分站时
- **那么** 分站 type SHALL 设为 'industrial'
- **并且** 分站 SHALL 运行完整的 calculateAutoFill 逻辑

### Requirement: 分站 CRUD 操作 (Station CRUD Operations)
系统 SHALL 提供分站的创建、读取、更新、删除操作：
- **创建**: 通过标签栏 [+] 按钮或帝国总览菜单
- **读取**: 通过标签栏切换查看
- **更新**: 通过分站视图编辑
- **删除**: 通过分站菜单删除选项

#### Scenario: 创建新分站
- **前提** 用户在帝国总览或标签栏
- **当** 用户点击新建分站按钮
- **那么** 系统 SHALL 创建新的分站对象
- **并且** 新分站 SHALL 自动激活

#### Scenario: 删除分站
- **前提** 用户在分站菜单中
- **当** 用户点击删除分站选项
- **那么** 系统 SHALL 从帝国中移除该分站
- **并且** 如果删除的是当前激活分站，activeStationId SHALL 切换到 null

### Requirement: 补给站计算逻辑 (Supply Station Calculation)
补给站 SHALL 根据帝国所有工业站的工人需求总和生成补给模块：
- 不运行 calculateAutoFill 的工业区逻辑
- 仅生成补给模块（医疗、食品等）
- 补给模块数量 = 帝国总工人需求 / 模块容量

#### Scenario: 补给站自动生成补给模块
- **前提** 帝国中存在工业站且有工人需求
- **当** 用户创建或查看补给站时
- **那么** 系统 SHALL 计算帝国所有工业站的总工人需求
- **并且** 根据总需求生成对应的补给模块

### Requirement: 站内补给开关 (Internal Supply Toggle)
工业站的 `settings.internalSupply` 字段 SHALL 控制 calculateAutoFill 是否生成补给区：
- **true**: 工业站运行 calculateAutoFill 时生成补给区
- **false**: 工业站不生成补给区，补给从外部输入

#### Scenario: 站内补给开关关闭
- **前提** 工业站的 internalSupply 为 false
- **当** calculateAutoFill 运行时
- **那么** 系统 SHALL 不生成补给区模块
- **并且** 工人补给需求 SHALL 显示为外部输入

### Requirement: 工人运算统一控制 (Unified Workforce Calculation)
`settings.considerWorkforceForAutoFill` 字段 SHALL 统一控制所有工人运算：
- **工业区**: 工业模块的工人需求和效率加成
- **补给区**: 补给模块的工人需求和效率加成

#### Scenario: 工人运算开启
- **前提** considerWorkforceForAutoFill 为 true
- **当** calculateAutoFill 运行时
- **那么** 工业区模块 SHALL 计算工人需求
- **并且** 补给区模块 SHALL 计算工人需求
- **并且** 所有模块 SHALL 获得效率加成

#### Scenario: 工人运算关闭
- **前提** considerWorkforceForAutoFill 为 false
- **当** calculateAutoFill 运行时
- **那么** 工业区模块 SHALL 不计算工人需求
- **并且** 补给区模块 SHALL 不计算工人需求
- **并且** 所有模块 SHALL 按基础产能计算

## ADDED Requirements

### Requirement: activeStationId 持久化策略 (activeStationId Persistence Strategy)
系统 SHALL 使用双层存储策略持久化当前选中的空间站：
- **sessionStorage**: 实时跟踪当前 `activeStationId`，切换 tab 时立即更新
- **localStorage**: 保存时的 `activeStationId`，仅在用户点击保存时更新

#### Scenario: 切换 tab 后刷新页面
- **前提** 用户切换到某个空间站 tab
- **当** 用户刷新页面
- **那么** 系统 SHALL 从 sessionStorage 恢复 activeStationId
- **并且** 用户 SHALL 看到之前选中的空间站

#### Scenario: 切换 tab 后不保存，刷新页面
- **前提** 用户切换到某个空间站 tab
- **当** 用户不保存，直接刷新页面
- **那么** 系统 SHALL 从 sessionStorage 恢复 activeStationId
- **并且** 用户 SHALL 看到之前选中的空间站

#### Scenario: 关闭浏览器后重新打开
- **前提** 用户关闭浏览器
- **当** 用户重新打开应用
- **那么** sessionStorage SHALL 为空
- **并且** 系统 SHALL 从 localStorage 恢复 activeStationId
- **并且** 用户 SHALL 看到上次保存时的空间站

#### Scenario: 载入不同帝国
- **前提** 用户在载入界面选择不同的帝国
- **当** 系统载入新帝国
- **那么** 系统 SHALL 清除 sessionStorage
- **并且** 系统 SHALL 使用新帝国的第一个空间站

### Requirement: 恢复优先级 (Restore Priority)
系统 SHALL 按以下优先级恢复 activeStationId：
1. sessionStorage 中的值（刷新场景）
2. localStorage 中的值（关闭浏览器后重新打开）
3. 第一个空间站（兜底）

#### Scenario: sessionStorage 中的空间站不存在
- **前提** sessionStorage 中有 activeStationId
- **当** 该空间站在当前帝国中不存在
- **那么** 系统 SHALL 回退到 localStorage 中的值
- **并且** 如果 localStorage 中的值也不存在，使用第一个空间站

### Requirement: ContextToolbar UI 统一化 (ContextToolbar UI Unification)
系统 SHALL 统一 ContextToolbar 中的输入控件样式，并清理 StationPlanningPanel 中的冗余控件。

#### Scenario: 光照输入框使用 X4NumberInput
- **前提** 用户选中任意分站
- **当** ContextToolbar 渲染光照输入框
- **那么** 系统 SHALL 使用 X4NumberInput 组件
- **并且** 样式 SHALL 与 StationPlanningPanel 中的 X4NumberInput 一致

#### Scenario: 数量输入框使用 X4NumberInput
- **前提** 用户选中任意分站
- **当** ContextToolbar 渲染数量输入框
- **那么** 系统 SHALL 使用 X4NumberInput 组件
- **并且** 不显示前缀 "x"

#### Scenario: 种族下拉框样式统一
- **前提** 用户选中任意分站
- **当** ContextToolbar 渲染种族偏好下拉框
- **那么** 系统 SHALL 使用统一的下拉框样式

#### Scenario: StationPlanningPanel 无标题行
- **前提** 用户查看 StationPlanningPanel
- **当** 面板渲染
- **那么** 系统 SHALL 不显示模块列表标题行
- **并且** 系统 SHALL 不显示分割线
- **并且** 面板 SHALL 直接从搜索框开始

#### Scenario: 自动工业区无冗余控件
- **前提** 自动工业区有模块
- **当** 面板渲染自动工业区标题
- **那么** 系统 SHALL 只显示标题文字
- **并且** 系统 SHALL 不显示工人计算 checkbox
- **并且** 系统 SHALL 不显示种族偏好下拉框
