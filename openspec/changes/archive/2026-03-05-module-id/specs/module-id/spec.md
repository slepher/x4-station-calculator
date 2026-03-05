# Module ID Migration Specification

## Purpose
定义模块主键从 macro id 切换到 module id 的规范，以及 Empire/Logic Flow/Import-Export/x-game 导入在版本迁移与 ID 归一化上的一致行为。

## ADDED Requirements

### Requirement: Module Identity Model Uses Module ID As Primary Key
系统 MUST 使用 `module id` 作为 `X4Module.id`，并保留 `macroId` 作为兼容映射字段。

#### Scenario: Build module map with new primary key
**前提** 系统加载 `modules.json`

**当** 系统构建 `modulesMap`

**那么** 系统 SHALL 以 `module id` 作为 map key

**并且** 每个模块对象 SHALL 包含 `macroId`

#### Scenario: Resolve legacy macro input
**前提** 外部输入包含旧 `macro id`

**当** 系统执行模块 ID 解析

**那么** 系统 SHALL 能通过 `macroId` 映射定位到目标模块

**并且** 最终写入存储时 MUST 使用 `module id`

## MODIFIED Requirements

### Requirement: Empire Storage Version Is Dynamically Migrated To V3
系统 MUST 将 Empire 导入/加载数据动态迁移到 `v3`，不得将版本写死为 `v2`。

#### Scenario: Import v2 empire data
**前提** 导入 JSON 的 `x4_empire_data.version` 为 `2`

**当** 系统执行导入流程

**那么** 系统 SHALL 先执行 `v2 -> v3` 迁移

**并且** 迁移后的站点 `modules[].id` MUST 为 `module id`

#### Scenario: Export empire data
**前提** 用户执行导出

**当** 系统生成导出 payload

**那么** 导出的 `x4_empire_data.version` SHALL 为 `3`

### Requirement: Logic Flow Storage Version Is Dynamically Migrated To V2
系统 MUST 将 Logic Flow 导入/加载数据动态迁移到 `v2`，不得固定为 `v1`。

#### Scenario: Import v1 flow data
**前提** 导入 JSON 的 `x4_logic_flow_plans.version` 为 `1`

**当** 系统执行导入流程

**那么** 系统 SHALL 先执行 `v1 -> v2` 迁移

**并且** 节点 `moduleId` MUST 归一为 `module id`

#### Scenario: Export flow data
**前提** 用户执行导出

**当** 系统生成导出 payload

**那么** 导出的 `x4_logic_flow_plans.version` SHALL 为 `2`

### Requirement: Import Pipeline Migrates By Incoming Version
系统 MUST 根据导入数据自身版本动态迁移，不得在 `coerce` 阶段覆盖版本。

#### Scenario: Coerce keeps incoming version
**前提** 导入数据结构合法且带 `version`

**当** 系统执行 `coerce`

**那么** 系统 SHALL 保留导入数据中的版本值

**并且** 版本升级 MUST 在 `migrate` 阶段执行

#### Scenario: Unknown version fallback
**前提** 导入数据版本缺失或不受支持

**当** 系统执行迁移

**那么** 系统 SHALL 使用约定 fallback 路径

**并且** 生成 warning 供 UI 或日志消费

### Requirement: Blueprint And x4-game Imports Normalize To Module ID
系统 MUST 对 XML 与 x4-game 输入执行统一解析，并落库为 `module id`。

#### Scenario: XML macro input
**前提** 蓝图 XML 中 `entry macro` 为旧宏 ID

**当** 系统解析并导入模块

**那么** 系统 SHALL 解析为对应 `module id`

**并且** 写入的 station module id MUST 为 `module id`

#### Scenario: x4-game link input
**前提** x4-game 分享串中包含 `module_*` 或 `module id`

**当** 系统解析并导入模块

**那么** 系统 SHALL 统一归一为 `module id`

**并且** 对不可解析条目 SHALL 记录 warning 而不阻断可解析条目
