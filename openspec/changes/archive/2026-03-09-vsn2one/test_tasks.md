# Test Tasks: vsn2one

## 1 单元测试

- [✓] 1.1 blueprint migration 归一化输出
  - [✓] 1.1.1 在 `migrateShipBlueprintStateToCurrent` 输入 `version=0` 且包含一个缺失 `shipId` 的条目
  - [✓] 1.1.2 读取迁移结果的 `list` 与 `activeId`
  - [✓] 1.1.3 断言迁移结果过滤无效条目且 `version=1` #期望: [1]

- [✓] 1.2 import/export ship 模组复用统一 migration 路径
  - [✓] 1.2.1 在 import 流程输入 `x4_ship_blueprints.version=0` 并执行 overwrite
  - [✓] 1.2.2 在 export 流程对同一 ship 数据执行 `buildExportPayload`
  - [✓] 1.2.3 断言导入落盘 version 与导出 payload version 都等于 `1` #期望: [1]

## 2 E2E 标准状态与状态迁移

## 3 E2E 测试场景

## 4 Bug 测试
