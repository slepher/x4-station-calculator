# Ship Data Import Specification

## Purpose
为飞船与装备数据导入提供标准化输出，使系统能够完成飞船设计模拟（类型 → 插槽 → 插槽内装备）与多建造模式成本计算。

## ADDED Requirements

### Requirement: Distiller 输出清单
系统 SHALL 生成以下蒸馏输出：
- `ships_final.xml`（`ships.xml` + DLC）
- `ship_macros.xml`（所有 `ship_*_macro.xml`）
- `ship_connections.xml`（仅保留装配相关连接点的 ship 组件）
- `equipment_macros.xml`（engine/shield/weapon/turret 宏）
- `loadouts_final.xml`（`loadouts.xml` + DLC）
- `shipgroups_final.xml`（`shipgroups.xml` + DLC）
- 继续使用 `wares_final.xml` / `waregroups_final.xml` / `colors_final.xml`
- `module_macros.xml` 作为空间站模块宏输出

#### Scenario: Distiller 输出完整
- **前提** 运行 distiller
- **当** 蒸馏流程完成
- **那么** 系统 SHALL 在 raw 目录生成上述所有输出文件

### Requirement: Ship Slots 结构输出
系统 SHALL 按 **类型 → 插槽组 → 装备** 结构输出 `ships.json`。

#### Scenario: Group 作为插槽组
- **前提** `ship_connections.xml` 中存在连接点
- **当** 解析连接点
- **那么** 系统 SHALL 以 `group` 作为插槽组
- **并且** 若连接点缺少 `group`，则以 `connection.name` 单独成组并标记 `isImplicitGroup=true`

#### Scenario: PrimaryType 规则
- **前提** 同一 group 出现 `shield` 与其他类型
- **当** 生成插槽类型
- **那么** `primaryType` SHALL 取首个非 `shield` 类型
- **并且** `slotTypes` SHALL 保留 `shield`

#### Scenario: 装备来源
- **前提** `loadouts_final.xml` 中存在 group 装配条目
- **当** 生成插槽内装备
- **那么** 系统 SHALL 将同 group 的装备条目映射到该插槽组

### Requirement: JSON 生成入口
系统 SHALL 通过 `x4_data_processor.py` 生成新增的 JSON 文件。

#### Scenario: Processor 产出
- **前提** `x4_data_processor.py` 执行解析流程
- **当** 输出 JSON
- **那么** 系统 SHALL 生成 `ships.json`、`equipments.json`、`shipgroups.json`

### Requirement: 多建造模式成本
系统 SHALL 在 `ships.json` 与 `equipments.json` 中输出多建造模式成本。

#### Scenario: 成本结构
- **前提** `wares_final.xml` 内存在多种 `production method`
- **当** 解析成本
- **那么** 系统 SHALL 按 method 输出成本映射

### Requirement: 名称字段一致性
系统 SHALL 为 `ships.json`、`equipments.json`、`shipgroups.json` 输出 `nameId/name`。

#### Scenario: 英文名称注入
- **前提** i18n 词条存在
- **当** 解析 `nameId`
- **那么** 系统 SHALL 注入英文名称到 `name`

### Requirement: i18n 输出补充
系统 SHALL 将新增数据的 i18n 词条补充进当前生成的 i18n 输出中。

#### Scenario: 新增 i18n 词条同步
- **前提** 解析生成新 ship/equipment/shipgroup 词条
- **当** i18n 输出生成
- **那么** 系统 SHALL 将新增词条写入输出结果

### Requirement: Shipgroup 输出
系统 SHALL 输出 `shipgroups.json`，仅包含 `id/nameId/name`。

#### Scenario: Shipgroup 与 ship 关联
- **前提** ship 存在 group
- **当** 生成 `ships.json`
- **那么** 系统 SHALL 写入 `shipgroup` 字段用于关联
