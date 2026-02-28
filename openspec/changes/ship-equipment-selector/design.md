# 设计说明：船只配装装备选择器

## 架构设计

### 组件边界

```
ShipBuildView
├── ShipBuildPanelFit
│   └── ShipBuildFitCandidate  # 槽位、展开 picker、过滤、分页、确认主逻辑
├── ShipBuildPanelStats
└── ShipBuildPanelMaterials     # 由 showMaterial 控制显隐
```

当前实现以 `ShipBuildFitCandidate.vue` 为主承载，未走独立 picker 子组件装配。

### 关键状态

| 状态 | 位置 | 作用 |
|------|------|------|
| `showMaterial` | `ShipBuildView.vue` | picker 打开时隐藏材料面板，关闭时恢复 |
| `expandedSlotKey` | `ShipBuildFitCandidate.vue` | 当前展开槽位 |
| `pendingExpandedConnectionKeys` | `ShipBuildFitCandidate.vue` | 模式/分组切换时的展开锚点重映射 |
| `selectedRaceIds/selectedMkIds/selectedTagIds` | `ShipBuildFitCandidate.vue` | 三组过滤状态 |
| `highlightedEquipmentId` | `ShipBuildFitCandidate.vue` | 当前候选高亮项（确认前） |

## 核心行为

### 1. 候选数分流

- `candidateCount = 0`：显示空槽。
- `candidateCount = 1`：显示唯一候选名，点击执行装备/取消切换。
- `candidateCount > 1`：点击后 `openPicker(target.key)`。

核心逻辑（简化）：

```ts
if (isSingleCandidate(target)) {
  const candidateId = target.options[0]?.id || null
  const selectedId = selectedForConnectionKeys(target.connectionKeys)
  const nextId = selectedId === candidateId ? null : candidateId
  target.connectionKeys.forEach((connectionKey) => {
    emit('assign-connection', { connectionKey, equipmentId: nextId })
  })
} else {
  openPicker(target.key)
}
```

### 2. 展开态三行布局

- Row1: `mode-tabs` + `picker-confirm/cancel`，按钮高度 `25.6px`。
- Row2: `group-tabs` + `pager`，行高 `25.6px`。
- Row3: 左 `compatibility-box(filter-block)` + `slot-wall`；右 `candidate-list`。

样式上通过：
- `.picker-grid-row-compact { h-[25.6px] }`
- `.mode-tab-tall { h-[25.6px] }`
- `cancel` 按钮 `mr-1`

### 3. 过滤来源与计数

- Race/MK: 来自 `pickerOptions` 实际候选。
- Tag: `tagDefs = ['standard','advanced','xenon','mining','missile','highpower']`，再与 `availableTagIds` 交集，文本使用 `translateSlotTag`。
- 计数：每一组在“其他两组已过滤”结果上统计。

### 4. 展开态交互策略

- `canSwitchToGroupInCurrentState = props.canSwitchToGroup || isPickerLayout`。
- 展开时允许 `connection <-> group` 切换。
- 展开时允许 group/tab 切换，且保持展开。
- 点击 slot.type 会触发 `closePicker()`。

### 5. 展开锚点重映射

模式或 tab 切换前缓存当前展开项的 `connectionKeys`：

```ts
pendingExpandedConnectionKeys.value = [...current.connectionKeys]
```

`slotTargets` 变更后按锚点查找新目标并恢复展开：

```ts
const anchor = new Set(pendingExpandedConnectionKeys.value)
const mapped = slotTargets.value.find((target) => target.connectionKeys.some((key) => anchor.has(key)))
expandedSlotKey.value = mapped?.key || slotTargets.value[0]?.key || null
```

### 6. 关闭回退

`closePicker()` 中执行：
- 关闭展开。
- 通知父层恢复 `showMaterial`。
- 若当前为 `group` 且 `!props.canSwitchToGroup`，发出 `update:mode('connection')` 回退。

`ShipBuildView.setFitMode` 仅在关闭态（`showMaterial = true`）阻止非法切换到 group；展开态不阻止。

### 7. 确认与清理

确认时按 `pickerTarget.connectionKeys` 批量 emit `assign-connection`，并关闭 picker。
后续清理由 store 负责：`equipment_id` 与 `shield.equipment_id` 同空时移除 group。

## 依赖文件

- `src/components/ShipBuildFitCandidate.vue`
- `src/components/ShipBuildView.vue`
- `src/store/useShipBuildStore.ts`
- `src/assets/x4_game_data/8.0-Diplomacy/data/slot_tags.json`
