## Why

当前 Logic Flow 模块的操作规范分散在多个需求文档中，且存在术语混淆问题（"节点隔离"与"规划组锁定"均使用 `isLocked`）。需要统一整理操作规范，明确术语定义，并重命名属性以消除歧义。同时，部分已实现的功能可能因后续修改遭到破坏，需要验证并修复。

## What Changes

- **术语统一**：将节点隔离状态从 `isLocked` 重命名为 `isIsolated`，彻底区分"节点隔离"与"规划组锁定"
- **拖拽状态规范**：明确 6 种停靠区状态及其优先级
- **候选区操作规范**：T0 资源和能量电池禁止拖拽和快速添加
- **节点权限矩阵**：明确删除/隔离/转正按钮的显示条件和行为
- **级联删除逻辑**：删除纯 Manual 节点时级联清理孤儿上游模块和隔离产品
- **T0 资源限制**：禁止所有手动操作（删除、隔离、转正）
- **i18n 键值统一**：`Isolate`/`Connect` 替代 `Lock`/`Unlock`

## Capabilities

### New Capabilities
- `logic-flow-operation`: 统一的操作规范，涵盖拖拽状态、候选区操作、节点权限、T0 资源限制等

### Modified Capabilities
- `lineage-isolation`: 节点隔离属性从 `isLocked` 重命名为 `isIsolated`
- `drag-feedback`: 拖拽状态标签从 `Locked`/`Unlock` 改为 `Isolate`/`Connect`

## Impact

- `useLogicFlowStore.ts`: 属性重命名、方法重命名、状态判断逻辑
- `LogicFlowPlanningZone.vue`: 拖拽状态判断和标签显示
- `LogicFlowCandidateZone.vue`: T0 资源和能量电池的快速添加按钮隐藏
- `ProductionLineGroup.vue`: 节点按钮权限矩阵实现
- `types/x4.ts`: `FlowNode` 接口属性重命名
- `i18n`: 新增/修改 `logicFlow.isolate`、`logicFlow.connect` 键值
