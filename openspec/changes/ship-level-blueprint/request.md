# 需求说明：ship-level-blueprint

## 目标
在 `vsn2one` 已完成版本治理收敛的前提下，将 ship build blueprint 持久化从当前全局扁平结构升级为“按 ship 归属”的结构，并同步收敛新建/保存/另存为/载入四个入口的 UI 行为。

## 已确认方案（审核重点）
1. 存储结构升级（Ship Blueprint flat -> ship-level）
- `x4_ship_blueprints` 必须升级为 ship-level 结构，blueprint 必须归属到 ship 维度。
- 版本升级由 `CURRENT_SHIP_BLUEPRINT_VERSION` 驱动（本次变更会将当前版本由 1 升至 2），禁止在业务路径硬编码版本数字。
- store 在读取 localStorage 时必须执行 migration：旧版数据先迁移到当前版本，再进入运行时状态。
- migration 完成后必须回写“当前版本结构”到 localStorage，避免后续继续读取旧结构。
- 不保留 `savedBlueprints.list` 的兼容过渡 API，提前暴露调用面问题。

2. 导入导出策略
- 导出仅写当前版本结构（本次目标为 ship-level）。
- 导入需兼容旧版本并在导入流程内迁移到当前版本结构。
- store 与 import-export 必须复用同一 blueprint migration 入口（即 `stateMigrations` 中已有入口），不得各自维护独立算法。

3. 四个入口的 UI 行为
- 未选中 ship（`selectedShipId == null`）时，`新建/保存/另存为/载入` 四个按钮全部禁用。
- 已选中 ship 时：
  - `新建`：若当前 blueprint 为 dirty，先弹 `SmartSaveDialog`，再执行新建。
  - `保存`：仅当当前 blueprint 为 dirty 时执行保存。
  - `另存为`：始终弹 `SmartSaveDialog`。
  - `载入`：仅显示并载入“当前 ship 对应”的 blueprint 列表。

4. seed 与 fixture 生成链路
- `scripts` 下与 ship blueprint seed/db fixture 相关的 TSX 脚本必须同步更新为 ship-level 输出（对应当前模块版本）。
- `tests/fixtures/db.json` 生成逻辑更新后，fixture 版本号 `vsn` 上提一版。
- `db.json.vsn` 仅用于 fixture 管理，不参与 runtime module migration 判断。

## In Scope
- ship blueprint 存储结构升级与 migration 落地。
- ship build store 对 ship-level 结构的读写、激活态和 CRUD 行为调整。
- import/export 中 ship blueprint 模块的迁移与“当前版本结构”导出。
- 四按钮交互与载入列表过滤行为调整。
- `scripts/seed/*.tsx` 与 `scripts/db_fixture.tsx` 相关 ship blueprint 路径升级。
- `tests/fixtures/db.json` 及版本快照联动更新。

## Out of Scope
- empire 与 logic-flow 存储结构变更。
- ship build 业务计算（属性/战斗统计）改造。
- 非 ship blueprint 的 seed/fixture 数据模型重构。

## 验收标准（DoD）
1. 旧版 `x4_ship_blueprints` 数据在 store 加载时可自动迁移到当前版本结构并回写。
2. 运行时不再依赖 `savedBlueprints.list` 兼容读取；若调用面未更新可显式暴露问题。
3. 导出 payload 的 ship blueprint 模块为当前版本结构（ship-level）。
4. 未选 ship 时四按钮禁用；已选 ship 时四按钮行为符合已确认方案。
5. 载入弹窗仅展示当前 ship 下的 blueprint 列表。
6. 更新后的 seed/db fixture 脚本可生成 ship-level ship blueprint 数据，且模块版本来自统一版本常量。
7. `tests/fixtures/db.json` 的 `vsn` 在本次变更后递增 1。
8. store 与 import-export 的 ship blueprint 路径复用同一 `stateMigrations` 迁移入口。

## 未决项
无。
