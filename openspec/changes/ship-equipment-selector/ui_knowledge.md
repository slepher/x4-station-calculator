# UI 知识库：船只配装装备选择器

## 代码与数据来源

- 主要实现：`src/components/ShipBuildFitCandidate.vue`
- 模式守卫与布局联动：`src/components/ShipBuildView.vue`
- 空 group 清理：`src/store/useShipBuildStore.ts`
- 船体数据：`src/assets/x4_game_data/8.0-Diplomacy/data/ships.json`
- 槽位标签定义：`src/assets/x4_game_data/8.0-Diplomacy/data/slot_tags.json`

## 组件映射

| UI 区域 | 文件 | 关键标识 |
|------|------|------|
| 配装主交互 | `ShipBuildFitCandidate.vue` | `slot-*`, `equipment-picker`, `picker-confirm`, `picker-cancel` |
| 页面容器与面板显隐 | `ShipBuildView.vue` | `showMaterial`, `setFitMode` |
| 选船入口 | `ship-build/ShipBuildSelector.vue` | `ship-build-list`, `ship-build-ship-name`, `ship-build-selection` |

## 展开态行为事实

### 1. 候选数量分流
- `isSingleCandidate(target)` 为真时：点击直接 `assign-connection`；已选同一候选时置 `null`。
- 非单候选时：`openPicker(target.key)`。

### 2. 三行布局
- Row1: 模式按钮 + 确认取消。
- Row2: 槽位签 + 分页。
- Row3: 左 `compatibility-box(filter)` + `slot-wall`，右候选列表。
- Row1/Row2 高度常量：`25.6px`（`mode-tab-tall` 与 `picker-grid-row-compact`）。

### 3. 过滤来源
- Race/MK 来源：`pickerOptions` 实时候选。
- Tag 来源：`tagDefs=['standard','advanced','xenon','mining','missile','highpower']`。
- Tag 文本：`slotTagMap + translateSlotTag`。

### 4. 展开态交互
- `canSwitchToGroupInCurrentState = props.canSwitchToGroup || isPickerLayout`，因此展开后允许切换 group。
- `jumpToTab` 与 `setMode` 都会缓存当前展开项 `connectionKeys`，后续在 `watch(slotTargets)` 做锚点重映射。
- 点击 slot.type（E/S/W/T/R）时执行 `closePicker()`。

### 5. 关闭回退
- `closePicker()` 中若 `!props.canSwitchToGroup && props.mode === 'group'`，发出 `update:mode('connection')`。
- `ShipBuildView.setFitMode` 仅在 `showMaterial=true`（关闭态）时阻止冲突切换到 group。

## 大阪路径与候选证据

### 1. 选择大阪的可达路径
- 数据 ID：`ship_ter_l_destroyer_01_a`（`ships.json`，name=`Osaka`）。
- UI 路径：
  - 打开选船列表 `data-testid=ship-build-list`
  - 找到 `ship-build-ship-name` 文本 `Osaka/大阪`
  - 点击后触发 `setSelectedShipId(ship.id)`
  - 到位探针：`data-testid=ship-build-selection` 可见且 store `selectedShipId=ship_ter_l_destroyer_01_a`

### 2. 槽位候选计数（用于测试定位）
- 计算逻辑来源：store 候选过滤（type/size/tags 与可用蓝图条件）。
- 已固定可复现槽位：
  - `ship_ter_l_destroyer_01_a::weapon::3::0` -> 候选 `1`
  - `ship_ter_l_destroyer_01_a::weapon::3::1` -> 候选 `1`
  - `ship_ter_l_destroyer_01_a::turret::4::3` -> 候选 `35`
- 结论：`>1` 用 `turret::4::3`，`=1` 用 `weapon::3::0`。

## 测试定位建议（非臆测）

- 槽位：`data-testid=slot-${connectionKey}`
- Picker：`data-testid=equipment-picker`
- 候选项：`data-testid=candidate-${equipmentId|empty}`
- 过滤按钮：`race-*` / `mk-*` / `tag-*`
- 分页：`page-${n}`
- 确认取消：`picker-confirm` / `picker-cancel`

## 与 test_tasks 的同步约束

- Case 中涉及大阪与槽位 ID 时，只能使用本文件已给出的可证实 ID。
- 出现需求冲突时，以最新脚本规则与当前代码实现为准并回写两份文档。
