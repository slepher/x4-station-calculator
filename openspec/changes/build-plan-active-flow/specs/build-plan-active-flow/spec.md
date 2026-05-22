# Build Plan Active Flow Specification

## Purpose

定义 `build-plan` 读取 logic-flow 数据时的解耦行为：通过独立 snapshot 解析层决定输入来源，并确保 build-plan 的读取行为不会改变 logic-flow 当前 active 上下文。

## ADDED Requirements

### Requirement: Build Plan Must Resolve Logic Flow Input Through A Dedicated Snapshot Layer

**前提** `build-plan` 需要执行 preview 或 compute  
**当** 系统准备读取 logic-flow 数据  
**那么** 系统 MUST 先通过独立 logic 模块解析本次使用的 logic-flow snapshot  
**并且** `useBuildPlanStore` MUST NOT 直接把 `useLogicFlowStore` 的实时字段作为 build-plan 的业务输入源

#### Scenario: Preview 先解析 snapshot

**前提** 用户已存在 build-plan 目标  
**当** build-plan 开始执行 preview  
**那么** 系统先解析 resolved logic-flow snapshot  
**并且** preview 使用该 snapshot 继续计算

### Requirement: Matching Active Logic Flow Reuses Existing Rebuilt State

**前提** 当前 build-plan 已绑定 `logicFlowPlanId`  
**并且** 该 id 与 `logicFlowStore.savedPlans.activeId` 相同  
**当** build-plan 解析 logic-flow 输入  
**那么** 系统 MUST 直接复用 active logic-flow 中已重建好的数据  
**并且** MUST NOT 为同一 plan 再额外重建一份 snapshot

#### Scenario: 同 active 直接复用

**前提** build-plan 绑定 plan `P1`  
**并且** logic-flow 当前 active plan 也是 `P1`  
**当** build-plan 执行 preview 或 compute  
**那么** 系统直接读取 active store 的已重建结果

### Requirement: Non-Active Logic Flow Plan Must Be Rebuilt Inside Build Plan State

**前提** 当前 build-plan 已绑定 `logicFlowPlanId`  
**并且** 该 id 与 `logicFlowStore.savedPlans.activeId` 不同  
**当** build-plan 解析 logic-flow 输入  
**那么** 系统 MUST 按该绑定 plan 重建一份 logic-flow snapshot  
**并且** MUST 将该结果保存到 `useBuildPlanStore` 自身状态  
**并且** 后续 preview / compute MUST 只读取该副本

#### Scenario: 非 active plan 在 build-plan 内部重建

**前提** build-plan 绑定 plan `P2`  
**并且** logic-flow 当前 active plan 为 `P1`  
**当** build-plan 执行 preview  
**那么** 系统按 `P2` 重建 snapshot  
**并且** 将重建结果写入 build-plan store 的 resolved 状态

### Requirement: Build Plan Reading Another Logic Flow Plan Must Not Change Logic Flow Active

**前提** build-plan 当前绑定的 logic-flow plan 不是 active plan  
**当** build-plan 切换方案或刷新其读取源  
**那么** 系统 MUST NOT 改变 `logicFlowStore.savedPlans.activeId`  
**并且** MUST NOT 调用会切换 logic-flow active plan 的加载流程  
**并且** MUST 保持 logic-flow UI 当前编辑上下文不变

#### Scenario: 切换 build-plan 不切换 logic-flow active

**前提** logic-flow 当前 active plan 为 `P1`  
**并且** 用户切换到一个绑定 `P2` 的 build-plan  
**当** build-plan 完成自身切换  
**那么** logic-flow 当前 active plan 仍为 `P1`  
**并且** build-plan 使用 `P2` 的 snapshot 进行 preview / compute

### Requirement: Preview And Compute Must Consume Only Resolved Snapshot State

**前提** build-plan 已完成 logic-flow snapshot 解析  
**当** 系统执行 preview 或 compute  
**那么** preview 与 compute MUST 只消费 `useBuildPlanStore` 中 resolved snapshot 状态  
**并且** MUST NOT 在流程中再次直接回读 active logic-flow store 实时字段

#### Scenario: Compute 不再回读 active store

**前提** build-plan 已持有 resolved snapshot  
**当** 用户点击计算  
**那么** compute 从 build-plan store 读取 resolved snapshot 继续执行  
**并且** 不再临时回读 `logicFlowStore.groups` 等 active 字段

### Requirement: Active Logic Flow Live Updates Only Affect Build Plan When The Bound Plan Matches Active

**前提** build-plan 已解析出 resolved logic-flow source  
**当** active logic-flow 发生实时编辑变化  
**那么** 只有在 build-plan 绑定 plan 与 active plan 相同的情况下，该变化才会触发当前 build-plan preview 刷新  
**并且** 当 build-plan 绑定非 active plan 时，active logic-flow 的实时编辑 MUST NOT 干扰当前 build-plan 结果

#### Scenario: 非 active 绑定时忽略 active 编辑

**前提** build-plan 当前使用的是 `rebuilt-plan` source  
**并且** logic-flow 工作台正在编辑另一个 active plan  
**当** active plan 的 groups 或 build-flow 连线变化  
**那么** 当前 build-plan preview 不刷新为该 active plan 的结果
