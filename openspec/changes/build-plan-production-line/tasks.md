# build-plan-production-line 任务

## Phase 1: 共用搜索函数

- [x] T1: 新建 `src/store/logic/productionLineSearch.ts`，提取 `findGroupProducingWare` 为独立导出函数（manual > auto 优先级，返回 `{ sourceGroupId }`）
- [x] T2: 重构 `src/store/logic/computeProductionLineAllocation.ts`，将 `findIsolatedNode` / `walkUpstream` 中的产线搜索逻辑改为调用 `findGroupProducingWare`

## Phase 2: 依赖图 isolated 扩展

- [x] T3: 在 `src/store/logic/buildFlowPlanGraph.ts` 新增 `getGroupIsolatedWares`、`isGroupInBuildFlowView`、`getGroupBuildMaterialWaresWithConnection`、`getGroupBuildCostWaresWithConnection` 函数
- [x] T4: 修改 `buildFlowPlanGraph` BFS，融入 isolated 扩展：新增 `isIsolatedExpansion` 队列标记，isolated 扩展时调用 `findGroupProducingWare`，递归检查新入图产线的 isolated；B 的建材来源根据是否在 buildFlowGroups 中分别走 buildMaterialTags 或 outputBuildTags；无连线时忽略不回退
- [x] T5: `buildFlowPlanGraph` 新增 `groups` 参数（所有 logic-flow groups），用于 isolated 搜索

## Phase 3: 类型定义

- [x] T6: `src/types/build-plan.ts` 新增 `BuildSchemeGroup` 接口（`groupType: 'build-material' | 'production'`、`groupLabel`、`schemes`）

## Phase 4: Store 提前计算

- [x] T7: `useBlueprintProductionStore` 新增 `buildFlowPlanGraphResult`（shallowRef）、`buildFlowPlanAllocations`（ref）、`buildFlowPlanLoading`（ref）
- [x] T8: 新增 `computeBuildFlowPlanPreview` 函数：勾上时执行依赖图构建 + SCC + 建材产线分配
- [x] T9: 新增 watch：监听 `buildFlowMode`、`buildGoals`、logic-flow/build-flow 依赖数据变化，触发 `computeBuildFlowPlanPreview`

## Phase 5: C 拆分 + 重叠合并 + 分组输出

- [x] T10: `calculateBuildFlowPlan.ts` 新增 `splitCToLineSchemes` 函数：C 按产线分配拆分，每个产线独立 expandGoalDependencies + autoFill
- [x] T11: 新增 `mergeOverlappingLines` 函数：检测重叠产线（groupId 同时在依赖图和产线分配中），归入建材分组，需求速率叠加相加
- [x] T12: 新增 `makeSchemesWithGroups` 函数：输出 `BuildSchemeGroup[]`（建材产线分组 + 生产产线分组）
- [x] T13: 修改 `computePlan`：使用已有 `buildFlowPlanGraphResult`，调用 `makeSchemesWithGroups` 生成分组 schemes

## Phase 6: 建材产线分配预览

- [x] T14: 新增 `computeBuildFlowPlanAllocations` 函数：从依赖图节点提取建材产线分配（trackedWares → derived goals），与产线分配逻辑一致
- [x] T15: `useBuildPlanPresenter` 新增 `buildFlowPlanAllocations` computed

## Phase 7: UI

- [x] T16: `ProductionLineAllocationSection.vue` 支持 `readonly` prop 和 `title` prop，建材分配预览区为只读
- [x] T17: `BuildPlanConstraintsPanel.vue` 在现有产线分配区域上方新增建材产线分配预览区（勾上后显示）
- [x] T18: `BuildPlanPanel.vue` scheme 卡片按 `BuildSchemeGroup` 分组渲染（建材产线/生产产线两大分组）

## Phase 8: i18n

- [x] T19: `zh-CN.json` 新增 `build_plan.group_build_material`（建材产线）、`build_plan.group_production`（生产产线）、`build_plan.build_material_allocation`（建材产线分配）
- [x] T20: `en.json` 新增对应英文

## Phase 9: 命令行测试脚本

- [x] T22: 新建 `analysis/scripts/build-plan/build-plan-production-line.ts`，支持 `--module`/`--ware`/`--flow`/`--index`/`--json` 参数
- [x] T23: 实现 `deserializePlan` 函数：SavedFlowGroup → ProductionLineGroup（含 isolated 节点、manual 节点）
- [x] T24: 载入 `buildFlow.assignments`，调用 `deriveBuildFlowView` + `computeVirtualEdges` 补充默认连线，组装 `BuildFlowPlanView`
- [x] T25: 计算目标产线 C 模块，调用 `buildFlowPlanGraph` 构建依赖图
- [x] T26: 输出：产线组、BuildFlow 视图、BuildFlow 连线（含虚拟连线）、依赖图（节点/边）、SCC 循环图

## Phase 10: 构建验证

- [x] T27: `npm run build` 通过
