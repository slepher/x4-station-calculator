# Import Anchor

## 第一章：定位总览（最简）

- `guide.import.open-from-station` -> 点击 `logicflow-import-entry-station`，断言 `import-view-modal`
- `guide.import.open-from-empire` -> 点击 `logicflow-import-entry-empire`，断言 `import-view-modal`
- `guide.import.view-close` -> 点击 `import-view-close`，断言 `import-view-modal` 不可见
- `guide.import.select-file` -> 点击 `storage-import-file-input`，断言 `storage-import-config`
- `guide.import.select-mode` -> 点击 `storage-import-mode-overwrite` / `storage-import-mode-incremental`，断言 `storage-import-config`
- `guide.import.toggle-module` -> 点击 `storage-import-module-*`，断言 `storage-import-config`
- `guide.import.plan-item-direct` -> 点击 `logicflow-import-plan-direct-*`，断言导入动作被触发（可能直接导入或进入保存确认）
- `guide.import.apply` -> 点击 `storage-import-apply-btn`，断言 `storage-import-wizard`

## 第二章：锚点定义（详细）

- `guide.import.view-modal`
  - `testid`: `import-view-modal`
- `guide.import.view-close`
  - `testid`: `import-view-close`
- `guide.import.entry-station`
  - `testid`: `logicflow-import-entry-station`
- `guide.import.entry-empire`
  - `testid`: `logicflow-import-entry-empire`
- `guide.import.plan-item-*`
  - `testid`: `logicflow-import-plan-direct-*`
- `guide.import.wizard`
  - `testid`: `storage-import-wizard`
- `guide.import.file-input`
  - `testid`: `storage-import-file-input`
- `guide.import.config`
  - `testid`: `storage-import-config`
- `guide.import.mode.overwrite`
  - `testid`: `storage-import-mode-overwrite`
- `guide.import.mode.incremental`
  - `testid`: `storage-import-mode-incremental`
- `guide.import.module-item`
  - `testid`: `storage-import-module-*`
- `guide.import.apply-btn`
  - `testid`: `storage-import-apply-btn`

## Pending

pending: []
