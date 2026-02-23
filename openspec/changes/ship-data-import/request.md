# 需求说明：Ship Data Import

## 目标
为 X4 Station Calculator 增加飞船与装备数据导入能力，形成飞船设计模拟所需 JSON 输出（类型 → 插槽 → 插槽内装备），并支持多种建造模式的费用结构。

## 已确认方案（审核重点）
1. **数据蒸馏（Distiller）阶段输出**
   - `ships_final.xml`：由 `libraries/ships.xml` 叠加 DLC 生成。
   - `ship_macros.xml`：聚合所有 `ship_*_macro.xml`。
   - `ship_connections.xml`：聚合被 ship macro 引用的 `ship_*.xml`，并按 tags 过滤，仅保留与装配相关的连接点（去掉 `<offset>` 等内部元素）。
   - `equipment_macros.xml`：聚合装备宏（engine / shield / weapon / turret）。
   - `loadouts_final.xml`：由 `libraries/loadouts.xml` 叠加 DLC 生成。
   - `shipgroups_final.xml`：由 `libraries/shipgroups.xml` 叠加 DLC 生成。
   - 现有 `wares_final.xml` / `waregroups_final.xml` / `colors_final.xml` 继续使用。
   - 现有 `macros_final.xml` 更名为 `module_macros.xml`。

2. **解析阶段 JSON 输出**
   - 输出 `ships.json`、`equipments.json`、`shipgroups.json`。
   - 解析阶段由 `x4_data_processor.py` 生成上述 JSON；需改造以输出新增需求的 JSON 文件。
   - `ships.json` 结构为 **类型 → 插槽组 → 插槽内装备**：
     - 类型（Type）取 `connection.tags` 中的装备类型词（如 `turret`）。
     - 插槽组（Slot）取 `connection.group`；若缺失，则以 `connection.name` 单独成组（标记 `isImplicitGroup`）。
     - 插槽内装备来自 `loadouts_final.xml` 中同 `group` 的条目。
     - 当同一 group 同时出现 `shield` 与其它类型时，`primaryType` 取首个非 `shield` 类型；`shield` 仍保留在该 group 的类型集合与装配中。
   - 费用（cost）按多建造模式输出（`default`/`teladi`/`...`）。

3. **名称字段**
   - `ships.json`、`equipments.json`、`shipgroups.json` 都包含 `nameId` 与 `name`。
   - `nameId` 为 i18n key（与 ware/module 一致），`name` 为英文翻译结果。
   - 新增 i18n 词条需补充进当前生成的 i18n 输出中。

4. **shipgroups 输出**
   - `shipgroups.json` 仅保留 `id/nameId/name`，不包含 ships 列表。
   - `ships.json` 内包含 `shipgroup` 字段用于关联。

5. **经济实体原则**
   - ship/equipment 以 `ware` 为经济实体：成本/配方来自 `wares_final.xml`。
   - macro 仅提供性能/插槽/默认装配等附属信息，不单独保留 ware 子树。

## 边界
### In Scope
- Distiller 新增上述 XML 产物。
- 解析生成 `ships.json` / `equipments.json` / `shipgroups.json`。
- 满足飞船设计模拟所需结构与多建造模式费用。

### Out of Scope
- UI 与前端交互展示改造。
- 游戏内真实战斗/性能公式校验。
- 自动化测试执行（由用户手动验证）。

## 验收标准（DoD）
1. Distiller 输出包含：`ships_final.xml`、`ship_macros.xml`、`ship_connections.xml`（已过滤）、`equipment_macros.xml`、`loadouts_final.xml`、`shipgroups_final.xml`。
2. `ships.json` 按 **类型 → 插槽组 → 装备** 结构生成，包含 `primaryType/slotTypes/isImplicitGroup` 等规则字段。
3. `equipments.json` 与 `ships.json` 均包含 `nameId/name` 且成本按多建造模式输出。
4. `shipgroups.json` 仅保留 `id/nameId/name`，`ships.json` 内包含 `shipgroup`。
5. `test_tasks.md` 明确记录“测试由用户手动完成”。

## 未决项
无。
