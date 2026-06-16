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

### 3. 存档时间比对

为避免 `runAutoGroup()` 在同一份 save archive 上重复重算，`SaveBindingPlan` 新增：

| 字段 | 类型 | 说明 |
|------|------|------|
| `appliedAutoGroupArchiveTime` | `number \| undefined` | 最近一次已应用 auto group 的 `archive.meta.time` |

行为规则：

- `runAutoGroup()` 读取当前 archive 的 `meta.time`
- 当 `binding.appliedAutoGroupArchiveTime === archive.meta.time` 且 `liveStore.autoGroupResult` 已存在时，复用现有草案，不重算
- 当当前 archive time 更新时，重新执行 `groupCleanSlate` 或 `groupIncremental`
- `handleConfirm()` 成功写入 binding 后，记录当前 `archive.meta.time` 到 `appliedAutoGroupArchiveTime`
- 新字段属于持久化类型，必须同步更新 `useSaveBindingStore.ts` 的 `normalizeState()`

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
  if (isBinding && liveStore.autoGroupResult) {
    return buildColorMap(liveStore.autoGroupResult.groups)
  }
  const binding = saveBindingStore.activeBinding
  if (!binding) return {}
  return buildColorMap(binding.groups)
})
```

非 binding 模式下使用 `saveBindingStore.activeBinding` 的持久数据。

### 6. 生命周期

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
2. binding 模式下修改 group 颜色，地图实时反映
3. `handleColorChange` 不再修改 `draftBinding`
4. 切换 activeBinding 或 archive 后，唯一草案按新上下文重新初始化，不显示上一上下文的未提交草案
5. 同一 archive time 且已有草案时，`runAutoGroup()` 不重复重算
6. archive time 更新后，`runAutoGroup()` 重新计算并在确认后记录新的 `appliedAutoGroupArchiveTime`
7. 确认提交后数据持久化，reload 不丢失
8. `npm run build` 通过

## 未决项

无
