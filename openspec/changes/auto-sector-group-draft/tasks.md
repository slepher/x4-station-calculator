# Binding 模式共享草案 — 任务列表

## 1. liveStore 扩展

- [x] 导入 `AutoGroupResult` 类型
- [x] 新增状态：`autoGroupResult`、`calculationMode`、`prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold`
- [x] 新增 `needsAutoGroupRecalc` computed（从 `appliedAutoGroupArchiveTime` 和 archive time 计算）
- [x] 明确所有状态为当前 active binding/archive 的唯一 draft 状态

## 2. SaveBindingPlan 扩展

- [x] 新增 `appliedAutoGroupArchiveTime?: number` 字段
- [x] `normalizeState()` 保留该字段

## 3. Presenter 改造

- [x] 删除 6 个本地 ref 声明，改为从 `liveStore` 读取
- [x] Presenter 改为使用 liveStore 共享 draft 作为唯一数据源，并保留面板交互编排
- [x] handler 内统一通过 `liveStore.xxx` 属性读写共享状态，组件 ref 由 presenter 使用 `storeToRefs(liveStore)` 转出
- [x] `handleColorChange` 移除 `updateGroup()` 调用
- [x] `handleConfirm` 记录 `appliedAutoGroupArchiveTime`；不覆盖 `autoGroupResult`
- [x] 「详情」按钮仅切换 `liveMode`，不触发计算

## 4. MapWorkbenchView 读取草案

- [x] binding 模式下 `sectorGroupColorMap` 从 `liveStore.autoGroupResult` 计算
- [x] 非 binding 模式回退到 `saveBindingStore.activeBinding`

## 5. 面板组件适配

- [x] SectorOverviewPanel 从 presenter 拿到的 ref 是 liveStore 的
- [x] AutoSectorGroupMapPanel → AutoSectorGroupPanel 重命名
- [x] 新增 `layout?: 'tabs' | 'columns'` prop；columns 始终三列
- [x] Map 模式进入 binding 阶段直接读取 `liveStore.autoGroupResult` 渲染

## 6. Live 面板模式切换

- [x] `liveMode: 'display' | 'calculate'`
- [x] 展示模式：`[存档3 | 星区4 | 资源5]`，列表从 `activeBinding` 读取
- [x] 展示模式星区列表列顶部：桥接跳数、覆盖跳数、Hub 阈值（纯数值只读，从 store 读取）
- [x] 计算模式：嵌入 `AutoSectorGroupPanel layout="columns"`
- [x] 展示模式「详情」→ `liveMode = 'calculate'`（仅模式切换，不触发计算）
- [x] 展示模式「地图」→ 跳转到 map binding 面板
- [x] 确认 → `handleConfirm` → `@confirmed` → 展示模式
- [x] 详情按钮红点：`liveStore.needsAutoGroupRecalc`
- [x] 详情按钮置灰：`!liveStore.autoGroupResult`
- [x] 展示模式不显示「计算」按钮

## 7. 构建验证

- [x] `npm run build` 通过

## 8. Store 数据生成（双路径）

- [x] 实现 `initAutoGroupDraft()` — store 初始化/上下文切换时调用
- [x] 有变化 flag → 跑分组算法（`groupCleanSlate` / `groupIncremental`）→ 生成 `autoGroupResult`
- [x] 没有变化 flag → 实现 `buildAssignmentsFromBinding()`：从 `activeBinding.groups` 为每个覆盖星区计算所有候选 group 构建 `SectorAssignment[]`
- [x] Store 在 `activeBinding` 或 `selectedArchive` 切换时自动调用 `initAutoGroupDraft()`
- [x] Live 面板「详情」按钮仅切换模式，不触发计算
- [x] 计算模式「返回」→ 回到展示模式（不提交）
