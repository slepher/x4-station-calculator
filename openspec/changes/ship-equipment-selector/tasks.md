# 任务列表：船只配装装备选择器

## 任务概览

| 任务 | 描述 | 状态 |
|------|------|------|
| T1 | `ShipBuildFitCandidate` 逻辑搬迁到 `ShipBuildPanelFit` | 已完成 |
| T2 | `fitMode` 下放到 `PanelFit` 本地状态 | 已完成 |
| T3 | `applyConnectionAssignment` 调用链下放到 `PanelFit` | 已完成 |
| T4 | `connectionRows/groupRows/selectedByConnection` 迁移为 `PanelFit` 内部计算 | 已完成 |
| T5 | 展开态列宽防抖（CSS 方案） | 已完成 |
| T6 | RACE 标签 >3 两行显示 | 已完成 |
| T7 | 单候选简化模式补满语义 | 已完成 |
| T8 | 标准模式清空后计数修复 (`0/1`) | 已完成 |
| T9 | 文档同步与构建验证 | 已完成 |
| T10 | 槽位数量拖动条 UI 抽取与接入 | 已完成 |
| T11 | 二阶段数量更新与 group 分配提交 | 已完成 |
| T12 | `count=0` 蓝图保留与 stat/material 排除 | 已完成 |

---

## [x] T1: 组件内聚迁移
- [x] 删除 `ShipBuildFitCandidate.vue`。
- [x] 在 `ShipBuildPanelFit.vue` 承接原候选选择器逻辑与样式。

## [x] T2: fitMode 下放
- [x] `fitMode` 改为 `ShipBuildPanelFit` 本地 `ref`。
- [x] `ShipBuildView` 不再透传/监听 `mode` 相关事件。

## [x] T3: 赋值调用链下放
- [x] `ShipBuildPanelFit` 内直接调用 store `applyConnectionAssignment`。
- [x] 删除 `View -> Fit` 的 `assign-connection` 转发链。

## [x] T4: rows/selectedByConnection 内部化
- [x] `ShipBuildPanelFit` 内部计算 `connectionRows/groupRows/selectedByConnection`。
- [x] `ShipBuildView` 移除三项透传。
- [x] store return 移除三项对外导出。

## [x] T5: 展开态列宽防抖
- [x] 使用纯 CSS 宽度公式，避免展开抖动。
- [x] 第一列宽度公式更新为 `calc(50% - 4rem)`。

## [x] T6: RACE 标签多行
- [x] 当 `raceTags.length > 3` 时，RACE 标签使用两行布局。

## [x] T7: 单候选补满
- [x] 简化模式下若已选唯一候选且数量未满，点击补满。

## [x] T8: 计数修复
- [x] 标准模式计数基于当前选中状态计算。
- [x] 清空后由 `1/1` 正确显示为 `0/1`。

## [x] T9: 文档同步与验证
- [x] 同步 `request/spec/design/tasks/test_tasks/ui_knowledge`。
- [x] 执行 `npm run build` 并通过。

## [x] T10: 槽位数量拖动条 UI 抽取与接入
- [x] 提取通用组件 `X4DualPhaseRangeSlider` 到 `components/common`。
- [x] 在 `ShipBuildPanelFit` 每个槽位上方接入拖动条，不替换槽位按钮 DOM。
- [x] 保持拖动条宽度与槽位宽度一致。

## [x] T11: 二阶段数量更新与 group 分配提交
- [x] 实时阶段仅更新 `draftCountByTarget`。
- [x] 提交阶段调用 `setConnectionAssignmentCount` 一次性写回蓝图。
- [x] 简化模式按 connection capacity 分配聚合数量后提交。
- [x] 简化模式步进值使用 `target.totalCount`。

## [x] T12: `count=0` 蓝图保留与 stat/material 排除
- [x] store 支持 `count=0` 写回且保留装备 ID。
- [x] `ShipBuildPanelMaterials` 过滤 `count<=0` 装备。
- [x] `ShipBuildPanelStats` 过滤 `count<=0` 装备，避免 `count || 1` 误计入。
