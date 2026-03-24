# 固体估算算法

> **模块路径**: `processor/step2_resource/estimator/solid_estimator.py`

## 概述

固体估算算法用于 Step 2 一阶段，计算经过 1024km 封顶裁切后的体积和理论储量。

## 有效空间

| 维度 | 范围 |
|------|------|
| X 轴 | [-1024km, +1024km] |
| Y 轴 | [-1024km, +1024km] |
| Z 轴 | [-1024km, +1024km] |

---

## 体积计算

### Cylinder（圆柱）

```
参数：
  - r: 半径
  - linear: 半高（完整高度 = 2 × linear）

计算口径：
  - 底面积封顶：min(π × r², 1024 × 1024) km²
  - 总高度封顶：min(2 × linear, 2048) km
  - solid_volume_km3 = 底面积 × 高度
```

### Sphere（球体）

```
参数：
  - r: 半径

计算口径：
  - 体积封顶：min((4/3) × π × r³, 1024 × 1024 × 1024) km³
  - solid_volume_km3 = 封顶后体积
```

### Splinetube（管道）

```
参数：
  - r: 半径
  - spline: 控制点曲线

计算口径：
  - 中心曲线按 [-1024km, +1024km] 截断
  - 计算截断后的有效曲线长度
  - solid_volume_km3 = π × r² × 有效长度
```

### Box（盒体）

```
参数：
  - x, y, z: 半长（完整长度 = 2 × x/y/z）

计算口径：
  - 盒体按 [-1024km, +1024km] 截断
  - solid_volume_km3 = 截断后的有效体积
```

---

## 储量计算公式

```
theoretical_reserve = solid_volume_km3 × falloff × resourcedensity
theoretical_respawn = theoretical_reserve × 60 / replenishtime
```

**参数说明**：
- `falloff = lateral_factor × radial_factor`
- `resourcedensity`: 资源密度（从 regionyields 获取）
- `replenishtime`: 重生时间（分钟）

---

## 输出字段

保存到 `resourceareas.json` 的 area 级别：

| 字段 | 说明 |
|------|------|
| `solid_volume_km3` | 估算体积（仅当存在固体资源时） |

保存到 `resourceareas.json` 的 resource 级别：

| 字段 | 说明 |
|------|------|
| `theoretical_reserve` | 理论储量 |
| `theoretical_respawn` | 理论回复量 |

---

## 参考

- 代码参考: `scripts/x4-game/solid_sum_weights_replay_v2.py`