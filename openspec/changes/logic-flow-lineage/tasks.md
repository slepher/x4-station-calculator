## 1. 基础架构与 Store 重构 (useLogicFlowStore)

- [ ] 1.1 更新 `PlanningGroup` 接口，增加 `isLocked` (boolean) 和 `lockedLineage` (string) 字段
- [ ] 1.2 更新 `FlowNode` 接口，增加 `lineage` (string) 和 `isAuto` (boolean) 字段
- [ ] 1.3 修改 `addNodeToGroup` 逻辑，使用 `moduleId` 作为唯一 Key，支持物理隔离
- [ ] 1.4 重构 `findModuleForWare` 回溯逻辑，支持基于父节点 `lineage` 的递归导航
- [ ] 1.5 实现 T0 资源的强制合并逻辑（忽略血统）
- [ ] 1.6 实现锁定状态下的“强行同化”与“直接拦截”检查逻辑

## 2. i18n 与术语重构

- [ ] 2.1 更新 `zh-CN.json` 和 `en-US.json`，增加 `isolate`, `connect`, `locked`, `unlocked` 等术语
- [ ] 2.2 将原有的 `lock/unlock` 翻译重定向为 `isolate/connect`

## 3. UI 组件开发 (iOS 风格滑块)

- [ ] 3.1 创建 `IosToggle.vue` 通用滑块组件
- [ ] 3.2 在 `LogicFlowCandidateZone.vue` 中集成全局锁定滑块
- [ ] 3.3 在 `LogicFlowPlanningZone.vue` 的 Header 中集成组级别锁定滑块
- [ ] 3.4 实现滑块的禁用逻辑（当手动模块血统冲突时）

## 4. 节点交互与增强 (LogicFlowNode)

- [ ] 4.1 更新 `LogicFlowNode.vue` 按钮，增加转正 (➕) 图标
- [ ] 4.2 实现 Auto 节点转正的 Click 处理函数
- [ ] 4.3 替换原有的“锁定/解锁”图标为“隔离/连接”图标
- [ ] 4.4 优化连线样式，区分 Auto（虚线）与 Manual/Isolated（实线）

## 5. 快速添加菜单增强

- [ ] 5.1 修改 `LogicFlowCandidateZone.vue` 中的菜单渲染逻辑，显示组状态后缀
- [ ] 5.2 实现菜单项的置灰与交互拦截逻辑（当 `Locked` 或 `Duplicated` 时）
