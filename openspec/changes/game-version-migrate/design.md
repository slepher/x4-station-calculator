# game-version-migrate 设计

## 1. 入口

`VersionSettingsModal` 底部按钮栏。`hasStableCounterpart` 时在「取消」和「确定/保存并切换」之间插入两个按钮。

按钮顺序：`取消` | `下载并清理` | `迁移` | `保存/切换`

## 2. 下载并清理

从 `StorageExportWizard` 移入 `VersionSettingsModal`。

所需 stores（新增导入）：
- `useSaveStore`、`useSaveBindingStore`、`useBuildPlanStore`、`useTerraformingStore`
- `buildExportPayload`、`buildSaveExportData`、`triggerJsonDownload`
- `clearLegacySaveDB`、`deleteCurrentArchiveDB`

流程：
```
buildExportPayload(全部模块) + buildSaveExportData
→ triggerJsonDownload
→ 清除 8 个 localStorage key + x4_game_version
→ deleteCurrentArchiveDB + clearLegacySaveDB
→ gameDataStore.setVersion(version, false)
```

## 3. 迁移

流程：
```
buildExportPayload(全部模块) + loadArchiveDetailFromDB(全部)
→ 获取正式版 VersionConfig
→ 逐模块写入正式版 storage_keys（覆盖模式）
→ 复制 IndexedDB 数据到正式版 DB
→ 清理 beta 数据（同下载并清理）
→ gameDataStore.setVersion(version, false)
```

正式版有数据时弹出确认框，展示各模块数据数量对比。

## 4. 提示文本

`betaMigrationHint` 更新为：
- zh-CN: "当前为测试版本。如需迁移至正式版，可使用下方「下载并清理」导出数据后导入正式版，或点击「迁移」直接覆盖写入正式版。"
- en: "You are on a beta version. Use 'Download & Clean' to export and clear, then import into stable. Or use 'Migrate' to directly overwrite the stable version."

## 5. Tooltip

| 按钮 | tooltip |
|------|---------|
| 下载并清理 | 下载当前数据后清除所有 beta 版本地存储。清除后可将下载的文件导入到正式版中继续使用。 |
| 迁移 | 将当前 beta 数据直接覆盖写入正式版，不生成下载文件。正式版已有数据将被替换。 |
