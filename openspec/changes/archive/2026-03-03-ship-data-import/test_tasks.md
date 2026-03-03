# Test Tasks: ship-data-import

## 1. Unit Tests（Vitest）

- 无（本变更由用户手动验证，暂无自动化测试需求；手动检查以下项）：
  - Distiller：`index/components.xml` 已输出，且移除 `assets/test` 条目、规范路径双反斜杠、同名同内容去重后仍可写出。
  - Distiller：若存在同名不同内容节点，`index/components.xml` 写出后触发报错退出。
  - Distiller：`equipment_components.xml` 已输出，且仅包含 `tags` 含 `component` 的 connection。
  - Processor：`equipments.slotTags` 来源于 `equipment_components.xml` 的 connection tags 聚合去重。
  - Processor：`slotTags` 走 `ware -> macro -> macro.component -> equipment_components` 映射链路，而非 `equipment id` 直接映射。
  - Processor：`equipments.noplayerblueprint` 从 `tags` 提取，缺省为 `false`，且 `tags` 中不再保留该标记。

## 2. Web Integration / E2E

- 无（本变更由用户手动验证，暂无自动化测试需求）。
