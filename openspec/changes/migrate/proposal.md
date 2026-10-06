## Why

Python processor 与现有 TypeScript 工具使用不同执行方式，版本默认值和参数行为也不一致。迁移到原生 TS 后，以统一 npm 命令执行三个任务，并保持游戏数据产物兼容。

## What Changes

- 新增 `npm run process -- <data|map|resources>`，迁移 processor 实际运行依赖，不通过包装 Python 宣称迁移完成。
- 保留 data 含地图、独立资源计算、两种资源模型、名称解析、DLC 及增量更新语义。
- **BREAKING**：resources 默认版本改为配置当前版本；逐格缓存按版本目录隔离，旧无版本缓存不自动复用；模型不适用选项报错。
- 新增隔离产物对照与必要 Unit 覆盖；用户验证通过后清理被替代的 Python 实现。

## Capabilities

### New Capabilities

- `processor-cli`：统一任务执行、版本选择、产物兼容、缓存状态及切换验收。

### Modified Capabilities

无。现有前端 JSON 契约和地图/资源分离保持不变。

## Impact

影响 `scripts/processor/`、基础数据主入口及其实际调用的 x4-game 扩展、package scripts、相关使用文档和 Unit。复用已安装的 TS/XML 依赖，不修改 Vue/store/presenter 或 Rust parser。需求细节以 `request.md` 为准。
