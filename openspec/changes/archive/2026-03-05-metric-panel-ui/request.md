# 需求说明：metric-panel-ui

## 目标
将现有 Ship Build 装备对比区域中的指标展示逻辑抽取为可复用 UI 组件，形成两层结构：`MetricItem` 与 `MetricsPanel`。
抽取方式遵循“先复制现有元素，再细化修改”，优先保证视觉与行为一致，再做结构化增强。

## 已确认方案（审核重点）
1. 组件命名与分层
   - 第一层：`MetricItem`，负责单条指标展示（label + value/diff + unit + bar）。
   - 第二层：`MetricsPanel`，负责标题区、可选 viewTab、按 schema 组织布局并渲染多个 `MetricItem`。
2. 输入参数与边界
   - `MetricsPanel` 核心入参：`objCurrent`、`objTarget`、`schema`、`order`。
   - `schema` 为二维数组，不限制行数/列数。
   - 面板行列数量由 `schema` 决定，不做固定两列假设。
3. 展开顺序
   - `order='row'`：按行优先展开 `schema` 并渲染。
   - `order='column'`：按列优先展开 `schema` 并渲染。
4. viewTab 能力
   - `MetricsPanel` 新增可选参数 `viewTab`。
   - 结构为 `{"views": [{"mode", "label", "keys"}], "style"}`。
   - 当 `viewTab != null` 时，在 `MetricsPanel` 标题栏显示 `ViewTabUI`。
   - 切换 mode 后，仅显示该 mode 对应 keys 的指标。
   - 若 `keys` 为 `"all"`，则不执行隐藏，显示全部指标。
5. 抽取实施策略
   - 第一步复制现有 `ShipBuildPanelEquipment` 的指标行和面板渲染元素到新组件。
   - 第二步在等价行为基础上引入 schema 驱动和 viewTab 过滤。
   - 第三步由业务组件继续负责统计计算，仅将展示数据下放给 `MetricsPanel`。

## 边界
### In Scope
- 新增 `MetricItem` 与 `MetricsPanel` 两个可复用 Vue 组件。
- `MetricsPanel` 支持 schema 动态行列、`order` 展开顺序与可选 `viewTab`。
- `viewTab` 支持 mode 切换过滤，支持 `keys='all'` 特殊值。
- 以“复制后细化”的方式替换 `ShipBuildPanelEquipment` 中重复渲染结构。

### Out of Scope
- 不改 `useEquipmentStats` 的业务计算模型与字段来源。
- 不改 Ship Build 其它面板（Stats/Materials）业务逻辑。
- 不在本阶段重做视觉风格，仅保持现有样式体系。

## 验收标准（DoD）
1. 项目中存在独立组件 `MetricItem` 与 `MetricsPanel`，并完成基础接入。
2. `MetricsPanel` 可基于任意二维 `schema` 正确渲染，不依赖固定列数。
3. `order='row'` 与 `order='column'` 均可用，且渲染顺序可预测。
4. `viewTab` 为空时不显示标签切换；非空时标题栏显示 `ViewTabUI`。
5. mode 切换可正确控制指标显隐；`keys='all'` 时显示全部。
6. 抽取后 `ShipBuildPanelEquipment` 的显示行为与抽取前一致（含 single/diff 与进度条颜色逻辑）。

## 未决项
无。
