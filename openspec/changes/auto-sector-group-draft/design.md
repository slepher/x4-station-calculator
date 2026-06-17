# Binding 模式共享草案 — 设计方案

## 架构概览

将 6 个核心 group 编辑状态从 presenter 局部实例搬入 `useLiveProductionStore`（Pinia 单例），实现 live 面板和 map 面板状态共享。Store 在初始化/上下文切换时完成数据生成，Live 和 Map 面板均为纯 view 层，直接读取 store 中已算好的值。

```
liveStore (Pinia 单例)  ← 数据生产层
  ├─ autoGroupResult       ShallowRef<AutoGroupResult | null>
  ├─ calculationMode       Ref<'edit' | 'result'>
  ├─ prefJumpRange         Ref<number>
  ├─ bridgeSearchJumpRange Ref<number>
  ├─ prefThreshold         Ref<number>
  ├─ needsAutoGroupRecalc  Computed<boolean>
  ├─ initAutoGroupDraft()  → 双路径决策：分组算法 vs 从 binding 构建
  └─ buildAssignmentsFromBinding() → 从已有 binding 构建 assignments

useAutoSectorGroupPresenter()  ← 纯 view 连接层
  ├─ SectorOverviewPanel  (live 模式)  → 同一份 liveStore
  └─ AutoSectorGroupMapPanel (map 模式) → 同一份 liveStore

MapWorkbenchView  ← 从 liveStore 读取 sectorGroupColorMap
```

## 草案作用域与数据流

`liveStore` 只维护一份全局唯一的 binding draft，不按 `gameGuid` 缓存多份草案。所有状态均表示当前 active binding/archive 的草案状态。

Store 初始化时（或 activeBinding / archive 切换时）调用 `initAutoGroupDraft()`，根据 `needsAutoGroupRecalc` 分两条路径生成 `autoGroupResult`：

- **有变化 flag** → 运行分组算法（`groupCleanSlate` / `groupIncremental`）→ 生成结果
- **没有变化 flag** → 调用 `buildAssignmentsFromBinding()` 从已有 binding groups 构建 assignments → 不重新决定分组结构

Live 面板和 Map 面板均为纯 view 层：不直接触发计算，只读取 store 中的结果进行渲染。「详情」按钮仅切换显示模式，不执行计算。

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

// 状态
const autoGroupResult = shallowRef<AutoGroupResult | null>(null)
const calculationMode = ref<'result' | 'edit'>('result')
const prefJumpRange = ref(DEFAULT_JUMP_RANGE)
const bridgeSearchJumpRange = ref(DEFAULT_BRIDGE_SEARCH_JUMP_RANGE)
const prefThreshold = ref(DEFAULT_HUB_CONFIG.containerThreshold)

// 变化 flag
const needsAutoGroupRecalc = computed(() => {
  const archive = saveStore.selectedArchive
  if (!archive) return false
  const binding = saveBindingStore.activeBinding
  const archiveTime = archive.meta?.time ?? 0
  const applied = binding?.appliedAutoGroupArchiveTime
  return applied === undefined || applied < archiveTime
})

// ===== 数据生产方法 =====

/** 初始化草案 — 双路径决策 */
function initAutoGroupDraft() {
  if (needsAutoGroupRecalc.value) {
    // 有变化 flag → 跑分组算法
    const result = saveBindingStore.activeBinding?.groups.length
      ? groupIncremental(/* ... */)
      : groupCleanSlate(/* ... */)
    autoGroupResult.value = result
  } else {
    // 没有变化 flag → 从已有 binding 构建 assignments
    autoGroupResult.value = buildAssignmentsFromBinding()
  }
}
```

`initAutoGroupDraft()` 在以下时机由 store 内部调用：
- Store 初始化且存在 activeBinding 和存档时
- `activeBinding` 或 `selectedArchive` 切换时

Live 和 Map 面板不调用此方法，只读取 `autoGroupResult`。

### Presenter 改造

Presenter 退化为纯 view 连接层：只暴露 store refs 给组件，不包含计算逻辑。

```ts
export function useAutoSectorGroupPresenter() {
  const liveStore = useLiveProductionStore()
  const { autoGroupResult, calculationMode, prefJumpRange, bridgeSearchJumpRange, prefThreshold, needsAutoGroupRecalc } = storeToRefs(liveStore)

  // presenter 本地 computed（不变）
  const hasGlobalUnresolved = computed(() => /* 从 autoGroupResult 重算 */)
  // ...

  // handler 直接 delegate 到 store 或 saveBindingStore
  function handleColorChange(id, color) { /* 更新 liveStore.autoGroupResult */ }
  function handleConfirm() { /* 写入 saveBindingStore */ }

  return { autoGroupResult, /* ... */, handleColorChange, handleConfirm }
}
```

### handleConfirm

记录 `appliedAutoGroupArchiveTime`，不覆盖 `autoGroupResult`（保留计算结果中的 assignments 供后续编辑查看）。确定栏始终显示，不因确认状态隐藏。

### MapWorkbenchView — sectorGroupColorMap

```ts
const sectorGroupColorMap = computed<Record<string, string>>(() => {
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

binding 模式下始终从 `liveStore.autoGroupResult` 渲染草案（确认后 `autoGroupResult` 与 `activeBinding` 数据一致）。非 binding 模式下从 `saveBindingStore.activeBinding` 渲染。

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

Store 在初始化及 activeBinding/archive 切换时调用 `initAutoGroupDraft()` 生成数据。Live 面板、Map 面板及其他系统组件均不额外触发独立计算。

### Live 面板模式切换（SectorOverviewPanel）

```ts
const liveMode = ref<'display' | 'calculate'>('display')
```

Live 面板不触发计算，只切换显示模式。数据由 store 在初始化时生成。

**展示模式**：`liveMode = 'display'`
```
[SaveUploadPanel 3fr] | [SectorGroupList 4fr] | [EmpireWareFlowsDashboard 5fr]
```
- 星区列表列顶部：桥接跳数、覆盖跳数、Hub 阈值（纯数值显示、只读，从 store 读取）
- 「详情」→ `liveMode = 'calculate'`（仅切换模式，store 数据已就绪）
- 「地图」→ 跳转到 map binding 面板
- 详情按钮红点：`liveStore.needsAutoGroupRecalc`
- 详情按钮置灰：`!liveStore.autoGroupResult`

**计算模式**：`liveMode = 'calculate'`

三列复用 `AutoSectorGroupPanel`（`layout="columns"`），读取 `liveStore.autoGroupResult` 渲染星区列表和分配面板。

**Map 模式**：

Map 进入 binding 阶段直接读取 `liveStore.autoGroupResult` 渲染，不通过 `liveMode` 切换。`gameGuid` watcher 不需要调用额外初始化方法（store 已在上下文切换时自动初始化）。

## 注意

- `autoGroupResult` 用 `shallowRef`：整体替换触发更新
- Pinia setup store 暴露到 store 实例后，handler 中使用 `liveStore.autoGroupResult = nextResult` 这类属性赋值；组件需要 ref 时由 presenter 使用 `storeToRefs(liveStore)` 转出
- Presenter 的 computed（`hasGlobalUnresolved`、`tradeStationCaps` 等）留在 presenter，自动响应 liveStore ref
