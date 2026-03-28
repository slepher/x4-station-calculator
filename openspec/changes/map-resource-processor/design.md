# map-resource-processor 设计说明

> **文档范围**: 本文档仅描述 **resource 资源处理** 相关逻辑，不涉及 station、highway、sector 归一化等 Map 其他模块。

## 设计目标

基于当前 `scripts/processor` 中 resource 处理代码的实现，整理出完整的 resource 处理文档，包括：

1. 两个版本（8.0 regions / 9.0+ resourceareas）的处理逻辑分叉
2. 完整的数据流和算法说明
3. 输出数据结构定义

---

## 架构重构：两步分离

### 背景

当前架构中，`x4_map_processor` 同时负责：
1. 地图数据生成（XML → JSON）
2. 资源产量计算（yield/respawn）

资源计算算法（参考 `solid_sum_weights_replay_v2.py` 和 `gas_sum_weights_replay.py`）较为复杂，且需要独立迭代，因此将资源计算分离为独立步骤。

### 新架构

```
Step 1: x4_map_processor（地图生成）
  ├─ 解析 XML 文件
  ├─ 生成基础地图数据（clusters, sectors, zones, highways 等）
  └─ 生成资源基础数据（regions.json, resourceareas.json）
      └─ 仅包含几何、位置、引用、体积等基础字段
      └─ 不包含 yield/respawn 等产量字段

Step 2: x4_resource_processor（资源计算，新建）
  ├─ 读取已生成的地图 JSON
  ├─ 执行 8.0 资源算法
  │   ├─ 固体：参考 solid_sum_weights_replay_v2.py
  │   └─ 气体：参考 gas_sum_weights_replay.py
  └─ 回填产量字段到 resourceareas.json 和 sector.resources
```

### 模块职责划分

| 模块 | Step | 职责 | 输出 |
|------|------|------|------|
| `x4_map_processor` | 1 | 地图生成 + 资源基础数据 | regions.json, resourceareas.json（无 yield） |
| `x4_resource_processor` | 2 | 64k area 级资源计算 | 更新 resourceareas.json, sector.resources |

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

#### 1.3.1 算法文档索引

| 算法 | 文档 | 模块路径 |
|------|------|----------|
| 固体估算 | [solid_estimator.md](./solid_estimator.md) | `processor/step2_resource/estimator/solid_estimator.py` |
| 气体估算 | [gas_estimator.md](./gas_estimator.md) | `processor/step2_resource/estimator/gas_estimator.py` |
| 固体明细（逐格） | [solid_per_block.md](./solid_per_block.md) | `processor/step2_resource/per_block/solid_per_block.py` |
| 气体明细（逐格） | [gas_per_block.md](./gas_per_block.md) | `processor/step2_resource/per_block/gas_per_block.py` |

#### 1.3.2 有效空间

**估算算法**：

| 维度 | 范围 |
|------|------|
| X 轴 | [-1024km, +1024km] |
| Y 轴 | [-1024km, +1024km] |
| Z 轴 | [-1024km, +1024km] |

**明细算法（15×15×3 64k area）**：

**Area 中心点范围**：

| 方向 | 格数 | 中心点范围 |
|------|------|------------|
| X | 15 | [-480km, +480km] |
| Y | 3 | [-96km, +96km] |
| Z | 15 | [-480km, +480km] |

**Area 实际覆盖范围**（中心点向外延伸 32km）：

| 方向 | 中心点范围 | Area 覆盖范围 |
|------|------------|---------------|
| X | [-480km, +480km] | [-512km, +512km] |
| Y | [-96km, +96km] | [-128km, +128km] |
| Z | [-480km, +480km] | [-512km, +512km] |

#### 1.3.3 Falloff 计算

```
falloff = lateral_factor × radial_factor
```

- `lateral_factor`: 横向 falloff 一元计算（平均值）
- `radial_factor`: 径向 falloff 一元计算（加权平均值）
- 对 `solid box`，`falloff` 口径改为”轴向一元积分 + 径向二元积分”

#### 1.3.4 Rating 计算（仅用于 sector.resources）

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
        "solid_volume_km3": 4000000,
        "resources": [
          {
            "ware": "ore",
            "resourcedensity": 1.0,
            "yield_name": "medium",
            "theoretical_reserve": 1271717,
            "theoretical_respawn": 127171,
            "reserve": 1017374,
            "respawn": 101737,
            "delay": 60.0,
            "gatherfactor": 1.0
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
| `areas[].boundary` | regions.json | 边界几何定义 |
| `areas[].solid_volume_km3` | 估算算法 | 固体估算体积（仅固体资源） |
| `areas[].gas_volume_km3` | 估算算法 | 气体估算体积（仅气体资源） |
| `areas[].resources` | 数组 | 资源计算结果数组 |
| `areas[].resources[].ware` | regions.json | 资源类型 |
| `areas[].resources[].resourcedensity` | regionyields | 资源密度 |
| `areas[].resources[].yield_name` | regions.json | 产量等级名称 |
| `areas[].resources[].theoretical_reserve` | 估算算法 | 理论储量 |
| `areas[].resources[].theoretical_respawn` | 估算算法 | 理论回复量 |
| `areas[].resources[].reserve` | 逐格算法 | 精确储量 |
| `areas[].resources[].respawn` | 逐格算法 | 精确回复量 |
| `areas[].resources[].delay` | regions.json | 重生时间（分钟） |
| `areas[].resources[].gatherfactor` | regions.json | 采集系数 |

**注意：**
- `reserve`/`respawn` 是单个 region 实例的值，**未经 amount 乘法**
- `theoretical_reserve`/`theoretical_respawn` 是基于估算体积的理论值
- Sector 聚合时才应用 `amount` 乘法：`sector_reserve = Σ(reserve × amount)`

**字段严格区分原则：**
- `theoretical_reserve`/`theoretical_respawn`：**仅用于参考/对比**，禁止用于生成 `reserve`/`respawn`
- `reserve`/`respawn`：**仅来自逐格计算**，无值则保持0，绝不回退到 theoretical
- `aggregate_sector_resources_from_resourceareas()` 必须仅在逐格计算完成后调用

#### 1.4.4 maps.json sector.resources

```json
{
  "id": "Cluster_01_Sector001_macro",
  "resources": [
    {
      "ware": "ore",
      "reserve": 450000,
      "respawn": 900000,
      "theoretical_reserve": 500000,
      "theoretical_respawn": 100000,
      "rating": 4
    }
  ]
}
```

**计算方式：**
```python
# 使用 aggregate_sector_resources_from_resourceareas() 聚合
# 该函数从 resourceareas_rows 聚合出 sector.resources

# 必须在逐格计算完成后调用
# 四个字段独立聚合：
对于每个 sector + ware:
  reserve = Σ(resourcearea.reserve × amount)           # 仅使用逐格计算值
  respawn = Σ(resourcearea.respawn × amount)           # 仅使用逐格计算值
  theoretical_reserve = Σ(resourcearea.theoretical_reserve)  # 仅用于参考
  theoretical_respawn = Σ(resourcearea.theoretical_respawn)  # 仅用于参考

# 注意：禁止用 theoretical 字段回退填充 reserve/respawn
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `id` | sector macro ID |
| `resources` | 资源聚合数组 |
| `resources[].ware` | 资源类型名称 |
| `resources[].reserve` | 资源总量（所有 region 实例求和，已乘以 amount） |
| `resources[].respawn` | 每小时总回复量（已乘以 amount） |
| `resources[].theoretical_reserve` | 理论储量（用于评级参考） |
| `resources[].theoretical_respawn` | 理论回复量（用于评级参考） |
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
# 必须在逐格计算完成后调用

# 四个字段独立聚合：
对于每个 sector + ware:
  reserve = Σ(definition.reserve × resourcearea.amount)      # 仅使用逐格计算值
  respawn = Σ(definition.respawn × resourcearea.amount)  # 仅使用逐格计算值
  theoretical_reserve = Σ(definition.theoretical_reserve)                # 仅用于参考
  theoretical_respawn = Σ(definition.theoretical_respawn)            # 仅用于参考

# 注意：禁止用 theoretical_reserve/theoretical_respawn 回退填充 reserve/respawn
```

**注意：**
- `aggregate_sector_resources_from_resourceareas()` 是统一的聚合函数，输出 `yield` 和 `respawn` 字段
- 8.0 和 9.0+ 版本使用相同的聚合函数
- rating 基于 respawn 字段计算（见 1.3.5 节），仅在 sector.resources 中出现
- **必须在逐格计算完成后调用**，禁止用 theoretical 字段回退填充 yield/respawn

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
            "reserve": 150000,
            "respawn": 150000,
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
| `areas[].resources[].reserve` | definition.yield | 单个实例储量（**未经 amount 乘法**） |
| `areas[].resources[].respawn` | definition.sustainableYieldPerHour | 单个实例每小时回复量（**未经 amount 乘法**） |
| `areas[].resources[].delay` | definition.respawnDelay | 重生时间（分钟） |
| `areas[].resources[].gatherfactor` | definition.gatherspeedfactor | 采集系数 |
| `areas[].resources[].rating` | definition.rating | 星级评分（从 definition 直接读取） |

**注意：**
- `reserve` 和 `respawn` 是单个 resourcearea 实例的值，**未经 amount 乘法**
- Sector 聚合时才应用 `amount` 乘法：`sector_reserve = Σ(reserve × amount)`
- `rating` 字段在 9.0+ resourceareas.json 中来自 definition，与 1.3.5 节的 sector.resources rating 计算不同
- `theoretical_reserve`/`theoretical_respawn` 字段仅在 8.0 版本中存在，9.0+ 版本 definition 不包含这些字段
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
# 必须在逐格计算完成后调用

对于每个 sector + ware:
  reserve = Σ(definition.reserve × resourcearea.amount)      # 仅使用逐格计算值
  respawn = Σ(definition.sustainableYieldPerHour × resourcearea.amount)  # 仅使用逐格计算值

# rating 基于 respawn 字段计算（见 1.3.5 节）
# 注意：禁止用 theoretical 字段回退填充 reserve/respawn
```

**注意：**
- 8.0 和 9.0+ 版本统一使用 `yield` 字段名（而非 `amount`），由 `aggregate_sector_resources_from_resourceareas()` 函数统一输出
- `rating` 基于 `respawn` 字段计算（1-5 级），仅在 `sector.resources` 中出现
- 9.0+ 版本 definition 不包含 `theoretical_reserve`/`theoretical_respawn` 字段，因此 sector.resources 中也不包含
- **必须在逐格计算完成后调用**，禁止用 theoretical 字段回退填充 yield/respawn

#### 2.4.4 regionyields.json (9.0+)

9.0+ 版本不生成 `regionyields.json` 文件。

---

## 3. 版本对比

### 3.1 数据模型对比

| 特性 | 8.0 (regions) | 9.0+ (resourceareas) |
|------|---------------|----------------------|
| 资源定义方式 | region 模板 + falloff | definition 模板直接引用 |
| 产量计算 | 体积 × falloff × resourcedensity（气体再除以 `64^3`） | yield × amount |
| 几何形状 | boundary (`sphere` / `cylinder` / `splinetube` / `box`) | 球形 (radius) |
| Falloff 计算 | ✓ lateral × radial | ✗ 无 |
| 固体截断 | ✓ 体积封顶 + 有效空间裁剪 | ✗ 无 |
| 气体离散化 | ✓ 有效空间裁剪 + `64km`/`32km` 规则 | ✗ 无 |
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

## 4. 关键设计决策

### 4.1 版本分叉 vs 统一适配

**决策：** 使用明确的版本分叉，而非在单一函数中兼容两种模型。

**理由：**
- 两种模型的数据结构差异太大
- 分叉保持代码清晰，便于单独维护
- 通过 Step 1 / Step 2 分离封装复杂度

### 4.2 空数组占位策略（已废弃）

**原决策：** 9.0+ 版本保留 `regionyields.json` 文件但写入空数组。

**现状：** 9.0+ 版本不再生成 `regionyields.json` 文件，也不生成空数组占位。

**原因：**
- 前端加载链路已更新，不再依赖该文件
- 简化输出文件管理

### 4.3 模板与实例分离

**决策：** 8.0 版本中 `regions.json` 仅包含模板定义，实例引用写入 `sector.regions`。

**理由：**
- 减少数据冗余
- 模板可被多个 sector 复用
- 符合数据规范化原则
- Step 1 输出基础数据，Step 2 计算产量，职责分离

---

## 5. 核心代码位置索引

### 5.1 迁移前（当前）

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

### 5.2 迁移后（目标）

| 模块 | 文件路径 | 关键函数 |
|------|----------|----------|
| **Step 1** | | |
| 统一入口 | `processor/step1_map/service.py` | `process_step1_map()` |
| Map 生成 | `processor/step1_map/generator.py` | `generate_map_data()` |
| 基础计算 | `processor/step1_map/calculator.py` | `boundary_volume()`, `calculate_falloff_factors()` |
| 输出写入 | `processor/shared/output_manager.py` | `write_*()` 系列函数 |
| **Step 2** | | |
| 统一入口 | `processor/step2_resource/service.py` | `process_step2_resource()` |
| 版本检测 | `processor/step2_resource/model_detector.py` | `detect_map_resource_model()` |
| 固体估算 | `processor/step2_resource/estimator/solid_estimator.py` | `estimate_solid_yield()` |
| 气体估算 | `processor/step2_resource/estimator/gas_estimator.py` | `estimate_gas_yield()` |
| 固体逐格 | `processor/step2_resource/per_block/solid_per_block.py` | `calculate_solid_per_block()` |
| 气体逐格 | `processor/step2_resource/per_block/gas_per_block.py` | `calculate_gas_per_block()` |
| 9.0+ 处理 | `processor/step2_resource/modern_processor.py` | `build_resourceareas_json_payload()` |
| 共用函数 | `processor/step2_resource/shared.py` | `aggregate_sector_resources_from_resourceareas()` |

---

## 6. 实施方案

### 6.1 文档覆盖度评估

**已覆盖（约 80%）**：
- 架构设计、版本分叉、数据流、输出结构、模块结构
- 体积计算公式、储量计算公式、碰撞检测伪代码、网格参数、验收办法

**缺失细节（约 20%）**：
| 缺失内容 | 参考代码 | 说明 |
|----------|----------|------|
| Noise 算法 | `solid_sum_weights_replay_v2.py` | 固体特有的随机扰动 |
| Falloff 曲线插值 | 两个 replay 脚本 | lateral/radial 控制点插值 |
| Splinetube 曲线分段 | 两个 replay 脚本 | Bezier 曲线分割为线段 |
| region 坐标变换 | 两个 replay 脚本 | position/rotation 变换到局部坐标 |
| lateral_factor/radial_factor 积分 | 两个 replay 脚本 | 加权平均计算 |

### 6.2 实施策略

**方案 B：边实施边参考现有代码**

- 文档已覆盖核心算法框架和数据结构
- 缺失细节属于实现层面，直接参考经验证的 replay 脚本
- 通过验收流程逐步修正算法

**参考代码位置**：
```
scripts/x4-game/
├── solid_sum_weights_replay_v2.py   # 固体资源算法参考
└── gas_sum_weights_replay.py        # 气体资源算法参考
```

---

## 7. 风险与对策

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 版本判定逻辑错误 | 高 | 版本判定只取主版本号，使用正则提取数字 |
| 前端依赖旧字段 | 中 | 9.0+ 不生成 regionyields.json，前端已更新不依赖该文件 |
| 新旧逻辑混用 | 中 | 明确分叉点，通过 resource_model 参数隔离 |
| 计算结果不一致 | 高 | 保留旧版本输出作为对比基准 |

---

## 8. 废弃说明

### 8.1 `summarize_sector_resources()` 函数废弃

**位置**: `scripts/processor/sector/resource_summary.py`

**状态**: 已废弃

**原因**:
- 该函数输出非标准字段
- 其输出会被 `aggregate_sector_resources_from_resourceareas()` 的输出覆盖
- 8.0 和 9.0+ 版本统一使用 `aggregate_sector_resources_from_resourceareas()` 进行 sector 资源聚合
- **必须在逐格计算完成后调用**，禁止用 theoretical 字段回退填充 reserve/respawn

**影响**: 该函数的输出不会出现在最终的 `maps.json` 中。

---

## 9. 两步分离字段划分

### 8.1 Step 1: x4_map_processor 输出字段

Step 1 负责地图数据生成，**存在 8.0 / 9.0+ 版本分叉**。

**Step 1 不输出**：
- ❌ `resourceareas.json`（由 Step 2 生成）
- ❌ `sector.resources`（由 Step 2 回填）

#### 12.1.1 8.0 版本输出

**输出文件**：
- `regionyields.json`
- `regions.json`
- `maps.json`（sector 中包含 region 引用关系）

##### regionyields.json

```json
[
  {
    "ware": "helium",
    "color": "#ff0000",
    "yields": [
      {
        "name": "medium",
        "resourcedensity": 300,
        "replenishtime": 180,
        "gatherspeedfactor": 1.0
      }
    ]
  }
]
```

##### regions.json

| 字段 | 说明 | 来源 |
|------|------|------|
| `id` | region 唯一标识 | XML @name |
| `boundary` | 边界几何定义 | XML <boundary> |
| `boundary.class` | 形状类型（sphere/cylinder/splinetube/box） | XML @class |
| `boundary.size` | 尺寸参数 | XML <size> |
| `boundary.size.r` | 半径（米） | XML @r |
| `boundary.size.linear` | 半高/等效长度（米） | XML @linear 或 spline 计算 |
| `boundary.size.x/y/z` | box 半长（米） | XML @x/@y/@z |
| `boundary.spline` | splinetube 控制点 | XML <splineposition> |
| `falloff` | 衰减曲线定义 | XML <falloff> |
| `falloff.lateral` | 横向控制点 | XML <lateral> |
| `falloff.radial` | 径向控制点 | XML <radial> |
| `falloff.lateral_factor` | 横向平均值 | 计算 |
| `falloff.radial_factor` | 径向加权平均值 | 计算 |
| `volume_km3` | 原始几何体积 | 计算 |
| `resources` | 资源模板数组 | XML <resources> |
| `resources[].ware` | 资源类型 | XML @ware |
| `resources[].resourcedensity` | 资源密度 | regionyields |
| `resources[].delay` | 重生时间（分钟） | regionyields |
| `resources[].gatherfactor` | 采集系数 | regionyields |
| `resources[].yield_name` | 产量等级名称 | XML @yield |

##### sector.regions（maps.json, 8.0 版本）

Step 1 将 sector 和 region 的关系直接写入 sector，**不生成 resourceareas.json**：

```json
{
  "id": "Cluster_01_Sector001_macro",
  "cluster_id": "Cluster_01_macro",
  "regions": [
    {
      "ref": "region_ore_medium_01",
      "position": {"x": 10000, "y": 5000, "z": 20000},
      "rotation": {"x": 0, "y": 0, "z": 0, "w": 1},
      "boundary": {"class": "cylinder", "size": {"r": 25000, "linear": 5000}},
      "volume_km3": 125.6
    }
  ]
}
```

| 字段 | 说明 | 来源 |
|------|------|------|
| `regions[].ref` | region 模板 ID（对应 regions.json 的 id） | XML |
| `regions[].position` | 相对 sector 的坐标 | 计算 |
| `regions[].rotation` | 旋转四元数 | XML |
| `regions[].boundary` | 边界几何（class + size） | regions.json |
| `regions[].volume_km3` | 原始几何体积 | regions.json |

#### 12.1.2 9.0+ 版本输出

**输出文件**：
- `regionyield_definitions.json`
- `maps.json`（sector 中包含 resourcearea 引用关系）

##### regionyield_definitions.json

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
    "objectyieldfactor": 0.5
  }
]
```

| 字段 | 说明 | 来源 |
|------|------|------|
| `id` | definition 唯一标识 | XML @id |
| `ware` | 资源类型 | XML @ware |
| `tag` | 产量等级 | XML @tag |
| `size` | 尺寸分类（tiny/small/medium/large） | 从 id 派生 |
| `radius` | 球形半径（米） | XML <boundary><size> |
| `yield` | 单实例产量 | XML @yield |
| `respawnDelay` | 重生时间（分钟） | XML @respawndelay |
| `rating` | 星级评分 | XML @rating |
| `sustainableYieldPerHour` | 可持续产量/小时 | 计算 |
| `objectyieldfactor` | 矿物系数 | XML @objectyieldfactor |
| `gatherspeedfactor` | 气体系数 | XML @gatherspeedfactor |

##### sector.regions（maps.json, 9.0+ 版本）

Step 1 将 sector 和 definition 的引用关系直接写入 sector，**不生成 resourceareas.json**：

```json
{
  "id": "Cluster_01_Sector001_macro",
  "cluster_id": "Cluster_01_macro",
  "regions": [
    {
      "ref": "sphere_medium_hydrogen_medium",
      "amount": 7
    }
  ]
}
```

| 字段 | 说明 | 来源 |
|------|------|------|
| `regions[].ref` | definition ID（对应 regionyield_definitions.json） | XML @ref |
| `regions[].amount` | 实例数量 | XML @amount |

#### 12.1.3 Step 1 输出对比

| 版本 | 输出文件 | sector 中的引用字段 |
|------|----------|---------------------|
| **8.0** | regionyields.json, regions.json | `regions` (含 position, rotation, boundary, volume_km3) |
| **9.0+** | regionyield_definitions.json | `regions` (含 amount) |

### 8.2 Step 2: x4_resource_processor

Step 2 负责：
1. 从 sector.regions 读取引用关系
2. 计算 reserve（8.0 两阶段）或直接读取 yield（9.0+）
3. **生成 resourceareas.json**
4. **聚合 sector.resources**

#### 8.2.1 8.0 版本：两阶段处理

8.0 版本采用两阶段顺序执行：

```
一阶段（估算）→ resourceareas.json（理论储量）
      ↓
二阶段（逐格）→ resourceareas.json（精确储量）+ resourcearea_blocks.json（明细）
```

##### 一阶段：估算算法

**目标**：计算估算体积和理论储量。

**算法文档**：
- 固体：[solid_estimator.md](./solid_estimator.md)
- 气体：[gas_estimator.md](./gas_estimator.md)

**输出**：
- resourceareas.json（`solid_volume_km3`/`gas_volume_km3`、`theoretical_reserve`、`theoretical_respawn`）

##### 二阶段：逐格算法

**目标**：使用 64k area 网格，逐格计算精确储量。

**算法文档**：
- 固体：[solid_per_block.md](./solid_per_block.md)
- 气体：[gas_per_block.md](./gas_per_block.md)

**输出**：
- resourceareas.json（`reserve`、`respawn`，覆盖一阶段结果）
- resourcearea_blocks.json（每格储量明细）

##### resourcearea_blocks.json 结构

```json
{
  "regions": [
    {
      "ref": "region_ore_medium_01",
      "sector_id": "Cluster_01_Sector001_macro",
      "total": {"ore": 485680, "silicon": 485692},
      "tiles": [
        {"x": 64000, "y": 0, "z": 128000, "wares": {"ore": 40818, "silicon": 40819}},
        {"x": 128000, "y": 0, "z": 128000, "wares": {"ore": 98563, "silicon": 98564}}
      ]
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `ref` | region 模板 ID |
| `sector_id` | 所属 sector |
| `total` | 按 ware 汇总的总储量 |
| `total.<ware>` | 资源类型（如 ore, silicon）及其总储量 |
| `tiles` | 64k area 明细数组 |
| `tiles[].x/y/z` | 64k area 中心坐标 |
| `tiles[].wares` | 该格各 ware 的储量 |

**缓存文件说明：**
- `resourcearea_blocks.json`：新格式缓存，按 ware 汇总（符合游戏存档格式）
- `resourcearea_old_blocks.json`：旧格式缓存（已废弃，保留对比）
- `resourcearea_blocks_game.json`：游戏脚本调试输出（含 field 级别明细，仅用于开发验证）

#### 8.2.2 9.0+ 版本

**输入**：
- maps.json（含 sector.regions）
- regionyield_definitions.json

**处理**：直接引用 definition，无需计算。

**输出**：
- resourceareas.json
- sector.resources（回填到 maps.json）

##### resourceareas.json 生成

Step 2 从 `sector.regions` 和 `regionyield_definitions.json` 生成 resourceareas.json：

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

##### sector.resources 回填

Step 2 从 resourceareas 聚合并回填到 sector：

```json
{
  "id": "Cluster_01_Sector001_macro",
  "resources": [
    {
      "ware": "hydrogen",
      "yield": 1050000,
      "respawn": 1050000,
      "rating": 5
    }
  ]
}
```

#### 8.2.3 最终汇总：sector.resources

**8.0 和 9.0+ 共同汇总到 sector.resources**：

| 字段 | 说明 | 计算方式 |
|------|------|----------|
| `ware` | 资源类型 | 聚合 |
| `reserve` | 总储量 | `Σ(resourcearea.reserve × amount)` |
| `respawn` | 总回复量 | `Σ(resourcearea.respawn × amount)` |
| `theoretical_reserve` | 理论储量（仅 8.0） | `Σ(resourcearea.theoretical_reserve)` |
| `theoretical_respawn` | 理论回复量（仅 8.0） | `Σ(resourcearea.theoretical_respawn)` |
| `rating` | 资源评级（1-5） | 基于 respawn |

### 8.3 数据流图（更新版）

```
┌─────────────────────────────────────────────────────────────────┐
│                         Step 1                                   │
│                     x4_map_processor                             │
├─────────────────────────────────────────────────────────────────┤
│                              │                                   │
│              ┌───────────────┴───────────────┐                  │
│              ▼                               ▼                   │
│        [8.0 版本]                      [9.0+ 版本]              │
│              │                               │                   │
│  输出文件：  │                     输出文件：                    │
│  ├─ regionyields.json           ├─ regionyield_definitions.json│
│  └─ regions.json                │                              │
│              │                               │                   │
│  maps.json:  │                     maps.json:                  │
│  └─ sector.regions               └─ sector.regions             │
│      (ref, position, rotation,       (ref, amount)             │
│       boundary, volume_km3)                                      │
│              │                               │                   │
│  ❌ 不输出：resourceareas.json    ❌ 不输出：resourceareas.json  │
│  ❌ 不输出：sector.resources      ❌ 不输出：sector.resources    │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Step 2                                   │
│                   x4_resource_processor                          │
├─────────────────────────────────────────────────────────────────┤
│                              │                                   │
│              ┌───────────────┴───────────────┐                  │
│              ▼                               ▼                   │
│        [8.0 版本]                      [9.0+ 版本]              │
│              │                               │                   │
│  输入：      │                     输入：                      │
│  ├─ maps.json (sector.regions)   ├─ maps.json (sector.regions) │
│  ├─ regions.json                 └─ regionyield_definitions.json│
│  └─ regionyields.json                        │                   │
│              │                                                   │
│              ▼                                                   │
│  ┌─────────────────────────┐                                     │
│  │  一阶段：估算算法         │                                     │
│  │  ─────────────────────── │                                     │
│  │  公式：                   │                                     │
│  │  固体: V×falloff×density  │                                     │
│  │  气体: V×falloff×density  │                                     │
│  │        /64³              │                                     │
│  │  体积: 2000km 边长封顶    │                                     │
│  │                          │                                     │
│  │  输出: resourceareas.json │                                     │
│  │  (估算产量)              │                                     │
│  └────────────┬────────────┘                                     │
│               ▼                                                  │
│  ┌─────────────────────────┐                                     │
│  │  二阶段：逐格算法         │                                     │
│  │  ─────────────────────── │                                     │
│  │  网格: 15×15×3 64k area  │                                     │
│  │  参考: solid_sum_weights │                                     │
│  │        _replay_v2.py     │                                     │
│  │        gas_sum_weights   │                                     │
│  │        _replay.py        │                                     │
│  │                          │                                     │
│  │  输出: resourceareas.json│                                     │
│  │        (精确产量)         │                                     │
│  │  + resourcearea_blocks   │              ▼                   │
│  │    .json (明细)          │         组装：                      │
│  └─────────────────────────┘         └─ 直接引用 definition     │
│              │                               │                   │
│              └───────────────┬───────────────┘                  │
│                              ▼                                   │
│  输出：                                                         │
│  ├─ resourceareas.json ✓                                        │
│  └─ sector.resources ✓ (回填到 maps.json)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. 模块结构（两步分离后）

### 9.1 目录结构

迁移完成后的最终结构：

```
scripts/processor/
├── step1_map/                  # Step 1: 地图生成
│   ├── __init__.py
│   ├── service.py              # 统一入口: process_step1_map()
│   ├── generator.py            # Map 数据生成
│   ├── converter.py            # 转换逻辑（factions 等）
│   ├── calculator.py           # 基础计算（体积、falloff）
│   └── constants.py            # 常量定义
│
├── step2_resource/             # Step 2: 资源计算
│   ├── __init__.py
│   ├── service.py              # 统一入口: process_step2_resource()
│   ├── model_detector.py       # 版本检测
│   │
│   ├── estimator/              # 一阶段：估算算法
│   │   ├── __init__.py
│   │   ├── solid_estimator.py  # 固体估算
│   │   └── gas_estimator.py    # 气体估算
│   │
│   ├── per_block/              # 二阶段：逐格算法
│   │   ├── __init__.py
│   │   ├── solid_per_block.py  # 固体逐格
│   │   └── gas_per_block.py    # 气体逐格
│   │
│   ├── shared.py               # 共用函数（体积、falloff、网格、聚合）
│   │
│   └── modern_processor.py     # 9.0+ 处理（直接组装）
│
├── shared/                     # 全局共享
│   ├── __init__.py
│   ├── sector/
│   │   ├── parser.py           # Sector 解析
│   │   └── template.py         # Sector 模板
│   ├── utils/
│   │   ├── xml_utils.py
│   │   ├── math_utils.py
│   │   ├── data_utils.py
│   │   └── noise.py
│   └── output_manager.py       # 输出管理
│
├── config.py                   # 保留
├── path_utils.py               # 保留
├── versioning.py               # 保留
├── dlc_tag.py                  # 保留
├── i18n.py                     # 保留
└── __init__.py                 # 保留
```

### 9.2 迁移策略

**采用方案A：先迁移，再修改 step1_map**

```
1. 将 processor/map/*.py 代码复制到 step1_map/
2. step1_map/service.py 改为独立实现（不再委托）
3. 修改 step1_map/ 实现新逻辑
4. 验收通过后删除 processor/map/
```

| 原目录 | 迁移目标 | 当前状态 |
|--------|----------|----------|
| `processor/map/` | `processor/step1_map/` | 🔄 待迁移 |
| `processor/resource/` | `processor/step1_map/` + `processor/step2_resource/` | 🔄 待迁移 |
| `processor/sector/` | `processor/shared/sector/` | ✅ 已迁移 |
| `processor/utils/` | `processor/shared/utils/` | ✅ 已迁移 |
| `processor/output_manager.py` | `processor/shared/output_manager.py` | ✅ 已迁移 |

### 9.3 Step 2 算法模块

算法详细说明见独立文档：

| 算法 | 文档 | 模块路径 |
|------|------|----------|
| 固体估算 | [solid_estimator.md](./solid_estimator.md) | `processor/step2_resource/estimator/solid_estimator.py` |
| 气体估算 | [gas_estimator.md](./gas_estimator.md) | `processor/step2_resource/estimator/gas_estimator.py` |
| 固体明细 | [solid_per_block.md](./solid_per_block.md) | `processor/step2_resource/per_block/solid_per_block.py` |
| 气体明细 | [gas_per_block.md](./gas_per_block.md) | `processor/step2_resource/per_block/gas_per_block.py` |

### 9.4 Step 2 共用函数（`processor/step2_resource/shared.py`）

```python
# ========== 体积计算 ==========
def calculate_volume_km3(boundary: dict, shape_type: str) -> float:
    """计算原始几何体积"""
    pass

def calculate_effective_volume_solid(boundary: dict, position: dict) -> float:
    """固体有效体积（封顶、截断后）"""
    pass

def calculate_effective_volume_gas(boundary: dict, position: dict) -> float:
    """气体有效体积（离散化后）"""
    pass

# ========== Falloff 计算 ==========
def calculate_falloff_factors(falloff_def: dict) -> tuple:
    """计算 lateral_factor 和 radial_factor"""
    pass

def calculate_falloff_at_point(point: dict, region_data: dict) -> float:
    """计算某点的 falloff 值"""
    pass

# ========== 网格枚举 ==========
def enumerate_64k_blocks(boundary: dict, position: dict) -> list:
    """枚举命中的 64k area 方块坐标"""
    pass

def is_block_intersect_cylinder(block: dict, cylinder: dict) -> bool:
    """方块与圆柱相交检测"""
    pass

def is_block_intersect_sphere(block: dict, sphere: dict) -> bool:
    """方块与球体相交检测"""
    pass

def is_block_intersect_box(block: dict, box: dict) -> bool:
    """方块与盒体相交检测"""
    pass

def is_block_intersect_splinetube(block: dict, spline: dict) -> bool:
    """方块与管道相交检测"""
    pass

# ========== 聚合 ==========
def aggregate_sector_resources_from_resourceareas(
    resourceareas_rows: list,
    model: str = "regions",
) -> dict:
    """聚合 sector.resources"""
    pass

def calculate_rating(respawn: float) -> int:
    """基于 respawn 计算 rating (1-5)"""
    pass
```

### 9.5 模块依赖图

```
processor/step2_resource/service.py
        │
        ├── estimator/
        │   ├── solid_estimator.py  ──┐
        │   └── gas_estimator.py    ──┤
        │                            │
        ├── per_block/               │
        │   ├── solid_per_block.py ──┤
        │   └── gas_per_block.py   ──┤
        │                            │
        └── modern_processor.py      │
                                 ▼
                            shared.py
```

---

## 11. 验收办法

### 10.1 验收目标

验证 Step 2 资源计算模块的正确性，通过对比游戏逆向脚本输出与处理器输出。

### 10.2 验收脚本

修改 `scripts/x4-game/` 目录下的脚本：

| 脚本 | 用途 |
|------|------|
| `solid_sum_weights_replay_v2.py` | 固体资源验收 |
| `gas_sum_weights_replay.py` | 气体资源验收 |

### 10.3 新增参数

验收脚本保持原有默认行为，新增可选参数：

```bash
# 原有行为（单个星区、完整有效空间）
python scripts/x4-game/solid_sum_weights_replay_v2.py Cluster_03_Sector001_macro p1_40km_ice_field

# 验收模式：计算所有星区，使用 15x15x3 网格
python scripts/x4-game/solid_sum_weights_replay_v2.py --all-sectors --cut-mode 15x15x3 --output-dir analysis/resources/
python scripts/x4-game/gas_sum_weights_replay.py --all-sectors --cut-mode 15x15x3 --output-dir analysis/resources/
```

**参数说明**：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--all-sectors` | - | 计算所有星区 |
| `--output-dir` | - | 输出目录（默认不输出文件） |
| `--cut-mode` | `full` | 网格范围模式 |

### 10.4 网格范围模式

`--cut-mode` 参数对应预设的网格范围配置：

| 模式 | X/Z 范围 | Y 范围 | 说明 |
|------|----------|--------|------|
| `full` | [-960km, +1024km] | [-960km, +1024km] | 完整有效空间（默认） |
| `15x15x3` | [-480km, +480km] | [-96km, +96km] | 15×15×3 64k area 网格 |

**15x15x3 模式详情**：

| 方向 | 格数 | 中心点范围 |
|------|------|------------|
| X | 15 | [-480km, +480km] |
| Y | 3 | [-96km, +96km] |
| Z | 15 | [-480km, +480km] |

### 10.5 输出文件

**验收脚本输出**（`analysis/resources/`）：

| 文件 | 说明 |
|------|------|
| `resourcearea_blocks_game.json` | 游戏脚本输出的方块明细（真值） |

**Step 2 输出**：

| 文件 | 输出目录 | 说明 |
|------|----------|------|
| `resourcearea_blocks.json` | `analysis/resources/` | 方块明细（固定路径，用于验收比对） |
| `resourceareas.json` | 输入 json 所在目录 | 资源区数据（自动推断） |
| `maps.json`（更新） | 输入 json 所在目录 | 回填 sector.resources |

> 例如：输入 `src/assets/x4_game_data/8.0-Diplomacy/data/maps.json`
> → 输出 `src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json`

### 10.6 输出格式

两个文件使用相同格式：

```json
[
  {
    "sector_id": "Cluster_01_Sector001_macro",
    "regions": [
      {
        "region_ref": "region_ore_medium_01",
        "resources": [
          {
            "ore": [
              {"x": 0, "y": 0, "z": 0, "reserve": 1017374},
              {"x": 64000, "y": 0, "z": 0, "reserve": 985632}
            ]
          }
        ]
      }
    ]
  }
]
```

### 10.7 验收流程

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: 整体验收                                                │
├─────────────────────────────────────────────────────────────────┤
│  1.1 运行验收脚本（所有星区）                                      │
│      python scripts/x4-game/solid_sum_weights_replay_v2.py \    │
│          --all-sectors --cut-mode 15x15x3 \                     │
│          --output-dir analysis/resources/                       │
│                                                                  │
│      python scripts/x4-game/gas_sum_weights_replay.py \         │
│          --all-sectors --cut-mode 15x15x3 \                     │
│          --output-dir analysis/resources/                       │
│                                                                  │
│  1.2 运行处理器（所有星区）                                        │
│      python scripts/processor/x4_resource_processor.py          │
│                                                                  │
│  1.3 整体比对                                                     │
│      python scripts/processor/verify_resource_blocks.py         │
│      → 输出差异报告到 analysis/resources/verify_report.json     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: 定位差异                                                 │
├─────────────────────────────────────────────────────────────────┤
│  verify_report.json 示例：                                       │
│  {                                                               │
│    "summary": {                                                  │
│      "total_sectors": 156,                                       │
│      "passed_sectors": 142,                                      │
│      "failed_sectors": 14                                        │
│    },                                                            │
│    "failed_details": [                                           │
│      {                                                           │
│        "sector_id": "Cluster_03_Sector001_macro",               │
│        "regions": [                                              │
│          {                                                       │
│            "region_ref": "p1_40km_ice_field",                   │
│            "block_count_diff": 2,                                │
│            "reserve_diff_percent": 1.5                           │
│          }                                                       │
│        ]                                                         │
│      }                                                           │
│    ]                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: 调整算法                                                 │
├─────────────────────────────────────────────────────────────────┤
│  针对差异原因修改对应算法模块：                                     │
│  - 碰撞检测差异 → per_block/*.py                                  │
│  - Falloff 计算差异 → shared.py                                   │
│  - Noise 差异 → solid_per_block.py                               │
│  - 体积计算差异 → estimator/*.py                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: 单 Sector 验收                                          │
├─────────────────────────────────────────────────────────────────┤
│  针对有差异的 sector 逐个验收：                                     │
│                                                                  │
│  python scripts/processor/x4_resource_processor.py \            │
│      --sector Cluster_03_Sector001_macro                        │
│                                                                  │
│  输出：                                                          │
│  [验算] Sector: Cluster_03_Sector001_macro                      │
│  [验算] 方块数量: game=156, processor=156 ✓                      │
│  [验算] reserve 总量: game=12345678, processor=12345612, 差异=0.005% ✓
│  [验算] 通过                                                     │
│                                                                  │
│  循环直到所有差异 sector 通过验收                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 10.8 增量更新

当使用 `--sector` 参数指定单个星区时：

| 文件 | 行为 |
|------|------|
| `maps.json` | 仅更新指定 sector 的 `resources` 字段 |
| `resourceareas.json` | 仅更新指定 sector 的 areas 数据 |
| `resourcearea_blocks.json` | 仅更新指定 sector 的方块明细 |

**注意**：增量更新不会修改其他 sector 的数据，允许按需验算单个星区。

### 10.9 验算输出

`--sector` 模式下，处理器自动读取 `resourcearea_blocks_game.json` 并进行验算比对：

```bash
python scripts/processor/x4_resource_processor.py \
    --sector Cluster_03_Sector001_macro

# 输出示例：
# [验算] Sector: Cluster_03_Sector001_macro
# [验算] 方块数量: game=156, processor=156 ✓
# [验算] reserve 总量: game=12345678, processor=12345612, 差异=0.005% ✓
# [验算] 通过
```

**验算结果字段**：

| 字段 | 说明 |
|------|------|
| `sector_id` | 星区 ID |
| `block_count_match` | 方块数量是否一致 |
| `game_block_count` | 真值方块数量 |
| `processor_block_count` | 处理器方块数量 |
| `reserve_diff_percent` | 储量差异百分比 |
| `passed` | 是否通过验算（差异 < 0.01%） |

### 10.8 验收标准

| 检查项 | 标准 |
|--------|------|
| 星区数量 | 完全一致 |
| 每个 region 的方块数量 | 完全一致 |
| 每个方块的坐标 | 完全一致 |
| 每个方块的 reserve | 相对误差 < 0.01% |

---

## 12. 更新记录

| 日期 | 变更内容 | 作者 |
|------|----------|------|
| 2026-03-18 | 初始版本，基于当前 processor 实现整理 | - |
| 2026-03-18 | 删除无效的 Region 修正因子（density, noise_probability）和 Field 因子相关描述；补充气体 block 算法和截断算法 | - |
| 2026-03-18 | 更新 yield/respawn 说明为未经 amount 乘法的值；移除 falloff.effective_factor；9.0+ 不生成 regionyields.json；统一使用 aggregate_sector_resources_from_resourceareas()；更新 resourceareas.json 结构为 resources 数组格式 | - |
| 2026-03-19 | 补充 generate_gas_block_coordinates() 函数说明；更新 aggregate_sector_resources_from_resourceareas() 支持四个字段独立聚合（yield/respawn/total_yield/total_respawn）；更新 Rating 计算为基于 respawn 的 5 级评级 | - |
| 2026-03-19 | 统一文档中所有 `sector.resources` 包含 `total_yield`/`total_respawn`/`rating` 字段；更新 1.3.5 明确 rating 计算仅用于 sector.resources | - |
| 2026-03-20 | 更新 1.4.3 resourceareas.json (8.0) 示例以匹配实际输出（包含 boundary 字段）；更新 2.4.2 resourceareas.json (9.0+) 示例以包含 rating 字段（来自 definition）；更新 2.4.3 说明 9.0+ sector.resources 不包含 total_yield/total_respawn；恢复 1.4.3 中的 position 字段 | - |
| 2026-03-21 | 更新 `total_volume_km3` / `volume_km3` / `total_yield` / `yield` 口径：固体统一为体积 × falloff × 密度，气体统一为体积 × falloff × 密度 / `64^3`；将旧的 `512×512×192` 截断描述替换为 `[-960km, +1024km]` 有效空间与 `2000km` 封顶规则，并补充 `box` 几何口径 | - |
| 2026-03-22 | 新增「架构重构：两步分离」章节；新增「两步分离字段划分」章节，明确 8.0/9.0+ 版本分叉和 Step 1/Step 2 职责边界；Step 1 停止输出 resourceareas.json 和 sector.resources；sector 引用字段统一命名为 `regions`；8.0 regions 增加 boundary 和 volume_km3；补充 Step 2 的 8.0 两阶段处理（估算→逐格）和 resourcearea_blocks.json 结构；更新数据流图以展示两阶段结构 | - |
| 2026-03-22 | 新增「模块结构（两步分离后）」章节，定义 step1_map/、step2_resource/、shared/ 目录结构；明确 estimator/（固体估算、气体估算）和 per_block/（固体逐格、气体逐格）四个算法模块；定义 shared.py 共用函数；列出删除清单（原 map/、resource/、sector/、utils/ 目录） | - |
| 2026-03-22 | 文档整理：删除过期内容（Section 2 模块结构、Section 4 统一服务入口、Section 6 数据流图）；更新 Section 5 设计决策；重新编号 Section 1-10 | - |
| 2026-03-22 | 字段重命名：`yield` → `reserve`，`total_yield` → `theoretical_reserve`；新增 `solid_volume_km3` / `gas_volume_km3` 字段；有效空间修正为 `[-1024km, +1024km]`；半径上限修正为 `1024km` | - |
| 2026-03-22 | 算法文档分离：创建 `solid_estimator.md`、`gas_estimator.md`、`solid_per_block.md`、`gas_per_block.md` 四个独立算法文档；design.md 仅保留引用 | - |
| 2026-03-22 | 新增「验收办法」章节：定义 `--all-sectors` 和 `--output-dir` 参数；网格范围限制为 15×15×3；输出到 `analysis/resources/`；定义比对流程和验收标准 | - |
| 2026-03-22 | 验收参数优化：使用 `--cut-mode` 参数切换网格范围（`full` / `15x15x3`），保持原有默认行为；处理器支持 `--sector` 参数指定单个星区 | - |
| 2026-03-22 | 新增「实施方案」章节：采用方案B（边实施边参考现有代码），文档覆盖80%核心逻辑，缺失细节参考 replay 脚本 | - |
| 2026-03-22 | 验收流程更新：整体验收 → 定位差异 → 调整算法 → 单 Sector 验收的循环流程 | - |

---

**文档完成时间**: 2026-03-22
