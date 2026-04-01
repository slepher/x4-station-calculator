# Spec: User Save Detail (Delta)

## 概述

本 spec 是 `save-import` change 的增量补充，专注于 SaveDetailPanel.vue 的 Tab 结构重构。

## 组件规格

### SaveDetailPanel.vue

**职责**：展示选中存档的详细数据，按类型 Tab 分类显示

**Props**：
- `archive: SaveArchive | null` - 选中的存档数据

**内部状态**：
- `activeTab: string` - 当前激活的 Tab key，默认 `'player-stations'`

**Tab 定义**：

```typescript
const tabs: ViewTabItem[] = [
  { key: 'player-stations', label: t('save_import.tab_player_stations') },
  { key: 'npc-stations', label: t('save_import.tab_npc_stations') },
  { key: 'abandoned-ships', label: t('save_import.tab_abandoned_ships') },
  { key: 'datavaults', label: t('save_import.tab_datavaults') },
  { key: 'erlking-vaults', label: t('save_import.tab_erlking_vaults') },
]
```

**数据过滤与分组**：

每个 Tab 需要计算：
1. 从 `archive.sectors` 提取符合条件的数据
2. 按 sector 分组
3. 排序（sector 按 name 排序）

```typescript
// player-stations: owner === 'player'
// npc-stations: owner !== 'player' && is_headquarter === true
// abandoned-ships: 全部
// datavaults: 全部
// erlking-vaults: 全部
```

**条目显示格式**：

| Tab | 条目字段 | 格式 |
|-----|---------|------|
| player-stations | code, coords, hq | `code + (x_km, z_km) + [HQ]` |
| npc-stations | owner, coords, sector | `owner + (x_km, z_km) + sector_name` |
| abandoned-ships | class, coords, sector | `class + (x_km, z_km) + sector_name` |
| datavaults | coords, marks, sector | `(x_km, z_km) + [蓝图][货物][信号] + sector_name` |
| erlking-vaults | coords, marks, sector | 同 datavaults |

**空状态**：
- `archive === null` 时显示提示信息
- Tab 内无数据时显示空提示

## UI 规格

### ViewTabUI 集成

- 组件：`<ViewTabUI v-model="activeTab" :views="tabs" ui-key="save-detail" color-style="sky" />`
- 位置：标题栏右侧，与 player-name 同行

### 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│ detail-header                                                │
│ ┌──────────────────┐  ┌─────────────────────────────────┐   │
│ │ player-name      │  │ ViewTabUI (5 tabs)              │   │
│ └──────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
│ tab-content                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ sector-group                                             │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ sector-header: sector_name + count                  │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │ item-list                                                │ │
│ │ ┌── item-row ──┐                                        │ │
│ │ └── item-row ──┐                                        │ │
│ │ └───────────────────────────────────────────────────────┘ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 样式规格

沿用现有样式基础，新增：
- `.tab-content` - Tab 内容容器
- `.sector-group` - Sector 分组容器
- `.item-marks` - Datavault 特殊标记容器
- `.mark-badge` - 单个标记样式

## i18n 规格

新增键：

| Key | 中文 | 英文 |
|-----|------|------|
| `save_import.tab_player_stations` | 用户空间站 | Player Stations |
| `save_import.tab_npc_stations` | NPC据点 | NPC Stations |
| `save_import.tab_abandoned_ships` | 弃船 | Abandoned Ships |
| `save_import.tab_datavaults` | 数据保险箱 | Datavaults |
| `save_import.tab_erlking_vaults` | 妖王保险箱 | Erlking Vaults |
| `save_import.hq_badge` | HQ | HQ |
| `save_import.has_blueprints` | 蓝图 | Blueprints |
| `save_import.has_wares` | 货物 | Wares |
| `save_import.has_signalleak` | 信号 | Signal |
| `save_import.empty_tab` | 无数据 | No data |