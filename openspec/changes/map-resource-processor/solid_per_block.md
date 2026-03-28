# 固体明细算法（逐格）

> **模块路径**: `processor/step2_resource/per_block/solid_per_block.py`

## 概述

固体明细算法用于 Step 2 二阶段，基于 64k area 网格逐格计算精确储量和明细数据。

## 网格参数（15×15×3）

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

**体素体积**：64³ km³

---

## 计算步骤

```
输入:
  - region_data: region 实例数据（boundary, position, falloff 等）
  - regionyields: 资源密度定义

步骤:

1. 枚举命中 region 的 64k area 坐标
   - 根据形状类型调用对应的碰撞检测
   - 输出: blocks = [{x, y, z}, ...]

2. 对每个 area 计算 falloff 权重
   - 根据位置在 falloff 曲线上插值
   - weight = lateral_weight × radial_weight

3. 应用 noise 处理（固体特有）
   - 调用 noise 函数生成随机扰动
   - noise_factor = apply_solid_noise(block)

4. 计算每格 yield
   block_reserve = weight × noise_factor × resourcedensity

5. 汇总到 region 总产量
   reserve = Σ(block_reserve)
   respawn = reserve × 60 / replenishtime
```

---

## 碰撞检测算法

### Cylinder

```python
def is_block_intersect_cylinder(block, cylinder):
    """
    检测方块是否与圆柱相交。

    方块中心到圆柱中心的水平距离 <= (半径 + 方块半宽)
    方块 y 范围与圆柱 y 范围有交集
    """
    dx = abs(block.x - cylinder.position.x)
    dz = abs(block.z - cylinder.position.z)
    horizontal_dist = sqrt(dx² + dz²)

    in_radius = horizontal_dist <= (cylinder.r + 32)  # 32km = 方块半宽
    in_height = block_y_range overlaps with [cylinder.y - linear, cylinder.y + linear]

    return in_radius and in_height
```

### Sphere

```python
def is_block_intersect_sphere(block, sphere):
    """
    检测方块是否与球体相交。

    方块中心到球心的距离 <= (半径 + 方块半对角线)
    """
    dist = sqrt((block.x - sphere.x)² + (block.y - sphere.y)² + (block.z - sphere.z)²)
    return dist <= (sphere.r + 32 * sqrt(3))
```

### Splinetube

```python
def is_block_intersect_splinetube(block, spline_data):
    """
    检测方块是否与管道相交。

    遍历管道曲线的每一段，检测方块是否与该段的圆柱近似相交。
    """
    for segment in spline_segments:
        # 计算方块到线段的最短距离
        dist = point_to_segment_distance(block, segment)
        if dist <= (spline.r + 32):
            return True
    return False
```

### Box

```python
def is_block_intersect_box(block, box):
    """
    检测方块是否与盒体相交。

    AABB 碰撞检测。
    """
    return (abs(block.x - box.x) <= (box.size_x + 32) and
            abs(block.y - box.y) <= (box.size_y + 32) and
            abs(block.z - box.z) <= (box.size_z + 32))
```

---

## 输出字段

### resourceareas.json

保存到 resource 级别：

| 字段 | 说明 |
|------|------|
| `reserve` | 精确储量（逐格汇总） |
| `respawn` | 精确回复量 |

### resourcearea_blocks.json

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

| 字段 | 说明 |
|------|------|
| `sector_id` | 所属 sector |
| `regions[].region_ref` | region 模板 ID |
| `regions[].resources` | 按资源类型分组 |
| `resources[].<ware>` | 资源类型数组 |
| `<ware>[].x/y/z` | 64k area 中心坐标（米） |
| `<ware>[].reserve` | 该格储量 |

---

## 参考

- 代码参考: `scripts/x4-game/solid_sum_weights_replay_v2.py`