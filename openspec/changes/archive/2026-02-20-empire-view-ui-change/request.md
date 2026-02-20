# Request: empire-view-ui-change

## 背景

当前帝国总览与空间站显示中的帝国资源区域，在标题单位提示与明细站点数量展示上存在不一致：
- 标题单位依赖“每小时流量”角标，不够直观。
- 帝国资源明细中的空间站数量展示与 `StationWareFlow.vue` 的数量样式不一致。

本次变更聚焦 UI 一致性与可读性，不调整计算口径与业务数据来源。

## 功能描述

1. 去掉两个模块中“帝国资源显示区域”的“每小时流量”标签：
- 帝国总览（`EmpireWareFlowsDashboard`）
- 空间站显示中的帝国资源区域（`StationWareFlowsDashboard` 的帝国运营/帝国补给相关区域）

2. 修改标题文案并追加单位后缀（无空格）：
- `资源视图/h`
- `经济视图/h`

3. 帝国资源明细中的空间站名称行，改为与 `StationWareFlow.vue` 一致的数量展示逻辑与视觉细节：
- 使用“数量 + x + 名称”的三段式结构展示。
- 字体、`x` 的显示方式、间距、颜色等细节与 `StationWareFlow.vue` 保持一致。

## 用户场景

1. 用户查看帝国总览时，标题直接显示单位后缀，且不再出现“每小时流量”角标。
2. 用户在空间站中开启帝国缺口并查看帝国资源明细时，站点名称行展示为与站内资源明细一致的数量样式。
3. 用户切换资源/经济视图时，标题均带 `/h` 后缀且格式统一。

## 技术约束

- 仅修改 UI 展示与文案，不改变帝国聚合、过滤、排序、计数计算逻辑。
- `xN` 的数量来源继续使用既有 `stationCount` / `StationPlan.count`。
- 遵循现有组件结构：`EmpireWareFlow`、`EmpireWareFlowGroup`、`EmpireWareFlowsDashboard`、`StationWareFlowsDashboard`。

## 讨论结论

- 第三条需求以 `StationWareFlow.vue` 为唯一参考标准，不做“近似实现”。
- “标题 + /h”中间不加空格。
- 本轮先完成文档（`/x4:ff`），后续再进入实现阶段。
