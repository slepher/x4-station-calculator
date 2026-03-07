# Ship Selector Behavior

## 第一章：行为定义

- `guide.ship.selector`
  - `zone`: `selector`
  - `expected`: `ship-build-view` 的 `data-view-mode` 为 `selector`。

- `guide.ship.selector.filter-class`
  - `action`: `click`
  - `target`: `ship class filter button`
  - `value`: `class-id`
  - `expected`: 船级筛选状态更新，候选列表变化。

- `guide.ship.selector.filter-race`
  - `action`: `click`
  - `target`: `ship race filter button`
  - `value`: `race-id`
  - `expected`: 种族筛选状态更新，候选列表变化。

- `guide.ship.selector.filter-type`
  - `action`: `click`
  - `target`: `ship type filter button`
  - `value`: `type-id`
  - `expected`: 类型筛选状态更新，候选列表变化。

- `guide.ship.selector.select-ship`
  - `select`: `ship`
  - `source`: `ship list`
  - `value`: `ship-id | ship-name`
  - `expected`: 目标船只被选中，确认按钮进入可点击状态。

- `guide.ship.selector.confirm-ship`
  - `action`: 点击确认选船按钮。
  - `target`: `confirm ship button`
  - `expected`: 选船被提交。

- `guide.ship.selector.cancel-ship`
  - `action`: 点击取消选船按钮。
  - `target`: `cancel ship button`
  - `enable`: `[data-testid='ship-build-view']` 的 `data-selected-ship-id` 非空
  - `disable`: `[data-testid='ship-build-view']` 的 `data-selected-ship-id` 为空
  - `expected`: 取消当前待确认选船并回退到已保存选船状态。

- `guide.ship.selector.switch-to-workbench`
  - `switch`: `view-mode`
  - `from`: `selector`
  - `to`: `workbench`
  - `trigger`: `guide.ship.selector.confirm-ship`
  - `expected`: 当前选船更新，且 `ship-build-view` 的 `data-view-mode` 从 `selector` 变为 `workbench`。
