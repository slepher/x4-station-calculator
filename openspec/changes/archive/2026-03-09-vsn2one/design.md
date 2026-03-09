## Context

当前版本治理存在三类问题：
1. blueprint 模块版本定义分散在类型、store、import-export、脚本等多个位置。
2. blueprint migration 缺少与 empire/flow 同级的统一核心实现；入口分散导致未来扩展风险高。
3. fixture `vsn` 与模块 version 语义边界虽存在，但代码层次尚未完全收敛。

## Design Goals

1. 建立四类版本语义边界：
- module version: empire / logic-flow / blueprint
- fixture version: dbfixture vsn
2. blueprint migration 与 empire/flow 对齐：统一由 `stateMigrations` 托管。
3. store 与 import-export 迁移入口复用同一 blueprint migration。
4. fixture 脚本版本来源与运行时一致：直接 import 常量。

## Version Governance Model

### Runtime Module Versions

- `CURRENT_EMPIRE_VERSION`
- `CURRENT_FLOW_VERSION`
- `CURRENT_SHIP_BLUEPRINT_VERSION`（新增）

约束：
- 运行时读写（store/import-export/migration）必须通过上述常量。
- 禁止模块 version 数字字面量散落在业务路径。

### Fixture Management Version

- `tests/fixtures/db.json.vsn`

约束：
- 仅用于 fixture 快照管理（bump/归档）。
- 不参与 runtime migration 版本比较。

## Migration Architecture

### Unified Ownership

在 `src/store/logic/stateMigrations.ts` 新增 blueprint 迁移入口（命名示例）：
- `migrateShipBlueprintStateToCurrent(input)`

行为约定：
1. 接收历史数据形态并做 shape normalization。
2. 返回 `{ state, warnings }`。
3. `state.version` 最终归一到 `CURRENT_SHIP_BLUEPRINT_VERSION`。
4. 即使当前无字段迁移任务，也保留可扩展骨架。

### Entry Call Sites

1. Store 路径：`useShipBuildStore.loadBlueprintsFromStorage()`
- parse -> migrateShipBlueprintStateToCurrent -> apply state -> persist normalized state

2. Import-Export 路径：`importExport` ship 分支
- coerce -> migrateShipBlueprintStateToCurrent -> overwrite/incremental merge/remap

约束：
- 两个入口只负责流程编排，不定义独立迁移算法。

## Script Alignment

`scripts/db_fixture.tsx` 直接 import 版本常量并写入模块 `version`：
- empire: `CURRENT_EMPIRE_VERSION`
- flow: `CURRENT_FLOW_VERSION`
- blueprint: `CURRENT_SHIP_BLUEPRINT_VERSION`

保留：
- fixture `vsn` 的读当前值 + 可选 bump 逻辑。

## Risks

1. 移除硬编码后会暴露测试中对旧字面量版本的依赖。
2. blueprint migration 接入后，老 fixture 与导入样例需要同步更新预期。
3. 脚本 import 运行时文件时需确保 tsx 执行环境路径与模块格式兼容。

## Validation Strategy

1. 版本治理验证：
- 扫描代码确认模块版本字面量已被常量替换（允许测试数据中的历史版本样例存在）。

2. 迁移一致性验证：
- store 加载与 import-export ship 导入均触发同一 blueprint migration 函数。

3. 脚本一致性验证：
- db fixture 生成输出模块 version 与运行时常量一致。
- `vsn` 行为保持 fixture 管理语义。
