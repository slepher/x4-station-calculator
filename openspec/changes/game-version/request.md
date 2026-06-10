# game-version 需求

## 目标

将“游戏版本”相关配置拆成两条明确的管理线：资源管理版本与用户可选版本。资源管理继续服务 `scripts/` 下的 distiller 和 data processor，仅保留实际资源目录版本；用户版本管理服务前端版本切换 UI 与本地数据隔离，需要同时暴露 `8.0`、`9.0-beta`、`9.0` 三个用户版本。

## 已确认方案（审核重点）

### 资源管理版本

- 资源管理配置继续位于 `x4-station-calculator.config.json`。
- 资源管理只保留两个版本：
  - `8.0` -> `8.0-Diplomacy`
  - `9.0` -> `9.0-Empire`
- 资源管理面向 `scripts/` 下 distiller、data processor 和相关资源生成脚本。
- 资源管理不需要表达 `9.0-beta` 用户版本，因为 `9.0-beta` 与 `9.0` 使用同一套资源目录。

### 用户版本管理

- 用户版本配置继续位于 `src/assets/versions.json`。
- 用户版本列表需要包含三项：
  - `8.0`
  - `9.0-beta`
  - `9.0`
- `9.0-beta` 与 `9.0` 的 `folder_name` 都指向 `9.0-Empire`。
- `9.0-beta` 的 localStorage key 和 IndexedDB name 继续使用现有 `_v9_beta` 命名。
- `9.0` 正式版的 localStorage key 和 IndexedDB name 使用 `_v9` 命名（独立于 beta）。
- 默认用户版本切换到 `9.0` 正式版，即 `current_version = "9.0"` 且 `beta = false`。

### 展示规则

- `beta_type`、`mini_version`、`rc` 等后缀仅在用户版本 `beta = true` 时展示。
- 正式版 `9.0` 在 StationToolbar 上应显示为 `9.0`，不得显示 `9.0-rc-*`、`9.0-beta-*` 或 `9.0-*` mini 后缀。
- 版本选择弹窗中应同时能区分 `9.0-beta` 与 `9.0`，即使两者共享相同资源目录。

### 后续迁移边界

- `9.0-beta` 继续使用 `_v9_beta` storage，与正式版 `_v9` 独立。

### Beta 版本迁移引导

- Store 新增 `hasStableCounterpart` computed：当前版本 `isBeta` 且 `versions.json` 中存在同 version 号的稳定版。
- StationToolbar 版本按钮在 `hasStableCounterpart` 为 true 时显示红点。
- 版本选择弹窗中 `hasStableCounterpart` 为 true 时：
  - 显示迁移提示文字
  - 底部新增「下载并清理」和「迁移」按钮（详见 game-version-migrate）
- 版本选择弹窗 checkbox 改为「显示全部测试版」（`showAllBeta`）：
  - 默认值改为 `hasStableCounterpart`。
  - 勾选时显示所有 beta；取消时仅隐藏存在同名稳定版的 beta。

## 边界

### In Scope

- 调整资源管理配置与用户版本配置的职责边界。
- 在用户版本配置中新增或恢复 `9.0-beta` 与 `9.0` 两个独立用户选项。
- 保证两个 9.0 用户选项都加载 `9.0-Empire` 资源目录。
- 保证正式版展示不附带 beta/rc/mini 后缀。

### Out of Scope

- 不迁移现有用户数据。
- 不新增导入导出迁移流程。
- 不改资源文件内容。
- 不改测试实现；测试文档与测试代码由后续测试阶段处理。

## 验收标准（DoD）

- `x4-station-calculator.config.json` 中资源版本只有 `8.0` 与 `9.0` 两项，且 `9.0.folder_name = "9.0-Empire"`。
- `src/assets/versions.json` 中用户版本包含 `8.0`、`9.0-beta`、`9.0` 三项。
- `src/assets/versions.json` 中 `9.0-beta.folder_name` 与 `9.0.folder_name` 都为 `9.0-Empire`。
- `src/assets/versions.json` 中 `9.0-beta` 的 storage keys 和 IndexedDB name 保持 `_v9_beta`；`9.0` 正式版使用 `_v9`。
- 默认用户版本为 `9.0` 正式版。
- StationToolbar 显示正式版 `9.0` 时不显示 beta/rc/mini 后缀。
- 版本选择弹窗能展示并选择 `9.0-beta` 与 `9.0` 两个用户版本。

## 未决项

无。
