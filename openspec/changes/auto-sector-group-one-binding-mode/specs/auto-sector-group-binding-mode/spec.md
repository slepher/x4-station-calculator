# Auto Sector Group Binding Mode Specification

## Purpose

定义 auto-sector-group binding 面板的三态模式、生成设置 card、retain/pin/unpin 生成输入语义，以及重置与生成后的模式切换行为。

## ADDED Requirements

### Requirement: Three Mode Auto Sector Group Panel

系统 SHALL 在 auto-sector-group binding 面板中提供 `[预览 | 编辑 | 生成]` 三态模式，用于区分查看结果、编辑草案结构和准备生成输入。

#### Scenario: Preview mode displays current draft

- **前提** 用户进入 auto-sector-group binding 面板
- **当** 当前模式为 `预览`
- **那么** 系统 SHALL 展示当前 shared draft/result
- **并且** SHALL NOT 显示生成模式专属的 retain checkbox
- **并且** SHALL NOT 显示生成设置 card

#### Scenario: Mode switch replaces hub edit action

- **前提** 用户进入 auto-sector-group binding 面板
- **当** hub stat bar 渲染
- **那么** 系统 SHALL 在原单独 `[编辑]` 按钮位置显示 `[预览 | 编辑 | 生成]` 三态按钮
- **并且** 页面顶部操作区 SHALL NOT 显示三态模式切换

#### Scenario: Edit mode edits current draft structure

- **前提** 用户进入 auto-sector-group binding 面板
- **当** 当前模式为 `编辑`
- **那么** 系统 SHALL 允许用户编辑当前 shared draft 的结构
- **并且** SHALL NOT 显示生成模式专属的 retain checkbox
- **并且** SHALL NOT 显示生成设置 card
- **并且** SHALL NOT 显示单独 `[退出]` 按钮

#### Scenario: Generate mode edits generation input on draft

- **前提** 用户进入 auto-sector-group binding 面板
- **当** 当前模式为 `生成`
- **那么** 系统 SHALL 显示生成设置 card
- **并且** 用户对 pin/unpin、retain、jumpRange 和全局生成参数的操作 SHALL 作用于当前 shared draft 或当前生成提交 overlay

#### Scenario: Leaving generate mode clears ignore overlay

- **前提** 当前处于 `生成` 模式
- **并且** “忽略当前节点”overlay 已激活
- **当** 用户切换到 `预览` 或 `编辑`
- **那么** 系统 SHALL 清除该 overlay
- **并且** SHALL 按 hub 自身 pin/unpin 状态显示 hub card

### Requirement: Generate Settings Card

系统 SHALL 将生成参数与生成动作集中在 `生成` 模式专属的生成设置 card 中。

#### Scenario: Generate card shows global generation parameters

- **前提** 当前模式为 `生成`
- **当** 生成设置 card 渲染
- **那么** 第一行 SHALL 显示连接跳数、节点开关、覆盖跳数和交易站阈值
- **并且** 这些控件 SHALL 用于下一次 `[生成方案]`
- **并且** 生成设置 card SHALL 位于 hub stat bar 下方

#### Scenario: Generate card shows retain aggregation

- **前提** 当前模式为 `生成`
- **当** 生成设置 card 渲染
- **那么** 第二行左侧 SHALL 显示保留连接、保留覆盖和保留交易站三个 retain checkbox
- **并且** 三个 checkbox SHALL 聚合当前 hub card 的对应 retain 状态
- **并且** 聚合态 SHALL 支持 checked、unchecked 与 mixed
- **并且** 用户操作聚合 checkbox SHALL 批量同步到 hub card 对应 retain 状态

#### Scenario: Generate card shows generate actions

- **前提** 当前模式为 `生成`
- **当** 生成设置 card 渲染
- **那么** 第二行右侧 SHALL 显示“忽略当前节点”图标按钮和 `[生成方案]` 按钮
- **并且** `[生成方案]` SHALL 替代原外显 `[计算]` / `[快速计算]` 入口

#### Scenario: Map compact generate actions align

- **前提** 当前模式为 `生成`
- **并且** 面板处于 Map/tabs 布局
- **当** 生成设置 card 渲染
- **那么** “忽略当前节点”图标按钮和 `[生成方案]` 按钮 SHALL 使用一致高度

#### Scenario: Generate succeeds and returns to preview

- **前提** 当前模式为 `生成`
- **当** 用户点击 `[生成方案]` 且生成成功
- **那么** 系统 SHALL 用生成结果更新当前 shared draft/result
- **并且** SHALL 切换到 `预览` 模式
- **并且** SHALL 清除“忽略当前节点”overlay
- **并且** SHALL NOT 自动保存到 binding

#### Scenario: Generate blocked keeps generate mode

- **前提** 当前模式为 `生成`
- **当** 用户点击 `[生成方案]` 但生成失败或被 gate 阻止
- **那么** 系统 SHALL 保持在 `生成` 模式
- **并且** SHALL 保留用户当前可修正的生成参数状态

### Requirement: Ignore Current Nodes Overlay

系统 SHALL 在 `生成` 模式中提供“忽略当前节点”overlay，用于本次生成提交空 base input，且不得覆写 hub 自身 pin/unpin 状态。

#### Scenario: Ignore overlay only affects generate mode

- **前提** 用户处于 `生成` 模式
- **当** 用户点击“忽略当前节点”图标按钮
- **那么** 系统 SHALL 激活 overlay
- **并且** 所有 hub card 在 `生成` 模式中 SHALL 显示为 unpin
- **并且** hub 自身 pin/unpin 状态 SHALL NOT 被覆写

#### Scenario: Ignore overlay submits empty base

- **前提** 当前处于 `生成` 模式
- **并且** “忽略当前节点”overlay 已激活
- **当** 用户点击 `[生成方案]`
- **那么** 系统 SHALL 提交空 base input
- **并且** SHALL NOT 使用当前 hub 作为固定基础

#### Scenario: Ignore overlay disables per card pin controls

- **前提** 当前处于 `生成` 模式
- **并且** “忽略当前节点”overlay 已激活
- **当** hub card 渲染
- **那么** 单个 hub 的 pin/unpin 控件 SHALL 禁用
- **并且** retain checkbox SHALL 按 unpin 状态的既有禁用规则禁用

#### Scenario: Ignore overlay is transient

- **前提** “忽略当前节点”overlay 已激活
- **当** 用户切出 `生成` 模式或生成成功
- **那么** 系统 SHALL 清除 overlay
- **并且** SHALL NOT 持久化 overlay 状态

### Requirement: Generate Mode Retain and Hub Inputs

系统 SHALL 只在 `生成` 模式显示 retain checkbox，并使用半透明展示说明不携带的输入数据。

#### Scenario: Retain checkboxes exist only in generate mode

- **前提** auto-sector-group binding 面板渲染
- **当** 当前模式不是 `生成`
- **那么** 系统 SHALL NOT 显示生成 retain checkbox
- **当** 当前模式为 `生成`
- **那么** 系统 SHALL 显示生成设置 card retain 聚合 checkbox
- **并且** hub card SHALL 显示局部 retain checkbox

#### Scenario: Unpinned hub disables retain

- **前提** 当前模式为 `生成`
- **并且** 某 hub 处于 unpin 状态
- **当** hub card 渲染
- **那么** 该 card 的 retain checkbox SHALL 禁用

#### Scenario: Unchecked retain dims corresponding data

- **前提** 当前模式为 `生成`
- **当** 某 hub 的覆盖 retain unchecked
- **那么** 该 hub 的范围星区 SHALL 半透明显示
- **当** 某 hub 的交易站 retain unchecked
- **那么** 该 hub 的空间站/交易站 SHALL 半透明显示

#### Scenario: Link retain uses both sides

- **前提** 当前模式为 `生成`
- **当** 系统判断两个 hub 之间的连接是否作为生成输入携带
- **那么** SHALL 同时考虑连接双方的 retain 和 pin/unpin 状态
- **并且** 双方 retain 均允许携带时连接正常显示并可提交
- **并且** 双方 unchecked 时连接不携带并半透明
- **并且** 一方 unchecked 且另一方 unpin 时连接不携带并半透明

### Requirement: Generate Mode Jump Range and Live Refresh

系统 SHALL 在 `生成` 模式允许编辑 hub jumpRange，并实时保持 hub 范围数据一致，但不得自动吸收 assignment。

#### Scenario: Jump range updates coverage display

- **前提** 当前模式为 `生成`
- **当** 用户修改某 hub card 的 jumpRange
- **那么** 系统 SHALL 实时更新该 hub 的范围星区
- **并且** SHALL 保持当前 shared draft 数据一致

#### Scenario: Jump range does not auto absorb assignments

- **前提** 当前模式为 `生成`
- **当** 用户修改某 hub card 的 jumpRange
- **那么** 系统 SHALL NOT 默认吸收新进入范围的 assignment
- **并且** SHALL NOT 自动改变 assignment 选择

#### Scenario: Assignment and trade station columns refresh

- **前提** 当前模式为 `生成`
- **当** 用户修改 pin/unpin、retain 或 jumpRange
- **那么** Assignment 与 Trade Station 列 MAY 实时刷新以反映当前 draft 状态

### Requirement: Reset Restores Saved Binding Baseline

系统 SHALL 保留 `[重置]` 作为页面操作，用于恢复已保存 binding 初始数据口径。

#### Scenario: Reset restores saved binding

- **前提** 当前 shared draft 存在未保存修改
- **当** 用户点击 `[重置]`
- **那么** 系统 SHALL 丢弃当前未保存修改
- **并且** SHALL 恢复到当前 active binding 的已保存初始数据口径

#### Scenario: Bridge created hub defaults unpinned

- **前提** bridge 流程产生新的 hub
- **当** 系统创建该 hub
- **那么** 该 hub 默认 SHALL 为 unpin
- **并且** 该默认值 SHALL 是通用 bridge hub 默认行为，不只属于 `[重置]` 流程

### Requirement: Page Operation Bar Layout

系统 SHALL 在页面顶部操作区只显示当前布局有效的页面级动作。

#### Scenario: Legacy back action is removed

- **前提** auto-sector-group binding 面板渲染
- **当** 页面顶部操作区渲染
- **那么** 系统 SHALL NOT 显示历史遗留 `[返回]` 按钮

#### Scenario: Map action is hidden in map layout

- **前提** auto-sector-group binding 面板处于 Map/tabs 布局
- **当** 页面顶部操作区渲染
- **那么** 系统 SHALL NOT 显示 `[地图]` 按钮

#### Scenario: Map action remains in live columns layout

- **前提** auto-sector-group binding 面板处于 live columns 布局
- **当** 页面顶部操作区渲染
- **那么** 系统 MAY 显示 `[地图]` 按钮作为进入地图视图的入口
