# Tasks: ship-level-blueprint

## 1. 类型与存储结构升级（ship-level）

- [x] 1.1 在类型定义中引入 ship blueprint ship-level 结构（ship bucket + activeShipId/activeBlueprintId）。
- [x] 1.2 调整 `useShipBuildStore` 的 `savedBlueprints` 状态为 ship-level。
- [x] 1.3 移除运行时对旧 `savedBlueprints.list` 兼容读取路径。
- [x] 1.4 模块版本由 `CURRENT_SHIP_BLUEPRINT_VERSION` 单一来源驱动，不新增硬编码版本数字。

## 2. Store 加载迁移链路

- [x] 2.1 在 `loadBlueprintsFromStorage()` 中扩展既有 `stateMigrations` blueprint 迁移入口的版本识别分支。
- [x] 2.2 实现 flat(v1) -> ship-level 迁移与结构归一化（含非法项剔除与 warning）。
- [x] 2.3 migration 后回写“当前版本结构”到 localStorage。
- [x] 2.4 migration 失败时回退安全空状态，避免 UI 崩溃。

## 3. Store CRUD 与激活态调整

- [x] 3.1 按 ship bucket 重写保存/另存为/删除/载入的查找与写入路径。
- [x] 3.2 维护 `activeShipId` 与 `activeBlueprintId` 一致性。
- [x] 3.3 进入 ship build 时按 v2 激活态恢复当前 blueprint。

## 4. 四按钮 UI 行为收敛

- [x] 4.1 未选 ship 时禁用 `新建/保存/另存为/载入`。
- [x] 4.2 `新建` 在 dirty 场景先弹 `SmartSaveDialog`，完成后再执行新建。
- [x] 4.3 `保存` 仅 dirty 时触发写入。
- [x] 4.4 `另存为` 始终弹 `SmartSaveDialog`。
- [x] 4.5 `载入` 弹窗仅显示当前 ship 对应 bucket 的 blueprint 列表。

## 5. 导入导出升级

- [x] 5.1 ship blueprint 导入分支支持历史输入并统一迁移到当前版本结构。
- [x] 5.2 ship blueprint 导出分支改为当前版本结构-only 输出。
- [x] 5.3 incremental 导入重映射逻辑适配 ship-level bucket 结构。
- [x] 5.4 import-export 复用与 store 相同的 `stateMigrations` blueprint 迁移入口，不新增独立算法。

## 6. Seed / Fixture 脚本升级

- [x] 6.1 更新 `scripts/seed/ship-blueprint.tsx` 以匹配 ship-level 目标结构。
- [x] 6.2 更新 `scripts/db_fixture.tsx` 使输出 `x4_ship_blueprints` 为当前版本结构。
- [x] 6.3 重新生成 `tests/fixtures/db.json` 并将 `vsn` 递增一版。
- [x] 6.4 按版本策略补齐/更新 `tests/fixtures/db/db-<n>.json` 快照文件。
- [x] 6.5 确认 `db.json.vsn` 仅用于 fixture 管理，不参与 runtime migration 判断。

## 7. 构建校验

- [x] 7.1 完成实现后执行 `npm run build`。
- [x] 7.2 若构建失败，修复后重复构建直至通过或出现明确阻塞。
