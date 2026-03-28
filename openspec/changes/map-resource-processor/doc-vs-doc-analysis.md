# 文档间对比分析报告

**对比对象：**
- **最终文档**: `openspec/changes/map-resource-processor/design.md`
- **原始文档**: `openspec/changes/` 目录下与 resource 相关的 change 文档

**分析日期**: 2026-03-18

**分析范围**: 仅关注**生成 JSON 输出**相关的部分（数据结构定义、字段说明、生成逻辑、算法公式）

---

## 1. 检查过的原始文档列表

| # | 文档目录 | design.md | spec.md | 备注 |
|---|----------|-----------|---------|------|
| 1 | map-resource-calc | ✓ | - | 资源密度计算设计 |
| 2 | resourcearea-map-accum | ✗ | ✓ | 9.0 resourceareas 格式重构 |
| 3 | refactory-map-processor | ✓ | ✓ | 处理器重构规格 |
| 4 | resources-new | ✓ | - | 资源模型版本分流 |
| 5 | map-resource-algorithm | ✗ (request.md) | - | 算法简化需求 |
| 6 | advanced-resource-filter | ✗ | - | 目录不存在 |
| 7 | map-station | ✓ | - | 地图站点放置（无关） |
| 8 | game-version-switch | ✓ | ✓ | 游戏版本切换（无关） |

**纳入分析的文档**（与 JSON 输出直接相关）：
1. `resourcearea-map-accum/spec.md`
2. `map-resource-algorithm/request.md`
3. `resources-new/design.md`
4. `map-resource-calc/design.md`

---

## 2. 最终文档缺少的内容清单

### 2.1 来自 `resourcearea-map-accum/spec.md`

#### 缺失内容：9.0 版本 resources 数组结构

**原始设计：**

9.0 `resourceareas.json` 的每个 `area` 应包含 `resources` 数组，而非扁平化字段：

```json
// 变更后（期望结构）
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
          "yield": 1050000,
          "respawn": 1050000,
          "delay": 60.0,
          "gatherfactor": 1.0,
          "rating": 10.0
        }
      ]
    }
  ]
}
```

**最终文档现状：**

最终文档中 9.0+ 的 `resourceareas.json` 仍使用扁平化结构（2.4.3 节）：

```json
{
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

**字段位置差异：**

| 字段 | 原始设计位置 | 最终文档位置 |
|------|-------------|-------------|
| `ware` | `area.resources[].ware` | `area.ware` |
| `yield` | `area.resources[].yield` | `area.yield` |
| `respawn` | `area.resources[].respawn` | `area.respawn` |
| `delay` | `area.resources[].delay` | `area.delay` |
| `gatherfactor` | `area.resources[].gatherfactor` | `area.factor` |
| `rating` | `area.resources[].rating` | `area.rating` |

**重要性评估**: **中**

**影响**:
- 这是 9.0 版本数据格式的重要设计变更
- `resources` 数组结构为未来扩展留下空间（同一 area 可包含多种资源）
- 扁平化结构更简洁，但扩展性较差

**修改的文件（原始文档提及）**:
- `scripts/processor/map/generator.py` (行 430-501)
- `scripts/processor/resource/modern_processor.py`
- `scripts/x4_data_map_processor.py` (行 2850-2920)

---

### 2.2 来自 `map-resource-algorithm/request.md`

#### 缺失内容：实例级计算字段（带坐标的截断计算）

**原始设计核心架构：**

| 文件 | 职责 | 包含坐标 |
|------|------|----------|
| `regions.json` | 模板定义 | 否 |
| `resourceareas.json` | 实例计算结果 | 是 |

**缺失的字段定义：**

##### 2.2.1 position 字段

```json
{
  "ref": "region_id",
  "position": {"x": 0, "y": 64000, "z": 0},
  ...
}
```

**用途**: 世界坐标，用于固体截断计算和气体坐标转换

**重要性**: **高** - 无坐标无法进行截断计算

---

##### 2.2.2 截断前后对比字段

**固体资源缺失字段：**

| 字段 | 说明 | 用途 |
|------|------|------|
| `total_volume_km3` | 截断前体积 | 对比截断损失 |
| `volume_km3` | 截断后有效体积 | 计算实际产量 |
| `total_yield` | 截断前资源总量 | 评级参考 |
| `yield` | 截断后有效资源量 | 实际产量 |
| `total_respawn` | 截断前总重生量 | 评级参考 |
| `respawn` | 截断后有效重生量 | 实际产量 |
| `density` | 有效密度 = yield / volume_km3 | 密度分析 |
| `respawn_density` | 有效重生密度 | 密度分析 |

**气体资源缺失字段：**

| 字段 | 说明 | 用途 |
|------|------|------|
| `total_blocks` | 原始命中方块数 | 对比截断损失 |
| `blocks` | 截断后有效方块数 | 计算实际产量 |

**重要性**: **高** - 这些字段支持"截断前后对比"和"密度分析"能力

---

##### 2.2.3 完整结构对比

**原始设计的 resourceareas.json 结构：**

```json
{
  "cluster_id": "cluster_1",
  "sector_id": "sector_1",
  "items": [
    {
      "ref": "region_id",
      "amount": 1,
      "position": {"x": 0, "y": 64000, "z": 0},
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
```

**最终文档的 resourceareas.json 结构（8.0）：**

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

**缺失字段汇总：**

| 类别 | 缺失字段 |
|------|----------|
| 坐标 | `position` |
| 体积 | `total_volume_km3`, `volume_km3` |
| 产量 | `total_yield`, `total_respawn`, `yield`, `respawn` |
| 密度 | `density`, `respawn_density` |
| 气体方块 | `total_blocks`, `blocks` |

---

#### 缺失内容：气体坐标转换规则

**原始文档描述：**

```
气体资源需要将 region 坐标转换到 sector 坐标系：

region 相对 sector 坐标 = region 世界坐标 - cluster 对应 sector 的坐标

- 如果 region 有坐标，则将 region 坐标视为对应 cluster 的坐标
- 如果 cluster 有多个 sector，则找到 sector 对应 cluster 的坐标
- 将 region 相对 cluster 坐标转化为 region 相对 sector 的坐标
```

**重要性**: **高** - 气体资源计算依赖正确的坐标转换

---

#### 缺失内容：截断规则的详细定义

**原始文档的截断表：**

| 资源类型 | 维度 | 截断范围 |
|----------|------|----------|
| **固体** | X/Z 平面 | `[-256km, +256km]` |
| **固体** | Y 轴（高度） | `[-96km, +96km]`（圆柱体最大高度 192km） |
| **气体** | X/Z 平面 | `[-256km, +256km]` |
| **气体** | Y 轴（高度） | `[-64km, +64km]` |

**最终文档状态：**
最终文档在 1.3.2 节提到了固体截断范围，但未提及气体截断范围。

---

### 2.3 来自 `resources-new/design.md`

#### 缺失内容：8.0 版本 yield 计算链路（含 noise/field 模型）

**原始计算公式：**

```
// Region 修正因子
F_region = density × falloff_factor × noise_probability

// Field 贡献（固体资源）
field_contribution = Σ(densityfactor × noise_width × yield × resourcepercentage/100)

// 单位密度
density = ρ_base × F_region × field_contribution
// 单位：resources/km³

// 单位回复密度
respawn_density = density × 60 / replenishtime
// 单位：resources/km³/hour

// 总量计算
yield = density × volume_km3
respawn = respawn_density × volume_km3
```

**最终文档状态：**

最终文档在 2026-03-18 的更新记录中注明：
> "删除无效的 Region 修正因子（density, noise_probability）和 Field 因子相关描述"

并在 1.3.1 节使用简化公式：
```
yield = base × falloff × resourcedensity
```

**评估**: 这是有意为之的简化，非遗漏。最终文档已明确移除 noise/field 模型。

**重要性**: **低** - 已确认的设计决策

---

### 2.4 来自 `map-resource-calc/design.md`

#### 缺失内容：模拟密度聚合设计

**原始设计：**

该文档关注的是基于 noise 模型的模拟密度计算，包括：
- field 级贡献计算
- resource 级累计
- sector 级代表矿区选择逻辑

**最终文档状态：**

最终文档已移除 noise/field 相关计算，因此这部分内容不适用。

**重要性**: **低** - 与当前简化算法无关

---

## 3. 总结

### 3.1 缺失内容汇总表

| # | 来源文档 | 缺失内容 | 重要性 | 建议操作 |
|---|----------|----------|--------|----------|
| 1 | resourcearea-map-accum/spec.md | 9.0 resources 数组结构 | 中 | 确认是否采用 |
| 2 | map-resource-algorithm/request.md | position 字段 | 高 | 补充 |
| 3 | map-resource-algorithm/request.md | total_volume_km3 / volume_km3 | 高 | 补充 |
| 4 | map-resource-algorithm/request.md | total_yield / yield / total_respawn / respawn | 高 | 补充 |
| 5 | map-resource-algorithm/request.md | density / respawn_density | 高 | 补充 |
| 6 | map-resource-algorithm/request.md | total_blocks / blocks (气体) | 高 | 补充 |
| 7 | map-resource-algorithm/request.md | 气体坐标转换规则 | 高 | 补充 |
| 8 | map-resource-algorithm/request.md | 气体截断范围 | 中 | 补充 |
| 9 | resources-new/design.md | noise/field 计算链路 | 低 | 已确认移除 |

### 3.2 核心缺失（高重要性）

最终文档与原始需求文档相比，核心缺失集中在 **`map-resource-algorithm/request.md`** 中定义的字段：

1. **坐标信息缺失**: `resourceareas.json` 中无 `position` 字段
2. **截断前后对比缺失**: 无 `total_*` vs 实际值的区分
3. **密度分析字段缺失**: 无 `density` / `respawn_density`

这些字段支持以下能力：
- 截断损失分析
- 资源密度对比
- 气体资源坐标转换

### 3.3 架构差异（中重要性）

**9.0 版本 structures 差异：**

| 特性 | 原始设计 | 最终文档 |
|------|----------|----------|
| area 资源结构 | `resources` 数组 | 扁平化字段 |
| 扩展性 | 支持多资源/area | 单一资源/area |

---

## 4. 建议

### 4.1 立即补充

在最终文档的 8.0 `resourceareas.json` 结构中补充以下字段：

```json
{
  "areas": [
    {
      "ref": "region_ore_medium_01",
      "amount": 3,
      "position": {"x": 0, "y": 64000, "z": 0},
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
```

### 4.2 确认决策

确认 9.0 版本是否采用 `resources` 数组结构：
- 如果是：需更新最终文档 2.4.2 节
- 如果否：保持当前扁平化结构，但应记录设计决策理由

---

**报告完成时间**: 2026-03-18
