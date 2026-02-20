# UI Knowledge: station-map-refactory

本文档仅覆盖 `test_tasks.md` 中 Web Integration Tests 所需的页面流与定位器。

## 1. 分站切换与隔离验证

### 定位器
| 元素 | 定位器 | 说明 |
|------|--------|------|
| 新建分站按钮 | `.add-btn` | 位于 `StationTabBar` |
| 帝国总览标签 | `.overview-tab` | 切换到帝国总览 |
| 分站标签 | `.station-tab` | 分站页签，支持多项 |
| 主内容布局 | `.main-layout` | 分站视图主容器 |
| READY 标记 | `#debug-ready-marker` | 页面初始化完成标识 |

### 交互流程
1. 等待 `#debug-ready-marker` 可见。
2. 点击 `.add-btn` 两次创建两个分站。
3. 点击第一个 `.station-tab`，执行模块操作。
4. 点击最后一个 `.station-tab`，执行不同模块操作。
5. 往返切换并比对视图内容。

## 2. 规划区代理可写（拖拽/编辑）

### 定位器
| 元素 | 定位器 | 说明 |
|------|--------|------|
| 规划区列表容器 | `.draggable-container` | `v-model` 绑定 `store.plannedModules` |
| 规划区模块项 | `.draggable-container .module-row` | 若 class 变化，优先以 `StationPlanningItem` 根节点特征定位 |
| 数量输入 | `.draggable-container input[type="number"]` | 对应模块数量编辑 |
| 删除按钮 | `.draggable-container .remove-btn` | 对应模块删除 |
| 自动工业区 | `.tier-auto` | 用于校验派生模块是否同步刷新 |

### 交互流程
1. 通过模块选择器添加多个模块。
2. 在 `.draggable-container` 中拖拽排序。
3. 修改数量输入并删除一项。
4. 切换分站后返回，确认变化仍在且无串站。

### Pitfalls
- 拖拽测试应使用稳定鼠标轨迹，避免直接 DOM 操作。
- 若 `module-row` 类名不存在，需按现有组件根元素调整定位器，不可硬编码无效 selector。

## 3. 帝国总览聚合一致性

### 定位器
| 元素 | 定位器 | 说明 |
|------|--------|------|
| 帝国总览入口 | `.overview-tab` | 进入帝国聚合视图 |
| 帝国资源面板 | `.list-wrapper` | `EmpireWareFlowsDashboard` 容器 |
| 分组容器 | `.volume-groups-container` | 数量/经济视图分组列表 |
| 视图切换 | `.view-mode-switcher .view-mode-btn` | 数量/经济切换 |
| 分组条目 | `.flow-wrapper` | 单资源项容器 |

### 交互流程
1. 在多个分站配置差异化产线。
2. 记录单站关键资源净值。
3. 点击 `.overview-tab` 进入总览。
4. 在 `.flow-wrapper` 中校验聚合值与单站汇总一致。
5. 返回分站修改后再次校验。

## 4. 测试数据来源约束

当前仓库未为上述 UI 流程提供专用 fixture id 输入链路，测试步骤主要通过 UI 交互构造状态。
- 对于模块选择行为，可参考现有 E2E 用例中的搜索关键词方式。
- 若后续引入 `tests/fixtures/` 数据驱动，需明确“搜索框使用 name 还是 id”并在此文档补充映射。
