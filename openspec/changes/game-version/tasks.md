# game-version 实施任务

## 1. 资源管理配置

- [x] 1.1 确认 `x4-station-calculator.config.json` 只保留 `8.0` 与 `9.0` 两个资源版本。
- [x] 1.2 确认 `9.0` 资源版本使用 `folder_name = "9.0-Empire"`。
- [x] 1.3 确认资源配置顶层默认版本为 `current_version = "9.0"` 且 `beta = false`。

## 2. 用户版本配置

- [x] 2.1 更新 `src/assets/versions.json`，保留/新增 `8.0`、`9.0-beta`、`9.0` 三个用户版本。
- [x] 2.2 确认 `9.0-beta` 使用 `version = "9.0"` 且 `beta = true`。
- [x] 2.3 确认 `9.0` 使用 `version = "9.0"` 且 `beta = false`。
- [x] 2.4 确认两个 9.0 用户版本都使用 `folder_name = "9.0-Empire"`。
- [x] 2.5 确认 `9.0-beta` 继续使用 `_v9_beta` storage keys 和 `x4_save_archive_db_v9_beta`；`9.0` 正式版使用 `_v9` storage keys 和 `x4_save_archive_db_v9`。
- [x] 2.6 设置用户默认版本为 `current_version = "9.0"` 且 `beta = false`。

## 3. 前端版本展示

- [x] 3.1 确认 `displayVersion()` 只在 `beta = true` 时追加 `beta_type` 与 `mini_version`。
- [x] 3.2 确认 `displayFullVersion()` 只在 `beta = true` 时追加 `beta_type` 与 `mini_version`。
- [x] 3.3 确认 StationToolbar 在 `9.0` 正式版时显示 `9.0`。
- [x] 3.4 确认版本选择弹窗可区分 `9.0-beta` 与 `9.0`。
- [x] 3.5 版本选择弹窗新增「显示 beta 版本」checkbox，默认非 beta 时不勾选。
- [x] 3.6 checkbox 取消勾选时过滤 beta 选项，当前选中被过滤时自动切到第一个稳定版。

## 4. Store 初始化顺序

- [x] 4.1 `useBuildPlanStore` 新增 `init()`，等待 `gameData.isReady` 后加载。
- [x] 4.2 `useShipBuildStore` 移除 store 创建时的 `loadBlueprintsFromStorage()`，仅由 `initialize()` 加载。
- [x] 4.3 `useActiveViewStore` 新增 `init()`，状态初始化为 `DEFAULT_STATE`。
- [x] 4.4 `App.vue` 初始化链中接入 `activeViewStore.init()`（gameData 后）和 `buildPlanStore.init()`（logicFlow 后）。

## 5. 构建验证

- [x] 5.1 运行 `npm run build`。
- [x] 5.2 如果 build 出现编译错误，修复代码并重复运行，直到通过或记录明确 blocker。
