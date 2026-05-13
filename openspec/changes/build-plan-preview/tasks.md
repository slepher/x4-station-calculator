# build-plan-preview 任务

## Phase 1: Preview 类型拆分

- [x] T1: 在 `src/types/build-plan.ts` 中删除 preview 真相层对旧单一 type 责任模型的依赖
- [x] T2: 新增 PreviewDerivedItem / PreviewRequiredItem / PreviewDerivedTarget
- [x] T3: 将 PreviewLinePlan.responsibilities 改为 PreviewLinePlan.items
- [x] T4: 新增 PreviewResult（含 lines / graph / sccGroups / buildMaterialPlanningEnabled）

## Phase 2: Preview 构造

- [x] T5: 在 `src/store/logic/buildPlanProductionLine.ts` 中将旧责任生成逻辑拆成 derived 项与 required 项两条链
- [x] T6: 为 derived 项在 preview 阶段固定 moduleId（lineage 规则）
- [x] T7: 对 unmatched derived 项增加基于 settings.racePreference 的 module 选择
- [x] T8: 固定合并规则：derived = groupId + wareId + moduleId，required = groupId + wareId
- [x] T9: 将目标来源收敛到 targets[]，确保 targets[] 只挂在 derived 项上
- [x] T10: 将 preview 依赖图 root 改为"完整展开产线的模块集合"，移除 autoFill 对 preview root 范围的参与

## Phase 3: 依赖图构建

- [x] T11: 新增 `src/store/logic/buildFlowPlanGraph.ts`
- [x] T12: 实现 BFS 扩散（沿 outputBuildTags 连线）
- [x] T13: 实现产线只入图一次 + 追踪 ware 集合扩充
- [x] T14: 实现 isolated 扩展（manual > auto 优先级）
- [x] T15: 实现 SCC 识别（Tarjan / Kosaraju）
- [x] T16: 无连线 ware 忽略

## Phase 4: 责任分配

- [x] T17: 将 computeProductionLineAllocation 改为全局两轮分配
- [x] T18: 第一轮 manual 全局分配
- [x] T19: 第二轮 auto 优先在已分配产线中查找

## Phase 5: Checkbox 语义

- [x] T20: 确认 checkbox 不是 build-flow mode 开关
- [x] T21: checkbox 只控制是否启用建材产线规划
- [x] T22: 勾选/取消都触发 preview 重算

## Phase 6: Presenter / Vue

- [x] T23: 在 useBuildPlanPresenter 中移除 preview → ProductionLineAllocation.goals 的兼容链路
- [x] T24: 改为直接输出 preview item 展示数据
- [x] T25: ProductionLineAllocationSection 按 derived / required 两种 item 渲染
- [x] T26: 调整 preview 名称显示规则（有 moduleId 显示 module 名，否则显示 ware 名）
- [x] T27: 调整 preview tag 颜色与文案（derived 绿色，required 红色）
- [x] T28: 产线卡片右上角数量改为 line 内 moduleId 去重种类数

## Phase 7: 文案与 i18n

- [x] T29: 更新 preview tag 文案（target/production/build-material 中英文映射）
- [x] T30: 新增 i18n key

## Phase 8: 验证

- [x] T31: 检查 request / design / spec / tasks 对 preview 类型拆分与显示规则描述一致
- [x] T32: npm run build 通过
- [x] T33: 支持 `logicFlowPlanId = null` 时仍生成 unmatched preview lines
