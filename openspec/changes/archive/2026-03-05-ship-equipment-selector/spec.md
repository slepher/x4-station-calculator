# Ship Equipment Selector Specification

## Purpose

定义 ship build 配装交互在 `ShipBuildPanelFit` 内聚后的行为，包括单候选语义、展开态布局稳定性、过滤展示与计数一致性。

## ADDED Requirements

### Requirement: 组件职责与状态归属

#### Scenario: PanelFit 内聚

**前提** 用户进入 ship build 并打开配装面板

**那么** 配装交互由 `ShipBuildPanelFit` 直接承载

**并且** `fitMode` 在 `ShipBuildPanelFit` 内部维护

**并且** `ShipBuildView` 不再透传 `mode/connectionRows/groupRows/selectedByConnection`

#### Scenario: 赋值调用链

**前提** 用户在配装区执行槽位点击或确认操作

**那么** `ShipBuildPanelFit` 直接调用 store 的 `applyConnectionAssignment`

---

### Requirement: 单候选点击语义

#### Scenario: 通用装备/清空

**前提** 当前槽位候选数量等于 1

**当** 槽位当前未装备

**那么** 点击后装备唯一候选

**并且** 在满数量状态下再次点击可清空

#### Scenario: 简化模式补满

**前提** 当前模式为 `group`，候选数量等于 1，且已装备该唯一候选但数量未满

**当** 用户点击该槽位

**那么** 槽位数量补齐到 `totalCount`

---

### Requirement: 展开态布局稳定性

#### Scenario: 三行两列结构

**前提** picker 已展开

**那么** 第一行模式/操作按钮，第二行槽位签/分页，第三行过滤槽位/候选

**并且** 第一二行高度固定 `25.6px`

#### Scenario: 第一列宽度防抖

**前提** picker 已展开

**那么** 三行布局第一列使用固定公式 `minmax(0, calc(50% - 4rem))`

**并且** 不使用 JS 存储展开前宽度

#### Scenario: Race 标签两行展示

**前提** picker 已展开且 `raceTags.length > 3`

**那么** RACE 标签区以两行布局显示

---

### Requirement: 模式切换与冲突策略

#### Scenario: 简化模式可切换

**前提** 用户点击 `简化` 按钮

**那么** 不应被冲突守卫阻断

#### Scenario: 关闭行为

**前提** picker 关闭

**那么** 不执行强制回退到 `connection`

---

### Requirement: 槽位计数正确性

#### Scenario: 标准模式清空计数

**前提** 标准模式下某槽位此前为 `1/1`

**当** 用户清空该槽位

**那么** 槽位计数显示为 `0/1`

#### Scenario: 简化模式聚合计数

**前提** 简化模式下聚合同类槽位

**那么** 槽位计数显示聚合后的 `count/totalCount`

---

### Requirement: 槽位数量拖动条与数量提交语义

#### Scenario: 槽位上方拖动条布局

**前提** 配装槽位可见

**那么** 每个槽位上方显示数量拖动条

**并且** 拖动条宽度与槽位按钮宽度一致

#### Scenario: 二阶段更新

**前提** 用户在槽位拖动条上拖动数量

**当** 用户尚未松开拖动

**那么** 仅更新界面数量显示，不写蓝图

**并且** 用户松开后一次性写回蓝图数量

#### Scenario: 简化模式步进

**前提** 当前模式为 `group`

**那么** 拖动条步进值等于当前聚合目标的 `totalCount`

#### Scenario: 数量为 0 的蓝图与计算

**前提** 用户将槽位数量提交为 `0`

**那么** 蓝图保留装备 ID，不因数量为 0 自动删除装备

**并且** `stat` 与 `material` 计算不计入该 `count=0` 装备
