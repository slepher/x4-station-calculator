# build-plan-production-line 任务

## Phase 1: Preview / Compute 边界重构

- [x] T0: 审查当前实现偏差并记录"需求以文档为准，当前代码有 bug，不得以代码行为反推需求"
- [x] T1: 明确 `preview` 数据结构，支持单条产线同时保存建材责任、gap 责任、用户目标责任
- [x] T2: 在 store 中拆清 `preview` 输出与 `compute` 输出，禁止 `preview` 阶段产出最终主要模块 / 辅助模块 / steps
- [x] T3: 将点击"计算建造方案"后的正式求解改为严格读取 `preview` 已分配结果，不再重新决定责任归属
- [x] T3.1: 在 `src/store/useBlueprintProductionStore.ts` 中新增或固定 `previewResult` / `computeResult` 状态字段
- [x] T3.2: 将 checkbox、目标模块、目标产物变动统一改为只驱动 `previewResult` 重算
- [x] T3.3: 将"计算建造方案"按钮路径改为只消费 `previewResult`

## Phase 2: 责任与相关产线模型

- [x] T4: 为每条责任补全 `relatedLineGroupIds` 等字段，确保"相关产线集合"来自 `preview` 显式挂接结果
- [x] T5: 替换现有 `ProductionLineAllocation.goals` 作为 preview 真相层的职责，新增显式 preview truth 类型
- [x] T6: 清理现有实现中任何运行时重新推导"相关产线集合"的分支，统一改为读取 `preview` 结果
- [x] T7: 校准约束面板预览展示，使其直接反映 preview 责任分配结果，而不是 presenter 二次拼装结果
- [x] T7.1: 在 `src/types/build-plan.ts` 中新增 `PreviewResult` / `PreviewLinePlan` / `PreviewResponsibility`
- [x] T7.2: 在 `src/components/empire/presenters/useBuildPlanPresenter.ts` 中删除 preview allocation 与 production allocation 的二次合并
- [x] T7.3: 在 `src/components/empire/BuildPlanConstraintsPanel.vue` 中仅消费 presenter 输出，不再直接补逻辑

## Phase 3: 目标速率公式统一

- [x] T8: 将单线求解目标速率统一为 `所有相关产线的所有建筑，对该材料总需求 / 所有相关产线的所有建筑总建造时间`
- [x] T9: 将现有 `collectDemandSources()` / graph edge 聚合逻辑降级为辅助分析层，不再充当最终责任真相
- [x] T10: 清理旧的 per-source `Math.max` 规则或其他与正式公式冲突的逻辑
- [x] T11: 确保单条产线内三类责任先合并，再统一计算目标速率，不按责任类型拆开分别求解
- [x] T11.1: 在 `src/store/logic/buildPlanProductionLine.ts` 中固定责任合并 -> 建筑集合 -> 目标速率 的共享主链
- [x] T11.2: 在 `src/store/logic/calculateBuildFlowPlan.ts` 中将 graph edge demand 相关逻辑降级为辅助层输入，而非最终目标速率真相

## Phase 4: 主模块 / 辅助模块求解

- [x] T12: 调整 `compute` 主流程，使其只消费 preview truth，不再重新调用 `computeProductionLineAllocation(goals, ...)`
- [x] T13: 调整 `compute` 主流程，先根据目标速率求主要模块数量
- [x] T14: 调整辅助模块计算，使其严格由主要模块结果派生，不作为独立责任源参与重新分配
- [x] T15: 清理任何"辅助模块变化也参与收敛判断"的逻辑
- [x] T15.1: 在 `ComputeResult` 中显式分离 `primaryModules` / `auxiliaryModules` / `allModules`

## Phase 5: SCC / 循环依赖收敛

- [x] T16: 对 SCC 场景实现迭代求解，按轮重算主要模块数量
- [x] T17: 显式区分"主要模块快照"与"辅助模块/autoFill 模块"，避免继续使用 `node.modules` 直接判断收敛
- [x] T18: 将收敛判据统一为"主要模块数量不再变化"
- [x] T19: 清理旧的与辅助模块或其他次级指标相关的收敛判据
- [x] T19.1: 在 `src/types/build-plan.ts` 中新增 `PrimaryModuleSnapshot`
- [x] T19.2: 在 `src/store/logic/calculateBuildFlowPlan.ts` 中仅比较 `PrimaryModuleSnapshot`

## Phase 6: 分组与重叠产线

- [x] T20: 统一最终 grouped schemes 生成逻辑，确保分组只有"建材产线"与"生产产线"
- [x] T21: 重叠产线（同一 `groupId`）只保留一份 scheme，并归入建材组
- [x] T22: 将重叠产线的建材责任与生产责任前移到求解前合并，移除 scheme 结果层事后拼接模式
- [x] T23: 组内排序统一按依赖拓扑序，整体验证"先建材后生产"

## Phase 7: 单一共享入口

- [x] T24: 抽出并固定共享核心入口，覆盖 preview truth 生成与 compute 求解两阶段
- [x] T25: store 改为仅调用共享入口，不再维护平行逻辑
- [x] T26: `analysis/scripts/build-plan/build-plan-production-line.ts` 改为仅调用共享入口，不复制 store 计算逻辑
- [x] T27: Vue / presenter 改为只消费结果，不再做二次分组、二次责任拼装或临时补丁式合并
- [x] T27.1: 固定共享入口为 `createBuildFlowPlanPreview(...)` 与 `computeBuildFlowPlan(...)`
- [x] T27.2: `analysis/scripts/build-plan/build-plan-production-line.ts` 输出 `previewResult` 与 `computeResult` 派生视图

## Phase 8: 文档与验证

- [x] T28: 确认实现行为与本 change 的 `request.md` / `design.md` / `spec.md` 一致
- [x] T29: 补充最小验证方案，覆盖 preview 责任分配、目标速率公式、SCC 收敛、重叠产线归组、script/Vue 同源输出
- [x] T30: 代码完成后执行 `npm run build`

## Phase 9: Build Plan Store 拆分

- [ ] T31: 新增独立 `useBuildPlanStore`，承载 build-plan 真相层状态与动作
- [ ] T32: 将 `buildGoals` / `buildFlowMode` / `buildPlan` / `previewResult` / `computeResult` / `schemeGroups` / loading 状态从 `useBlueprintProductionStore` 迁移到 `useBuildPlanStore`
- [ ] T33: 将 preview watcher 与 compute 入口迁移到 `useBuildPlanStore`
- [ ] T34: `useBuildPlanPresenter` 改为以 `useBuildPlanStore` 为主输入，仅组合 blueprint store 的 empire overview 数据
- [ ] T35: `BlueprintProductionWorkbenchView` overview 入口改为同时注入 blueprint store 与 build-plan store
- [ ] T36: 清理 `useBlueprintProductionStore` 中遗留的 build-plan 真相层导出与双写路径
- [x] T38: 将 `computeProductionLineAllocation` 改为全局两轮分配：先 manual 全局分配，再 auto 优先在已分配产线中查找
- [x] T39: 执行 `npm run build`

## 验证方案摘要

### Preview 责任分配
- `createBuildFlowPlanPreview()` 返回 `PreviewResult`，含 `lines: PreviewLinePlan[]`，每条 line 的 `responsibilities: PreviewResponsibility[]`
- 责任类型明确为 `derived-build-material` / `derived-production` / `required-production` / `target-production`
- 每条责任显式携带 `relatedLineGroupIds`
- Presener 直接从 `previewResult.lines` 推导 `buildMaterialPreviewAllocations`，不再与 `allocations` 二次合并

### 目标速率公式
- `computeTargetRatesFromBuildings()` 使用 `sum(qty) / sum(time)` 公式
- `collectBuildingsForResponsibilities()` 从 `relatedLineGroupIds` 展开建筑集合

### SCC 收敛
- `makePrimaryModuleSnapshot()` 只比较主要模块（filter by `node.moduleIds`）
- `computeSCCGroup` 使用 primary module snapshot 判断收敛，不再检查辅助模块

### 重叠产线归组
- `mergeGraphAndAllocationLines()` 在 preview 阶段合并 graph 责任与 `target-production` 责任
- `computeBuildFlowPlan` 在求解后将目标产线模块合并进 graph node
- `makeSchemesWithGroups` 过滤掉已在 graph 中出现过的 allocation，消除事后拼接
- `mergeOverlappingLines` 不再被调用

### script/Vue 同源
- `analysis/scripts/build-plan/build-plan-production-line.ts` 调用 `createBuildFlowPlanPreview()` + `computeBuildFlowPlan()`
- `useBlueprintProductionStore` 调用同样的共享入口
- store 暴露 `previewResult` / `computeResult` 状态
