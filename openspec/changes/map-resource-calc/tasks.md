# map-resource-calc 实施任务

- [x] 1. region 定义迁移入口
- [x] 1.1 在地图数据处理脚本中增加 `region_definitions_final.xml` 详细迁移流程
- [x] 1.2 为每个 region 输出 region 级 noise 属性、`boundary`、`falloff` 与 `fields`
- [x] 1.3 保留现有 region 标识与地图挂载关系，避免丢失原有引用能力

- [x] 2. group 产额字段回填
- [x] 2.1 解析 `regionobjectgroups_final.xml`，建立 `groupref -> resource/yield/yieldvariation` 最小索引
- [x] 2.2 在迁移 field 时按 `groupref` 将 `resource`、`yield`、`yieldvariation` 直接内联到 field
- [x] 2.3 明确忽略 `select macro` 列表，不写入 `regions.json`

- [x] 3. resources 聚合层
- [x] 3.1 在每个 region 下新增 `resources` 聚合字段
- [x] 3.2 按 `ware` 聚合同 region 内的资源 field
- [x] 3.3 输出每种资源的累计模拟密度与必要的聚合中间量

- [x] 4. sector resources 聚合层
- [x] 4.1 在 sector 层按 `ware` 聚合 region 资源结果
- [x] 4.2 计算每个资源的 `total_amount`
- [x] 4.3 计算 `max_density` 与 `density_threshold = max_density / 3`
- [x] 4.4 在达标矿区中选取总量最大的代表矿区
- [x] 4.5 输出 `representative_amount`、`representative_density`
- [x] 4.6 额外输出 `max_amount_region_density` 作为补充字段

- [x] 5. 统一柏林噪声概率模型
- [x] 5.1 选定统一柏林噪声实现与归一化方式
- [x] 5.2 生成经验分布或经验 CDF，作为所有 noise 区间共用的概率模型
- [x] 5.3 按 `P(min <= noise <= max)` 计算每个 field 的 noise 覆盖概率
- [x] 5.4 在数据结构中明确该结果属于模拟近似而非引擎精确值

- [x] 6. 资源模拟密度累计
- [x] 6.1 基于 field 的 `densityfactor`、`yield` 与 noise 覆盖概率计算 field 级贡献
- [x] 6.2 将同资源 field 贡献累计到 region `resources`
- [x] 6.3 将 region 结果继续累计并筛选为 sector `resources`
- [x] 6.4 保持 field 级原始参数可追溯，便于后续解释聚合结果

- [x] 7. 构建输出接线
- [x] 7.1 将新的 region 详细结构写入目标版本 `regions.json`
- [x] 7.2 将 sector 资源聚合结果接入地图数据产物
- [x] 7.3 检查现有地图数据产物与新字段的兼容关系
- [x] 7.4 若引入新增辅助字段，统一命名并保持近似语义清晰

- [x] 8. 多版本处理能力
- [x] 8.1 抽取共享版本选择辅助逻辑，避免脚本重复实现
- [x] 8.2 为 `x4_data_processor.py` 增加当前版本 / 指定版本 / 所有版本处理入口
- [x] 8.3 为 `x4_data_map_processor.py` 增加当前版本 / 指定版本 / 所有版本处理入口
- [x] 8.4 验证多版本运行时按 `folder_name` 输出到对应目录
