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
import { DEFAULT_JUMP_RANGE, DEFAULT_BRIDGE_SEARCH_JUMP_RANGE, type AutoGroupResult, type GroupDraftInfo, groupCleanSlate, groupIncremental, enrichAutoGroupResult } from './logic/autoGroup'
import { DEFAULT_HUB_CONFIG } from './logic/autoGroupHub'
import { buildSectorGraphFromMaps } from './logic/saveBindingUtils'

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

/** 从已有 binding groups 构建 assignments（不跑分组算法） */
function buildAssignmentsFromBinding(): AutoGroupResult | null {
  // 读取 binding.groups 转为 GroupDraftInfo[]
  // 构建 sectorGraph → 为每个覆盖星区计算所有候选 group
  // 构建 SectorAssignment[]，根据已有 coverage 设定默认选中
  return { groups, assignments, bridgePlans: [], playerSectorMacros }
}

/** 初始化草案 — 双路径决策，并由 enrichAutoGroupResult 富化 */
function initAutoGroupDraft() {
  if (needsAutoGroupRecalc.value) {
    result = groupCleanSlate(...) 或 groupIncremental(...)
  } else {
    result = buildAssignmentsFromBinding()
  }
  // 纯函数富化：名称 i18n 翻译、hub 颜色、交易站默认选择
  autoGroupResult.value = enrichAutoGroupResult(result, {
    getSectorName: (macro) => i18n.global.t(sector.nameId) || macro,
    getFactionColor: (macro) => sector.owner_color || cluster?.owner_color,
    archive, modulesByMacroId, prefThreshold, prefJumpRange
  }, sectorGraph, sectorClusterMap)
  calculationMode.value = 'result'
}
```

`enrichAutoGroupResult` 是 `autoGroup.ts` 中的纯函数，接收 deps 对象，不依赖 store 或 i18n 实例。
`buildAssignmentsFromBinding` 是 store 内部函数，仅做数据转换。

| 方法 | 位置 | 职责 |
|------|------|------|
| `groupCleanSlate` / `groupIncremental` | `autoGroup.ts` | 纯函数，生成原始分组结果 |
| `buildAssignmentsFromBinding` | `useLiveProductionStore.ts` | 从持久化 groups 构建 assignments |
| `enrichAutoGroupResult` | `autoGroup.ts` | 纯函数，富化：名称翻译、颜色、交易站默认 |
| `initAutoGroupDraft` | `useLiveProductionStore.ts` | 编排：计算 → 富化 → 存储 |

Live 和 Map 面板不调用这些方法，只读取 `autoGroupResult`。

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
[SaveUploadPanel 3fr] | [SectorOverviewBar + SectorGroupList 4fr] | [EmpireWareFlowsDashboard 5fr]
```
- 星区列表列顶部：`SectorOverviewBar.vue`（桥接跳数、覆盖跳数、Hub 阈值纯数值只读）
- 「详情」→ `liveMode = 'calculate'`（红点在详情按钮上）
- 「地图」→ 设置 `isSavePanelOpen=true, mapSavePanelLayer='binding-sector', mapBindingGameGuid=guid, setActiveView('maps')`
- `LiveOverviewToolbar` 已移除，overview 界面不再显示 context toolbar

**计算模式**：`liveMode = 'calculate'`

三列复用 `AutoSectorGroupPanel`（`layout="columns"`），读取 `liveStore.autoGroupResult` 渲染。

统一 Bar `AutoSectorBar` 跨全宽位于列上方，合并原 `SectorConfirmBar` + `AllocationConfirmBar`。

**Live 布局（单行）**：
```
[返回] [地图] [桥接[5]跳 ☑] [节点 ☑] [覆盖[2]跳 ☑] [Hub[5M] ☑]  [退出][计算][+]      ← edit
[返回] [地图] [桥接[5]跳 ☑] [节点 ☑] [覆盖[2]跳 ☑] [Hub[5M] ☑]  未决:2+1 [重置][提交][计算] ← result
```

按钮统一 `calc-btn` 风格（edit/result 一致）。

**Map 布局（两行）**：
```
[桥接[5] ☑] [节点 ☑]
[覆盖[2] ☑] [Hub[5M] ☑]
                                [取消][计算][+]             ← edit
                                2+1 [重置][提交][计算][编辑] ← result
```

参数 dropdown 和 checkbox 在 result/edit 两态均可用，不再由 `calculationMode` 控制。

result 模式按钮：未决计数 + [重置] [提交] [计算] [编辑]

**Live HubAddMenu**：`mode="overlay"` 弹出模式。`fixed inset-0 z-50` 全屏遮罩 + 居中对齐面板（无金边、无定位按钮、紧凑宽度 w-96）。

**搜索结果去重**：搜索从 `filteredSearchAllSectors` 取数，排除已在 "存档星区候选" 中的 sector。

编辑模式（`calculationMode === 'edit'`）：

**重置**：`handleResetAssignments` 从 `calculationBaseline` 恢复（每次计算完成或确认后保存的快照）。

**确认**：仅检查所有 hub 是否有交易站。sector 分配未完成时弹出二次确认 popup，用户确认后仍可提交。

**`calculationBaseline` 保存时机**：
- `initAutoGroupDraft()` 完成
- `runCalculationFromEditInput()` 完成
- `handleConfirm()` 完成
- 编辑内容实时修改当前 draft，不保留 snapshot
- "取消"→"退出"，仅退出编辑模式，不做状态恢复
- Col 2（分配栏）不再禁用/遮罩，正常显示当前草稿状态
- 编辑操作立即反应到 draft

编辑操作联动：

| 操作 | 分配栏变化 |
|------|-----------|
| 添加新 hub | 该 sector 从分配列表移除；其他 sector 新增该 hub 候选 |
| 移除 hub | 该 sector 回到分配列表；其他 sector 移除该 hub 候选（若选中则变空） |
| sector 移出覆盖 | 该 sector 移除对应 absorb 选项（若选中则变空） |
| sector 加回覆盖 | 该 sector 新增对应 absorb 选项 |
| 修改跳数 | 覆盖星区变化 → 涉及 sector 的选项增减（选中项不在了则变空） |

**Baseline 统一语义**：

Baseline = `initAutoGroupDraft()` 完成时的持久化状态快照（hub + 覆盖 + 连接），生成后不再改变。

| 来源 | baseline |
|------|----------|
| binding 中已有 group（`buildAssignmentsFromBinding` / `buildStoreGroups`） | `true` |
| 算法生成新 hub（`groupCleanSlate` / `groupIncremental`） | `false` |
| bridge 产生新 hub（`applyBridgePlanToDraft`） | `false` |
| 用户手动添加的 hub（`handleAddHubDraft`） | `false` |

`calcBaselinePillState` 在 `initAutoGroupDraft()` 时写入，存储初始覆盖和连接用作 UI 的加粗基线展示。后续 `runCalculationFromEditInput` 不再重写基线。

**Map 模式**：

Map 进入 binding 阶段直接读取 `liveStore.autoGroupResult` 渲染，不通过 `liveMode` 切换。`gameGuid` watcher 不需要调用额外初始化方法（store 已在上下文切换时自动初始化）。

## 注意

- `autoGroupResult` 用 `shallowRef`：整体替换触发更新
- Pinia setup store 暴露到 store 实例后，handler 中使用 `liveStore.autoGroupResult = nextResult` 这类属性赋值；组件需要 ref 时由 presenter 使用 `storeToRefs(liveStore)` 转出
- Presenter 的 computed（`hasGlobalUnresolved`、`tradeStationCaps` 等）留在 presenter，自动响应 liveStore ref
