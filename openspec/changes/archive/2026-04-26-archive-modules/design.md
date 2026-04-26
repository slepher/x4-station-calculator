# Archive Modules Display Design

## Architecture

### 组件结构

在 `LiveProductionWorkbenchView.vue` 中，左侧 col-span-3 区域改为使用一个包装组件：

```
LiveProductionWorkbenchView.vue
└── col-span-12 lg:col-span-3
    └── StationPlanningPanelWrapper.vue (新增)
        ├── ViewTabUI.vue (条件渲染)
        │   ├── Plan tab → StationPlanningPanel
        │   └── Archive tab → ArchiveModuleList.vue (新增)
        └── StationPlanningPanel.vue (无 save station 时直接显示)
```

### 新增组件

1. **StationPlanningPanelWrapper.vue**
   - 负责判断是否为 save station
   - 管理 tab 状态
   - 条件渲染 ViewTabUI 或直接渲染 StationPlanningPanel

2. **ArchiveModuleList.vue**
   - 显示存档模块列表
   - 按分组渲染模块项
   - 处理空状态

## Decisions

### 1. Save Station 判断策略

**决策**：使用 `parseBindingStationId(activeStation.id)` 解析，若 `kind === 'derived'` 则为 save station。

**理由**：
- derived 类型 stationId 格式为 `__save_binding_derived__${gameGuid}__${saveStationCode}`
- plan 类型 stationId 格式为 `__save_binding__${gameGuid}__${planId}`
- 可直接区分 station 来源

**备选方案**：通过 `saveBindingStore.getStationPlan()` 查询 `saveStationCode` 字段。两者可结合使用。

### 2. Tab 状态管理

**决策**：使用组件内 `ref` 管理，不持久化到 store。

**理由**：
- Tab 状态是 UI 临时状态，不需要跨会话持久化
- 每次切换 station 时重置为默认 tab（plan）
- 实现简单，无额外 store 状态

### 3. 模块数据获取

**决策**：在 wrapper 组件中使用 `computed` 从 `liveStore.playerStationRecords` 获取。

**数据流**：
1. `activeStation.id` → `parseBindingStationId()`
2. 若 derived，获取 `saveStationCode`
3. `playerStationRecords.find(r => r.code === saveStationCode)`
4. `record.data.modules` → `AggregatedStationModule[]`

### 4. 模块分组与排序

**决策**：复用 `searchModule.ts` 中的排序函数。

**排序逻辑**：
- 分组排序：`compareModuleGroupsByPickerOrder(a, b, localizedModuleGroupsMap)`
- 模块排序：`compareModulesByPickerOrder(a, b, localizedModuleGroupsMap)`

### 5. i18n 实现

**决策**：直接使用 `useGameDataStore` 提供的 localized maps。

**数据来源**：
- `gameData.localizedModulesMap[module_id].localeName`
- `gameData.localizedModuleGroupsMap[group].localeName`

**Tab labels**：添加到 `locales/en.json` 和 `locales/zh-CN.json`：
```json
// en.json
{
  "planning": {
    "tab_plan": "Plan",
    "tab_archive": "Archive"
  }
}

// zh-CN.json
{
  "planning": {
    "tab_plan": "规划",
    "tab_archive": "存档"
  }
}
```

### 6. 空状态处理

**决策**：显示简洁提示文本，不显示详细说明。

**显示文本**：
- zh-CN: "存档中无模块数据"
- en: "No modules in save archive"

## Component Props Design

### StationPlanningPanelWrapper.vue

```typescript
interface Props {
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  enforceDlcActivation: boolean
  activeStationId: string | null  // 用于判断是否为 save station
}

interface Emits {
  updatePlannedModules: [modules: SavedModule[]]
}
```

### ArchiveModuleList.vue

```typescript
interface Props {
  modules: AggregatedStationModule[]  // 已映射 module_id/group 的模块列表
  modulesMap: Record<string, LocalizedX4Module>
  moduleGroupsMap: Record<string, LocalizedX4ModuleGroup>
}
```

## Styling

参照 `StationModulePicker.vue` 的 `.results-popover` 样式：

- 分组标题：`.group-header` 样式
- 模块项：`.result-item` 样式
- 颜色指示器：`.color-indicator` 样式
- 模块名称：`.label` 样式

ViewTabUI 使用 `colorStyle: 'sky'`（与 wareflows dashboard 一致）。

## Edge Cases

### 1. 存档 modules 未映射 module_id

`AggregatedStationModule` 可能只有 `ref` 没有 `module_id`（未经 enrichModulesWithGameData 处理）。

**处理**：在 ArchiveModuleList 中使用 `modulesByMacroId[ref]` 补充映射。

### 2. module_id 在 localizedModulesMap 中不存在

**处理**：fallback 显示 `module_id` 或 `ref` 作为名称。

### 3. playerStationRecords 为空

**处理**：视为无 save station，直接显示 StationPlanningPanel（无 tab）。