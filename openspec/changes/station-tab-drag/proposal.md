## Why

当前空间站标签只能点击切换，无法通过拖拽快速整理顺序。当空间站数量增多时，用户需要反复创建/删除来调整视觉与管理顺序，操作成本高且容易打断规划流程。现在补齐拖拽重排能力，可以显著提升多站管理效率。

## What Changes

- 在空间站标签栏引入拖拽重排能力，允许用户直接拖动空间站标签调整顺序。
- 保持“帝国总览”标签固定在首位，不参与拖拽。
- 拖拽过程中提供明确的视觉反馈（被拖拽项、目标位置占位/高亮）。
- 完成拖拽后同步更新空间站顺序到状态；持久化依赖现有保存流程，保存并刷新后保持一致。
- 增加拖拽边界约束：无效拖拽不应破坏现有顺序或激活状态。

## Capabilities

### New Capabilities
- `station-tab-drag`: 定义空间站标签拖拽重排的交互、约束与持久化行为。

### Modified Capabilities
- `station-tabs`: 扩展标签栏需求，从“展示与切换”增加“可拖拽重排”。
- `empire-management`: 增加空间站顺序变更后的持久化与恢复要求。

## Impact

- 前端组件：`src/components/StationTabBar.vue`（或拆分后的 Tab 子组件）
- 状态管理：`src/store/useEmpireStore.ts`（新增或扩展 reorder 行为）
- 测试：`tests/e2e/multi-station-empire/station-tabs.spec.ts`、新增/更新拖拽相关 E2E 与单元测试
- 数据兼容性：不变更数据结构版本，仅更新 `stations` 数组顺序
