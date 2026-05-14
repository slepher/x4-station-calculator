# Station Dashboard Building Modules - Design

## Architecture

### 层级变更总览

```
Store (useLiveProductionStore)
  └─ moduleScope: Ref<'built'|'building'|'all'>  ← 新增
       │
       ├─→ useProductionToolbarPresenter          ← 透传 moduleScope, hasBuildingModules
       │     └─→ LiveStationToolbar.vue           ← 三态按钮 + 条件分隔线
       │
       └─→ useProductionDashboardPresenter        ← 新增 effectiveModules computed
             └─→ LiveProductionWorkbenchView.vue   ← 传递 :effective-modules
                   └─→ StationDashboard.vue        ← 双分析
```

### Store 层

**文件**: `src/store/useLiveProductionStore.ts`

新增：

```typescript
const moduleScope = ref<'built' | 'building' | 'all'>('built')

watch(activeStationId, () => { moduleScope.value = 'built' })
watch(mode, () => { moduleScope.value = 'built' })

function cycleModuleScope() {
  const order: Array<'built' | 'building' | 'all'> = ['built', 'building', 'all']
  const idx = order.indexOf(moduleScope.value)
  moduleScope.value = order[(idx + 1) % 3]
}
```

暴露到 store return 对象：`moduleScope`, `cycleModuleScope`

### Toolbar Presenter 层

**文件**: `src/components/empire/presenters/useProductionToolbarPresenter.ts`

`ToolbarPresenterProps` 新增：

```typescript
moduleScope: ComputedRef<'built' | 'building' | 'all'>
hasBuildingModules: ComputedRef<boolean>
```

`ToolbarPresenterEmits` 新增：

```typescript
cycleModuleScope: () => void
```

`ToolbarPresenterStore` 新增：

```typescript
moduleScope?: Ref<'built' | 'building' | 'all'>
hasBuildingModules?: boolean
cycleModuleScope?: () => void
```

props 填充：

```typescript
moduleScope: computed(() => store.moduleScope?.value ?? 'built'),
hasBuildingModules: computed(() => store.hasBuildingModules ?? false),
```

emits 填充：

```typescript
cycleModuleScope: () => store.cycleModuleScope?.(),
```

### Dashboard Presenter 层

**文件**: `src/components/empire/presenters/useProductionDashboardPresenter.ts`

`DashboardPresenterProps` 新增：

```typescript
effectiveModules: ComputedRef<SavedModule[]>
```

`DashboardPresenterStore` 新增：

```typescript
moduleScope?: Ref<'built' | 'building' | 'all'>
```

computed 填充：

```typescript
effectiveModules: computed(() => {
  const scope = store.moduleScope?.value ?? 'built'
  const modules = store.stationState?.modules || []
  const building = store.stationState?.buildingModules || []
  if (scope === 'building') return building
  if (scope === 'all') return [...modules, ...building]
  return modules
}),
```

### LiveStationToolbar.vue

**文件**: `src/components/empire/context_toolbar/LiveStationToolbar.vue`

Props 新增：

```typescript
moduleScope: 'built' | 'building' | 'all'
hasBuildingModules: boolean
```

Emits 新增：

```typescript
cycleModuleScope: []
```

模板：在单次停泊吞吐量 (`ml-6`) 之后，条件分隔线 + 按钮组：

```html
<template v-if="props.mode === 'live' && props.hasBuildingModules">
  <div class="separator mx-6"></div>

  <div class="toolbar-section">
    <div class="input-group">
      <label class="group-label">{{ t('toolbar.module_scope') }}</label>
      <button
        class="toggle-chip"
        :class="{
          'active-green': props.moduleScope === 'built',
          'active-amber': props.moduleScope === 'building',
          'active-sky': props.moduleScope === 'all'
        }"
        @click="emit('cycleModuleScope')"
      >
        <span class="text-sm">{{ scopeIcon }}</span>
        <span class="chip-status">{{ scopeLabel }}</span>
      </button>
    </div>
  </div>
</template>
```

计算属性：

```typescript
const scopeIcon = computed(() => {
  if (props.moduleScope === 'building') return '🚧'
  if (props.moduleScope === 'all') return '📦'
  return '🏗️'
})

const scopeLabel = computed(() => {
  if (props.moduleScope === 'building') return t('toolbar.module_scope_building')
  if (props.moduleScope === 'all') return t('toolbar.module_scope_all')
  return t('toolbar.module_scope_built')
})
```

新增样式：

```css
.toggle-chip.active-amber {
  @apply bg-amber-900/30 border-amber-600 text-amber-400 shadow-[0_0_8px_rgba(217,119,6,0.2)];
}
.toggle-chip.active-amber .chip-status { @apply text-amber-300; }

.toggle-chip.active-sky {
  @apply bg-sky-900/30 border-sky-600 text-sky-400 shadow-[0_0_8px_rgba(2,132,199,0.2)];
}
.toggle-chip.active-sky .chip-status { @apply text-sky-300; }
```

### LiveProductionWorkbenchView.vue

**文件**: `src/components/empire/LiveProductionWorkbenchView.vue`

LiveStationToolbar 调用处新增 props：

```html
:module-scope="toolbarPresenter.props.moduleScope.value"
:has-building-modules="toolbarPresenter.props.hasBuildingModules.value"
@cycle-module-scope="toolbarPresenter.emits.cycleModuleScope"
```

StationDashboard station view 调用处新增 prop：

```html
:effective-modules="dashboardPresenter.props.effectiveModules.value"
```

### StationDashboard.vue

**文件**: `src/components/empire/StationDashboard.vue`

Props 新增：

```typescript
effectiveModules?: SavedModule[]
```

双分析替代单一 analysis：

```typescript
const costAnalysis = computed(() => {
  return analyzeStation(
    props.effectiveModules ?? props.modules,
    gameDataStore.modulesMap,
    gameDataStore.waresMap,
    buildPriceMultiplier.value,
    props.settings.useHQ
  )
})

const workersAnalysis = computed(() => {
  return analyzeStation(
    props.modules,
    gameDataStore.modulesMap,
    gameDataStore.waresMap,
    buildPriceMultiplier.value,
    props.settings.useHQ
  )
})
```

所有使用 `analysis.value` 的地方拆分：
- `data` computed 中：`workers` 视图用 `workersAnalysis.value`，其余用 `costAnalysis.value`
- `stats-bar`：成本/体积/时间/运输用 `costAnalysis.value`，工人/效率用 `workersAnalysis.value`
- `clampedManualWorkforce`、`maxAllowedWorkforce` 等工人相关计算用 `workersAnalysis.value`
- `hasDashboardData` 使用 `costAnalysis.value`（因为成本视图是默认视图）

### i18n

**zh-CN.json** 新增：

```json
"toolbar.module_scope": "建造视图",
"toolbar.module_scope_built": "已建设",
"toolbar.module_scope_building": "建设中",
"toolbar.module_scope_all": "所有"
```

**en.json** 新增：

```json
"toolbar.module_scope": "Build View",
"toolbar.module_scope_built": "Built",
"toolbar.module_scope_building": "Building",
"toolbar.module_scope_all": "All"
```

## Decisions

1. **双分析而非单分析 + 后过滤**：`analyzeStation` 对模块列表做聚合，后过滤无法正确拆分已合并的 summaryItems。双分析虽多一次计算，但模块列表通常 <50，开销可忽略。
2. **`effectiveModules` 为可选 prop**：不破坏现有调用方（transit view、overview、blueprint 仍传 `modules` 即可）。
3. **Store 持有 moduleScope**：toolbar 和 dashboard 都需要此状态，放在 store 是最自然的共享点。
4. **三态循环而非下拉选择**：与现有 toggle-chip 交互模式一致（workforce ON/OFF 也是单击切换），三态循环更轻量。
