# UI 知识库：船只配装装备选择器

## 代码与数据来源

- 核心实现：`src/components/ship-build/ShipBuildPanelFit.vue`
- 拖动条组件：`src/components/common/X4DualPhaseRangeSlider.vue`
- 蓝图写入与清理：`src/store/useShipBuildStore.ts`
- 统计与材料：
  - `src/components/ship-build/ShipBuildPanelStats.vue`
  - `src/components/ship-build/ShipBuildPanelMaterials.vue`
- 数据源：
  - `src/assets/x4_game_data/8.0-Diplomacy/data/ships.json`
  - `src/assets/x4_game_data/8.0-Diplomacy/data/equipments.json`
  - `src/assets/x4_game_data/8.0-Diplomacy/data/equipment_types.json`
  - `src/assets/x4_game_data/8.0-Diplomacy/data/slot_tags.json`

## 当前架构事实

### 1. 组件关系
- `ShipBuildFitCandidate.vue` 已删除。
- 配装交互完全在 `ShipBuildPanelFit.vue` 内完成。
- 拖动条已抽取为通用组件 `X4DualPhaseRangeSlider`，当前由 `ShipBuildPanelFit` 接入。

### 2. 状态归属
- `fitMode` 在 `PanelFit` 本地管理。
- `connectionRows/groupRows/selectedByConnection` 在 `PanelFit` 本地计算。
- `draftCountByTarget` 在 `PanelFit` 本地维护拖动中的显示值。
- `ShipBuildView` 只保留 `showMaterial` 与 `picker-open-change` 联动。

### 3. 调用链
- 槽位点击/确认时，`PanelFit` 直接调用 store `applyConnectionAssignment`。
- 拖动提交时，`PanelFit` 调用 store `setConnectionAssignmentCount`，仅更新数量，不改装备 ID。

## 交互行为事实

### 1. 单候选点击
- 默认：未选点击装备；已选满数量点击清空。
- 简化模式特例：
  - 条件：`fitMode='group' && selectedId===candidateId && count<totalCount`
  - 行为：点击补齐到满数量，不清空。

### 2. 拖动条行为
- 每个槽位上方均有拖动条，宽度与槽位按钮一致。
- 拖动两阶段：
  - 实时阶段：只更新显示数量（draft）。
  - 提交阶段：鼠标松开后一次性写回蓝图。
- 简化模式步进：`step = target.totalCount`。
- 当前样式事实：
  - 拖动条可见轨道高度：`8px`
  - 未填充轨道背景：`bg-slate-800`

### 3. 数量为 0 的语义
- 蓝图数量允许 `0`，不删除装备 ID。
- `stats/material` 计算时过滤 `count<=0` 项，不计入贡献。

### 4. 展开态布局与过滤
- 三行两列结构保持。
- 第一列宽度公式：`minmax(0, calc(50% - 4rem))`。
- Race/MK：候选动态集合。
- Tag：`standard/advanced/xenon/mining/missile/highpower` + i18n。
- `raceTags.length > 3` 时，RACE 标签区为两行。

## 大阪路径与证据

### 1. 大阪 ID 与可达路径
- 船体 ID：`ship_ter_l_destroyer_01_a`（`ships.json`）
- UI 路径：
  - `data-testid=ship-build-list`
  - 点击文本 `Osaka/大阪` 的 `ship-build-ship-name`
  - 到位：`data-testid=ship-build-selection` 可见，`selectedShipId` 为大阪 ID

### 2. 固定槽位证据（用于测试）
- `ship_ter_l_destroyer_01_a::weapon::3::0` -> 候选 `1`
- `ship_ter_l_destroyer_01_a::weapon::3::1` -> 候选 `1`
- `ship_ter_l_destroyer_01_a::turret::4::3` -> 候选 `35`

## 与 test_tasks.md 同步映射

### 1. Chapter 2 状态与切换
- 状态 `osaka-selected`：已选中大阪并展示 `ship-build-selection`。
- 状态 `osaka-picker-open-turret-4-3`：`slot-ship_ter_l_destroyer_01_a::turret::4::3` 打开 `equipment-picker`。
- 切换 `osaka-picker-open-turret-4-3 -> osaka-picker-open-group-anchor-mapped`：展开态切简化后保持 picker 展开且锚点映射稳定。
- 状态 `osaka-slot-slider-visible`：目标槽位上方拖动条可见且宽度对齐。
- 切换 `osaka-slot-slider-dragging -> osaka-slot-slider-committed`：拖动阶段仅显示变化，提交阶段一次性落蓝图。

### 2. Chapter 3 场景定位
- `Case: 拖动条可见高度为 8px`：读取轨道高度样式。
- `Case: 拖动条未填充背景色保持默认`：校验轨道未填充背景样式。
- `Case: 简化模式步进等于聚合总数`：读取 `step` 与 `totalCount` 对齐关系。
- `Case: 数量设为 0 后不删装备且不计入统计材料`：校验蓝图保留与计算排除双语义。

### 3. Chapter 4 Bug 场景
- `BUG-001` 可观察失败：点击简化模式后 `fitMode` 未进入 `group`。
- 修复前/修复后断言均围绕 `fitMode` 状态或可见分组 UI 标识。

## 测试定位建议

- 槽位：`data-testid=slot-${connectionKey}`
- 拖动条：通过 `slot-stack` 下第一个 `input[type=range]` 或 `.slider-track-bg`
- Picker：`data-testid=equipment-picker`
- 候选：`data-testid=candidate-${equipmentId|empty}`
- 过滤：`race-*` / `mk-*` / `tag-*`
- 分页：`page-${n}`
- 按钮：`picker-confirm` / `picker-cancel`
