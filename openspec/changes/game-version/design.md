# game-version 设计

## 背景

现有实现把“资源目录版本”和“用户可选版本”都压在版本配置结构里，导致 `9.0-beta` 发布到 `9.0` 正式版时出现职责混淆。资源侧只需要知道实际目录是 `9.0-Empire`，但用户侧需要同时保留 `9.0-beta` 和 `9.0` 两个可选状态，用于 UI 展示、用户选择和未来数据迁移。

## 设计决策

### 1. 配置拆分为两种语义

`x4-station-calculator.config.json` 继续作为资源处理配置。它只描述实体资源目录，因此保留 `8.0-Diplomacy` 与 `9.0-Empire` 两项，不表达 `9.0-beta`。

`src/assets/versions.json` 作为用户版本配置。它描述前端可选版本，因此包含 `8.0`、`9.0-beta`、`9.0` 三项。这里的 `version + beta` 是用户版本 identity，不再等价于物理资源目录 identity。

### 2. 两个 9.0 用户版本共享资源目录

`9.0-beta` 与 `9.0` 都使用 `folder_name = "9.0-Empire"`。这样数据加载、i18n 加载、资源引用都落到同一套已发布资源目录。

### 3. 9.0 正式版独立存储命名

`9.0-beta` 保留 `_v9_beta` storage keys 和 `x4_save_archive_db_v9_beta`。`9.0` 正式版使用 `_v9` 命名（如 `x4_empire_data_v9`）和 `x4_save_archive_db_v9`。两者数据完全隔离，不做自动迁移。

### 4. 展示后缀只属于 beta

`beta_type` 和 `mini_version` 只在 `beta = true` 的用户版本上参与展示。正式版 `9.0` 即使配置中存在历史字段，也不能在 StationToolbar 或简短版本显示中追加 `rc` 或 mini 后缀。

### 5. Store 初始化必须等待 gameData ready

`getStorageKey()` 在 `currentVersionConfig` 未就绪时会返回 fallback 硬编码 key。为确保版本感知的 storage key 正确，所有依赖 `getStorageKey()` 的 store 必须采用显式 `init()` 模式：在 `init()` 中先 `await gameData.initialize()`，再加载本地数据。Store 创建时不得自动加载。

受影响的 store：
- `useBuildPlanStore` — 新增 `init()`，移除创建时的 `loadPlansFromStorage()`
- `useShipBuildStore` — 移除创建时的 `loadBlueprintsFromStorage()`，保留 `initialize()` 中的加载
- `useActiveViewStore` — 新增 `init()`，状态初始化为 `DEFAULT_STATE`

App.vue 初始化链：
```
gameData → activeView.init() → save/binding → blueprint/live
  → Promise.all(logicFlow, map, shipBuild) → buildPlan.init()
```

### 6. 版本选择弹窗 beta 显示开关

`VersionSettingsModal` 增加「显示 beta 版本」checkbox：
- 默认：当前版本为 beta 时勾选，非 beta 时不勾选
- 取消勾选时过滤掉 `beta: true` 的选项
- 取消勾选导致当前选中被过滤时，自动切到第一个稳定版

## 数据流

1. 资源脚本读取 `x4-station-calculator.config.json`。
2. 前端读取 `src/assets/versions.json`。
3. `useGameDataStore` 通过 `version + beta` 匹配用户版本配置。
4. 匹配到的用户版本配置提供：
   - `folder_name`：加载游戏资源与游戏语言包。
   - `storage_keys`：读写用户数据。
   - `indexeddb_name`：读写 save archive IndexedDB。
5. `VersionSettingsModal` 使用 `versionOptions` 展示三个用户版本。
6. `StationToolbar` 使用 `displayFullVersion()` 展示当前用户版本。

## 风险与处理

- `9.0` 正式版使用 `_v9` storage，`9.0-beta` 使用 `_v9_beta`，两者数据不互通。用户需通过导入导出迁移数据。
- `version + beta` 仍是用户版本 identity，因此 `9.0-beta` 与 `9.0` 能同时存在于版本下拉框。
- 资源脚本如果仍按 `current_version + beta` 匹配资源配置，资源配置顶层 `beta` 必须与 `9.0` 资源项一致，即正式版为 `false`。

## 不做事项

- 不自动迁移 `_v9_beta` 数据到 `_v9`。
- 不改资源 JSON/XML 内容。
- 不把资源处理脚本改成读取 `src/assets/versions.json`。

## 7. Beta 迁移引导

### 7.1 hasStableCounterpart

Store 新增 computed `hasStableCounterpart`：
```
isBeta && versionsConfig 中存在 v.version === currentVersion && !v.beta
```
仅当当前 beta 版本有对应正式版时才为 true，作为后续所有迁移引导功能的统一条件。

### 7.2 StationToolbar 红点

`showVersionIndicator` 条件扩展为 `needsVersionSetup || hasStableCounterpart`，提示用户存在可迁移的 beta 数据。

### 7.3 导出弹窗「下载并清理」

入口：`StorageExportWizard.vue` 底部，「下载」按钮左侧，仅 `hasStableCounterpart` 时显示。文案「下载并清理」，`v-tippy` tooltip 说明。打开弹窗时默认勾选存档 checkbox。

流程：复用 `doExport()` 导出 → 逐 key 清除 localStorage（含 save_bindings 派生 key） → 清除 IndexedDB 表数据 → 删除当前版本 IndexedDB → 删除遗留 DB → `gameDataStore.setVersion(...)` 切换正式版并刷新。

### 7.4 版本选择弹窗迁移提示与过滤

- `hasStableCounterpart` 时在 `dataIsolationHint` 下方显示琥珀色迁移提示。
- checkbox 重命名为 `showAllBeta`，默认值 `hasStableCounterpart`。
- `filteredVersionOptions`：勾选显示全部；取消时仅隐藏有同名稳定版的 beta（`hasStableOption` 检查），无稳定版的独立 beta 始终显示。
- 导出 payload 构建逻辑与 `handleDownload` 共用
