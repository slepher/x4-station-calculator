# UI Knowledge: button-tooltip-side

本文档覆盖 `test_tasks.md` 中 Web Integration 所需的可达路径、关键定位器与断言口径。

## 1. 关键定位器（基于现有组件）

| 元素 | 定位器 | 来源文件 | 说明 |
|------|--------|----------|------|
| StationWareFlow 容器 | `.flow-wrapper` | `src/components/StationWareFlow.vue` | StationWareFlow 主区域容器 |
| 操作栏容器 | `.flow-action-rail` | `src/components/StationWareFlow.vue` | 右侧操作按钮轨道 |
| 收藏按钮 | `.flow-action-rail .favorite-btn` | `src/components/common/FavoriteButton.vue` | 收藏/优先级按钮入口 |
| 锁定按钮 | `.flow-action-rail .lock-btn` | `src/components/common/LockButton.vue` | 锁定按钮入口 |
| 收藏按钮 tooltip | `div.tippy-box[data-theme="x4"][data-placement="left"]` | Tippy DOM | 悬停收藏按钮后出现，方向应为 left |
| 锁定按钮 tooltip | `div.tippy-box[data-theme="x4"][data-placement="right"]` | Tippy DOM | 悬停锁定按钮后出现，方向应为 right |

说明：Tippy tooltip 节点通常挂在 `body` 下；建议在 hover 后使用最近出现的 tooltip 容器进行断言，避免与其他 tooltip 冲突。

## 2. 可达路径（Reachable Paths）

### Path A（推荐）：进入任意空间站页面

1. 启动应用并等待页面初始化完成。
2. 进入任意空间站页面，确保 StationWareFlow 区域渲染完成。
3. 在 `.flow-action-rail` 中定位收藏按钮与锁定按钮。

## 3. 断言口径补充

1. placement 断言建议读取 tooltip 容器的 `data-placement`。
2. tooltip 内容断言尽量使用稳定的可见文本或 i18n 目标语言文本；避免依赖临时结构或顺序。
3. 若页面同时存在多个 tooltip，优先以 hover 后最新可见 tooltip 进行断言。
