# Design: User Save Detail

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     SaveDetailPanel                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ detail-header                                             ││
│  │ player-name          ViewTabUI (5 tabs)                  ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ tab-content                                               ││
│  │  ┌─────────────────────────────────────────────────────┐ ││
│  │  │ sector-group                                         │ ││
│  │  │  sector-header: name + count                        │ ││
│  │  │  item-list                                           │ ││
│  │  │   - item-row: 条目显示                               │ ││
│  │  └─────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Key Decisions

### Decision 1: Tab 状态管理

**问题**: Tab 切换状态应该放在哪里？

**方案**: 在 SaveDetailPanel 组件内部使用 `ref` 管理

**实现细节**:
```typescript
const activeTab = ref<string>('player-stations')
```

**理由**:
- Tab 切换是局部 UI 状态，不需要持久化
- 不影响其他组件，不需要提升到 store

### Decision 2: 数据过滤策略

**问题**: 如何高效过滤和分组数据？

**方案**: 使用 computed 计算属性，按 Tab 分组

**实现细节**:
```typescript
const tabData = computed(() => {
  if (!props.archive) return {}
  
  const sectors = props.archive.sectors
  
  return {
    'player-stations': groupBySector(filterStations(sectors, s => s.owner === 'player')),
    'npc-stations': groupBySector(filterStations(sectors, s => s.owner !== 'player' && s.is_headquarter)),
    'abandoned-ships': groupBySector(extractShips(sectors)),
    'datavaults': groupBySector(extractDatavaults(sectors)),
    'erlking-vaults': groupBySector(extractErlkingVaults(sectors)),
  }
})
```

**性能考虑**:
- computed 会缓存结果，仅在 archive 变化时重新计算
- 每个 Tab 数据独立计算，切换时无额外开销

### Decision 3: Sector 分组结构

**问题**: 分组数据结构如何定义？

**方案**: 使用统一的分组结构

**实现细节**:
```typescript
interface SectorGroup<T> {
  macro: string
  name: string
  items: T[]
}

function groupBySector<T>(
  extractor: (sector: SectorData) => T[],
  sectors: Record<string, SectorData>
): SectorGroup<T>[] {
  return Object.entries(sectors)
    .map(([macro, data]) => ({
      macro,
      name: data.name,
      items: extractor(data)
    }))
    .filter(group => group.items.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
}
```

### Decision 4: 坐标格式化

**问题**: 坐标显示格式？

**方案**: km 单位，保留一位小数

**实现细节**:
```typescript
function formatCoord(value: number): string {
  return (value / 1000).toFixed(1) + 'km'
}

// 显示: (12.3km, 45.6km)
function formatCoords(x: number, z: number): string {
  return `(${formatCoord(x)}, ${formatCoord(z)})`
}
```

### Decision 5: 特殊标记显示

**问题**: Datavault 的 has_* 标记如何显示？

**方案**: 使用图标 + 文字标签

**实现细节**:
```vue
<div class="item-marks">
  <span v-if="vault.has_blueprints" class="mark-badge">
    {{ t('save_import.has_blueprints') }}
  </span>
  <span v-if="vault.has_wares" class="mark-badge">
    {{ t('save_import.has_wares') }}
  </span>
  <span v-if="vault.has_signalleak" class="mark-badge">
    {{ t('save_import.has_signalleak') }}
  </span>
</div>
```

### Decision 6: ViewTabUI 集成

**问题**: 如何正确集成 ViewTabUI？

**方案**: 使用 v-model 双向绑定

**实现细节**:
```vue
<ViewTabUI
  v-model="activeTab"
  :views="tabs"
  ui-key="save-detail"
  color-style="sky"
/>
```

**tabs 定义**:
```typescript
const tabs = computed(() => [
  { key: 'player-stations', label: t('save_import.tab_player_stations') },
  { key: 'npc-stations', label: t('save_import.tab_npc_stations') },
  { key: 'abandoned-ships', label: t('save_import.tab_abandoned_ships') },
  { key: 'datavaults', label: t('save_import.tab_datavaults') },
  { key: 'erlking-vaults', label: t('save_import.tab_erlking_vaults') },
])
```

## File Structure

```
src/components/save/
└── SaveDetailPanel.vue    # 重构，新增 Tab 结构
```

## Integration Points

无新增集成点，仅重构现有组件。

## Error Handling

- `archive === null`: 显示空状态提示
- Tab 内无数据: 显示 "无数据" 提示
- Sector 无数据: 不显示该 sector 分组