# Design: ship-build-material

## Context
当前 `ShipBuildView` 右侧“建造材料”面板为占位内容。已有能力包括：
- 飞船选择与配装状态（`useShipBuildStore`）。
- 通用折叠组件 `CollapsibleDetailList`。
- 通用价格滑条组件 `PriceSlider`。

本次在不改变现有配装主流程的前提下，为材料面板补齐“method 驱动的材料分析与展示”。

## Decisions

1. **计算数据归属**
   - 将 ship-build 材料分析结果收敛在 `useShipBuildStore` 的派生计算中。
   - UI 只消费结构化结果（总览、装备分组、method 选项、当前价格倍率）。

2. **method 选项生成**
   - 从以下来源聚合去重：
     - 当前选中飞船可用 `production.method`。
     - 当前可涉及装备的 `cost` key。
   - method 文本和值均保持原始 key（`closedloop`/`terran`/`default`）。
   - 结果用于下拉框展示，默认选中 `default`（若存在）。

3. **fallback 规则**
   - 飞船与装备统一执行：
     - 优先使用当前选择 method。
     - 若缺失则回退 `default`。
     - 若仍缺失则视为 0 成本。

4. **分组模型**
   - 总览层：按 ware 聚合数量与金额。
   - 装备层：按 `equipmentId` 聚合数量，再按 ware 展开材料明细。
   - 总金额由“飞船项 + 各装备项”累计。

5. **金额估值模型**
   - 复用现有价格倍率估值逻辑（min/avg/max 区间映射）。
   - 拖动条改变倍率，仅重算金额字段，不变更数量字段。

6. **UI 复用策略**
   - 总览与装备分项都复用 `CollapsibleDetailList`。
   - 底部复用 `PriceSlider`，但文案使用 ship-build 独立 key。
   - 视觉 spacing / panel header / footer 对齐 `StationDashboard`。

## Data Shape (Target)

建议在 ship-build 材料面板消费统一结构：

```ts
interface ShipBuildMaterialAnalysis {
  methodOptions: string[]
  selectedMethod: string
  priceMultiplier: number
  totalValue: number
  summaryItems: Array<{ wareId: string; count: number; value: number }>
  shipGroup: { shipId: string; value: number; items: Array<{ wareId: string; count: number; value: number }> }
  equipmentGroups: Array<{
    equipmentId: string
    quantity: number
    value: number
    items: Array<{ wareId: string; count: number; value: number }>
  }>
}
```

## Risks And Mitigations

1. **method 缺失导致金额跳变**
   - Mitigation: UI 明确固定 fallback 规则并在测试中覆盖。

2. **装备分组数量与展示不一致**
   - Mitigation: 统一使用“按 equipmentId 聚合后再渲染”的单一来源。

3. **大船/高配导致明细较长**
   - Mitigation: 保持折叠默认收起，仅在用户展开时展示细项。

## Non-Goals

- 不引入新的远程数据拉取。
- 不实现自动推荐最优 method。
- 不修改 ship-build-equipment 已定义标准状态内容。
