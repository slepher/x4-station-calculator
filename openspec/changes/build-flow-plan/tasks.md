# build-flow-plan 任务

## 依赖关系

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10
  (类型)  (图构建)  (产线计算)  (Store)  (Presenter)  (UI)  (集成)  (清理)  (脚本)  (验证运行)
```

T2 和 T3 可部分并行（T3 依赖 T2 的图结构但可在接口定好后并行开发）。

## 任务列表

### T1: 新增类型定义 [x]

- 文件: `src/types/build-plan.ts`
- 新增 `BuildFlowPlanLine` 接口：
  - `lineGroupId: string`
  - `lineName: string`
  - `trackedWares: string[]`
  - `modules: SavedModule[]`
  - `moduleIds: string[]`（主要产出模块 id）
  - `isSelfBootstrap: boolean`
  - `netProduction: Record<string, number>`
- 新增 `BuildFlowPlanEdge` 接口：
  - `fromLineKey: string`（`'__C__'` 表示 C）
  - `toLineKey: string`
  - `wareId: string`
  - `sourceLabel: string`
- 新增 `BuildFlowPlanGraph` 接口：
  - `nodes: Map<string, BuildFlowPlanLine>`
  - `edges: BuildFlowPlanEdge[]`
  - `sccGroups: string[][]`
  - `cModules: SavedModule[]`
  - `cBuildCostRates: Record<string, number>`
- 标记 `BootstrapMode` 枚举为 `@deprecated`（待 T8 清除）

### T2: 实现依赖图构建算法 [x]

- 文件: `src/store/logic/buildFlowPlanGraph.ts`（**新增**）
- 导出 `buildFlowPlanGraph(cModules, buildFlowView, modulesMap, waresMap, getGroupDisplayName): BuildFlowPlanGraph`
- 实现步骤：
  - C 的 buildCost 计算（复用 `computeBuildRates`）
  - BFS 扩散：沿 outputBuildTags 连线找产线 → 加节点 → 加边 → 取产线的 buildCost 继续扩散
  - `findOutputBuildConnection(wareId, buildFlowView)` — 只看 outputBuildTags，assignment 优先 virtualEdge
  - 产线只加入图一次，追踪 ware 集合随扩散扩充
  - 无连接的 ware 忽略
  - SCC 识别（Tarjan 算法或 Kosaraju 算法）
  - 单节点非自环的不算 SCC

### T3: 实现产线计算算法 [x]

- 文件: `src/store/logic/calculateBuildFlowPlan.ts`（**新增**）
- 导出 `computeFlowPlanLines(graph, modulesMap, waresMap, currentModules): BuildFlowPlanGraph`
- 导出 `makeSchemes(graph, modulesMap, waresMap, currentModules): BuildScheme[]`
- 实现步骤：
  - **拓扑排序**：叶子→根顺序（DAG节点 + SCC组）
  - **DAG 节点计算**（`computeDagNode`）：
    - 收集上游 buildCost rates → & 约束（保留每个 source 明细）
    - `planProductionForRates` 一次性计算
    - `calculateAutoFillModules` 补充
    - 计算 `moduleIds`（产出 trackedWares 的模块）
  - **SCC 节点计算**（`computeSCC`）：
    - 预判定自举：trackedWares ∩ buildCost
    - 外层迭代：按消费→供给顺序处理
    - 自举产线 → greedyFill（selfWares 仅限追踪 wares，无需 seed）
    - 非自举产线 → `planProductionForRates` 一次性计算
    - 退出条件：所有产线主要产出模块 id 数量组合无变化
    - 安全上限 60 轮
  - **方案生成**（`makeSchemes`）：
    - 叶子→根顺序出 scheme
    - scheme label = 产线 groupDisplayName
    - scheme targetRateSources = 入边需求明细

### T4: Store 变更 [x]

- 文件: `src/store/useBlueprintProductionStore.ts`
- 新增 `buildFlowMode: Ref<boolean>`（默认 false，不持久化）
- 新增 `setBuildFlowMode(mode: boolean): void`
- 修改 `computePlan()`：
  - `buildFlowMode = false` → 仅输出 C
  - `buildFlowMode = true && !buildFlowView` → fallback：`planProductionForRates(C buildCost)` → 2 个 scheme
  - `buildFlowMode = true && buildFlowView` → 调用 T2+T3 算法
- 标记旧 `bootstrapMode` / `setBootstrapMode` 为 `@deprecated`（待 T8 清除）
- 标记 `calculateBuildPlan` 中 bootstrapMode 分支为 `@deprecated`

### T5: Presenter 变更 [x]

- 文件: `src/components/empire/presenters/useBuildPlanPresenter.ts`
- 新增 `buildFlowMode: ComputedRef<boolean>`（从 store 映射）
- 新增 `setBuildFlowMode(mode: boolean): void`
- 新增 `buildFlowView: ComputedRef<BuildFlowView | null>`（从 logicFlow store 读取）
- 确保 `allocations`、`schemes` 等输出与新算法兼容

### T6: UI 变更 [x]

- 文件: `src/components/empire/BuildPlanConstraintsPanel.vue`
- **移除** bootstrapMode 下拉框组件及对应 v-model 绑定
- **新增** checkbox "建材产线"：
  - 放在原 bootstrapMode 下拉框位置
  - `<input type="checkbox" :checked="buildFlowMode" @change="setBuildFlowMode(...)">`
  - label 使用 i18n key `sector.build_plan.build_flow_mode`
- 文件: `src/locales/zh-CN.json`
  - 新增 `"sector.build_plan.build_flow_mode": "建材产线"`
- 文件: `src/locales/en.json`
  - 新增 `"sector.build_plan.build_flow_mode": "Build Material Lines"`

### T7: 集成验证 [x]

- 确保新算法产出的 `BuildScheme[]` 能被 `BuildPlanPanel.vue` 和 `BuildPlanStepsModal.vue` 正常渲染
- 端到端验证：
  - checkbox 未勾上 → 只出 C
  - checkbox 勾上 + 无 flow plan → 2 个 scheme
  - checkbox 勾上 + 有 flow plan → 多产线 scheme
- 验证 `npm run build` 通过
- 验证旧 bootstrapMode 分支不再被触发但代码仍存在（可做 dead code 标记清理）

### T8: 清除旧 bootstrapMode Store/UI/Presenter [x]

- **前置条件**: T1-T7 全部完成且功能验证通过
- **重要**: 旧 bootstrapMode **算法代码永久保留**（`calculateBuildPlan.ts` 中 Joint/CoupledIterative/NestedJoint/IsolatedSpecialized 分支不删除），供 T9 验证脚本使用
- 文件: `src/types/build-plan.ts`
  - 删除 `BootstrapMode` 枚举
  - 删除 `CalculateBuildPlanInput.bootstrapMode` 字段
  - 保留 `BuildFlowPlanLine`、`BuildFlowPlanEdge`、`BuildFlowPlanGraph` 类型
- 文件: `src/store/logic/calculateBuildPlan.ts`
  - 保留所有 bootstrapMode 分支代码（仅供验证脚本引用）
  - 主流程中的 bootstrapMode 路由移除（替换为 buildFlowMode 路由）
- 文件: `src/store/useBlueprintProductionStore.ts`
  - 删除 `bootstrapMode` ref
  - 删除 `setBootstrapMode`
  - 删除 localStorage 持久化中的 bootstrapMode 字段
  - 保留 `BootstrapMode` 类型引用（用于验证脚本）
- 文件: `src/components/empire/presenters/useBuildPlanPresenter.ts`
  - 删除 `bootstrapMode` / `bootstrapModes` / `setBootstrapMode` 相关导出
- 文件: `src/locales/zh-CN.json` / `src/locales/en.json`
  - 删除 `bootstrap_mode`、`bootstrap_none`、`bootstrap_joint`、`bootstrap_coupled`、`bootstrap_isolated`、各模式方案标签等 key

### T9: 验证脚本 [x]

- 文件: `analysis/scripts/verifyBuildFlowPlan.ts`（**新增**）
- 导出旧方案计算函数（供脚本独立调用，不依赖 runtime store）
- **模拟数据**: 内置每种旧自举模式的模拟 logic-flow + build-flow 数据：
  - Joint: 模拟 D(A+B) 联合产线的 build-flow 连线（D 自身产出自引）
  - CoupledIterative: 模拟 A↔B 耦合产线的 build-flow 连线（A 产出 hullparts+claytronics，B 产出 advancedcomposites+plasmaconductors）
  - NestedJoint: 模拟 A 先算→D(A+B) 联合自举的 build-flow 连线（A 产出 hullparts+claytronics，D 产出 A+B）
  - IsolatedSpecialized: 模拟 B 孤岛→A 自举的 build-flow 连线
- **参数**:
  - `--classical <mode>` (`joint`/`coupled`/`nested`/`isolated`)：走旧 `calculateBuildPlan(bootstrapMode=X)` 算法
  - 无 `--classical`：走新 build-flow-plan 算法（用模拟的 flow 数据）
  - `--json`：输出结果为 JSON 便于 diff
- **验证**: 对比 `--classical` 与无 `--classical` 的输出：
  - 产线数量一致
  - 每条产线的 moduleIds 数量组合一致
  - 每条产线的 netProduction（主要产出 ware）一致
  - 每条产线的 `targetRateSources` 数量和标签一致（如 `C建材需求`、`B建材需求`、`A_不能自产` 等）
  - 每个 source 的各 ware 需求速率一致
  - 每个 source 的各 ware 满足率一致（产能/需求 百分比）
  - 每个 source 的 materials 建材总量一致
- **运行**: `npx tsx analysis/scripts/verifyBuildFlowPlan.ts [--classical <mode>] [--json]`

### T10: 运行四种模式验证 [x]

- **前置条件**: T9 完成
- 分别运行四种模式的对比验证，确保新旧算法输出一致：
  ```bash
  npx tsx analysis/scripts/verifyBuildFlowPlan.ts --classical joint --json
  npx tsx analysis/scripts/verifyBuildFlowPlan.ts --classical coupled --json
  npx tsx analysis/scripts/verifyBuildFlowPlan.ts --classical nested --json
  npx tsx analysis/scripts/verifyBuildFlowPlan.ts --classical isolated --json
  ```
- 每行输出新旧算法的 scheme 对比（产线数量、moduleIds 数量组合、netProduction、targetRateSources 各 source 的 ware 速率和满足率）
- 全部通过后本任务完成
