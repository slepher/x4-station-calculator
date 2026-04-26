# Refactory Map Processor Tasks

## Purpose

定义 `refactory-map-processor` 变更的实施任务列表。

---

## 任务列表

### 任务 1：创建目录结构

**描述**：创建 `processor` 包的目录结构

**步骤**：
1. 创建目录 `scripts/processor/utils`
2. 创建目录 `scripts/processor/resource`
3. 创建目录 `scripts/processor/sector`
4. 创建目录 `scripts/processor/map`
5. 为每个目录创建 `__init__.py` 文件

**验收**：
- [ ] 所有目录存在
- [ ] 所有 `__init__.py` 文件存在

---

### 任务 2：迁移 utils/math_utils.py

**描述**：将数学工具函数迁移到 `utils/math_utils.py`

**来源函数**（从 `x4_data_map_processor.py` 行号）：
- `as_float` (L450)
- `as_number` (L691)
- `round_significant` (L454)
- `round_to_int` (L471)
- `round_sig` (L704)
- `pos_from` (L476)
- `pos3d_from` (L486)
- `vec_add` (L500)
- `vec_add_3d` (L505)
- `cluster_world_to_axial` (L514)
- `axial_to_pixel_flat` (L520)
- `distance_3d` (L787)
- `unit_vec` (L538)
- `rgb_to_hex` (L673)

**验收**：
- [ ] 所有函数已复制
- [ ] 添加模块级文档字符串
- [ ] `from processor.utils.math_utils import *` 可正常导入

---

### 任务 3：迁移 utils/xml_utils.py

**描述**：将 XML 解析工具迁移到 `utils/xml_utils.py`

**来源函数**：
- `parse_xml` (L2523)
- `parse_xml_group` (L2527)
- `parse_xml_attrs` (L727)
- `parse_step_curve` (L731)
- `piecewise_average` (L744)

**验收**：
- [ ] 所有函数已复制
- [ ] `from processor.utils.xml_utils import *` 可正常导入

---

### 任务 4：迁移 utils/data_utils.py

**描述**：将数据工具函数迁移到 `utils/data_utils.py`

**来源函数**：
- `split_tags` (L648)
- `parse_select_tags` (L654)
- `station_type_priority` (L664)
- `station_tag_priority` (L668)
- `coerce_attr_value` (L677)
- `classify_density_tier` (L710)
- `normalize_noise_bound` (L723)

**验收**：
- [ ] 所有函数已复制
- [ ] `from processor.utils.data_utils import *` 可正常导入

---

### 任务 5：迁移 utils/noise.py

**描述**：将 Perlin 噪声相关迁移到 `utils/noise.py`

**来源**：
- `PerlinNoise3D` 类 (L1223)
- `build_noise_cdf` (L1293)
- `noise_probability` (L1310)

**验收**：
- [ ] 类和函数已复制
- [ ] `from processor.utils.noise import PerlinNoise3D` 可正常导入

---

### 任务 6：迁移 config.py

**描述**：将配置管理迁移到 `config.py`

**来源**：
- 全局变量定义 (L19-L55)
- `apply_runtime_config` (L39)
- `default_version_item` (L75)
- `parse_args` (L427)
- `resolve_runtime_paths` (L3481)

**验收**：
- [ ] 全局变量已定义
- [ ] 所有函数已复制
- [ ] `from processor.config import *` 可正常导入

---

### 任务 7：迁移 resource/model_detector.py

**描述**：将资源模型检测迁移到 `resource/model_detector.py`

**来源**：
- `detect_map_resource_model` (L131)

**验收**：
- [ ] 函数已复制
- [ ] `from processor.resource.model_detector import detect_map_resource_model` 可正常导入

---

### 任务 8：迁移 resource/modern_processor.py

**描述**：将 9.0+ 资源处理迁移到 `resource/modern_processor.py`

**来源函数**：
- `migrate_resourcearea_definitions` (L157)
- `migrate_sector_resourceareas` (L248)
- `build_sector_resource_summaries_from_resourceareas` (L291)
- `build_resourceareas_json_payload` (L366)
- `calculate_resourcearea_resources` (L2339)

**验收**：
- [ ] 所有函数已复制
- [ ] 导入语句已更新
- [ ] `from processor.resource.modern_processor import *` 可正常导入

---

### 任务 9：迁移 resource/legacy_processor.py

**描述**：将 8.0-资源处理迁移到 `resource/legacy_processor.py`

**来源函数**：
- `migrate_regionyields` (L1378)
- `build_yield_level_map` (L1408)
- `build_yield_density_map` (L1424)
- `build_yield_info_map` (L1439)
- `load_region_object_groups` (L1464)
- `parse_region_fields` (L1483)
- `parse_region_resources_node` (L1559)
- `build_region_legacy_resource_map` (L1589)
- `summarize_region_resources` (L1619)
- `summarize_region_resources_only` (L1814)
- `summarize_region_fields_only` (L1907)
- `migrate_region_definitions` (L2076)
- `summarize_region_resources_simplified` (L2206)

**验收**：
- [ ] 所有函数已复制
- [ ] 导入语句已更新
- [ ] `from processor.resource.legacy_processor import *` 可正常导入

---

### 任务 10：迁移 sector/parser.py

**描述**：将 Sector 解析迁移到 `sector/parser.py`

**来源函数**：
- `load_mapdefaults` (L2488)
- `resolve_sector_macro_from_region_connection` (L397)
- `resolve_sector_macro_from_region_ref` (L408)
- `zone_connection_path_to_zone_macro` (L2531)

**验收**：
- [ ] 所有函数已复制
- [ ] `from processor.sector.parser import *` 可正常导入

---

### 任务 11：迁移 sector/template.py

**描述**：将 Sector 模板计算迁移到 `sector/template.py`

**来源函数**：
- `centered_local_positions` (L527)
- `template_positions_ratio` (L545)
- `best_slot_assignment` (L572)
- `choose_sector_template` (L595)
- `sector_radius_ratio` (L640)

**验收**：
- [ ] 所有函数已复制
- [ ] `from processor.sector.template import *` 可正常导入

---

### 任务 12：迁移 sector/resource_summary.py

**描述**：将 Sector 资源汇总迁移到 `sector/resource_summary.py`

**来源函数**：
- `summarize_sector_resources` (L2451)

**验收**：
- [ ] 函数已复制
- [ ] `from processor.sector.resource_summary import summarize_sector_resources` 可正常导入

---

### 任务 13：迁移 map/writer.py

**描述**：将输出写入相关函数迁移到 `map/writer.py`

**来源函数**：
- `write_map_output` (L3476)
- `migrate_factions` (L1342)
- `load_color_map_from_xml` (L1321)
- `build_boundary` (L859)
- `build_falloff` (L901)
- `calculate_falloff_factors` (L943)
- `calculate_spline_length` (L842)
- `boundary_volume` (L801)
- `is_gas_ware` (L938)
- `calculate_solid_volume_truncated` (L958)
- `generate_gas_block_coordinates` (L1011)
- `calculate_gas_block_count_truncated` (L1096)

**验收**：
- [ ] 所有函数已复制
- [ ] 导入语句已更新为从 `processor.utils.*` 导入
- [ ] `from processor.map.writer import *` 可正常导入

---

### 任务 14：迁移 map/generator.py

**描述**：将核心地图生成函数迁移到 `map/generator.py`

**来源函数**：
- `generate_map_data` (L2539，约 930 行)

**依赖**：需要更新导入语句使用：
- `processor.utils.math_utils`
- `processor.utils.xml_utils`
- `processor.utils.data_utils`
- `processor.sector.parser`
- `processor.sector.template`
- `processor.resource.modern_processor`
- `processor.resource.legacy_processor`

**验收**：
- [ ] 函数已复制
- [ ] 所有导入语句已更新
- [ ] `from processor.map.generator import generate_map_data` 可正常导入

---

### 任务 15：迁移 map/__init__.py（入口）

**描述**：将入口函数迁移到 `map/__init__.py`

**来源函数**：
- `run_for_config` (L3500)
- `main` (L3648)

**验收**：
- [ ] 所有函数已复制
- [ ] 导入语句已更新
- [ ] `python scripts/processor/map --help` 可运行

---

### 任务 16：更新所有 __init__.py 导出

**描述**：为每个子包添加 `__all__` 导出列表

**文件**：
- `processor/__init__.py`
- `processor/utils/__init__.py`
- `processor/resource/__init__.py`
- `processor/sector/__init__.py`
- `processor/map/__init__.py`

**验收**：
- [ ] 所有 `__init__.py` 包含 `__all__` 列表
- [ ] 导入测试通过

---

### 任务 17：保留原文件

**描述**：确保 `x4_data_map_processor.py` 未被修改

**验收**：
- [ ] 原文件未被删除
- [ ] 原文件未被修改
- [ ] 可用于 diff 对比

---

### 任务 18：输出一致性验证

**描述**：对比新旧处理器输出

**步骤**：
1. 运行原处理器：`python scripts/x4_data_map_processor.py --version 8.0 --output /tmp/old_maps.json`
2. 运行新处理器：`python scripts/processor/map --version 8.0 --output /tmp/new_maps.json`
3. 对比输出：`diff /tmp/old_maps.json /tmp/new_maps.json`

**验收**：
- [ ] 8.0 版本输出一致
- [ ] 9.0 版本输出一致（如适用）
- [ ] 所有辅助输出文件一致（factions.json, regions.json 等）

---

### 任务 19：构建验证

**描述**：确保项目可正常构建

**步骤**：
1. 运行 `npm run build`
2. 如有错误，修复导入问题
3. 重新构建直到成功

**验收**：
- [ ] `npm run build` 成功
- [ ] 无 TypeScript 错误

---

## 任务依赖关系

```
任务 1 (目录结构)
    │
    ├──→ 任务 2-6 (基础模块) ──→ 任务 7-12 (业务模块) ──→ 任务 14-15 (入口)
    │                                                              │
    └──────────────────────────────────────────────────────────────┘
                                    │
                                    → 任务 16 (导出) → 任务 18 (验证) → 任务 19 (构建)
```

---

## 完成标准

- [ ] 所有 19 个任务完成
- [ ] 新处理器可正常运行
- [ ] 输出与原处理器一致
- [ ] 构建成功
