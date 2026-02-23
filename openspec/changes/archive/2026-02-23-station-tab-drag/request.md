# Request: station-tab-drag

## 讨论交接摘要

### 已确认结论

1. 目标聚焦为三点：
   - 支持分站 Tab 拖拽重排，顺序变化应立即生效并可持久化。
   - 拖拽过程中需避免误触点击导致 active tab 异常切换。
   - 补齐测试覆盖，至少包含 1 个 store 层重排单测和 1 个 E2E 拖拽排序回归测试。
2. 现状判断：
   - 拖拽入口在 `StationTabBar.vue`。
   - 重排写入在 `useEmpireStore.reorderStations`。
   - 现有 E2E 基本未断言“拖拽后顺序”。
3. 行为与测试策略已定：
   - 拖拽后 active tab 保持不变。
   - 顺序持久化继续依赖现有保存流程（不新增自动保存）。
   - E2E 拖拽使用 `mouse.move` 路径模拟；单次拖动操作等待约 2 秒；失败时最多重试 2 次。

### 未决问题

无。

### 建议下一步

1. 进入 `/x4:new station-tab-drag` 生成 `request/spec/design/tasks/test_tasks`。
2. 再进入 `/x4:apply` 实施与补测。
