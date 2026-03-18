# Refactory Map Processor Specification

## Purpose

定义将 `x4_data_map_processor.py` (3662 行) 分拆为模块化 `processor` 包的接口规范和函数映射。

---

## ADDED Requirements

### Requirement: 模块化目录结构

#### Scenario: 目录创建

**前提** 存在单一文件 `scripts/x4_data_map_processor.py`

**当** 执行分拆

**那么** 创建以下目录结构：

```
scripts/processor/
├── __init__.py              # 包初始化，导出统一接口
├── i18n.py                  # 现有 - 国际化
├── versioning.py            # 现有 - 版本配置
├── config.py                # 新增 - 运行时配置
├── utils/                   # 工具函数子包
│   ├── __init__.py
│   ├── xml_utils.py
│   ├── math_utils.py
│   ├── data_utils.py
│   └── noise.py
├── resource/                # 资源处理模块
│   ├── __init__.py
│   ├── model_detector.py
│   ├── legacy_processor.py
│   └── modern_processor.py
├── sector/                  # Sector 处理模块
│   ├── __init__.py
│   ├── parser.py
│   ├── resource_summary.py
│   └── template.py
└── map/                     # Map 主处理模块
    ├── __init__.py
    ├── generator.py
    └── writer.py
```

---

### Requirement: 模块接口定义

#### Scenario: config.py 模块

**当** 导入 `processor.config`

**那么** 提供以下函数：

| 函数 | 来源 | 描述 |
|------|------|------|
| `apply_runtime_config(effective_config)` | 原 L39 | 应用运行时配置到全局变量 |
| `default_version_item(config)` | 原 L75 | 获取默认版本配置项 |
| `parse_args()` | 原 L427 | 解析命令行参数 |
| `resolve_runtime_paths(args)` | 原 L3481 | 解析运行时路径 |

**并且** 导出全局路径变量：
- `X4_UNPACKED_DATA_PATH`
- `OUTPUT_VERSION_DIR`
- `DEFAULT_MAP_DIR`, `DEFAULT_OUTPUT`, `DEFAULT_MAPDEFAULTS`
- `DEFAULT_GOD_XML`, `DEFAULT_FACTIONS_XML`, `DEFAULT_COLORS_XML`
- `DEFAULT_REGION_DEFINITIONS_XML`, `DEFAULT_REGIONOBJECTGROUPS_XML`, `DEFAULT_REGIONYIELDS_XML`
- `DEFAULT_FACTIONS_OUTPUT`, `DEFAULT_REGIONS_OUTPUT`, `DEFAULT_REGIONYIELDS_OUTPUT`
- `DEFAULT_REGIONYIELD_DEFINITIONS_OUTPUT`, `DEFAULT_RESOURCEAREAS_OUTPUT`

---

#### Scenario: utils/math_utils.py 模块

**当** 导入 `processor.utils.math_utils`

**那么** 提供以下函数：

| 函数 | 来源 | 描述 |
|------|------|------|
| `as_float(value, default)` | 原 L450 | 安全转换为 float |
| `as_number(value, default)` | 原 L691 | 安全转换为 number |
| `round_significant(value, sig_digits)` | 原 L454 | 四舍五入到指定有效数字 |
| `round_to_int(value)` | 原 L471 | 四舍五入到整数 |
| `round_sig(value, digits)` | 原 L704 | 四舍五入（别名的） |
| `pos_from(parent)` | 原 L476 | 获取 2D 坐标 (x, z) |
| `pos3d_from(parent)` | 原 L486 | 获取 3D 坐标 (x, y, z) |
| `vec_add(left, right)` | 原 L500 | 2D 向量加法 |
| `vec_add_3d(left, right)` | 原 L505 | 3D 向量加法 |
| `cluster_world_to_axial(pos)` | 原 L514 | 世界坐标转轴向坐标 |
| `axial_to_pixel_flat(q, r, size)` | 原 L520 | 轴向坐标转像素坐标 |
| `distance_3d(left, right)` | 原 L787 | 3D 距离计算 |
| `unit_vec(x, y)` | 原 L538 | 单位向量 |
| `rgb_to_hex(r, g, b)` | 原 L673 | RGB 转十六进制颜色 |

---

#### Scenario: utils/xml_utils.py 模块

**当** 导入 `processor.utils.xml_utils`

**那么** 提供以下函数：

| 函数 | 来源 | 描述 |
|------|------|------|
| `parse_xml(path)` | 原 L2523 | 解析 XML 文件 |
| `parse_xml_group(map_dir, suffix)` | 原 L2527 | 解析 XML 文件组 |
| `parse_xml_attrs(node)` | 原 L727 | 解析 XML 节点属性 |
| `parse_step_curve(node)` | 原 L731 | 解析 step 曲线 |
| `piecewise_average(steps, weighted_power)` | 原 L744 | 分段平均值计算 |

---

#### Scenario: utils/data_utils.py 模块

**当** 导入 `processor.utils.data_utils`

**那么** 提供以下函数：

| 函数 | 来源 | 描述 |
|------|------|------|
| `split_tags(tags)` | 原 L648 | 分割标签字符串 |
| `parse_select_tags(tags)` | 原 L654 | 解析选择标签 |
| `station_type_priority(station_type)` | 原 L664 | 站点类型优先级 |
| `station_tag_priority(tags)` | 原 L668 | 站点标签优先级 |
| `coerce_attr_value(value)` | 原 L677 | 强制转换属性值 |
| `round_sig(value, digits)` | 原 L704 | 四舍五入 |
| `classify_density_tier(ware, density)` | 原 L710 | 分类密度层级 |
| `normalize_noise_bound(value, default)` | 原 L723 | 标准化噪声边界 |

---

#### Scenario: utils/noise.py 模块

**当** 导入 `processor.utils.noise`

**那么** 提供：

| 名称 | 来源 | 描述 |
|------|------|------|
| `PerlinNoise3D` (类) | 原 L1223 | 3D Perlin 噪声生成器 |
| `build_noise_cdf(sample_count)` | 原 L1293 | 构建噪声累积分布函数 |
| `noise_probability(min_value, max_value)` | 原 L1310 | 计算噪声概率 |

---

#### Scenario: resource/model_detector.py 模块

**当** 导入 `processor.resource.model_detector`

**那么** 提供：

| 函数 | 来源 | 描述 |
|------|------|------|
| `detect_map_resource_model(version_str)` | 原 L131 | 检测资源模型类型 (regions vs resourceareas) |

---

#### Scenario: resource/modern_processor.py 模块 (9.0+)

**当** 导入 `processor.resource.modern_processor`

**那么** 提供以下函数：

| 函数 | 来源 | 描述 |
|------|------|------|
| `migrate_resourcearea_definitions(regionyields_xml_path)` | 原 L157 | 解析 9.0+ definition 节点 |
| `migrate_sector_resourceareas(mapdefaults_xml_path)` | 原 L248 | 解析 sector 的 resourceareas 引用 |
| `build_sector_resource_summaries_from_resourceareas(...)` | 原 L291 | 聚合 sector 级资源摘要 |
| `build_resourceareas_json_payload(flat_rows)` | 原 L366 | 构建 resourceareas JSON 负载 |
| `calculate_resourcearea_resources(...)` | 原 L2339 | 计算资源区资源 |

---

#### Scenario: resource/legacy_processor.py 模块 (8.0-)

**当** 导入 `processor.resource.legacy_processor`

**那么** 提供以下函数：

| 函数 | 来源 | 描述 |
|------|------|------|
| `migrate_regionyields(regionyields_xml_path)` | 原 L1378 | 迁移旧版 regionyields |
| `build_yield_level_map(regionyields_xml_path)` | 原 L1408 | 构建产率层级映射 |
| `build_yield_density_map(regionyields_xml_path)` | 原 L1424 | 构建产率密度映射 |
| `build_yield_info_map(regionyields_xml_path)` | 原 L1439 | 构建产率信息映射 |
| `load_region_object_groups(...)` | 原 L1464 | 加载区域对象组 |
| `parse_region_fields(...)` | 原 L1483 | 解析区域字段 |
| `parse_region_resources_node(...)` | 原 L1559 | 解析区域资源节点 |
| `build_region_legacy_resource_map(...)` | 原 L1589 | 构建旧版资源映射 |
| `summarize_region_resources(...)` | 原 L1619 | 汇总区域资源 |
| `summarize_region_resources_only(...)` | 原 L1814 | 仅汇总区域资源 |
| `summarize_region_fields_only(...)` | 原 L1907 | 仅汇总区域字段 |
| `migrate_region_definitions(...)` | 原 L2076 | 迁移区域定义 |
| `summarize_region_resources_simplified(...)` | 原 L2206 | 简化版区域资源汇总 |

---

#### Scenario: sector/parser.py 模块

**当** 导入 `processor.sector.parser`

**那么** 提供以下函数：

| 函数 | 来源 | 描述 |
|------|------|------|
| `load_mapdefaults(mapdefaults_xml)` | 原 L2488 | 加载 mapdefaults 配置 |
| `resolve_sector_macro_from_region_connection(connection_name)` | 原 L397 | 从 region connection 解析 sector macro |
| `resolve_sector_macro_from_region_ref(region_ref)` | 原 L408 | 从 region ref 解析 sector macro |
| `zone_connection_path_to_zone_macro(path)` | 原 L2531 | 从 zone connection path 解析 zone macro |

---

#### Scenario: sector/template.py 模块

**当** 导入 `processor.sector.template`

**那么** 提供以下函数：

| 函数 | 来源 | 描述 |
|------|------|------|
| `centered_local_positions(points)` | 原 L527 | 计算中心化的本地位置 |
| `template_positions_ratio(sector_count, variant)` | 原 L545 | 模板位置比例 |
| `best_slot_assignment(local_positions, slots)` | 原 L572 | 最佳槽位分配 |
| `choose_sector_template(local_positions)` | 原 L595 | 选择 sector 模板 |
| `sector_radius_ratio(sector_count)` | 原 L640 | sector 半径比例 |

---

#### Scenario: sector/resource_summary.py 模块

**当** 导入 `processor.sector.resource_summary`

**那么** 提供：

| 函数 | 来源 | 描述 |
|------|------|------|
| `summarize_sector_resources(region_rows)` | 原 L2451 | 汇总 sector 资源 |

---

#### Scenario: map/writer.py 模块

**当** 导入 `processor.map.writer`

**那么** 提供以下函数：

| 函数 | 来源 | 描述 |
|------|------|------|
| `write_map_output(payload, output_path)` | 原 L3476 | 写入地图输出文件 |
| `migrate_factions(...)` | 原 L1342 | 迁移派系数据 |
| `load_color_map_from_xml(colors_xml_path)` | 原 L1321 | 从 XML 加载颜色映射 |
| `build_boundary(node)` | 原 L859 | 构建边界定义 |
| `build_falloff(node)` | 原 L901 | 构建衰减定义 |
| `calculate_falloff_factors(falloff)` | 原 L943 | 计算衰减因子 |
| `calculate_spline_length(boundary)` | 原 L842 | 计算样条长度 |
| `boundary_volume(boundary)` | 原 L801 | 计算边界体积 |
| `is_gas_ware(ware)` | 原 L938 | 判断是否为气体物资 |
| `calculate_solid_volume_truncated(boundary)` | 原 L958 | 计算截断固体体积 |
| `generate_gas_block_coordinates(...)` | 原 L1011 | 生成气体块坐标 |
| `calculate_gas_block_count_truncated(...)` | 原 L1096 | 计算截断气体块数量 |

---

#### Scenario: map/generator.py 模块

**当** 导入 `processor.map.generator`

**那么** 提供：

| 函数 | 来源 | 描述 |
|------|------|------|
| `generate_map_data(...)` | 原 L2539 | 生成地图数据（核心函数，~930 行） |

**并且** 该函数依赖以下模块：
- `processor.utils.math_utils`
- `processor.utils.xml_utils`
- `processor.utils.data_utils`
- `processor.sector.parser`
- `processor.sector.template`
- `processor.resource.modern_processor` (9.0+)
- `processor.resource.legacy_processor` (8.0-)

---

#### Scenario: map/__init__.py 模块（入口）

**当** 导入 `processor.map`

**那么** 提供：

| 函数 | 来源 | 描述 |
|------|------|------|
| `run_for_config(args, effective_config)` | 原 L3500 | 运行指定配置的处理 |
| `main()` | 原 L3648 | CLI 入口点 |

---

### Requirement: 分拆原则

#### Scenario: 复制而非重写

**当** 迁移函数到新模块

**那么**：
1. 保持函数实现逻辑完全不变
2. 只调整 import 语句指向新模块
3. 保持函数签名（参数、返回值）不变
4. 保留原有注释和文档字符串

#### Scenario: 保留原文件

**当** 完成分拆后

**那么**：
1. `scripts/x4_data_map_processor.py` 保持原样不删除
2. 可用于 diff 对比验证输出一致性
3. 作为回滚参考点

#### Scenario: 输出一致性验证

**当** 运行新旧两个处理器

**那么**：
1. 使用相同的输入文件和参数
2. 对比输出的 JSON 文件
3. 所有输出必须逐字节相同（除可能的字典顺序外）

---

## REMOVED Requirements

无 - 本变更为纯重构，不删除任何功能。

---

## 函数迁移清单

### config.py (约 150 行)
- [ ] `apply_runtime_config`
- [ ] `default_version_item`
- [ ] `parse_args`
- [ ] `resolve_runtime_paths`
- [ ] 全局路径变量定义

### utils/math_utils.py (约 200 行)
- [ ] `as_float`, `as_number`
- [ ] `round_significant`, `round_to_int`, `round_sig`
- [ ] `pos_from`, `pos3d_from`
- [ ] `vec_add`, `vec_add_3d`
- [ ] `cluster_world_to_axial`, `axial_to_pixel_flat`
- [ ] `distance_3d`
- [ ] `unit_vec`
- [ ] `rgb_to_hex`

### utils/xml_utils.py (约 80 行)
- [ ] `parse_xml`, `parse_xml_group`
- [ ] `parse_xml_attrs`
- [ ] `parse_step_curve`
- [ ] `piecewise_average`

### utils/data_utils.py (约 150 行)
- [ ] `split_tags`, `parse_select_tags`
- [ ] `station_type_priority`, `station_tag_priority`
- [ ] `coerce_attr_value`
- [ ] `classify_density_tier`
- [ ] `normalize_noise_bound`

### utils/noise.py (约 120 行)
- [ ] `PerlinNoise3D` 类
- [ ] `build_noise_cdf`
- [ ] `noise_probability`

### resource/model_detector.py (约 30 行)
- [ ] `detect_map_resource_model`

### resource/modern_processor.py (约 400 行)
- [ ] `migrate_resourcearea_definitions`
- [ ] `migrate_sector_resourceareas`
- [ ] `build_sector_resource_summaries_from_resourceareas`
- [ ] `build_resourceareas_json_payload`
- [ ] `calculate_resourcearea_resources`

### resource/legacy_processor.py (约 800 行)
- [ ] `migrate_regionyields`
- [ ] `build_yield_*_map` 系列
- [ ] `summarize_region_resources*` 系列
- [ ] `migrate_region_definitions`
- [ ] `parse_region_fields`, `parse_region_resources_node`

### sector/parser.py (约 100 行)
- [ ] `load_mapdefaults`
- [ ] `resolve_sector_macro_from_*`
- [ ] `zone_connection_path_to_zone_macro`

### sector/template.py (约 200 行)
- [ ] `centered_local_positions`
- [ ] `template_positions_ratio`
- [ ] `best_slot_assignment`
- [ ] `choose_sector_template`
- [ ] `sector_radius_ratio`

### sector/resource_summary.py (约 50 行)
- [ ] `summarize_sector_resources`

### map/writer.py (约 600 行)
- [ ] `write_map_output`
- [ ] `migrate_factions`
- [ ] `load_color_map_from_xml`
- [ ] `build_boundary`, `build_falloff`
- [ ] `calculate_falloff_factors`
- [ ] `boundary_volume`
- [ ] 气体/固体体积计算函数

### map/generator.py (约 950 行)
- [ ] `generate_map_data`

### map/__init__.py (约 200 行)
- [ ] `run_for_config`
- [ ] `main`

---

## 依赖关系图

```
processor.map
├── processor.config
├── processor.utils.math_utils
├── processor.utils.xml_utils
├── processor.utils.data_utils
├── processor.utils.noise
├── processor.sector.parser
├── processor.sector.template
├── processor.sector.resource_summary
├── processor.resource.model_detector
├── processor.resource.modern_processor (9.0+)
└── processor.resource.legacy_processor (8.0-)
```
