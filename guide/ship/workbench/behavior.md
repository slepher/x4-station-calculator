# Ship Workbench Behavior

## 第一章：行为定义

- `guide.ship.workbench`
  - `zone`: `workbench`
  - `expected`: `ship-build-view` 的 `data-view-mode` 为 `workbench`。

- `guide.ship.workbench.slot-type.engine`
  - `action`: 点击 Engine 槽位类型按钮。
  - `enable`: `[data-testid='ship-build-view'][data-view-mode='workbench']` 可见
  - `disable`: `slot-type-engine` 按钮不存在
  - `expected`: `slot-type-engine` 按钮进入激活态（`slot-type-btn-active`）。

- `guide.ship.workbench.slot-type.thruster`
  - `action`: 点击 Thruster 槽位类型按钮。
  - `enable`: `[data-testid='ship-build-view'][data-view-mode='workbench']` 可见
  - `disable`: `slot-type-thruster` 按钮不存在
  - `expected`: `slot-type-thruster` 按钮进入激活态（`slot-type-btn-active`）。

- `guide.ship.workbench.slot-type.shield`
  - `action`: 点击 Shield 槽位类型按钮。
  - `enable`: `[data-testid='ship-build-view'][data-view-mode='workbench']` 可见
  - `disable`: `slot-type-shield` 按钮不存在
  - `expected`: `slot-type-shield` 按钮进入激活态（`slot-type-btn-active`）。

- `guide.ship.workbench.slot-type.weapon`
  - `action`: 点击 Weapon 槽位类型按钮。
  - `enable`: `[data-testid='ship-build-view'][data-view-mode='workbench']` 可见
  - `disable`: `slot-type-weapon` 按钮不存在
  - `expected`: `slot-type-weapon` 按钮进入激活态（`slot-type-btn-active`）。

- `guide.ship.workbench.slot-type.turret`
  - `action`: 点击 Turret 槽位类型按钮。
  - `enable`: `[data-testid='ship-build-view'][data-view-mode='workbench']` 可见
  - `disable`: `slot-type-turret` 按钮不存在
  - `expected`: `slot-type-turret` 按钮进入激活态（`slot-type-btn-active`）。

- `guide.ship.workbench.slot-type.consumables`
  - `action`: 点击 Consumables 槽位类型按钮。
  - `enable`: `[data-testid='ship-build-view'][data-view-mode='workbench']` 可见
  - `disable`: `slot-type-consumables` 按钮不存在
  - `expected`: `slot-type-consumables` 激活，且 `ship-storage-panel` 可见。

- `guide.ship.workbench.slot-type.units`
  - `action`: 点击 Units 槽位类型按钮。
  - `enable`: `[data-testid='ship-build-view'][data-view-mode='workbench']` 可见
  - `disable`: `slot-type-units` 按钮不存在
  - `expected`: `slot-type-units` 激活，且 `ship-storage-panel` 可见。

- `guide.ship.workbench.change-ship`
  - `action`: 点击工作台头部的切换船只按钮。
  - `enable`: `[data-testid='ship-build-change-ship-fit-header']` 可见
  - `disable`: `[data-testid='ship-build-change-ship-fit-header']` 不可见
  - `expected`: 返回船只选择区域，且 `ship-build-view` 的 `data-view-mode` 从 `workbench` 变为 `selector`。

- `guide.ship.workbench.open-slot-picker`
  - `action`: 点击装备槽位。
  - `enable`: `ship-build-view[data-view-mode='workbench']` 且 `slot-type-consumables/slot-type-units` 未激活
  - `disable`: `ship-storage-panel` 可见
  - `expected`: 候选装备区域 `equipment-picker` 可见。

- `guide.ship.workbench.select-candidate`
  - `select`: `equipment-candidate`
  - `source`: `equipment-picker list`
  - `value`: `candidate-*`
  - `enable`: `[data-testid='equipment-picker']` 可见
  - `disable`: `[data-testid='equipment-picker']` 不可见
  - `expected`: 候选项进入激活态（`candidate-item-active`）。

- `guide.ship.workbench.picker-filter-race`
  - `action`: 点击候选区 Race 筛选标签。
  - `enable`: `[data-testid='equipment-picker']` 可见
  - `disable`: `[data-testid='equipment-picker']` 不可见
  - `expected`: Race 筛选状态更新，候选列表按种族条件刷新。

- `guide.ship.workbench.picker-filter-mk`
  - `action`: 点击候选区 Mk 筛选标签。
  - `enable`: `[data-testid='equipment-picker']` 可见
  - `disable`: `[data-testid='equipment-picker']` 不可见
  - `expected`: Mk 筛选状态更新，候选列表按 Mk 条件刷新。

- `guide.ship.workbench.picker-filter-tag`
  - `action`: 点击候选区 Tag 筛选标签。
  - `enable`: `[data-testid='equipment-picker']` 可见
  - `disable`: `[data-testid='equipment-picker']` 不可见
  - `expected`: Tag 筛选状态更新，候选列表按特性标签条件刷新。

- `guide.ship.workbench.confirm-picker`
  - `action`: 在装备候选列表中选择并确认。
  - `enable`: `[data-testid='equipment-picker']` 可见
  - `disable`: `[data-testid='equipment-picker']` 不可见
  - `expected`: 槽位装备更新并显示新的选中结果。
  - `疑问`: `picker-confirm` 在未选中候选时是否禁用，当前页面未提供稳定可见禁用标识。

- `guide.ship.workbench.quick-equip`
  - `action`: 按预设为目标飞船快速配装（示例链路）。
  - `preset_ref`: `preset.quick-equip-5slots`
  - `fn`: `applyQuickLoadout`
  - `args`:
    - `$ship_id`
    - `$slot_plan`
  - `chain`:
    - `nth(0)`
  - `expected`: 对应槽位按预设完成配装。

## Preset

- `preset.quick-equip-5slots`
  - `$ship_id`: `$input.ship_id`
  - `$slot_plan`: `$input.slot_plan`
