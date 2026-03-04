# Test Tasks: metric-panel-ui

## 1 单元测试

- [✓] 1.1 MetricItem 文本模式
  - [✓] 1.1.1 使用 `mount(MetricItem, { props: { metricKey: 'speed', label: 'Speed', targetValue: 205 } })` 渲染单值场景
  - [✓] 1.1.2 使用 `mount(MetricItem, { props: { metricKey: 'speed', label: 'Speed', currentValue: 180, targetValue: 205 } })` 渲染正差值场景
  - [✓] 1.1.3 使用 `mount(MetricItem, { props: { metricKey: 'speed', label: 'Speed', currentValue: 205, targetValue: 180 } })` 渲染负差值场景
  - [✓] 1.1.4 读取 `[data-testid="metric-value-speed"]` 文本并断言三种格式分别成立 #期望: ['205', '205(+25)', '180(-25)']

- [✓] 1.2 MetricsPanel 排序模式
  - [✓] 1.2.1 使用 `metricPanelCases.basic-row.schema` 渲染 `MetricsPanel(order='row')`
  - [✓] 1.2.2 读取容器内 `data-testid^="metric-item-"` 顺序，记录 key 序列 A
  - [✓] 1.2.3 使用相同 schema 渲染 `MetricsPanel(order='column')` 并记录 key 序列 B
  - [✓] 1.2.4 断言 A 与 B 不同且分别匹配 row-major/column-major 预期序列 #期望: ['row-major', 'column-major']

- [✓] 1.3 MetricsPanel viewTab 过滤
  - [✓] 1.3.1 使用 `view-filter` fixture 渲染 `MetricsPanel(panelId='view-filter')`
  - [✓] 1.3.2 依次点击 `view-tab-btn-metrics-panel-view-filter-combat/travel/maneuver`
  - [✓] 1.3.3 每次点击后统计可见 `metric-item-*` 数量
  - [✓] 1.3.4 断言数量链路为 `3 -> 2 -> 1` #期望: [3, 2, 1]

- [✓] 1.4 MetricsPanel `all` 不过滤
  - [✓] 1.4.1 使用 `view-all` fixture 渲染 `MetricsPanel(panelId='view-all')`
  - [✓] 1.4.2 点击 `view-tab-btn-metrics-panel-view-all-all`
  - [✓] 1.4.3 统计可见 `metric-item-*` 数量
  - [✓] 1.4.4 断言可见数量等于 schema 总 key 数 6 #期望: [6]

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: metric-panel-playground-open
  - [✓] 2.1.1 访问 `/?view=metric-panel-test`
  - [✓] 2.1.2 等待 `[data-testid="metric-panel-playground"]` 可见
  - [✓] 2.1.3 断言 `[data-testid="metric-panel-case-view-filter"]` 与 `[data-testid="metric-panel-case-view-all"]` 均可见
  - [✓] 2.1.4 断言测试页初始化完成 #期望: [visible]

- [✓] 2.2 状态: metric-panel-view-filter-combat
  - [✓] 2.2.1 在 `[data-testid="metric-panel-case-view-filter"]` 作用域内点击 `[data-testid="view-tab-btn-metrics-panel-view-filter-combat"]`
  - [✓] 2.2.2 断言 `metric-item-speed/acceleration/boostSpeed` 可见
  - [✓] 2.2.3 断言 `metric-item-travelSpeed/travelCharge/yawRate` 不可见
  - [✓] 2.2.4 断言 combat 可见集合正确 #期望: ['speed', 'acceleration', 'boostSpeed']

- [✓] 2.3 状态: metric-panel-view-filter-travel
  - [✓] 2.3.1 在 `[data-testid="metric-panel-case-view-filter"]` 作用域内点击 `[data-testid="view-tab-btn-metrics-panel-view-filter-travel"]`
  - [✓] 2.3.2 断言 `metric-item-travelSpeed/travelCharge` 可见
  - [✓] 2.3.3 断言 `metric-item-speed/acceleration/boostSpeed/yawRate` 不可见
  - [✓] 2.3.4 断言 travel 可见集合正确 #期望: ['travelSpeed', 'travelCharge']

- [✓] 2.4 状态: metric-panel-view-all
  - [✓] 2.4.1 在 `[data-testid="metric-panel-case-view-all"]` 作用域内点击 `[data-testid="view-tab-btn-metrics-panel-view-all-all"]`
  - [✓] 2.4.2 统计该作用域内 `[data-testid^="metric-item-"]` 数量
  - [✓] 2.4.3 断言 `speed/acceleration/boostSpeed/travelSpeed/travelCharge/yawRate` 全部可见
  - [✓] 2.4.4 断言全量数量为 6 #期望: [6]

## 3 E2E 测试场景

- [✓] 3.1 Case: 进入测试页并验证入口场景
  - [✓] 3.1.1 状态: metric-panel-playground-open
  - [✓] 3.1.2 定位 `[data-testid="metric-panel-case-basic-row"]`
  - [✓] 3.1.3 断言该 case 内存在 `[data-testid="metrics-panel-basic-row"]` #期望: ['case-visible']

- [✓] 3.2 Case: 进入后验证多 case 同时可见
  - [✓] 3.2.1 状态: metric-panel-playground-open
  - [✓] 3.2.2 断言 `[data-testid="metric-panel-case-view-filter"]` 可见
  - [✓] 3.2.3 断言 `[data-testid="metric-panel-case-view-all"]` 可见 #期望: ['multi-case-visible']

- [✓] 3.3 Case: combat 模式过滤结果
  - [✓] 3.3.1 状态: metric-panel-view-filter-combat
  - [✓] 3.3.2 断言 `[data-testid="metric-item-speed"]` 可见
  - [✓] 3.3.3 断言 `[data-testid="metric-item-travelSpeed"]` 不可见 #期望: ['combat-filtered']

- [✓] 3.4 Case: combat 到 travel 切换
  - [✓] 3.4.1 状态: metric-panel-view-filter-combat
  - [✓] 3.4.2 在 `view-filter` 作用域点击 `[data-testid="view-tab-btn-metrics-panel-view-filter-travel"]`
  - [✓] 3.4.3 断言切换后 `[data-testid="metric-item-speed"]` 不可见 #期望: ['speed-hidden']

- [✓] 3.5 Case: travel 模式过滤结果
  - [✓] 3.5.1 状态: metric-panel-view-filter-travel
  - [✓] 3.5.2 断言 `[data-testid="metric-item-travelSpeed"]` 可见
  - [✓] 3.5.3 断言 `[data-testid="metric-item-boostSpeed"]` 不可见 #期望: ['travel-filtered']

- [✓] 3.6 Case: travel 到 all 切换
  - [✓] 3.6.1 状态: metric-panel-view-filter-travel
  - [✓] 3.6.2 在 `view-all` 作用域点击 `[data-testid="view-tab-btn-metrics-panel-view-all-all"]`
  - [✓] 3.6.3 断言 `[data-testid="metric-panel-case-view-all"]` 内指标数量为 6 #期望: [6]

- [✓] 3.7 Case: all 模式全量可见
  - [✓] 3.7.1 状态: metric-panel-view-all
  - [✓] 3.7.2 在 `view-all` 作用域统计 `[data-testid^="metric-item-"]` 数量
  - [✓] 3.7.3 断言 `speed/travelSpeed/yawRate` 三项 testid 全部可见 #期望: ['all-visible']

- [✓] 3.8 Case: all 模式可重复进入
  - [✓] 3.8.1 状态: metric-panel-view-all
  - [✓] 3.8.2 再次点击 `[data-testid="view-tab-btn-metrics-panel-view-all-all"]`
  - [✓] 3.8.3 断言可见指标数量仍为 6 #期望: [6]

- [✓] 3.9 Case: target-only 单侧数据展示
  - [✓] 3.9.1 在 `metric-panel-case-target-only` 作用域读取 `[data-testid="metric-value-speed"]` 文本
  - [✓] 3.9.2 固定检查 `[data-testid="metric-value-speed"]` 与 `[data-testid="metric-value-travelSpeed"]` 文本均不包含 `(` 和 `)`
  - [✓] 3.9.3 断言该场景不显示差值格式 #期望: ['target-only']

- [✓] 3.10 Case: current-only 单侧数据展示
  - [✓] 3.10.1 在 `metric-panel-case-current-only` 作用域读取 `[data-testid="metric-value-speed"]` 文本
  - [✓] 3.10.2 固定检查 `[data-testid="metric-value-speed"]` 与 `[data-testid="metric-value-travelSpeed"]` 文本均不包含 `(` 和 `)`
  - [✓] 3.10.3 断言该场景不显示差值格式 #期望: ['current-only']

- [✓] 3.11 Case: ragged-schema 稳定渲染
  - [✓] 3.11.1 在 `metric-panel-case-ragged-schema` 作用域统计 `[data-testid^="metric-item-"]` 数量
  - [✓] 3.11.2 断言页面中不存在运行时报错文案 `TypeError`/`Unhandled`
  - [✓] 3.11.3 断言该 case 至少渲染 1 个指标且页面保持可交互 #期望: ['no-crash']

## 4 Bug 测试
