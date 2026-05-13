# build-plan-compute 任务

## Phase 1: Preview / Compute 边界重构

- [x] T0: 审查当前实现偏差并记录"需求以文档为准，当前代码有 bug，不得以代码行为反推需求"
- [x] T1: 明确 preview 数据结构，支持单条产线同时保存建材责任、gap 责任、用户目标责任
- [x] T2: 在 store 中拆清 preview 输出与 compute 输出，禁止 preview 阶段产出最终主要模块/辅助模块/steps
- [x] T3: 将"计算建造方案"按钮路径改为只消费 previewResult
- [x] T3.1: 新增或固定 previewResult / computeResult 状态字段
- [x] T3.2: 将 checkbox、目标模块、目标产物变动统一改为只驱动 previewResult 重算
- [x] T3.3: 将"计算建造方案"按钮路径改为只消费 previewResult

## Phase 2: 责任与相关产线模型

- [x] T4: 为每条责任补全 relatedLineGroupIds 等字段
- [x] T5: 替换 ProductionLineAllocation.goals 作为 preview 真相层的职责，新增显式 preview truth 类型
- [x] T6: 清理运行时重新推导"相关产线集合"的分支，统一改为读取 preview 结果
- [x] T7: 约束面板预览展示直接反映 preview 责任分配结果
- [x] T7.1: 新增 PreviewResult / PreviewLinePlan / PreviewResponsibility
- [x] T7.2: 删除 preview allocation 与 production allocation 的二次合并
- [x] T7.3: BuildPlanConstraintsPanel 仅消费 presenter 输出

## Phase 3: 目标速率公式统一

- [x] T8: 单线求解目标速率统一为 buildCost 需求/建造时间
- [x] T9: collectDemandSources / graph edge 聚合逻辑降级为辅助分析层
- [x] T10: 清理旧的 per-source Math.max 规则
- [x] T11: 单条产线内三类责任先合并，再统一计算目标速率
- [x] T11.1: 固定责任合并 → 建筑集合 → 目标速率 的共享主链
- [x] T11.2: graph edge demand 相关逻辑降级为辅助层输入

## Phase 4: 主模块 / 辅助模块求解

- [x] T12: compute 主流程只消费 preview truth
- [x] T13: 先根据目标速率求主要模块数量
- [x] T14: 辅助模块严格由主要模块结果派生
- [x] T15: 清理"辅助模块变化也参与收敛判断"的逻辑
- [x] T15.1: ComputeResult 显式分离 primaryModules / auxiliaryModules / allModules

## Phase 5: SCC / 循环依赖收敛

- [x] T16: SCC 场景实现迭代求解
- [x] T17: 显式区分"主要模块快照"与"辅助模块/autoFill 模块"
- [x] T18: 收敛判据统一为"主要模块数量不再变化"
- [x] T19: 清理旧的与辅助模块或其他次级指标相关的收敛判据
- [x] T19.1: 新增 PrimaryModuleSnapshot
- [x] T19.2: calculateBuildFlowPlan 中仅比较 PrimaryModuleSnapshot

## Phase 6: 分组与重叠产线

- [x] T20: 统一最终 grouped schemes 生成逻辑
- [x] T21: 重叠产线只保留一份 scheme，归入建材组
- [x] T22: 建材责任与生产责任前移到求解前合并
- [x] T23: 组内排序按依赖拓扑序，先建材后生产

## Phase 7: 单一共享入口

- [x] T24: 抽出并固定共享核心入口
- [x] T25: store 改为仅调用共享入口
- [x] T26: analysis script 改为仅调用共享入口
- [x] T27: Vue / presenter 改为只消费结果
- [x] T27.1: 固定共享入口为 createBuildFlowPlanPreview 与 computeBuildFlowPlan
- [x] T27.2: analysis script 输出 previewResult 与 computeResult 派生视图

## Phase 8: 默认 compute 输出改造

- [x] T28: 从默认 compute 链路移除 steps 生成职责
- [x] T29: 为 BuildScheme 新增 moduleSummaries
- [x] T30: 落实静态总耗时、静态总花费、材料总量、材料总花费、单价计算
- [x] T31: 落实模块排序与材料排序规则（tier 升序 + name 升序 / totalCredits 降序）

## Phase 9: Steps 逻辑边界重构

- [x] T32: 将 makeSchemeSteps() 从默认 compute 核心模块迁出
- [x] T33: 保持 steps 模式继续复用同一套算法
- [x] T34: Vue / presenter 范围新增 BuildStepsScheme 类型与组装逻辑
- [x] T35: BuildStepsScheme 不进入 store 真相层，不回写 store

## Phase 10: 详情弹窗两态展示

- [x] T36: 详情弹窗状态栏增加 steps 开关，默认关闭
- [x] T37: 默认模式显示模块汇总手风琴
- [x] T38: 默认模式展开区显示材料明细
- [x] T39: steps 模式切换为纯 step 列表
- [x] T40: 增加弹窗局部 loading、局部缓存与缓存失效逻辑
- [x] T41: 空模块场景空模板兜底，隐藏 steps 开关

## Phase 11: Energy Cells 口径修正

- [x] T42: 修正默认模式材料明细与静态成本统计中 energycells 的错误排除
- [x] T43: 修正 steps 模式材料明细与 steps 成本统计中 energycells 的错误排除
- [x] T44: energycells 仅在"循环建材产线寻找"语义中保留特殊处理

## Phase 12: Build Plan Store 拆分

- [ ] T45: 新增独立 useBuildPlanStore，承载 build-plan 真相层状态与动作
- [ ] T46: 将 buildGoals / buildMaterialPlanningEnabled / buildPlan / previewResult / computeResult / schemeGroups / loading 状态从 useBlueprintProductionStore 迁移到 useBuildPlanStore
- [ ] T47: 将 preview watcher 与 compute 入口迁移到 useBuildPlanStore
- [ ] T48: useBuildPlanPresenter 改为以 useBuildPlanStore 为主输入
- [ ] T49: BlueprintProductionWorkbenchView overview 入口改为同时注入两个 store
- [ ] T50: 清理 useBlueprintProductionStore 中遗留的 build-plan 真相层导出与双写路径

## Phase 13: 构建验证

- [x] T51: npm run build 通过
