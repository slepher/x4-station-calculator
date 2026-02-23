## Context

本次新增飞船与装备数据导入能力，依赖 distiller 产物与解析阶段输出，重点在于插槽组与装备映射规则的稳定性。

## Decisions

1. **插槽组结构**：以 `group` 作为插槽组；缺省 `group` 使用 `connection.name` 作为独立插槽组，并标记 `isImplicitGroup=true`。
2. **类型判定**：插槽类型取 `connection.tags` 中的装备类型词；同组含 `shield` 与其他类型时，`primaryType` 取首个非 `shield` 类型。
3. **成本结构**：按 `production method` 输出多建造模式成本映射。
4. **字段一致性**：`ships.json`、`equipments.json`、`shipgroups.json` 统一包含 `nameId/name`。
5. **生成入口**：由 `x4_data_processor.py` 负责生成新增 JSON 输出。
6. **i18n 合并**：新增数据的 i18n 词条并入现有 i18n 输出。

## Non-Goals

- 不在本次变更内设计 UI 展示与交互。
- 不校验游戏内性能公式与战斗计算。

## Risks

- 部分连接点缺少 `group` 或 `tags` 不一致，可能导致插槽归类偏差。
- DLC 扩展新增字段导致解析规则需要补充。
