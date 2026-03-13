# 需求说明：simplify-flow

## 目标
将 logic-flow 方案持久化中的 `SavedFlowNode` 精简为极小结构，减少 `x4_logic_flow_plans` 存储体积，并保持现有加载、重建与导入行为可用。

本次变更以当前运行时版本 `v2` 为起点，新增迁移到 `v3`，不引入跨模块版本语义调整。

## 已确认方案（审核重点）
1. 节点持久化结构精简
- `SavedFlowNode` 仅保留两类字段：`isolated?: wareId`、`module?: moduleId`。
- 两字段为互斥语义（XOR）：每个节点保存时只能出现其中一个。
- `isolated` 表示隔离节点；`module` 表示可生产模块节点。

2. 保存策略
- 隔离节点保存为 `{ isolated: <wareId> }`。
- 非隔离且存在模块的节点保存为 `{ module: <moduleId> }`。
- 不满足上述条件的节点不落库，并记录迁移或保存阶段 warning（不中断流程）。

3. 加载重建策略
- 读取 `{ isolated }` 时，恢复为隔离手动节点，运行态字段由加载流程补齐。
- 读取 `{ module }` 时，通过 `moduleId -> module` 推导节点主产物并恢复手动节点，再按现有逻辑扩展 auto 上游。
- 已确认多产物模块在本业务域已预先排除，可按单产物推导。

4. 版本迁移策略
- `CURRENT_FLOW_VERSION` 从 `2` 升级到 `3`。
- 存量 `v2` 节点结构迁移为新 `v3` 结构：
  - `isIsolated=true` -> `{ isolated: wareId }`
  - 否则且 `moduleId` 存在 -> `{ module: moduleId }`
  - 不可转换节点丢弃并记录 warning。
- 导入/加载均复用同一 flow migration 路径，保持一致。

5. 兼容与稳定性
- 保持 `x4_logic_flow_plans` key 不变。
- `activeId`、plan/group 级结构与语义保持兼容。
- 不改导入入口和 UI 交互流程。
- 覆盖 empire 导入 flow 场景：基于极简节点结构仍可正确生成导入目标站点与模块汇总。

## In Scope
- `SavedFlowNode` 持久化模型精简。
- flow `v2 -> v3` 迁移定义与落地。
- 保存/加载链路与导入链路的兼容重建策略。
- OpenSpec 文档同步更新（request/spec/design/tasks）。

## Out of Scope
- empire/ship blueprint 存储版本策略调整。
- logic-flow UI 视觉或交互改版。
- 新增测试用例编写与执行策略变更。

## 验收标准（DoD）
1. `x4_logic_flow_plans` 在同等样本下体积显著下降（目标至少 30%）。
2. 旧 `v2` 数据可自动迁移为 `v3`，且不阻断加载。
3. 方案加载后，manual/isolated 节点与 auto 重建行为与既有功能保持一致。
4. 导入导出链路对 flow 版本与节点结构兼容，不出现结构性报错。
5. 持久化节点不再包含历史冗余字段（如 `id/race/column/order/isRoot/source`）。
6. empire 导入 flow 时，按组生成的目标站点、模块计数与锁定货物语义保持正确。

## 未决项
无。
