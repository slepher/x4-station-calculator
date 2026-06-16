# Binding 模式共享草案 — 任务列表

## 1. liveStore 扩展

- [x] 导入 `AutoGroupResult` 类型
- [x] 新增 `autoGroupResult`、`calculationMode`、`autoGroupConfirmed`
- [x] 新增 `prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold`
- [x] 导出所有 6 个状态
- [x] 明确 6 个状态为当前 active binding/archive 的唯一 draft 状态

## 2. SaveBindingPlan 扩展

- [x] 新增 `appliedAutoGroupArchiveTime?: number` 字段
- [x] `normalizeState()` 保留该字段

## 3. Presenter 改造

- [x] 删除 6 个本地 ref 声明
- [x] 改为从 `liveStore` 读取
- [x] handler 内统一通过 `liveStore.xxx` 属性读写共享状态，组件 ref 由 presenter 使用 `storeToRefs(liveStore)` 转出
- [x] `runAutoGroup` 始终执行计算（移除时间跳过）；每次强制 `autoGroupConfirmed = false`
- [x] `triggerAutoGroup` 加载 binding 数据，`autoGroupConfirmed = false`
- [x] `handleColorChange` 移除 `updateGroup()` 调用
- [x] `handleConfirm` 记录 `appliedAutoGroupArchiveTime`；不覆盖 `autoGroupResult`
- [x] `onMounted`、`watch(activeBinding)`、`watch(selectedArchive)` 不再调用 `runAutoGroup()`
- [x] 新增 `needsAutoGroupRecalc` computed，计算按钮红点
- [x] `!autoGroupResult` 时编辑按钮置灰

## 4. MapWorkbenchView 读取草案

- [x] `sectorGroupColorMap` 从 `liveStore.autoGroupResult` 计算（未确认时）或 `activeBinding`（已确认时）
- [x] 非 binding 模式回退到 `saveBindingStore.activeBinding`

## 5. 面板组件适配

- [x] SectorOverviewPanel 从 presenter 拿到的 ref 是 liveStore 的
- [x] AutoSectorGroupMapPanel → AutoSectorGroupPanel 重命名
- [x] 新增 `layout?: 'tabs' | 'columns'` prop；columns 始终三列
- [x] Map 模式 `gameGuid` watcher 调用 `triggerAutoGroup()`

## 6. Live 面板模式切换

- [x] `liveMode: 'display' | 'calculate'`
- [x] 展示模式：`[存档3 | 星区4 | 资源5]`，列表从 `activeBinding` 读取
- [x] 计算模式：嵌入 `AutoSectorGroupPanel layout="columns"`
- [x] 展示模式「编辑」→ 计算模式（保留 autoGroupResult）
- [x] 展示模式「计算」→ `runAutoGroup` + 计算模式
- [x] 确认 → `handleConfirm` → watch(confirmed) → 展示模式
- [x] 编辑置灰：`!autoGroupResult`

## 7. 构建验证

- [x] `npm run build` 通过
