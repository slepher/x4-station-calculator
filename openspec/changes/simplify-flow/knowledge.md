# Knowledge: simplify-flow

## 1. 对齐范围（与 test_tasks.md 同步）
- 覆盖范围：flow `v2 -> v3` 迁移、flow 保存极简节点结构、empire 导入 flow 的模块与锁定货物映射。
- 章节状态与迁移 ID：
  - `flow-v2-storage-loaded`
  - `flow-import-empire-modal-ready`
  - `切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready`
- Bug 场景对齐：
  - `BUG-001`：旧字段未清理导致迁移后仍出现 `moduleId`。
  - `BUG-002`：empire 导入时 isolated 货物未进入 `lockedWares`。

## 2. 固定数据口径（确定值）
- 基线 fixture：`tests/fixtures/db.json`（导入前删除 `vsn` 字段）。
- flow 基线键：
  - `x4_logic_flow_plans.activeId = logic-flow-1`
  - `x4_logic_flow_plans.list[0].id = logic-flow-1`
  - `x4_logic_flow_plans.list[0].groups = ['lf-1-g1', 'lf-1-g2', 'lf-1-g3']`
- 迁移后版本口径：
  - `x4_logic_flow_plans.version = 3`

## 3. fixture 术语映射（ware/module）
- `quantumtubes`
  - ware fixture: `tests/fixtures/ware_fixtures.yaml`
  - 显示名: `Quantum Tubes / 量子管`
  - 推荐断言目标: 导入结果 `lockedWares` 包含该 ware id
- `module_gen_prod_hullparts_01`
  - 来源: `tests/fixtures/db.json` flow plan 节点
  - 推荐断言目标: `buildStationImportPayload(...).plannedModules` 中包含该 module id 与 count

## 4. 定位器与操作路径（稳定口径）
- 语言切换：
  - `select`（文本包含 `简体中文|English`），执行 `selectOption('zh-CN')`
- empire 导入入口：
  - `data-testid="logicflow-import-entry-empire"`
- 导入弹窗：
  - `data-testid="import-view-modal"`
  - `data-testid="logicflow-import-plan-list"`
  - `data-testid="logicflow-import-plan-item-logic-flow-1"`
  - `data-testid="logicflow-import-plan-direct-logic-flow-1"`
  - `data-testid="logicflow-import-warning-modal"`
- 视图切换：
  - `.overview-tab`
  - `.station-tab`

## 5. 可观测断言口径
- E2E 主断言优先 UI 与持久化键：
  - UI: 导入弹窗可见/关闭、计划卡可见、直接导入按钮可见、站点页签数量变化。
  - 持久化: `localStorage['x4_logic_flow_plans']` 的 `version/activeId` 与 `localStorage['x4_empire_data']` 的 `stations[].lockedWares`。
- 对 empire 导入结果的断言使用可观测 store 数据：
  - `window.empireStore.savedEmpires.list.length`
  - `window.empireStore.activeEmpire?.stations.length`
  - 站点 `lockedWares` 是否包含 `quantumtubes`

## 6. 与 test_tasks.md 映射
- `2.1` 对应本文件第 2 节迁移版本口径。
- `2.2/2.3` 对应本文件第 4 节导入入口与弹窗定位器。
- `3.1/4.1` 对应本文件第 5 节“迁移后不再保留旧字段”口径。
- `1.2/3.2/4.2` 对应本文件第 3 节 ware/module 映射与第 5 节导入结果口径。

## 7. 测试运行
- 执行时间：2026-03-09
- 命令与结果：
  - `pnpm exec vitest run tests/unit/simplify-flow/simplify-flow.spec.ts`：通过（2/2）
  - `pnpm exec playwright test tests/e2e/simplify-flow/simplify-flow.spec.ts tests/e2e/simplify-flow/bug-simplify-flow.spec.ts tests/e2e/simplify-flow/bugfix-simplify-flow.spec.ts`：7 通过，2 失败
- 失败项（均为 `bug-simplify-flow` 的“修复前复现断言”）：
  - `4.1 BUG-001`：预期旧行为 `moduleId` 仍存在，实际为不存在（说明修复生效）
  - `4.2 BUG-002`：预期旧行为 `lockedWares` 不含 `quantumtubes`，实际为包含（说明修复生效）
