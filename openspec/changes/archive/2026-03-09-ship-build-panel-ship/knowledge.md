# Knowledge: ship-build-panel-ship

## 文档目的

本文件记录 `ship-build-panel-ship` 变更涉及的 UI 定位、状态定义与断言口径，用于与 `test_tasks.md` 同步维护。

## 组件与状态入口

- 入口视图组件：`ShipBuildView`
- selector 组件：`ShipBuildSelectorView` / `ShipBuildSelector`
- workspace 组件：`ShipBuildWorkspaceView`
- 新状态面板：`ShipBuildPanelShip`
- 模式控制：store `viewMode = 'selector' | 'workspace'`

## 稳定定位器（data-testid）

### 入口与切换
- 更换飞船按钮（workspace 头部）：`ship-build-change-ship-fit-header`
- selector 根容器：`ship-build-selector-grid`
- workspace 根容器：`ship-build-panels`
- 当前 ship 标题（workspace）：`ship-build-current-ship-title`（测试文档约定的稳定定位器）

### 候选列表与操作
- 列表列容器：`ship-build-list-column`
- 飞船名称行：`ship-build-ship-name`
- 取消更换按钮：`ship-build-cancel-ship-change`
- 确认按钮：`ship-build-confirm-ship`

### 分页器
- 分页器容器：`ship-build-list-pager`
- 页码按钮：`ship-build-page-<n>`（例如 `ship-build-page-2`）
- 当前页高亮 class：`pager-btn-active`

### 状态面板
- 面板容器：`ship-build-panel-ship`
- MetricsPanel 容器：`metrics-panel-ship-build-panel-ship`
- 指标值节点：`metric-value-<metric-key>`
- 本变更推荐断言键：`metric-value-hull`

## 固定候选映射（fixture + zh-CN）

- 当前 ship（fixture activeId）：
  - ship id: `ship_ter_m_corvette_01_a`
  - 显示名：`武士刀`
  - hull：`11,000`
- 同级 pending 候选（用于 diff 断言）：
  - ship id: `ship_ter_m_corvette_02_a`
  - 显示名：`大太刀`
  - hull：`16,100`
  - 期望 `metric-value-hull`：`16,100(+5,100)`
- 跨级 pending 候选（用于 no-diff 断言）：
  - ship id: `ship_ter_l_destroyer_01_a`
  - 显示名：`大阪`
  - hull：`95,000`
  - 期望 `metric-value-hull`：`95,000`

## Chapter 2 状态/切换定义（与 test_tasks.md 同步）

- `状态: selector-open-with-current-ship`
  - 含义：从 workspace 点击更换后，页面处于 selector，且当前 ship 在列表中为 pending 高亮。

- `状态: selector-open-with-pending-ship`
  - 含义：在 selector 中点击了一个候选 ship，pending 已更新。

- `切换: selector-open-with-pending-ship -> workspace-with-confirmed-ship`
  - 含义：点击确认后回到 workspace，当前 ship 切换为 pending ship。

- `切换: selector-open-with-current-ship -> workspace-with-current-ship`
  - 含义：点击取消或同船确认后回到 workspace，当前 ship 保持不变。

## 可观察断言口径

### 1) 是否回到 workspace
- 可观察信号：`ship-build-panels` 可见，`ship-build-selector-grid` 不可见。

### 2) 是否仍在 selector
- 可观察信号：`ship-build-selector-grid` 可见。

### 3) ship 是否发生切换
- 可观察信号：workspace 标题 ship 名称是否等于 pending 候选名称。

### 4) 同级/跨级 diff 规则
- 同级：`metric-value-*` 文本可出现差值格式 `(+x)` / `(-x)`。
- 跨级：`metric-value-*` 不应出现差值括号，显示 target 单值。
- `hull` 推荐精确断言口径：
  - 同级（武士刀 -> 大太刀）：`16,100(+5,100)`
  - 跨级（武士刀 -> 大阪）：`95,000`

### 5) 分页器样式规则
- 触发条件：候选总数 `> 10`。
- 结构：`<` + `页码按钮` + `>`。
- 当前页：按钮 class 含 `pager-btn-active`。
- 位置：列表头部右侧（与确认/取消同一行）。

## 固定前置（E2E beforeEach）

- 通过 fixture 将 `tests/fixtures/db.json`（排除 `vsn`）写入 localStorage。
- `page.reload()` 初始化 store。
- 通过 UI 选择器设置语言（禁止直接改 locale 存储）。
- 设置测试初始语言为 `zh-CN`，并确保 active blueprint 可进入 ship build workspace。
- 对 Chapter 2/3 的状态用例统一复用该前置，不在状态步骤中使用内部 store 字段作为断言目标。

## 风险提示

- selector 模式下若筛选条件过窄，当前 ship 可能不在候选列表，pending 会为空；用例应显式设置筛选条件保证候选存在。
- 分页用例应先断言候选总数，再断言分页器结构，避免因数据量不足导致误判。

# 测试运行

- [✓] 2.3 首轮失败后修复通过
  - [✓] 2.3.1 问题现象：在 selector 内读取 workspace 头部定位器导致超时
  - [✓] 2.3.2 修复动作：切换 helper 前置断言为 selector 内按钮可见，再在确认后进入 workspace 读取头部
- [✓] 2.4 首轮失败后修复通过
  - [✓] 2.4.1 问题现象：在 selector 内读取 workspace 头部定位器导致超时
  - [✓] 2.4.2 修复动作：切换 helper 前置断言为取消按钮可见，移除 selector 阶段对 workspace 头部的读取
- [✓] 3.1 首轮失败后修复通过
  - [✓] 3.1.1 问题现象：未调用 Chapter 2 映射的 transition helper，且受 2.4 helper 超时影响
  - [✓] 3.1.2 修复动作：补充 `transitionCurrentToWorkspaceCurrent` 调用并复用修正后的 helper
- [✓] 3.2 首轮失败后修复通过
  - [✓] 3.2.1 问题现象：未调用 Chapter 2 映射的 transition helper，且受 2.4 helper 超时影响
  - [✓] 3.2.2 修复动作：补充 `transitionCurrentToWorkspaceCurrent` 调用并复用修正后的 helper
- [✓] 3.3 首轮失败后修复通过
  - [✓] 3.3.1 问题现象：未调用 Chapter 2 映射的 transition helper，且受 2.3 helper 超时影响
  - [✓] 3.3.2 修复动作：补充 `transitionPendingToWorkspaceConfirmed` 调用并复用修正后的 helper
- [✓] 3.4 首轮失败后修复通过
  - [✓] 3.4.1 问题现象：未调用 Chapter 2 映射的 transition helper，且受 2.4 helper 超时影响
  - [✓] 3.4.2 修复动作：补充 `transitionCurrentToWorkspaceCurrent` 调用并复用修正后的 helper
- [✓] 3.6 首轮失败后修复通过
  - [✓] 3.6.1 问题现象：复用 `transitionPendingToWorkspaceConfirmed` 时命中 selector 阶段头部定位超时
  - [✓] 3.6.2 修复动作：沿用 2.3 helper 修复后重跑通过
