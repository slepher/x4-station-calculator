# Build Flow Plan Specification

## Purpose

将 build-flow 建材产出区连线作为建材产线依赖关系的自动推导源，实现"建材产线" checkbox 控制的一键建图计算，替代现有五种自举模式。

## ADDED Requirements

### Requirement: 建材产线 Checkbox

用户可通过 checkbox "建材产线" 控制是否启用 build-flow 驱动的建材产线计算。

#### Scenario: Checkbox 未勾上

- **前提** 用户在建造规划面板中已添加建造目标（build goals）
- **当** "建材产线" checkbox 处于未勾上状态
- **并且** 用户点击计算按钮
- **那么** 系统输出仅包含一个 scheme（目标产线 C = `expandGoalDependencies` + `autoFill`）
- **并且** 不做任何建材产线计算

#### Scenario: Checkbox 勾上但无 logic-flow plan

- **前提** "建材产线" checkbox 勾上
- **并且** 当前无激活的 logic-flow plan（build-flow 数据为空）
- **当** 用户点击计算按钮
- **那么** 系统使用 `planProductionForRates(C 的 buildCost rates)` 一次性计算一条建材产线
- **并且** 输出 2 个 scheme（建材产线 → 目标产线 C）

#### Scenario: Checkbox 勾上且有 logic-flow plan

- **前提** "建材产线" checkbox 勾上
- **并且** 当前有激活的 logic-flow plan，build-flow 建材产出区有 outputBuildTag 连线
- **当** 用户点击计算按钮
- **那么** 系统构建依赖图并按图计算每条产线的模块数
- **并且** 每条产线输出为一个 scheme，按叶子→根顺序排列

#### Scenario: Checkbox 状态不持久化

- **前提** 用户勾上 "建材产线" checkbox 并完成计算
- **当** 用户刷新页面或重新进入
- **那么** checkbox 恢复为默认未勾上状态

---

### Requirement: 依赖图构建

系统从目标产线 C 的 buildCost 出发，沿 build-flow 建材产出区连线扩散，构建完整依赖图。

#### Scenario: 图构建入口

- **前提** C = `expandGoalDependencies` + `autoFill`
- **当** 依赖图构建开始
- **那么** 系统计算 C 的 buildCost（通过 `computeBuildRates`）
- **并且** 以 C 的 buildCost 中出现的所有 wareId 作为初始追踪 ware 集合

#### Scenario: 沿 outputBuildTag 连线扩散

- **前提** 当前追踪的 ware 集合中包含 wareId = w1
- **并且** build-flow 建材产出区(outputBuildTags)中存在 w1 的连线（assignment 或 virtualEdge）指向产线 L1
- **当** 图扩散进行
- **那么** 产线 L1 加入依赖图
- **并且** 添加边 C→L1（表示 C 依赖 L1 的产出）
- **并且** w1 加入 L1 的追踪 ware 集合

#### Scenario: 无连接 ware 忽略

- **前提** 某 ware 在 buildCost 中出现
- **并且** 该 ware 在 build-flow 建材产出区(outputBuildTags)中无任何连线
- **当** 图扩散进行
- **那么** 该 ware 被忽略，视为外部供应
- **并且** 不产生新产线节点

#### Scenario: 产线只入图一次，追踪 ware 可扩充

- **前提** 产线 L1 已通过 ware w1 加入图
- **并且** 扩散过程中发现 L1 的另一产出 ware w2 也被上游产线需要
- **当** 图扩散进行
- **那么** L1 不再重复加入图
- **并且** w2 加入 L1 的追踪 ware 集合

#### Scenario: 图扩散终止

- **前提** 当前扩散步骤中所有需追踪的 ware 均已处理（或已忽略）
- **当** 无新增产线需要加入图
- **那么** 图构建完成
- **并且** 图中每条产线的最终追踪 ware 集合 = 所有入边携带 wareId 的并集

#### Scenario: SCC 识别

- **前提** 依赖图构建完成
- **并且** 图中存在环（如 C→L1→L2→C）
- **当** SCC 识别执行
- **那么** 环中所有产线被归入同一 SCC
- **并且** 非环产线标记为 DAG 节点

---

### Requirement: 产线模块计算

系统按叶子→根拓扑序逐节点计算每条产线所需的模块。

#### Scenario: 计算顺序

- **前提** 依赖图已构建，SCC 已识别
- **当** 计算开始
- **那么** 按叶子→根拓扑序处理节点（叶子=最下游供给端，根=目标产线 C）
- **并且** 多 SCC 也按拓扑序处理（先处理叶子端 SCC）

#### Scenario: DAG 节点一次性计算

- **前提** 当前节点为 DAG 节点
- **并且** 所有 upstream 产线已计算完成，各有确定的 buildCost rates
- **当** 计算该节点
- **那么** 收集所有 upstream 产线的 buildCost rates，& 独立约束保留每个 source 明细
- **并且** 使用 `planProductionForRates(demand)` 一次性计算该产线模块数
- **并且** 计算出的模块通过 `calculateAutoFillModules` 补充运营支持模块

#### Scenario: DAG 节点 & 约束

- **前提** DAG 节点有 2 个上游产线对其有需求（source1: hullparts 100/h, source2: hullparts 80/h）
- **当** 计算该节点
- **那么** 两个 source 独立保留，不取 max 合并
- **并且** 内部满足率检查时，两个 source 各自需 ≥ 100%

#### Scenario: SCC 内部迭代——自举判定

- **前提** SCC 内某产线 L 的追踪 ware 集合 = {w1, w2}
- **并且** L 的自身 buildCost 中包含 w1（即 L 建造需要 w1，而 L 自身也产出 w1）
- **当** 自举判定
- **那么** 判定 L 需要自举（追踪 wares ∩ buildCost ≠ ∅）
- **并且** L 使用 greedyFill 自举计算（selfWares 仅限 {w1}，不含 L 产出的其他 ware）

#### Scenario: SCC 内部迭代——自举产线 greedyFill

- **前提** 产线 L 判定需要自举
- **并且** L 有外部需求（如上游产线对 L 产出 wares 的 buildCost rates）
- **当** greedyFill 执行
- **那么** 使用 & 约束合并外部需求 + selfDemand（仅追踪 wares 部分）
- **并且** 不需要初始 seed（外部需求已定义瓶颈方向）
- **并且** 每轮找满足率最低的瓶颈 ware，添加一个生产者，直到所有 source 满足率 ≥ 100%

#### Scenario: SCC 内部迭代——非自举产线一次性计算

- **前提** SCC 内某产线 L 的追踪 ware 集合 ∩ L 自身 buildCost = ∅
- **当** 该轮计算 L
- **那么** 收集所有 upstream 的 buildCost rates（& 约束），用 `planProductionForRates` 一次性计算
- **并且** 不执行 greedyFill 迭代

#### Scenario: SCC 内部迭代——执行顺序与收敛

- **前提** SCC 包含产线 C 和 D，依赖方向 C↔D（C 依赖 D，D 依赖 C）
- **当** 内迭代执行
- **那么** 按消费→供给顺序：C 先算（用 D 的上轮 buildCost），D 后算（用 C 的最新 buildCost）
- **并且** 内迭代退出条件：完整走完一轮后，C 和 D 的主要产出模块数量均无变化
- **并且** 退出后 SCC 所有产线模块数固定，buildCost rates 变为终值

#### Scenario: SCC 收敛后需求传递

- **前提** SCC-A（叶子端）已收敛，其产线的 buildCost rates 包含 w3: 50/h
- **并且** w3 通过 outputBuildTag 连线指向 SCC-B 中的产线 L3
- **当** SCC-B 开始计算
- **那么** L3 的需求来源中包含 SCC-A 产线的 buildCost rates（w3: 50/h）

---

### Requirement: 方案输出

系统将每条产线输出为一个独立的 scheme。

#### Scenario: 每条产线一个 scheme

- **前提** 依赖图中有 C、L1、L2、L3 四条产线
- **当** 方案输出
- **那么** 生成 4 个 scheme（L3、L2、L1、C）
- **并且** 建造顺序为叶子→根（先 L3，后 L2，后 L1，最后 C）

#### Scenario: Scheme 标签

- **前提** 产线 L1 在 logic-flow 中的 groupDisplayName = "Hull Parts 产线"
- **当** 生成 scheme
- **那么** scheme.label = "Hull Parts 产线"
- **并且** scheme.description 包含该产线的简述

#### Scenario: 方案卡片兼容性

- **前提** 新算法生成 schemes 数组
- **当** 输出传递给 BuildPlanPanel
- **那么** 方案卡片正常渲染摘要行（时间/费用/步骤数）和主要模块
- **并且** BuildPlanStepsModal 可查看各 scheme 的逐步建造明细

---

### Requirement: UI 变更

页面组件变更以支持新交互。

#### Scenario: bootstrapMode 下拉框移除

- **前提** 建造规划面板加载
- **当** 渲染约束面板（BuildPlanConstraintsPanel）
- **那么** bootstrapMode 下拉框不再出现
- **并且** 原位置显示"建材产线" checkbox

#### Scenario: 建材产线 Checkbox 交互

- **前提** 用户在建造规划面板中
- **当** 用户勾上/取消"建材产线" checkbox
- **那么** 计算方案立即按新规则重算（或需手动点击计算按钮，与现有行为一致）

---

### Requirement: 无 logic-flow plan fallback

#### Scenario: 无 flow plan 时的建材产线

- **前提** "建材产线" checkbox 勾上
- **并且** 无激活的 logic-flow plan
- **当** 用户点击计算
- **那么** `planProductionForRates(C 的 buildCost rates)` 一次性计算一条建材产线 L
- **并且** L 不做 self-bootstrap（不追踪 L 自身 buildCost）
- **并且** 输出 2 个 scheme：L → C

---

### Requirement: 旧代码清理

新算法功能验证通过后，清理所有旧 bootstrapMode 代码。

#### Scenario: 旧代码清理

- **前提** 新算法所有功能正常运行
- **当** 清理执行
- **那么** `BootstrapMode` 枚举从类型定义中移除
- **并且** `bootstrapMode` 状态从 store 中移除
- **并且** `calculateBuildPlan` 中所有 bootstrapMode 分支删除
- **并且** i18n 中 bootstrap mode 相关 key 清理
