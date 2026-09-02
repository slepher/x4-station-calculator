# Recycling Flow — Implementation Tasks

## 1. Processing Module 数据生成

- [ ] 1.1 在 `scripts/x4_data_processor.py` 中识别 `class="processingmodule"`，读取 `<properties><products><ware>` 的 wareId 与模块批量。
- [ ] 1.2 对每个 product 精确读取对应 Ware 的 `processing` recipe，以 `product.amount / recipe.amount` 放大 inputs，并生成 `cycleTime`、outputs/inputs 小时率。
- [ ] 1.3 保持 Processor 的 `type="processingmodule"`、现有 method 与零 workforce bonus；缺少 processing recipe 时输出明确警告，不回退到 default recipe。
- [ ] 1.4 确认 Generic Processor 生成 `scrapmetal: 9000/h`、`rawscrap: 9000/h`、`energycells: 90000/h`，Kha'ak Processor 生成 `khaakscrapmetal: 3000/h`、`rawkhaakscrap: 3000/h`、`energycells: 30000/h`。

## 2. 游戏数据选择器与候选集合

- [ ] 2.1 在 `src/store/logic/useGameData.ts` 保持普通 `findModuleForWare` 排除 recycling，并使有有效 outputs 的 processingmodule 可作为普通上游生产者。
- [ ] 2.2 新增精确的 `findRecyclingModuleForWare`，只按 `method="recycling" + output wareId` 选择 Recycler，不增加 sequential fallback。
- [ ] 2.3 在 `precomputeCandidateWares` 中生成独立的 `wareSetsByIndustrialRace.recycling`，内容只来自 recycling 模块全部 outputs，不污染普通 race 候选。
- [ ] 2.4 在 `useGameDataStore.ts` 暴露 recycling 候选和领域选择能力，保持 store 输出领域数据而非 Vue 专用结构。

## 3. Logic Flow 回收链路

- [ ] 3.1 在 `logicFlowStream.ts` 对 `manual + recycling group` 使用 Recycler 选择器，其他自动上游使用普通生产者选择器。
- [ ] 3.2 Recycler 选中后，以明确 group lock 或模块 race 作为上游 lineage，不把 `recycling` 当作 race 传播。
- [ ] 3.3 同步 `useLogicFlowStore.ts` 中创建、连接、提升、重复检查和 lineage 更新入口，使其复用同一选择规则。
- [ ] 3.4 保持 moduleId 去重；通过 Recycler 任意 output 添加时只保留一个节点，模块产物高亮从 `module.outputs` 覆盖全部 outputs。
- [ ] 3.5 更新 `hydrateSavedFlowGroups.ts` 与 `buildPlanLogicFlowSource.ts` 的恢复展开，使保存的 Recycler moduleId 能重建 Processor、Energy Cells 和原料边界。
- [ ] 3.6 保持 `SavedFlowNode`、storage version 与 `logicFlowImport.ts` 的 moduleId 聚合结构不变；不新增 selected-output 或 recipe snapshot。

## 4. Recycling 候选 Presenter 与 Vue

- [ ] 4.1 新增 Logic Flow Candidate presenter，组装分类/子类型、recycling 标签、候选 Ware 展示、拖拽与 quick-add 动作。
- [ ] 4.2 修改 `LogicFlowCandidateZone.vue` 仅通过 presenter 获取业务展示数据和触发行为，并移除该组件对 game-data/logic-flow store 的直接访问。
- [ ] 4.3 在 `src/locales/en.json` 与 `src/locales/zh-CN.json` 增加 recycling 子类型文案。
- [ ] 4.4 更新 `ProductionLineGroup.subCategory` 相关类型注释与分支，明确其可表示 recycling subtype，且不把该值作为 race。

## 5. Station、Live 与 Blueprint 自动补全

- [ ] 5.1 在 `bestModuleSelector.ts` 删除 `solid/liquid` 的提前拒绝；普通生产者允许 `production` 与 `processingmodule`，继续排除 recycling。
- [ ] 5.2 保持 `calculateAutoIndustryModules` 通过共享选择器补齐缺口：Scrap Metal 添加 Processor，Raw Scrap 因无生产者自然停止，普通建筑材料不选择 Recycler。
- [ ] 5.3 审核 StationDerivedMap、Live Production、Blueprint Production 与 production actions 的调用，复用共享规则，不增加各环境专用 processor 分支。
- [ ] 5.4 保持生产流完整遍历模块 outputs/inputs，确认多产出 Recycler 只计一次且不做 cycleTime 二次换算。

## 6. Build Plan 一致性

- [ ] 6.1 在 `calculateBuildPlan.ts` 与 `calculateBuildFlowPlan.ts` 删除 transport + `type === "production"` 的上游预判，直接由共享生产者选择器决定递归或停止。
- [ ] 6.2 在 `buildPlanProductionLine.ts` 同步依赖展开规则，并在已有 `preferredModuleIdsByWare` 或明确 goal moduleId 时保留该模块。
- [ ] 6.3 在 `logicFlowResponsibility.ts` 的局部 Ware 生产者查找中排除 recycling，避免按数组首项误选 Recycler；显式 build-module 继续按 moduleId 匹配。
- [ ] 6.4 在 `planningRecommendedModules.ts` 的 reference production floor 中纳入非 recycling processingmodule。
- [ ] 6.5 保持 Build Plan 净流量、成本和模块数量从完整 outputs/inputs 计算，不为多产出模块创建重复 SavedModule。

## 7. Build Flow 排除规则

- [ ] 7.1 在 `buildFlowDerivation.ts` 派生 line cards 前排除 `subCategory="recycling"` 的整个 Logic Flow 组。
- [ ] 7.2 在 `computeProductionLineAllocation.ts` 的生产目标分配入口排除 recycling 组，并确保 `logicFlowResponsibility.ts` 不通过后备扫描把目标重新归给该组。
- [ ] 7.3 确认被排除组不生成 Build Flow source tags、建筑材料连接或责任归属，同时显式 Recycler build-module 目标及成本计算保持可用。

## 8. 静态数据同步

- [ ] 8.1 使用现有全版本 processor 入口重新生成 8.0 Diplomacy 与 9.0 Empire 数据。
- [ ] 8.2 检查生成差异只包含本变更预期的 Processor 数据和关联确定性输出，不修改用户持久化数据。

## 9. 构建验证

- [ ] 9.1 运行 `npm run build`。
- [ ] 9.2 若出现编译错误，修复代码并重新运行 `npm run build`，直至通过或形成明确 blocker。
