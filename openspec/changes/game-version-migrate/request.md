# game-version-migrate 需求

## 目标

在版本选择弹窗中提供「下载并清理」和「迁移」功能，帮助用户将 beta 版本数据转移到正式版。

## 已确认方案（审核重点）

### 入口

`VersionSettingsModal` 底部按钮栏，仅当 `hasStableCounterpart` 时显示。

按钮顺序：取消 → 下载并清理 → 迁移 → 保存/切换

### 下载并清理

- 从 `StorageExportWizard` 移至 `VersionSettingsModal`
- 导出 beta 全部数据（构建 payload → `triggerJsonDownload`）
- 清除 beta 所有 localStorage keys（含 `save_bindings` 派生 key + `x4_game_version`）
- 删除 beta IndexedDB（`deleteCurrentArchiveDB` + `clearLegacySaveDB`）
- 切换至正式版并刷新
- 按钮 hover tooltip 说明会清除数据

### 迁移

- 导出 beta 全部数据
- 以覆盖模式导入到正式版 storage keys
- 复制 IndexedDB 数据到正式版
- 清除 beta 数据
- 正式版有数据时弹出确认框，展示双方各模块数据数量对比
- 切换至正式版并刷新
- 按钮 hover tooltip 说明直接覆盖不下载

### 提示文本

`betaMigrationHint` 更新为指向弹窗内按钮（不再指向导出弹窗）。

## 边界

### In Scope

- `VersionSettingsModal` 新增「下载并清理」按钮（从 StorageExportWizard 移入）
- `VersionSettingsModal` 新增「迁移」按钮
- 正式版有数据时的确认弹窗（含数量对比）
- Beta 数据清理
- `StorageExportWizard` 移除「下载并清理」

### Out of Scope

- 增量迁移模式
- 选择部分模块迁移

## 验收标准（DoD）

1. `hasStableCounterpart` 时，版本弹窗底部显示「下载并清理」「迁移」按钮
2. 「下载并清理」导出 JSON 后清理 beta 数据并切换到正式版
3. 「迁移」直接将 beta 数据覆盖写入正式版（正式版有数据时确认），切换正式版
4. 两个按钮 hover 各有对应 tooltip
5. 按钮顺序：取消 → 下载并清理 → 迁移 → 确定/保存并切换
6. StorageExportWizard 不再有下载并清理按钮

## 未决项

无
