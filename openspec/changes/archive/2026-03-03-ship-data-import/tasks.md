# Tasks: ship-data-import

## 1. Distiller 输出扩展

- [x] 1.1 更新 distiller 输出清单（已由人工测试完成）
  - [x] 步骤 0：生成 `index/components.xml`（base + DLC 节点叠加）。
  - [x] 步骤 0.1：移除 `entry.value` 中 `assets/test` 路径项。
  - [x] 步骤 0.2：规范 `entry.value` 中双反斜杠，保障路径一致性。
  - [x] 步骤 0.3：同名同内容自动去重；同名不同内容写出后报错。
  - [x] 步骤 1：生成 `ships_final.xml`（ships + DLC）。
  - [x] 步骤 2：生成 `ship_macros.xml`（所有 ship 宏）。
  - [x] 步骤 3：生成 `ship_connections.xml`（仅保留装配相关连接点）。
  - [x] 步骤 4：生成 `equipment_macros.xml`（engine/shield/weapon/turret 宏）。
  - [x] 步骤 4.1：生成 `equipment_components.xml`（由 `equipment_id -> components.xml path -> component xml` 聚合，且只保留 `tags` 含 `component` 的 connection）。
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
  - [x] 步骤 2.1：`slotTags` 来源切换为 `equipment_components.xml` connection tags 聚合去重（不再走复杂程序判定）。
  - [x] 步骤 2.2：按链路 `ware -> macro -> macro.component -> equipment_components.component` 完成映射。
  - [x] 步骤 2.3：从 `tags` 提取 `noplayerblueprint` 到布尔字段，缺省 `false`，并从 `tags` 删除该标记。
  - [x] 步骤 3：由 `x4_data_processor.py` 负责生成该输出。

- [x] 2.3 生成 shipgroups.json
  - [x] 步骤 1：仅输出 `id/nameId/name`。
  - [x] 步骤 2：由 `x4_data_processor.py` 负责生成该输出。

- [ ] 2.4 Ship 插槽结构补充规则（ship 数据）
  - [ ] 步骤 1：插槽组级不输出 `slotTypes/slotTags`。
  - [ ] 步骤 2：connection 按相同 `tags` 合并并输出 `count`，不保留 `name`。
  - [ ] 步骤 3：connection 从 `tags` 提取 `type/size`，并从 `tags` 中移除已提取的 `type/size`。
  - [ ] 步骤 4：`slots` 输出为数组并按 `engine → thruster → shield → weapon → turret` 顺序排列。
  - [ ] 步骤 5：`shield` 内嵌为 `connection.shield`；`thruster` 由 `<thruster tags="...">` 生成。
  - [ ] 步骤 6：ship 的 `name` 使用 `_` 分段提取第 2 段为 `race`。

- [ ] 2.5 Ship/Eq JSON 字段与过滤规则
  - [ ] 步骤 1：`ships.json` / `equipments.json` 的 `id` 使用 `wareId`，不输出 `wareId` 字段。
  - [ ] 步骤 2：`production` 数组输出 `{ method, noplayerbuild, cost }`。
  - [ ] 步骤 3：`noblueprint` 的 ship 不导出；`noplayerblueprint` 仅看 ware `tags`；`noplayerbuild` 仅当所有 production 方法均为 `noplayerbuild` 时为 true。
  - [ ] 步骤 4：`equipments.json` 增加 `size` 字段，解析自装备宏名称，未命中为 `unknown`。

## 3. 解析规则与字段一致性检查

- [x] 3.1 校验 name/nameId 注入逻辑与现有 ware/module 保持一致。
- [x] 3.2 校验缺省 group 的插槽组映射逻辑可用。
- [x] 3.3 校验新增 i18n 词条已合并进当前 i18n 输出。
