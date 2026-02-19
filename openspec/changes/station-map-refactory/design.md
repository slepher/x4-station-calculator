## Context

当前实现中，`useStationStore` 会把当前活跃分站数据复制到本地 ref，并通过 watch 与 `useEmpireStore.activeStation` 双向同步。与此同时，单站视图与帝国聚合分别维护计算链路，导致以下问题：
- 状态真源不唯一，切站与快速编辑场景存在一致性风险
- AutoFill / WareFlow 等计算在两个 Store 重复实现，后续演进成本高
- `stationFlowCache` 的刷新时机依赖状态变更路径，调试与测试复杂

本次变更需要在不破坏既有组件调用方式的前提下，完成运行态单一真源化，并保证多分站隔离、切站一致性与帝国聚合一致性。

## Goals / Non-Goals

**Goals:**
- 引入 `StationStateMap` 作为分站运行态单一真源，按 `stationId` 维护状态与计算结果
- `useStationStore` 改为 `currentStationId` 代理访问，保持对 UI 的主要 API 兼容
- 帝国聚合改为消费 `StationStateMap` 结果，消除重复计算路径
- 明确持久化边界：仅持久化可编辑输入，派生结果运行时重算

**Non-Goals:**
- 不重写现有业务计算函数（`calculateAutoFill`、`analyzeWareFlow` 等）
- 不改造现有 UI 布局与交互文案
- 不在本次变更中引入新的后端接口或外部依赖

## Decisions

### Decision 1: 以 `StationStateMap` 作为运行态容器

**选择**: 新增普通 class `StationStateMap`，内部以 `Map<stationId, StationState>` 承载每站运行态。

**理由**:
- 单一真源可避免双向同步写入竞争
- 便于将“输入状态 + 派生状态 + 计算结果”打包成可测试单元
- 便于分站生命周期操作（创建、复制、删除）统一处理

**替代方案**:
- 继续在 `useStationStore` 内维护当前站副本并同步回 EmpireStore：复杂度继续累积
- 在 `useEmpireStore` 内塞入全部运行态字段：职责过重，UI 代理层不清晰

### Decision 2: `useStationStore` 保持 API 兼容，内部改代理

**选择**: `useStationStore` 继续暴露 `plannedModules`、`settings`、`groupedFlows` 等字段名，但底层通过 `currentStationId` 代理到 `StationStateMap`。

**理由**:
- 最小化组件改动，尤其兼容 `v-model="store.plannedModules"`
- 降低迁移风险，允许分步骤替换内部实现

**替代方案**:
- 全量替换为新 API（例如 `stationState.current.xxx`）：需要改动大量组件与测试

### Decision 3: 帝国聚合直接读取 `StationStateMap` 结果

**选择**: `useEmpireStore` 不再作为独立计算缓存真源，`empireGroupedFlows` 统一读取 `StationStateMap` 的分站 `groupedFlows`。

**理由**:
- 聚合层只做聚合，不重复单站计算
- 保证单站视图与帝国视图读取一致

**替代方案**:
- 保留 `stationFlowCache` 并持续镜像 `StationStateMap`：增加双缓存一致性维护成本

### Decision 4: 持久化仅存“可编辑输入”

**选择**: 持久化字段限定为 `modules/settings/lockedWares/warePriority`，派生与计算结果按需重算；`settings.showEmpireGaps` 作为 settings 子字段纳入 `StationState` 与持久化。

**理由**:
- 减少版本漂移与脏缓存问题
- 降低存储体积与迁移复杂度

**替代方案**:
- 持久化计算快照：需维护 fingerprint 与版本兼容，风险更高

### Decision 5: `resourceBufferHours` 迁移判定使用显式 undefined 判断

**选择**: 迁移表达式使用 `s.resourceBufferHours !== undefined ? s.resourceBufferHours : 2`，不使用 `||` 回退。

**理由**:
- 避免 `0` 被误判为 falsy 后强制改写为 `2`
- 迁移行为与“仅缺失才补默认值”的语义一致

**替代方案**:
- 使用 `s.resourceBufferHours || 2`：会吞掉合法的 `0`

### Decision 6: `currentEfficiency` 作为 Map 内单一真源

**选择**: 在 `StationStateMap` 中保留 `currentEfficiency` 字段并作为单一真源；`useStationStore` 与组件仅透传读取。

**理由**:
- WareFlow 与 Dashboard 读取同一来源，避免未来公式漂移
- 保持计算链单点定义，减少“同义值多处推导”风险
- 调试时可直接观察分站运行态中的效率结果

**替代方案**:
- 在 `useStationStore`/组件层重复推导 `currentEfficiency`：短期可行但容易与计算链参数演进产生偏差

### Decision 7: 精简 `StationStateMap` 内部非必要运行态字段

**选择**: 移除当前三模块未直接消费的内部字段存储，`recompute` 仅保留必要输出；中间值改为局部变量。

**理由**:
- 缩小响应式状态面，减少无效依赖更新
- 保持计算链在单点执行，不在状态树保留临时结果
- 与“Store 代理 + 运行时重算”目标一致

**替代方案**:
- 保留全部中间字段在 `StationState`：便于调试但会增加状态复杂度与冗余维护成本

## Risks / Trade-offs

- **风险: 可写代理与数组原地修改触发不稳定** → 通过 `mutate` 封装写操作并补充单测覆盖 `v-model`/拖拽场景
- **风险: 分站复制出现引用共享** → `clone` 强制深拷贝并在测试中验证隔离
- **风险: 切站时计算延迟引发短暂 UI 不一致** → 为 `ensure/recompute` 定义确定时序并在切站路径同步触发
- **风险: 迁移阶段同时存在旧路径与新路径** → 分阶段下线旧 watch/cache，并设置临时断言避免双写

## Migration Plan

1. 新增 `StationStateMap` 与 `StationState` 类型，并接入基础 `ensure/get/mutate/recompute`。
2. 在 `useStationStore` 内部替换为代理访问，保持对外 API 名称稳定。
3. 调整 `useEmpireStore` 聚合来源，逐步移除重复缓存计算。
4. 清理旧双向同步残留逻辑，补齐回归测试。
5. 验证存档/读档、切站、复制、删除流程后进入 `/x4:apply` 实施。

回滚策略：保留旧分支实现快照；若代理路径出现阻塞问题，可临时回退到旧 `stationFlowCache + watch` 方案并单独修复。

## Open Questions

- `StationStateMap` 的 recompute 触发策略是否采用“同步立即重算”还是“批量调度重算”
- `stationFlowCache` 是否完全删除，或在短期保留为只读兼容层
