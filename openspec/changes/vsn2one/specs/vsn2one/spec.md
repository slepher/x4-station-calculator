# Vsn2One Specification

## Purpose
统一版本治理语义与迁移调用路径，确保 empire/logic-flow/blueprint 的模块版本定义集中、fixture `vsn` 职责清晰，并将 blueprint migration 核心实现纳入 `stateMigrations` 统一管理。

## ADDED Requirements

### Requirement: Module Versions MUST Have Single Source Per Module

#### Scenario: Resolve Runtime Module Version Definitions
- **前提**：系统运行时涉及 `x4_empire_data`、`x4_logic_flow_plans`、`x4_ship_blueprints` 三个模块。
- **当**：代码读取或写入各模块 `version`。
- **那么**：每个模块 SHALL 通过其唯一版本常量源定义当前版本。
- **并且**：系统 SHALL NOT 在业务代码与脚本中散布模块版本硬编码字面量。

### Requirement: Fixture VSN MUST Be Isolated From Runtime Module Version

#### Scenario: Maintain Fixture Snapshot Version
- **前提**：执行 fixture 生成与版本 bump。
- **当**：系统读写 `tests/fixtures/db.json` 的 `vsn`。
- **那么**：`vsn` SHALL 仅用于 fixture 管理。
- **并且**：`vsn` SHALL NOT 作为运行时模块 migration 判断条件。

### Requirement: Blueprint Migration Core MUST Be Owned By `stateMigrations`

#### Scenario: Blueprint State Is Loaded In Store
- **前提**：store 从 localStorage 加载 ship blueprint 持久化状态。
- **当**：加载完成并准备进入运行时状态。
- **那么**：系统 MUST 调用 `stateMigrations` 中的 blueprint migration 入口。

#### Scenario: Blueprint State Is Imported Via Import-Export
- **前提**：导入 payload 包含 `x4_ship_blueprints`。
- **当**：import-export 执行 ship 模块应用。
- **那么**：系统 MUST 调用与 store 相同的 blueprint migration 入口。
- **并且**：store 与 import-export SHALL NOT 各自维护独立 blueprint migration 算法。

### Requirement: Historical Blueprint Versions MUST Upgrade Through Migration Path

#### Scenario: Legacy Blueprint Version Input
- **前提**：输入 ship blueprint 数据版本落后于当前版本。
- **当**：系统执行 blueprint 数据加载或导入。
- **那么**：系统 SHALL 通过 migration 路径升级到当前 blueprint 版本。
- **并且**：系统 SHALL 保持迁移入口稳定，即便当前版本阶段暂未引入实质字段迁移。

### Requirement: DB Fixture Script MUST Import Module Version Constants Directly

#### Scenario: Build Fixture Payload
- **前提**：执行 `scripts/db_fixture.tsx` 生成 fixture。
- **当**：脚本构建三个模块 payload。
- **那么**：脚本 MUST 直接 import 并使用模块版本常量。
- **并且**：脚本 SHALL NOT 在本地定义模块版本数字常量替代运行时版本源。
