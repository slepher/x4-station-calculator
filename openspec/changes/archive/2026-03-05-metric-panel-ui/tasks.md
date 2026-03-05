# Tasks: metric-panel-ui

## 1. 组件抽取

- [ ] 1.1 新建 `MetricItem` 组件，并复制现有单条指标渲染结构（label/value-diff/unit/bar）。
- [ ] 1.2 新建 `MetricsPanel` 组件，承载标题栏与指标容器结构。
- [ ] 1.3 将现有重复列渲染从 `ShipBuildPanelEquipment` 迁移为 `MetricsPanel + MetricItem` 组合。

## 2. Schema 与顺序能力

- [ ] 2.1 在 `MetricsPanel` 实现二维 `schema` 输入解析，不限制行列规模。
- [ ] 2.2 实现 `order='row'` 的行优先展开逻辑。
- [ ] 2.3 实现 `order='column'` 的列优先展开逻辑。

## 3. ViewTab 集成

- [ ] 3.1 为 `MetricsPanel` 新增可选 `viewTab` 参数与内部 mode 状态。
- [ ] 3.2 当 `viewTab != null` 时在标题栏渲染 `ViewTabUI`。
- [ ] 3.3 实现 mode 对应 `keys` 的指标过滤。
- [ ] 3.4 实现 `keys='all'` 不过滤行为。

## 4. 接入与回归

- [ ] 4.1 在 `ShipBuildPanelEquipment` 中改为通过 `schema + objCurrent + objTarget` 向 `MetricsPanel` 传参。
- [ ] 4.2 校对 single/diff 文案、颜色与进度条表现与抽取前一致。
- [ ] 4.3 为新组件补充稳定 `data-testid`（容器、item、value、bar、tab）。

## 5. 构建验证

- [ ] 5.1 执行 `npm run build`，确认组件抽取后编译通过。
