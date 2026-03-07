# Ship Selector Anchor

## 第一章：定位总览（最简）

- `guide.ship.selector` -> 断言 `[data-testid='ship-build-view'][data-view-mode='selector']`
- `guide.ship.selector.filter-class` -> 点击 `[data-testid^='ship-build-filter-class-btn-']`，断言 `[data-testid='ship-build-list-column']` 可见
- `guide.ship.selector.filter-race` -> 点击 `[data-testid^='ship-build-filter-race-btn-']`，断言 `[data-testid='ship-build-list-column']` 可见
- `guide.ship.selector.filter-type` -> 点击 `[data-testid^='ship-build-filter-type-btn-']`，断言 `[data-testid='ship-build-list-column']` 可见
- `guide.ship.selector.confirm-ship` -> 点击 `[data-testid='ship-build-confirm-ship']`，断言 `[data-testid='ship-build-view'][data-view-mode='workbench']`
- `guide.ship.selector.cancel-ship` -> 点击 `[data-testid='ship-build-cancel-ship-change']`，断言 `[data-testid='ship-build-view']` 的 `data-selected-ship-id` 为空时按钮为 disabled

## Pending

pending: []
