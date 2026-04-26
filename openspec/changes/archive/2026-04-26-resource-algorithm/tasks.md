# resource-algorithm 实施任务

## 1. region 定义提取与 resources 聚合（来自 map-resource-calc）
- [x] 1.1 在地图数据处理脚本中增加 `region_definitions_final.xml` 详细迁移流程
- [x] 1.2 为每个 region 输出 region 级 noise 属性、`boundary`、`falloff` 与 `fields`
- [x] 1.3 保留现有 region 标识与地图挂载关系
- [x] 1.4 解析 `regionobjectgroups_final.xml`，建立 `groupref → resource/yield/yieldvariation` 最小索引
- [x] 1.5 按 `groupref` 将 group 产额字段直接内联到 field
- [x] 1.6 明确忽略 `select macro` 列表，不写入 `regions.json`
- [x] 1.7 在每个 region 下新增 `resources` 聚合字段
- [x] 1.8 按 `ware` 聚合同 region 内的资源 field，输出累计模拟密度
- [x] 1.9 在 sector 层按 `ware` 聚合 region 资源结果
- [x] 1.10 计算 `total_amount`、`max_density`、`density_threshold = max_density / 3`
- [x] 1.11 在达标矿区中选取总量最大的代表矿区
- [x] 1.12 输出 `representative_amount`、`representative_density`、`max_amount_region_density`
- [x] 1.13 选定统一柏林噪声实现，生成经验分布/CDF 作为概率模型
- [x] 1.14 按 `P(min <= noise <= max)` 计算每个 field 的 noise 覆盖概率
- [x] 1.15 基于 field 的 `densityfactor`、`yield` 与 noise 覆盖概率计算 field 级贡献
- [x] 1.16 保持 field 级原始参数可追溯
- [x] 1.17 将新 region 详细结构写入目标版本 `regions.json`
- [x] 1.18 将 sector 资源聚合结果接入地图数据产物
- [x] 1.19 抽取共享版本选择辅助逻辑，避免脚本重复实现
- [x] 1.20 为 `x4_data_processor.py` / `x4_data_map_processor.py` 增加多版本处理入口
- [x] 1.21 验证多版本运行时按 `folder_name` 输出到对应目录

## 2. 8.0 资源算法简化（来自 map-resource-algorithm）
- [x] 2.1 支持 `<boundaries>` 容器格式的 splinetube 解析
- [x] 2.2 过滤空 resources 的 region（317 → 236）
- [x] 2.3 确定新架构：regions.json（模板）+ resourceareas.json（实例计算）
- [x] 2.4 实现 regions.json 输出（仅 yield_info_map 字段）
- [x] 2.5 实现气体资源坐标转换（region → cluster → sector）
- [x] 2.6 实现气体资源 64km³ 方块网格算法（X/Z: ±256km 各 9 格，Y: ±64km 3 格）
- [x] 2.7 实现固体资源截断规则（圆柱/球形 256×256×192km，tube X/Z±256km）
- [x] 2.8 实现 falloff 一元计算（lateral × radial）
- [x] 2.9 计算 total_yield/total_respawn/yield/respawn/density/respawn_density

## 3. 9.0+ 新资源管线（来自 resources-new）
- [x] 3.1 在 `scripts/x4_data_map_processor.py` 中增加按当前版本号判定资源模型的逻辑
- [x] 3.2 判定规则：主版本号小于 9 使用 regions，大于等于 9 使用 resourceareas
- [x] 3.3 确保分流逻辑不依赖配置文件新字段
- [x] 3.4 新增 `regionyields_final.xml` 的 definition 解析入口（id/ware/tag/yield/respawndelay/rating/radius/factor）
- [x] 3.5 为定义层派生 size 与 sustainableYieldPerHour
- [x] 3.6 新增 `mapdefaults_final.xml` 的 `<resourceareas>` 解析入口
- [x] 3.7 以 sector macro 为键收集 resourcearea.ref + amount
- [x] 3.8 新增 `regionyield_definitions.json` 输出路径
- [x] 3.9 输出为数组，每条记录包含 `{ref, amount, ware, rating, yield, delay, factor, respawn, cluster_id, sector_id}`
- [x] 3.10 从 maps.json 的 sector 中移除 `resourceareas` 字段
- [x] 3.11 将 `resource_wares` 重命名为 `resources`
- [x] 3.12 为 `resourceareas.json` 增加 `respawn = yield × 60 / delay` 字段
- [x] 3.13 保留 `regionyields.json` 输出动作，9.0+ 固定写入 `[]`
- [x] 3.14 8.0 版本移除 `regions.json` 中的 `fields` / `cluster_id` / `sector_id` / `ref` / `amount` 引用字段
- [x] 3.15 8.0 regions.json 保留 boundary、falloff、resources（含 ware/yield/delay/factor/respawn/density/respawn_density）
- [x] 3.16 8.0 新增 `resourceareas.json`（region 到 sector 引用关系）
- [x] 3.17 8.0 regionyields.json 增加 replenishishtime 和 gatherspeedfactor 字段
- [x] 3.18 统一 8.0/9.0 sector.resources 计算方式
- [x] 3.19 resourceareas.json 改为按 cluster_id + sector_id 分组结构
- [x] 3.20 8.0 重新支持 `<fields>` 节点解析（asteroid/nebula）
- [x] 3.21 实现 field 贡献公式：`Σ(densityfactor × noise_width × yield × resourcepercentage/100)`
- [x] 3.22 修正 replenishishtime 单位处理（保持分钟）
- [x] 3.23 体积计算移除 falloff：`volume_km3 = boundary_volume(boundary) / 10^9`
- [x] 3.24 为 resources 添加 density 和 respawn_density 字段
- [x] 3.25 区分固体/气体资源计算逻辑
- [x] 3.26 为 resources 数组添加 yield_name 和 resourcedensity 字段
- [x] 3.27 fields 数组迁移：asteroids/debris/nebulae 三个数组
- [x] 3.28 验证各版本输出结构正确，`npm run build` 前端不报错

## 4. resourceareas 格式统一（来自 resourcearea-map-accum）
- [x] 4.1 修改 scripts/processor/map/generator.py（9.0 处理逻辑）：添加 `resources` 数组结构
- [x] 4.2 `factor` → `gatherfactor`
- [x] 4.3 `rating` 移入 resources 数组
- [x] 4.4 yield/respawn × amount 加权累加
- [x] 4.5 修改 scripts/processor/resource/modern_processor.py 适配新结构
- [x] 4.6 修改 scripts/x4_data_map_processor.py 适配新结构
- [x] 4.7 验证输出格式正确

## 5. processor 模块化与文档（来自 map-resource-processor）
### 5.1 Step 1 模块迁移
- [x] 5.1.1 创建 `scripts/processor/step1_map/` 目录及子模块
- [x] 5.1.2 复制 processor/map/*.py → step1_map/
- [x] 5.1.3 修改 step1_map/service.py 为独立实现
- [x] 5.1.4 添加 sector.regions 输出（8.0 和 9.0+）
- [x] 5.1.5 停止 sector.resources 聚合和 resourceareas.json 输出
- [x] 5.1.6 删除 scripts/processor/x4_map_processor.py
- [x] 5.1.7 迁移 processor/sector/ → shared/sector/
- [x] 5.1.8 迁移 processor/utils/ → shared/utils/
- [x] 5.1.9 迁移 processor/output_manager.py → shared/output_manager.py
- [x] 5.1.10 8.0 输出 regionyields.json、regions.json、maps.json（含 sector.regions）
- [x] 5.1.11 9.0+ 输出 regionyield_definitions.json、maps.json（含 sector.regions）

### 5.2 Step 2 模块创建
- [x] 5.2.1 创建 `scripts/processor/step2_resource/` 目录结构
- [x] 5.2.2 创建 service.py、model_detector.py、modern_processor.py
- [x] 5.2.3 创建 estimator/（固体估算、气体估算）
- [x] 5.2.4 创建 per_block/（固体逐格、气体逐格）

### 5.3 固体估算算法
- [x] 5.3.1 实现 `calculate_solid_volume_km3()`：cylinder/sphere/splinetube/box 封顶体积
- [x] 5.3.2 实现 `estimate_solid_yield()`：理论储量 = solid_volume_km3 × falloff × resourcedensity

### 5.4 气体估算算法
- [x] 5.4.1 实现 `calculate_gas_volume_km3()`：离散化体积（64km 分层/32km 取整/64×64 方阵）
- [x] 5.4.2 实现 `estimate_gas_yield()`：理论储量 = gas_volume_km3 × falloff × resourcedensity / 64³

### 5.5 固体逐格算法
- [x] 5.5.1 实现圆柱/样条管 falloff 权重计算
- [x] 5.5.2 实现 noise CDF 和快速路径计算
- [x] 5.5.3 实现 falloff 插值（梯形积分）
- [x] 5.5.4 实现主入口 `replay_region_solid_sum_weights_and_areas()`

### 5.6 气体逐格算法
- [x] 5.6.1 实现气体圆柱/球体/盒体/样条管区间计算
- [x] 5.6.2 实现候选方块枚举
- [x] 5.6.3 实现主入口 `replay_gas_area_values_for_field()`

### 5.7 共用函数模块
- [x] 5.7.1 实现 `calculate_falloff_factors()`、`calculate_falloff_at_point()`
- [x] 5.7.2 实现 `aggregate_sector_resources_from_resourceareas()`
- [x] 5.7.3 实现 `calculate_rating()`（基于 respawn 的 1-5 级评分）
- [x] 5.7.4 实现坐标变换函数

### 5.8 9.0+ 处理
- [x] 5.8.1 实现 `build_resourceareas_json_payload()` 组装 resourceareas.json
- [x] 5.8.2 从 definition 读取 yield/respawn/delay/gatherfactor/rating
- [x] 5.8.3 聚合 sector.resources

### 5.9 入口脚本与参数
- [x] 5.9.1 创建 `scripts/x4_resource_processor.py`
- [x] 5.9.2 实现 `--all-sectors` 参数
- [x] 5.9.3 实现 `--sector <sector_id>` 参数（增量更新）

### 5.10 验收脚本修改
- [x] 5.10.1 修改 `solid_sum_weights_replay_v2.py` 添加 `--all-sectors` / `--output-dir` / `--cut-mode` 参数
- [x] 5.10.2 修改 `gas_sum_weights_replay.py` 添加相同参数
- [x] 5.10.3 实现网格范围模式映射（full / 15x15x3）

### 5.11 验证与文档
- [x] 5.11.1 创建 `scripts/processor/verify_resource_blocks.py`
- [x] 5.11.2 实现两个 JSON 比对的差异报告
- [x] 5.11.3 创建 per_block_bridge.py 桥接模块
- [x] 5.11.4 创建 update_regions_fields.py 补充 field 定义
- [x] 5.11.5 创建算法文档：solid_estimator.md / gas_estimator.md / solid_per_block.md / gas_per_block.md
