# game-version-migrate 设计

## 1. 入口

`VersionSettingsModal` 底部按钮栏。`showMigrationActions = isSameVersionSelection && hasStableCounterpart` 时：
- 显示「取消」「下载并清理」「迁移」
- 隐藏「切换」「保存并切换」
- 显示 `betaMigrationHint` 提示文字

`isSameVersionSelection` 确保只有下拉选中项等于当前版本时才显示迁移操作。

## 2. 下载并清理

从 `StorageExportWizard` 移入 `VersionSettingsModal`。

流程：
```
terraformingStore.init()
→ buildExportPayload(全部模块) + buildSaveExportData
→ triggerJsonDownload
→ 清除 8 个 localStorage key + x4_game_version
→ deleteCurrentArchiveDB + clearLegacySaveDB
→ gameDataStore.setVersion(version, false)
```

## 3. 迁移

流程：
```
terraformingStore.init()
→ buildExportPayload(全部模块) + buildSaveExportData
→ 构造 stableGameDataStore wrapper（getStorageKey/getIndexedDBName 指向正式版）
→ normalizeImportPayload → prepareImportPayload
→ applyImportPayload(mode: 'overwrite', stableGameDataStore)
→ 清理 beta 数据
→ gameDataStore.setVersion(version, false)
```

正式版有数据时弹出确认框，展示 beta vs 正式版各模块数据数量对比。用户确认后执行覆盖迁移。

## 4. 导入流水线修复

### 4.1 导入列表始终显示 7 个模块

`StorageImportWizard` 改为始终展示全部 7 个模块类型（`allModuleKeys` 硬编码），不在 JSON 中的显示「0 条数据」。覆盖模式默认全选。

### 4.2 getStorageKey 全 key 显式映射

`importExport.ts` 的 `getStorageKey` 函数增加 `TERRAFORMING_KEY` 和 `SAVE_KEY` 的显式 case，未知 key 改为 throw Error 而非静默 fallback 到 `save_archives`。

### 4.3 覆盖空模块写空状态

`applyImportPayload` 中，选中但无 payload 数据的模块在覆盖模式下改为 `persistModule(key, getEmptyModuleState(key))` 写入合法空状态（如 `{ version, list: [], activeId: null }`），而非 `localStorage.removeItem`。避免 store 初始化时发现 key 不存在而创建默认数据。

### 4.4 导入 UI 异常保护

`StorageImportWizard.handleApplyImport` 增加 try-catch，异常时通过 `statusStore` 显示 UI 报错通知。

## 5. Store 数据自动创建修复

### 5.1 BlueprintProductionStore

- `loadData()`：空列表时不再调用 `createDefaultEmpire`，直接设空状态
- `createEmpire(name, stationName?)`：仅传入 `stationName` 时才创建空间站（用户主动点击"新建"传入，自动创建不传入）
- `fallbackToFirstEmpire()`：保留创建 empire，不传 stationName → 不创建空间站

### 5.2 TerraformingStore

- `init()`：仅在加载到已有数据时调用 `saveToStorage()`，空状态不写入
- `selectCluster()`：无 activePlan 时自动创建 blueprint 计划
- `BlueprintProductionWorkbenchView`：移除 `onMounted` 中的 `ensurePlanForContext` 调用

## 6. 导出边车修复

- `StorageExportWizard.handleDownload`：增加 `terraformingStore.init()` 确保地球化数据已加载
