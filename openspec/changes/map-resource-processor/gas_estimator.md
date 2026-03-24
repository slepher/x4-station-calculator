# 气体估算算法

> **模块路径**: `processor/step2_resource/estimator/gas_estimator.py`

## 概述

气体估算算法用于 Step 2 一阶段，基于 64km 体素离散化计算体积和理论储量。

## 有效空间

| 维度 | 范围 |
|------|------|
| X 轴 | [-1024km, +1024km] |
| Y 轴 | [-1024km, +1024km] |
| Z 轴 | [-1024km, +1024km] |

## 半径上限

| 形状 | 半径上限 |
|------|----------|
| Cylinder | 1024km |
| Sphere | 1024km |

---

## 体积计算

### Cylinder（圆柱）

```
参数：
  - position.y: 圆柱中心 y 坐标
  - linear: 半高（完整高度 = 2 × linear）
  - r: 半径（上限 1024km）

离散化步骤：

1. 计算圆柱 y 范围
   y_range = [position.y - linear, position.y + linear]

2. 在有效空间 [-1024km, +1024km] 内按 64km 分层
   层边界: [-1024, -960], [-960, -896], ..., [960, 1024]

3. 遍历所有层，判断是否与圆柱 y 范围重叠
   - 层范围 [y1, y2] 与圆柱 y 范围有交集 → 命中

4. 计算体积
   gas_volume_km3 = 命中层数 × 64 × π × min(r, 1024)²
```

**示例**：
```
圆柱参数：
  - position.y = 50km
  - linear = 64km
  - r = 100km

圆柱 y 范围: [-14km, 114km]

分层命中判断：
  - [-64, 0]: 与 [-14, 0] 重叠 → 命中
  - [0, 64]: 与 [0, 64] 重叠 → 命中
  - [64, 128]: 与 [64, 114] 重叠 → 命中

命中 3 层：
  gas_volume_km3 = 3 × 64 × π × 100² ≈ 6,031,872 km³
```

### Sphere（球体）

```
参数：
  - r: 半径（上限 1024km）

离散化步骤：

1. 半径封顶
   r_capped = min(r, 1024) km

2. 半径按 32km 向上取整
   r_discrete = ceil(r_capped / 32) × 32 km

3. 计算离散球体体积
   gas_volume_km3 = (4/3) × π × r_discrete³
```

**示例**：
```
原始半径 100km:
  r_discrete = ceil(100 / 32) × 32 = 128km
  gas_volume_km3 = (4/3) × π × 128³ ≈ 8,780,000 km³
```

### Splinetube（管道）

```
参数：
  - r: 半径
  - spline: 控制点曲线

离散化步骤：

1. 中心曲线截断到有效空间 [-1024km, +1024km]
2. 半径按 32km 向上取整
   r_discrete = ceil(r / 32) × 32 km
3. 横截面离散为 64km × 64km 方阵
4. gas_volume_km3 = 有效长度 × 截面网格数 × 64 × 64
```

### Box（盒体）

```
参数：
  - x, y, z: 半长

离散化步骤：

1. 枚举 64km 网格
2. 检测每个网格是否与盒体相交
3. 统计命中网格数量
4. gas_volume_km3 = 命中网格数 × 64³
```

---

## 储量计算公式

```
theoretical_reserve = gas_volume_km3 × falloff × resourcedensity / 64³
theoretical_respawn = theoretical_reserve × 60 / replenishtime
```

**参数说明**：
- `falloff = lateral_factor × radial_factor`
- `resourcedensity`: 资源密度
- `replenishtime`: 重生时间（分钟）
- `64³`: 单个 64km × 64km × 64km 体素的体积

---

## 输出字段

保存到 `resourceareas.json` 的 area 级别：

| 字段 | 说明 |
|------|------|
| `gas_volume_km3` | 估算体积（仅当存在气体资源时） |

保存到 `resourceareas.json` 的 resource 级别：

| 字段 | 说明 |
|------|------|
| `theoretical_reserve` | 理论储量 |
| `theoretical_respawn` | 理论回复量 |

---

## 参考

- 代码参考: `scripts/x4-game/gas_sum_weights_replay.py`