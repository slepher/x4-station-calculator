# Recycling Flow — Design

## 架构

本变更沿用现有权威数据模型：`X4Module.outputs` 与 `X4Module.inputs` 均为小时率，Logic Flow、Station 和 Build Plan 只通过 moduleId 读取当前版本 `modulesMap`。

```text
module_macros <products> + ware processing recipe
  -> x4_data_processor
  -> modules.json
  -> modulesMap / modulesByOutputMap
     |- Logic Flow: Recycler 根节点 + Processor 自动上游
     |- Station: moduleId 导入 + 缺口自动补全
     `- Build Plan: moduleId 保留 + 依赖递归

recycling Logic Flow group
  -X-> Build Flow 建筑产线
```

## 数据不变量

1. `outputs`/`inputs` 始终是每小时数量；消费者不得再乘除 `cycleTime`。
2. 普通自动生产者允许 `production` 与 `processingmodule`，但必须排除 `method="recycling"`。
3. recycling 根模块只能由 recycling 选择规则产生，不得进入普通 Hull Parts 等 Ware 的自动生产者集合。
4. 原料边界由“找不到合格生产模块”决定，不由 transport 类型决定。
5. 一个 moduleId 在同一 Logic Flow 组中只对应一个模块节点；多产出不复制模块数量。
6. recycling 组不参与 Build Flow 建筑产线派生。

## 决策

### D1: Processing Module 复用 Ware recipe

位置：`scripts/x4_data_processor.py`

生产模块 queue 继续使用现有聚合算法；`processingmodule` 单独读取：

```text
for product in properties/products/ware:
  recipe = recipes[product.ware]["processing"]
  batchScale = product.amount / recipe.amount
  cyclesPerHour = 3600 / recipe.time

  outputs[product.ware] += product.amount * cyclesPerHour
  inputs[inputWare] += recipeInputAmount * batchScale * cyclesPerHour
```

Processor 的 `cycleTime` 使用 processing recipe 时间。该路径不硬编码 Scrap Metal 数值，因此同时覆盖 Generic 与 Kha'ak processor；缺失 processing recipe 时不使用 default recipe 兜底，记录可定位的生成警告并跳过该 product。

Processor 保持原始 `type="processingmodule"` 与现有 `method="none"`，业务选择依赖 type 与实际 outputs，不扩展 method union。

### D2: 普通生产者与 Recycler 根节点分离

位置：`src/store/logic/useGameData.ts`

- 保留现有 `findModuleForWare` 作为普通生产者入口：继续排除 recycling，并明确接受已生成 outputs 的 processingmodule。
- 新增 `findRecyclingModuleForWare(wareId, modulesByOutputMap)`：只接受 `method="recycling"` 且实际产出目标 Ware 的模块。
- recycling outputs 在当前数据中可以唯一定位 Generic、Terran 或 Kha'ak Recycler；不新增 module picker。

`precomputeCandidateWares` 为 `wareSetsByIndustrialRace.recycling` 建立独立集合：先收集 recycling 模块全部 outputs，再从 Recycler inputs 开始使用普通生产者规则递归收集 Processor 产物和 Tier 0 输入；不把 Recycler 混入 default/terran/teladi 普通种子。

### D3: 根节点与自动上游使用不同选择规则

位置：`src/store/logic/logicFlowStream.ts`、`src/store/useLogicFlowStore.ts`

`computeExpandUpstream` 使用明确业务状态选择模块：

```text
source == manual AND group.subCategory == recycling AND ware has recycling producer
  -> findRecyclingModuleForWare

其他情况（包括 recycling 中手动添加 Tier 1 Processor 产物）
  -> findModuleForWare（普通生产者）
```

选中 Recycler 后，自动上游 lineage 使用 group lock（若明确锁定）或 Recycler 自身 race；不会把字符串 `recycling` 当作 race 继续传递。Processor 和 Energy Cells 因此走普通上游选择，Raw Scrap 因没有 producer 成为叶子资源节点。

所有直接创建、连接、提升和切换 lineage 的入口必须调用同一规则，不在 Vue 或调用方复制 module 选择分支。

### D4: 多产出节点保持 module-centric

FlowNode 继续保留单个代表 `wareId` 用于布局和添加入口，但模块产物集合以 `Object.keys(module.outputs)` 为准：

- 按 moduleId 去重，Hull Parts 与 Claytronics 不创建两个 Recycler 节点；
- Logic Flow 中对模块产物进行高亮时覆盖全部 outputs；
- Station/Build Plan 数值计算读取完整 outputs/inputs。

SavedFlowNode 不新增 selected-output。恢复时允许使用模块的确定性首个 output 作为布局锚点；该锚点不得重新定义模块产物或模块数量。

### D5: 保存和 Station 导入不增加适配层

位置：`src/store/useLogicFlowStore.ts`、`src/store/logic/hydrateSavedFlowGroups.ts`、`src/store/logic/buildPlanLogicFlowSource.ts`、`src/store/logic/logicFlowImport.ts`

现有保存边界维持不变：

```text
manual module node -> { module: moduleId }
isolated node      -> { isolated: wareId }
auto node          -> 不保存
```

Station import 继续把 manual moduleId 聚合为 `SavedModule[]`。不在 import 层按 Ware 重新选择模块，也不复制 outputs/inputs。恢复和 Build Plan snapshot 只需确保 Recycler 输入能使用普通规则重建 Processor 自动节点。

### D6: Station 使用“存在合格生产者”作为资源边界

位置：`src/store/logic/bestModuleSelector.ts`、`src/store/logic/calculateProductionFlows.ts`

`findBestProducer` 删除 `solid/liquid` 提前返回；候选条件改为：

```text
module.outputs[wareId] > 0
AND module.type in { production, processingmodule }
AND module.method != recycling
```

这样 Scrap Metal 虽为 solid，仍能找到 Processor；Raw Scrap 没有 outputs 候选，自然返回空。`calculateAutoIndustryModules` 无需增加 Scrap Metal 特判。

Live Production 与 Blueprint Production 复用 `StationDerivedMap`、production actions 和共享选择器，不分别增加 processor 分支。

生产界面的 planning presenter 将非 recycling 的 `production` 与 `processingmodule` 一并作为自动工业模块展示；自动补全结果本身不增加 UI 专用副本。

### D7: Build Plan 删除重复的资源启发式

位置：

- `src/store/logic/calculateBuildPlan.ts`
- `src/store/logic/calculateBuildFlowPlan.ts`
- `src/store/logic/buildPlanProductionLine.ts`
- `src/store/logic/logicFlowResponsibility.ts`
- `src/store/logic/planningRecommendedModules.ts`

依赖递归不再组合 `transport !== solid/liquid` 与 `type === production` 做预判；直接递归调用 `findBestProducer`，由共享候选规则决定继续或停止。这样同时删除重复扫描和与 Station 不一致的判断。

`buildPlanProductionLine` 已有 `preferredModuleIdsByWare` 时继续优先使用明确 moduleId。`logicFlowResponsibility` 的局部 Ware 查找至少排除 recycling，避免依赖数组顺序把普通建筑材料归给 Recycler。参考生产 floor 接受非 recycling processingmodule。

### D8: Recycling 组不进入 Build Flow

位置：

- `src/store/logic/buildFlowDerivation.ts`
- `src/store/logic/computeProductionLineAllocation.ts`
- `src/store/logic/logicFlowResponsibility.ts`

在派生 Build Flow line cards 前排除 `group.subCategory === "recycling"` 的整个组。生产目标分配入口同样只处理非 recycling 组，并将该集合传入责任解析，避免 allocation/responsibility 的后备扫描重新匹配 Recycler。Recycler、其自动 Processor 和 Energy Cell 节点因此都不会进入建筑产线卡片、连接或责任归属。

该过滤只影响 Build Flow view；显式 `build-module` 目标、模块建造成本、Station 生产流和 Build Plan 数值计算不受影响。

### D9: Recycling 候选 UI 使用 presenter

位置：

- `src/components/logic-flow/presenters/useLogicFlowCandidatePresenter.ts`（新增）
- `src/components/logic-flow/LogicFlowCandidateZone.vue`
- `src/locales/en.json`
- `src/locales/zh-CN.json`

presenter 负责：

- industrial/agricultural/recycling 子类型列表与标签；
- 当前候选 Ware 的展示结构和排序；
- recycling Tier 1 的可添加状态与 Tier 0 的只读状态；
- quick add、拖拽、加入现有组等 UI 动作；
- 根据 moduleId 组装多产出高亮信息。

Vue 只消费 presenter 返回的数据和动作。为满足新 UI 分层约束，修改 Candidate Zone 时同步移除该组件对 game-data/logic-flow store 的直接访问；store 不返回 Vue 专用卡片结构。

## 影响范围

| 区域 | 主要文件 | 行为 |
|---|---|---|
| 数据生成 | `scripts/x4_data_processor.py` | 解析 processingmodule `<products>`，生成小时率 |
| 游戏数据索引 | `useGameData.ts`, `useGameDataStore.ts` | recycling candidates 与精确选择器 |
| Logic Flow | `logicFlowStream.ts`, `useLogicFlowStore.ts`, hydration/snapshot | Recycler 根节点、Processor 自动上游、去重与高亮 |
| Logic Flow UI | candidate presenter、`LogicFlowCandidateZone.vue`、locales | recycling 子类型入口 |
| Station/Live/Blueprint | `bestModuleSelector.ts`, shared production calculation | processor 自动补全 |
| Build Plan | build-plan calculation/production-line/responsibility files | processor 依赖递归与明确 moduleId 保留 |
| Build Flow | `buildFlowDerivation.ts`, `computeProductionLineAllocation.ts`, `logicFlowResponsibility.ts` | 排除 recycling 组及其责任归属 |
| 静态数据 | 8.0/9.0 `modules.json` | Processor outputs/inputs/cycleTime |

## 数据与持久化兼容

- 不新增 Flow storage version，不修改 SavedFlowNode schema。
- 不新增 X4Module method 值。
- 游戏版本切换后继续通过 moduleId 解析该版本权威数据。
- 旧方案没有 recycling subCategory，不需要 migration；新值由现有 string 字段承载。

## 风险与约束

- processingmodule product 找不到 processing recipe 时必须显式告警，不能静默使用不相干 recipe。
- recycling 子类型不是 race；任何 lineage 计算都不得把它当作 race。
- 多产出模块的代表 wareId 只用于布局。后续若要求保存“用户从哪个 output 添加”，再单独升级 SavedFlowNode；本次不提前扩展。
- Processor 的实际 uptime 受拖船和投递影响，本变更只表示名义配方小时率。

## 验证策略

实现阶段只执行静态生成与 `npm run build`。Unit/E2E 用例由后续 `/x4:test` 工作流建立，至少覆盖：processor 数据、普通/回收选择隔离、Station auto-fill、Build Plan 依赖递归、moduleId 导入去重、recycling Build Flow 排除。
