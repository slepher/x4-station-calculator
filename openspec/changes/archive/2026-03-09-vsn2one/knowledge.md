# Knowledge: vsn2one

## 文档目的

本文件记录 `vsn2one` 变更的测试知识点与执行口径，并与 `test_tasks.md` 同步维护。

## 变更范围映射

- 版本常量文件：`src/store/logic/storageVersions.ts`
  - `CURRENT_EMPIRE_VERSION`
  - `CURRENT_FLOW_VERSION`
  - `CURRENT_SHIP_BLUEPRINT_VERSION`
- blueprint 迁移统一入口：`src/store/logic/stateMigrations.ts`
  - `migrateShipBlueprintStateToCurrent`
- store 入口：`src/store/useShipBuildStore.ts`
  - `loadBlueprintsFromStorage`
- import/export 入口：`src/store/logic/importExport.ts`
  - ship 模组导入/导出路径

## Chapter 1 断言口径

- `1.1`：
  - migration 输出会过滤 `shipId` 为空的 blueprint 条目。
  - migration 输出 `version` 归一到当前 ship blueprint 版本（当前值 `1`）。
- `1.2`：
  - import 输入旧版本 ship 数据后，落盘 `x4_ship_blueprints.version` 为 `1`。
  - export 输出 `data.x4_ship_blueprints.version` 为 `1`。

# 测试运行

- 暂无历史失败沉淀。
