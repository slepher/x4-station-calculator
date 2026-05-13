# build-flow-plan 需求

## 目标

将建造规划（build-plan）与建筑流（build-flow）整合。新增"建材产线" checkbox，勾上后利用 build-flow 中建材产出区(outputBuildTags)的连线关系自动推导建材产线依赖图，按图计算每条产线的模块数量。取代现有五种自举模式(bootstrapMode)。

## 已确认方案（审核重点）

### UI 变更

- **移除** `bootstrapMode` 下拉框（五种自举模式：None/Joint/CoupledIterative/NestedJoint/IsolatedSpecialized）
- **新增** checkbox "建材产线"，放在原 bootstrapMode 下拉框位置
- checkbox 状态**不持久化**（每次进入页面默认未勾上）

### 行为总览

| checkbox | 有 logic-flow plan | 行为 |
|----------|-------------------|------|
| 未勾上 | 任意 | 只输出目标产线 C（`expandGoalDependencies` + `autoFill`） |
| 勾上 | 无 | `planProductionForRates(C 的 buildCost rates)` 一次性计算一条建材产线 → 输出 2 个 scheme |
| 勾上 | 有 | 按下方算法推导依赖图并计算 → 多产线各为一个 scheme |

### 图构建

1. C = `expandGoalDependencies` + `autoFill`（与现有一致）
2. 从 C 的 `buildCost` 出发，沿 build-flow **建材产出区(outputBuildTags)** 的连线扩散，构建依赖图
3. **边方向** = 消费→供给（C 依赖产线 L → 边 C→L），即边从需求方指向供给方
4. 产线只入图一次，追踪的 ware 集合随图扩散扩充（最终 = 所有入边携带的 wareId 并集）
5. 识别 SCC（强连通分量）
6. 无 outputBuildTag 连接的 ware → 忽略（视为外部供应，不加入图）

### 计算顺序

- 按**叶子→根**拓扑序处理（叶子=最下游供给端，根=目标产线 C）
- 多 SCC 也按拓扑序处理（先处理叶子端 SCC，其收敛后的 buildCost rates 传递给上游 SCC/节点）

### DAG 节点计算

- 收集所有 upstream 产线的 buildCost rates → 用 `&` 独立约束（保留每个 source 完整明细，不取 max 合并）
- `planProductionForRates(demand)` **一次性计算**

### SCC 节点计算

SCC 作为外层循环处理：
- **内迭代顺序**：按消费→供给顺序（与边方向一致）
- **内迭代退出条件**：完整走完一个内迭代轮后，SCC 内所有产线的主要产出模块数量均无变化
- 每条产线判定：
  - 该产线的追踪 ware 集合 ∩ 自身 buildCost ≠ ∅ → **greedyFill 自举**（selfWares 仅限追踪 wares 部分，不需种子，因外部需求已确定）
  - 否则 → `planProductionForRates` 一次性计算
- SCC 收敛后，其各产线模块数确定，buildCost rates 固定，传递给下游节点

### 需求传递

- 使用 `&` 独立约束保留每个需求源完整明细（如 E 的需求 & D 的需求，各自检查满足率 ≥ 100%），不使用 `+` 合并
- 每个 source 的 rates 通过 `computeBuildRates(产线模块)` 获得

### 方案输出

- 每条产线 = 一个 scheme
- scheme label = 对应产线在 logic-flow 中的 groupDisplayName
- 建造顺序 = 叶子→根（先建供给线，后建依赖方，最后建 C）

### 算法无 build-flow plan 时的 fallback

- `planProductionForRates(C 的 buildCost rates)` 一次性计算一条建材产线
- 输出 2 个 scheme：建材产线 + 目标产线 C
- 不再对该建材产线做 self-bootstrap（不追踪其自身 buildCost）

### 旧代码清理策略

- **先实现新算法**（参考现有 bootstrapMode 的 greedyFill / planProductionForRates 等代码）
- 新算法功能验证无 bug 后，清除 bootstrapMode 的 **Store/UI/Presenter 暴露**（bootstrapMode 下拉框、状态、持久化、i18n）
- **旧 bootstrapMode 算法代码永久保留**（`calculateBuildPlan.ts` 中 Joint/CoupledIterative/NestedJoint/IsolatedSpecialized 分支不删除），供验证脚本使用

### 验证方案

通过命令行 TS 脚本验证新算法与旧算法输出一致：

- 脚本路径: `analysis/scripts/verifyBuildFlowPlan.ts`
- **模拟数据**：脚本内置每个旧自举模式对应的模拟 logic-flow + build-flow 数据，复现 Joint/CoupledIterative/NestedJoint/IsolatedSpecialized 的 A/B 连线拓扑
- **参数**：
  - `--classical <mode>` (`joint`/`coupled`/`nested`/`isolated`)：走旧 `calculateBuildPlan(bootstrapMode=X)` 算法
  - 无 `--classical`：走新 build-flow-plan 算法（用模拟的 flow 数据）
  - `--json`：输出结果为 JSON 便于 diff
- **验证方式**：对比 `--classical` 和无 `--classical` 的输出（modules/products/schemes）
- **运行**：`npx tsx analysis/scripts/verifyBuildFlowPlan.ts [--classical <mode>] [--json]`

## 边界

### In Scope

- 新增"建材产线" checkbox UI
- 基于 build-flow outputBuildTags 连线的依赖图构建算法
- DAG 节点 & 约束一次性计算
- SCC 内迭代收敛计算（greedyFill 自举 + 一次性计算）
- 多产线 scheme 输出（继承 logic-flow 产线名）
- 无 flow plan 时的 fallback 计算
- checkout 未勾上时的纯目标产线输出
- 新算法无 bug 后清除旧 bootstrapMode 的 Store/UI/Presenter 暴露（算法代码永久保留供验证脚本）
- TypeScript 类型定义（BuildFlowPlanGraph, BuildFlowPlanLine 等）
- Presenter 层接口更新（checkbox 状态、产线 scheme 列表）
- i18n key（checkbox 标签）

### Out of Scope

- 修改 build-flow 的数据模型或推导逻辑
- 修改 build-flow 的连线/绑定/分组机制
- checkbox 状态持久化
- 产线间模块重叠去重策略（C 和下游产线独立计算，可能有重复模块，后续规划处理）
- 编写测试代码
- 产线建造顺序的库存/时间模拟（沿用现有 BuildSchemeStep 机制）

## 验收标准（DoD）

1. bootstrapMode 下拉框已移除，替换为"建材产线" checkbox
2. checkbox 未勾上：仅输出一个 scheme（目标产线 C）
3. checkbox 勾上 + 无 logic-flow plan：输出 2 个 scheme（建材产线 + C）
4. checkbox 勾上 + 有 logic-flow plan：依赖图正确构建（可验证节点数、边数）
5. 无 outputBuildTag 连接的 ware 被忽略，不加入图
6. SCC 识别正确（DAG 节点一次计算，SCC 节点迭代收敛）
7. DAG 节点计算使用 `&` 独立约束保留每个 source 明细
8. SCli 内迭代按消费→供给顺序，退出条件为所有产线主要产出模块数不变
9. 自举判定基于追踪 ware 集合 ∩ buildCost（不含产出上所有 ware）
10. SCC 收敛后的 buildCost rates 正确传递给下游节点
11. 方案按叶子→根建造顺序输出
12. scheme 标签正确继承 logic-flow 产线名称
13. 方案卡片和步骤明细与现有 BuildPlanPanel / BuildPlanStepsModal 兼容
14. 旧 bootstrapMode 的 Store/UI/Presenter 暴露在所有功能正常后已清理（算法代码永久保留）
15. `npm run build` 通过
16. `analysis/scripts/verifyBuildFlowPlan.ts` 脚本对所有四种模式，`--classical` 与无 `--classical` 输出的 scheme 一致：
    - 产线数量、moduleIds 数量组合、netProduction 一致
    - 每个 scheme 的 targetRateSources 数量和标签一致
    - 每个 source 的 ware 速率、满足率、materials 总量一致

## 未决项

无
