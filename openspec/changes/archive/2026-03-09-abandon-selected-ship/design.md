# Design: abandon-selected-ship

## Context
当前 ship-build 同时维护 `selectedShipId` 与 `blueprint.shipId`。该双轨模型在 `New` 清空 blueprint 时会出现上下文断裂：部分面板依赖 blueprint，部分面板依赖 selectedShipId，导致行为不一致。

## Goals
1. 当前飞船上下文统一为 blueprint 单一来源。
2. 新建后保留当前飞船上下文，避免材料面板丢失船体信息。
3. 收敛跨面板取数口径，减少条件分支与同步代码。

## Non-Goals
1. 不改 empire/logic-flow 架构。
2. 不改 ship blueprint 持久化的 ship 归属字段（`blueprint.shipId` 保留）。
3. 本阶段不实现测试代码，只定义任务与验证目标。

## Architecture Decisions

### 1) Blueprint Non-null in Workspace
- 在 ship-build workspace 中，blueprint 作为主上下文对象，保持非空。
- `New` 不再置 `blueprint = null`，改为重置为同 ship 的空蓝图。

### 2) Single Context Read Path
- 组件层读取当前飞船时统一走 `blueprint.shipId`。
- 兼容期内允许保留 `selectedShipId` 字段与读取路径，本轮不要求全量替换。
- 兼容读取不得依赖 `selectedShipId` 的可空语义触发业务分支；行为结果必须与 `blueprint.shipId` 一致。

### 3) Unified Action Semantics
- `setSelectedShipId` 语义收敛为“设置当前蓝图对应飞船”。
- `clearLoadoutForCurrentShip` 语义收敛为“重置当前蓝图内容，不丢失 shipId”。
- `isDirty/isEmptyForSave/requiresSaveAsOnSave` 基于非空 blueprint 模型重新校准。
- `New/Save/Save As/Load` 在未选择 ship 时保持不可达（沿用现有入口门禁）。

## Data Model Impact

### Runtime
- 推荐形态：
  - `currentBlueprint: ShipBlueprint`（workspace 非空）
  - `viewMode` 控制 selector/workspace
- 若保留 `selectedShipId` 过渡字段：
  - 优先保持与 `currentBlueprint.shipId` 一致
  - 不允许新逻辑直接依赖其可空语义
  - 未选 ship 门禁可继续通过该字段实现（按钮禁用/流程拦截）

### Persistence
- 保持 `ShipBlueprint.shipId` 持久化字段。
- migration 仅需保证历史数据进入“可构建非空 blueprint 工作态”的前置条件。

## Flow Changes

### New Flow (ship-build)
1. 判断是否 dirty；若 dirty 走 SmartSaveDialog。
2. 执行重置：保留 `shipId`，清空 connections/storage/hull 覆盖状态。
3. 建立新基线快照，保证脏状态可解释。

### Select Ship Flow
1. 用户确认目标 ship。
2. 创建该 ship 的空 blueprint 或加载其活动 blueprint。
3. workspace 各面板以该 blueprint 统一渲染。

## Risk & Mitigation
1. 风险：历史逻辑把 `blueprint=null` 当作“未开始”信号。
- 缓解：将“未开始”语义迁移到 `isEmptyForSave()` 与可见性判断，不再依赖 null。

2. 风险：测试断言大量依赖旧模型。
- 缓解：先补规划任务，后分批调整 unit/e2e 断言。

3. 风险：导入/载入路径仍有 `selectedShipId` 分支。
- 缓解：统一入口函数，内部先解析 blueprint，再派生 UI 状态。

## Validation Plan
1. Store 层：新建后 blueprint 非空且 shipId 不变。
2. UI 层：新建后 Materials 仍显示 ship hull 分组。
3. 一致性：Stats/Materials/Selector 的 ship identity 一致。
4. 持久化：保存、载入与迁移在非空 blueprint 模型下稳定运行。
5. 门禁：未选 ship 时 `New/Save/Save As/Load` 不可达；已选 ship 时按既有策略工作。
