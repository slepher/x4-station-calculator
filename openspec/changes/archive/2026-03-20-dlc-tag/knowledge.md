# dlc-tag 测试知识库

## 范围说明

- 本次 change 仅调整数据处理与资源导出。
- 变更目标是为指定 JSON 增加 `dlc_tag`，并新增 `dlcs.json` DLC 元数据输出。
- 本次没有新增交互 UI、状态机、路由或用户输入流程。

## 人工验收结论

- 已人工检查 `wares.json`、`maps.json` 的 `clusters` 节点，以及 `modules.json`、`ships.json`、`equipments.json`、`drones.json`、`consumables.json`、`missiles.json` 的 `dlc_tag` 写出结果。
- 已人工检查 `dlcs.json` 输出格式为 `{ id, nameId, name, dependencyVersion }`。
- 已人工检查 `dependencyVersion` 从 `600/700/750/800` 转换为 `6.0/7.0/7.5/8.0`。

## 自动化测试策略

- 本次 change 不新增自动化测试任务。
- 原因：
  - 主要改动发生在离线数据处理脚本与静态资源导出结果。
  - 需求验收重点是导出 JSON 字段存在性与字段值正确性。
  - 当前 change 不引入新的可交互前端行为，不单独新增 UI E2E 场景。
- 自动化回归依赖：
  - `npm run build`
  - `python3 scripts/x4_data_processor.py`
  - `python3 scripts/x4_data_processor.py --version 8.0 --stable`

## 输出文件观察点

- `src/assets/x4_game_data/8.0-Diplomacy/data/wares.json`
- `src/assets/x4_game_data/8.0-Diplomacy/data/maps.json`
- `src/assets/x4_game_data/8.0-Diplomacy/data/dlcs.json`
- `src/assets/x4_game_data/9.0-Empire-beta/data/wares.json`
- `src/assets/x4_game_data/9.0-Empire-beta/data/maps.json`
- `src/assets/x4_game_data/9.0-Empire-beta/data/dlcs.json`

## 测试运行

- 当前无失败沉淀项。
