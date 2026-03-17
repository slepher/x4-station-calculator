# map-resource-algorithm 需求说明

## 目标

简化并重构 8.0 版本的资源计算算法，移除复杂的 fields/noise/factor 计算链路，采用更直接的几何 + falloff 一元计算方式。

**核心架构变更**：将模板数据（regions.json）与实例计算结果（resourceareas.json）分离。
- **regions.json**：仅包含资源的模板定义（ware 基础属性）
- **resourceareas.json**：包含实例级别的计算结果（位置、falloff、体积/方块数、产量）

---

## 核心变更

### 1. 移除的数据依赖

- **不再使用 `<fields>` 节点数据**
- **不再计算 `densityfactor`、`objectyieldfactor`、`gatherspeedfactor` 等系数**
- **不再使用 noise 相关的概率修正**
- **不再计算 `resources_*` 多个变体，直接输出 `resources`**

### 2. 坐标转换规则（气体资源）

气体资源需要将 region 坐标转换到 sector 坐标系：

```
region 相对 sector 坐标 = region 世界坐标 - cluster 对应 sector 的坐标
```

- 如果 region 有坐标，则将 region 坐标视为对应 cluster 的坐标
- 如果 cluster 有多个 sector，则找到 sector 对应 cluster 的坐标
- 将 region 相对 cluster 坐标转化为 region 相对 sector 的坐标

### 3. 截断规则（几何范围限制）

| 资源类型 | 维度 | 截断范围 |
|----------|------|----------|
| **固体** | X/Z 平面 | `[-256km, +256km]` |
| **固体** | Y 轴（高度） | `[-96km, +96km]`（圆柱体最大高度 192km） |
| **气体** | X/Z 平面 | `[-256km, +256km]` |
| **气体** | Y 轴（高度） | `[-64km, +64km]` |

### 4. 高度最小值规则

- 气体资源：高度 `< 64km` 按 `64km` 计算

---

## 资源算法

### 统一公式

```
最终产量 = 基础量 × falloff × resourcedensity
```

| 资源类型 | 基础量 |
|----------|--------|
| **固体** | 有效体积 |
| **气体** | 有效方块数量 |

### Falloff 计算

```
falloff = lateral × radial
```

- **lateral**：横向 falloff 一元计算
- **radial**：径向 falloff 一元计算
- 两者独立计算后相乘

---

## 固体资源详细算法

### 体积计算

| 形状 | 体积计算方式 |
|------|--------------|
| **圆柱形/球形** | 以 region 中心点为中心，截断为 256km×256km×192km 的圆柱（最大体积按此计算，不采用截断后积分重合的部分） |
| **Tube** | 截断 X、Z 轴超过 ±256km 的部分，falloff 不变 |

### 产量公式

```
yield = volume × (lateral × radial) × resourcedensity
```

---

## 气体资源详细算法

### 64km³ 方块网格

- 将 sector 空间划分为 64km × 64km × 64km 的立方体网格
- 方块中心限制在 sector 绝对坐标轴范围内：
  - X 轴：`[-256km, +256km]` → 9 个方块
  - Z 轴：`[-256km, +256km]` → 9 个方块
  - Y 轴：`[-64km, +64km]` → 3 个方块
  - **总计**：9 × 3 × 9 = 243 个方块

### 方块命中判断

1. 根据 region 相对 sector 坐标 + 形状，判断命中哪些方块
2. 统计命中方块数量

### 产量公式

```
yield = hit_block_count × (lateral × radial) × resourcedensity
```

---

## 输出字段变更

### 架构变更：regions.json vs resourceareas.json

**regions.json** - 模板数据（不含坐标，无法进行截断计算）：

每个 region 的 resources 数组元素包含：

```json
{
  "ware": "ware_name",           // 资源类型
  "resourcedensity": 1.0,        // 资源密度
  "delay": 60.0,                 // 重生时间（秒）
  "gatherfactor": 1.0,           // 采集效率系数
  "yield_name": "resource_name"  // 产量名称标识
}
```

**resourceareas.json** - 实例计算结果（含坐标，可进行完整计算）：

每个 resourcearea 元素包含：

```json
{
  "ref": "region_id",                  // 引用的 region ID
  "amount": 1,                         // 实例数量
  "position": {"x": 0, "y": 0, "z": 0}, // 世界坐标

  // Falloff 因子
  "lateral_factor": 0.55,              // 横向 falloff
  "radial_factor": 0.46,               // 径向 falloff
  "falloff_factor": 0.253,             // lateral × radial

  // 体积/方块数（用于计算产量）
  "total_blocks": 19,                  // 总方块数（仅气体）
  "blocks": 15,                        // 有效方块数（仅气体）
  "total_volume_km3": 5026548,         // 截断前体积（仅固体）
  "volume_km3": 4000000,               // 截断后有效体积（仅固体）

  // 计算后的资源数据
  "resources": [
    {
      "ware": "ware_name",
      "resourcedensity": 1.0,
      "total_yield": 1000,             // 资源总量（截断前）
      "total_respawn": 100,            // 总重生量（截断前）
      "yield": 800,                    // 有效资源量（截断后）
      "respawn": 80,                   // 有效重生量（截断后）
      "density": 0.2,                  // 有效密度 = yield / volume_km3
      "respawn_density": 0.02,         // 有效重生密度 = respawn / volume_km3
      "gatherfactor": 1.0              // 采集效率
    }
  ]
}
```

### 字段说明

| 字段 | 位置 | 含义 |
|------|------|------|
| `ware` | 两者 | 资源类型名称 |
| `resourcedensity` | 两者 | 基础资源密度 |
| `delay` | regions.json | 重生时间（秒） |
| `gatherfactor` | 两者 | 采集效率系数 |
| `yield_name` | regions.json | 产量名称标识 |
| `ref` | resourceareas.json | 引用的 region ID |
| `amount` | resourceareas.json | 实例数量 |
| `position` | resourceareas.json | 世界坐标（用于截断计算） |
| `lateral_factor` | resourceareas.json | 横向 falloff 因子 |
| `radial_factor` | resourceareas.json | 径向 falloff 因子 |
| `falloff_factor` | resourceareas.json | 总 falloff = lateral × radial |
| `total_blocks` | resourceareas.json | 总方块数（仅气体资源） |
| `blocks` | resourceareas.json | 有效方块数（仅气体资源） |
| `total_volume_km3` | resourceareas.json | 截断前体积（仅固体资源） |
| `volume_km3` | resourceareas.json | 截断后有效体积（仅固体资源） |
| `total_yield` | resourceareas.json | 截断前资源总量 |
| `total_respawn` | resourceareas.json | 截断前总重生量 |
| `yield` | resourceareas.json | 截断后有效资源量 |
| `respawn` | resourceareas.json | 截断后有效重生量 |
| `density` | resourceareas.json | 有效密度 = yield / volume_km3 |
| `respawn_density` | resourceareas.json | 有效重生密度 = respawn / volume_km3 |

---

## XML 解析变更

### 支持 `<boundaries>` 容器格式

部分 region（如 `c601s1_region1`）使用 `<boundaries><boundary .../></boundaries>` 容器格式，而非直接的 `<boundary>` 节点。

**修改点：**
1. `build_boundary()` 函数支持两种 XML 结构
2. 调用时先查找 `./boundary`，未找到则查找 `./boundaries`

---

## regions.json 输出过滤

- **过滤掉 `resources` 为空或不存在的 region**
- 8.0 版本从 317 个减少到 236 个有效 region
- **仅保留 yield_info_map 字段**：ware, resourcedensity, delay, gatherfactor, yield_name
- **移除 noise 相关字段**：density, rotation, noisescale, seed, minnoisevalue, maxnoisevalue, noise_probability

---

## Resource 计算逻辑

### 数据流

1. **regions.json**：从 XML 解析 region 定义，提取 ware 基础属性
   - 解析 `<region>` 节点的 `<resources>` 子节点
   - 提取 ware、resourcedensity、replenishtime 等基础字段
   - 过滤空 resources 的 region

2. **resourceareas.json**：基于 region 模板 + 位置信息进行实例计算
   - 引用 regions.json 中的 ware 基础属性
   - 计算 falloff 因子（lateral × radial）
   - 计算体积/方块数（应用截断规则）
   - 计算最终产量：yield = base × falloff × resourcedensity

### 每个 Region 需要计算（在 resourceareas 级别）

| 计算项 | 固体资源 | 气体资源 |
|--------|----------|----------|
| 体积 | ✓ 有效体积 | - |
| 方块数量 | - | ✓ 总方块数量、有效方块数量 |
| falloff | ✓ lateral × radial | ✓ lateral × radial |

### 计算顺序

```
region 定义 (XML)
  ↓
regions.json (模板：ware, resourcedensity, delay, gatherfactor, yield_name)
  ↓
resourceareas.json (实例：ref, amount, position, falloff 因子，体积/方块数，计算后的 resources)
```

---

## 边界

### In Scope

- 移除 fields 相关解析和计算
- 移除 factor/noise 相关计算
- 实现固体资源截断规则（圆柱/球形 256km×256km×192km，tube X/Z±256km）
- 实现气体资源 64km³ 方块网格算法
- 实现气体坐标转换（region → cluster → sector）
- 实现气体方块命中判断（X/Z: ±256km, Y: ±64km）
- 实现 falloff 一元计算（lateral × radial）
- 支持 `<boundaries>` 容器格式
- 过滤空 resources 的 region
- 新增 total_yield/total_respawn/yield/respawn 字段

### Out of Scope

- 9.0 版本算法（保持现有逻辑）
- 前端 UI 改造

---

## 验收标准（DoD）

1. [ ] `regions.json` 中不再包含 resources 为空的元素
2. [ ] `regions.json` 仅包含模板字段（ware, resourcedensity, delay, gatherfactor, yield_name）
3. [ ] `regions.json` 移除了 noise 相关字段（density, rotation, noisescale, seed, minnoisevalue, maxnoisevalue, noise_probability）
4. [ ] `resourceareas.json` 包含 ref, amount, position 字段
5. [ ] `resourceareas.json` 包含 falloff 因子（lateral_factor, radial_factor, falloff_factor）
6. [ ] `resourceareas.json` 包含体积/方块数字段（气体：total_blocks, blocks；固体：total_volume_km3, volume_km3）
7. [ ] `resourceareas.json` 的 resources 包含计算结果（total_yield, total_respawn, yield, respawn, density, respawn_density）
8. [ ] 固体资源圆柱/球形正确截断为 256km×256km×192km
9. [ ] 固体资源 tube 正确截断 X/Z 轴±256km
10. [ ] 气体资源坐标正确转换（region → cluster → sector）
11. [ ] 气体资源 64km³ 方块网格命中判断正确
12. [ ] 气体方块数量限制在 X/Z: ±256km (9×9), Y: ±64km (3)
13. [ ] falloff 采用一元计算（lateral × radial）
14. [ ] `<boundaries>` 容器格式的 splinetube 正确解析

---

## 当前进度

- [x] 支持 `<boundaries>` 容器格式的 splinetube 解析
- [x] 过滤空 resources 的 region（317 → 236）
- [x] 确定新架构：regions.json（模板）+ resourceareas.json（实例计算）
- [ ] 实现 regions.json 输出（仅 yield_info_map 字段）
- [ ] 实现 resourceareas.json 计算逻辑
  - [ ] 气体资源坐标转换（region → cluster → sector）
  - [ ] 气体资源 64km³ 方块网格算法
  - [ ] 固体资源截断规则
  - [ ] falloff 一元计算（lateral × radial）
  - [ ] 计算 total_yield/total_respawn/yield/respawn/density/respawn_density

---

## 未决项

无。

---

## 附录：数据结构总览

### regions.json 结构

```json
[
  {
    "id": "region_id",
    "race": "faction_id",
    "boundary": {
      "class": "cylinder|sphere|splinetube",
      "size": { "r": 100000, "linear": 200000 }
    },
    "falloff": {
      "lateral": [{ "position": 0.5, "value": 1.0 }],
      "radial": [{ "position": 0.5, "value": 1.0 }]
    },
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

### resourceareas.json 结构

```json
[
  {
    "cluster_id": "cluster_1",
    "sector_id": "sector_1",
    "items": [
      {
        "ref": "region_id",
        "amount": 1,
        "position": { "x": 0, "y": 64000, "z": 0 },
        "lateral_factor": 0.55,
        "radial_factor": 0.46,
        "falloff_factor": 0.253,
        "total_volume_km3": 5026548,
        "volume_km3": 4000000,
        "resources": [
          {
            "ware": "ore",
            "resourcedensity": 1.0,
            "total_yield": 1271717,
            "total_respawn": 127171,
            "yield": 1017374,
            "respawn": 101737,
            "density": 0.254,
            "respawn_density": 0.025,
            "gatherfactor": 1.0
          }
        ]
      }
    ]
  }
]
```
