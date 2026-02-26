# 需求说明：Ship Data Import

## 目标
为 X4 Station Calculator 增加飞船与装备数据导入能力，形成飞船设计模拟所需 JSON 输出（类型 → 插槽 → 插槽内装备），并支持多种建造模式的费用结构。

## 已确认方案（审核重点）
1. **数据蒸馏（Distiller）阶段输出**
   - `index/components.xml`：由 base `index/components.xml` 叠加 DLC `index/components.xml` 节点生成。
     - 写出前清理 `entry.value` 中 `assets/test` 路径项。
     - 写出前规范 `entry.value` 中重复反斜杠（`\\` -> `\`）。
     - `name` 相同且内容相同的节点自动去重；同名不同内容写出后报错退出，便于人工检查。
   - `ships_final.xml`：由 `libraries/ships.xml` 叠加 DLC 生成。
   - `ship_macros.xml`：聚合所有 `ship_*_macro.xml`。
   - `ship_components.xml`：聚合被 ship macro 引用的 `ship_*.xml`，并按 tags 过滤，仅保留与装配相关的连接点（去掉 `<offset>` 等内部元素）。
     - **2026-02-26 更新**：从 `ship_macros.xml` 的 `component[@ref]` 直接收集 component refs，不再依赖 wares 映射。
   - `equipment_macros.xml`：聚合所有 `transport="equipment"` 对应的 macro（不再基于关键词过滤）。
     - **2026-02-26 更新**：从 `wares_final.xml` 读取 `transport="equipment"` 的 ware，获取其 `component@ref` 作为 macro 引用。
   - `equipment_components.xml`：直接从 `equipment_macros.xml` 收集所有 `component[@ref]`，从 `index/components.xml` 导出。
     - **2026-02-26 更新**：不再依赖 wares 映射，直接从 macro 获取 component refs。
   - `bullet_macros.xml`：导出 bullet 宏（从 equipment 的 bullet class 引用收集）。
     - **2026-02-26 更新**：从 `equipment_macros.xml` 收集 bullet class 引用，剔除 missile macro 名字后导出。
   - `ship_connection_macros.xml`（新增）：导出 ship_macros.xml 的 connections 引用的所有 macro。
   - `loadouts_final.xml`：由 `libraries/loadouts.xml` 叠加 DLC 生成。
   - `shipgroups_final.xml`：由 `libraries/shipgroups.xml` 叠加 DLC 生成。
   - 现有 `wares_final.xml` / `waregroups_final.xml` / `colors_final.xml` 继续使用。
   - 现有 `macros_final.xml` 更名为 `module_macros.xml`。
   - **未导出检查**：生成 `unexported_equipment_wares.txt`，列出 `transport="equipment"` 但未导出到 `equipment_macros.xml` 的 wares。

2. **解析阶段 JSON 输出**
   - 输出 `ships.json`、`equipments.json`、`shipgroups.json`、`missiles.json`、`bullet.json`、`drones.json`、`consumables.json`。
   - **2026-02-26 更新**：新增 `missiles.json`（从 wares 的 group="missiles" 导出）、`bullet.json`（从 bullet_macros.xml 导出）、`drones.json`（ship_xs/ship_s）、`consumables.json`（mine/satellite/scanner/countermeasure 等）。
   - 解析阶段由 `x4_data_processor.py` 生成上述 JSON；需改造以输出新增需求的 JSON 文件。
   - `ships.json` 结构为 **插槽类型数组 → 组 → 装备**：
     - `slots` 为数组，按 `engine → thruster → shield → weapon → turret` 顺序输出。
     - 每个 slot 项为 `{ type, groups }`，`groups` 为插槽组数组。
     - 插槽组（Group）取 `connection.group`；若缺失，则以 `connection.name` 单独成组（标记 `isImplicitGroup`）。
     - 插槽内装备来自 `loadouts_final.xml` 中同 `group` 的条目。
     - 当同一 group 同时出现 `shield` 与其它类型时，`shield` 作为 `connection.shield` 内嵌到该组唯一的 `connection` 中。
     - **Ship 数据：插槽组级不保留 `slotTypes` / `slotTags` / `primaryType` 字段。**
     - **Ship 数据：connection 按相同 `tags` 合并，不保留 `name`，使用 `count` 计数。**
     - **Ship 数据：connection 保留 `size` 字段；`tags` 中移除已提取的 `type/size/mandatory`，并额外移除 `platformcollision/envmap_cockpit`。**
     - **Ship 数据：group 新增 `mandatory`（布尔），由连接点 tags 提取；不存在则为 `false`。**
     - **Ship 数据：ship 的 `name` 使用 `_` 分段，取第 2 段作为 `race`。**
     - **Ship 数据：从 `ship_macros.xml` 的 `<thruster tags="...">` 提取 thruster 插槽（作为 `slots` 中的 `thruster` 类型）。**
   - 生产方式按 `production` 数组输出：`[{ method, noplayerbuild, cost }]`。
   - `noplayerblueprint` 仅从 ware 本体 `tags` 读取；`noplayerbuild` 仅当所有 production 方法都为 `noplayerbuild` 时为 true。
   - `noblueprint` 的 ship 直接不导出。
   - `ships.json` / `equipments.json` 的 `id` 使用 `wareId`；不再输出 `wareId` 字段。
   - `equipments.json` 的 `type` 与 `size` 从 `slotTags` 提取；任一提取失败时记录失败并跳过该装备，不做 fallback。
   - `equipments.json` 的 `slotTags` 不再走语义推断/复杂判定，而是直接由 `equipment_components.xml` 的 connection tags 聚合去重得到。
     - 映射链路：`equipment(ware id) -> ware.component(ref=macro) -> equipment_macro.component(ref=component) -> equipment_components.component(name=component)`。
     - 解析后 `slotTags` 移除 `component` 与已提取的 `type/size`。
   - 若 `slotTags` 包含 `spacesuit`，该装备不写入 `equipments.json`。
   - `equipments.json` 新增 `noplayerblueprint`（bool）：从 ware tags 提取；若不存在则 `false`；并从 `tags` 数组中移除 `noplayerblueprint` 字段。
   - `equipments.json` 新增 `bullet` 字段（string）：武器装备的 bullet class 引用。

3. **missiles.json 输出**
   - 从 `wares_final.xml` 读取 `group="missiles"` 的 ware 导出。
   - 包含字段：`id`, `nameId`, `name`, `group`, `tags`, `transport`, `macroId`, `cost`。
   - 合并 `bullet_macros.xml` 中的 missile 属性（hull, shield, explosive, homing）。

4. **bullet.json 输出**
   - 从 `bullet_macros.xml` 导出（排除 missile 类型）。
   - 包含字段：`id`, `class`, `mk`, `race`, `type`, `speed`, `lifetime`, `hull`, `shield`。

5. **drones.json 输出**
   - 从 `equipment_macros.xml` 导出 class 为 `ship_xs` 或 `ship_s` 的装备。
   - 包含字段：`id`, `nameId`, `name`, `macro`, `class`, `mk`, `race`, `tags`, `cost`。

6. **consumables.json 输出**
   - 从 `equipment_macros.xml` 导出非主战装备（mine, satellite, scanner, countermeasure, navbeacon, resourceprobe 等）。
   - 包含字段：`id`, `nameId`, `name`, `macro`, `class`, `mk`, `race`, `tags`, `cost`。

7. **名称字段**
   - `ships.json`、`equipments.json`、`shipgroups.json`、`missiles.json`、`drones.json`、`consumables.json` 都包含 `nameId` 与 `name`。
   - `nameId` 为 i18n key（与 ware/module 一致），`name` 为英文翻译结果。
   - 新增 i18n 词条需补充进当前生成的 i18n 输出中。

8. **shipgroups 输出**
   - `shipgroups.json` 仅保留 `id/nameId/name`，不包含 ships 列表。
   - `ships.json` 内包含 `shipgroup` 字段用于关联。

9. **经济实体原则**
   - ship/equipment 以 `ware` 为经济实体：成本/配方来自 `wares_final.xml`。
   - macro 仅提供性能/插槽/默认装配等附属信息，不单独保留 ware 子树。

## 边界
### In Scope
- Distiller 新增上述 XML 产物。
- 解析生成 `ships.json` / `equipments.json` / `shipgroups.json` / `missiles.json` / `bullet.json` / `drones.json` / `consumables.json`。
- 满足飞船设计模拟所需结构与多建造模式费用。

### Out of Scope
- UI 与前端交互展示改造。
- 游戏内真实战斗/性能公式校验。
- 自动化测试执行（由用户手动验证）。

## 验收标准（DoD）
1. Distiller 输出包含：`index/components.xml`、`ships_final.xml`、`ship_macros.xml`、`ship_components.xml`（已过滤）、`equipment_macros.xml`、`equipment_components.xml`、`bullet_macros.xml`、`ship_connection_macros.xml`、`loadouts_final.xml`、`shipgroups_final.xml`。
2. `index/components.xml` 满足：`assets/test` 条目已移除，双反斜杠已规范、同名同内容已去重、同名不同内容会在写出后报错。
3. `ships.json` 按 **插槽类型数组 → 组 → 装备** 结构生成，包含 `isImplicitGroup` 与 `connection.shield` 规则字段。
4. `equipments.json` 与 `ships.json` 均包含 `nameId/name` 且按 `production` 输出成本数组。
5. `equipments.json` 的 `size` 仅支持 `small/medium/large/extralarge`，并由 `slotTags` 提取。
6. `equipments.json` 的 `slotTags` 仅来源于 `equipment_components.xml` 的 connection tags 并去重聚合。
7. `equipments.json` 输出 `noplayerblueprint` 布尔字段，且 `tags` 内不再包含该 tag。
8. `equipments.json` 输出 `bullet` 字段（武器的 bullet class 引用）。
9. `shipgroups.json` 仅保留 `id/nameId/name`，`ships.json` 内包含 `shipgroup`。
10. `test_tasks.md` 明确记录"测试由用户手动完成"。
11. `ships.json` 的 ship 数据：插槽组级不输出 `slotTypes/slotTags/primaryType`；connection 级合并同 `tags` 项、输出 `count`，并补充 `size`；group 级输出 `mandatory`；`race` 由 ship `name` 分段获得。
12. `missiles.json` 从 wares 导出，包含 missile 属性。
13. `bullet.json` 仅导出 Bullet 类型（不含 missile）。
14. `drones.json` 导出 ship_xs/ship_s 装备。
15. `consumables.json` 导出 mine/satellite/scanner/countermeasure 等装备。

## 未决项
无。
