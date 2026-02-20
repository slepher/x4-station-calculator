## Why

帝国视图与空间站中的帝国资源区域在单位表达和明细数量展示上存在视觉与语义不一致，增加了理解成本。现在统一标题单位表达与明细数量样式，可以在不改动计算逻辑的前提下提升信息可读性和一致性。

## What Changes

- 移除帝国总览与空间站帝国资源区域的“每小时流量”标签。
- 将资源/经济标题统一为基础文案：`资源视图`、`经济视图`，不追加单位后缀。
- 将帝国资源明细中的站点显示，改为与 `StationWareFlow.vue` 一致的“数量 + x + 名称”样式，包括字体、间距与 `x` 的表现细节。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `empire-production-summary`: 调整帝国总览标题单位展示与产物明细中的站点数量样式规范。
- `empire-gap-display`: 调整空间站视图中帝国资源区域的标题单位展示与缺口明细站点数量样式规范。

## Impact

- Affected UI:
  - `src/components/EmpireWareFlowsDashboard.vue`
  - `src/components/StationWareFlowsDashboard.vue`
  - `src/components/EmpireWareFlow.vue`
- Affected i18n keys:
  - `wareflow.resource_overview`
  - `wareflow.economy_view`
  - `wareflow.hourly_rate`（该场景不再显示）
- 测试需要覆盖标题文案、标签移除、明细数量样式一致性。
