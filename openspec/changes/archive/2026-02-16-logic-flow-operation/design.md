## Context

Logic Flow 模块已实现拖拽、节点管理、隔离/连接等核心功能，但存在以下问题：
1. **术语混淆**：节点隔离（`node.isLocked`）与规划组锁定（`group.isLocked`）使用相同属性名
2. **规范分散**：操作规范分散在多个需求文档中，缺乏统一参考
3. **潜在破坏**：部分功能可能因后续修改遭到破坏，需要验证

## Goals / Non-Goals

**Goals:**
- 统一属性命名：`node.isLocked` → `node.isIsolated`
- 统一方法命名：`toggleNodeLock` → `toggleNodeIsolate`，`unlockAndExpand` → `connectAndExpand`
- 验证并修复拖拽状态判断逻辑
- 验证并修复节点权限矩阵
- 验证并修复 T0 资源限制

**Non-Goals:**
- 不新增功能，仅整理规范和修复破坏
- 不修改规划组锁定（`group.isLocked`）相关逻辑
- 不修改 UI 布局或视觉样式

## Decisions

### 1. 属性重命名策略

**决策**：全局搜索替换 `node.isLocked` → `node.isIsolated`

**理由**：
- 彻底消除术语歧义
- 代码可读性提升
- 避免未来维护混淆

**替代方案**：保留 `isLocked` 但添加注释 → 拒绝，治标不治本

### 2. 方法重命名

| 原方法名 | 新方法名 | 说明 |
|----------|----------|------|
| `toggleNodeLock()` | `toggleNodeIsolate()` | 切换节点隔离状态 |
| `convertToLockedAuto()` | `convertToIsolatedAuto()` | 将节点转为隔离状态 |
| `unlockAndExpand()` | `connectAndExpand()` | 连接节点并扩展上游 |

### 3. 拖拽状态判断优先级

```
1. Group Locked + 血统不匹配 → Rejected
2. Duplicated → 禁止投放
3. Isolate → 可连接投放
4. Auto → 可转正投放
5. Group Locked + 血统匹配 → 正常投放
6. Normal → 正常投放
```

### 4. 节点权限矩阵实现位置

**决策**：权限判断逻辑集中在 `useLogicFlowStore` 中，组件通过 getter 获取

**理由**：
- 单一数据源
- 便于测试
- 组件逻辑简化

### 5. T0 资源判断

**决策**：通过 `ware.tier === 0` 判断，能量电池特殊处理

```typescript
const isT0Ware = (wareId: string) => {
  const ware = gameData.waresMap[wareId]
  return ware?.tier === 0
}
```

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 重命名导致遗漏引用 | 全局搜索 `isLocked` 并逐个确认上下文 |
| 级联删除逻辑破坏 | 编写单元测试覆盖边界情况 |
| i18n 键值缺失 | 检查并补充缺失的翻译键 |
