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
   - `ships.json` 结构为 **插槽类型数组 → 组 → 装备**：
     - `slots` 为数组，按 `engine → thruster → shield → weapon → turret` 顺序输出。
     - 每个 slot 项为 `{ type, groups }`，`groups` 为插槽组数组。
     - 插槽组（Group）取 `connection.group`；若缺失，则以 `connection.name` 单独成组（标记 `isImplicitGroup`）。
     - 插槽内装备来自 `loadouts_final.xml` 中同 `group` 的条目。
     - 当同一 group 同时出现 `shield` 与其它类型时，`shield` 作为 `connection.shield` 内嵌到该组唯一的 `connection` 中。
     - **Ship 数据：插槽组级不保留 `slotTypes` / `slotTags` / `primaryType` 字段。**
     - **Ship 数据：connection 按相同 `tags` 合并，不保留 `name`，使用 `count` 计数。**
     - **Ship 数据：connection 保留 `size` 字段；`tags` 中移除已提取的 `type/size`，保留其余标签。**
     - **Ship 数据：ship 的 `name` 使用 `_` 分段，取第 2 段作为 `race`。**
     - **Ship 数据：从 `ship_macros.xml` 的 `<thruster tags="...">` 提取 thruster 插槽（作为 `slots` 中的 `thruster` 类型）。**
   - 生产方式按 `production` 数组输出：`[{ method, noplayerbuild, cost }]`。
   - `noplayerblueprint` 仅从 ware 本体 `tags` 读取；`noplayerbuild` 仅当所有 production 方法都为 `noplayerbuild` 时为 true。
   - `noblueprint` 的 ship 直接不导出。
   - `ships.json` / `equipments.json` 的 `id` 使用 `wareId`；不再输出 `wareId` 字段。
   - `equipments.json` 新增 `size` 字段：从装备宏名称中解析（`s/m/l/xl` 或 `small/medium/large/extralarge`），无法解析时为 `unknown`。

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
2. `ships.json` 按 **插槽类型数组 → 组 → 装备** 结构生成，包含 `isImplicitGroup` 与 `connection.shield` 规则字段。
3. `equipments.json` 与 `ships.json` 均包含 `nameId/name` 且按 `production` 输出成本数组。
4. `equipments.json` 的 `size` 支持 `small/medium/large/extralarge/unknown`。
4. `shipgroups.json` 仅保留 `id/nameId/name`，`ships.json` 内包含 `shipgroup`。
5. `test_tasks.md` 明确记录“测试由用户手动完成”。
6. `ships.json` 的 ship 数据：插槽组级不输出 `slotTypes/slotTags/primaryType`；connection 级合并同 `tags` 项、输出 `count`，并补充 `size`；`race` 由 ship `name` 分段获得。

## 未决项
无。
