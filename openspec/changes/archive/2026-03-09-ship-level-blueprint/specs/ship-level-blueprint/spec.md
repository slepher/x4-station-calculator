# Ship Level Blueprint Specification

## Purpose
在 `vsn2one` 版本治理模型下，将 ship blueprint 的持久化与交互入口统一到“以 ship 为归属”的模型，确保旧数据可自动升级到当前版本结构、导出结构统一，并将新建/保存/另存为/载入行为收敛到已确认的 ship 上下文规则。

## ADDED Requirements

### Requirement: Ship Blueprint Storage MUST Migrate To Current Version Structure On Store Load

#### Scenario: Load V1 Ship Blueprint Data From Local Storage
- **前提**：localStorage 中存在旧版 `x4_ship_blueprints` 数据。
- **当**：`useShipBuildStore` 初始化并加载存储。
- **那么**：系统 MUST 执行历史结构 -> 当前版本结构 migration。
- **并且**：系统 MUST 使用迁移后的当前版本结构初始化运行时状态。
- **并且**：系统 MUST 将当前版本结构回写到 localStorage。

#### Scenario: Local Storage Contains Invalid Legacy Data
- **前提**：localStorage 中 ship blueprint 数据结构非法或缺失关键字段。
- **当**：`useShipBuildStore` 执行加载。
- **那么**：系统 SHALL 回退到安全空状态。
- **并且**：系统 SHALL 记录可诊断 warning/error，而不是让 UI 崩溃。

### Requirement: Runtime MUST NOT Keep Legacy `savedBlueprints.list` Compatibility API

#### Scenario: Runtime Reads Ship Blueprint State
- **前提**：系统已升级到 ship blueprint 当前版本结构。
- **当**：运行时读取 ship blueprint 状态。
- **那么**：系统 MUST 直接使用当前版本结构。
- **并且**：系统 SHALL NOT 提供基于旧 `savedBlueprints.list` 的兼容读取入口。

### Requirement: Export MUST Be Current-Version-Only For Ship Blueprint Module

#### Scenario: Export Storage Payload
- **前提**：用户执行导出。
- **当**：系统构建导出 payload。
- **那么**：`x4_ship_blueprints` 模块 MUST 以当前版本结构写出。
- **并且**：系统 SHALL NOT 导出历史 flat ship blueprint 结构。

### Requirement: Blueprint Versioning MUST Follow Unified Constants

#### Scenario: Resolve Ship Blueprint Runtime Version
- **前提**：系统读写 `x4_ship_blueprints.version`。
- **当**：store、import-export、脚本进行版本判断或落盘。
- **那么**：系统 MUST 使用 `CURRENT_SHIP_BLUEPRINT_VERSION` 作为唯一来源。
- **并且**：系统 SHALL NOT 在业务路径硬编码版本数字。

### Requirement: Store And Import-Export MUST Share One Blueprint Migration Core

#### Scenario: Blueprint Is Processed In Store Or Import-Export
- **前提**：加载存储或导入 payload 时处理 `x4_ship_blueprints`。
- **当**：执行 migration。
- **那么**：系统 MUST 复用 `stateMigrations` 中同一 blueprint migration 入口。
- **并且**：系统 SHALL NOT 在 store 与 import-export 中维护两套独立迁移算法。

### Requirement: Four Toolbar Actions MUST Be Ship-Selection-Aware

#### Scenario: Disable Actions When Ship Is Not Selected
- **前提**：`selectedShipId` 为 `null`。
- **当**：页面渲染工具栏动作。
- **那么**：`新建`、`保存`、`另存为`、`载入` SHALL 全部禁用。

#### Scenario: New Action With Dirty Blueprint
- **前提**：`selectedShipId` 非空，且当前 blueprint 为 dirty。
- **当**：用户点击 `新建`。
- **那么**：系统 SHALL 先弹出 `SmartSaveDialog`。
- **并且**：对话流程完成后才执行新建。

#### Scenario: Save Action Only Persists Dirty Blueprint
- **前提**：`selectedShipId` 非空。
- **当**：用户点击 `保存`。
- **那么**：若当前 blueprint 为 dirty，系统 SHALL 执行保存。
- **并且**：若当前 blueprint 非 dirty，系统 SHALL NOT 执行保存写入。

#### Scenario: Save As Always Opens SmartSaveDialog
- **前提**：`selectedShipId` 非空。
- **当**：用户点击 `另存为`。
- **那么**：系统 SHALL 弹出 `SmartSaveDialog`。

#### Scenario: Load Only Lists Blueprints Under Current Ship
- **前提**：`selectedShipId` 非空。
- **当**：用户点击 `载入` 并打开列表。
- **那么**：系统 SHALL 仅展示当前 ship 对应的 blueprint 列表。

### Requirement: Seed And Fixture Pipeline MUST Generate Current-Version Ship Blueprint

#### Scenario: Generate Ship Blueprint Seed/Fixture Data
- **前提**：执行 ship blueprint 相关 seed 与 db fixture 生成脚本。
- **当**：脚本产出 `tests/fixtures/db.json`。
- **那么**：输出中的 `x4_ship_blueprints` MUST 为当前版本结构。
- **并且**：模块 version MUST 来自统一版本常量。

#### Scenario: Fixture Version Bump After Script Upgrade
- **前提**：本次变更已完成 fixture 生成脚本升级。
- **当**：生成新的 `tests/fixtures/db.json`。
- **那么**：`db.json.vsn` MUST 相对升级前递增 1。

### Requirement: Fixture VSN MUST Remain Isolated From Runtime Migration Semantics

#### Scenario: Read/Write Fixture `vsn`
- **前提**：执行 fixture 生成与版本 bump。
- **当**：系统读写 `tests/fixtures/db.json.vsn`。
- **那么**：`vsn` SHALL 仅用于 fixture 管理。
- **并且**：`vsn` SHALL NOT 参与 runtime module migration 判断。
