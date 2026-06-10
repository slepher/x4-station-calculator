# Terraforming Store — Tasks

## Task 1: 添加类型定义

- [x] 文件: `src/types/x4.ts`
- [x] 新增 `TerraformingPlan` interface：`id`, `mode` (`'live' | 'blueprint'`), `planId`, `selectedClusterId`, `executionLogByCluster`
- [x] 新增 `SavedTerraformingState` interface：`version`, `activeId`, `list: TerraformingPlan[]`
- [x] `VersionConfig.storage_keys` 增加 `terraforming: string`
- [x] `SaveBindingPlan` 移除 `terraformingLogs?: Record<string, string[]>`

## Task 2: 添加版本常量

- [x] 文件: `src/store/logic/storageVersions.ts`
- [x] 新增 `export const CURRENT_TERRAFORMING_VERSION = 1`

## Task 3: 注册 storage key

- [x] 文件: `src/store/useGameDataStore.ts`
- [x] `getStorageKey()` 增加 `'terraforming'` case，返回 `config.storage_keys.terraforming` 或默认 `'x4_terraforming_data'`
- [x] `TerraformingData` 类型导出（`VersionConfig` 更新后 `getStorageKey` 参数类型需同步更新）

## Task 4: 创建 useTerraformingStore

- [x] 文件: `src/store/useTerraformingStore.ts`（新建）
- [x] 参照 `useEmpireDataStore` 模式创建 Pinia store `defineStore('terraforming', () => {...})`
- [x] 实现以下状态：
  - `savedPlans: ref<SavedTerraformingState>` — 持久化数据
  - `expandedExecutionLogByCluster: ref<Record<string, TerraformingExecutionEntry[]>>` — 内存展开
  - `executionSeqByCluster: ref<Record<string, number>>` — 内存
- [x] 实现持久化方法：
  - `getStorageKey()`: 从 `useGameDataStore`.getStorageKey('terraforming')
  - `saveToStorage()`: JSON.stringify `savedPlans.value` 写入 localStorage
  - `loadFromStorage()`: 读取 localStorage，parse + 校验结构，设置 `savedPlans.value`
  - `hydrateExecutionLogs()`: 将 active plan 的 `executionLogByCluster` 展开为 `expandedExecutionLogByCluster.value`
- [x] 实现 Plans CRUD：
  - `ensurePlanForContext(mode, planId)`: 按 mode+planId 查找已有 plan，未找到则 `createPlan`
  - `createPlan(mode, planId)`: 生成 `id = "tp-${Date.now()}"`，创建 plan 加入 list，设为 active，`saveToStorage` + `hydrateExecutionLogs`
  - `deletePlan(id)`: 从 list 移除，若 activeId 匹配则 clear，`saveToStorage`
  - `setActivePlan(id)`: 更新 activeId，`hydrateExecutionLogs`
- [x] 实现 Cluster 操作（每个方法后调用 `saveToStorage`）：
  - `selectCluster(clusterId)`: 更新 `activePlan.value.selectedClusterId`
  - `appendExecution(projectId, count)`: 向当前 cluster 的 expanded log 追加 entries，同步回 `executionLogByCluster`（压缩为 projectId[]）
  - `removeExecution(entryId)`: 从 expanded log 中删除指定 entry，同步回 plan
  - `setProjectCount(projectId, count)`: 确保当前 cluster log 中该 project 恰有 count 个 entry
  - `replaceExecutionLog(entries)`: 替换当前 cluster 的整个 expanded log，同步回 plan
  - `clearExecutionQueue()`: 清空当前 cluster log
- [x] 实现 HQ Context computed（内部从 live/blueprint store 获取）：
  - 导入 `useLiveProductionStore`、`useSaveBindingStore`
  - `hqStationName` / `hqArchiveStation` / `hqEffectiveModules` / `hqClusterId` — live 模式下从 active binding 对应 archive station 取值；blueprint 模式返回空/默认
  - `isLiveMode` / `isBlueprintMode`: activePlan.mode 判断
- [x] 实现 computed (derived)：
  - `activePlan`: 从 `savedPlans.value.list` 中按 `activeId` 查找
  - `selectedCluster`: 从 `terraformingData` 和 `selectedClusterId` 查找
  - `executionLog`: 当前 cluster 的 expanded execution entries
  - `completedProjects`: `buildCompletedProjectsFromExecutionLog(executionLog)`
  - `currentStats`: `replayExecutionLog(deductedExecution.value.remainingLog, ...).finalStats`
  - `currentCumulativeRebates`: `replayExecutionLog(...).finalRebates`，基于 baseState.rebates + task log 回放得出累计 rebates
  - `runtimeProjectIds`: `getRuntimeTerraformingProjectIds(selectedCluster, currentStats, completedProjects, terraformingData)`
  - `terraformingData`: 来自 `useGameDataStore()` 的 game data

## Task 5: 清理 SaveBindingPlan 中的 terraformingLogs

- [x] 文件: `src/store/useSaveBindingStore.ts`
- [x] 搜索所有 `terraformingLogs` 引用并移除
- [x] 包括：类型映射、迁移逻辑、normalize 函数、读取/写入路径
- [x] `SaveBindingPlan` 类型中已移除字段（Task 1 完成）

## Task 6: 清理 useLiveProductionStore

- [x] 文件: `src/store/useLiveProductionStore.ts`
- [x] 移除以下 refs：`terraformingSelectedClusterId`, `terraformingCompletedProjectsByCluster`, `terraformingExecutionLogByCluster`, `terraformingExecutionSeqByCluster`, `terraformingHousingBuiltByCluster`
- [x] 移除以下 computed：`terraformingExecutionLog`, `terraformingCompletedProjects`, `terraformingCurrentStats`, `terraformingRuntimeProjectIds`, `terraformingHousingBuilt`, `terraformingData`, `terraformingSelectedCluster`, `isTerraformingMode`
- [x] 移除以下方法：`selectTerraformingCluster`, `setTerraformingCompletedProjects`, `appendTerraformingProjectExecution`, `setTerraformingProjectCount`, `removeTerraformingExecutionEntry`, `replaceTerraformingExecutionLog`, `clearTerraformingExecutionQueue`, `setTerraformingHousingBuilt`, `persistTerraformingLogs`, `hydrateTerraformingLogs`, `selectTerraforming`
- [x] 清理 import（`TerraformingExecutionEntry`, `buildCompletedProjectsFromExecutionLog`, `computeTerraformingRuntimeStats`, `getRuntimeTerraformingProjectIds`, `TerraformingData`, `TerraformingCluster` 等）
- [x] 移除 `return` 对象中的 terraforming 导出
- [x] 保留 HQ context computed: `terraformingHqStationCode`, `terraformingHqStationName`, `terraformingHqArchiveStation`, `terraformingHqEffectiveModules`, `terraformingHqClusterId`

## Task 7: 适配 useTerraformingPresenter Store 接口

- [x] 文件: No changes needed — presenter uses generic `TerraformingPresenterStore` interface, view provides adapter
- [x] Presenter 的蓝图 HQ context 处理：`hqBuildDocks` 已处理 `null` → `{ totalSlots: 1 }`，其余通过 HQ context 默认值处理
- [x] `TerraformingPresenterStore` 接口增加 `terraformingCurrentCumulativeRebates: ComputedRef<RebateKey[]>`，`activeRebates` 改为从 store 获取而非从 completedProjects 静态数据累加

## Task 8: 更新 LiveProductionWorkbenchView.vue

- [x] 文件: `src/components/empire/LiveProductionWorkbenchView.vue`
- [x] 导入 `useTerraformingStore` 替代从 `useLiveProductionStore` 获取 terraforming 属性
- [x] 重新绑定所有 terraforming-related computed 和 mutations 到新 store
- [x] `isTerraformingMode` 通过 `useActiveViewStore` 的 `activeBindingWorkbench` 继续工作（`selectStation`/`selectTransitSector` 内直接操作）
- [x] 无需调用 `setHqContext`：terraforming store 内部自动从 live store 获取 HQ context

## Task 9: 导入导出支持 — importExport.ts 核心逻辑

- [x] 文件: `src/store/logic/importExport.ts`
- [x] `ImportModuleKey` 类型增加 `'x4_terraforming_data'`
- [x] 新增 `TERRAFORMING_KEY` 常量，`STORAGE_KEY_MAP` 增加映射
- [x] `buildExportPayload` 增加可选参数 `terraforming?: SavedTerraformingState`
- [x] 导出过滤: `saveBindings` 为 `undefined` 时过滤 mode=`live`
- [x] `getModuleImportStats` 增加 terraforming 统计
- [x] 新增 `coerceTerraformingState(raw)` 函数
- [x] `prepareImportPayload` 增加 terraforming module 预处理
- [x] 新增 `applyTerraformingImport(options, warnings)` 函数
- [x] 导入过滤: 按 selectedModules 判断是否勾选 live/blueprint 模块，未勾选则过滤对应 mode
- [x] `getImportModulesFromRaw` 增加 `TERRAFORMING_KEY`

## Task 10: 导入导出支持 — StorageExportWizard.vue

- [x] 文件: `src/components/StorageExportWizard.vue`
- [x] 导入 `useTerraformingStore`
- [x] `handleDownload` + on open 中调用 `buildExportPayload` 时传入 `terraformingStore.savedPlans`
- [x] `moduleTitle` switch 增加 terraforming case

## Task 11: 导入导出支持 — StorageImportWizard.vue

- [x] 文件: `src/components/StorageImportWizard.vue`
- [x] 导入 `useTerraformingStore`
- [x] `selectedModules` ref 增加 `x4_terraforming_data: false`
- [x] `moduleTitle` switch 增加 terraforming case
- [x] `setDefaultSelections` 和 `watch(isOpen)` 中增加 terraforming 模块 key
- [x] `handleApplyImport` 中传入 `terraformingStore` 到 `applyImportPayload`

## Task 12: 验证

- [x] 执行 `npm run build` — 通过, zero errors
- [x] 全局搜索残留 `terraformingLogs` — 无残留
- [x] 全局搜索 `liveStore.*terraform` 残留引用 — 无残留
