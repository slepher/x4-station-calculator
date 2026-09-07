# Fix compact module names

## Why
本轮 M5.2 真实拖放复现同 ware 不同模块在 compact view 中显示首节点名称，违反已接受的 moduleId 物理隔离与拖放模块名称要求。

## What Changes
将紧凑节点名称组装归入 presenter，并使用节点自身 moduleId。增加 focused Unit，以已有 M5.2 E2E 复验。

## Capabilities
### Modified Capabilities
- `logical-flow-planner`: 修复现有模块身份显示要求，无新增功能。

## Impact
仅 LogicFlowPlanningZone、对应 presenter 和 focused Unit；不修改领域状态或持久化结构。
