# LiveStationToolbar 设计文档

## Architecture

### 组件位置

`src/components/empire/context_toolbar/LiveStationToolbar.vue`

### 数据流

```
LiveProductionWorkbenchView.vue
  ↓ props
LiveStationToolbar.vue
  ↓ computed
模式状态 (local ref or from store)
  ↓ 条件渲染
三组控件
```

### Props 变更

新增 props：

| Prop | 类型 | 说明 |
|-----|------|------|
| `stationCode` | `string` | 存档 station 的 code |
| `sectorResources` | `string[]` | 存档 sector 的 resources 列表 |
| `sectorSunlight` | `number` | 存档 sector 的 sunlight 值 |
| `hasBindingStation` | `boolean` | 是否存在 bindingStation 规划 |
| `hasSaveStation` | `boolean` | 是否存在 saveStation 数据 |

移除 props：

| Prop | 说明 |
|-----|------|
| `station.type` | 站点类型 |
| `station.count` | 站点数量 |
| `settings.transportMinutes` | 运输时间 |

### Emits 变更

新增 emits：

| Emit | 说明 |
|-----|------|
| `toggleMode` | 模式切换事件 |

保留 emits（仅规划模式触发）：

| Emit | 说明 |
|-----|------|
| `updateRacePreference` | 更新偏好种族 |
| `updateWorkforce` | 更新工人运算 |
| `updateShowEmpireGaps` | 更新显示缺口 |

移除 emits：

| Emit | 说明 |
|-----|------|
| `updateStationType` | 站点类型 |
| `updateStationCount` | 站点数量 |
| `toggleMineral` | 星区资源选择 |
| `updateSunlight` | 光伏效率 |
| `updateTransportMinutes` | 运输时间 |

## Store 新增 Getter

### useLiveProductionStore 新增两个 getter

| Getter | 返回类型 | 说明 |
|-------|---------|------|
| `getBindingStation()` | `BindingStationPlan \| null` | 当前活动站点对应的规划数据 |
| `getArchiveStation()` | `PlayerStationEntry \| null` | 当前活动站点对应的存档数据 |

**实现逻辑**:

```typescript
function getBindingStation(): BindingStationPlan | null {
  const stationId = activeStationId.value
  if (!stationId) return null
  
  const parsed = parseBindingStationId(stationId)
  if (!parsed) return null
  
  const binding = activeBinding.value
  if (!binding) return null
  
  // 通过 plan.id 或 saveStationCode 查找
  return binding.stationPlans.find(plan => 
    plan.id === parsed.planId || plan.saveStationCode === parsed.saveStationCode
  ) || null
}

function getArchiveStation(): PlayerStationEntry | null {
  const stationId = activeStationId.value
  if (!stationId) return null
  
  const parsed = parseBindingStationId(stationId)
  if (!parsed || parsed.kind !== 'derived') return null
  
  const code = parsed.saveStationCode
  const record = playerStationRecords.value.find(r => r.code === code && r.type === 'station')
  return record?.data as PlayerStationEntry || null
}
```

**数据流**:

```
LiveProductionWorkbenchView.vue
  ↓ 调用 liveStore.getBindingStation()
  ↓ 调用 liveStore.getArchiveStation()
  ↓ 计算属性
props 数据传递给 LiveStationToolbar
```

### Getter 与 Props 映射

| Toolbar Prop | 数据来源 |
|-------------|---------|
| `hasBindingStation` | `getBindingStation() !== null` |
| `hasSaveStation` | `getArchiveStation() !== null` |
| `stationCode` | `getArchiveStation()?.code` |
| `sectorResources` | `getSectorResources(getArchiveStation()?.sectorMacro)` |
| `sectorSunlight` | `getSectorSunlight(getArchiveStation()?.sectorMacro)` |

### Sector 数据查询

需要从 map 数据中查询 sector 的 resources 和 sunlight：

```typescript
// 在 LiveProductionWorkbenchView 或 helper 函数中
function getSectorResources(sectorMacro: string | undefined): string[] {
  if (!sectorMacro) return []
  const sector = gameData.sectorsMap[sectorMacro]
  return sector?.resources || []
}

function getSectorSunlight(sectorMacro: string | undefined): number {
  if (!sectorMacro) return 100
  const sector = gameData.sectorsMap[sectorMacro]
  return sector?.sunlight ?? 100
}
```

## Decisions

### 1. 模式状态管理

**决策**: 模式状态存储在组件内部 `ref`，不依赖 store。

**原因**:
- 模式切换仅影响 toolbar UI 显示，不影响 store 数据
- 切换后规划控件的编辑操作仍通过 emits 传递到 store
- 简化实现，避免引入额外的 store 状态

### 2. 初始模式计算

**决策**: 通过 `hasBindingStation` 和 `hasSaveStation` props 计算初始模式。

```typescript
const initialMode = computed(() => {
  if (props.hasBindingStation && props.hasSaveStation) return 'planning'
  if (props.hasBindingStation && !props.hasSaveStation) return 'planning'
  if (!props.hasBindingStation && props.hasSaveStation) return 'live'
  return 'planning' // fallback
})

const canToggle = computed(() => {
  return props.hasBindingStation && props.hasSaveStation
    || !props.hasBindingStation && props.hasSaveStation
})
```

### 3. 星区资源 Popover

**决策**: 使用只读 popover 展示资源列表，无 checkbox。

**原因**:
- 资源来源于存档 sector，不可修改
- 与 Blueprint toolbar 的可编辑 popover 区分
- 样式使用灰色背景表示只读状态

### 4. 光伏效率展示

**决策**: 使用静态数值展示，无输入控件。

**原因**:
- 光伏效率来源于存档 sector.sunlight
- 存档中的光照是固定值，不可修改
- 样式使用 count-pill 样式（静态文本容器）

### 5. 规划控件条件渲染

**决策**: 使用 `v-if="mode === 'planning'"` 控制显示。

**原因**:
- 实时模式下隐藏规划控件，避免用户误操作
- 规划模式下正常显示和编辑
- 减少界面复杂度

## File Changes

### 新增文件

无

### 修改文件

| 文件 | 变更 |
|-----|------|
| `src/components/empire/context_toolbar/LiveStationToolbar.vue` | 重构 props/emits、UI 结构、模式切换逻辑 |
| `src/components/empire/LiveProductionWorkbenchView.vue` | 传递新 props（stationCode, sectorResources, sectorSunlight, hasBindingStation, hasSaveStation） |

### 删除代码

- 移除站点类型、站点数量、运输时间相关代码
- 移除星区资源 checkbox popover
- 移除光伏效率输入控件
- 移除 liveData popover 相关代码（后续功能）