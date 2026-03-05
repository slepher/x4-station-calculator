# 需求说明：船只配装装备选择器

## 目标
统一 ship build 配装区在候选数量 `0/1/>1` 下的交互，优化展开态选择器布局稳定性，并将配装交互逻辑收敛到 `ShipBuildPanelFit`。

## 已确认方案（审核重点）

### 1. 架构收敛
- `ShipBuildFitCandidate` 已并入 `ShipBuildPanelFit`，不再单独承载交互。
- `fitMode` 改为 `ShipBuildPanelFit` 内部状态，不再由 `ShipBuildView`/store 驱动。
- `applyConnectionAssignment` 由 `ShipBuildPanelFit` 直接调用 store。
- `connectionRows/groupRows/selectedByConnection` 由 `ShipBuildPanelFit` 内部基于 store 原始数据计算，不再由 `ShipBuildView` 透传。

### 2. 槽位点击语义
- **候选=0**：显示空槽。
- **候选=1**：显示唯一候选。
  - 标准/简化通用：未装备时点击为装备。
  - 简化模式特例：若已是唯一候选但数量未满（`count < totalCount`），再次点击应补齐为满数量。
  - 满数量时再次点击可清空。
- **候选>1**：点击展开 picker，候选在右侧列表选择并确认生效。

### 3. 展开态布局与稳定性
- 仍为三行两列：
  - 第一行：模式 + 确定/取消（`25.6px`）
  - 第二行：槽位签 + 分页（`25.6px`）
  - 第三行：左过滤/槽位，右候选
- 展开时第一列宽度以纯 CSS 保持稳定，不采用 JS 存宽：
  - `grid-template-columns: minmax(0, calc(50% - 4rem)) minmax(0, 1fr)`
- `RACE` 标签数量大于 3 时改为两行显示。

### 4. 模式与冲突策略
- 不再有“冲突禁止切换简化”的守卫。
- 不再有“关闭 picker 回退 connection”逻辑。
- 不再显示全局冲突警告。

### 5. 计数显示修正
- 标准模式槽位计数改为基于当前已装备状态计算，清空后从 `1/1` 正确变为 `0/1`。
- 简化模式计数仍显示聚合后的 `count/totalCount`。

### 6. 过滤规则与来源
- Race/MK 来自当前候选动态集合。
- Tag 使用预置集合 `standard/advanced/xenon/mining/missile/highpower`，并做 i18n。
- 三组计数都按“其余两组过滤后”计算。

### 7. 槽位数量拖动条（新增）
- 在每个装备槽位上方提供数量拖动条，宽度与槽位按钮一致。
- 拖动条与当前槽位、以及与上一槽位之间的垂直间距遵循当前槽位列表间距规范。
- 拖动支持二阶段更新：
  - 实时阶段：仅更新槽位数量显示（draft），不写蓝图。
  - 提交阶段（鼠标按下拖动后松开）：一次性写回蓝图数量。
- 简化模式（group）下，拖动条步进 `step` 使用当前聚合目标槽位的 `totalCount`（被聚合槽位数量和）。
- 蓝图数量允许写入 `0`，且不删除装备 ID；仅在 `stat/material` 计算时排除 `count=0` 项。
- 拖动条 UI 提取为通用组件 `components/common/X4DualPhaseRangeSlider.vue`，工人视图不重构，仅做复用扩展准备。

## 边界

### In Scope
- `ShipBuildPanelFit` 内聚重构。
- 展开态布局稳定性与标签展示优化。
- 单候选补满语义与计数修复。
- 槽位数量拖动条与二阶段数量写回能力。
- `count=0` 蓝图保留策略与 `stat/material` 计算排除策略。

### Out of Scope
- 装备对比能力。
- 新的候选推荐策略。

## 验收标准（DoD）
1. `ShipBuildFitCandidate` 不再参与运行时主链路，核心交互在 `ShipBuildPanelFit`。
2. `fitMode` 在 `ShipBuildPanelFit` 内部维护，切船后重置为标准。
3. 候选=1 在简化模式下：已选未满点击补满；满数量点击清空。
4. 展开态三行两列布局稳定，第一列宽度按 `calc(50% - 4rem)` 保持不抖动。
5. `RACE` 标签超过 3 个时以两行展示。
6. 标准模式清空后槽位计数可显示 `0/1`。
7. 不存在冲突守卫导致的简化切换阻断。
8. 每个槽位上方显示数量拖动条，宽度与槽位一致，拖动实时仅更新显示。
9. 拖动结束后一次性写回蓝图数量，且蓝图数量可为 `0` 且不删除装备 ID。
10. `count=0` 的装备不参与 `ShipBuildPanelStats` 与 `ShipBuildPanelMaterials` 计算。

## 未决项
无。
