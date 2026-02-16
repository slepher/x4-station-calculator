## 1. 属性重命名

- [x] 1.1 将 `FlowNode` 接口中的 `isLocked` 重命名为 `isIsolated`
- [x] 1.2 将 `toggleNodeLock()` 方法重命名为 `toggleNodeIsolate()`
- [x] 1.3 将 `convertToLockedAuto()` 方法重命名为 `convertToIsolatedAuto()`
- [x] 1.4 将 `unlockAndExpand()` 方法重命名为 `connectAndExpand()`
- [x] 1.5 更新所有 `node.isLocked` 引用为 `node.isIsolated`

## 2. 拖拽状态逻辑

- [x] 2.1 验证 `getWareGroupStatus()` 返回正确的状态优先级
- [x] 2.2 验证 `Isolate` 状态标签在 Header 和 Grid 中的正确切换
- [x] 2.3 验证 `Connect` 状态投放后触发上游扩展
- [x] 2.4 验证血统锁定组的 `Rejected` 状态判断

## 3. 候选区操作

- [x] 3.1 验证 T0 资源禁止拖拽
- [x] 3.2 验证能量电池禁止拖拽
- [x] 3.3 隐藏 T0 资源的快速添加按钮
- [x] 3.4 隐藏能量电池的快速添加按钮
- [x] 3.5 验证隔离节点不计入已规划状态判断

## 4. 节点权限矩阵

- [x] 4.1 验证纯 Manual 节点仅显示删除按钮
- [x] 4.2 验证纯 Auto 节点显示隔离和转正按钮
- [x] 4.3 验证混合型节点显示删除和隔离按钮
- [x] 4.4 验证隔离节点仅显示连接按钮
- [x] 4.5 验证 T0 资源节点不显示任何操作按钮

## 5. 级联删除逻辑

- [x] 5.1 实现纯 Manual 节点删除时的级联清理
- [x] 5.2 实现孤儿上游模块的删除
- [x] 5.3 实现孤儿上游隔离产品的删除
- [x] 5.4 验证混合型节点删除时降级为 Auto

## 6. i18n 键值

- [x] 6.1 添加 `logicFlow.isolate` 翻译键
- [x] 6.2 添加 `logicFlow.connect` 翻译键
- [x] 6.3 验证现有 `logicFlow.auto` 和 `logicFlow.manual` 键值

## 7. 快速添加菜单

- [x] 7.1 验证菜单项 `Duplicate` 状态显示
- [x] 7.2 验证菜单项 `Isolate` 状态显示
- [x] 7.3 验证菜单项 `Auto` 状态显示
- [x] 7.4 验证菜单项 `Rejected` 状态显示
- [x] 7.5 验证选择后菜单自动关闭
