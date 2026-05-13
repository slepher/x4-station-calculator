# Spec: resourcearea-map-accum

## 概述

将 9.0 版本的 resourceareas 数据格式重构为与 8.0 一致的 `resources` 数组结构。

---

## 变更内容

### 1. 9.0 resourceareas 格式变更

**变更前（扁平化结构）：**

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
      "yield": 150000,
      "delay": 60.0,
      "factor": 1.0,
      "respawn": 150000
    }
  ]
}
```

**变更后（resources 数组结构）：**

```json
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

---

## 数据处理逻辑

### Area 级资源计算

每个 area 输出独立的 `resources` 数组：

```python
for area in areas:
    ref = area.get("ref", "")
    amount = area.get("amount", 1)
    definition = definitions.get(ref, {})

    ware = definition.get("ware", "")
    rating = definition.get("rating", 0.0)
    yield_val = definition.get("yield", 0.0)
    delay = definition.get("respawnDelay", 0.0)

    factor = definition.get("objectyieldfactor") or definition.get("gatherspeedfactor") or 1.0

    respawn = yield_val * 60.0 / delay if delay > 0 else 0.0

    # 构建 resources 数组
    area_resources = [{
        "ware": ware,
        "yield": round_to_int(yield_val * amount),
        "respawn": round_to_int(respawn * amount),
        "delay": delay,
        "gatherfactor": factor,
        "rating": rating,
    }]
```

### Sector 级资源聚合

 sector.resources 聚合该 sector 所有 area 的资源：

```python
# 按 ware 聚合
sector_resources_map[ware]["yield"] += yield_val * amount
sector_resources_map[ware]["respawn"] += respawn * amount
```

---

## 字段说明

| 字段 | 位置 | 说明 |
|------|------|------|
| `ware` | resources 内 | 资源类型 |
| `yield` | resources 内 | 产量 = base_yield × amount |
| `respawn` | resources 内 | 再生量 = respawn × amount |
| `delay` | resources 内 | 再生延迟（分钟） |
| `gatherfactor` | resources 内 | 采集系数（原 `factor`） |
| `rating` | resources 内 | 评级 |

---

## 修改的文件

1. **scripts/processor/map/generator.py** (行 430-501)
   - 9.0 处理逻辑修改
   - 添加 `resources` 数组输出
   - `factor` → `gatherfactor`
   - `rating` 移入 resources

2. **scripts/processor/resource/modern_processor.py**
   - `build_resourceareas_json_payload`: 适配新结构
   - `build_sector_resource_summaries_from_resourceareas`: 适配新结构

3. **scripts/x4_data_map_processor.py** (行 2850-2920)
   - 9.0 处理逻辑修改（同上）

---

## 验收标准

1. resourceareas.json 的每个 area 包含 `resources` 数组
2. resources 数组内字段：`ware`, `yield`, `respawn`, `delay`, `gatherfactor`, `rating`
3. `yield` 和 `respawn` 已乘以 `amount`
4. sector.resources 正确聚合了该 sector 所有 area 的资源
