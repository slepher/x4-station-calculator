# Terraforming Store Specification

## Purpose

将 terraforming 状态从 `useLiveProductionStore` 提取为独立 Pinia store，支持 `x4_terraforming_data` 持久化和游戏版本 key 切换。新增 `mode`（live/blueprint）和 `planId` 字段标记 terraforming 方案引用的存档/蓝图。

## ADDED Requirements

### Requirement: Terraforming Must Have Dedicated Store With Versioned Persistence

Terraforming 状态 MUST 由独立的 `useTerraformingStore` Pinia store 管理，并持久化到 `x4_terraforming_data`（及版本化变体）。

#### Scenario: Terraforming store persists to versioned key

**前提** 当前游戏版本为 `8.0-Diplomacy`，`VersionConfig.storage_keys.terraforming = "x4_terraforming_data_v8_0"`  
**当** terraforming store 保存状态  
**那么** localStorage `x4_terraforming_data_v8_0` 包含 `SavedTerraformingState` JSON  
**并且** 数据变更时自动保存，不需要手动触发

#### Scenario: Terraforming store key switches with game version

**前提** 用户切换到 `9.0-Empire-beta` 游戏版本  
**并且** `VersionConfig.storage_keys.terraforming = "x4_terraforming_data_v9_beta"`  
**当** terraforming store 读取状态  
**那么** 从 `x4_terraforming_data_v9_beta` 读取  
**并且** 不读取旧版本的 key

### Requirement: TerraformingPlan Must Include Mode And PlanId

Terraforming 持久化数据 MUST 包含 `mode` 和 `planId` 字段以标记关联的存档/蓝图方案。

#### Scenario: Live mode plan references save binding

**前提** 用户在 live 工作台创建一个 terraforming plan  
**当** 保存 plan 到持久化存储  
**那么** `mode = "live"`  
**并且** `planId` 等于当前 active save binding 的 id

#### Scenario: Blueprint mode plan references empire

**前提** 用户在 blueprint 工作台创建一个 terraforming plan  
**当** 保存 plan 到持久化存储  
**那么** `mode = "blueprint"`  
**并且** `planId` 等于当前 active empire plan 的 id

### Requirement: Execution Log Hydration Must Expand projectId Array To Entry Objects

持久化的 `executionLogByCluster: Record<string, string[]>` MUST 在 hydrate 时展开为 `Record<string, TerraformingExecutionEntry[]>`。

#### Scenario: Execution log hydrates from projectId array

**前提** 持久化数据中 `executionLogByCluster["cluster_a"] = ["proj_1", "proj_2"]`  
**当** terraforming store hydrate  
**那么** 内存中 `executionLogByCluster["cluster_a"]` 为 `[{ id: "cluster_a-exec-1", projectId: "proj_1" }, { id: "cluster_a-exec-2", projectId: "proj_2" }]`

#### Scenario: Completed projects derived from execution log

**前提** execution log 包含 3 条 `proj_1`  
**当** 派生 `completedProjectsByCluster`  
**那么** `completedProjectsByCluster["cluster_a"].get("proj_1") === 3`

### Requirement: Blueprint Mode Must Not Require Archive Station

blueprint 模式下 MUST NOT 依赖 `ArchiveStationData`，制造港默认 slot 数为 1。

#### Scenario: Blueprint mode has no HQ archive station

**前提** 用户在 blueprint 模式下使用 terraforming  
**当** 渲染 terraforming 工具栏  
**那么** `hqArchiveStation = null`  
**并且** `hqStationName = ""`  
**并且** `hqClusterId = null`  
**并且** `hasHqStation = false`

#### Scenario: Blueprint mode build docks default to 1 slot

**前提** 用户在 blueprint 模式下查看 terraforming 资源面板  
**当** 计算 delivery 总时间  
**那么** `hqBuildDocks = { totalSlots: 1 }`  
**并且** 不依赖实际 station modules

#### Scenario: Blueprint mode cluster matching all false

**前提** 用户在 blueprint 模式下切换 sector panel  
**当** 渲染 cluster 列表  
**那么** `clusterMatchesHq` 对所有 cluster 均为 `false`

### Requirement: SaveBindingPlan Must Not Contain Terraforming Logs

`SaveBindingPlan` 类型 MUST 移除 `terraformingLogs` 字段，terraforming 数据不再与 save binding 耦合。

#### Scenario: SaveBindingPlan has no terraformingLogs

**前提** 系统编译通过  
**当** 检查 `SaveBindingPlan` 类型定义  
**那么** `terraformingLogs` 属性不存在

#### Scenario: Save binding store does not migrate terraformingLogs

**前提** 系统编译通过  
**当** 检查 `useSaveBindingStore` 代码  
**那么** 不存在 `terraformingLogs` 的引用、迁移或持久化逻辑

### Requirement: useLiveProductionStore Must Not Hold Terraforming State

`useLiveProductionStore` MUST 移除所有 terraforming 状态、computed 属性和方法。

#### Scenario: Live production store has no terraforming refs

**前提** 系统编译通过  
**当** 检查 `useLiveProductionStore` 代码  
**那么** `terraformingSelectedClusterId`、`terraformingCompletedProjectsByCluster`、`terraformingExecutionLogByCluster`、`terraformingExecutionSeqByCluster`、`terraformingHousingBuiltByCluster` 均不存在  
**并且** `persistTerraformingLogs`、`hydrateTerraformingLogs` 函数不存在

### Requirement: Terraforming Store Must Provide Per-Cluster Data Isolation

`completedProjects`、`executionLog` MUST 按选中的 cluster 隔离，切换 cluster 时数据自动切换，不同 cluster 的数据互不干扰。

#### Scenario: Switching cluster isolates completed projects and execution log

**前提** 用户 cluster A 有 completed projects `{proj_1: 3, proj_2: 1}` 和 execution log  
**当** 用户切换到 cluster B  
**那么** `completedProjects` 显示 cluster B 的数据（可能为空）  
**并且** `executionLog` 显示 cluster B 的数据  
**并且** 切回 cluster A 后，之前的 `{proj_1: 3, proj_2: 1}` 和 execution log 完整恢复

### Requirement: Terraforming Store Must Guarantee Runtime Stat Consistency

`currentStats` MUST 基于同一份运行时规则统一计算，覆盖所有 UI 消费场景（状态卡片、项目条件、objective 进度、可用性判定）。

#### Scenario: Runtime stats computed from unified pipeline

**前提** 某 cluster 有 completed projects，存在 warming events  
**当** store 计算 `currentStats`  
**那么** 结果 MUST 包含：
- 项目 effects 应用后的所有 stat
- 派生的 airpressure
- warming events 回推后的 temperature

#### Scenario: Same stat value used across all UI contexts

**前提** `currentStats` 已计算完毕  
**当** View/Presenter 层获取 stat 用于渲染或判定  
**那么** 所有消费方 MUST 获取同一份 `currentStats` 值  
**并且** 不允许出现"显示层把 stat 视为 0，但判定层把同一 stat 视为不存在"的不一致

### Requirement: Dynamic Project Pool Depends On Store State

任务列表中的动态项目可见性取决于 store 提供的 `currentStats`，当 stat 跨越动态项目阈值时通过 `resolveAvailableTasks()` 反映变化。

#### Scenario: Stat crosses dynamic project threshold

**前提** 某项目来自 `SetupStatDependentProjects`，其阈值要求 `temperature >= 30`  
**并且** 当前 `currentStats.temperature = 25`  
**当** 用户完成升温项目使 `temperature` 达到 30  
**那么** `resolveAvailableTasks()` 返回的 TaskTree 中 MUST 包含该动态项目  
**并且** 该动态项目不得仅因为是"曾被注入过"就永久保留在列表中

### Requirement: Terraforming Store Must Internally Derive HQ Context From Live Store

`useTerraformingStore` MUST 内部从 `useLiveProductionStore` / `useSaveBindingStore` 获取 HQ context，而非依赖外部 View 注入。调用方向 MUST 为 `useTerraformingStore` → live/blueprint store，不允许反向。

#### Scenario: Terraforming store derives HQ context from live store

**前提** 用户进入 live terraforming 工作台  
**并且** active plan mode=`live`  
**当** terraforming store 计算 `hqStationName`  
**那么** 值从 active save binding 对应的 archive station 名称派生  
**并且** `LiveProductionWorkbenchView.vue` 无需调用任何 setter 注入 HQ context

#### Scenario: Blueprint mode returns empty HQ context

**前提** active plan mode=`blueprint`  
**当** terraforming store 计算 HQ context 属性  
**那么** `hqArchiveStation = null`，`hqStationName = ""`，`hqEffectiveModules = []`，`hqClusterId = null`

### Requirement: Terraforming Presenter Must Adapt To New Store Contract

#### Scenario: Presenter receives data from terraforming store

**前提** `useTerraformingPresenter` 已适配  
**当** presenter 组装 props  
**那么** `terraformingData`、`terraformingSelectedClusterId`、`terraformingExecutionLog` 等来自 `useTerraformingStore`  
**并且** 不再从 `useLiveProductionStore` 获取 terraforming 数据

#### Scenario: Presenter provides default build docks for blueprint

**前提** blueprint 模式下 `hqEffectiveModules = []`  
**当** presenter 计算 `hqBuildDocks`  
**那么** 返回 `{ totalSlots: 1 }` 而非 `null`

### Requirement: Terraforming Data Must Be Supported In Import/Export

导入导出系统 MUST 支持 `x4_terraforming_data` 模块，MUST 按 terraforming plan 的 `mode` 字段与关联的 live/blueprint 数据联动过滤。

#### Scenario: Export includes terraforming data alongside other modules

**前提** 用户打开导出面板  
**当** 计算导出 payload  
**那么** payload `data` 包含 `x4_terraforming_data` 键  
**并且** 该模块在导出面板中显示为统计项

#### Scenario: Export filters out live-mode terraforming plans when live data excluded

**前提** 导出面板中 `includeSaveArchives = false`（不导出 live 数据）  
**当** 构建导出 payload  
**那么** `x4_terraforming_data.list` 中 MUST NOT 包含 mode=`live` 的 plans  
**并且** mode=`blueprint` 的 plans 正常导出

#### Scenario: Export includes all terraforming plans when live data included

**前提** 导出面板中 `includeSaveArchives = true`（导出 live 数据）  
**当** 构建导出 payload  
**那么** `x4_terraforming_data.list` 中包含所有 plans（不区分 mode）

#### Scenario: Import filters out live-mode terraforming plans when live modules not selected

**前提** 导入面板中未勾选 `x4_save_archives` 和 `x4_save_bindings`  
**当** 应用导入  
**那么** mode=`live` 的 terraforming plans MUST 被过滤排除  
**并且** mode=`blueprint` 的 plans 正常导入

#### Scenario: Import filters out blueprint-mode terraforming plans when blueprint modules not selected

**前提** 导入面板中未勾选 `x4_empire_data`、`x4_logic_flow_plans`、`x4_ship_blueprints`、`x4_build_plan_goals`（blueprint 模块均未勾选）  
**当** 应用导入  
**那么** mode=`blueprint` 的 terraforming plans MUST 被过滤排除  
**并且** mode=`live` 的 plans 正常导入

## MODIFIED Requirements

### Requirement: Terraforming Workbench Must Use Dedicated Store

原通过 `useLiveProductionStore` 管理的 terraforming 工作台现 MUST 通过 `useTerraformingStore` 管理。

#### Scenario: Terraforming workbench reads from terraforming store

**前提** 用户进入 terraforming 工作台  
**当** `LiveProductionWorkbenchView.vue` 渲染 terraforming sections  
**那么** 所有 terraforming 计算和操作均通过 `useTerraformingStore` 代理

## REMOVED Requirements

### Requirement: SaveBindingPlan terraformingLogs Field Removed

`SaveBindingPlan.terraformingLogs` 字段被移除。

**理由**：terraforming 状态已迁移至独立的 `x4_terraforming_data` 存储，不再需要嵌入 save binding 中。功能尚未发布，无兼容性问题。
