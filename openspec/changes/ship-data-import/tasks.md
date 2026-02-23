# Tasks: ship-data-import

## 1. Distiller 输出扩展

- [x] 1.1 更新 distiller 输出清单（已由人工测试完成）
  - [x] 步骤 1：生成 `ships_final.xml`（ships + DLC）。
  - [x] 步骤 2：生成 `ship_macros.xml`（所有 ship 宏）。
  - [x] 步骤 3：生成 `ship_connections.xml`（仅保留装配相关连接点）。
  - [x] 步骤 4：生成 `equipment_macros.xml`（engine/shield/weapon/turret 宏）。
  - [x] 步骤 5：生成 `loadouts_final.xml`（loadouts + DLC）。
  - [x] 步骤 6：生成 `shipgroups_final.xml`（shipgroups + DLC）。
  - [x] 步骤 7：确认 `module_macros.xml` 生效替代旧名称。

## 2. 解析阶段 JSON 输出

- [x] 2.1 生成 ships.json（类型 → 插槽组 → 装备）
  - [x] 步骤 1：以 `group` 为插槽组，缺省使用 `connection.name` 并标记 `isImplicitGroup`。
  - [x] 步骤 2：按 `connection.tags` 判定 `primaryType` 与 `slotTypes`（shield 规则）。
  - [x] 步骤 3：从 `loadouts_final.xml` 映射插槽内默认装备。
  - [x] 步骤 4：写入 `shipgroup`、`nameId`、`name`。
  - [x] 步骤 5：写入多建造模式 `cost`。
  - [x] 步骤 6：由 `x4_data_processor.py` 负责生成该输出。

- [x] 2.2 生成 equipments.json
  - [x] 步骤 1：合并 ware 与 macro 信息。
  - [x] 步骤 2：写入 `nameId`、`name`、性能字段与多建造模式成本。
  - [x] 步骤 3：由 `x4_data_processor.py` 负责生成该输出。

- [x] 2.3 生成 shipgroups.json
  - [x] 步骤 1：仅输出 `id/nameId/name`。
  - [x] 步骤 2：由 `x4_data_processor.py` 负责生成该输出。

## 3. 解析规则与字段一致性检查

- [x] 3.1 校验 name/nameId 注入逻辑与现有 ware/module 保持一致。
- [x] 3.2 校验缺省 group 的插槽组映射逻辑可用。
- [x] 3.3 校验新增 i18n 词条已合并进当前 i18n 输出。
