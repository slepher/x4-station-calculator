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

## 7. `8.0` regions.json 输出格式重构
- [x] 7.1 移除 `regions.json` 中的 `fields` 字段，不再使用该数据。
- [x] 7.2 移除 `regions.json` 中的 `cluster_id` / `sector_id` / `ref` / `amount` 引用字段。
- [x] 7.3 将 `regions.json` 改为纯 region 定义，使用 `id` 表示 region 名称。
- [x] 7.4 保留 `boundary`、`falloff`、`resources` 等定义字段。
- [x] 7.5 `resources` 数组包含 `{ware, amount, rating, yield, delay, factor, respawn, volume_km3, falloff_factor, noise_probability}`。

## 8. `8.0` resourceareas.json 新增
- [x] 8.1 新增 `resourceareas.json` 输出，存放 region 到 sector 的引用关系。
- [x] 8.2 每条记录包含 `{ref, amount, ware, rating, yield, delay, factor, respawn, cluster_id, sector_id}`。
- [x] 8.3 数据从 region 定义和 sector 引用派生。

## 9. `8.0` regionyields.json 扩展
- [x] 9.1 在 `migrate_regionyields()` 输出中增加 `replenishtime` 字段。
- [x] 9.2 在 `migrate_regionyields()` 输出中增加 `gatherspeedfactor` 字段。
- [x] 9.3 气体资源从 XML 读取 `gatherspeedfactor`，固体资源设为 `1`。

## 10. 验证
- [x] 10.1 为 `9.0+` 验证 `resourceareas.json` 结构正确（数组，含 cluster_id/sector_id）。
- [x] 10.2 为 `9.0+` 验证 `maps.json` 中 sector 的 `resources` 字段（原 resource_wares）。
- [x] 10.3 完成实现后执行 `npm run build`，确认前端不报错。
- [x] 10.4 为 `8.0` 验证 `regions.json` 结构正确（纯定义，不含 fields，含 resources 数组）。
- [x] 10.5 为 `8.0` 验证 `resourceareas.json` 结构正确（引用关系，含 cluster_id/sector_id）。
- [x] 10.6 为 `8.0` 验证 `regionyields.json` 包含 `replenishtime` 和 `gatherspeedfactor`。

## 11. 统一 8.0/9.0 sector.resources 计算方式
- [x] 11.1 统一 `respawn` 计算公式：`sum(respawn × amount)`。
- [x] 11.2 9.0 `build_sector_resources_from_resourceareas()` 使用统一公式。
- [x] 11.3 8.0 `summarize_sector_resources()` 使用统一公式。