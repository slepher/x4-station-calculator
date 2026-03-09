# Tasks: vsn2one

## 1. 版本常量收敛

- [x] 1.1 在版本常量文件新增 `CURRENT_SHIP_BLUEPRINT_VERSION`。
- [x] 1.2 将 ship blueprint 相关运行时硬编码版本替换为常量引用。
- [x] 1.3 保持 empire/flow 继续使用现有常量，不新增并行版本源。

## 2. Blueprint 迁移归口到 stateMigrations

- [x] 2.1 在 `stateMigrations` 新增 blueprint 迁移入口与返回结构（state + warnings）。
- [x] 2.2 实现 blueprint 迁移骨架（shape normalize + version 归一）。
- [x] 2.3 迁移入口支持未来版本扩展（保留版本分支结构）。

## 3. Store 迁移入口统一

- [x] 3.1 `useShipBuildStore.loadBlueprintsFromStorage()` 调用 `stateMigrations` blueprint 迁移入口。
- [x] 3.2 store 加载后将归一化状态回写 localStorage。
- [x] 3.3 移除 store 内部 blueprint 独立迁移逻辑（若存在）。

## 4. Import-Export 迁移入口统一

- [x] 4.1 import-export ship 模块调用 `stateMigrations` blueprint 迁移入口。
- [x] 4.2 移除 import-export 内部 blueprint no-op 迁移实现。
- [x] 4.3 overwrite/incremental/export 的 ship 模块 version 使用统一常量。

## 5. Fixture 脚本版本源对齐

- [x] 5.1 `scripts/db_fixture.tsx` 直接 import 模块版本常量。
- [x] 5.2 替换脚本中的 empire/flow/blueprint 版本硬编码。
- [x] 5.3 保持 `db.json.vsn` bump 与归档逻辑，仅用于 fixture 管理。

## 6. 构建校验

- [x] 6.1 完成实现后执行 `npm run build`。
- [x] 6.2 若构建失败，修复并重复构建直至通过或出现明确阻塞。
