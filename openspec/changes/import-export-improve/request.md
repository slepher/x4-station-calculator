# import-export-improve 需求

## 目标

修复导入导出中的三个缺陷：存档绑定和地球化在增量模式下未正确去重、导入成功后侧边栏未刷新、地球化模块名称未做 i18n。

## 已确认方案（审核重点）

### 存档绑定导入（当前缺陷：始终覆盖）

- 增量模式下以 `gameGuid` 为去重键 merge：同 `gameGuid` 用导入数据覆盖，新的 `gameGuid` 追加到列表末尾
- 覆盖模式行为不变（全量替换）

### 地球化导入（当前缺陷：增量模式下重复）

- 增量模式下以 `(mode, planId)` 为去重键 merge：已存在的条目用导入数据覆盖，新的追加
- 覆盖模式行为不变

### 导入完成刷新

- 导入成功后 `window.location.reload()` 代替 `emit('close')`，确保 sidebar 刷新显示绑定数据和空间站

### 地球化 i18n

- `moduleNames.terraforming` 中文为「地球化」，英文为「Terraforming」

## 边界

### In Scope

- `applySaveBindingImport` 增加增量 merge 逻辑
- `applyTerraformingImport` 增加增量 merge 逻辑
- `StorageImportWizard.handleApplyImport` 成功后 reload
- `locale/*.json` 新增 `moduleNames.terraforming` key

### Out of Scope

- 建造方案导入的去重（本次不处理）
- 导出流程变更
- 测试代码

## 验收标准（DoD）

1. 存档绑定选择「增量」导入时，同 `gameGuid` 被覆盖，新 `gameGuid` 被追加
2. 地球化选择「增量」导入时，同 `(mode, planId)` 被覆盖，新的被追加
3. 导入成功后页面自动刷新
4. 导入界面地球化显示中文「地球化」

## 未决项

无
