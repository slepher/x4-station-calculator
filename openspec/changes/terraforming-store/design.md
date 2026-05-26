# Terraforming Store — Design

## Architecture

```
useTerraformingStore (新 Pinia store)
├── 持久化: x4_terraforming_data (版本化)
├── SavedTerraformingState { version, activeId, list: TerraformingPlan[] }
│
├── TerraformingPlan (持久化)
│   ├── id
│   ├── mode: 'live' | 'blueprint'
│   ├── planId: string
│   ├── selectedClusterId: string | null
│   └── executionLogByCluster: Record<string, string[]>
│
├── 内存展开
│   ├── executionLogByCluster: Record<string, TerraformingExecutionEntry[]>
│   ├── executionSeqByCluster: Record<string, number>
│   ├── completedProjectsByCluster: Record<string, Map<string, number>>
│   └── housingBuiltByCluster: Record<string, number>
│
├── HQ Context (内部从 live/blueprint store 获取)
│   ├── isLiveMode → 从 useLiveProductionStore / useSaveBindingStore 取 HQ
│   └── isBlueprintMode → HQ 全部为 null/空/默认
│
├── Display Computeds
│   ├── terraformingData / selectedCluster / executionLog / completedProjects
│   ├── currentStats / runtimeProjectIds / housingBuilt
│   ├── hqStationName / hqArchiveStation / hqEffectiveModules / hqClusterId
│   └── isLiveMode / isBlueprintMode
│
└── 自动持久化: saveToStorage() 在每次 mutation 后触发

         │
         ├── useTerraformingPresenter
         │       │
         │       ├── TerraformingTaskList.vue
         │       ├── TerraformingTaskNode.vue
         │       ├── TerraformingResourcePanel.vue
         │       ├── TerraformingStatScale.vue
         │       ├── TerraformingSectorPanel.vue
         │       └── TerraformingToolbar.vue
         │
         └── LiveProductionWorkbenchView.vue (live 模式下 setHqContext)

terraformingTaskResolver.ts  ← 不变 (纯计算)
terraformingRuntime.ts       ← 不变 (纯计算)
```

## 设计原则

1. Store 参照 `useEmpireDataStore` 模式：`SavedState { version, activeId, list }` 结构 + `getStorageKey()` 版本化。
2. 持久化数据保持最小化：`executionLogByCluster` 只存 `projectId[]`，不存 `id`。
3. hydrate 时展开 `projectId[]` → `TerraformingExecutionEntry[]`，与当前 `hydrateTerraformingLogs()` 行为一致。
4. HQ context 由 store 内部从 live/blueprint store 获取，不通过外部注入。
5. blueprint 模式不需要 HQ context，presenter 根据 `isLiveMode` 判断后使用默认值。
6. 变更时自动保存 — 每个 mutation 方法内部调用 `saveToStorage()`，不暴露外部保存接口。
7. **调用方向**：`useTerraformingStore` → `useLiveProductionStore` / `useBlueprintProductionStore` / `useSaveBindingStore`，反之不允许。

## Store Design

### State Schema

```typescript
interface TerraformingPlan {
  id: string
  mode: 'live' | 'blueprint'
  planId: string
  selectedClusterId: string | null
  executionLogByCluster: Record<string, string[]>
}

interface SavedTerraformingState {
  version: number
  activeId: string | null
  list: TerraformingPlan[]
}
```

### Reactive Refs

```typescript
const savedPlans = ref<SavedTerraformingState>({ version: 1, activeId: null, list: [] })

// 内存展开 (非持久化)
const expandedExecutionLogByCluster = ref<Record<string, TerraformingExecutionEntry[]>>({})
const housingBuiltByCluster = ref<Record<string, number>>({})
```

### Computed: active plan

```typescript
const activePlan = computed(() => savedPlans.value.list.find(p => p.id === savedPlans.value.activeId) ?? null)
const selectedClusterId = computed(() => activePlan.value?.selectedClusterId ?? null)

// 选中 cluster 的展开数据
const executionLog = computed(() => {
  const cid = selectedClusterId.value
  return cid ? expandedExecutionLogByCluster.value[cid] ?? [] : []
})
const completedProjects = computed(() => buildCompletedProjectsFromExecutionLog(executionLog.value))
const currentStats = computed(() => {
  if (!activePlan.value || !data) return {}
  return computeTerraformingRuntimeStats(selectedCluster.value, completedProjects.value, data)
})
const runtimeProjectIds = computed(() => {
  if (!activePlan.value || !data) return []
  return getRuntimeTerraformingProjectIds(selectedCluster.value, currentStats.value, completedProjects.value, data)
})
```

### Hydrate / Persist

```typescript
function hydrateExecutionLogs() {
  const plan = activePlan.value
  if (!plan) return
  const expanded: Record<string, TerraformingExecutionEntry[]> = {}
  for (const [clusterId, projectIds] of Object.entries(plan.executionLogByCluster)) {
    expanded[clusterId] = projectIds.map((pid, i) => ({ id: `${clusterId}-exec-${i + 1}`, projectId: pid }))
  }
  expandedExecutionLogByCluster.value = expanded

  const completed: Record<string, Map<string, number>> = {}
  for (const [cid, entries] of Object.entries(expanded)) {
    completed[cid] = buildCompletedProjectsFromExecutionLog(entries)
  }
  // ...
  housingBuiltByCluster.value = {}  // 始终 reset
}
```

`hydrateExecutionLogs()` 在 `loadFromStorage()` 后和 `setActivePlan()` 时调用。

`saveToStorage()` 在每次 mutation 内部调用：
```typescript
function saveToStorage() {
  localStorage.setItem(getStorageKey(), JSON.stringify(savedPlans.value))
}
```

#### 持久化前压缩

`saveToStorage()` 不需要压缩，因为 `savedPlans.value` 中的 `executionLogByCluster` 直接存储为 `string[]` 格式，已经是最小存储。

### Mutation Methods

```typescript
// Plans CRUD
function ensurePlanForContext(mode: 'live' | 'blueprint', planId: string): string
  // 查找或创建: 按 mode + planId 匹配已有 plan
  // 找不到则 createPlan() + 设为 active

function createPlan(mode: 'live' | 'blueprint', planId: string): string
function deletePlan(id: string): void
function setActivePlan(id: string | null): void  // 触发 hydrateExecutionLogs

// Cluster 操作
function selectCluster(clusterId: string): void
function appendExecution(projectId: string, count: number): void
function removeExecution(entryId: string): void
function setProjectCount(projectId: string, count: number): void
function replaceExecutionLog(entries: TerraformingExecutionEntry[]): void
function clearExecutionQueue(): void
function setHousingBuilt(count: number): void

// HQ Context
function setHousingBuilt(count: number): void
```

每个 mutation 方法最后调用 `saveToStorage()`。

### HQ Context 设计

HQ context 由 store 内部从关联 store 推导，不作为持久化数据存储：

```typescript
const isLiveMode = computed(() => activePlan.value?.mode === 'live')
const isBlueprintMode = computed(() => activePlan.value?.mode === 'blueprint')

// live 模式下从 useLiveProductionStore / useSaveBindingStore 取 HQ 数据
const liveStore = useLiveProductionStore()
const saveBindingStore = useSaveBindingStore()

const hqStationName = computed(() => {
  if (!isLiveMode.value) return ''
  // 从 active binding 对应的 archive station 取名称
  // ...
})

const hqArchiveStation = computed(() => {
  if (!isLiveMode.value) return null
  // 从 save binding 对应的 archive station 取数据
  // ...
})

// blueprint 模式下直接返回默认值
const hqEffectiveModules = computed(() => isLiveMode.value ? ... : [])
const hqClusterId = computed(() => isLiveMode.value ? ... : null)
```
```

## Presenter 适配

`useTerraformingPresenter` 的 `TerraformingPresenterStore` 接口需更新：

```typescript
interface TerraformingPresenterStore {
  terraformingData: ComputedRef<TerraformingData | null>
  terraformingSelectedClusterId: ComputedRef<string | null>
  terraformingSelectedCluster: ComputedRef<TerraformingCluster | null>
  terraformingCurrentStats: ComputedRef<Record<string, number>>
  terraformingRuntimeProjectIds: ComputedRef<string[]>
  terraformingCompletedProjects: ComputedRef<Map<string, number>>
  terraformingExecutionLog: ComputedRef<TerraformingExecutionEntry[]>
  terraformingHousingBuilt: ComputedRef<number>
  terraformingHqStationName: ComputedRef<string>
  terraformingHqArchiveStation: ComputedRef<ArchiveStationData | null>
  terraformingHqEffectiveModules: ComputedRef<SavedModule[]>
  terraformingHqClusterId: ComputedRef<string | null>
  // ... mutation wrappers
}
```

Presenter 内部差异处理（不改变接口）：

```typescript
const hqBuildDocks = computed(() => {
  if (store.terraformingIsBlueprint.value) return { totalSlots: 1 }
  const modules = store.terraformingHqEffectiveModules.value
  if (!modules.length) return null
  // ... 现有计算逻辑
})
```

## Type Changes

### 新增类型

```typescript
// src/types/x4.ts

interface TerraformingPlan {
  id: string
  mode: 'live' | 'blueprint'
  planId: string
  selectedClusterId: string | null
  executionLogByCluster: Record<string, string[]>
}

interface SavedTerraformingState {
  version: number
  activeId: string | null
  list: TerraformingPlan[]
}
```

### VersionConfig 扩展

```typescript
interface VersionConfig {
  // ...existing fields...
  storage_keys: {
    empire: string
    logic_flow: string
    ship_blueprints: string
    setting: string
    save_archives: string
    build_plan_goals: string
    terraforming: string     // 新增
  }
}
```

### 移除类型

```typescript
// SaveBindingPlan 移除
terraformingLogs?: Record<string, string[]>  // 移除
```

## File Changes

| File | Change |
|---|---|
| `src/types/x4.ts` | 新增 `TerraformingPlan`、`SavedTerraformingState`；`VersionConfig.storage_keys` 加 `terraforming`；`SaveBindingPlan` 移除 `terraformingLogs` |
| `src/store/logic/storageVersions.ts` | 新增 `CURRENT_TERRAFORMING_VERSION = 1` |
| `src/store/useGameDataStore.ts` | `getStorageKey()` 增加 `'terraforming'` 分支 |
| `src/store/useTerraformingStore.ts` | **新建** Pinia store |
| `src/store/useSaveBindingStore.ts` | 移除 `terraformingLogs` 引用 |
| `src/store/useLiveProductionStore.ts` | 移除所有 terraforming 状态/方法/computed |
| `src/components/empire/presenters/useTerraformingPresenter.ts` | 适配新 `TerraformingPresenterStore`；blueprint HQ context 处理 |
| `src/components/empire/LiveProductionWorkbenchView.vue` | 更新 store 引用；移除 terraforming 相关代码；terraforming store 内部自动取 HQ context，此 View 无需注入 |
| `src/store/logic/importExport.ts` | 新增 `x4_terraforming_data` 作为 `ImportModuleKey`；`buildExportPayload` 增加参数并过滤；新增 `applyTerraformingImport`；`getModuleImportStats` 增加 terraforming 统计；`applyImportPayload` 增加 terraforming 应用 |
| `src/components/StorageExportWizard.vue` | `displayModules` 增加 terraforming 行；调用 `buildExportPayload` 时传入 terraforming 数据 |
| `src/components/StorageImportWizard.vue` | `selectedModules` 增加 `x4_terraforming_data`；`moduleTitle` 增加 terraforming case |
| `src/components/StationToolbar.vue` | 导入导出按钮组件已通过 wizard 组件间接支持，无需修改 |

## 导入导出设计

### 类型扩展

```typescript
// ImportModuleKey 新增
type ImportModuleKey = '...' | 'x4_terraforming_data'

const TERRAFORMING_KEY: ImportModuleKey = 'x4_terraforming_data'

// STORAGE_KEY_MAP 新增
const STORAGE_KEY_MAP = { ..., [TERRAFORMING_KEY]: 'x4_terraforming_data' }
```

### 导出过滤逻辑

`buildExportPayload` 新增参数 `terraforming?: SavedTerraformingState`：

```typescript
function buildExportPayload(
  empire, flow, ship, gameDataStore?, saveBindings?, buildPlanGoals?,
  terraforming?: SavedTerraformingState  // 新增
) {
  // ...
  let terraformingData = terraforming ? deepClone(terraforming) : undefined
  if (terraformingData) {
    // 不导出 live 数据时，过滤掉 mode=live 的 plans
    if (!saveBindings) {
      terraformingData.list = terraformingData.list.filter(p => p.mode !== 'live')
    }
    if (terraformingData.list.length === 0) terraformingData = undefined
  }

  return {
    // ...
    data: {
      // ...existing...
      ...(terraformingData ? { [TERRAFORMING_KEY]: terraformingData } : {})
    }
  }
}
```

**逻辑**：
- `saveBindings` 参数为 `undefined` 表示不导出 live 数据 → 过滤掉 mode=`live`
- 当前始终导出 blueprint 数据，因此 mode=`blueprint` 始终导出

### 导入过滤逻辑

导入时在 `applyTerraformingImport` 中按 selectedModules 过滤：

```typescript
function applyTerraformingImport(options, warnings): boolean {
  const migrated = preparedPayload.preparedModules[TERRAFORMING_KEY] as SavedTerraformingState | undefined
  if (!migrated) return false

  let nextList = migrated.list
  const liveSelected = options.selectedModules[SAVE_KEY] || options.selectedModules[BINDING_KEY]
  const blueprintSelected = options.selectedModules[EMPIRE_KEY] || options.selectedModules[FLOW_KEY]
    || options.selectedModules[SHIP_KEY] || options.selectedModules[BUILD_PLAN_KEY]

  // 过滤: 未勾选对应模块则排除对应 mode 的 plans
  if (!liveSelected && !blueprintSelected) {
    nextList = []  // 两组都没选 → 全部排
  } else if (!liveSelected) {
    nextList = nextList.filter(p => p.mode !== 'live')
  } else if (!blueprintSelected) {
    nextList = nextList.filter(p => p.mode !== 'blueprint')
  }

  const next = { ...migrated, list: nextList }
  // ... persist and load into terraformingStore
}
```

### 导入导出向导适配

**StorageExportWizard.vue**：
- `displayModules` 增加 terraforming 行
- `buildExportPayload` 调用时传入 `terraforming?.savedPlans`

**StorageImportWizard.vue**：
- `selectedModules` 增加 `x4_terraforming_data` key
- `moduleTitle` switch 增加 terraforming case
- `selectedModules` 的默认值 logic 同步更新

## 不修改的文件

| File | 原因 |
|---|---|
| `src/store/logic/terraformingTaskResolver.ts` | 纯计算逻辑 |
| `src/store/logic/terraformingRuntime.ts` | 纯计算逻辑 |
| `src/components/empire/terraforming/*.vue` | 纯展示组件，props 驱动 |
| `src/components/empire/context_toolbar/TerraformingToolbar.vue` | props 驱动 |
| `src/store/useActiveViewStore.ts` | `activeTerraformingClusterId` 保留，用于跨 session 记住上次选中 cluster |
