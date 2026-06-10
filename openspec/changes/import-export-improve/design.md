# import-export-improve 设计

## 1. 存档绑定增量去重

### 当前问题

`applySaveBindingImport` (importExport.ts:1385) 无条件调用 `saveBindingStore.loadData(bindingData)` 全量替换，不检查 `options.mode`。

### 方案

增量模式下：
1. 取当前 `currentState = options.saveBindingStore.savedBindings`
2. 以 `gameGuid` 为键构建 Map
3. 遍历导入数据，同 `gameGuid` 覆盖，新 `gameGuid` 追加
4. 调用 `store.loadData(merged)` 写回

覆盖模式不变。

## 2. 地球化增量去重

### 当前问题

`applyTerraformingImport` 增量模式（line 1458-1473）生成新 `id` 后直接 concat，未检查 `(mode, planId)` 是否已存在。`planId` 在 live 模式下即为 `gameGuid`，是自然去重键。

### 方案

增量模式下：
1. 取 `current = options.terraformingStore.savedPlans`
2. 从 `current.list` 构建 `(mode, planId) → plan` 的 Map
3. 遍历导入数据，同键覆盖，新键追加
4. 写回 storage + `store.init()` 刷新

覆盖模式不变。

## 3. 导入成功刷新

`StorageImportWizard.handleApplyImport` 成功后 `window.location.reload()` 替换 `emit('close')`。页面重载后所有 store 从 localStorage 重新初始化，sidebar 自然同步。

## 4. 地球化 i18n

`locale/zh-CN.json`: `moduleNames.terraforming: "地球化"`
`locale/en.json`: `moduleNames.terraforming: "Terraforming"`

`StorageImportWizard` 和 `StorageExportWizard` 中的 `moduleTitle` 已有 `t('moduleNames.terraforming', 'Terraforming')` fallback，添加 key 后自动生效。
