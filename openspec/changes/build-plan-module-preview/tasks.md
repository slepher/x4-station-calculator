# build-plan-module-preview 任务

## Phase 1: Preview 类型拆分

- [x] T1: 在 `src/types/build-plan.ts` 中删除 preview 真相层对旧单一 `type` 责任模型的依赖
- [x] T2: 新增 `PreviewDerivedItem` / `PreviewRequiredItem` / `PreviewDerivedTarget`
- [x] T3: 将 `PreviewLinePlan.responsibilities` 改为 `PreviewLinePlan.items`

## Phase 2: Preview 构造

- [x] T4: 在 `src/store/logic/buildPlanProductionLine.ts` 中将旧责任生成逻辑拆成 `derived` 项与 `required` 项两条链
- [x] T5: 为 `derived` 项在 preview 阶段固定 `moduleId`
- [x] T6: 对 unmatched `derived` 项增加基于 `settings.racePreference` 的 module 选择
- [x] T6.1: 将 logic-flow group 的 `lineage` 来源固定为 `isLocked ? (lockedLineage || subCategory) : subCategory`，空值回落 `default`
- [x] T7: 固定合并规则：
  - `derived`: `groupId + wareId + moduleId`
  - `required`: `groupId + wareId`
- [x] T8: 将目标来源收敛到 `targets[]`
- [x] T9: 确保 `targets[]` 只挂在 `derived` 项上
- [x] T9.1: 在 compute 入口中移除对 preview derived 项 `moduleId` 的二次生成或覆盖逻辑，只读取 preview 已选值
- [x] T9.2: 将 preview 依赖图 root 改为“完整展开产线的模块集合”，移除 `autoFill` 对 preview root 范围的参与

## Phase 3: Presenter / Vue

- [x] T10: 在 `src/components/empire/presenters/useBuildPlanPresenter.ts` 中移除 preview → `ProductionLineAllocation.goals` 的预览兼容链路
- [x] T11: 改为直接输出 preview item 展示数据
- [x] T12: 在 `src/components/empire/ProductionLineAllocationSection.vue` 中按 `derived` / `required` 两种 item 渲染
- [x] T13: 调整 preview 名称显示规则：
  - 有 `moduleId` 显示 module 名
  - 否则显示 ware 名
- [x] T14: 调整 preview tag 颜色与顺序：
  - `derived` 绿色
  - `required` 红色

## Phase 4: 文案与计数

- [x] T15: 在 `src/locales/zh-CN.json` 中更新 preview tag 文案
- [x] T16: 在 `src/locales/en.json` 中更新 preview tag 文案
- [x] T17: 将产线卡片右上角数量改为 line 内 `moduleId` 去重种类数

## Phase 5: 验证

- [x] T18: 检查 `request.md` / `design.md` / `spec.md` / `tasks.md` 对 preview 类型拆分与显示规则描述保持一致
- [x] T19: 代码完成后执行 `npm run build`
