# game-version-migrate 实施任务

## 1. 下载并清理移入版本弹窗

- [ ] 1.1 `VersionSettingsModal` 新增所需 store 导入（saveStore, saveBindingStore, buildPlanStore, terraformingStore, importExport functions, DB cleanup）。
- [ ] 1.2 实现 `handleDownloadAndClean`：导出 → 清理 localStorage → 删 IndexedDB → 切版本。
- [ ] 1.3 底部新增「下载并清理」按钮，`hasStableCounterpart` 时显示，含 tooltip。

## 2. 迁移按钮

- [ ] 2.1 底部新增「迁移」按钮，`hasStableCounterpart` 时显示，含 tooltip。
- [ ] 2.2 实现 `checkStableDataCount`：检测正式版各模块数据条数。
- [ ] 2.3 实现确认弹窗：展示 beta vs 正式版数据数量对比。
- [ ] 2.4 实现 `handleMigrate`：导出 beta → 覆盖写入正式版 → 复制 IndexedDB → 清理 beta → 切版本。

## 3. 提示文本更新

- [ ] 3.1 更新 `betaMigrationHint` 中英文 i18n，指向弹窗内按钮。
- [ ] 3.2 新增「下载并清理」和「迁移」按钮的 tooltip i18n。

## 4. 构建验证

- [ ] 4.1 运行 `npm run build`。
- [ ] 4.2 编译错误修复至通过。
