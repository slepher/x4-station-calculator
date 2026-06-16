# Binding 模式共享草案 — 设计方案

## 架构概览

将 6 个核心 group 编辑状态从 presenter 局部实例搬入 `useLiveProductionStore`（Pinia 单例），实现 live 面板和 map 面板状态共享；同时通过 `appliedAutoGroupArchiveTime` 避免同一 save archive 上重复运行 auto group。

```
liveStore (Pinia 单例)
  ├─ autoGroupResult       ShallowRef<AutoGroupResult | null>
  ├─ calculationMode       Ref<'edit' | 'result'>
  ├─ autoGroupConfirmed    Ref<boolean>
  ├─ prefJumpRange         Ref<number>
  ├─ bridgeSearchJumpRange Ref<number>
  └─ prefThreshold         Ref<number>

useAutoSectorGroupPresenter()  ← 读写 liveStore，不再持有本地状态
  ├─ SectorOverviewPanel  (live 模式)  → 同一份 liveStore
  └─ AutoSectorGroupMapPanel (map 模式) → 同一份 liveStore

MapWorkbenchView  ← 从 liveStore 读取 sectorGroupColorMap
```

## 草案作用域

`liveStore` 只维护一份全局唯一的 binding draft，不按 `gameGuid` 缓存多份草案。`autoGroupResult`、`calculationMode`、`autoGroupConfirmed`、`prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold` 均表示当前 active binding/archive 的草案状态。

当 `activeBinding` 或 selected archive 切换时，presenter 必须用新上下文重新初始化这份唯一草案。旧草案不得继续用于新上下文，也不需要恢复为 per-gameGuid 草案。

`runAutoGroup` 通过 `appliedAutoGroupArchiveTime` 判断是否需要重算：仅在当前 archive time 与已应用 time 不一致时执行计算；若 time 相同且已有 `liveStore.autoGroupResult`，直接复用已有草案。

## 数据模型

### SaveBindingPlan 新增字段（`types/x4.ts`）

```ts
export interface SaveBindingPlan {
  // ... existing fields
  appliedAutoGroupArchiveTime?: number  // 已应用 auto group 的存档 time
}
```

### normalizeState 保留（`useSaveBindingStore.ts`）

```ts
appliedAutoGroupArchiveTime: item.appliedAutoGroupArchiveTime as number | undefined,
```

### liveStore 新增（`useLiveProductionStore.ts`）

```ts
import { DEFAULT_JUMP_RANGE, DEFAULT_BRIDGE_SEARCH_JUMP_RANGE, type AutoGroupResult } from './logic/autoGroup'
import { DEFAULT_HUB_CONFIG } from './logic/autoGroupHub'

const autoGroupResult = shallowRef<AutoGroupResult | null>(null)
const calculationMode = ref<'result' | 'edit'>('result')
const autoGroupConfirmed = ref(false)
const prefJumpRange = ref(DEFAULT_JUMP_RANGE)
const bridgeSearchJumpRange = ref(DEFAULT_BRIDGE_SEARCH_JUMP_RANGE)
const prefThreshold = ref(DEFAULT_HUB_CONFIG.containerThreshold)
```

### Presenter 改造

```ts
export function useAutoSectorGroupPresenter() {
  const liveStore = useLiveProductionStore()
  const { autoGroupResult, calculationMode, autoGroupConfirmed, prefJumpRange, bridgeSearchJumpRange, prefThreshold } = storeToRefs(liveStore)
  // handler 内统一通过 liveStore.xxx 属性读写共享状态
  // 若要向 Vue 组件返回 ref，则使用 storeToRefs(liveStore)
}
```

### runAutoGroup

`runAutoGroup` 始终执行计算，每次强制 `autoGroupConfirmed = false`。不再做时间比对跳过 — 因为所有时机都由用户显式触发。

### handleConfirm

记录 `appliedAutoGroupArchiveTime`，设置 `autoGroupConfirmed = true`。不覆盖 `autoGroupResult`（保留计算结果中的 assignments 供后续编辑查看）。

### MapWorkbenchView — sectorGroupColorMap

```ts
const sectorGroupColorMap = computed<Record<string, string>>(() => {
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

`autoGroupConfirmed = false` 时，`autoGroupResult` 是尚未提交的唯一草案，地图必须读取草案以展示实时编辑；`autoGroupConfirmed = true` 时，结果已经写入 binding，地图必须读取 `activeBinding`，避免继续显示残留草案。

### handleColorChange

```ts
function handleColorChange(groupId: string, color: string | undefined) {
  // 只更新 autoGroupResult，不修改 draftBinding
  const result = liveStore.autoGroupResult
  if (!result) return
  groups[idx] = { ...groups[idx]!, color }
  liveStore.autoGroupResult = { ...result, groups, assignments: result.assignments }
}
```

### 停止自动计算

`onMounted`、`watch(activeBinding)`、`watch(selectedArchive)` 不再调用 `runAutoGroup()`。系统不在任何时机自动触发计算。

### 重算提示

```ts
const needsAutoGroupRecalc = computed(() => {
  const archive = saveStore.selectedArchive
  if (!archive) return false
  const binding = saveBindingStore.activeBinding
  const archiveTime = archive.meta?.time ?? 0
  const applied = binding?.appliedAutoGroupArchiveTime
  return applied === undefined || applied < archiveTime
})
```

- `needsAutoGroupRecalc = true` → 计算按钮显示红点 + tooltip
- `!autoGroupResult` → 编辑按钮置灰

### Live 面板模式切换（SectorOverviewPanel）

```ts
const liveMode = ref<'display' | 'calculate'>('display')
```

**展示模式**：`liveMode = 'display'`

```
[SaveUploadPanel 3fr] | [SectorGroupList 4fr] | [EmpireWareFlowsDashboard 5fr]
```
- 「编辑」→ `triggerAutoGroup()` + `liveMode = 'calculate'`
- 「计算」→ `runAutoGroup()` + `liveMode = 'calculate'`

**计算模式**：`liveMode = 'calculate'`

三列复用 `AutoSectorGroupPanel`（`layout="columns"`）。columns 布局始终显示三列，不区分 `autoGroupConfirmed`。

Map 模式 `gameGuid` watcher 调用 `triggerAutoGroup()` 加载 binding 数据。

展示模式「编辑」→ 直接切到计算模式，不重置 `autoGroupResult`（保留已有的计算数据）。展示模式列表从 `activeBinding` 读取（`autoGroupResult` 为 null 时）。

## 注意

- `autoGroupResult` 用 `shallowRef`：整体替换触发更新
- Pinia setup store 暴露到 store 实例后，handler 中使用 `liveStore.autoGroupResult = nextResult` 这类属性赋值；组件需要 ref 时由 presenter 使用 `storeToRefs(liveStore)` 转出
- Presenter 的 computed（`hasGlobalUnresolved`、`tradeStationCaps` 等）留在 presenter，自动响应 liveStore ref
