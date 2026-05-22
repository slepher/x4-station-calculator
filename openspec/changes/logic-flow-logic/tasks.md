# logic-flow-logic 任务

## Phase 1: 语义对齐

- [x] T1: 审查 `logicFlowStream.ts`、`hydrateSavedFlowGroups.ts`、`buildFlowDerivation.ts`、`computeProductionLineAllocation.ts`，确认哪些行为属于 `logic-flow` 领域真值，哪些属于 `build-plan` 二次解释
- [ ] T2: 将 `manual + !isolated`、`manual + isolated`、`auto + !isolated` 的正式语义写入类型与模块说明
- [ ] T3: 明确“遇到 isolated 停止推导”同时约束节点补全与责任解释，不允许只在节点补全阶段生效

## Phase 2: 共享模块设计

- [x] T4: 新增 `logic-flow` 侧共享 logic 模块草案，定义最小输入输出类型
- [x] T5: 为共享模块定义 `groupFacts` 与 `responsibilities` 两层输出，分离“节点事实”和“责任解释”
- [ ] T6: 明确责任输出中如何表达显式 isolated 边界、build-flow assignment 来源与 related groups

## Phase 3: 迁移 `build-plan`

- [x] T7: 将 `computeProductionLineAllocation.ts` 中属于领域解释的逻辑迁移到共享模块
- [x] T8: 清理 `build-plan` 中对 `covered set`、上游递归、manual/auto/isolate 多轮扫描的重复实现
- [x] T9: 让 `build-plan` 改为只消费共享模块结果并格式化为 preview / allocation / compute 输入

## Phase 4: 脚本共用入口

- [x] T10: 让 `analysis/scripts/build-plan/build-plan-production-line.ts` 改为调用共享 logic 模块，而不是自己或间接依赖 store 私有解释逻辑
- [x] T11: 保证网页与胶水脚本在相同输入下读取同一责任真值，不再存在一方修复、一方遗漏的平行路径

## Phase 5: 收尾

- [ ] T12: 删除或降级旧的平行解释逻辑，避免长期双轨
- [x] T13: 回查 `request.md` / `design.md` / `spec.md` / `tasks.md` 一致性，确认后续 `/x4:apply` 可直接执行

## 说明

- 当前变更已进入实现阶段，`src/**`、分析脚本与单元测试已开始同步迁移
- 尚未完成的任务保留为后续收尾项，不代表其余已勾选任务仍停留在纯规划状态
