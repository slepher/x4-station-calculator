# map-resource-processor 设计说明

> **文档范围**: 本文档仅描述 **resource 资源处理** 相关逻辑，不涉及 station、highway、sector 归一化等 Map 其他模块。

## 设计目标

基于当前 `scripts/processor` 中 resource 处理代码的实现，整理出完整的 resource 处理文档，包括：

1. 两个版本（8.0 regions / 9.0+ resourceareas）的处理逻辑分叉
2. 完整的数据流和算法说明
3. 输出数据结构定义

---

## 架构概述

### 版本分叉点

资源模型的分流在 `processor/resource/model_detector.py` 中根据游戏版本号判定：

```python
def detect_map_resource_model(version_str: str) -> str:
    """
    根据游戏版本号判定资源模型类型。
    规则：主版本号 < 9 使用 'regions' 模型，>= 9 使用 'resourceareas' 模型。
    """
    if not version_str:
        return "regions"
    match = re.match(r"(\d+)", str(version_str))
    if not match:
        return "regions"
    major_version = int(match.group(1))
    return "resourceareas" if major_version >= 9 else "regions"
```

### 模块结构

```
scripts/processor/
├── resource/
│   ├── __init__.py           # 模块导出
│   ├── model_detector.py     # 版本判定
│   ├── modern_processor.py   # 9.0+ 新版处理
│   └── legacy_processor.py   # 8.0- 旧版处理
├── map/
│   ├── service.py            # 统一服务入口
│   ├── generator.py          # Map 数据生成
│   ├── writer.py             # 输出写入
│   ├── calculator.py         # 计算逻辑
│   └── constants.py          # 常量定义
├── sector/
│   ├── resource_summary.py   # Sector 资源汇总
│   └── parser.py             # Sector 解析
└── output_manager.py         # 输出管理器
```

---

## 1. Region 处理 (8.0 版本)

### 1.1 数据来源

| 文件 | 用途 |
|------|------|
| `regionyields_final.xml` | 资源 yield 定义（颜色、产量等级） |
| `region_definitions_final.xml` | Region 定义（boundary, falloff, resources） |
| `mapdefaults_final.xml` | Sector 对 region 的引用关系 |

### 1.2 处理流程

```
regionyields_final.xml
    │
    ▼
migrate_regionyields()
    │
    ├─► regionyields.json (资源颜色和 yield 定义)
    │
    └─► build_yield_info_map()
            │
            ▼
            yield_info_map[ware][yield_name] = {
                resourcedensity,
                replenishtime,
                gatherspeedfactor
            }

region_definitions_final.xml
    │
    ▼
migrate_region_definitions()
    │
    ├─► regions.json (region 模板定义)
    │   ├── id
    │   ├── boundary (class, size, spline)
    │   ├── falloff (lateral, radial 曲线)
    │   ├── volume_km3
    │   └── resources[] (ware, resourcedensity, delay, gatherfactor, yield_name)
    │
    └─► region_calc_data (计算用中间数据)
            ├── boundary, falloff
            └── volume_km3, falloff_factor

mapdefaults_final.xml
    │
    ▼
resolve_sector_macro_from_region_ref()
    │
    └─► sector → region ref 映射

最终聚合
    │
    ├─► resourceareas.json (region 到 sector 的引用)
    │   └── cluster_id, sector_id, areas[].ref/amount/resources
    │
    └─► maps.json (sector 级资源聚合)
        └── sectors[].resources[] (ware, yield, respawn)
```

### 1.3 核心算法

#### 1.3.1 Yield 计算链路（8.0 版本）

**统一公式：**
```
yield = base × falloff × resourcedensity
```

| 资源类型 | base |
|----------|------|
| **固体** | 宏观总量收束后等价为体积项（见下文固体总量算法） |
| **气体** | 有效方块数量 |

**Falloff 计算：**
```
falloff = lateral_factor × radial_factor
```

- `lateral_factor`: 横向 falloff 一元计算（平均值）
- `radial_factor`: 径向 falloff 一元计算（加权平均值）

**固体总量算法（最终保留口径）：**
```
solid_yield ≈ volume_km3 × falloff × resourcedensity
```

说明：
- 这是固体资源的宏观期望总量收束式，作为最终固体总量算法保留。
- 这里的 `falloff` 指 region 实例的平均 falloff 系数。
- `resourcedensity` 是 region 资源定义中的目标资源密度。
- `AvgNoise` 不应再额外乘一次；它已经通过 `sum_weights -> per_field_value -> writeback -> contribution` 这条归一化链被吸收。
- `per_field_value` 在所有当前已确认的 writeback 分支中都只是在线性搬运同一个缩放系数；无论落在 `resourcepercentage`、`yield`，还是 `resourcepercentage_floor` 分支做等比例重分配，宏观总量都保持这条收束关系。
- 这是整片矿区的宏观期望总量，不是单个 `64k area` 或单次实例化的严格值。

**总量计算：**
```
// 单个 region 实例的产量（未经 amount 乘法）
yield = base_effective × falloff × resourcedensity
respawn = yield × 60 / replenishtime

// 单个 region 实例的原始产量（未经 amount 乘法，用于评级参考）
total_yield = base_full × falloff × resourcedensity
total_respawn = total_yield × 60 / replenishtime

// Sector 聚合时才乘以 amount
sector_yield = Σ(yield × amount)
sector_respawn = Σ(respawn × amount)
```

**参数说明：**
- `resourcedensity`: 资源密度（从 regionyields 的 yield 定义）
- `replenishtime` 单位是**分钟**
- `× 60` 转换为每小时
- `base_effective`: 对气体是截断后的有效方块数；对固体在最终口径下等价吸收到 `volume_km3`
- `base_full`: 原始完整体积（固体）或 原始命中方块数（气体），不考虑截断限制
- `total_yield/total_respawn`: 未经截断的基准值（用于评级参考）
- `yield/respawn`: resourceareas.json 中每个 region 实例的产量（**未经 amount 乘法**）
- `amount`: region 实例数量，在 sector 资源聚合时才应用

#### 1.3.2 截断算法

**适用范围：仅固体资源**

| 形状 | 截断规则 |
|------|----------|
| **Sphere / Cylinder** | 体积上限限制：最大体积为 512km × 512km × 192km 的等效长方体体积 |
| **Splinetube** | 截断中心曲线（spline）超出范围的部分，然后计算等效体积 |

**固体截断范围（Splinetube 适用）：**

| 维度 | 截断范围 |
|------|----------|
| X/Z 平面 | `[-256km, +256km]` |
| Y 轴（高度） | `[-96km, +96km]`（总高度 192km） |

**气体截断范围（仅用于 Block 中心过滤）：**

| 维度 | 截断范围 |
|------|----------|
| X/Z 平面 | `[-256km, +256km]` |
| Y 轴（高度） | `[-64km, +64km]`（总高度 128km） |

#### 1.3.3 气体资源 Block 算法

**两步截断流程：**

1. **原始 Block 命中（不考虑截断）**
   - 将 sector 空间划分为 64km × 64km × 64km 的立方体网格
   - 根据 region 形状和位置，判断命中哪些方块
   - 原始 block 数量可能超过 243 个（如果 region 延伸到截断范围外）

2. **截断过滤（仅针对已命中的 block）**
   - 对方块中心应用截断范围过滤
   - 只保留方块中心在以下范围内的 block：
     - X 轴：`[-256km, +256km]`
     - Z 轴：`[-256km, +256km]`
     - Y 轴：`[-64km, +64km]`

**方块命中判断算法：**

```python
# 代码位置：scripts/processor/map/calculator.py:generate_gas_block_coordinates()

def generate_gas_block_coordinates(
    region_pos: Dict[str, float],  # region 世界坐标
    boundary: dict,                 # region 边界定义
) -> Tuple[List[Tuple[int, int, int]], List[Tuple[int, int, int]]]:
    """
    生成气体资源命中的 64km³ 方块坐标列表

    方块是 64×64×64km 的立方体，判断命中需要检查方块是否与圆柱体相交。
    使用方块中心到圆柱中心的距离 <= (radius + 方块半宽) 来判断。
    """
```

**碰撞检测优化：**
- 使用 `effective_radius = radius + block_half` 进行距离检查
- 方块中心到圆柱中心的距离 <= `effective_radius` 判定为命中
- Y 轴重叠检查：方块 Y 范围与 region Y 范围有重叠

**几何口径（最终保留）：**
- `boundary.class = cylinder` 时，`position.(x, y, z)` 表示圆柱中心。
- `boundary.size.r` 表示圆柱半径。
- `boundary.size.linear` 表示圆柱半高，不是总高度。
- 因此圆柱的 Y 范围为 `[position.y - linear, position.y + linear]`。
- 未截断 cylinder 的完整高度为 `2 × linear`。
- 这一口径与 40km 样例体积闭合一致：`π × r² × (2 × linear) / 10^9 ≈ volume_km3`。

**气体产量公式：**
```
yield = hit_block_count × falloff × resourcedensity
respawn = yield × 60 / replenishtime
```

**参数说明：**
- `hit_block_count` = 截断后的 block 数量（不是原始 block 数量）

#### 1.3.4 体积计算（boundary_volume）

单位：XML 中坐标和半径的单位为米（m），计算结果转换为 km³（除以 10^9）。

**体积上限限制：**
| 类型 | 半径上限 | 高度/长度上限 |
|------|----------|---------------|
| sphere | 200,000 m (200 km) | 80,000 m (80 km) 仅当超限时 |
| cylinder | 200,000 m (200 km) | 80,000 m (80 km) 半高上限 |
| splinetube | 200,000 m (200 km) | 1,000,000 m (1000 km) |

**计算公式：**

- **sphere** (r ≤ 200km): `(4/3) × π × r³ / 10^9`
- **sphere** (r > 200km): `π × 200000² × 80000 / 10^9`（按圆柱体计算）
- **cylinder**: `π × min(r, 200000)² × (2 × min(linear, 80000)) / 10^9`
- **splinetube**: `π × min(r, 200000)² × min(spline_length, 1000000) / 10^9`

其中：
- `cylinder.position.y` 是圆柱中心 Y。
- `linear` 是半高。
- 因此 cylinder 的完整高度为 `2 × linear`。

#### 1.3.5 Rating 计算（仅用于 sector.resources）

**Rating 基于 respawn 字段计算：**

| respawn 范围 | rating |
|-------------|--------|
| respawn < 30 | 1 |
| 30 ≤ respawn < 100 | 2 |
| 100 ≤ respawn < 300 | 3 |
| 300 ≤ respawn < 1000 | 4 |
| respawn ≥ 1000 | 5 |

**注意：**
- 此 rating 计算**仅用于 `sector.resources`**，不出现在 `resourceareas.json` 或 `regions.json` 中
- 早期文档中的 Rating 映射表（基于 yield）已废弃，当前实现使用上述基于 respawn 的评级规则

### 1.4 输出数据结构

#### 1.4.1 regionyields.json

```json
[
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
]
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `ware` | 资源类型名称 |
| `color` | 资源颜色（十六进制） |
| `yields` | 产量等级数组 |
| `yields[].name` | 产量等级名称（lowest/low/medium/high/veryhigh） |
| `yields[].resourcedensity` | 资源密度 |
| `yields[].replenishtime` | 重生时间（分钟） |
| `yields[].gatherspeedfactor` | 采集速度系数（仅气体资源） |

#### 1.4.2 regions.json

```json
[
  {
    "id": "region_ore_medium_01",
    "boundary": {
      "class": "cylinder",
      "size": { "r": 25000, "linear": 5000 }
    },
    "falloff": {
      "lateral": [...],
      "radial": [...],
      "lateral_factor": 0.9,
      "radial_factor": 0.63
    },
    "volume_km3": 125.6,
    "resources": [
      {
        "ware": "ore",
        "resourcedensity": 1.0,
        "delay": 60.0,
        "gatherfactor": 1.0,
        "yield_name": "resource_ore"
      }
    ]
  }
]
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `id` | region 唯一标识 |
| `boundary` | 边界几何定义（class, size, spline） |
| `falloff` | 衰减曲线定义（lateral, radial） |
| `falloff.lateral_factor` | 横向 falloff 平均值 |
| `falloff.radial_factor` | 径向 falloff 加权平均值 |
| `volume_km3` | 几何体积（km³） |
| `resources` | 资源模板数组 |
| `resources[].ware` | 资源类型名称 |
| `resources[].resourcedensity` | 资源密度 |
| `resources[].delay` | 重生时间（分钟） |
| `resources[].gatherfactor` | 采集效率系数 |
| `resources[].yield_name` | 产量名称标识 |

#### 1.4.3 resourceareas.json (8.0)

```json
[
  {
    "cluster_id": "Cluster_01_macro",
    "sector_id": "Cluster_01_Sector001_macro",
    "areas": [
      {
        "ref": "region_ore_medium_01",
        "amount": 3,
        "position": { "x": 0, "y": 64000, "z": 0 },
        "lateral_factor": 0.55,
        "radial_factor": 0.46,
        "falloff_factor": 0.253,
        "boundary": {
          "class": "cylinder",
          "size": { "r": 25000, "linear": 5000 }
        },
        "total_volume_km3": 5026548,
        "volume_km3": 4000000,
        "resources": [
          {
            "ware": "ore",
            "resourcedensity": 1.0,
            "yield_name": "medium",
            "total_yield": 1271717,
            "total_respawn": 127171,
            "yield": 1017374,
            "respawn": 101737,
            "delay": 60.0,
            "gatherfactor": 1.0,
            "density": 0.254,
            "respawn_density": 0.025
          }
        ]
      }
    ]
  }
]
```

**字段说明：**

| 字段 | 来源 | 说明 |
|------|------|------|
| `cluster_id` | 解析生成 | 所属 cluster |
| `sector_id` | 解析生成 | 所属 sector |
| `areas` | 数组 | 资源区引用数组 |
| `areas[].ref` | mapdefaults.xml | region 引用 ID |
| `areas[].amount` | mapdefaults.xml | region 实例数量 |
| `areas[].position` | 计算派生 | 世界坐标，用于截断计算 |
| `areas[].lateral_factor` | 计算派生 | 横向 falloff |
| `areas[].radial_factor` | 计算派生 | 径向 falloff |
| `areas[].falloff_factor` | 计算派生 | 总 falloff = lateral × radial |
| `areas[].boundary` | regions.json | 边界几何定义（与 regions.json 相同） |
| `areas[].total_volume_km3` | 计算派生 | 截断前原始体积 |
| `areas[].volume_km3` | 计算派生 | 截断后有效体积 |
| `areas[].resources` | 数组 | 资源计算结果数组 |
| `areas[].resources[].ware` | regions.json | 资源类型 |
| `areas[].resources[].resourcedensity` | regionyields | 资源密度 |
| `areas[].resources[].yield_name` | regions.json | 产量等级名称（如：medium/low/high 等） |
| `areas[].resources[].total_yield` | 计算派生 | 截断前资源总量（未经 amount 乘法） |
| `areas[].resources[].total_respawn` | 计算派生 | 截断前总回复量（未经 amount 乘法） |
| `areas[].resources[].yield` | 计算派生 | 截断后资源量（未经 amount 乘法） |
| `areas[].resources[].respawn` | 计算派生 | 截断后总回复量（未经 amount 乘法） |
| `areas[].resources[].delay` | regions.json | 重生时间（分钟） |
| `areas[].resources[].gatherfactor` | regions.json | 采集系数 |
| `areas[].resources[].density` | 计算派生 | 有效密度 = yield / volume_km3 |
| `areas[].resources[].respawn_density` | 计算派生 | 有效重生密度 = respawn / volume_km3 |

**注意：**
- `yield`/`respawn` 是单个 region 实例的值，**未经 amount 乘法**
- `total_yield`/`total_respawn` 是截断前的理论值，用于评级参考
- Sector 聚合时才应用 `amount` 乘法：`sector_yield = Σ(yield × amount)`

#### 1.4.4 maps.json sector.resources

```json
{
  "id": "Cluster_01_Sector001_macro",
  "resources": [
    {
      "ware": "ore",
      "yield": 450000,
      "respawn": 900000,
      "total_yield": 500000,
      "total_respawn": 100000,
      "rating": 4
    }
  ]
}
```

**计算方式：**
```python
# 使用 aggregate_sector_resources_from_resourceareas() 聚合
# 该函数从 resourceareas_rows 聚合出 sector.resources

# 四个字段独立聚合：
对于每个 sector + ware:
  yield = Σ(resourcearea.yield × amount)
  respawn = Σ(resourcearea.respawn × amount)
  total_yield = Σ(resourcearea.total_yield)  # 仅当字段存在时
  total_respawn = Σ(resourcearea.total_respawn)  # 仅当字段存在时

# rating 基于 respawn 字段计算（见 1.3.5 节）
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `id` | sector macro ID |
| `resources` | 资源聚合数组 |
| `resources[].ware` | 资源类型名称 |
| `resources[].yield` | 资源总量（所有 region 实例求和，已乘以 amount） |
| `resources[].respawn` | 每小时总回复量（已乘以 amount） |
| `resources[].total_yield` | 截断前理论总量（用于评级参考） |
| `resources[].total_respawn` | 截断前理论总回复量（用于评级参考） |
| `resources[].rating` | 资源评级（基于 respawn，1-5 分） |

---

## 2. ResourceArea 处理 (9.0+ 版本)

### 2.1 数据来源

| 文件 | 用途 |
|------|------|
| `regionyields_final.xml` | Definition 定义（<definition> 节点） |
| `mapdefaults_final.xml` | Sector 的 resourceareas 引用 |

### 2.2 处理流程

```
regionyields_final.xml
    │
    ▼
migrate_resourcearea_definitions()
    │
    ├─► 解析 <definition id="..." ware="..." ...>
    │
    ├─► 提取字段:
    │   ├── id, ware, tag (verylow/low/medium/high/veryhigh)
    │   ├── yield, respawnDelay (respawndelay 分钟)
    │   ├── rating, scaneffect, scaneffectintensity, scaneffectcolor
    │   ├── objectyieldfactor (矿物) / gatherspeedfactor (气体)
    │   └── boundary/size/@r (radius)
    │
    ├─► 派生字段:
    │   ├── size (从 id 提取：tiny/small/medium/large)
    │   └── sustainableYieldPerHour = yield / respawnDelay * 60
    │
    ├─► regionyield_definitions.json
    │
    └─► definitions map (内部使用)

mapdefaults_final.xml
    │
    ▼
migrate_sector_resourceareas()
    │
    ├─► 解析 <dataset macro="Cluster_X_SectorY_macro">
    │
    ├─► 提取 <resourceareas><resourcearea ref="..." amount="N"/></resourceareas>
    │
    └─► sector_resource_areas[sector_macro] = [{ref, amount}, ...]

build_sector_resource_summaries_from_resourceareas()
    │
    ├─► 按 ware 聚合:
    │   ├── yield_total = Σ(definition.yield × amount)
    │   └── respawn_total = Σ(definition.yield / definition.respawnDelay × 60 × amount)
    │
    └─► maps.json sector.resources

build_resourceareas_json_payload()
    │
    └─► resourceareas.json (扁平转分组)
```

### 2.3 核心算法

#### 2.3.1 可持续产量计算

```
sustainableYieldPerHour = yield / respawnDelay × 60

其中:
- yield: 单个资源球的产量
- respawnDelay: 重生时间（分钟）
- × 60: 转换为每小时
```

#### 2.3.2 Sector 资源聚合

```python
# 使用 aggregate_sector_resources_from_resourceareas() 从 resourceareas_rows 聚合

# 四个字段独立聚合：
对于每个 sector + ware:
  yield = Σ(definition.yield × resourcearea.amount)
  respawn = Σ(definition.respawn × resourcearea.amount)
  total_yield = Σ(definition.total_yield)  # 仅当字段存在时
  total_respawn = Σ(definition.total_respawn)  # 仅当字段存在时
```

**注意：**
- `aggregate_sector_resources_from_resourceareas()` 是统一的聚合函数，输出 `yield` 和 `respawn` 字段
- 8.0 和 9.0+ 版本使用相同的聚合函数
- rating 基于 respawn 字段计算（见 1.3.5 节），仅在 sector.resources 中出现

### 2.4 输出数据结构

#### 2.4.1 regionyield_definitions.json

```json
[
  {
    "id": "sphere_tiny_ore_verylow",
    "ware": "ore",
    "tag": "verylow",
    "size": "tiny",
    "radius": 20000.0,
    "yield": 5000.0,
    "respawnDelay": 20.0,
    "rating": 1.0,
    "sustainableYieldPerHour": 15000.0,
    "scaneffect": "scfx_dynamic_lowyield_01",
    "scaneffectintensity": 0.1,
    "scaneffectcolor": "resource_ore",
    "objectyieldfactor": 0.5
  }
]
```

**字段说明：**

| 字段 | 来源 | 说明 |
|------|------|------|
| `id` | definition@id | 唯一标识 |
| `ware` | definition@ware | 资源类型 |
| `tag` | definition@tag | 产量等级 |
| `size` | 从 id 派生 | tiny/small/medium/large |
| `radius` | boundary/size/@r | 半径（米） |
| `yield` | definition@yield | 基础产量 |
| `respawnDelay` | definition@respawndelay | 重生时间（分钟） |
| `rating` | definition@rating | 星级评分 |
| `sustainableYieldPerHour` | 计算派生 | 可持续产量/小时 |
| `scaneffect` | definition@scaneffect | 扫描效果 |
| `scaneffectintensity` | definition@scaneffectintensity | 效果强度 |
| `scaneffectcolor` | definition@scaneffectcolor | 效果颜色 |
| `objectyieldfactor` | definition@objectyieldfactor | 矿物系数 |
| `gatherspeedfactor` | definition@gatherspeedfactor | 气体系数 |

#### 2.4.2 resourceareas.json (9.0+)

```json
[
  {
    "cluster_id": "Cluster_01_macro",
    "sector_id": "Cluster_01_Sector001_macro",
    "areas": [
      {
        "ref": "sphere_medium_hydrogen_medium",
        "amount": 7,
        "resources": [
          {
            "ware": "hydrogen",
            "yield": 150000.0,
            "respawn": 150000.0,
            "delay": 60.0,
            "gatherfactor": 1.0,
            "rating": 10.0
          }
        ]
      }
    ]
  }
]
```

**字段来源：**

| 字段 | 来源 | 说明 |
|------|------|------|
| `cluster_id` | 解析生成 | 所属 cluster |
| `sector_id` | 解析生成 | 所属 sector |
| `areas` | 数组 | 资源区引用数组 |
| `areas[].ref` | resourcearea@ref | resourcearea 引用 ID |
| `areas[].amount` | resourcearea@amount | resourcearea 实例数量 |
| `areas[].resources` | 数组 | 资源计算结果数组 |
| `areas[].resources[].ware` | definition.ware | 资源类型 |
| `areas[].resources[].yield` | definition.yield | 单个实例产量（**未经 amount 乘法**） |
| `areas[].resources[].respawn` | definition.sustainableYieldPerHour | 单个实例每小时回复量（**未经 amount 乘法**） |
| `areas[].resources[].delay` | definition.respawnDelay | 重生时间（分钟） |
| `areas[].resources[].gatherfactor` | definition.gatherspeedfactor | 采集系数 |
| `areas[].resources[].rating` | definition.rating | 星级评分（从 definition 直接读取） |

**注意：**
- `yield` 和 `respawn` 是单个 resourcearea 实例的值，**未经 amount 乘法**
- Sector 聚合时才应用 `amount` 乘法：`sector_yield = Σ(yield × amount)`
- `rating` 字段在 9.0+ resourceareas.json 中来自 definition，与 1.3.5 节的 sector.resources rating 计算不同
- `total_yield`/`total_respawn` 字段仅在 8.0 版本中存在，9.0+ 版本 definition 不包含这些字段
- `rating` 字段仅出现在 `sector.resources` 中，`resourceareas.json` 中不包含

#### 2.4.3 maps.json sector.resources (9.0+)

```json
{
  "id": "Cluster_01_Sector001_macro",
  "resources": [
    {
      "ware": "hydrogen",
      "yield": 10500000.0,
      "respawn": 10350000.0,
      "rating": 5
    }
  ]
}
```

**计算方式：**
```python
# 使用 aggregate_sector_resources_from_resourceareas() 聚合

对于每个 sector + ware:
  yield = Σ(definition.yield × resourcearea.amount)
  respawn = Σ(definition.sustainableYieldPerHour × resourcearea.amount)

# rating 基于 respawn 字段计算（见 1.3.5 节）
```

**注意：**
- 8.0 和 9.0+ 版本统一使用 `yield` 字段名（而非 `amount`），由 `aggregate_sector_resources_from_resourceareas()` 函数统一输出
- `rating` 基于 `respawn` 字段计算（1-5 级），仅在 `sector.resources` 中出现
- 9.0+ 版本 definition 不包含 `total_yield`/`total_respawn` 字段，因此 sector.resources 中也不包含

#### 2.4.4 regionyields.json (9.0+)

9.0+ 版本不生成 `regionyields.json` 文件。

---

## 3. 版本对比

### 3.1 数据模型对比

| 特性 | 8.0 (regions) | 9.0+ (resourceareas) |
|------|---------------|----------------------|
| 资源定义方式 | region 模板 + falloff | definition 模板直接引用 |
| 产量计算 | falloff × resourcedensity × base | yield × amount |
| 几何形状 | boundary (sphere/cylinder/splinetube) | 球形 (radius) |
| Falloff 计算 | ✓ lateral × radial | ✗ 无 |
| 固体截断 | ✓ Splinetube 截断曲线 / Sphere/Cylinder 体积上限 | ✗ 无 |
| 气体 Block 截断 | ✓ 两步：原始命中 → 方块中心过滤 | ✗ 无 |
| 坐标系统 | region 相对 sector | 隐式（definition 自带） |

### 3.2 输出文件对比

| 文件 | 8.0 | 9.0+ |
|------|-----|------|
| `regions.json` | ✓ region 定义数组 | ✗ 不生成 |
| `resourceareas.json` | ✓ (引用关系) | ✓ (完整数据) |
| `regionyields.json` | ✓ (yield 定义) | ✗ 不生成 |
| `regionyield_definitions.json` | ✗ | ✓ (definition 定义) |
| `maps.json` | ✓ (sector.resources) | ✓ (sector.resources) |

### 3.3 处理函数对比

| 功能 | 8.0 函数 | 9.0+ 函数 |
|------|----------|-----------|
| 解析定义 | `migrate_region_definitions()` | `migrate_resourcearea_definitions()` |
| 解析引用 | `resolve_sector_macro_from_region_ref()` | `migrate_sector_resourceareas()` |
| 构建 resourceareas | `build_80_resourceareas_array()` | `build_resourceareas_json_payload()` |
| Sector 聚合 | `aggregate_sector_resources_from_resourceareas()` | `aggregate_sector_resources_from_resourceareas()` |

**注意：**
- `summarize_sector_resources()`（`sector/resource_summary.py`）已废弃，其输出会被 `aggregate_sector_resources_from_resourceareas()` 覆盖
- 8.0 和 9.0+ 版本统一使用 `aggregate_sector_resources_from_resourceareas()` 进行 sector 资源聚合

---

## 4. 统一服务入口

### 4.1 process_map_for_version()

`processor/map/service.py` 提供统一的处理入口：

```python
def process_map_for_version(
    raw_assets_dir: str,
    processed_assets_dir: str,
    folder_name: str,
    version: str,
    i18n_registry: Optional[I18nRegistry] = None,
) -> Dict[str, Any]:
    """
    根据版本号处理 Map 数据。

    自动检测资源模型（regions vs resourceareas），
    构建 XML 路径，执行对应的处理流程。
    """
    # 1. 检测资源模型
    resource_model = detect_map_resource_model(version)

    # 2. 处理 factions
    factions_rows, factions_by_id = migrate_factions(...)
    write_factions(factions_rows, factions_output_path)

    # 3. 根据模型分支
    if resource_model == "resourceareas":
        # 9.0+ 处理逻辑
        definitions = migrate_resourcearea_definitions(...)
        sector_resource_areas = migrate_sector_resourceareas(...)
        write_regionyield_definitions(...)

        result = generate_map_data(..., resource_model="resourceareas", ...)
        write_resourceareas(...)
        write_map(...)
    else:
        # 8.0- 处理逻辑
        regionyields_rows = migrate_regionyields(...)
        write_regionyields(...)

        result = generate_map_data(..., resource_model="regions", ...)
        write_regions(...)
        write_resourceareas(...)
        write_map(...)

    return stats
```

---

## 5. 关键设计决策

### 5.1 版本分叉 vs 统一适配

**决策：** 使用明确的版本分叉，而非在单一函数中兼容两种模型。

**理由：**
- 两种模型的数据结构差异太大
- 分叉保持代码清晰，便于单独维护
- 通过统一入口 `process_map_for_version()` 封装复杂度

### 5.2 空数组占位策略（已废弃）

**原决策：** 9.0+ 版本保留 `regionyields.json` 文件但写入空数组。

**现状：** 9.0+ 版本不再生成 `regionyields.json` 文件，也不生成空数组占位。

**原因：**
- 前端加载链路已更新，不再依赖该文件
- 简化输出文件管理

### 5.3 模板与实例分离

**决策：** 8.0 版本中 `regions.json` 仅包含模板定义，实例引用在 `resourceareas.json`。

**理由：**
- 减少数据冗余
- 模板可被多个 sector 复用
- 符合数据规范化原则

---

## 6. 附录：完整数据流图

### 6.1 8.0 版本数据流

```
┌─────────────────────────────────────────────────────────────┐
│                     XML 输入源                               │
├─────────────────────────────────────────────────────────────┤
│  regionyields_final.xml                                     │
│  region_definitions_final.xml                               │
│  mapdefaults_final.xml                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   8.0 处理流程                              │
├─────────────────────────────────────────────────────────────┤
│  migrate_regionyields()                                     │
│    └─► regionyields.json (颜色 + yield 定义)                 │
│    └─► build_yield_info_map()                               │
│                                                              │
│  migrate_region_definitions()                               │
│    └─► regions.json (boundary, falloff, resources 模板)      │
│    └─► region_calc_data (中间计算数据)                       │
│                                                              │
│  resolve_sector_macro_from_region_ref()                     │
│    └─► sector → region ref 映射                             │
│                                                              │
│  计算 resourcearea 实例资源                                  │
│    ├─► 固体：计算截断体积 × falloff × resourcedensity        │
│    └─► 气体：64km³ 方块网格命中 × falloff × resourcedensity  │
│                                                              │
│  build_80_resourceareas_array()                             │
│    └─► resourceareas.json (引用关系)                         │
│                                                              │
│  aggregate_sector_resources_from_resourceareas()            │
│    └─► maps.json sectors[].resources[]                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     JSON 输出                               │
├─────────────────────────────────────────────────────────────┤
│  regionyields.json                                          │
│  regions.json                                               │
│  resourceareas.json                                         │
│  maps.json (含 sectors[].resources[])                        │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 9.0+ 版本数据流

```
┌─────────────────────────────────────────────────────────────┐
│                     XML 输入源                               │
├─────────────────────────────────────────────────────────────┤
│  regionyields_final.xml (definition 节点)                    │
│  mapdefaults_final.xml                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  9.0+ 处理流程                              │
├─────────────────────────────────────────────────────────────┤
│  migrate_resourcearea_definitions()                         │
│    └─► definitions map                                      │
│    └─► regionyield_definitions.json                         │
│                                                              │
│  migrate_sector_resourceareas()                             │
│    └─► sector_resource_areas map                            │
│                                                              │
│  aggregate_sector_resources_from_resourceareas()            │
│    └─► maps.json sectors[].resources[]                      │
│                                                              │
│  build_resourceareas_json_payload()                         │
│    └─► resourceareas.json                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     JSON 输出                               │
├─────────────────────────────────────────────────────────────┤
│  regionyield_definitions.json                               │
│  resourceareas.json                                         │
│  maps.json (含 sectors[].resources[])                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 核心代码位置索引

| 模块 | 文件路径 | 关键函数 |
|------|----------|----------|
| 版本检测 | `processor/resource/model_detector.py` | `detect_map_resource_model()` |
| 8.0 定义处理 | `processor/resource/legacy_processor.py` | `migrate_regionyields()`, `migrate_region_definitions()` |
| 8.0 计算 | `processor/resource/legacy_processor.py` | `calculate_resourcearea_resources()` |
| 9.0 定义处理 | `processor/resource/modern_processor.py` | `migrate_resourcearea_definitions()`, `migrate_sector_resourceareas()` |
| 9.0 聚合 | `processor/resource/modern_processor.py` | `build_sector_resource_summaries_from_resourceareas()` |
| Map 生成 | `processor/map/generator.py` | `generate_map_data()` |
| 输出写入 | `processor/output_manager.py` | `write_*()` 系列函数 |
| 统一入口 | `processor/map/service.py` | `process_map_for_version()` |

---

## 8. 风险与对策

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 版本判定逻辑错误 | 高 | 版本判定只取主版本号，使用正则提取数字 |
| 前端依赖旧字段 | 中 | 9.0+ 不生成 regionyields.json，前端已更新不依赖该文件 |
| 新旧逻辑混用 | 中 | 明确分叉点，通过 resource_model 参数隔离 |
| 计算结果不一致 | 高 | 保留旧版本输出作为对比基准 |

---

## 10. 废弃说明

### 10.1 `summarize_sector_resources()` 函数废弃

**位置**: `scripts/processor/sector/resource_summary.py`

**状态**: 已废弃

**原因**:
- 该函数输出 `amount` 字段而非标准的 `yield` 字段
- 其输出会被 `aggregate_sector_resources_from_resourceareas()` 的输出覆盖
- 8.0 和 9.0+ 版本统一使用 `aggregate_sector_resources_from_resourceareas()` 进行 sector 资源聚合

**影响**: 该函数的输出不会出现在最终的 `maps.json` 中。

---

## 11. 更新记录

| 日期 | 变更内容 | 作者 |
|------|----------|------|
| 2026-03-18 | 初始版本，基于当前 processor 实现整理 | - |
| 2026-03-18 | 删除无效的 Region 修正因子（density, noise_probability）和 Field 因子相关描述；补充气体 block 算法和截断算法 | - |
| 2026-03-18 | 更新 yield/respawn 说明为未经 amount 乘法的值；移除 falloff.effective_factor；9.0+ 不生成 regionyields.json；统一使用 aggregate_sector_resources_from_resourceareas()；更新 resourceareas.json 结构为 resources 数组格式 | - |
| 2026-03-19 | 补充 generate_gas_block_coordinates() 函数说明；更新 aggregate_sector_resources_from_resourceareas() 支持四个字段独立聚合（yield/respawn/total_yield/total_respawn）；更新 Rating 计算为基于 respawn 的 5 级评级 | - |
| 2026-03-19 | 统一文档中所有 `sector.resources` 包含 `total_yield`/`total_respawn`/`rating` 字段；更新 1.3.5 明确 rating 计算仅用于 sector.resources | - |
| 2026-03-20 | 更新 1.4.3 resourceareas.json (8.0) 示例以匹配实际输出（包含 boundary 字段）；更新 2.4.2 resourceareas.json (9.0+) 示例以包含 rating 字段（来自 definition）；更新 2.4.3 说明 9.0+ sector.resources 不包含 total_yield/total_respawn；恢复 1.4.3 中的 position 字段 | - |

---

**文档完成时间**: 2026-03-20
