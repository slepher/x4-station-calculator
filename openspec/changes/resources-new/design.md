# resources-new 设计说明

## 设计目标
本次设计聚焦在地图资源数据处理脚本的版本感知扩展，而不是同步重写前端资源消费模型。
设计要解决三件事：
- 让旧版 `regions` 资源链路继续稳定工作；
- 让 `9.0+` 切换到新版资源区定义链路；
- 让现有前端在不立即改造的前提下继续读取可用的 `maps.json` 资源数据。

## 1. 总体架构

### 1.1 资源模型分流点
- 资源模型分流放在 Python 数据处理脚本入口层。
- 具体由 `x4_data_processor.py` / `x4_data_map_processor.py` 在运行时根据当前版本号决定。
- 版本判定规则使用主版本号比较：
  - `< 9` 使用 `regions` 模型
  - `>= 9` 使用 `resourceareas` 模型

### 1.2 产物策略
- `< 9`
  - `maps.json`（含 `sector.resources` 聚合摘要）
  - `regions.json`（纯 region 定义，不含 fields，含 resources 计算结果）
  - `resourceareas.json`（region 到 sector 的引用关系，对齐 9.0 格式）
  - `regionyields.json`（扩展结构，含 replenishtime/gatherspeedfactor）
- `>= 9`
  - `maps.json`（含 `sector.resources` 按 ware 聚合）
  - `resourceareas.json`（资源区数组，带 cluster_id/sector_id）
  - `regionyield_definitions.json`（definition 数组）
  - `regionyields.json = []`（空数组占位）

### 1.3 兼容性策略
- `regionyields.json` 在 `9.0+` 不删除文件，只写空数组。
- 理由是当前前端加载链路仍会请求该文件。
- 保持文件存在可以避免把"资源模型升级"扩散成"前端初始化失败修复"。

## 2. 数据来源设计

### 2.1 `regionyield_definitions.json` 来源
- 解析 `regionyields_final.xml` 中各个 `definition` 节点。
- 每个模板定义提取：
  - 基础标识：`id`、`ware`、`tag`
  - 产能参数：`yield`、`respawndelay`
  - 展示参数：`rating`、`scaneffect`、`scaneffectintensity`、`scaneffectcolor`
  - 尺寸参数：从 `boundary/size/@r` 读取 `radius`
  - 类型系数：`objectyieldfactor` 或 `gatherspeedfactor`
- 额外派生：
  - `size`：从 `id` 命名中提取 `tiny/small/medium/large`
  - `sustainableYieldPerHour = yield / respawnDelay * 60`

### 2.2 `regionyield_definitions.json` 结构
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
  },
  ...
]
```

### 2.3 `resourceareas.json` 来源
- 解析 `mapdefaults_final.xml` 中各个 `dataset macro="<sector>"` 下的 `<resourceareas>`。
- 通过 `ref` 关联 `regionyield_definitions` 中的定义。
- 输出为数组，每条记录包含：
  - `ref`：资源区定义引用
  - `amount`：该类型资源球数量
  - `ware`：资源类型（来自 definition）
  - `rating`：星级评分（来自 definition）
  - `yield`：单个资源球产量（来自 definition）
  - `delay`：重生时间（来自 definition）
  - `factor`：采集系数（来自 definition，自动选择 objectyieldfactor 或 gatherspeedfactor）
  - `cluster_id`：所属 cluster（派生）
  - `sector_id`：所属 sector（派生）

### 2.4 `resourceareas.json` 结构
```json
[
  {
    "ref": "sphere_medium_hydrogen_medium",
    "amount": 7,
    "ware": "hydrogen",
    "rating": 10.0,
    "yield": 150000.0,
    "delay": 60.0,
    "factor": 1.0,
    "respawn": 150000.0,
    "cluster_id": "Cluster_01_macro",
    "sector_id": "Cluster_01_Sector001_macro"
  },
  ...
]
```

其中 `respawn` 字段计算方式：
```
respawn = yield × 60 / delay  (= sustainableYieldPerHour)
```

### 2.5 `regions.json` 来源（8.0 版本）
- 解析 `regions_final.xml` 中各 region 定义。
- **不再解析 `fields` 节点**，废弃相关字段。
- 输出为数组，每条记录包含：
  - `id`：region 名称
  - `density`：区域密度
  - `rotation`：旋转角度
  - `noisescale`：噪声缩放
  - `seed`：随机种子
  - `minnoisevalue`：最小噪声值
  - `maxnoisevalue`：最大噪声值
  - `boundary`：边界形状（sphere/cylinder/splinetube）
  - `falloff`：衰减曲线
  - `resources`：计算后的资源产出数组（见下方结构）

### 2.6 `regions.json` 结构（8.0 版本）
```json
[
  {
    "id": "region_ore_medium_01",
    "density": 1.5,
    "rotation": 0,
    "noisescale": 0,
    "seed": 0,
    "minnoisevalue": 0,
    "maxnoisevalue": 1,
    "boundary": {
      "class": "cylinder",
      "size": { "r": 25000, "linear": 5000 }
    },
    "falloff": {
      "lateral": [...],
      "radial": [...],
      "lateral_factor": 0.9,
      "radial_factor": 0.63,
      "effective_factor": 0.567
    },
    "resources": [
      {
        "ware": "ore",
        "amount": 150000,
        "rating": 10,
        "yield": 150000,
        "delay": 30.0,
        "factor": 1,
        "respawn": 300000,
        "volume_km3": 125.6,
        "falloff_factor": 0.9,
        "noise_probability": 0.35
      }
    ]
  },
  ...
]
```

**废弃字段说明：**
- `fields`：不再使用，相关数据已从输出中移除
- `cluster_id` / `sector_id`：移至 `resourceareas.json`
- `ref` / `amount`：移至 `resourceareas.json`

### 2.7 `resourceareas.json` 来源（8.0 版本）
- 解析 `mapdefaults_final.xml` 中各 sector 对 region 的引用。
- 通过 `region_ref` 关联 `regions.json` 中的定义。
- 输出为数组，每条记录包含：
  - `ref`：region 定义引用
  - `amount`：该 region 在 sector 中被引用的次数
  - `ware`：资源类型（来自 region.resources）
  - `rating`：星级评分（来自 region.resources）
  - `yield`：产量（来自 region.resources）
  - `delay`：重生时间（来自 region.resources）
  - `factor`：采集系数（来自 region.resources）
  - `respawn`：每小时持续产量（来自 region.resources）
  - `cluster_id`：所属 cluster（派生）
  - `sector_id`：所属 sector（派生）

### 2.8 `resourceareas.json` 结构（8.0 版本）
```json
[
  {
    "ref": "region_ore_medium_01",
    "amount": 3,
    "ware": "ore",
    "rating": 10,
    "yield": 150000,
    "delay": 30.0,
    "factor": 1,
    "respawn": 300000,
    "cluster_id": "Cluster_01_macro",
    "sector_id": "Cluster_01_Sector001_macro"
  },
  ...
]
```

### 2.9 8.0 版本 yield 计算链路
```
yield = volume_km3 × falloff_factor × noise_probability
        × region_density × densityfactor × resourcedensity

其中:
- volume_km3 = boundary_volume(boundary) / 10^9
- falloff_factor = lateral_factor × radial_factor
- noise_probability = noise_probability(minnoisevalue, maxnoisevalue)
- region_density = region.@density
- densityfactor = field.@densityfactor 或 field.@uniformdensity
- resourcedensity = 查表(ware, yield_name)

delay = replenishtime / 60  (小时)
sustainableYieldPerHour = yield × 60 / delay
```

### 2.10 8.0 版本 boundary_volume 计算

单位：XML 中坐标和半径的单位为米（m），计算结果转换为 km³（除以 10^9）。

**体积上限限制：**
- **Sphere**: 半径 > 200km 时按圆柱体计算（r=200km, h=80km）
- **Cylinder**: 半径最大 200 km，高度最大 80 km
- **Splinetube**: 总长度最大 1000 km，半径最大 200 km

**计算公式：**

- **sphere** (r ≤ 200km): `(4/3) × π × r³ / 10^9`
- **sphere** (r > 200km): `π × 200000² × 80000 / 10^9`（按圆柱体计算）
- **cylinder**: `π × min(r, 200000)² × min(linear, 80000) / 10^9`
- **splinetube**: `π × min(r, 200000)² × min(spline_length, 1000000) / 10^9`
  - `spline_length` = 所有控制点距离之和

**上限值（米）：**
| 类型 | 半径上限 | 高度/长度上限 |
|------|----------|---------------|
| sphere | 200,000 m (200 km) | 80,000 m (80 km) 仅当超限时 |
| cylinder | 200,000 m (200 km) | 80,000 m (80 km) |
| splinetube | 200,000 m (200 km) | 1,000,000 m (1000 km) |

### 2.11 8.0 版本 rating 映射表

#### 普通矿物（非 Nividium）

按 yield 值查表：

| yield 范围 | rating |
|------------|--------|
| ≤ 5000 | 1 |
| ≤ 10000 | 2 |
| ≤ 15000 | 3 |
| ≤ 25000 | 4 |
| ≤ 35000 | 5 |
| ≤ 50000 | 6 |
| ≤ 100000 | 9 |
| ≤ 150000 | 10 |
| ≤ 250000 | 11 |
| ≤ 350000 | 12 |
| ≤ 500000 | 13 |
| ≤ 750000 | 14 |
| ≤ 1000000 | 15 |

#### N 矿（Nividium）

N 矿 yield 值约为普通矿物的 1/10，使用独立的 rating 映射表：

| yield 范围 | rating |
|------------|--------|
| ≤ 500 | 1 |
| ≤ 1000 | 2 |
| ≤ 1500 | 3 |
| ≤ 5000 | 6 |
| ≤ 10000 | 9 |
| ≤ 15000 | 10 |
| ≤ 25000 | 11 |
| ≤ 35000 | 12 |
| ≤ 50000 | 13 |
| ≤ 75000 | 14 |
| ≤ 100000 | 15 |

识别方式：`ware == "nividium"`

### 2.12 `regionyields.json` 扩展结构（8.0 版本）
在原有基础上扩展，增加 `replenishtime` 和 `gatherspeedfactor` 字段：

```json
[
  {
    "ware": "helium",
    "yields": [
      {
        "name": "lowest",
        "resourcedensity": 300,
        "replenishtime": 180,
        "gatherspeedfactor": 1.0
      },
      ...
    ]
  },
  ...
]
```

注意：
- 气体资源有 `gatherspeedfactor` 字段
- 固体资源 `gatherspeedfactor` 设为 `1`

## 3. `maps.json` 资源数据设计

### 3.1 sector 资源数据结构（8.0 和 9.0 统一）

每个 sector 只包含 `resources` 字段，8.0 和 9.0 使用相同的计算方式：

```json
{
  "id": "Cluster_01_Sector001_macro",
  "resources": [
    {
      "ware": "hydrogen",
      "amount": 1550000.0,
      "respawn": 1650000.0
    }
  ]
}
```

### 3.2 `resources` 字段说明（统一计算方式）

按 `ware` 聚合的统计信息：

| 字段 | 计算规则 |
|------|----------|
| `ware` | 资源类型 |
| `amount` | `sum(yield * amount)` |
| `respawn` | `sum(yield * 60 / delay * amount)` = `sum(sustainableYieldPerHour * amount)` |

其中：
- `yield`：单次采集产量（来自 definition 或 region 计算）
- `delay`：重生时间（小时）= `replenishtime / 60`
- `sustainableYieldPerHour` = `yield × 60 / delay`

## 4. 代码组织设计

### 4.1 保留旧函数，新增新函数
- 旧版函数保留：
  - 旧 `migrate_regionyields()`
  - 旧 `load_region_definition_resources()`
- 新版新增：
  - `detect_map_resource_model(version_str)`
  - `migrate_resourcearea_definitions(regionyields_xml_path)`
  - `migrate_sector_resourceareas(mapdefaults_xml_path)`
  - `build_resourceareas_array(...)` → 返回带 cluster_id/sector_id 的数组
  - `build_sector_resources_from_resourceareas(...)`
- 8.0 版本新增：
  - `build_80_resourceareas_array(...)` → 从 region 引用生成 resourceareas.json

### 4.2 入口层职责
- `x4_data_map_processor.py` 负责：
  - 根据版本号确定当前资源模型
  - 具体解析 XML
  - 生成 `maps.json` 所需 payload
  - 生成 `resourceareas.json` 和 `regionyield_definitions.json`
  - 8.0 版本生成 `regions.json`（纯定义）和 `resourceareas.json`（引用关系）

### 4.3 明确避免的设计
- 不在同一个函数中同时兼容旧版 `<resource><yield>` 和新版 `<definition>`。
- 不把新版 `definition` 强行适配回旧版 `regionyields.json` 语义。
- 不让前端通过读取空 `regionyields.json` 反推出新版资源能力。
- **不再使用 `fields` 节点数据进行计算**，该字段已从输出中移除。

## 5. 风险与对策

### 5.1 风险：版本字符串解析错误
- 对策：版本判定只取主版本号并转成数字比较，不依赖 `beta` 文案或 folder 名。

### 5.2 风险：前端依赖 `regionyields.json` 中的颜色和 yield 顺序
- 对策：本次先保留 `maps.json` 聚合数据，后续若前端出现空数据退化，再单独发起前端消费收敛变更。

### 5.3 风险：旧逻辑与新逻辑混在一起继续腐化
- 对策：旧 `regions` 与新 `resourceareas` 解析路径明确拆分，产物也分离。