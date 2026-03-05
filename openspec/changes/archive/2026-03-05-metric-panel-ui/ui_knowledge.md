# UI Knowledge: metric-panel-ui

本文档记录 `MetricItem` / `MetricsPanel` 以及测试页 `MetricPanelPlayground` 的定位与交互知识。

## 1 测试页面入口

- Query 入口：`/?view=metric-panel-test`
- 页面组件：`src/components/test/MetricPanelPlayground.vue`
- 页面根节点：`data-testid=metric-panel-playground`

## 2 固定数据来源

- Fixture 文件：`src/components/test/fixtures/metricPanelCases.ts`
- 每个 case 提供：
  - `id/title/description`
  - `schema`
  - `objCurrent`
  - `objTarget`
  - `order`
  - `viewTab`
  - `expected`

## 3 Case 定位器

- Case 容器：`metric-panel-case-<id>`
- 已定义 case id：
  - `basic-row`
  - `column-order`
  - `view-filter`
  - `view-all`
  - `target-only`
  - `current-only`
  - `ragged-schema`

## 4 MetricsPanel / MetricItem 定位器

- Panel 容器：`metrics-panel-<panelId>`
- Panel 头部：`metrics-panel-header-<panelId>`
- Panel 内容区：`metrics-panel-content-<panelId>`
- Panel 网格：`metrics-panel-grid-<panelId>`
- Tab 容器（若存在）：`view-tab-ui-metrics-panel-<panelId>`
- Tab 按钮：`view-tab-btn-metrics-panel-<panelId>-<mode>`
- 指标行：`metric-item-<key>`
- 标签：`metric-label-<key>`
- 数值：`metric-value-<key>`
- 单位：`metric-unit-<key>`
- 进度条：`metric-bar-<key>`

## 5 关键交互规则

1. `viewTab=null`：标题栏不显示 tab。
2. `viewTab!=null`：显示 `ViewTabUI`，切换 mode 会改变可见指标集合。
3. 当前 mode 的 `keys='all'`：不过滤，显示全部 schema 指标。
4. `order='row'` 与 `order='column'` 会影响渲染顺序。
5. `objCurrent` 或 `objTarget` 为空时，按单值模式渲染（无 diff）。

## 6 E2E 断言建议

1. 所有断言以 case 容器为作用域，避免同 key 在多 case 冲突。
2. 先断言 tab 切换，再断言 item 存在/不存在。
3. `ragged-schema` 场景重点验证“不报错 + 已定义项渲染齐全”。

# 测试运行

- 本轮 `/x4:test metric-panel-ui` 执行中未出现失败用例，暂无失败经验沉淀条目。
