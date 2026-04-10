# production-ui Spec

## 概述

量化生产界面（ProductionWorkbenchView）在 `save-binding` production source 下需要适配用户交互体验。

## 状态管理

### productionSource

```ts
// useEmpireStore
productionSource: Ref<'empire' | 'save-binding'>

// 默认值
productionSource = 'empire'

// 切换时机
switchToBinding(gameGuid) // 进入 binding 时切换
switchToEmpire()          // 返回 empire 时切换
```

### isDirty 合并

```ts
// useEmpireStore
const isDirty = computed(() => {
  if (productionSource.value === 'save-binding') {
    return saveBindingStore.isDirty
  }
  // empire 模式
  return serializeEmpireForDirtyCheck() !== lastSavedSnapshot.value
})
```

### saveCurrentSource

```ts
function saveCurrentSource() {
  if (productionSource.value === 'save-binding') {
    saveBindingStore.saveBinding()
  } else {
    saveEmpire()
  }
}
```

## UI 组件行为

### StationPlanningPanel

**binding 模式特有元素**：

1. **保存绑定按钮**：
   - 条件：`productionSource === 'save-binding' && saveBindingStore.isDirty`
   - 文案：`t('binding.save_binding')`
   - 操作：调用 `saveBindingStore.saveBinding()`

2. **Dirty 指示器**：
   - 显示位置：标题栏右侧
   - 条件：`saveBindingStore.isDirty`
   - 文案：`t('binding.unsaved_changes')`

3. **蓝图导入**：
   - 目标：`BindingStationPlan` 的 modules/settings
   - 操作：`saveBindingStore.updateStationPlan(gameGuid, planId, { modules, settings })`
   - 不自动保存

### StationTabBar

**binding 模式显示**：

- 星区列表 = binding groups
- 空间站列表 = derived stations (covered save stations + virtual stations)
- 创建按钮创建虚拟空间站（无 `saveStationCode`）

**创建虚拟空间站**：

```ts
// 创建时选择 group
function createVirtualStation(groupId: string | null, name: string, type: StationType) {
  const binding = saveBindingStore.activeBinding
  if (!binding) return null
  return saveBindingStore.createStationPlanInGroup(binding.gameGuid, groupId, name, type)
}
```

**删除行为差异**：

- empire 模式：删除 station，从 empire 移除
- binding 模式：
  - 有 plan：删除 `BindingStationPlan`
  - 无 plan（covered save station）：仅取消选中，station 仍存在

### StationDashboard

**保存按钮行为**：

```ts
function handleSave() {
  if (empireStore.productionSource === 'save-binding') {
    saveBindingStore.saveBinding()
  } else {
    empireStore.saveEmpire()
  }
}
```

### ProductionWorkbenchView

**数据源切换**：

- empire 按钮：调用 `switchToEmpire()`
- save-binding 按钮：当前禁用（需通过 binding 入口进入）

**binding 模式禁用功能**：

- 星区链接（sectorLinks）- binding 不支持
- Transit hub 创建 - binding 通过 group.tradeStation 管理

## useStationStore 路由

### updateModules

```ts
function updateModules(stationId: string, modules: SavedModule[]) {
  const source = empireStore.productionSource
  
  if (source === 'save-binding') {
    // 从 stationId 提取 planId
    const planId = extractPlanIdFromStationId(stationId)
    const binding = saveBindingStore.activeBinding
    if (binding && planId) {
      saveBindingStore.updateStationPlan(binding.gameGuid, planId, { modules })
    }
  } else {
    // empire 模式：直接更新并保存
    applyAndRecompute((id) => {
      stationStateMap.patch(id, { plannedModules: modules })
    })
    empireStore.saveEmpire()
  }
}
```

### updateSettings

```ts
function updateSetting<K extends keyof StationSettings>(key: K, value: StationSettings[K]) {
  const source = empireStore.productionSource
  
  if (source === 'save-binding') {
    const stationId = getActiveContext()?.station?.id
    const planId = extractPlanIdFromStationId(stationId)
    const binding = saveBindingStore.activeBinding
    if (binding && planId) {
      const current = stationStateMap.get(stationId)?.settings || DEFAULT_STATION_SETTINGS
      const newSettings = { ...current, [key]: value }
      saveBindingStore.updateStationPlan(binding.gameGuid, planId, { settings: newSettings })
      // 同时更新 StationStateMap 以触发 recompute
      stationStateMap.patch(stationId, { settings: newSettings })
      stationStateMap.recompute(stationId, getComputeDeps())
    }
  } else {
    // empire 模式...
  }
}
```

## 辅助函数

### extractPlanIdFromStationId

```ts
function extractPlanIdFromStationId(stationId: string): string | null {
  // 格式：__save_binding__<gameGuid>__<planId>
  const parts = stationId.split('__')
  if (parts.length >= 4 && parts[2] === 'save_binding') {
    return parts[3]
  }
  // 格式：__save_binding_derived__<gameGuid>__<code>
  // 无 plan，返回 null
  return null
}
```

## 测试要点

1. **编辑路由**：binding 模式编辑更新 draft，不自动保存
2. **dirty 状态**：编辑后 binding.isDirty = true
3. **保存绑定**：点击保存按钮后数据持久化，isDirty = false
4. **切换保持**：切换 empire 后 binding draft 不丢失
5. **恢复编辑**：再次进入同一 binding，恢复上次 draft