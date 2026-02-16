## 1. 基础架构与 Store 重构 (useLogicFlowStore)

- [ ] 1.1 更新 `PlanningGroup` 接口，增加 `isLocked` (boolean) 和 `lockedLineage` (string) 字段
- [ ] 1.2 更新 `FlowNode` 接口，增加 `lineage` (string) 和 `isAuto` (boolean) 字段
- [ ] 1.3 修改 `addNodeToGroup` 逻辑，使用 `moduleId` 作为唯一 Key，支持物理隔离
- [ ] 1.4 重构 `findModuleForWare` 回溯逻辑，支持基于父节点 `lineage` 的递归导航
- [ ] 1.5 实现 T0 资源的强制合并逻辑（忽略血统，禁止转正）
- [ ] 1.6 实现锁定状态下的“强行同化”与“直接拦截”检查逻辑
- [ ] 1.7 实现“隔离前提”检查函数：判断节点是否有下游消费者
- [ ] 1.8 强化 `cleanupAutoNodes` 逻辑：失去所有消费者的节点（含隔离节点）必须被彻底删除

## 2. i18n 与术语重构

- [ ] 2.1 更新 `zh-CN.json` 和 `en-US.json`，增加 `isolate`, `connect`, `status.locked`, `status.unlocked` 等术语
- [ ] 2.2 将原有的 `lock/unlock` 翻译重定向为 `isolate/connect`

## 3. UI 组件开发 (iOS 风格滑块与候选区)

- [ ] 3.1 在 `LogicFlowCandidateZone.vue` 中使用 Tailwind 实现 iOS 风格滑动开关 (Default Lock)
- [ ] 3.2 在 `ProductionLineGroup.vue` 的 Header 中实现 iOS 风格滑动开关 (Group Lock)
- [ ] 3.3 实现滑块的禁用逻辑（当手动模块血统冲突时）
- [ ] 3.4 候选区限制：针对 **T0 资源及能量电池** 移除 `+` 快速添加按钮和弹出菜单

## 4. 节点交互与增强 (FlowNode.vue)

- [ ] 4.1 调整按钮布局：左侧显示 ✂️/🔗 (隔离/连接)，右侧显示 ➕ (转正)
- [ ] 4.2 按钮权限：T0 资源节点禁止显示 ➕ (转正) 按钮
- [ ] 4.3 隔离权限：仅当节点有下游消费者时才显示 ✂️/🔗 按钮
- [ ] 4.4 实现 Auto 节点转正的 Click 处理函数
- [ ] 4.5 优化连线样式，区分 Auto（虚线）与 Manual/Isolated（实线）

## 5. 快速添加菜单增强

- [ ] 5.1 修改 `LogicFlowCandidateZone.vue` 中的菜单渲染逻辑，显示组状态后缀
- [ ] 5.2 实现菜单项的置灰与交互拦截逻辑（当 `Locked` 或 `Duplicated` 时）
