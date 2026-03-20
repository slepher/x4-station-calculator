# 文档 - 代码对比分析报告

**对比对象：**
- **最终文档**: `openspec/changes/map-resource-processor/design.md`
- **代码实现**: `scripts/processor/` 目录下的代码实现

**分析日期**: 2026-03-18

---

## 1. 检查过的代码文件列表

| 文件路径 | 用途 | 状态 |
|----------|------|------|
| `scripts/processor/resource/model_detector.py` | 版本检测 | 已检查 |
| `scripts/processor/resource/legacy_processor.py` | 8.0- 旧版处理 | 已检查 |
| `scripts/processor/resource/modern_processor.py` | 9.0+ 新版处理 | 已检查 |
| `scripts/processor/map/service.py` | 统一服务入口 | 已检查 |
| `scripts/processor/map/generator.py` | Map 数据生成 | 已检查 |
| `scripts/processor/map/calculator.py` | 计算逻辑 | 已检查 |
| `scripts/processor/map/converter.py` | XML 转换 | 已检查 |
| `scripts/processor/map/constants.py` | 常量定义 | 已检查 |
| `scripts/processor/map/writer.py` | 输出写入 | 未找到（功能已移至 output_manager.py） |
| `scripts/processor/output_manager.py` | 输出管理器 | 已检查 |
| `scripts/processor/sector/resource_summary.py` | Sector 资源汇总 | 已检查 |

---

## 2. 代码有但文档未描述的内容

### 2.1 `scripts/processor/resource/legacy_processor.py`

#### 2.1.1 Yield 格式化函数

**代码位置**: `round_yield_value()` (line 13-23)

```python
def round_yield_value(value: float) -> int | float:
    """
    格式化 yield/respawn 值：
    - 如果整数部分大于 5 位（>= 100000），则取整
    - 如果整数部分小于等于 5 位，则保留 5 位有效数字（整数 + 小数）
    """
```

**差异说明**: 文档中未描述 yield/respawn 值的格式化规则。文档只提到了计算公式，但未说明输出时的精度处理。

**重要性**: 中 - 影响输出数据的一致性和可预测性

---

#### 2.1.2 Field 相关处理函数

**代码位置**: `parse_region_fields()`, `summarize_region_fields_only()` (line 142-213, 520-655)

**差异说明**:
- 文档 1.4.2 中提到 regions.json 包含 `resources` 数组，但未详细说明 `<fields>` 节点（asteroid/debris/nebula）的解析逻辑
- 代码中有完整的 field 解析和计算逻辑，包括 `densityfactor`, `minnoisevalue`, `maxnoisevalue`, `resourcepercentage` 等字段
- 文档提到"使用 densityfactor"但描述不完整

**重要性**: 高 - 这是 8.0 版本资源计算的核心逻辑之一

---

#### 2.1.3 `regionobjectgroups` 加载

**代码位置**: `load_region_object_groups()` (line 122-139)

```python
def load_region_object_groups(
    regionobjectgroups_xml_path: Path,
) -> Dict[str, dict]:
    """加载区域对象组。"""
```

**差异说明**: 文档在 1.1 数据来源表中未列出 `regionobjectgroups_final.xml` 文件，但代码中该文件用于解析 field 的 groupref 引用。

**重要性**: 中 - 这是 field 解析的必要依赖

---

#### 2.1.4 多种资源计算模式

**代码位置**: `summarize_region_resources()`, `summarize_region_resources_only()`, `summarize_region_resources_simplified()` (line 277-517, 757-847)

**差异说明**: 代码中存在三套不同的资源计算函数：
1. `summarize_region_resources()` - 使用 field 数据
2. `summarize_region_resources_only()` - 仅使用 `<resources>` 节点
3. `summarize_region_resources_simplified()` - 简化版新算法

文档中只描述了统一公式 `yield = base × falloff × resourcedensity`，但未说明这些不同计算模式的存在和使用场景。

**重要性**: 中 - 影响对代码逻辑的理解

---

### 2.2 `scripts/processor/map/generator.py`

#### 2.2.1 `aggregate_sector_resources_from_resourceareas()` 函数

**代码位置**: line 430-468

**差异说明**: 这是 9.0+ 版本中用于从 resourceareas_rows 聚合 sector.resources 的函数，但文档 2.3.2 中描述的是 `build_sector_resource_summaries_from_resourceareas()`（在 modern_processor.py 中）。

代码中存在两套不同的聚合逻辑：
- `generator.py:aggregate_sector_resources_from_resourceareas()` - 从已计算的 resourceareas_rows 聚合
- `modern_processor.py:build_sector_resource_summaries_from_resourceareas()` - 直接从 definitions 和 sector_resource_areas 计算

**重要性**: 高 - 这是 9.0+ 版本的核心聚合逻辑，两套函数的存在可能导致混淆

---

#### 2.2.2 Station Owner 解析逻辑

**代码位置**: line 826-900+（station 处理部分）

```python
sector_stations: Dict[str, List[dict]] = defaultdict(list)
if god_xml_path and god_xml_path.exists():
    god_root = parse_xml(god_xml_path)
    # ... station 解析逻辑
```

**差异说明**: 文档完全未提及 station 数据的处理逻辑，包括：
- 从 `god_final.xml` 解析 station 数据
- Station owner 决议逻辑
- `owner_resolution_ties`（所有权决议平局）的处理

**重要性**: 高 - 这是 sector owner 颜色和内容的关键来源

---

#### 2.2.3 Zone Highway 和 Sector Highway 处理

**代码位置**: line 219-241 (zonehighways), line 388-425 (sector highways)

**差异说明**: 文档中未描述 highway 数据的解析和处理逻辑，包括：
- `zonehighways.xml` 和 `sechighways.xml` 的解析
- Highway spline 的处理
- Highway 的 entry_pos/exit_pos 计算

**重要性**: 中 - 这是 Map 可视化的重要组成部分

---

#### 2.2.4 Sector 模板和归一化

**代码位置**: line 748-771

```python
for cluster_id, sector_ids in cluster_to_sectors.items():
    local_positions = {sector_id: sectors[sector_id]["raw_local_pos"] for sector_id in sector_ids}
    template_kind, slot_map, slot_positions = choose_sector_template(local_positions)
    # ... sector 归一化计算
```

**差异说明**: 文档未描述：
- Sector 模板选择逻辑（`choose_sector_template()`）
- Sector 半径比率计算（`sector_radius_ratio()`）
- 归一化坐标转换（`normalized` 字段）

**重要性**: 中 - 影响前端 Map 渲染

---

#### 2.2.5 `resourceareas_rows` 数据结构差异

**代码位置**: line 526-532（9.0+）, line 608-676（8.0）

**8.0 版本代码实际输出**:
```python
resourceareas_rows.append({
    "ref": region_ref,
    "amount": amount,
    "resources": [...],  # 包含详细资源计算结果
    "cluster_id": cluster_id,
    "sector_id": sector_id,
    "boundary": {...},  # 包含完整 boundary 数据
    "volume_km3": ...,  # 有效体积
    "falloff_factor": ...,
    "lateral_factor": ...,
    "radial_factor": ...,
    "blocks": ...,  # 气体方块数
    "total_blocks": ...,
})
```

**文档 1.4.3 描述的结构**:
```json
{
    "cluster_id": "Cluster_01_macro",
    "sector_id": "Cluster_01_Sector001_macro",
    "areas": [
        {
            "ref": "region_ore_medium_01",
            "amount": 3,
            "ware": "ore",
            "rating": 10,
            "yield": 150000,
            "delay": 30.0,
            "factor": 1,
            "respawn": 300000
        }
    ]
}
```

**差异说明**:
1. 代码输出的是扁平数组（每个 resourcearea 一条记录），文档描述的是分组结构（按 cluster_id + sector_id 分组）
2. 代码输出包含额外的计算字段（boundary, volume_km3, falloff_factor, blocks 等），文档中未描述这些字段
3. 代码输出中每个 resourcearea 有完整的 `resources` 数组，而文档中 `areas[].ware` 是单一值

**重要性**: 高 - 这是核心输出数据结构，差异影响前端数据消费

---

### 2.3 `scripts/processor/map/calculator.py`

#### 2.3.1 `generate_gas_block_coordinates()` 函数

**代码位置**: line 156-238

```python
def generate_gas_block_coordinates(
    region_pos: Dict[str, float],
    boundary: dict,
) -> Tuple[List[Tuple[int, int, int]], List[Tuple[int, int, int]]]:
    """
    生成气体资源命中的 64km³ 方块坐标列表

    方块是 64×64×64km 的立方体，判断命中需要检查方块是否与圆柱体相交。
    使用方块中心到圆柱中心的距离 <= (radius + 方块半宽) 来判断。
    """
```

**差异说明**: 文档 1.3.4 描述了气体 Block 算法的两步截断流程，但未详细说明：
- 方块命中的几何判断算法（距离检查）
- `effective_radius = radius + block_half` 的碰撞检测优化
- Y 轴重叠检查的具体实现

**重要性**: 中 - 算法细节补充

---

#### 2.3.2 常量定义

**代码位置**: `scripts/processor/map/constants.py`

```python
SOLID_XZ_LIMIT = 256_000       # 256 km
SOLID_Y_LIMIT = 96_000         # 96 km (总高度 192km)
GAS_XZ_LIMIT = 256_000         # 256 km
GAS_Y_LIMIT = 64_000           # 64 km (总高度 128km)
GAS_BLOCK_SIZE = 64_000        # 64 km 立方体网格
```

**差异说明**: 文档 1.3.2 截断算法表中描述了这些限制，但未明确说明这些常量在代码中的组织方式。

**重要性**: 低 - 文档已覆盖数值，代码组织形式不影响功能

---

### 2.4 `scripts/processor/output_manager.py`

#### 2.4.1 `write_all_map_outputs()` 批量写入函数

**代码位置**: line 106-166

**差异说明**: 文档未提及这个批量写入函数，它提供了统一的输出接口。

**重要性**: 低 - 纯工具函数

---

### 2.5 `scripts/processor/sector/resource_summary.py`

#### 2.5.1 `summarize_sector_resources()` 计算方式

**代码位置**: line 20-54

```python
def summarize_sector_resources(region_rows: List[dict]) -> List[dict]:
    """
    总结 sector 的资源产出，输出统一的 resources 格式。

    计算方式（与 9.0 统一）：
    - amount = sum(yield) - yield 已经是总量（density × volume_km3）
    - respawn = sum(respawn) - respawn 已经是每小时总回复量（respawn_density × volume_km3）
    """
```

**差异说明**: 文档 1.4.4 中描述的计算方式是：
```
amount = Σ(yield × amount)
respawn = Σ(respawn × amount)
```

但代码中的注释说明 `yield` 和 `respawn` 已经是总量（每个 region 实例的 yield 已乘以 amount），所以直接求和即可。

**重要性**: 中 - 计算逻辑的关键细节

---

## 3. 文档有但代码未实现/不同的内容

### 3.1 Rating 映射表

**文档位置**: 1.3.5 Rating 映射表 (line 225-259)

**文档内容**: 详细的 yield 范围到 rating 的映射表（普通矿物和 Nividium 两套）

**代码状态**:
- 在 `legacy_processor.py` 中未找到 `calculate_rating()` 或类似的 rating 计算函数
- `build_region_legacy_resource_map()` (line 246-274) 中从 `yield_level_map` 获取 level，但未使用文档中的映射表
- Rating 计算逻辑可能在其他地方或已移除

**重要性**: 高 - 如果 rating 计算逻辑缺失，会影响资源评级功能

---

### 3.2 `regionyields.json` 输出结构

**文档位置**: 1.4.1 (line 263-293)

**文档描述**:
```json
{
    "ware": "helium",
    "color": "#ff0000",
    "yields": [
        {
            "name": "lowest",
            "resourcedensity": 300,
            "replenishtime": 180,
            "gatherspeedfactor": 1.0
        }
    ]
}
```

**代码实现**: `migrate_regionyields()` (line 35-63)

```python
resource_item = {
    "ware": ware,
    "color": rgb_to_hex(effect_r, effect_g, effect_b),
    "yields": [],
}
for yield_node in resource_node.findall("./yield[@name]"):
    yield_item: Dict[str, object] = {}
    for key, value in yield_node.attrib.items():
        yield_item[key] = coerce_attr_value(value)
    # 添加 density 作为 resourcedensity 的别名
    if "resourcedensity" in yield_item:
        yield_item["density"] = yield_item["resourcedensity"]
    resource_item["yields"].append(yield_item)
```

**差异说明**:
- 代码中添加了 `density` 字段作为 `resourcedensity` 的别名，文档中未提及
- 代码保留 XML 中所有属性，文档只列出特定字段

**重要性**: 低 - 向后兼容的别名字段

---

### 3.3 `regions.json` 输出结构

**文档位置**: 1.4.2 (line 294-342)

**文档描述的字段**:
- `falloff.effective_factor` - 总 falloff

**代码实现**: `migrate_region_definitions()` (line 658-754)

```python
region_item["falloff_factor"] = round(as_number(falloff.get("effective_factor"), 1.0), 4)
```

**差异说明**: 代码中外层有 `falloff_factor` 字段，同时 `falloff` 对象内部也有 `effective_factor`。文档只描述了内部字段。

**重要性**: 低 - 冗余字段

---

### 3.4 9.0+ `regionyields.json` 空数组策略

**文档位置**: 2.4.4 (line 596-602)

**文档描述**: "9.0+ 版本写入空数组占位，保持前端加载链路兼容。"

**代码实现**: `scripts/processor/map/service.py` line 114-115

```python
# 9.0+ 不生成 regionyields，写入空数组
write_regionyields([], regionyields_output_path)
print(f"📦 Regionyields Output: {regionyields_output_path} (空数组占位)")
```

**差异说明**: 代码和文档一致，已正确实现。

**重要性**: 无 - 已正确实现

---

### 3.5 9.0+ `regionyield_definitions.json` 字段

**文档位置**: 2.4.1 (line 497-536)

**文档描述**: `gatherspeedfactor` 字段仅用于气体资源

**代码实现**: `migrate_resourcearea_definitions()` (line 69-71, 114-117)

```python
objectyieldfactor = as_float(def_node.get("objectyieldfactor"), None)
gatherspeedfactor = as_float(def_node.get("gatherspeedfactor"), None)
# ...
if objectyieldfactor is not None:
    definition["objectyieldfactor"] = objectyieldfactor
if gatherspeedfactor is not None:
    definition["gatherspeedfactor"] = gatherspeedfactor
```

**差异说明**: 代码中对两个字段的处理是独立的，根据 XML 中是否存在来决定是否添加。文档中未说明这些字段是可选的。

**重要性**: 低 - 字段存在性处理

---

### 3.6 9.0+ `resourceareas.json` 结构

**文档位置**: 2.4.3 (line 538-573)

**文档描述**:
```json
{
    "cluster_id": "Cluster_01_macro",
    "sector_id": "Cluster_01_Sector001_macro",
    "areas": [
        {
            "ref": "sphere_medium_hydrogen_medium",
            "amount": 7,
            "ware": "hydrogen",
            "rating": 10.0,
            "yield": 150000.0,
            "delay": 60.0,
            "factor": 1.0,
            "respawn": 150000.0
        }
    ]
}
```

**代码实现**: `generator.py` line 526-532

```python
resourceareas_rows.append({
    "ref": ref,
    "amount": amount,
    "resources": area_resources,  # 包含完整的 resources 数组
    "cluster_id": cluster_id,
    "sector_id": sector_key,
})
```

**差异说明**:
1. 代码输出是扁平数组，文档描述的是分组结构（含 `areas` 数组）
2. 代码输出包含 `resources` 数组而非扁平的 `ware/yield/delay` 等字段
3. 缺少 `rating` 和 `factor` 字段（在 `resources` 数组内部）

**重要性**: 高 - 核心输出结构不匹配

---

### 3.7 `maps.json` sector.resources 字段

**文档位置**: 1.4.4 (line 382-412), 2.4.3 (line 574-594)

**文档描述 (8.0)**:
```json
{
    "ware": "ore",
    "amount": 450000,
    "respawn": 900000
}
```

**文档描述 (9.0+)**:
```json
{
    "ware": "hydrogen",
    "amount": 1050000.0,
    "respawn": 1050000.0
}
```

**代码实现 (8.0)**: `sector/resource_summary.py` line 49-53

```python
summarized.append({
    "ware": ware,
    "amount": int(round(entry["amount"])),
    "respawn": int(round(entry["respawn"])),
})
```

**代码实现 (9.0+)**: `generator.py` line 535-544

```python
sector_resources_list = [
    {
        "ware": entry["ware"],
        "yield": round_to_int(entry["yield"]),
        "respawn": round_to_int(entry["respawn"]),
    }
    for entry in sorted(sector_resources_map.values(), key=lambda x: x["ware"])
]
```

**差异说明**:
- 9.0+ 代码输出使用 `yield` 字段名，文档描述为 `amount`
- 字段名不一致可能导致前端解析错误

**重要性**: 高 - 字段名不匹配

---

## 4. 总结

### 4.1 主要差异概览

| 类别 | 数量 | 高优先级 | 中优先级 | 低优先级 |
|------|------|----------|----------|----------|
| 代码有但文档未描述 | 12 | 4 | 5 | 3 |
| 文档有但代码未实现/不同 | 7 | 3 | 1 | 3 |

### 4.2 高优先级差异（需要修复）

1. **`resourceareas.json` 数据结构不匹配** - 代码输出扁平数组，文档描述分组结构
2. **`maps.json` sector.resources 字段名不一致** - 9.0+ 代码使用 `yield`，文档描述为 `amount`
3. **Station Owner 解析逻辑** - 文档完全未提及
4. **Rating 映射表** - 代码中可能未实现文档描述的映射逻辑
5. **Field 处理逻辑** - 文档描述不完整
6. **两套聚合函数** - `aggregate_sector_resources_from_resourceareas()` vs `build_sector_resource_summaries_from_resourceareas()`

### 4.3 建议

1. **更新文档**：补充代码中实际存在的输出字段和数据结构
2. **统一结构**：考虑使用 `build_resourceareas_json_payload()` 将扁平数组转换为文档描述的分组结构
3. **字段名对齐**：统一 8.0/9.0+ 的 `sector.resources` 字段名（`amount` vs `yield`）
4. **补充文档**：添加 station 处理、highway 处理、sector 归一化等章节
5. **验证 Rating**：确认 rating 计算逻辑的实现位置或补充实现

---

## 5. 附录：实际输出结构参考

### 5.1 8.0 `resourceareas.json` 实际输出（代码）

```json
[
  {
    "ref": "region_ore_medium_01",
    "amount": 3,
    "cluster_id": "Cluster_01_macro",
    "sector_id": "Cluster_01_Sector001_macro",
    "boundary": {
      "class": "cylinder",
      "size": { "r": 25000, "linear": 5000 }
    },
    "volume_km3": 125,
    "falloff_factor": 0.567,
    "lateral_factor": 0.9,
    "radial_factor": 0.63,
    "resources": [
      {
        "ware": "ore",
        "resourcedensity": 1.0,
        "total_yield": 150000,
        "total_respawn": 300000,
        "yield": 100000,
        "respawn": 200000,
        "delay": 30.0,
        "gatherfactor": 1.0,
        "density": 800.0,
        "respawn_density": 1600.0
      }
    ]
  }
]
```

### 5.2 9.0+ `resourceareas.json` 实际输出（代码）

```json
[
  {
    "ref": "sphere_medium_hydrogen_medium",
    "amount": 7,
    "cluster_id": "Cluster_01_macro",
    "sector_id": "Cluster_01_Sector001_macro",
    "resources": [
      {
        "ware": "hydrogen",
        "yield": 1050000,
        "respawn": 1050000,
        "delay": 60.0,
        "gatherfactor": 1.0,
        "rating": 10.0
      }
    ]
  }
]
```
