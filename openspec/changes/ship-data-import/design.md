## Context

本次新增飞船与装备数据导入能力，依赖 distiller 产物与解析阶段输出，重点在于插槽组与装备映射规则的稳定性。

## Decisions

1. **插槽组结构**：以 `group` 作为插槽组；缺省 `group` 使用 `connection.name` 作为独立插槽组，并标记 `isImplicitGroup=true`。
2. **插槽数组结构**：`slots` 为数组，按 `engine → thruster → shield → weapon → turret` 顺序输出，每项 `{ type, groups }`。
3. **Shield 内嵌**：当 group 同时出现 `shield` 与其它类型时，`shield` 以 `connection.shield` 内嵌到该组唯一 connection。
4. **成本结构**：按 `production` 数组输出 `{ method, noplayerbuild, cost }`。
5. **字段一致性**：`ships.json`、`equipments.json`、`shipgroups.json` 统一包含 `nameId/name`。
6. **生成入口**：由 `x4_data_processor.py` 负责生成新增 JSON 输出。
7. **i18n 合并**：新增数据的 i18n 词条并入现有 i18n 输出。
8. **Ship 插槽字段裁剪**：插槽组级不保留 `slotTypes/slotTags/primaryType`。
9. **Connections 合并**：同一插槽组内按 `tags` 相同合并 connection；移除 `name`，改为 `count` 计数。
10. **Connections 字段提取**：从 `tags` 中提取 `type/size`，并在 `tags` 中移除已提取的 `type/size`。
11. **Race 识别**：ship 的 `name` 使用 `_` 分段，取第 2 段作为 `race`。
12. **Thruster 插槽**：从 `ship_macros.xml` 的 `<thruster tags="...">` 提取为 `slots` 中 `thruster` 类型。
13. **id 规则**：`ships.json` / `equipments.json` 的 `id` 使用 `wareId`，不再输出 `wareId` 字段。
14. **noblueprint / noplayerbuild 规则**：`noblueprint` 直接不导出；`noplayerblueprint` 仅看 ware `tags`；`noplayerbuild` 需所有 production 方法都为 `noplayerbuild`。

## Non-Goals

- 不在本次变更内设计 UI 展示与交互。
- 不校验游戏内性能公式与战斗计算。

## Risks

- 部分连接点缺少 `group` 或 `tags` 不一致，可能导致插槽归类偏差。
- DLC 扩展新增字段导致解析规则需要补充。
