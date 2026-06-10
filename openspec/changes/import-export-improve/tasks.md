# import-export-improve 实施任务

## 1. 存档绑定增量合并

- [x] 1.1 `applySaveBindingImport` 中增量模式下以 `gameGuid` 为键 merge，同键覆盖、新键追加。
- [x] 1.2 覆盖模式行为不变。

## 2. 地球化增量合并

- [x] 2.1 `applyTerraformingImport` 中增量模式下以 `(mode, planId)` 为键 merge，同键覆盖、新键追加。
- [x] 2.2 覆盖模式行为不变。

## 3. 导入成功刷新

- [x] 3.1 `StorageImportWizard.handleApplyImport` 成功后将 `emit('close')` 改为 `window.location.reload()`。

## 4. 地球化 i18n

- [x] 4.1 `locale/zh-CN.json` 新增 `moduleNames.terraforming: "地球化"`。
- [x] 4.2 `locale/en.json` 新增 `moduleNames.terraforming: "Terraforming"`。

## 5. 构建验证

- [x] 5.1 运行 `npm run build`。
- [x] 5.2 编译错误修复至通过。
