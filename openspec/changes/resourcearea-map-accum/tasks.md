# Tasks: resourcearea-map-accum

## 实施任务

- [x] 创建 change 目录和 request.md
- [x] 修改 scripts/processor/map/generator.py (9.0 处理逻辑)
  - [x] 添加 `resources` 数组结构
  - [x] `factor` → `gatherfactor`
  - [x] `rating` 移入 resources
  - [x] yield/respawn × amount 计算
- [x] 修改 scripts/processor/resource/modern_processor.py
  - [x] `build_resourceareas_json_payload` 适配新结构
  - [x] `build_sector_resource_summaries_from_resourceareas` 适配新结构
- [x] 修改 scripts/x4_data_map_processor.py (9.0 处理逻辑)
  - [x] 添加 `resources` 数组结构
  - [x] `factor` → `gatherfactor`
  - [x] `rating` 移入 resources
- [x] 创建 spec.md
- [x] 运行处理器验证输出
- [x] 验证输出格式正确
