# build-plan-preview 需求

## 目标

统一 build-plan preview 阶段的职责边界与数据模型：

1. preview 负责责任分配、依赖图构建、SCC 检测，不产出模块数量或 steps
2. preview 真相层拆分为 derived 项与 required 项，derived 项在 preview 阶段固定 moduleId
3. preview 展示直接消费 preview 项，不再回退到旧 goal 兼容结构
4. preview 建材范围来自完整展开产线，不使用 autoFill 结果作为 root 模块集合
5. 依赖图基于 build-flow 建材产出区连线构建，融入 isolated 扩展

## 当前实现提醒

- 当前代码实现已知存在 bug 与设计偏差
- 本 change 的需求、设计、验收标准以文档为准
- 若代码与文档冲突，默认代码错误，需调整代码而非回退文档

## 已确认方案（审核重点）

### 两阶段模型

- `preview` = 责任分配 + 依赖图构建 + SCC 检测
- `compute` = 模块求解（由 build-plan-compute 定义）
- `build-flow mode` 是常驻规划上下文，不由 checkbox 控制进入或退出
- checkbox 只控制：是否按建筑材料需求规划建材产线
- checkbox 关闭后，不再生成仅服务于建材产线规划的 graph / SCC；这是关闭建材规划后的正常结果
- 以下变化都会触发 preview 重算：
  - 目标模块 / 目标产物变动
  - checkbox 勾选 / 取消
  - logic-flow 变化（当绑定 plan 与 active 相同时）
- 当 `logicFlowPlanId = null`（无规划）时，preview 仍必须生成，且所有目标直接落到待规划产线

### Preview 项拆分

- preview 不再使用单一 `PreviewResponsibility.type`
- preview 真相层拆成两个类型：
  - `PreviewDerivedItem` — 表示"这条线承担什么"，必须绑定 moduleId
  - `PreviewRequiredItem` — 表示"这条线需要什么"，不绑定 moduleId
- derived 和 required 不共存于同一条 preview 项
- 同一条产线、同一 wareId 若同时存在供给侧和需求侧语义，必须拆成两条 preview 项

### Derived 项规则

- derived 项必须绑定 `moduleId`
- derived 项内部使用 `derived: [...]` 表达标签集合
- derived 标签值固定为：`target` / `production` / `build-material`
- 同一条产线、同一 `wareId + moduleId` 的 derived 项合并为一条，标签去重

### Required 项规则

- required 项不绑定 `moduleId`
- required 项内部使用 `required: [...]` 表达标签集合
- required 标签值固定为：`production` / `build-material`
- 同一条产线、同一 `wareId` 的 required 项合并为一条，标签去重

### Targets 规则

- 新增 `targets[]`，只表达 preview 项与目标来源的关联
- targets[] 只挂在 derived 项上
- targets[] 支持：`build-module` / `production-rate` / `fleet-rate`
- 每个来源一条数据，元素结构：`type` + `count?` + `ratePerHour?`
- 没有关联来源的 preview 项不写 targets

### Module 选择规则

- preview 为 derived 项确认 moduleId 时：
  - 先为每条 logic-flow 产线确定 lineage
  - lineage = `isLocked ? (lockedLineage || subCategory) : subCategory`，空值回落 `default`
  - 第一轮优先 manual，manual 有多个时先服从 lineage，仍有多个取第一个
  - 第二轮 auto，auto 只服从 lineage，仍有多个取第一个
- preview 一旦为 derived 项确认 moduleId，compute 必须直接读取，不得重新生成

### Preview 建材范围

- preview 阶段不使用 autoFill 做 root 计算
- root 模块集合来自"承接目标的完整展开产线"
- root 模块集合按目标产线当前已展开的非 isolated 模块节点收集
- preview 依赖图的首层 buildCost 仅来自这组 root 模块

### 依赖图构建

- 从目标产线 C 的 buildCost 出发，沿 build-flow 建材产出区(outputBuildTags)连线 BFS 扩散
- 边方向 = 消费→供给（C 依赖 L → 边 C→L）
- 产线只入图一次，追踪 ware 集合随图扩散扩充
- 融入 isolated 扩展：产线的 isolated 节点搜索产出该 ware 的产线，manual > auto 优先级
- 无连线则忽略，不允许 fallback 到其他来源
- 识别 SCC（强连通分量）

### 责任到产线的全局分配

- 第一轮（manual 全局分配）：所有 goal 先走完 manual 分配
- 第二轮（auto 优先在已分配产线中查找）：未分配 goal 优先在已有 manual 分配的产线中找 auto 节点
- auto 阶段将新目标聚集到已有产线，避免分散

### Preview 展示规则

- preview 区直接消费 preview 真相层，不再转回 `ProductionLineAllocation.goals`
- 有 moduleId 时显示 module 名称，否则显示 ware 名称
- derived tag 使用绿色，required tag 使用红色
- tag 文案：target → 目标/Target，production → 材料/Production，build-material → 建材/Material
- 产线卡片右上角数量显示 moduleId 去重种类数

### 用户目标区与 preview 区分离

- 保留独立"用户目标区"作为唯一可编辑输入区
- preview 区只展示分配结果，以 tag 方式展示
- preview 区不显示数量输入或删除按钮

## 边界

### In Scope

- Preview 真相层类型（derived/required/targets）
- 责任分配模型与相关产线模型
- 依赖图构建（BFS + isolated 扩展 + SCC）
- Derived 项 moduleId 确认规则
- Preview 建材范围规则
- Preview 展示规则
- Checkbox 语义
- 用户目标区与 preview 区分离

### Out of Scope

- Compute 求解逻辑
- Steps 生成
- 修改 build-flow 数据模型
- 修改 build-flow 连线编辑交互
- 编写测试代码

## 验收标准（DoD）

1. preview 真相层拆分为 derived 项与 required 项两个类型
2. derived 项必须带 moduleId
3. required 项不绑定 moduleId
4. targets[] 只出现在 derived 项上
5. preview 区不再通过 ProductionLineAllocation.goals 渲染
6. preview 区有 moduleId 时显示 module 名称
7. derived 绿色 tag，required 红色 tag
8. 产线卡片右上角显示 moduleId 去重种类数
9. 依赖图正确构建（BFS + isolated 扩展 + SCC）
10. preview 建材范围来自完整展开产线，不使用 autoFill 结果
11. compute 不再重新生成 preview 项 moduleId
12. 文档一致：request / design / spec / tasks
