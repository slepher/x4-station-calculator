## Context

当前 `ShipBuildPanelEquipment` 将“单行指标渲染逻辑”和“面板布局组织逻辑”耦合在同一组件内，且存在重复列渲染模板。
本次变更目标是将展示层提炼为可复用模块，同时支持更灵活的 schema 组织与按 mode 的指标可见性切换。

## Decisions

1. 采用两层组件结构：
   - `MetricItem`：单条指标渲染单元。
   - `MetricsPanel`：面板容器，负责标题、可选 tab、布局组织与批量渲染。
2. `MetricsPanel` 面向业务组件提供四个核心输入：`objCurrent`、`objTarget`、`schema`、`order`。
3. `schema` 为二维数组，作为布局与指标定义的单一来源；布局行列不做硬编码。
4. 新增可选 `viewTab` 配置：
   - 在标题栏注入 `ViewTabUI`。
   - 按 mode 对指标进行显隐控制。
   - `keys='all'` 视为不过滤。
5. 抽取方式执行“复制优先”：先将现有模板行为整体迁移，再做结构清理与类型收敛。

## Component Contract

### MetricItem

- 输入（建议）：
  - `metricKey: string`
  - `labelKey: string`
  - `unit?: string`
  - `currentValue?: number`
  - `targetValue?: number`
  - `max?: number`
- 职责：
  - 负责 single/diff 的数值文本渲染。
  - 负责差值颜色（positive/negative/neutral）与条形叠加展示。

### MetricsPanel

- 输入（建议）：
  - `title?: string`
  - `objCurrent: Record<string, number | undefined> | null`
  - `objTarget: Record<string, number | undefined> | null`
  - `schema: Array<Array<{ key: string; labelKey: string; unit?: string; max?: number }>>`
  - `order?: 'row' | 'column'`
  - `viewTab?: {
      views: Array<{ mode: string; label: string; keys: string[] | 'all' }>;
      style?: string;
    } | null`
- 行为：
  - 根据 `viewTab` 当前 mode 计算可见 keys。
  - 当 mode keys 为 `all` 时不过滤。
  - 按 `order` 展开 `schema` 后渲染 `MetricItem`。

## Rendering Flow

1. 读取 `schema` 并生成基础指标列表。
2. 若 `viewTab` 存在，解析当前 mode 对应的 `keys` 过滤可见项。
3. 若 `keys='all'`，跳过过滤。
4. 按 `order`（row/column）决定展开顺序。
5. 将每个指标映射为 `MetricItem` 输入并渲染。

## Integration Plan

1. 新增 `src/components/common/MetricItem.vue`。
2. 新增 `src/components/common/MetricsPanel.vue`。
3. 在 `ShipBuildPanelEquipment.vue` 中接入 `MetricsPanel`，保留原有统计计算逻辑。
4. 将原有重复列模板迁移为 schema 构建与组件调用。

## Risks

- `schema` 为不规则二维数组（各行列数不一致）时，column 展开可能出现空洞，需要明确跳过策略。
- `viewTab` keys 与 schema key 不一致时会出现“切换后空面板”，需在开发期提供告警。
- 复制迁移阶段若遗漏类名，可能造成视觉轻微偏移。

## Non-Goals

- 本次不调整 `useEquipmentStats` 计算字段。
- 本次不重构 `ShipBuildPanelStats` 与 `ShipBuildPanelMaterials`。
- 本次不引入新的全局主题系统。
