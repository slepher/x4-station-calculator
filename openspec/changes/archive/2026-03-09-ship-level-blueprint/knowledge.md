# Knowledge: ship-level-blueprint

## 文档目的

本文件为 `ship-level-blueprint` 的测试知识基线，和 `test_tasks.md` 同步维护以下内容：
- ship-level 存储结构语义（`version=2 + ships[]`）
- Ship Build toolbar 四按钮行为与弹窗入口
- Chapter 2 状态/切换定义与纯 UI 可观测口径（不读 store/localStorage）

## 代码与数据来源

- 存储与迁移：`src/store/useShipBuildStore.ts`、`src/store/logic/stateMigrations.ts`、`src/store/logic/storageVersions.ts`
- 导入导出：`src/store/logic/importExport.ts`
- 四按钮行为：`src/components/StationToolbar.vue`
- 载入弹窗：`src/components/LoadShipBlueprintModal.vue`
- Ship Build 筛选视图：`src/components/ship-build/ShipBuildSelector.vue`
- 固定测试数据：`tests/fixtures/db.json`（`x4_ship_blueprints.version=2`）

## 固定前置（E2E）

- 按 `AGENTS.md` 要求：
  - 写入 `tests/fixtures/db.json` 到 localStorage（去除 `vsn`）
  - `page.reload()` 触发 store 初始化
  - 通过 UI 语言选择器设置语言（如 `zh-CN`）
- 测试运行时保留 `localStorage.isTestEnv = 'true'`
- 禁止使用 `localStorage.clear()` 破坏语言与前置

## ship-level 存储语义

- localStorage key：`x4_ship_blueprints`
- 当前版本：`CURRENT_SHIP_BLUEPRINT_VERSION = 2`
- 当前结构关键字段：
  - `version`
  - `activeShipId`
  - `activeBlueprintId`
  - `ships: Array<{ shipId, blueprints[] }>`
- 兼容输入：`version=1 + list[]` 在 migration 后归一为 v2 并回写

## 稳定定位器与可操作目标

- 视图入口（优先 data-testid）
  - `[data-testid="top-view-switch"]`
  - `[data-testid="top-view-btn-ship-build"]`
- Ship 选择器（`src/components/ship-build/ShipBuildSelector.vue`）
  - `[data-testid="ship-build-filters"]`
  - `[data-testid="ship-build-filter-class-btn-ship_m"]`
  - `[data-testid="ship-build-filter-race-btn-terran"]`
  - `[data-testid="ship-build-list-column"]`
  - `[data-testid="ship-build-ship-name"]`
  - `[data-testid="ship-build-confirm-ship"]`
  - `[data-testid="ship-build-cancel-ship-change"]`
  - `[data-testid="ship-build-panels"]`
  - 取消选择固定动作：在 `[data-testid="ship-build-filters"]` 中对 `[data-testid="ship-build-cancel-ship-change"]` 执行 `click({ force: true })`，随后断言 `[data-testid="ship-build-panels"]` 不可见
  - 列表项稳定定位（容器作用域 + 唯一路径）：在 `[data-testid="ship-build-filters"]` 内先点击 class/race 过滤，再在 `[data-testid="ship-build-list-column"]` 内使用 `getByTestId('ship-build-ship-name').filter({ hasText: /Odachi|大太刀/i }).first()` 选择目标 ship，最后点击 `[data-testid="ship-build-confirm-ship"]`
  - 入口收敛 helper（用于修复 `test_defect`）：点击 `[data-testid="top-view-btn-ship-build"]` 后，允许落在 `selector(workspace)` 两种子视图之一；若当前是 workspace，则通过 `[data-testid="ship-build-change-ship-fit-header"]` 切回 selector，再执行依赖 `ship-build-filters` 的步骤
- toolbar 四按钮（`src/components/StationToolbar.vue`）
  - 容器：`.toolbar-panel`
  - 定位策略：`getByRole('button', { name: /New|新建/i })`、`/Save|保存/i`、`/Save As|另存为/i`、`/Load|载入|加载/i`
- SmartSaveDialog（`src/components/SmartSaveDialog.vue`）
  - 输入框：`.dialog-input`
  - 动作按钮文本：`Save|保存`、`Discard & New|丢弃并新建`
  - 关闭动作（固定路径）：`getByRole('button', { name: /Discard & New|丢弃并新建/i })`
- LoadShipBlueprintModal（`src/components/LoadShipBlueprintModal.vue`）
  - 列表项：`.blueprint-item`
  - 删除按钮：`.blueprint-delete-btn`
  - 标题文本：`Load Ship Blueprint|载入蓝图`
- Fit 面板（`src/components/ship-build/ShipBuildPanelFit.vue`）
  - `[data-testid="ship-build-panel-fit"]`
  - `[data-testid="slot-type-engine"]`
  - `[data-testid="equipment-picker"]`
  - `[data-testid^="slot-"]`
  - `[data-testid^="candidate-"]`
  - `[data-testid="picker-confirm"]`
  - `[data-testid="picker-cancel"]`
  - 固定操作路径：点击 `slot-type-engine` -> 点击首个 `slot-*` -> 定位 `equipment-picker` -> 点击首个 `candidate-*` -> 点击 `picker-confirm`（不使用“若出现”分支）

## 固定 ship 映射（fixtures/db.json）

- `ship_ter_m_corvette_01_a`
  - 显示名：`Katana|武士刀`
  - bucket blueprint 数：1
- `ship_ter_m_corvette_02_a`
  - 显示名：`Odachi|大太刀`
  - bucket blueprint 数：1
- `ship_ter_l_destroyer_01_a`
  - 显示名：`Osaka|大阪`
  - bucket blueprint 数：2

## Chapter 2 状态/切换定义（与 test_tasks.md 同步）

- `状态: ship-toolbar-no-selected-ship`
  - 含义：`[data-testid="ship-build-panels"]` 不可见，且 toolbar 四按钮全部禁用。

- `状态: ship-toolbar-selected-ship-and-dirty`
  - 含义：已通过 Ship 选择器确认 Odachi，修改 Fit 槽位后点击 `New|新建` 会弹出 SmartSaveDialog。

- `切换: ship-toolbar-selected-ship-and-dirty -> ship-toolbar-selected-ship-clean`
  - 含义：首次点击 `Save|保存` 出现一次保存成功通知；紧接第二次点击不再新增保存成功通知，且 `Load|载入` 仍可点击。

## 可观测断言口径

- 四按钮禁用
  - 以按钮 `disabled` 属性为唯一判断口径。
- dirty 与 clean
  - 以 SmartSaveDialog 是否弹出、保存成功通知是否重复出现为判断口径。
- 载入列表过滤
  - 以 `.blueprint-item` 可见文本中的 ship 名称是否仅属于当前已确认 ship 为判断口径。
- 内部状态限制
  - E2E 步骤仅允许 UI 可观测断言，禁止使用 `window.*Store` 字段或 `localStorage` 字段作为断言目标。

## 任务-知识对齐清单

- `test_tasks.md` 中的状态 id 与本文件完全一致：
  - `ship-toolbar-no-selected-ship`
  - `ship-toolbar-selected-ship-and-dirty`
  - `ship-toolbar-selected-ship-and-dirty -> ship-toolbar-selected-ship-clean`
- `test_tasks.md` 使用的定位器与本文件一致：
  - `[data-testid="top-view-btn-ship-build"]`
  - `[data-testid="ship-build-filter-class-btn-ship_m"]`
  - `[data-testid="ship-build-filter-race-btn-terran"]`
  - `[data-testid="ship-build-list-column"]`
  - `[data-testid="ship-build-ship-name"]`
  - `[data-testid="ship-build-confirm-ship"]`
  - `[data-testid="ship-build-cancel-ship-change"]`
  - `[data-testid="ship-build-panel-fit"]`
  - `[data-testid="slot-type-engine"]`
  - `[data-testid="equipment-picker"]`
  - `[data-testid^="slot-"]`
  - `[data-testid^="candidate-"]`
  - `[data-testid="picker-confirm"]`
  - `.dialog-input`
  - `.blueprint-item`
  - `.blueprint-delete-btn`
  - `.toolbar-panel` + role/name 组合定位（四按钮）

# 测试运行

- [✓] 2.1 状态: ship-toolbar-no-selected-ship
  - 最新结果：通过（第二轮）。
  - 归因：`none`（入口收敛 helper 生效，状态可稳定构建）。

- [✓] 2.2 状态: ship-toolbar-selected-ship-and-dirty
  - 最新结果：通过（第二轮）。
  - 归因：`none`（selector/workspace 收敛后可稳定进入 dirty）。

- [✓] 2.3 切换: ship-toolbar-selected-ship-and-dirty -> ship-toolbar-selected-ship-clean
  - 最新结果：通过（第二轮 test_defect 修复后）。
  - 归因：`none`（`makeCurrentShipDirty` 前新增 workspace+Odachi 收敛，不再假设 `ship-build-panel-fit` 已可见）。

- [✓] 3.1 Case: 未选 ship 时四按钮保持禁用
  - 最新结果：通过（第二轮）。
  - 归因：`none`（共享前置已修复且 case 本体断言通过）。

- [✓] 3.2 Case: 选中 ship 后保存会清理 dirty 并写入当前 ship 激活态
  - 最新结果：通过（第二轮 test_defect 修复后）。
  - 归因：`none`（复用 `2.3` 切换 helper 已稳定）。

- [✓] 3.3 Case: dirty 场景点击新建会弹 SmartSaveDialog
  - 最新结果：通过（第二轮 test_defect 修复后）。
  - 归因：`none`（`3.3.2` 复用的 dirty helper 已内置 workspace 收敛）。

- [✓] 3.4 Case: 载入弹窗仅展示当前 ship 的 blueprint 列表
  - 最新结果：通过（第二轮 test_defect 修复后）。
  - 归因：`none`（dirty->clean 过渡 helper 不再受 selector/workspace 起始态影响）。

- [✓] 4.1 BUG-001: 未选 ship 时强制点击载入按钮仍可能出现载入弹窗
  - 最新结果：通过（第二轮 test_defect 修复后）。
  - 归因：`none`（`bug-*.spec.ts` 在 `4.1.3` 增加“可复现/不可复现”兼容断言：可复现时校验修复前行为，不可复现时校验修复后隐藏行为）。

## 本轮 test-impl 映射修复

- 目标缺陷：
  - `2.3.1`、`3.2.2`、`3.3.2`、`3.4.1`：`makeCurrentShipDirty` 假设已在 workspace，导致 `ship-build-panel-fit` 不可见失败。
  - `4.1.3`：`bug-*.spec.ts` 的修复前断言在当前已修复构建中不可复现。
- 映射策略：
  - 在 `makeCurrentShipDirty` 前增加 workspace+Odachi 收敛 helper，统一覆盖 selector/workspace 两种起始态。
  - `4.1.3` 采用兼容断言：历史缺陷可复现则按修复前断言，不可复现则按修复后隐藏断言。
  - 仅调整测试 helper 与可观测断言，不修改产品代码与 `test_tasks.md` 任务语义。
- 对应实现文件：
  - `tests/e2e/ship-level-blueprint/ship-level-blueprint.spec.ts`
  - `tests/e2e/ship-level-blueprint/bug-ship-level-blueprint.spec.ts`
  - `tests/e2e/ship-level-blueprint/bugfix-ship-level-blueprint.spec.ts`
