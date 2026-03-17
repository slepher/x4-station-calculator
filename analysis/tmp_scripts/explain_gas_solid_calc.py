#!/usr/bin/env python3
"""
气体和固体资源计算逻辑说明
"""
import json
import math

# =============================================================================
# 常量定义
# =============================================================================

GAS_BLOCK_SIZE = 64_000       # 64 km 方块边长
GAS_XZ_LIMIT = 256_000        # XZ 方向截断限制 256 km
GAS_Y_LIMIT = 64_000          # Y 方向截断限制 64 km（总高度 128km）
GAS_MIN_HEIGHT = 64_000       # 气体最小高度 64km（|y| >= 64km 才是有效气体）

# =============================================================================
# 气体资源计算逻辑
# =============================================================================

def calculate_gas_block_count_truncated(region_pos, boundary):
    """
    气体方块计数算法（截断版）

    适用场景：
    - 气体资源（helium, hydrogen, methane, bogas）
    - 使用 3D 网格遍历，每个方块 64km³

    返回值：
    - total_blocks: 命中边界的所有方块数（用于计算 total_yield）
    - effective_blocks: 截断范围内的方块数（用于计算 yield）

    注意：
    - total_volume_km3 = total_blocks（单位是"方块数"，不是 km³）
    - volume_km3 = effective_blocks（有效方块数）
    """
    radius = boundary.get("r", 0.0) if boundary else 0.0

    # 有效范围（方块索引）
    xz_max_blocks = GAS_XZ_LIMIT // GAS_BLOCK_SIZE  # 4 个方块（单侧）
    y_max_blocks = GAS_Y_LIMIT // GAS_BLOCK_SIZE    # 1 个方块（单侧）

    total_blocks = 0
    effective_blocks = 0

    # 遍历所有可能的方块
    for bx in range(-xz_max_blocks - 1, xz_max_blocks + 2):
        for by in range(-y_max_blocks - 1, y_max_blocks + 2):
            for bz in range(-xz_max_blocks - 1, xz_max_blocks + 2):
                # 方块中心坐标
                block_x = bx * GAS_BLOCK_SIZE
                block_y = by * GAS_BLOCK_SIZE
                block_z = bz * GAS_BLOCK_SIZE

                # 气体最小高度限制
                if abs(block_y) < GAS_MIN_HEIGHT:
                    continue

                # 计算方块中心到 region 中心的距离
                dx = block_x - region_pos.get("x", 0.0)
                dy = block_y - region_pos.get("y", 0.0)
                dz = block_z - region_pos.get("z", 0.0)
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)

                # 检查是否在半径内
                if radius > 0 and dist <= radius:
                    total_blocks += 1

                    # 有效方块：还需要在截断范围内
                    if (abs(block_x) <= GAS_XZ_LIMIT and
                        abs(block_z) <= GAS_XZ_LIMIT and
                        abs(block_y) <= GAS_Y_LIMIT):
                        effective_blocks += 1

    return (max(1, total_blocks), max(0, effective_blocks))


def calculate_gas_resources(region_pos, boundary, falloff, resourcedensity, replenishtime):
    """
    气体资源计算

    公式：
    - total_yield = total_blocks × falloff_factor × resourcedensity
    - effective_yield = effective_blocks × falloff_factor × resourcedensity
    - total_respawn = total_yield × 60 / replenishtime
    - effective_respawn = effective_yield × 60 / replenishtime

    体积计算（用于 density）：
    - effective_vol_km3 = effective_blocks × (64³) = effective_blocks × 262,144 km³
    - density = effective_yield / effective_vol_km3
    """
    total_blocks, effective_blocks = calculate_gas_block_count_truncated(region_pos, boundary)

    lateral_f = falloff.get("lateral_factor", 1.0)
    radial_f = falloff.get("radial_factor", 1.0)
    total_falloff = lateral_f * radial_f

    # 产量计算
    total_yield = total_blocks * total_falloff * resourcedensity
    effective_yield = effective_blocks * total_falloff * resourcedensity

    # 回复量计算
    total_respawn = total_yield * 60.0 / replenishtime
    effective_respawn = effective_yield * 60.0 / replenishtime

    # 体积计算（用于密度）
    effective_vol_km3 = effective_blocks * (GAS_BLOCK_SIZE ** 3) / 1_000_000_000.0
    density = effective_yield / effective_vol_km3 if effective_vol_km3 > 0 else 0.0
    respawn_density = effective_respawn / effective_vol_km3 if effective_vol_km3 > 0 else 0.0

    return {
        "total_blocks": total_blocks,
        "effective_blocks": effective_blocks,
        "total_yield": round(total_yield),
        "effective_yield": round(effective_yield),
        "total_respawn": round(total_respawn),
        "effective_respawn": round(effective_respawn),
        "effective_vol_km3": effective_vol_km3,
        "density": round(density, 6),
        "respawn_density": round(respawn_density, 6),
    }


# =============================================================================
# 固体资源计算逻辑
# =============================================================================

def boundary_volume(boundary):
    """
    计算边界的几何体积（m³）

    支持的边界类型：
    - sphere: 4/3 × π × r³
    - cylinder: π × r² × h
    - box: w × h × d
    - capsule: 4/3 × π × r³ + π × r² × h
    - splinetube: 简化为圆柱体
    - 空边界：返回 0
    """
    if not boundary:
        return 0.0

    boundary_class = boundary.get("class", "")

    if boundary_class == "sphere":
        r = boundary.get("r", 0.0)
        return 4.0 / 3.0 * math.pi * (r ** 3)

    elif boundary_class == "cylinder":
        r = boundary.get("r", 0.0)
        h = boundary.get("h", 0.0)
        return math.pi * (r ** 2) * h

    elif boundary_class == "box":
        w = boundary.get("w", 0.0)
        h = boundary.get("h", 0.0)
        d = boundary.get("d", 0.0)
        return w * h * d

    elif boundary_class == "capsule":
        r = boundary.get("r", 0.0)
        h = boundary.get("h", 0.0)
        return 4.0 / 3.0 * math.pi * (r ** 3) + math.pi * (r ** 2) * h

    elif boundary_class == "splinetube":
        r = boundary.get("r", 0.0)
        linear = boundary.get("linear", 0.0)
        return math.pi * (r ** 2) * linear

    return 0.0


def calculate_solid_volume_truncated(boundary):
    """
    固体体积计算（截断版）

    适用场景：
    - 固体资源（ore, crystals, silicon, 等）
    - 使用几何体积公式计算

    返回值：
    - total_vol: 总体积（m³）
    - effective_vol: 截断后的有效体积（m³）

    注意：
    - total_volume_km3 = total_vol / 1_000_000_000
    - volume_km3 = effective_vol / 1_000_000_000
    """
    boundary_class = boundary.get("class", "") if boundary else ""

    if not boundary:
        return (0.0, 0.0)

    # 计算总体积
    total_vol = boundary_volume(boundary)

    # 截断逻辑：与 256km 圆柱体求交集
    TRUNCATE_RADIUS = 256_000  # 256 km
    TRUNCATE_HEIGHT = 64_000   # 64 km（单侧）

    r = boundary.get("r", 0.0) if boundary.get("r") else 0.0
    h = boundary.get("h", 0.0) if boundary.get("h") else 0.0
    linear = boundary.get("linear", 0.0) if boundary.get("linear") else 0.0

    # 简化处理：有效体积 = min(原始尺寸，截断尺寸)
    if boundary_class in ["cylinder", "splinetube"]:
        eff_r = min(r, TRUNCATE_RADIUS)
        eff_h = min(h, TRUNCATE_HEIGHT * 2)  # 总高度
        effective_vol = math.pi * (eff_r ** 2) * eff_h
    elif boundary_class == "sphere":
        eff_r = min(r, TRUNCATE_RADIUS)
        effective_vol = 4.0 / 3.0 * math.pi * (eff_r ** 3)
    elif boundary_class == "box":
        w = boundary.get("w", 0.0)
        h = boundary.get("h", 0.0)
        d = boundary.get("d", 0.0)
        eff_w = min(w, TRUNCATE_RADIUS * 2)
        eff_h = min(h, TRUNCATE_HEIGHT * 2)
        eff_d = min(d, TRUNCATE_RADIUS * 2)
        effective_vol = eff_w * eff_h * eff_d
    elif boundary_class == "capsule":
        eff_r = min(r, TRUNCATE_RADIUS)
        eff_h = min(h, TRUNCATE_HEIGHT * 2)
        effective_vol = 4.0 / 3.0 * math.pi * (eff_r ** 3) + math.pi * (eff_r ** 2) * eff_h
    else:
        effective_vol = total_vol

    return (total_vol, effective_vol)


def calculate_solid_resources(boundary, falloff, resourcedensity, replenishtime):
    """
    固体资源计算

    公式：
    - total_yield = total_vol_km3 × falloff_factor × resourcedensity
    - effective_yield = effective_vol_km3 × falloff_factor × resourcedensity
    - total_respawn = total_yield × 60 / replenishtime
    - effective_respawn = effective_yield × 60 / replenishtime

    密度计算：
    - density = effective_yield / effective_vol_km3
    """
    total_vol, effective_vol = calculate_solid_volume_truncated(boundary)

    # 转换为 km³
    total_vol_km3 = total_vol / 1_000_000_000.0
    effective_vol_km3 = effective_vol / 1_000_000_000.0

    lateral_f = falloff.get("lateral_factor", 1.0)
    radial_f = falloff.get("radial_factor", 1.0)
    total_falloff = lateral_f * radial_f

    # 产量计算
    total_yield = total_vol_km3 * total_falloff * resourcedensity
    effective_yield = effective_vol_km3 * total_falloff * resourcedensity

    # 回复量计算
    total_respawn = total_yield * 60.0 / replenishtime
    effective_respawn = effective_yield * 60.0 / replenishtime

    # 密度计算
    density = effective_yield / effective_vol_km3 if effective_vol_km3 > 0 else 0.0
    respawn_density = effective_respawn / effective_vol_km3 if effective_vol_km3 > 0 else 0.0

    return {
        "total_vol_km3": round(total_vol_km3),
        "effective_vol_km3": round(effective_vol_km3),
        "total_yield": round(total_yield),
        "effective_yield": round(effective_yield),
        "total_respawn": round(total_respawn),
        "effective_respawn": round(effective_respawn),
        "density": round(density, 6),
        "respawn_density": round(respawn_density, 6),
    }


# =============================================================================
# 主函数：演示计算
# =============================================================================

def main():
    print("=" * 80)
    print("气体和固体资源计算逻辑说明")
    print("=" * 80)

    # -------------------------------------------------------------------------
    # 气体资源示例
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("【气体资源计算】")
    print("=" * 80)

    print("""
适用资源类型：helium, hydrogen, methane, bogas

核心概念：
  - 气体使用 3D 网格遍历算法，每个方块 64km³
  - 只计算 |y| >= 64km 的方块（气体最小高度限制）
  - 截断范围：XZ 方向 256km，Y 方向 64km

字段说明：
  - total_volume_km3 = total_blocks（方块数，不是 km³）
  - volume_km3 = effective_blocks（有效方块数）

  为什么用方块数而不是 km³？
  - 因为气体分布是离散的网格点，不是连续体积
  - 每个方块代表一个潜在的采集点
""")

    # 示例 1：有 boundary 的气体 region
    print("\n--- 示例 1：有 boundary 的气体 region ---")
    gas_region_pos = {"x": 0.0, "y": 0.0, "z": 0.0}
    gas_boundary = {"class": "sphere", "r": 100_000}  # 半径 100km
    gas_falloff = {"lateral_factor": 0.8, "radial_factor": 0.9}
    gas_density = 50000
    gas_replenishtime = 360

    result = calculate_gas_resources(
        gas_region_pos, gas_boundary, gas_falloff, gas_density, gas_replenishtime
    )
    print(f"输入：")
    print(f"  position: {gas_region_pos}")
    print(f"  boundary: sphere r=100km")
    print(f"  falloff: lateral=0.8, radial=0.9")
    print(f"  resourcedensity: {gas_density}")
    print(f"  replenishtime: {gas_replenishtime}s")
    print(f"\n输出：")
    print(f"  total_blocks: {result['total_blocks']}")
    print(f"  effective_blocks: {result['effective_blocks']}")
    print(f"  total_yield: {result['total_yield']:,}")
    print(f"  effective_yield: {result['effective_yield']:,}")
    print(f"  effective_vol_km3: {result['effective_vol_km3']:,.0f}")

    # 示例 2：nebula（空 boundary）
    print("\n--- 示例 2：nebula（空 boundary）---")
    nebula_pos = {"x": 0.0, "y": -20000.0, "z": 0.0}
    nebula_boundary = {}  # nebula 没有 boundary
    nebula_falloff = {"lateral_factor": 1.0, "radial_factor": 0.792}
    nebula_density = 49500
    nebula_replenishtime = 60

    result = calculate_gas_resources(
        nebula_pos, nebula_boundary, nebula_falloff, nebula_density, nebula_replenishtime
    )
    print(f"输入：")
    print(f"  position: {nebula_pos}")
    print(f"  boundary: {{}} (空)")
    print(f"  falloff: lateral=1.0, radial=0.792")
    print(f"  resourcedensity: {nebula_density}")
    print(f"  replenishtime: {nebula_replenishtime}s")
    print(f"\n输出：")
    print(f"  total_blocks: {result['total_blocks']} ← 注意：空 boundary 返回 1")
    print(f"  effective_blocks: {result['effective_blocks']} ← 0（不在有效范围内）")
    print(f"  total_yield: {result['total_yield']:,}")
    print(f"  effective_yield: {result['effective_yield']:,}")

    print(f"\n⚠️  问题：nebula 的 total_blocks=1，但实际输出是 248")
    print(f"   这说明 nebula 的体积不是通过 calculate_gas_block_count_truncated 计算的")
    print(f"   需要检查是否有其他体积来源...")

    # -------------------------------------------------------------------------
    # 固体资源示例
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("【固体资源计算】")
    print("=" * 80)

    print("""
适用资源类型：ore, silicon, crystals, 等所有非气体资源

核心概念：
  - 固体使用几何体积公式计算
  - 支持多种边界类型：sphere, cylinder, box, capsule, splinetube
  - 截断逻辑：与 256km 圆柱体求交集

字段说明：
  - total_volume_km3 = total_vol / 1_000_000_000（单位是 km³）
  - volume_km3 = effective_vol / 1_000_000_000（有效体积 km³）
""")

    # 示例 1：球体 solid region
    print("\n--- 示例 1：球体 solid region ---")
    solid_boundary = {"class": "sphere", "r": 50_000}  # 半径 50km
    solid_falloff = {"lateral_factor": 0.9, "radial_factor": 0.95}
    solid_density = 120
    solid_replenishtime = 120

    result = calculate_solid_resources(
        solid_boundary, solid_falloff, solid_density, solid_replenishtime
    )
    print(f"输入：")
    print(f"  boundary: sphere r=50km")
    print(f"  falloff: lateral=0.9, radial=0.95")
    print(f"  resourcedensity: {solid_density}")
    print(f"  replenishtime: {solid_replenishtime}s")
    print(f"\n输出：")
    print(f"  total_volume_km3: {result['total_vol_km3']:,.0f}")
    print(f"  volume_km3: {result['effective_vol_km3']:,.0f}")
    print(f"  total_yield: {result['total_yield']:,}")
    print(f"  effective_yield: {result['effective_yield']:,}")

    # 示例 2：截断的 cylinder
    print("\n--- 示例 2：截断的 cylinder ---")
    cylinder_boundary = {"class": "cylinder", "r": 300_000, "h": 100_000}  # 超出截断范围
    cylinder_falloff = {"lateral_factor": 0.7, "radial_factor": 0.8}
    cylinder_density = 80
    cylinder_replenishtime = 90

    result = calculate_solid_resources(
        cylinder_boundary, cylinder_falloff, cylinder_density, cylinder_replenishtime
    )
    print(f"输入：")
    print(f"  boundary: cylinder r=300km, h=100km")
    print(f"  falloff: lateral=0.7, radial=0.8")
    print(f"  resourcedensity: {cylinder_density}")
    print(f"  replenishtime: {cylinder_replenishtime}s")
    print(f"\n输出：")
    print(f"  total_volume_km3: {result['total_vol_km3']:,.0f} ← 原始体积")
    print(f"  volume_km3: {result['effective_vol_km3']:,.0f} ← 截断后的体积")
    print(f"  total_yield: {result['total_yield']:,}")
    print(f"  effective_yield: {result['effective_yield']:,}")

    # -------------------------------------------------------------------------
    # 总结
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("【总结】")
    print("=" * 80)
    print("""
字段使用规则：

1. total_volume_km3 / volume_km3 的含义：
   - 气体：方块数（不是真正的 km³）
   - 固体：km³（真正的体积）

2. 使用 total 还是 effective：
   - total_yield = total_XXX × falloff × density（理论最大产量）
   - yield = effective_XXX × falloff × density（实际有效产量）

3. nebula 问题：
   - nebula 没有 boundary，calculate_gas_block_count_truncated 返回 (1, 0)
   - 但实际输出是 total_volume_km3=248
   - 需要调查 248 的来源...
""")


if __name__ == "__main__":
    main()
