# Binding 模式共享草案 (auto-sector-group-draft)

## 目标

将 binding 模式的 group 方案数据搬入 `liveStore`，使 live 面板和 map 面板共享同一份编辑状态，切换不丢进度。同时草案数据不直接修改 `draftBinding`，退出 binding 不回滚已确认内容。

本变更只维护一份全局唯一的 binding draft。系统不需要、也不支持同时维护多个 binding 的并行草案；`liveStore` 中的共享状态始终表示“当前正在编辑的 binding 草案”。

## 已确认方案（审核重点）

### 1. 当前问题

- `useAutoSectorGroupPresenter()` 每次调用创建独立实例，live 面板和 map 面板各有独立状态
- `handleColorChange` 调用 `saveBindingStore.updateGroup()` 直接修改 `draftBinding`，选色立即持久化
- live 改一半切到 map 面板，进度丢失

### 2. 最小搬迁清单

以下 6 个状态从 presenter 搬入 `useLiveProductionStore`（Pinia 单例），两个面板共享：

| 状态 | 类型 | 说明 |
|------|------|------|
| `autoGroupResult` | `ShallowRef<AutoGroupResult \| null>` | groups（含 selectedTradeStation、color）+ assignments + bridgePlans |
| `calculationMode` | `Ref<'edit' \| 'result'>` | 编辑/结果模式 |
| `autoGroupConfirmed` | `Ref<boolean>` | 当前唯一草案是否已提交 |
| `prefJumpRange` | `Ref<number>` | 覆盖 hop 数 |
| `bridgeSearchJumpRange` | `Ref<number>` | bridge 搜索 hop 数 |
| `prefThreshold` | `Ref<number>` | hub 阈值 |

`autoGroupConfirmed`（Reactive，presenter computed）SHALL 指示当前唯一草案是否已提交确认，不作为 `autoGroupResult` 是否为草案的标志；`autoGroupResult` 可以为非 null 且未确认（编辑中草案），也可以为非 null 且已确认（已提交结果）。

### 3. 存档时间比对

为避免 `runAutoGroup()` 在同一份 save archive 上重复重算，`SaveBindingPlan` 新增：

| 字段 | 类型 | 说明 |
|------|------|------|
| `appliedAutoGroupArchiveTime` | `number \| undefined` | 最近一次已应用 auto group 的 `archive.meta.time` |

行为规则：

- `runAutoGroup()` 始终执行计算（不跳过），每次强制 `autoGroupConfirmed = false`
- `handleConfirm()` 记录 `appliedAutoGroupArchiveTime`，不覆盖 `autoGroupResult`（保留 assignments 供编辑查看）

**不搬的（留在 presenter 本地）：**

- `tradeStationCandidates` — computed，每次切换 tab 从 archive + groups 重算
- `editSnapshot`、`calcBaselinePillState` — 与当前面板 UI 绑定
- `bridgeRetainEnabled` 等保留开关 — 局部 UI 状态
- `hasGlobalUnresolved`、`hasUncertainAssignments` 等 — computed，本地重算

### 4. Presenter 改造

`useAutoSectorGroupPresenter()` 不再自己建 ref，改为从 `liveStore` 读写。两个面板各调一次 presenter，内部状态指向同一份 liveStore 数据。

Handler 函数（`handleColorChange`、`handleAddHubDraft`、`runCalculationFromEditInput` 等）改为读写 `liveStore` ref，不再持有本地状态。

`liveStore` 作为 Pinia setup store 时，handler 内部统一通过 store 属性读写共享状态，例如 `liveStore.autoGroupResult = nextResult`。如果 presenter 需要向 Vue 组件返回 ref，则在 presenter 内使用 `storeToRefs(liveStore)` 获取并返回，不在 handler 中混用 `.value` 与属性赋值。

### 5. 地图草案渲染

`MapWorkbenchView` 的 `sectorGroupColorMap` 计算：

```ts
const sectorGroupColorMap = computed(() => {
  const isBinding = bindingContextStage.value === 'select-sector'
                 || bindingContextStage.value === 'select-station'
  if (isBinding && !liveStore.autoGroupConfirmed && liveStore.autoGroupResult) {
    return buildColorMap(liveStore.autoGroupResult.groups)
  }
  const binding = saveBindingStore.activeBinding
  if (!binding) return {}
  return buildColorMap(binding.groups)
})
```

binding 模式下，`autoGroupConfirmed = false` 表示当前结果仍是草案，地图使用 `liveStore.autoGroupResult` 实时渲染；`autoGroupConfirmed = true` 表示结果已确认提交，地图回到 `saveBindingStore.activeBinding` 作为权威数据。非 binding 模式下始终使用 `saveBindingStore.activeBinding` 的持久数据。

### 6. 生命周期

系统不在任何时机自动执行 `runAutoGroup()`。`onMounted`、`watch(activeBinding)`、`watch(selectedArchive)` 均不触发计算。

### 7. Live 面板模式切换

Live 面板（`SectorOverviewPanel`）新增两种显示模式：

| 模式 | 布局 | 按钮 |
|------|------|------|
| 展示模式 | `[存档 3fr] \| [星区 4fr] \| [资源 5fr]` | 编辑（加载确认结果）、计算（重算+红点） |
| 计算模式 | `[星区 5fr] \| [分配 4fr] \| [交易站 3fr]` | 计算、返回、提交 |

- 展示模式「编辑」→ 直接切到计算模式，保留当前 `autoGroupResult`
- 展示模式「计算」→ `runAutoGroup()` 后进入计算模式
- 计算模式「提交」→ 写 binding + 回到展示模式
- 计算模式「返回」→ 回到展示模式（不提交）
- `!autoGroupResult` 时编辑按钮置灰
- `needsAutoGroupRecalc` 时计算按钮显示红点 + tooltip

计算模式三列复用 `AutoSectorGroupMapPanel` 的现有 vue 模块。

**重算提示**：

- `needsAutoGroupRecalc`：`appliedAutoGroupArchiveTime < archiveTime || !appliedAutoGroupArchiveTime` 时为 true
- 计算按钮显示红点 + tooltip
- `!autoGroupResult` 时编辑按钮置灰

| 时机 | 行为 |
|------|------|
| 进入 binding 模式 | presenter 读取 liveStore ref，恢复上次编辑状态 |
| binding 中编辑 | 两个面板读写同一份 liveStore ref |
| 切换 activeBinding 或 archive | 用新 binding/archive 重新初始化唯一草案；旧草案不按 gameGuid 缓存 |
| 确认提交 | `handleConfirm` → `createAutoGroups` → 写入 `draftBinding` → `saveBinding` |
| 退出 binding | 不做回滚（已确认的内容在 draftBinding 中保存） |

## 边界

In Scope：
- `liveStore` 新增 6 个状态（`autoGroupResult`、`calculationMode`、`autoGroupConfirmed`、`prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold`）
- `SaveBindingPlan` 新增并持久化 `appliedAutoGroupArchiveTime`
- `runAutoGroup()` 使用 archive time 比对避免重复重算
- Presenter 改造为读写 liveStore
- `MapWorkbenchView` 从 liveStore 读取渲染地图
- `handleColorChange` 移除 `updateGroup` 调用
- live 面板和 map 面板共享编辑状态
- activeBinding 或 archive 切换时重新初始化唯一草案

Out of Scope：
- 全部 presenter 内容搬迁
- `tradeStationCandidates` 搬迁
- UI 保留开关搬迁
- 修改 E2E 测试
- 多 binding 并行 draft 缓存

## 验收标准（DoD）

1. live 面板编辑 groups → 切到 map 面板 → 继续编辑 → 切回 live 面板，数据一致
2. binding 模式且 `autoGroupConfirmed = false` 时修改 group 颜色，地图从 `autoGroupResult` 实时反映
3. `handleColorChange` 不再修改 `draftBinding`
4. binding 模式且 `autoGroupConfirmed = true` 时，地图从 `activeBinding` 渲染已确认数据
5. 切换 activeBinding 或 archive 后，唯一草案按新上下文重新初始化，不显示上一上下文的未提交草案
6. 同一 archive time 且已有草案时，`runAutoGroup()` 不重复重算
7. `needsAutoGroupRecalc` 在 `appliedAutoGroupArchiveTime < archiveTime || !appliedAutoGroupArchiveTime` 时为 true，计算按钮显示红点
8. `!autoGroupResult` 时编辑按钮置灰
9. 确认提交后数据持久化，reload 不丢失
10. `npm run build` 通过

## 未决项

无
