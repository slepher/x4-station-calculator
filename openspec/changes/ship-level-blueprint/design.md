## Context

当前 ship blueprint 持久化为全局扁平 `version: 1 + list[]`，与“blueprint 归属 ship”目标不一致，也无法对载入入口做天然的按 ship 过滤。
在 `vsn2one` 已统一版本治理与 migration 入口的前提下，本次设计将 ship blueprint 升级为 ship-level 结构（版本由统一常量驱动），并扩展现有 migration 路径完成结构升级。

## Goals

1. ship blueprint 的存储语义从“全局 list”改为“ship 归属”。
2. v1 历史数据可在 store 加载时自动迁移到当前版本结构并回写。
3. 导出统一为当前版本结构，避免再次扩散旧结构。
4. UI 四按钮行为严格绑定 `selectedShipId` 与 `isDirty`。
5. seed/db fixture 脚本链路同步 ship-level 结构，保证测试数据与运行时模型一致。
6. 严格遵循 `vsn2one`：模块版本由常量定义，`db.json.vsn` 仅用于 fixture 管理。

## Non-Goals

1. 不调整 empire/logic-flow 存储版本策略。
2. 不改 ship stats/fit 的业务计算。
3. 不提供长期双结构兼容层。

## Data Model

### Ship Blueprint Ship-Level (概念模型)

- 顶层：
  - `version: CURRENT_SHIP_BLUEPRINT_VERSION`
  - `activeShipId: string | null`
  - `activeBlueprintId: string | null`
  - `ships: Array<ShipBlueprintBucket>`
- `ShipBlueprintBucket`：
  - `shipId: string`
  - `blueprints: ShipBlueprint[]`

说明：
- `ShipBlueprint` 内保留现有字段（`id/name/shipId/connections/storage/lastUpdated`）。
- `activeBlueprintId` 用于恢复当前工作蓝图；`activeShipId` 用于上下文定位与载入列表过滤。

## Migration Strategy

### Trigger Point

`useShipBuildStore.loadBlueprintsFromStorage()` 内执行 migration（复用 `stateMigrations` 中既有 `migrateShipBlueprintStateToCurrent` 入口）：
1. 读取 localStorage 原始数据。
2. 识别版本：
- `version=1`（flat）-> 执行 flat -> ship-level。
- `version=2`（ship-level）-> 结构归一化校验。
- 其他/非法 -> 回退空状态 + warning。
3. 将结果写入运行时状态。
4. 持久化回写当前版本结构。

### V1 -> Ship-Level Rule

1. 以 v1 `list[].shipId` 分桶到 `ships[].blueprints`。
2. 非法项（缺失 `shipId` / 非法结构）剔除并告警。
3. `activeBlueprintId`：若原 active 存在且可命中则保留，否则回退到首条 blueprint 或 `null`。
4. `activeShipId`：由 `activeBlueprintId` 反查；若反查失败回退首个 bucket 的 `shipId` 或 `null`。

## Runtime Behavior Design

### Toolbar Actions

状态输入：`selectedShipId`、`isDirty`。

1. `selectedShipId == null`：
- 禁用 `新建/保存/另存为/载入`。

2. `selectedShipId != null`：
- 新建：dirty 时先 `SmartSaveDialog`，完成后清空当前 blueprint 内容并保留当前 ship。
- 保存：仅 dirty 执行保存写入。
- 另存为：始终打开 `SmartSaveDialog`。
- 载入：列表仅使用当前 `selectedShipId` 对应 bucket。

### Load List Scope

`LoadShipBlueprintModal` 不再消费“全局 flat list”，而是：
1. 基于当前 `selectedShipId` 定位 bucket。
2. 列表数据 = `bucket.blueprints`。
3. 未命中 bucket 时展示空列表。

## Import/Export Design

1. Import：ship blueprint 分支支持历史输入，统一迁移到当前版本结构后应用。
2. Export：ship blueprint 分支仅输出当前版本结构。
3. Incremental 导入时 id 冲突重映射逻辑维持，但作用对象改为 ship-level buckets 内蓝图。
4. Store 与 import-export 共用同一 migration 核心，不允许双实现分叉。

## Seed/Fixture Pipeline Design

1. `scripts/seed/ship-blueprint.tsx` 输出应能被 `scripts/db_fixture.tsx` 组装为 ship-level。
2. `scripts/db_fixture.tsx` 中 ship blueprint build 函数输出当前版本结构，模块版本直接引用版本常量。
3. fixture 生成后：
- 产出新 `tests/fixtures/db.json`（`vsn` +1）。
- 按现有版本约定维护 `tests/fixtures/db/db-<n>.json` 快照。
4. `db.json.vsn` 仅作为 fixture 快照管理字段，不参与运行时迁移判断。

## Risks

1. 去掉 `savedBlueprints.list` 兼容后，组件/测试调用面会集中暴露。
2. 载入弹窗与导入导出测试依赖旧结构，短期会出现较多断言改动。
3. fixture 与脚本版本耦合，若只改一端会导致 e2e 初始状态不一致。

## Validation

1. 单元验证：migration、toolbar 四按钮状态与行为、载入列表过滤。
2. 导入导出验证：历史输入迁移为当前版本结构，导出仅含当前版本结构。
3. fixture 验证：脚本生成结果结构为 ship-level，模块版本来自常量，`db.json.vsn` 已递增且语义保持独立。
