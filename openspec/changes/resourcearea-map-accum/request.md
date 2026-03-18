# Request: resourcearea-map-accum

## 背景

当前 9.0 版本的 resourceareas 数据格式采用扁平化结构，与 8.0 的 `resources` 数组结构不一致。需要将 9.0 的格式重构为与 8.0 一致的结构。

---

## 需求

### 1. 添加 `resources` 数组

将 9.0 扁平化的 `ware/yield/respawn/delay/factor/rating` 字段移动到 `resources` 数组中。

### 2. 按 ware 聚合

同一个 area 内相同 ware 的资源需要合并：
- `total_yield = Σ(yield × amount)`
- `total_respawn = Σ(respawn × amount)`

### 3. 字段重命名

- `factor` → `gatherfactor`（与 8.0 命名保持一致）

### 4. rating 移入 resources

- `rating` 从 area 层级移动到 `resources` 数组内的每个元素

---

## 预期输出格式

### 9.0 resourceareas.json (修改后)

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

### maps.json 的 sector.resources

从该 sector 所有 area 的 resources 中按 ware 聚合：

```json
{
  "id": "Cluster_01_Sector001_macro",
  "resources": [
    {"ware": "hydrogen", "yield": 1050000, "respawn": 1050000},
    {"ware": "ice", "yield": 1850000, "respawn": 1812500}
  ]
}
```

---

## 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `scripts/processor/map/generator.py:430-501` | 1. area 添加 `resources` 数组<br>2. 聚合时 `yield × amount` 和 `respawn × amount`<br>3. `factor` → `gatherfactor`<br>4. `rating` 移入 resources |
| `scripts/processor/resource/modern_processor.py` | 1. `build_resourceareas_json_payload` 适配新结构<br>2. `build_sector_resource_summaries_from_resourceareas` 适配新结构 |

---

## 验收标准

1. resourceareas.json 的每个 area 包含 `resources` 数组
2. resources 数组内字段：`ware`, `yield`, `respawn`, `delay`, `gatherfactor`, `rating`
3. 相同 ware 的资源已按 amount 加权累加
4. sector.resources 正确聚合了该 sector 所有 area 的资源
