# Auto Sector Group Binding Mode Specification

## Purpose

定义 auto-sector-group binding 面板的三态模式、模式说明 bar、重算设置 card、retain/pin/unpin 重算输入语义，以及重置与重算后的模式切换行为。

## ADDED Requirements

### Requirement: Three Mode Auto Sector Group Panel

系统 SHALL 在 auto-sector-group binding 面板中提供 `[查看 | 编辑 | 重算]` 三态模式，用于区分查看当前方案、编辑草案结构和准备重算输入。内部状态名仍为 `preview | edit | generate`。

#### Scenario: View mode displays current draft

- **前提** 用户进入 auto-sector-group binding 面板
- **当** 当前模式为 `查看`
- **那么** 系统 SHALL 展示当前 shared draft/result
- **并且** SHALL NOT 显示重算模式专属的 retain checkbox
- **并且** SHALL NOT 显示重算设置 card
- **并且** `SectorGroupStatBar` SHALL 显示短说明“分配选择会实时联动其他星区”
- **并且** 说明 tooltip SHALL 包含查看模式右侧 assignment 联动语义和固定 / 取消固定说明

#### Scenario: Map view preview tooltip avoids right-side wording

- **前提** 用户处于地图模式的 `查看` 模式
- **当** 系统显示 `SectorGroupStatBar` 说明 tooltip
- **那么** tooltip SHALL 使用地图模式专用说明
- **并且** SHALL NOT 使用“右侧分配列表”描述 assignment 位置
- **并且** SHALL 说明用户可切换到分配页签处理 assignment

#### Scenario: Mode switch is in page operation bar

- **前提** 用户进入 auto-sector-group binding 面板
- **当** 页面顶部操作区渲染
- **那么** 系统 SHALL 在 `[确定]` / `[重置]` 同一 bar 的左侧显示 `[查看 | 编辑 | 重算]` 三态按钮
- **并且** hub stat bar SHALL NOT 显示三态模式切换

#### Scenario: Edit mode edits current draft structure

- **前提** 用户进入 auto-sector-group binding 面板
- **当** 当前模式为 `编辑`
- **那么** 系统 SHALL 允许用户编辑当前 shared draft 的结构
- **并且** SHALL NOT 显示重算模式专属的 retain checkbox
- **并且** SHALL NOT 显示重算设置 card
- **并且** SHALL NOT 显示单独 `[退出]` 按钮
- **并且** `SectorGroupStatBar` SHALL 显示短说明“结构调整不自动改动其他分配”
- **并且** 说明 tooltip SHALL 包含编辑模式结构调整语义和固定 / 取消固定说明

#### Scenario: Recalculate mode edits recalculation input on draft

- **前提** 用户进入 auto-sector-group binding 面板
- **当** 当前模式为 `重算`
- **那么** 系统 SHALL 显示重算设置 card
- **并且** 用户对 pin/unpin、retain、jumpRange 和全局重算参数的操作 SHALL 作用于当前 shared draft 或当前重算提交 overlay
- **并且** `SectorGroupStatBar` SHALL 显示短说明“设置计算输入，重新计算后再确定保存”
- **并且** 说明 tooltip SHALL 逐项说明连接跳数、节点、覆盖跳数、交易站阈值、保留连接、保留覆盖、保留交易站、忽略当前节点
- **并且** 说明 tooltip SHALL 包含固定 / 取消固定说明，并明确 unpin hub 不作为本次重算输入且不会直接提交保存

#### Scenario: Leaving recalculate mode clears ignore overlay

- **前提** 当前处于 `重算` 模式
- **并且** “忽略当前节点”overlay 已激活
- **当** 用户切换到 `查看` 或 `编辑`
- **那么** 系统 SHALL 清除该 overlay
- **并且** SHALL 按 hub 自身 pin/unpin 状态显示 hub card

### Requirement: Recalculate Settings Card

系统 SHALL 将重算参数与重算动作集中在 `重算` 模式专属的重算设置 card 中。

#### Scenario: Recalculate card shows global parameters

- **前提** 当前模式为 `重算`
- **当** 重算设置 card 渲染
- **那么** 第一行 SHALL 显示连接跳数、节点开关、覆盖跳数和交易站阈值
- **并且** 这些控件 SHALL 用于下一次 `[重新计算]`
- **并且** 重算设置 card SHALL 位于 `SectorGroupStatBar` 下方

#### Scenario: Recalculate card shows retain aggregation

- **前提** 当前模式为 `重算`
- **当** 重算设置 card 渲染
- **那么** 第二行左侧 SHALL 显示保留连接、保留覆盖和保留交易站三个 retain checkbox
- **并且** 三个 checkbox SHALL 聚合当前 hub card 的对应 retain 状态
- **并且** 聚合态 SHALL 支持 checked、unchecked 与 mixed
- **并且** 用户操作聚合 checkbox SHALL 批量同步到 hub card 对应 retain 状态

#### Scenario: Recalculate card shows recalculation actions

- **前提** 当前模式为 `重算`
- **当** 重算设置 card 渲染
- **那么** 第二行右侧 SHALL 显示“忽略当前节点”图标按钮和 `[重新计算]` 按钮
- **并且** `[重新计算]` SHALL 替代原外显 `[计算]` / `[快速计算]` / `[生成方案]` 入口

#### Scenario: Map compact recalculation actions align

- **前提** 当前模式为 `重算`
- **并且** 面板处于 Map/tabs 布局
- **当** 重算设置 card 渲染
- **那么** “忽略当前节点”图标按钮和 `[重新计算]` 按钮 SHALL 使用一致高度

#### Scenario: Recalculate succeeds and returns to view

- **前提** 当前模式为 `重算`
- **当** 用户点击 `[重新计算]` 且重算成功
- **那么** 系统 SHALL 用重算结果更新当前 shared draft/result
- **并且** SHALL 切换到 `查看` 模式
- **并且** SHALL 清除“忽略当前节点”overlay
- **并且** SHALL NOT 自动保存到 binding

#### Scenario: Recalculate blocked keeps recalculate mode

- **前提** 当前模式为 `重算`
- **当** 用户点击 `[重新计算]` 但重算失败或被 gate 阻止
- **那么** 系统 SHALL 保持在 `重算` 模式
- **并且** SHALL 保留用户当前可修正的重算参数状态

### Requirement: Ignore Current Nodes Overlay

系统 SHALL 在 `重算` 模式中提供“忽略当前节点”overlay，用于本次重算提交空 base input，且不得覆写 hub 自身 pin/unpin 状态。

#### Scenario: Ignore overlay only affects recalculate mode

- **前提** 用户处于 `重算` 模式
- **当** 用户点击“忽略当前节点”图标按钮
- **那么** 系统 SHALL 激活 overlay
- **并且** 所有 hub card 在 `重算` 模式中 SHALL 显示为 unpin
- **并且** hub 自身 pin/unpin 状态 SHALL NOT 被覆写

#### Scenario: Ignore overlay submits empty base

- **前提** 当前处于 `重算` 模式
- **并且** “忽略当前节点”overlay 已激活
- **当** 用户点击 `[重新计算]`
- **那么** 系统 SHALL 提交空 base input
- **并且** SHALL NOT 使用当前 hub 作为固定基础

#### Scenario: Ignore overlay disables per card pin controls

- **前提** 当前处于 `重算` 模式
- **并且** “忽略当前节点”overlay 已激活
- **当** hub card 渲染
- **那么** 单个 hub 的 pin/unpin 控件 SHALL 禁用
- **并且** retain checkbox SHALL 按 unpin 状态的既有禁用规则禁用

#### Scenario: Ignore overlay is transient

- **前提** “忽略当前节点”overlay 已激活
- **当** 用户切出 `重算` 模式或重算成功
- **那么** 系统 SHALL 清除 overlay
- **并且** SHALL NOT 持久化 overlay 状态

### Requirement: Recalculate Mode Retain and Hub Inputs

系统 SHALL 只在 `重算` 模式显示 retain checkbox，并使用半透明展示说明不携带的输入数据。

#### Scenario: Retain checkboxes exist only in recalculate mode

- **前提** auto-sector-group binding 面板渲染
- **当** 当前模式不是 `重算`
- **那么** 系统 SHALL NOT 显示重算 retain checkbox
- **当** 当前模式为 `重算`
- **那么** 系统 SHALL 显示重算设置 card retain 聚合 checkbox
- **并且** hub card SHALL 显示局部 retain checkbox

#### Scenario: Unpinned hub disables retain

- **前提** 当前模式为 `重算`
- **并且** 某 hub 处于 unpin 状态
- **当** hub card 渲染
- **那么** 该 card 的 retain checkbox SHALL 禁用

#### Scenario: Unchecked retain dims corresponding data

- **前提** 当前模式为 `重算`
- **当** 某 hub 的覆盖 retain unchecked
- **那么** 该 hub 的范围星区 SHALL 半透明显示
- **当** 某 hub 的交易站 retain unchecked
- **那么** 该 hub 的空间站/交易站 SHALL 半透明显示

#### Scenario: Link retain uses both sides

- **前提** 当前模式为 `重算`
- **当** 系统判断两个 hub 之间的连接是否作为重算输入携带
- **那么** SHALL 同时考虑连接双方的 retain 和 pin/unpin 状态
- **并且** 双方 retain 均允许携带时连接正常显示并可提交
- **并且** 双方 unchecked 时连接不携带并半透明
- **并且** 一方 unchecked 且另一方 unpin 时连接不携带并半透明

### Requirement: Recalculate Mode Jump Range and Live Refresh

系统 SHALL 在 `重算` 模式允许编辑 hub jumpRange，并实时保持 hub 范围数据一致，但不得自动吸收 assignment。

#### Scenario: Jump range updates coverage display

- **前提** 当前模式为 `重算`
- **当** 用户修改某 hub card 的 jumpRange
- **那么** 系统 SHALL 实时更新该 hub 的范围星区
- **并且** SHALL 保持当前 shared draft 数据一致

#### Scenario: Jump range does not auto absorb assignments

- **前提** 当前模式为 `重算`
- **当** 用户修改某 hub card 的 jumpRange
- **那么** 系统 SHALL NOT 默认吸收新进入范围的 assignment
- **并且** SHALL NOT 自动改变 assignment 选择

#### Scenario: Assignment and trade station columns refresh

- **前提** 当前模式为 `重算`
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
