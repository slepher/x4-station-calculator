# Tasks: resources-new

## 1. 版本分流入口
- [x] 1.1 在 `scripts/x4_data_map_processor.py` 中增加按当前版本号判定资源模型的逻辑。
- [x] 1.2 将判定规则固定为"主版本号小于 9 使用 `regions`，大于等于 9 使用 `resourceareas`"。
- [x] 1.3 确保该分流逻辑不依赖配置文件新字段。

## 2. `9.0+` 资源区定义解析
- [x] 2.1 在 `scripts/x4_data_map_processor.py` 中新增 `regionyields_final.xml` 的 `definition` 解析入口。
- [x] 2.2 提取 `id / ware / tag / yield / respawndelay / rating / radius / factor` 等字段。
- [x] 2.3 为定义层派生 `size` 与 `sustainableYieldPerHour`。

## 3. `9.0+` sector 资源区引用解析
- [x] 3.1 在 `scripts/x4_data_map_processor.py` 中新增 `mapdefaults_final.xml` 的 `<resourceareas>` 解析入口。
- [x] 3.2 以 `sector macro` 为键收集 `resourcearea.ref + amount`。

## 4. `regionyield_definitions.json` 输出
- [x] 4.1 新增 `regionyield_definitions.json` 输出路径。
- [x] 4.2 输出 definitions 数组。

## 5. `resourceareas.json` 输出
- [x] 5.1 输出为数组，每条记录包含 `{ref, amount, ware, rating, yield, delay, factor, respawn, cluster_id, sector_id}`。
- [x] 5.2 从 maps.json 的 sector 中移除 `resourceareas` 字段。
- [x] 5.3 将 `resource_wares` 重命名为 `resources`。
- [x] 5.4 为 `resourceareas.json` 增加 `respawn = yield × 60 / delay` 字段。

## 6. `regionyields.json` 兼容占位
- [x] 6.1 保留 `regionyields.json` 输出动作。
- [x] 6.2 当版本大于等于 `9.0` 时固定写入 `[]`。
- [x] 6.3 当版本小于 `9.0` 时继续沿用扩展结构输出。

## 7. `8.0` regions.json 输出格式对齐
- [x] 7.1 扩展 `build_yield_info_map()` 提取 `replenishtime` 和 `gatherspeedfactor`。
- [x] 7.2 新增 `build_regions_array()` 输出对齐 `resourceareas.json` 格式的数组。
- [x] 7.3 为每条记录计算 `volume_km3`、`falloff_factor`、`noise_probability`。
- [x] 7.4 为每条记录计算 `yield` 并按映射表确定 `rating`。
- [x] 7.5 计算 `delay = replenishtime / 60`，`factor = gatherspeedfactor 或 1`。
- [x] 7.6 统计每个 region 在 sector 中的引用次数作为 `amount`。
- [x] 7.7 输出 `regions.json` 数组格式。
- [x] 7.8 为 `regions.json` 增加 `respawn = yield × 60 / delay` 字段。
- [x] 7.9 cylinder 体积计算增加上限限制（半径 200km，高度 80km）。
- [x] 7.10 splinetube 体积计算增加上限限制（总长度 1000km）。
- [x] 7.11 sphere 半径超过 200km 时按圆柱体计算。

## 8. `8.0` regionyields.json 扩展
- [x] 8.1 在 `migrate_regionyields()` 输出中增加 `replenishtime` 字段。
- [x] 8.2 在 `migrate_regionyields()` 输出中增加 `gatherspeedfactor` 字段。
- [x] 8.3 气体资源从 XML 读取 `gatherspeedfactor`，固体资源设为 `1`。

## 9. 验证
- [x] 9.1 为 `9.0+` 验证 `resourceareas.json` 结构正确（数组，含 cluster_id/sector_id）。
- [x] 9.2 为 `9.0+` 验证 `maps.json` 中 sector 的 `resources` 字段（原 resource_wares）。
- [x] 9.3 完成实现后执行 `npm run build`，确认前端不报错。
- [x] 9.4 为 `8.0` 验证 `regions.json` 结构正确（数组，含 cluster_id/sector_id，含额外字段）。
- [x] 9.5 为 `8.0` 验证 `regionyields.json` 包含 `replenishtime` 和 `gatherspeedfactor`。

## 10. 统一 8.0/9.0 sector.resources 计算方式
- [x] 10.1 统一 `respawn` 计算公式：`sum(respawn × amount)`。
- [x] 10.2 9.0 `build_sector_resources_from_resourceareas()` 使用统一公式。
- [x] 10.3 8.0 `summarize_sector_resources()` 使用统一公式。