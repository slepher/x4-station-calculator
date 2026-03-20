# map-resource-processor 文档对比分析汇总报告

**分析日期**: 2026-03-18

**分析范围**: 仅关注**生成 JSON 输出**相关的部分

---

## 1. 执行摘要

本次对比分析包含两个维度：

| 对比类型 | 交付物 | 主要发现 |
|---------|--------|---------|
| **文档间对比** | `doc-vs-doc-analysis.md` | 最终文档缺少 9 项内容，其中 7 项为高优先级 |
| **文档 - 代码对比** | `doc-vs-code-analysis.md` | 发现 19 项差异，其中 7 项为高优先级 |

---

## 2. 高优先级问题汇总

### 2.1 数据结构不一致（需立即修复）

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| 1 | **`resourceareas.json` 结构不匹配** - 代码输出扁平数组，文档描述分组结构 | 前端解析可能失败 | 统一为分组结构或更新文档 |
| 2 | **`maps.json` 字段名不一致** - 9.0+ 代码用 `yield`，文档描述为 `amount` | 字段名不匹配 | 统一字段名 |
| 3 | **9.0 `resources` 数组结构** - 原始设计为 `area.resources[]`，文档为扁平化 | 扩展性差异 | 确认设计决策 |

### 2.2 文档缺失内容（需补充）

| # | 缺失内容 | 来源 | 重要性 |
|---|---------|------|--------|
| 4 | **`position` 字段** - resourcearea 实例坐标 | map-resource-algorithm/request.md | 高 |
| 5 | **截断前后对比字段** - `total_volume_km3`/`volume_km3` | map-resource-algorithm/request.md | 高 |
| 6 | **产量对比字段** - `total_yield`/`yield`/`total_respawn`/`respawn` | map-resource-algorithm/request.md | 高 |
| 7 | **密度字段** - `density`/`respawn_density` | map-resource-algorithm/request.md | 高 |
| 8 | **气体方块字段** - `total_blocks`/`blocks` | map-resource-algorithm/request.md | 高 |
| 9 | **Station Owner 解析逻辑** - 从 god_final.xml 解析 | 代码实现 | 高 |
| 10 | **Field 处理逻辑** - asteroid/debris/nebula 解析细节 | 代码实现 | 高 |
| 11 | **两套聚合函数** - 代码中存在两套不同的聚合逻辑 | 代码实现 | 高 |

### 2.3 疑似未实现功能（需验证）

| # | 问题 | 状态 |
|---|------|------|
| 12 | **Rating 映射表** - 代码中未找到对应的 rating 计算逻辑 | 需验证 |

---

## 3. 完整差异清单

### 3.1 文档间对比发现（最终文档缺少的内容）

| 来源文档 | 缺失内容 | 重要性 |
|---------|---------|--------|
| resourcearea-map-accum/spec.md | 9.0 resources 数组结构 | 中 |
| map-resource-algorithm/request.md | position 字段 | 高 |
| map-resource-algorithm/request.md | total_volume_km3 / volume_km3 | 高 |
| map-resource-algorithm/request.md | total_yield / yield / total_respawn / respawn | 高 |
| map-resource-algorithm/request.md | density / respawn_density | 高 |
| map-resource-algorithm/request.md | total_blocks / blocks (气体) | 高 |
| map-resource-algorithm/request.md | 气体坐标转换规则 | 高 |
| map-resource-algorithm/request.md | 气体截断范围 | 中 |
| resources-new/design.md | noise/field 计算链路 | 低（已确认移除） |

### 3.2 文档 - 代码对比发现

#### 3.2.1 代码有但文档未描述（12 项）

| 模块 | 内容 | 重要性 |
|------|------|--------|
| legacy_processor.py | `round_yield_value()` 格式化规则 | 中 |
| legacy_processor.py | Field 相关处理函数 | 高 |
| legacy_processor.py | `regionobjectgroups_final.xml` 数据来源 | 中 |
| legacy_processor.py | 三种不同的资源计算模式 | 中 |
| generator.py | `aggregate_sector_resources_from_resourceareas()` | 高 |
| generator.py | Station Owner 解析逻辑 | 高 |
| generator.py | Zone/Sector Highway 处理 | 中 |
| generator.py | Sector 模板和归一化计算 | 中 |
| generator.py | `resourceareas.json` 实际输出结构 | 高 |
| calculator.py | `generate_gas_block_coordinates()` 详细算法 | 中 |
| output_manager.py | `write_all_map_outputs()` 批量写入函数 | 低 |
| resource_summary.py | `summarize_sector_resources()` 计算方式 | 中 |

#### 3.2.2 文档有但代码未实现/不同（7 项）

| 内容 | 状态 | 重要性 |
|------|------|--------|
| Rating 映射表计算逻辑 | 疑似未实现 | 高 |
| `regionyields.json` density 别名字段 | 代码有额外字段 | 低 |
| `regions.json` 外层 falloff_factor 字段 | 代码有冗余字段 | 低 |
| 9.0+ regionyields.json 空数组策略 | 已正确实现 | 无 |
| regionyield_definitions.json 可选字段说明 | 文档未说明可选 | 低 |
| 9.0+ resourceareas.json 结构 | 代码/文档不匹配 | 高 |
| maps.json sector.resources 字段名 | 代码用 yield，文档用 amount | 高 |

---

## 4. 建议行动项

### 4.1 立即修复（高优先级）

1. **统一 `resourceareas.json` 结构**
   - 选项 A：使用 `build_resourceareas_json_payload()` 转换为分组结构
   - 选项 B：更新文档反映实际扁平数组结构
   - 建议：与前端团队确认后决定

2. **统一 `maps.json` 字段名**
   - 9.0+ 代码中的 `yield` 改为 `amount` 以匹配文档
   - 或更新文档接受 `yield` 作为标准字段名

3. **补充缺失字段到文档**
   - `position` 字段定义和用途
   - 截断前后对比字段（total_* vs 实际值）
   - 密度字段（density/respawn_density）
   - 气体方块字段（total_blocks/blocks）

4. **补充 Station Owner 解析逻辑章节**
   - 数据来源（god_final.xml）
   - 决议逻辑
   - owner_resolution_ties 处理

5. **补充 Field 处理逻辑**
   - asteroid/debris/nebula 解析
   - densityfactor、noise_width 等字段说明

6. **澄清聚合函数**
   - 说明 `aggregate_sector_resources_from_resourceareas()` vs `build_sector_resource_summaries_from_resourceareas()` 的使用场景
   - 或考虑合并为一

7. **验证 Rating 映射表**
   - 确认 rating 计算逻辑的实现位置
   - 如未实现，补充实现或从文档中移除

### 4.2 中期改进（中优先级）

1. 补充气体坐标转换规则说明
2. 补充气体截断范围（Y 轴 ±64km）
3. 补充 Highway 处理逻辑
4. 补充 Sector 归一化计算
5. 补充 yield 格式化规则

### 4.3 文档优化（低优先级）

1. 说明 regionyields.json 中 density 字段为 resourcedensity 别名
2. 说明 regions.json 外层 falloff_factor 为冗余字段
3. 说明 regionyield_definitions.json 可选字段

---

## 5. 附录：推荐的标准结构

### 5.1 8.0 resourceareas.json（推荐）

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

### 5.2 9.0+ resourceareas.json（推荐）

```json
[
  {
    "cluster_id": "Cluster_01_macro",
    "sector_id": "Cluster_01_Sector001_macro",
    "areas": [
      {
        "ref": "sphere_medium_hydrogen_medium",
        "amount": 7,
        "position": { "x": 0, "y": 64000, "z": 0 },
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
]
```

### 5.3 maps.json sector.resources（统一 8.0/9.0+）

```json
{
  "resources": [
    {
      "ware": "ore",
      "amount": 450000,
      "respawn": 900000
    }
  ]
}
```

---

## 6. 报告清单

| 报告 | 路径 |
|------|------|
| 文档间对比报告 | `openspec/changes/map-resource-processor/doc-vs-doc-analysis.md` |
| 文档 - 代码对比报告 | `openspec/changes/map-resource-processor/doc-vs-code-analysis.md` |
| 汇总报告（本文） | `openspec/changes/map-resource-processor/summary-report.md` |

---

**报告完成时间**: 2026-03-18
