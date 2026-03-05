# UI Knowledge: build-ui-component

## 页面入口与区域

- 页面入口：`StationWorkbench` 内 `StationDashboard`。
- 目标区域：dashboard 头部右侧视图切换区。

## 组件与定位约定

- 组件容器：`data-testid="view-tab-ui"`
- 按钮定位：`data-testid="view-tab-btn-<key>"`
- `StationDashboard` 视图 key：
  - `materials`
  - `volume`
  - `time`
  - `workers`

## 状态与切换语义

- 状态：`StationDashboard-默认视图`
  - 进入路径：打开工作台并进入站点面板。
  - 可观察结果：`materials` 处于激活态。
- 切换：`materials -> volume`
  - 操作：点击 `view-tab-btn-volume`
  - 可观察结果：标题切换到 volume 对应文案。
- 切换：`volume -> time`
  - 操作：点击 `view-tab-btn-time`
  - 可观察结果：列表渲染进入时间口径。
- 切换：`time -> workers`
  - 操作：点击 `view-tab-btn-workers`
  - 可观察结果：footer 切到 workforce 控件。

## 自动化断言建议

- 激活态断言：同一时刻仅一个按钮具有 active class。
- 交互断言：点击 tab 后，`StationDashboard` 的标题与内容区同步变化。
- 禁用态断言：若某 tab 标记 `disabled`，按钮应不可点击且无事件发出。

## 语言与文案

- 组件不持有翻译逻辑；按钮文案由父组件传入。
- E2E 推荐以 `data-testid` 定位，避免直接依赖中英文文案。

# 测试运行

- [✓] 2.2 切换: materials -> volume
  - [✓] 首次失败原因：`.header-title` 选择器命中多个区域，触发 Playwright strict mode 冲突。
  - [✓] 修复后策略：收窄为 `.dashboard-container .dashboard-header .header-title` 并调整英文文案匹配为 `Material Volume`。
  - [✓] 最新状态：复跑通过。

- [✓] 2.3 切换: volume -> time
  - [✓] 首次失败原因：时间视图标题断言口径不稳定。
  - [✓] 修复后策略：以 `time` tab 激活态 + footer 隐藏作为时间视图判据。
  - [✓] 最新状态：复跑通过。

- [✓] 2.4 切换: time -> workers
  - [✓] 首次失败原因：受上游切换链路失败影响产生连带失败。
  - [✓] 修复后策略：修复 2.2/2.3 后保持原断言（workers 激活 + workforce 面板可见）。
  - [✓] 最新状态：复跑通过。

- [✓] 3.1 Case: Dashboard 视图切换无回归
  - [✓] 首次失败原因：依赖 2.x 切换链路，随上游失败而失败。
  - [✓] 修复后策略：沿用 chapter 2 helper，修复切换断言口径后复跑。
  - [✓] 最新状态：复跑通过。
