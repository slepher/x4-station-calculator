# Abandon Selected Ship Specification

## Purpose
将 ship-build 的当前飞船上下文收敛到 blueprint 单一来源，消除 `selectedShipId` 与 `blueprint.shipId` 双轨同步导致的状态分裂，并确保新建后飞船本体材料持续可见。

## ADDED Requirements

### Requirement: Blueprint Single Source Context
ship-build 实现 MUST 使用当前 blueprint 作为当前飞船上下文的单一来源。

#### Scenario: Workspace always has resolvable ship context
**前提** 进入 ship-build workspace
**并且** 当前存在可编辑蓝图
**当** 任意面板读取当前飞船上下文
**那么** 读取来源 MUST 为当前 blueprint 的 `shipId`
**并且** 兼容期允许读取 `selectedShipId`，但行为结果 MUST 与 `blueprint.shipId` 一致

#### Scenario: New action keeps ship context
**前提** 当前已选飞船并处于 ship-build workspace
**当** 用户执行 `New|新建`
**那么** 系统 MUST 重置配装内容为该飞船的空蓝图
**并且** 当前蓝图 `shipId` 保持不变

### Requirement: Panel Context Consistency
Stats、Materials、Selector、Toolbar 对当前飞船判定 MUST 保持一致。

#### Scenario: Materials keeps hull contribution after new
**前提** 当前飞船存在船体建造材料定义
**当** 用户执行 `New|新建`
**那么** Materials 面板 MUST 继续显示船体材料分组
**并且** 装备/存储分项显示为重置后的结果

#### Scenario: Cross-panel ship identity is identical
**前提** 用户在 ship-build 页面浏览 Stats 与 Materials
**当** 页面完成渲染
**那么** Stats 与 Materials 解析的飞船标识 MUST 一致
**并且** 不出现一个面板有船、另一个面板无船的状态

### Requirement: Save Semantics Under Non-null Blueprint
在 blueprint 非空模型下，保存语义 MUST 保持可解释与稳定。

#### Scenario: Actions are unreachable when ship is not selected
**前提** 当前 ship-build 上下文未选择 ship
**当** 用户尝试触发 `New|新建`、`Save|保存`、`Save As|另存为`、`Load|载入`
**那么** 系统 MUST 保持入口不可达（按钮禁用或流程拦截）
**并且** 不进入保存/重置/载入执行分支

#### Scenario: Dirty detection after reset blueprint
**前提** 当前蓝图已被修改并进入 dirty 状态
**当** 用户执行 `New|新建` 并完成重置
**那么** 系统 SHOULD 将当前状态视为“新草稿基线”
**并且** 脏状态判定行为与保存策略一致

#### Scenario: Save and Save As remain available by policy
**前提** 当前飞船上下文存在
**当** 用户触发 `Save|保存` 或 `Save As|另存为`
**那么** 系统 MUST 按现有策略执行保存入口判定
**并且** 不因 `blueprint` 非空模型引入不可达分支
