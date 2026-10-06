## Why

当前 TS `data` 包含地图却遗漏地图资源计算，完整更新仍需另行执行 `resources`；loader 全量保存还阻止了安全的单项数据更新。需要将这些入口统一为按目标选择的一套迁移流水线。

## What Changes

- 新增 `all`、单项目标及逗号分隔多项目标，数据类别与版本范围独立选择。
- 将地图资源纳入整体流程，自动准备依赖并共享本轮计算结果。
- 拆分计算与写入，定义产物归属；局部更新保留无关文件、其他星区与共享翻译。
- **BREAKING**：旧 `data` 名称进入 `all`，现在会执行资源计算；旧 map/resources 名称进入相应目标，不保留独立流程。
- 保持 JSON 契约和算法，增加对应 Unit、帮助文档和构建验证。

## Capabilities

### New Capabilities

- `processor-pipeline`：目标选择、依赖执行、整体迁移、产物归属与局部保存。

### Modified Capabilities

无。既有 `migrate` 尚未归档，其 processor-cli 规格保留为迁移历史，本变更明确替代三任务分离的执行组织方式。

## Impact

影响 scripts/x4_processor.ts、scripts/processor 下的 CLI 配置、data/map/resources 及扩展的执行和保存边界、README 与 tests/unit/processor。无新增运行依赖，无前端或 Rust 改动。需求以 request.md 为准。
