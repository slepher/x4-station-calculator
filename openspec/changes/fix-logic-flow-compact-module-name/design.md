# 设计

当前 getCompactNodeDisplayName 对非 preview 节点使用 group.nodes.find(wareId)，将两个模块合并为同一展示身份。实际传入节点已携带 moduleId，无需再查找节点。

将该命名职责移至 logic-flow 的 presenter；复用游戏 store 的名称查询能力，Vue 直接调用 presenter。真实模块、raw 和 preview 按明确业务状态分别处理，不引入 fallback 链或新中间层。保持其他现有方法和调试日志，不整体改写组件。

最小验证以同 ware 不同 moduleId 两节点为核心，覆盖必要 raw/preview 对照；行为变化前已有真实 E2E 失败证据。产品改动后的构建由主 agent 协调，避免与其他 E2E 共用 dist 时并发构建。
