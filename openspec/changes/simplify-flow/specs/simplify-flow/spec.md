# Simplify Flow Storage Specification

## Purpose
定义 logic-flow 方案节点持久化结构的精简规则，并将 flow 存储版本从 `v2` 升级到 `v3`，以减少存储体积并保持迁移与重建一致性。

## MODIFIED Requirements

### Requirement: Plan Data Structure
系统 SHALL 使用极简节点结构保存 logic-flow 手动与隔离节点。

#### Scenario: Saved node uses minimal union shape
**前提** 用户保存 logic-flow 方案

**当** 系统序列化单个已保存节点

**那么** 节点 SHALL 仅包含 `isolated` 或 `module` 其中之一

**并且** 系统 SHALL 不再持久化 `id/race/lineage/column/isRoot/order/source` 等运行态字段

#### Scenario: Save isolated node
**前提** 节点处于隔离状态

**当** 系统保存方案

**那么** 节点 SHALL 保存为 `{ isolated: <wareId> }`

#### Scenario: Save production node
**前提** 节点非隔离且存在 `moduleId`

**当** 系统保存方案

**那么** 节点 SHALL 保存为 `{ module: <moduleId> }`

### Requirement: Plan Reconstruction
系统 SHALL 在加载时从极简节点结构重建运行态节点。

#### Scenario: Rebuild isolated node from ware id
**前提** 已保存节点结构为 `{ isolated: <wareId> }`

**当** 用户加载方案

**那么** 系统 SHALL 恢复隔离手动节点

**并且** 其他运行态字段 SHALL 在加载阶段按规则补齐

#### Scenario: Rebuild manual node from module id
**前提** 已保存节点结构为 `{ module: <moduleId> }`

**当** 用户加载方案

**那么** 系统 SHALL 由模块映射推导目标产物并恢复手动节点

**并且** 系统 SHALL 对该手动节点继续执行上游 auto 重建

### Requirement: Logic Flow Storage Version Is Dynamically Migrated To V3
系统 MUST 将 Logic Flow 导入/加载数据动态迁移到 `v3`。

#### Scenario: Migrate v2 flow data
**前提** 导入或本地存量的 `x4_logic_flow_plans.version` 为 `2`

**当** 系统执行 flow migration

**那么** 系统 SHALL 将旧节点结构转换为 `v3` 极简结构

**并且** 转换失败节点 SHALL 被跳过并记录 warning

#### Scenario: Export flow data in v3
**前提** 用户执行导出

**当** 系统生成 flow 导出 payload

**那么** 导出的 `x4_logic_flow_plans.version` SHALL 为 `3`

### Requirement: Empire Import From Logic Flow Supports Minimal Nodes
系统 SHALL 在 empire 导入 flow 场景下兼容 `SavedFlowNode` 极简结构。

#### Scenario: Build empire import targets from minimal nodes
**前提** 方案节点为 `{ isolated }` / `{ module }` 结构

**当** 用户执行导入到 empire

**那么** 系统 SHALL 基于 `{ module }` 节点生成目标站点模块汇总

**并且** 系统 SHALL 基于 `{ isolated }` 节点生成锁定货物集合

#### Scenario: Skip empty group in empire import
**前提** 某组仅包含不可导入节点或无 `{ module }` 节点

**当** 系统构建 empire 导入目标

**那么** 该组 SHALL 被跳过并生成 warning
