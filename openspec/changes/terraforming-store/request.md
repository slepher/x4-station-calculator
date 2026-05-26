# Terraforming Store — 独立存储与双模式支持

## 目标

将 terraforming 状态从 `useLiveProductionStore` 提取为独立的 `useTerraformingStore`，持久化至 `x4_terraforming_data`（支持游戏版本 key 切换）。新增 `mode: 'live' | 'blueprint'` 和 `planId` 字段标记 terraforming 方案关联的存档/蓝图，使 terraforming 在 live 和 blueprint 两模式下都可独立使用。

## 已确认方案（审核重点）

### Store 独立化

1. 创建 `useTerraformingStore` Pinia store，所有权 terraforming 的状态管理、持久化和 CRUD。
2. 持久化 key 为 `x4_terraforming_data`，通过 `gameData.getStorageKey('terraforming')` 解析，跟随 `VersionConfig.storage_keys.terraforming` 实现游戏版本 key 切换。
3. Store 模式参照 `useEmpireDataStore`：`SavedTerraformingState { version, activeId, list: TerraformingPlan[] }`。
4. 变更发生时自动持久化（不需要手动保存），与 `useEmpireDataStore` 行为一致。

### 持久化 Schema

5. `TerraformingPlan` 持久化字段：
   - `id: string`
   - `mode: 'live' | 'blueprint'`
   - `planId: string` — live 模式引用 `save_binding` id，blueprint 模式引用 `empire` plan id
   - `selectedClusterId: string | null`
   - `executionLogByCluster: Record<string, string[]>` — clusterId → projectId[]（保持简洁，与当前 binding.terraformingLogs 一致）
6. `housingBuiltByCluster` 不持久化，仅内存维护。

### 内存展开

7. hydrate 时将 `executionLogByCluster` 的 `projectId[]` 展开为 `TerraformingExecutionEntry[]`（补上 `id = ${clusterId}-exec-${index + 1}`）。
8. `completedProjectsByCluster` 从 execution log 统计派生。
9. `executionSeqByCluster` 从 execution log 长度派生。

### live vs blueprint 模式行为差异

10. **`useTerraformingStore` 主动向 live/blueprint store 取 HQ context**，而非由外部 View 注入。Store 内部根据 active plan 的 `mode` 自动选择数据源。
11. live 模式下 HQ context 从 `useLiveProductionStore` / `useSaveBindingStore` 获取：
    - `hqStationName`：active binding 对应的 archive station 名称
    - `hqArchiveStation`：active binding 对应的 `ArchiveStationData`
    - `hqEffectiveModules`：`hqArchiveStation.modules`
    - `hqClusterId`：`hqArchiveStation.sectorMacro`
12. blueprint 模式下 HQ context 不可用：`hqArchiveStation = null`，`hqEffectiveModules = []`，`hqClusterId = null`，`hqStationName = ''`。
13. blueprint 模式默认制造港数量为 1 个 slot（`hqBuildDocks = { totalSlots: 1 }`），不依赖实际模块。
14. blueprint 模式下 `clusterMatchesHq` 全部为 `false`，`hasHqStation = false`。
15. **调用方向**：`useTerraformingStore` → `useLiveProductionStore` / `useBlueprintProductionStore` / `useSaveBindingStore`，反之不允许。

### 清理

16. 从 `SaveBindingPlan` 中移除 `terraformingLogs` 字段。
17. 从 `useSaveBindingStore` 中移除 `terraformingLogs` 的迁移/持久化代码。
18. 从 `useLiveProductionStore` 中移除所有 terraforming 相关状态、computed、方法。

### 无数据迁移

19. terraforming 功能尚未发布，不需要任何 migration 逻辑。

### presenter 适配

20. `useTerraformingPresenter` 的 `TerraformingPresenterStore` 接口改为匹配 `useTerraformingStore`。
21. presenter 内部处理 blueprint 模式下的 HQ context 差异（`hqBuildDocks` 默认值等），组件无需感知模式差异。
22. 所有 Vue 组件不变（通过 props 消费，已适配好 `null`/`false` 状态）。

### 导入导出支持

23. `importExport.ts` 新增 `x4_terraforming_data` 作为 `ImportModuleKey`。
24. **导出时** terraforming 数据按 mode 跟随关联数据：
    - 不导出 live 数据（`includeSaveArchives = false`）→ 不导出 mode=`live` 的 terraforming plans
    - 不导出 blueprint 数据 → 不导出 mode=`blueprint` 的 terraforming plans（当前导出始终含 blueprint 数据，因此 mode=`blueprint` 始终导出）
25. **导入时** terraforming 数据按 mode 跟随关联模块选择：
    - 未勾选 live 模块（`x4_save_archives` / `x4_save_bindings`）→ 过滤掉 mode=`live` 的 plans
    - 未勾选 blueprint 模块（`x4_empire_data` / `x4_logic_flow_plans` / `x4_ship_blueprints` / `x4_build_plan_goals` 均未勾选）→ 过滤掉 mode=`blueprint` 的 plans
26. `StorageImportWizard` 和 `StorageExportWizard` 增加 `x4_terraforming_data` 模块的展示和选择。

## 边界

### In Scope

- 创建 `useTerraformingStore`（状态、CRUD、持久化）
- 新增类型定义：`TerraformingPlan`、`SavedTerraformingState`
- 注册 `terraforming` storage key 到 `getStorageKey()` 和 `VersionConfig`
- 添加 `CURRENT_TERRAFORMING_VERSION = 1`
- `SaveBindingPlan` 移除 `terraformingLogs`
- `useSaveBindingStore` 清理 terraformingLogs 相关代码
- `useLiveProductionStore` 移除 terraforming 状态和方法
- `useTerraformingPresenter` 适配新 store 契约
- `LiveProductionWorkbenchView.vue` 更新 store 引用
- `importExport.ts` 新增 `x4_terraforming_data` 模块，支持导出/导入时的 mode 过滤
- `StorageImportWizard.vue` / `StorageExportWizard.vue` 增加 terraforming 数据展示/选择
- `npm run build` 无编译错误

### Out of Scope

- 测试编写与执行
- UI 组件修改（所有组件通过 props 驱动，无需修改）
- `terraformingTaskResolver.ts` / `terraformingRuntime.ts` 修改（纯计算逻辑不变）
- 数据迁移（功能未发布）
- 新 i18n 文案

## 验收标准（DoD）

1. `useTerraformingStore` 可正确读写 `x4_terraforming_data` 到 localStorage。
2. `VersionConfig.storage_keys.terraforming` 切换后使用对应版本 key。
3. `TerraformingPlan` 持久化字段仅包含 `id`, `mode`, `planId`, `selectedClusterId`, `executionLogByCluster`。
4. 内存展开后 `executionLogByCluster` 为 `TerraformingExecutionEntry[]` 格式，含 `id` 和 `projectId`。
5. `SaveBindingPlan` 中不再有 `terraformingLogs` 字段。
6. `useLiveProductionStore` 中不再有 terraforming 相关状态/方法。
7. live 模式下 terraforming 功能正常：可查看星球、执行项目、查看资源面板。
8. blueprint 模式下 terraforming 功能正常：可查看星球、执行项目，制造港默认为 1 slot，无 HQ 星区信息。
9. `useTerraformingPresenter` 接口与新的 `useTerraformingStore` 正确对接。
10. 导出时不勾选 live 数据则不含 mode=`live` 的 terraforming plans。
11. 导入时未勾选对应的 live/blueprint 模块则过滤掉对应 mode 的 terraforming plans。
12. `npm run build` 无编译错误。

## 未决项

无
