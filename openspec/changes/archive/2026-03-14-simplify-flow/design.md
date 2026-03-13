# Context

当前 logic-flow 持久化节点仍携带多项运行态字段，导致 `x4_logic_flow_plans` 存储体积偏大。节点中的大部分字段可在加载时由 `ware/module/group` 上下文重建，不需要长期落库。

已确认业务前提：
1. 本域内多产物模块已预先排除，可按单产物模块重建目标产物。
2. 本次仅推进 flow 模块版本从 `v2` 到 `v3`，不改其他模块版本策略。

# Design Goals

1. 将 `SavedFlowNode` 压缩为最小可重建结构。
2. 保持旧数据自动迁移与导入导出兼容。
3. 维持现有 UI 与行为语义不变。

# Data Model

## SavedFlowNode V3

`SavedFlowNode` 采用 union-like 极简结构：
- `{ isolated: wareId }`
- `{ module: moduleId }`

约束：
1. 两字段互斥，仅允许一个存在。
2. 仅用于持久化层；运行态 `FlowNode` 仍保持现有完整结构。

# Save Pipeline

在 flow 方案保存时：
1. 对隔离节点输出 `{ isolated }`。
2. 对非隔离且可生产节点输出 `{ module }`。
3. 无法映射到任一合法形态的节点跳过，记录 warning（不中断保存）。

# Load/Rebuild Pipeline

在 flow 方案加载时：
1. 读取 `{ isolated }`：
   - 恢复为隔离 manual 节点，`wareId` 直接来自 `isolated`。
   - 运行态补齐字段（`id/column/order/race/lineage/...`）按现有规则生成。
2. 读取 `{ module }`：
   - 通过 `moduleId` 查询模块。
   - 基于模块单产物前提推导 `wareId`。
   - 恢复 manual 节点后，沿既有路径重建 auto 上游节点。

# Migration Strategy

## Version Bump

- `CURRENT_FLOW_VERSION`: `2 -> 3`。

## v2 to v3 Node Migration

对旧 `SavedFlowNode` 执行规则迁移：
1. `isIsolated=true` 且有 `wareId` -> `{ isolated: wareId }`
2. `isIsolated=false` 且有 `moduleId` -> `{ module: moduleId }`
3. 其余节点丢弃并记录 warning。

迁移入口保持集中在 flow migration 主路径，由 store 与 import/export 共同复用。

# Compatibility and Risks

0. 兼容范围：包含 station 加载与 empire 导入 flow 两条消费链路。
1. 风险：历史脏数据可能出现“既无 wareId 又无 moduleId”的节点。
   - 缓解：迁移时丢弃并输出 warning，不阻断整体加载。
2. 风险：模块映射缺失导致 `{ module }` 节点无法恢复。
   - 缓解：加载时跳过该节点并记录 warning，保留其余可恢复节点。

# Empire Import Compatibility

flow 导入 empire 的目标构建需适配极简节点：
1. `{ module }` 节点参与 `plannedModules` 统计。
2. `{ isolated }` 节点按货物类型规则参与 `lockedWares` 统计。
3. 无 `{ module }` 的组按既有规则判定为空组并跳过，保留 warning 语义。

# Validation Strategy

1. 结构验证：持久化后的 flow 节点仅出现 `isolated/module` 二选一形态。
2. 迁移验证：V2 样本导入后版本归一到 V3，且节点可恢复。
3. 行为验证：加载方案后 manual/isolated/auto 重建行为保持一致。
4. 体积验证：同样本下 flow 存储体积较改造前显著下降（目标 >= 30%）。
