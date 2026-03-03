# 设计说明：船只配装装备选择器

## 架构设计

### 组件边界

```
ShipBuildView
├── ShipBuildPanelFit      # 配装主逻辑（已内聚）
├── ShipBuildPanelStats
└── ShipBuildPanelMaterials
```

`ShipBuildFitCandidate.vue` 已删除，原逻辑迁入 `ShipBuildPanelFit.vue`。

### 状态归属

| 状态 | 位置 | 说明 |
|------|------|------|
| `fitMode` | `ShipBuildPanelFit.vue` | 本地模式切换（connection/group） |
| `expandedSlotKey` | `ShipBuildPanelFit.vue` | 当前展开槽位 |
| `pendingExpandedConnectionKeys` | `ShipBuildPanelFit.vue` | 切换锚点映射 |
| `selectedRaceIds/selectedMkIds/selectedTagIds` | `ShipBuildPanelFit.vue` | 过滤器选择 |
| `draftCountByTarget` | `ShipBuildPanelFit.vue` | 拖动实时阶段显示数量草稿 |
| `showMaterial` | `ShipBuildView.vue` | picker 开关联动 materials 显隐 |

## 数据流

### 1. PanelFit 内部构建展示数据

`ShipBuildPanelFit` 直接读取 store 原始状态（`selectedShip/blueprint/mockTagPatch`），在本地计算：
- `connectionRows`
- `groupRows`
- `selectedByConnection`

这三项不再由 `ShipBuildView` 透传，不再作为 store 对外 return 字段。

### 2. 赋值调用

配装赋值由 `ShipBuildPanelFit` 直接调用 store 的 `applyConnectionAssignment`，不再经过 `ShipBuildView` 事件转发。

数量提交由 `ShipBuildPanelFit` 调用 store 的 `setConnectionAssignmentCount`，用于“仅改数量不改装备 ID”的场景。

## 核心逻辑

### 1. 单候选点击补满语义

```ts
const shouldFillToFullInGroup =
  fitMode.value === 'group' &&
  selectedId === candidateId &&
  target.count < target.totalCount

const nextId = shouldFillToFullInGroup
  ? candidateId
  : selectedId === candidateId ? null : candidateId
```

- 简化模式下“已选但未满”点击会补满。
- 满数量点击仍可清空。

### 2. 计数计算修正

标准模式 slot target 的 `count` 改为基于 `selectedCountForConnectionKeys(...)`，确保清空后显示 `0/1`。

### 3. 展开态列宽防抖

使用纯 CSS 固定第一列宽度关系（不使用 JS 存宽）：

```css
.picker-grid-row {
  grid-template-columns: minmax(0, calc(50% - 4rem)) minmax(0, 1fr);
}
```

目的：展开时第一列视觉宽度稳定，避免抖动。

### 4. Race 标签多行

当 `raceTags.length > 3`，RACE 标签容器启用两行网格布局；否则保持单行流式布局。

### 5. 槽位数量拖动条与二阶段写回

- UI 组件：`X4DualPhaseRangeSlider`（`src/components/common/X4DualPhaseRangeSlider.vue`）
- 接入方式：每个槽位使用 `slot-stack` 包裹，拖动条位于 `slot-row` 上方，宽度 `w-full` 跟随槽位。
- 交互分层：
  - `@update:model-value` -> `handleCountSliderRealtime`：仅更新 `draftCountByTarget`。
  - `@commit` -> `handleCountSliderCommit`：一次性写回蓝图。
- 标准模式：直接按 connectionKey 提交数量。
- 简化模式：先按 connection capacity 分配（`distributeCountByCapacity`），再逐 connection 一次性提交。
- 步进规则：
  - `connection` 模式：`step=1`
  - `group` 模式：`step=Math.max(1, target.totalCount)`

### 6. 蓝图 `count=0` 保留与计算排除

- store `setConnectionAssignmentCount` 支持 `count=0`，不会移除已选装备 ID。
- `ShipBuildPanelMaterials` 聚合时过滤 `count<=0` 的主装备与挂载护盾。
- `ShipBuildPanelStats` 在护盾、引擎、推进器、武器、炮塔统计中统一过滤 `count<=0`，避免 `count || 1` 误计入。

## 已移除逻辑

- 冲突守卫禁止切到 group。
- picker 关闭后强制回退到 connection。
- `ShipBuildFitCandidate` 组件及其事件链。
- `ShipBuildView` 对 `mode/rows/selectedByConnection` 的透传。

## 依赖文件

- `src/components/ship-build/ShipBuildPanelFit.vue`
- `src/components/common/X4DualPhaseRangeSlider.vue`
- `src/components/ShipBuildView.vue`
- `src/store/useShipBuildStore.ts`
- `src/components/ship-build/ShipBuildPanelStats.vue`
- `src/components/ship-build/ShipBuildPanelMaterials.vue`
- `src/assets/x4_game_data/8.0-Diplomacy/data/slot_tags.json`
- `src/assets/x4_game_data/8.0-Diplomacy/data/equipments.json`
