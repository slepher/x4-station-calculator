# Live Workforce 集成

## 目标

将 save 解析所得的实际 workforce 数据（`PlayerStationEntry.workforces`）集成到 live 模式的 production flow 计算中，使 Dashboard 能展示真实的人口分布和对应的医疗消耗，并强制 workforce 为自动计算状态。

## 已确认方案（审核重点）

### 1. 数据来源

- `PlayerStationEntry.workforces?: WorkforceEntry[]`
- `WorkforceEntry = { race: string, amount: number }`
- 表示该空间站各种族的实际人口数量
- 来自 v4 parser 解析的 `<workforces><workforce race="..." amount="..."/></workforces>` XML 标签

### 2. Live Flow 计算逻辑

**修改位置**: `StationProductionFlowMap.compute()` → `calculateProductionFlowsCore()`

**新增参数**:
- `ProductionFlowInput.workforceOverride?: WorkforceEntry[]`
- `ProductionFlowInput.actualWorkforceOverride?: number`
- `ProductionFlowInput.saturationOverride?: number`

**计算分支**:

```typescript
// calculateProductionFlowsInternal 中
if (workforceOverride && workforceOverride.length > 0) {
  // 直接使用 save 中的种族分布计算医疗消耗
  workforceOverride.forEach(item => {
    const raceKey = medicalConsumptionMap[item.race] ? item.race : 'default'
    const consumption = medicalConsumptionMap[raceKey]
    if (!consumption) return
    for (const [wareId, perPersonPerSecond] of Object.entries(consumption)) {
      const hourlyAmount = item.amount * perPersonPerSecond * 3600
      // 添加到 flowMap[wareId].workforceConsumption
      // contribution: { moduleId: `workforce:${item.race}`, count: item.amount, type: 'consumption', amount: -hourlyAmount }
    }
  })
} else {
  // 原有逻辑：通过 calculateWorkforceCensus 计算居住舱分配
}
```

**效率计算**:
- `actualWorkforceOverride = workforceOverride?.reduce((sum, w) => sum + w.amount, 0)`
- `saturationOverride = min(1, actualWorkforceOverride / neededWorkforce)`
- 传入 `calculateProductionFlowsCore` 作为 override 参数

### 3. Store 层修改

**位置**: `useLiveProductionStore.ts` 的 `syncLiveFlowMapForStation()`

```typescript
function syncLiveFlowMapForStation(stationId: string, deps?: StationComputeDeps): void {
  const stationEntry = archiveStationRecord.data as PlayerStationEntry
  
  // 解析 modules（已有逻辑）
  const modules: SavedModule[] = ...
  
  // 新增：解析 workforce
  const workforceOverride = stationEntry.workforces
  const actualWorkforceOverride = workforceOverride?.reduce((sum, w) => sum + w.amount, 0) ?? undefined
  
  // 计算 saturation（需要先算 needed）
  // 可选：在 compute 时自动计算 saturation
  
  liveFlowMap.compute(stationId, {
    plannedModules: modules,
    settings: liveSettings,
    lockedWares: [],
    warePriority: {},
    skipAutoFill: true,
    workforceOverride,
    actualWorkforceOverride
  }, computeDeps)
}
```

### 4. Presenter 层修改

**位置**: `useProductionDashboardPresenter.ts`

```typescript
settings: computed(() => {
  const s = store.stationState?.settings
  if (!s) return DEFAULT_DASHBOARD_SETTINGS
  
  // 当 visualMode === 'live' 且有 archive 时，强制 workforceAuto = true
  const forceAuto = store.session.visualMode === 'live' && store.context.hasArchive
  
  return {
    transportShipCapacity: s.transportShipCapacity,
    workforceAuto: forceAuto ? true : s.workforceAuto,
    manualWorkforce: s.manualWorkforce,
    useHQ: s.useHQ
  }
})
```

### 5. Dashboard UI 修改

**位置**: `StationDashboard.vue`

新增 prop:
```typescript
const props = defineProps<{
  // ...existing props
  forceWorkforceAuto?: boolean  // 新增
}>()
```

Checkbox 控制:
```vue
<label class="auto-toggle group">
  <input 
    type="checkbox" 
    :checked="forceWorkforceAuto ? true : props.settings.workforceAuto"
    :disabled="forceWorkforceAuto"
    @change="!forceWorkforceAuto && emit('updateWorkforceAuto', !props.settings.workforceAuto)"
    class="hidden"
  >
  <div class="cb" :class="{ 'cb-active': forceWorkforceAuto || props.settings.workforceAuto }">
    <div v-if="forceWorkforceAuto || props.settings.workforceAuto" class="cb-inner"></div>
  </div>
  <span class="text-[11px] font-bold italic uppercase"
    :class="(forceWorkforceAuto || props.settings.workforceAuto) ? 'text-sky-400' : 'text-slate-500'">
    {{ t('station.auto_calc') }} ({{ t('station.limit') }}: {{ formatNum(maxAllowedWorkforce) }})
  </span>
</label>
```

调用方 `LiveProductionWorkbenchView.vue` 传递:
```vue
<StationDashboard
  :modules="..."
  :settings="dashboardPresenter.props.settings.value"
  :force-workforce-auto="liveStore.session.visualMode === 'live'"
  ...
/>
```

## 边界

### In Scope

- `StationProductionFlowMap.ts` 的 interface 和 compute 方法
- `calculateProductionFlows.ts` 的 workforce consumption 计算分支
- `useLiveProductionStore.ts` 的 syncLiveFlowMapForStation
- `useProductionDashboardPresenter.ts` 的 settings computed
- `StationDashboard.vue` 的 forceWorkforceAuto prop 和 checkbox 控制
- `LiveProductionWorkbenchView.vue` 的 prop 传递

### Out of Scope

- planning 模式的 workforce 计算（保持原有逻辑）
- transit hub 的 workforce（已有 hideWorkersView=true）
- workforce 编辑功能（live 模式下不可编辑）
- 多种族混合居住舱的精确分配计算（用 override 跳过）

## 验收标准（DoD）

1. **数据集成**: 当 save archive 包含 `workforces` 数据时，live 模式下的 production flows 正确反映该 workforce 的医疗消耗
2. **Fallback**: 当 `workforces` 为空或不存在时，live 模式行为与之前一致（使用居住舱容量计算）
3. **UI 状态**: live 模式下 Dashboard 的 workforce checkbox 固定为 checked 且 disabled
4. **统计正确**: `actualWorkforce` 和 `currentEfficiency` 基于真实 workforce 数据计算
5. **Contribution Trace**: workforce consumption 的 contribution 使用 `workforce:${race}` 作为 moduleId，可追溯

## 未决项

无