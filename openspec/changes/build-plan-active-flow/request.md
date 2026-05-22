# build-plan-active-flow 需求

## 目标

解除 `build-plan` 与 `logic-flow active` 的强耦合。

让 `build-plan` 不再直接读取 `useLogicFlowStore` 的实时内容，而是通过独立的 logic 模块解析“本次 build-plan 应使用哪一份 logic-flow 数据”。

同时保证：

1. 若 build-plan 绑定的 logic-flow plan 与当前 active logic-flow 相同，则直接复用 `useLogicFlowStore` 已重建好的数据。
2. 若不同，则按该 build-plan 绑定的 plan 重建一份数据，并复制到 `useBuildPlanStore` 内部使用。
3. build-plan 切换读取源时，不得改变 `logic-flow` 的 active plan。

## 已确认方案（审核重点）

### 输入边界

- `useBuildPlanStore` 不再直接以 `useLogicFlowStore.groups / buildFlowView / buildFlowAssignments / buildFlowVirtualEdges` 作为业务输入源。
- `useBuildPlanStore` 只读取一个独立 logic 模块返回的 snapshot 结果。
- 该 snapshot 至少需要包含：
  - `planId`
  - `groups`
  - `buildFlowView`
  - `buildFlowAssignments`
  - `buildFlowVirtualEdges`

### 解析规则

- 每个 build-plan 继续保存自己的 `logicFlowPlanId`
- build-plan 触发 preview / compute 前，先解析本次应使用的 logic-flow snapshot
- 若 `buildPlan.logicFlowPlanId === logicFlowStore.savedPlans.activeId`
  - 直接读取 active logic-flow 中已重建好的数据
  - 不再做额外重建
- 若两者不同
  - 按 `buildPlan.logicFlowPlanId` 对应的已保存 logic-flow plan 重建 snapshot
  - 将重建结果复制到 `useBuildPlanStore` 自身状态
  - 后续 preview / compute 只读这份副本

### active 隔离

- build-plan 切换方案时，可以切换“自己读取哪份 logic-flow plan”
- 该切换只影响 build-plan 自身的 preview / compute 输入
- 不允许调用 `logicFlowStore.loadPlan(...)`
- 不允许把 logic-flow UI 当前 active plan 改成 build-plan 绑定的 plan
- 不允许因为 build-plan 读取了别的 plan，就污染 logic-flow 当前编辑上下文

### 触发规则

- 当 build-plan 当前绑定的 `logicFlowPlanId` 与 active logic-flow 相同：
  - active logic-flow 的实时编辑变化应继续驱动 build-plan preview 重算
- 当两者不同：
  - active logic-flow 的实时编辑不应影响当前 build-plan
  - build-plan 仅在自身切换方案、目标变化、build-flow mode 变化，或所绑定 plan 重新解析时更新

### 数据归属

- build-plan 为了 preview / compute 使用的 resolved logic-flow 数据，必须保存在 `useBuildPlanStore`
- 该状态属于 build-plan 真相层的一部分
- logic-flow store 保持其自身 active 编辑态职责，不额外承担 build-plan 的跨 plan 读取状态

### 改造范围

- 重点改造 `useBuildPlanStore` 的输入解析与联动逻辑
- 核心 preview / compute 算法尽量不改
- presenter / Vue 只消费 build-plan store 暴露的结果，不直接补读 logic-flow store 来参与 build-plan 计算

## 边界

### In Scope

- 为 build-plan 引入独立 logic-flow snapshot 解析模块
- 为 build-plan 增加 resolved logic-flow 状态
- 调整 preview / compute 入口，使其只消费 resolved snapshot
- 调整 watcher 联动规则，区分“同 active”与“非 active”
- 明确 build-plan 切换读取源时不得改变 logic-flow active

### Out of Scope

- 重写 `buildPlanProductionLine` 核心算法
- 修改 logic-flow 的连线编辑交互
- 修改 logic-flow store 的 UI 行为
- 编写测试代码
- 运行测试

## 验收标准（DoD）

1. `useBuildPlanStore` 不再直接把 `useLogicFlowStore` 的实时字段作为 build-plan 计算输入源
2. build-plan 通过独立 logic 模块解析本次使用的 logic-flow snapshot
3. 当 build-plan 绑定 plan 与 active logic-flow 相同时，build-plan 直接复用 active store 已重建数据
4. 当两者不同时，build-plan 能按绑定 plan 重建 snapshot，并把结果保存到自身状态
5. preview / compute 只消费 build-plan store 中 resolved snapshot，不再临时回读 active logic-flow
6. build-plan 切换读取源不会调用 `logicFlowStore.loadPlan(...)`，也不会改变 logic-flow active
7. 当 build-plan 绑定非 active plan 时，active logic-flow 的实时编辑不会干扰当前 build-plan 结果
8. `request.md` / `design.md` / `spec.md` / `tasks.md` 对“active 隔离”结论描述一致

## 未决项

无
