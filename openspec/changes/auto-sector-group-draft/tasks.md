# Binding 模式共享草案 — 任务列表

## 1. liveStore 扩展

- [ ] 导入 `AutoGroupResult` 类型
- [ ] 新增 `autoGroupResult`、`calculationMode`、`autoGroupConfirmed`
- [ ] 新增 `prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold`
- [ ] 导出所有 6 个状态
- [ ] 明确 6 个状态为当前 active binding/archive 的唯一 draft 状态

## 2. SaveBindingPlan 扩展

- [ ] 新增 `appliedAutoGroupArchiveTime?: number` 字段
- [ ] `normalizeState()` 保留该字段

## 3. Presenter 改造

- [ ] 删除 6 个本地 ref 声明
- [ ] 改为从 `liveStore` 读取
- [ ] handler 内统一通过 `liveStore.xxx` 属性读写共享状态，组件 ref 由 presenter 使用 `storeToRefs(liveStore)` 转出
- [ ] `runAutoGroup` 改为时间比对：当前 archive time 与 `binding.appliedAutoGroupArchiveTime` 一致且已有 `liveStore.autoGroupResult` 时不重算
- [ ] archive time 更新时，`runAutoGroup` 重新执行 `groupCleanSlate` 或 `groupIncremental`
- [ ] `handleColorChange` 移除 `saveBindingStore.updateGroup()` 调用
- [ ] `handleConfirm` 记录 `appliedAutoGroupArchiveTime`
- [ ] activeBinding 或 selected archive 切换时，用新上下文重新初始化唯一 draft，避免沿用上一上下文未提交草案
- [ ] `onMounted` 调用 `runAutoGroup()`，内部时间比对决定是否重算

## 4. MapWorkbenchView 读取草案

- [ ] `sectorGroupColorMap` 优先从 `liveStore.autoGroupResult` 计算
- [ ] 非 binding 模式或 autoGroupResult 为 null 时回退到 `saveBindingStore.activeBinding`

## 5. 面板组件适配

- [ ] SectorOverviewPanel 确认从 presenter 拿到的 ref 是 liveStore 的
- [ ] AutoSectorGroupMapPanel 确认同

## 6. 构建验证

- [ ] `npm run build` 通过
