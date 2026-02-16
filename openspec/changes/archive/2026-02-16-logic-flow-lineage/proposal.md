## Why

当前逻辑组网（Logic Flow）在处理跨种族体系（如 Teladi vs 通用）时存在严重的“产线污染”问题。由于缺乏体系隔离，不同种族的同类产物（如船体部件）的上游会互相覆盖或混乱合并，导致用户难以规划纯净的种族生产线。

## What Changes

- **物理模块隔离**: 改用 `moduleId` 作为节点主键，利用物理模块的唯一性实现不同体系产线的天然隔离。
- **血统导向回溯**: 引入 `lineage` (血统) 元数据，引导上游产线自动继承父节点的种族偏好。
- **体系锁定机制**: 引入“锁定”功能（iOS 风格滑块），强制规划组遵循特定体系，禁止跨体系污染。
- **交互增强**: 支持 Auto 节点的快速“转正” (Promotion)，重构节点操作按钮，并增强快速添加菜单的状态感知。
- **i18n 重构**: 将原 FlowNode 上的 Lock/Unlock 重命名为 **Isolate/Connect (隔离/连接)**，将“锁定”术语留给规划组体系约束。

## Capabilities

### New Capabilities
- `lineage-isolation`: 实现基于 `moduleId` 和 `lineage` 的产线物理隔离与递归回溯逻辑。
- `system-locking`: 实现候选区与规划组的 iOS 风格锁定滑块及体系准入检查。

### Modified Capabilities
- `logical-flow-planner`: 修改节点操作逻辑，支持 Isolate/Connect 切换及 Auto 节点转正。

## Impact

- `useLogicFlowStore.ts`: 核心存储逻辑重构，涉及节点主键判定、回溯递归及锁定状态管理。
- `LogicFlowPlanningZone.vue`: 增加锁定滑块，增强拖拽拦截反馈与菜单状态显示。
- `LogicFlowCandidateZone.vue`: 增加全局锁定开关，Payload 增加血统信息。
- `LogicFlowNode.vue`: 按钮图标与操作逻辑更新，视觉样式区分。
