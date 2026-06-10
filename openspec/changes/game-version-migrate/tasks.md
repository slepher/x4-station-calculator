# game-version-migrate 实施任务

## 1. 版本弹窗迁移入口

- [x] 1.1 `showMigrationActions = isSameVersionSelection && hasStableCounterpart`。
- [x] 1.2 `showMigrationActions` 时显示「下载并清理」「迁移」按钮、`betaMigrationHint`。
- [x] 1.3 `showMigrationActions` 时隐藏「切换」「保存并切换」按钮。

## 2. 下载并清理

- [x] 2.1 实现 `handleDownloadAndClean`：导出 → 清理 localStorage → 删 IndexedDB → 切版本。
- [x] 2.2 导出时先 `terraformingStore.init()` 确保数据已加载。

## 3. 迁移

- [x] 3.1 `handleMigrate`：构造 `stableGameDataStore` wrapper → `applyImportPayload` 覆盖导入正式版。
- [x] 3.2 实现 `checkStableCounts`：正式版有数据时弹出数量对比确认框。
- [x] 3.3 确认后执行迁移覆盖，取消则关闭。

## 4. 导入流水线

- [x] 4.1 导入列表始终显示 7 个模块（不在 JSON 中的显示 count=0）。
- [x] 4.2 `getStorageKey` 全 key 显式映射，未知 key throw。
- [x] 4.3 覆盖清空改为写入合法空状态（`getEmptyModuleState` 而非 `removeItem`）。
- [x] 4.4 导入 `handleApplyImport` try-catch UI 报错。

## 5. Store 自动创建

- [x] 5.1 `BlueprintProductionStore.loadData` 空列表不创建默认 empire。
- [x] 5.2 `createEmpire` 仅传入 `stationName` 时创建空间站。
- [x] 5.3 `TerraformingStore.init` 空数据不调用 `saveToStorage`。
- [x] 5.4 `selectCluster` 无 plan 时自动创建 blueprint 计划。
- [x] 5.5 `BlueprintProductionWorkbenchView` 移除 `ensurePlanForContext`。

## 6. 构建验证

- [x] 6.1 运行 `npm run build`。
- [x] 6.2 编译错误修复至通过。
