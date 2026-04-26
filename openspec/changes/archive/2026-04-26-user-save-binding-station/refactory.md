# user-save-binding-station Refactory

## Purpose

记录 `useStationStore` 在 `user-save-binding-station` 完成后的复杂度问题、职责边界缺陷，以及后续可执行的重构方案，作为后续实现和 review 的依据。

---

## 现状诊断

### R1. `useStationStore` 已演化为多职责编排器

当前 `useStationStore` 同时承担以下职责：

- active station 上下文解析
- `stationStateMap` 写入与重算触发
- `StationPlan` 与 `BindingStationPlan` 的回写同步
- save-binding 特殊路由
- 模块筛选与导入解析
- 旧的 `savedPlans` 管理

这使得该 store 不再是单纯的 UI facade，而是把“当前站点编辑”、“派生缓存编排”、“持久化同步”、“跨 source 适配”耦合在同一个入口里。

### R2. 缺少单一写入口

当前站点数据存在多条写路径：

- `useStationStore.applyAndRecompute()` 直接写 `stationStateMap`，再同步回 `empireStore` / `saveBindingStore`
- `useEmpireStore.updateStationModules()` / `updateStationSettings()` 直接改持久化对象后刷新缓存
- 个别组件直接拿 `StationPlan` 写字段，再手动调用 `refreshStationFlowCache()`
- `productionSourceAdapter` 也会直接写入 `stationStateMap`

结果是 source of truth 不清晰，后续任何行为修改都需要同时检查多条链路。

### R3. “当前活动站点投影”模型增加了隐式复杂度

`plannedModules`、`settings`、`groupedFlows` 等公开字段并不是 store 自身的稳定状态，而是 `activeStationId` 驱动下的上下文投影。  
这种模式对组件方便，但会带来以下问题：

- store API 的真实含义依赖外部选中态
- 单元测试必须先构造 active station 上下文
- 很难复用到“按 stationId 显式操作”的场景
- 后续并行编辑、多面板预览、批量导入等能力难以扩展

### R4. 计算编排重复散落

以下流程在多个模块里重复存在：

1. 构造 compute deps
2. 从 persisted station 导入到 `stationStateMap`
3. 调用 `recompute()`
4. 再从 `stationStateMap` 读取 `groupedFlows`

这套逻辑目前散落在：

- `useStationStore`
- `useEmpireStore`
- `productionSourceAdapter`

重复逻辑会导致：

- 新增计算依赖时要多点同步
- migration / DLC 过滤规则易出现不一致
- debug 时难以判断哪个入口负责最终结果

### R5. `stationStateMap` 边界泄漏

`stationStateMap` 原本适合做站点派生缓存容器，但现在外部模块已经直接读取甚至依赖其行为。  
一旦多个模块直接访问它，就会使 `useStationStore` 难以继续收口，也让“缓存层”开始承担业务接口角色。

---

## 重构目标

### G1. 明确数据分层

- `StationPlan` / `BindingStationPlan` 作为持久化源数据
- `stationStateMap` 只作为派生计算缓存
- `useStationStore` 只作为 active station 的 UI facade

### G2. 建立单一写入口

所有站点编辑动作都通过统一命令层执行，避免组件、store、adapter 各自写一份。

### G3. 计算流程集中化

将“导入 persisted -> recompute -> 读取派生结果”的流程下沉到统一 service，避免重复实现。

### G4. 降低 active-context 隐式耦合

保留 `useStationStore` 对当前站点的便捷代理，但内部逐步转向显式 `stationId` 命令与查询接口。

---

## 建议架构

### A1. `useStationStore` 缩减为 facade

`useStationStore` 仅保留：

- 当前活动站点的只读投影
- 对统一命令层的代理
- 少量纯 UI 状态

不再保留：

- save-binding plan 回写细节
- `stationStateMap` 直接 patch/mutate 逻辑
- 导入解析和旧 plan library 管理

### A2. 新增 `stationCommands` 命令层

新增显式命令接口，统一所有写动作：

- `updateStationModules(stationId, modules)`
- `updateStationSettings(stationId, patch)`
- `toggleStationWareLock(stationId, wareId)`
- `updateStationWarePriority(stationId, nextPriority)`
- `importModulesToStation(stationId, payload)`

命令层负责：

- 判断当前 production source
- 更新 `empire` 或 `save-binding` 持久化对象
- 调用统一计算刷新入口

### A3. 新增 `stationComputeService`

集中以下职责：

- 构造 `StationComputeDeps`
- `migrateStationSettings`
- 从 persisted station 同步到 `stationStateMap`
- 调用 `recompute()`
- 提供 `getGroupedFlows/getFilteredGroupedFlows/getStationAnalysis`

`useStationStore`、`useEmpireStore`、`productionSourceAdapter` 都不再重复拼装这套流程。

### A4. 将遗留计划管理拆出

`savedPlans/loadPlan/saveCurrentPlan/mergePlan/deletePlan` 与当前 binding 工作流并非同一职责。  
建议单独迁移为 `useStationPlanLibraryStore` 或等价 composable，避免继续扩大 `useStationStore` 体积。

### A5. 禁止组件直接写 station 与 cache

组件层约束：

- 不直接写 `station.modules/settings/lockedWares`
- 不直接调用 `stationStateMap.patch/mutate`
- 不自行决定何时 `refreshStationFlowCache`

组件只应：

- 读取 facade/query
- 调用 command

---

## 分阶段实施建议

### Phase 1: 收口写入口

- 为 `modules/settings/lockedWares/warePriority` 建立显式命令 API
- 组件侧停止直接改 `StationPlan`
- `useStationStore` 改为调用命令层，不再直接 `patch/mutate stationStateMap`

### Phase 2: 集中计算协调

- 抽出 `stationComputeService`
- `useEmpireStore.refreshStationFlowCache()` 改为复用统一 service
- `productionSourceAdapter` 停止重复拼 `patch + recompute`

### Phase 3: 缩减 facade 体积

- 抽离蓝图/XML/import 逻辑
- 抽离 `savedPlans` 旧计划管理
- 将模块筛选相关逻辑迁到专门的 picker/composable

### Phase 4: 隐式 active context 显式化

- 内部实现逐步改为 `stationId` 驱动
- `useStationStore` 仅保留 active station 代理层
- 为未来多站并行视图、批量操作、独立面板预览留出扩展空间

---

## 风险与约束

### C1. save-binding 行为不能回退

本次重构必须保持以下语义不变：

- binding 模式编辑只更新 draft，不自动保存
- covered save station 与 virtual station 的派生逻辑不变
- save-binding 下删除/创建/重命名站点的路由语义不变

### C2. station flow 消费方需统一迁移

由于多个模块已经直接访问 `stationStateMap`，重构时必须先提供稳定 query API，再逐步替换调用方，避免一次性切换造成大面积回归。

### C3. 测试需要从“active station 驱动”覆盖到“显式 stationId 命令”

后续应补充：

- command 层单元测试
- source-aware 持久化路由测试
- 组件侧禁止直接写 station 的回归测试

---

## Definition of Done

- `useStationStore` 不再直接承担持久化同步编排
- 站点写操作统一走命令层
- 站点重算统一走 `stationComputeService`
- 组件层不再直接修改 `StationPlan` 后再手动 refresh
- 现有 binding 行为与 dirty/save 语义保持不变
