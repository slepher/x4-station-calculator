## Context

本变更属于已有帝国视图能力上的 UI 一致性优化，涉及两个展示入口：
- 帝国总览视图（`EmpireWareFlowsDashboard`）
- 空间站视图中的帝国资源区域（`StationWareFlowsDashboard` 中的帝国运营/帝国补给相关展示）

现状问题：
- 头部通过 `header-badge` 展示“每小时流量”，而标题本身不带单位后缀。
- 帝国资源明细中的空间站数量样式与 `StationWareFlow.vue` 的三段式数量展示不一致。

约束：
- 不改动任何聚合/过滤/排序逻辑。
- `stationCount` 数据来源与口径保持现状。

## Goals / Non-Goals

**Goals:**
- 统一帝国资源区域标题文案，保持“资源视图/经济视图”基础表达，不追加后缀。
- 移除“每小时流量”标签，避免重复单位表达。
- 帝国资源明细中的站点数量展示完全对齐 `StationWareFlow.vue` 的视觉与结构细节。

**Non-Goals:**
- 不变更帝国流量计算、stationCount 计算、分组规则、排序规则。
- 不新增业务字段，不调整持久化结构。

## Decisions

1. 标题采用基础文案并移除角标。
- 决策：标题保留“资源视图/经济视图”基础文案，删除 `header-badge` 中的 `hourly_rate`。
- 原因：去除多余噪音并避免视觉负担。
- 备选方案：标题追加 `/h` 后缀。
  - 放弃原因：最终视觉效果不佳，用户明确要求移除。

2. 明细样式以 `StationWareFlow.vue` 为基准源。
- 决策：在 `EmpireWareFlow` 的明细行采用与 `StationWareFlow.vue` 同构的 `qty/symbol/name` 三段式 DOM 与同名样式规则。
- 原因：用户要求“字体和 x 显示细节都一致”，同构实现比字符串拼接更可靠。
- 备选方案：继续字符串拼接（如 `站名 (xN)`）。
  - 放弃原因：无法保证字号、透明度、间距和 `x` 细节一致。

3. 变更范围仅限展示层组件。
- 决策：只改 `EmpireWareFlowsDashboard`、`StationWareFlowsDashboard`、`EmpireWareFlow`。
- 原因：降低回归风险，符合“只改展示不改计算”的约束。

## Risks / Trade-offs

- [风险] 标题文案变化可能影响依赖旧文案的 E2E 定位。
  - Mitigation: 更新测试任务为基于 `.view-mode-btn` 与结构定位，不硬编码旧标题。

- [风险] 明细 DOM 结构变化可能影响现有快照或选择器。
  - Mitigation: 在 `ui_knowledge.md` 中同步新定位器（`.item-name .qty/.symbol/.name`）。

- [取舍] 为了严格对齐样式，`EmpireWareFlow` 会引入更多与 `StationWareFlow` 同名类。
  - Mitigation: 保持局部 scoped 样式，避免外溢影响。
