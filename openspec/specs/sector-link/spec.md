# Sector Link Specification

## Purpose
定义星区管理（星区/空间站/连接）与星区物流纯函数能力的行为边界。

## ADDED Requirements

### Requirement: Sector Header Creation UX
系统 MUST 在星区管理头部提供单行创建入口，并支持重名自动编号。

#### Scenario: 新建星区单行入口
- **前提** 用户位于星区管理面板
- **当** 面板渲染
- **那么** 系统 SHALL 显示 标题 + 输入框 + `+` 按钮于同一行

#### Scenario: 星区重名自动编号
- **前提** 已存在名称为 `N` 的星区
- **当** 用户再次创建名称为 `N`
- **那么** 系统 SHALL 使用 `N 2` 作为新名称
- **并且** 若 `N 2` 已存在，系统 SHALL 递增为 `N 3`...

#### Scenario: 星区创建后输入不清空
- **前提** 用户在星区输入框输入名称
- **当** 用户点击 `+` 创建
- **那么** 输入框 SHALL 保留原输入内容

### Requirement: Unassigned Station Creation UX
系统 MUST 在未分配区提供单行创建入口，并支持重名自动编号与不跳页创建。

#### Scenario: 未分配区单行入口
- **前提** 用户位于未分配区
- **当** 区域渲染
- **那么** 系统 SHALL 显示 标题 + 输入框 + `+` 按钮于同一行

#### Scenario: 未分配站点重名自动编号
- **前提** 已存在名称为 `S` 的空间站
- **当** 用户再次创建名称为 `S`
- **那么** 系统 SHALL 使用 `S 2` 作为新名称

#### Scenario: 未分配创建不切换当前空间站
- **前提** 当前存在已选中的空间站
- **当** 用户在未分配区创建新空间站
- **那么** 系统 SHALL 不自动切换到新建空间站页面

#### Scenario: 未分配创建后输入不清空
- **前提** 用户在未分配输入框输入名称
- **当** 用户点击 `+` 创建
- **那么** 输入框 SHALL 保留原输入内容

### Requirement: Unassigned Station Deletion Guard
系统 MUST 为未分配空间站删除提供模块感知策略。

#### Scenario: 无模块直接删除
- **前提** 未分配空间站 `A` 的模块数为 0
- **当** 用户点击删除按钮
- **那么** 系统 SHALL 直接删除 `A`

#### Scenario: 有模块需确认删除
- **前提** 未分配空间站 `B` 存在模块
- **当** 用户点击删除按钮
- **那么** 系统 SHALL 弹出确认框
- **并且** 仅在确认后删除 `B`

### Requirement: Sector Station Quick Unassign
系统 MUST 支持在星区内一键将空间站移回未分配。

#### Scenario: 星区内空间站移回未分配
- **前提** 空间站 `S` 当前属于某星区
- **当** 用户点击 `S` 的 `x` 按钮
- **那么** 系统 SHALL 将 `S` 的 `sectorId` 置空

### Requirement: Drag-State Visibility Rules
系统 MUST 按拖拽类型隐藏对应区块。

#### Scenario: 拖拽空间站
- **前提** 用户正在拖拽空间站
- **当** 星区卡片渲染
- **那么** 系统 SHALL 隐藏连接区

#### Scenario: 拖拽星区连接
- **前提** 用户正在拖拽星区连接
- **当** 星区卡片渲染
- **那么** 系统 SHALL 隐藏空间站区

#### Scenario: 拖拽星区排序
- **前提** 用户正在拖拽星区排序
- **当** 星区卡片渲染
- **那么** 系统 SHALL 同时隐藏空间站区和连接区

### Requirement: Link Feedback Policy
系统 MUST 不显示“连接已创建”提示。

#### Scenario: 建链成功不提示
- **前提** 建链成功
- **当** drop 完成
- **那么** 系统 SHALL 不显示“连接已创建”反馈文本

### Requirement: Station Tab Empty Sector Filtering
系统 MUST 在 StationTab 中隐藏空星区及其分割线。

#### Scenario: 空星区隐藏
- **前提** 星区 `E` 无任何空间站
- **当** Tab 渲染
- **那么** 系统 SHALL 不显示 `E` 的 tab
- **并且** SHALL 不显示 `E` 对应分割线

### Requirement: Empire Empty Predicate
系统 MUST 在空间站和星区都为空时才判定 Empire 为空。

#### Scenario: 仅有星区不为空
- **前提** Empire 有星区但无空间站
- **当** 调用 `isEmptyForSave`
- **那么** 系统 SHALL 返回 false

#### Scenario: 仅有空间站不为空
- **前提** Empire 有空间站但无星区
- **当** 调用 `isEmptyForSave`
- **那么** 系统 SHALL 返回 false

#### Scenario: 星区与空间站都为空
- **前提** Empire 无星区且无空间站
- **当** 调用 `isEmptyForSave`
- **那么** 系统 SHALL 返回 true

### Requirement: Sector Logistics Pure Functions
系统 MUST 提供 sector 口径的单货物与多货物物流纯函数，并返回缺口与满足量摘要。

#### Scenario: 单货物输出连接级流向与缺口摘要
- **前提** 输入单货物 `sectors + links`
- **当** 执行 `solveSingleWareDistancePull`
- **那么** 系统 SHALL 输出 `linkFlows`
- **并且** SHALL 输出 `allocatedDemandBySector` 与 `deficitSummary`

#### Scenario: 多货物输出按sector汇总
- **前提** 输入多货物 `netByWare`
- **当** 执行 `solveMultiWareByLink`
- **那么** 系统 SHALL 输出 `linkWareFlows`
- **并且** SHALL 输出按 `sector` 汇总的 `allocatedDemandBySector` 与 `deficitSummary`

#### Scenario: 非连通网络先分网
- **前提** 输入网络存在多个非连通子网
- **当** 执行求解
- **那么** 系统 SHALL 先切分连通分量
- **并且** 缺口来源映射 SHALL 仅在同子网内统计
