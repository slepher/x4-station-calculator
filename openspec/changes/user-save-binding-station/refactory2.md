# user-save-binding-station Refactory 2

## Purpose

基于当前未提交重构的实际状态，补充第二版重构说明，明确：

- 这轮重构已经达成了什么
- 还没有达成什么
- 已经引入了哪些行为回归
- 后续任务应该如何分阶段执行，避免执行方把“抽了新文件”误判为“重构完成”

---

## 当前结论

### C1. 这轮重构没有完全达到目标

当前未提交改动完成了部分基础设施抽取，但还没有完成“`useStationStore` 职责收缩”的真正目标。

已达成的部分：

- 抽出了 `stationComputeService`
- 抽出了 `stationCommands`
- 抽出了 `stationImporter`
- 抽出了 `useStationPlanLibrary`
- `useEmpireStore.refreshStationFlowCache()` 与 `productionSourceAdapter` 已开始复用 `stationComputeService`
- `npm run build` 可以通过

未达成的部分：

- `useStationStore` 仍然保留主要复杂度与主编排职责
- `stationCommands` 尚未成为主路径写入口
- `stationImporter` 尚未接入 `useStationStore.importPlan()` 或组件导入主路径
- `useStationPlanLibrary` 尚未替换 `useStationStore` 中现有 `savedPlans` 逻辑
- `stationStateMap` 的边界仍未真正收紧

### C2. 当前状态更接近“基础设施已就位，主路径尚未切换”

这意味着当前代码库处于中间态：

- 新抽象已经存在
- 旧逻辑仍然占据主路径
- 两套思路并存

这种状态的风险是：

- 执行方误以为任务已经完成
- 后续修改不知道应该继续沿旧路径还是新路径
- review 时难以判断真实 source of truth

---

## 已确认问题

### P1. 导入站点行为发生回归

`ImportPlanModal` 当前改成只调用 `empireStore.updateStationModules(stationId, modules)`。  
但旧行为在导入时还会处理：

- `lockedWares`
- `warePriority`
- `lastUpdated`

因此，这不是纯结构重构，而是引入了行为变化。  
后续必须先修复这处回归，再继续推进重构。

### P2. 统一命令层未真正落地

虽然新增了 `stationCommands.ts`，但当前主路径仍然主要由 `useStationStore` 自己完成：

- `applyAndRecompute()`
- 本地 `savedPlans` 管理
- 直接 `patch/mutate station state`
- 导入解析与导入后更新

说明 `stationCommands` 目前更像“候选实现”而不是“正式主路径”。

### P3. `stationComputeService` 仍然只是部分抽取

当前 `stationComputeService` 的价值主要体现在：

- 统一了部分 `compute deps`
- 统一了部分 `syncPersistedToStateMap`
- 统一了部分 `recompute`

但上层 store 仍可直接依赖 `stationStateMap`，说明缓存层边界没有真正被 service 封装住。

### P4. 新测试主要覆盖了新文件自身，不足以证明主路径已迁移

当前新增的 unit tests 可以证明：

- service 文件本身可工作
- command 文件本身可工作

但这不等于：

- `useStationStore` 已实际走到 `stationCommands`
- 组件导入流程已实际走到 importer / command
- empire/save-binding 两条真实业务路径都已切换成功

---

## 后续任务原则

### G1. 先修回归，再谈收口

如果导入行为已经回退，就不能继续把本轮任务标记为完成。  
必须先恢复重构前语义，再继续做结构收缩。

### G2. 主路径切换优先于新增抽象

后续重点不是继续增加文件，而是把主调用链真正切换到：

- `stationCommands`
- `stationComputeService`
- `stationImporter`
- `useStationPlanLibrary`

只有主路径切过去，重构才算真实发生。

### G3. 组件层不允许继续直接拼装站点写逻辑

后续任何组件若仍然：

- 直接改 `station.modules/settings/lockedWares`
- 再手动调用 `refreshStationFlowCache()`

都应视为未完成重构。

### G4. 任务完成标准必须按“是否接入主路径”判断

以下情况都不能标记完成：

- 只新建文件但没有调用点
- 只写 unit test 证明 helper 可用
- 只把一部分 helper 从 store 挪走，但 store 主体不变

---

## 分阶段实施任务

### Phase 0: 修复当前回归

#### R2-T1. 修复站点导入时 `lockedWares/warePriority/lastUpdated` 语义丢失

目标：

- 恢复导入站点时的既有行为
- 明确导入命令是“仅替换 modules”还是“应用完整导入 payload”

执行要求：

- 对照重构前行为恢复字段处理
- 不允许组件只调用 `updateStationModules()` 就结束
- 若有必要，补专用命令，例如 `applyImportedStationPayload(stationId, payload)`

验收：

- 导入后 `modules`、`lockedWares`、`warePriority`、`lastUpdated` 与既有语义一致
- 有回归测试覆盖

### Phase 1: 真正接入命令层

#### R2-T2. 在 `useStationStore` 中接入 `stationCommands`

目标：

- 让 `stationCommands` 成为实际主路径
- 将 `useStationStore` 降为 active station facade

需要迁移的入口：

- `addModule`
- `removeModule`
- `updateModuleId`
- `updateModuleCount`
- `toggleWareLock`
- `clearAll`
- `applyPlan`
- 视情况迁移 settings / warePriority 更新

执行要求：

- `useStationStore` 不再直接 `patchStationState/mutateStationState`
- `applyAndRecompute()` 不能继续作为主要编排器长期存在

验收：

- `stationCommands` 有真实调用点
- `useStationStore` 写路径显著缩减

#### R2-T3. 组件侧统一改走命令接口

目标：

- 组件不再直接拼装“改 station + refresh cache”逻辑

重点位置：

- `ImportPlanModal.vue`
- 其他直接调用 `updateStationModules()` 或直接改 station 字段的组件

验收：

- 组件只表达意图，不处理 cache/persist 细节

### Phase 2: 真正收紧计算服务边界

#### R2-T4. 用 `stationComputeService` 收口 `stationStateMap` 访问

目标：

- 上层 store 不再混用 `stationStateMap` 和 service

执行要求：

- 能经 service 读写的都统一走 service
- 若缺少查询接口，在 service 中补，而不是继续直接摸底层 map

验收：

- `useEmpireStore` 直接依赖 `stationStateMap` 的点显著减少

#### R2-T5. 统一 persisted -> state -> recompute 流程

目标：

- 不再由多个模块各自拼装相同步骤

重点调用方：

- `useEmpireStore.refreshStationFlowCache()`
- `productionSourceAdapter`
- `useStationStore.getActiveContext()/syncStateFromActiveStation()`

验收：

- 重复编排收敛到统一 service API

### Phase 3: 真正拆走 `useStationStore` 的遗留职责

#### R2-T6. 接入 `useStationPlanLibrary`

目标：

- 将 `savedPlans`、`saveCurrentPlan`、`loadPlan`、`deletePlan` 等从 `useStationStore` 主体中移出

验收：

- `useStationStore` 内不再维护 `savedPlans` 的 localStorage 持久化细节

#### R2-T7. 接入 `stationImporter`

目标：

- 将 XML / x4-game link 导入解析从 `useStationStore` 主体中移出

执行要求：

- `useStationStore.importPlan()` 如果保留，只做 orchestration
- 导入后的站点更新必须走命令层

验收：

- `useStationStore` 不再直接依赖底层 blueprint parser

### Phase 4: 验证与文档收尾

#### R2-T8. 补主路径测试

目标：

- 证明新抽象真的被主路径使用，而不只是文件可独立运行

必须覆盖：

- `useStationStore` -> `stationCommands`
- 导入流程 -> importer/command
- empire/save-binding 两种 source 的真实写入路径
- 导入回归场景

#### R2-T9. 修正文档状态

目标：

- `tasks.md` 必须反映真实状态

要求：

- 当前不能再写“全部完成”
- 只能标记为“基础设施抽取完成，主路径接入与回归修复未完成”

---

## 更新后的完成定义

只有在以下条件全部满足后，才可以将本轮重构标记为完成：

- 导入行为回归已修复
- `stationCommands` 已接管 `useStationStore` 主写路径
- `stationComputeService` 已成为统一计算编排入口
- `useStationPlanLibrary` 与 `stationImporter` 已接入真实主路径
- 组件层不再直接修改 station 后手动 refresh
- 回归测试与构建验证均通过
