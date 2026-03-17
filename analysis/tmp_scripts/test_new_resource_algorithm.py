#!/usr/bin/env python3
"""
测试新的 8.0 资源计算算法（简化版）

新算法核心：
1. 移除 fields/noise/factor 计算
2. 固体：体积 × falloff × resourcedensity
3. 气体：方块数 × falloff × resourcedensity
4. 截断规则：固体 256km×256km×192km，气体 256km×256km×64km
"""
import json
import math
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# 截断限制（单位：米）
SOLID_XZ_LIMIT = 256_000      # 256 km
SOLID_Y_LIMIT = 96_000        # 96 km (总高度 192km)
GAS_XZ_LIMIT = 256_000        # 256 km
GAS_Y_LIMIT = 64_000          # 64 km (总高度 128km)
GAS_BLOCK_SIZE = 64_000       # 64 km 立方体网格

# 气体资源 ware 列表
GAS_WARES = {"helium", "hydrogen", "methane", "bogas"}


def is_gas_ware(ware: str) -> bool:
    """判断 ware 是否为气体资源"""
    return ware in GAS_WARES


def calculate_falloff_factor(falloff: Optional[dict]) -> Tuple[float, float, float]:
    """
    计算 falloff 的一元值

    Returns:
        (lateral_factor, radial_factor, total_factor)
    """
    if not falloff:
        return (1.0, 1.0, 1.0)

    lateral_steps = falloff.get("lateral", [])
    radial_steps = falloff.get("radial", [])

    # 使用 piecewise average 计算 lateral factor
    lateral_factor = piecewise_average(lateral_steps)
    # 使用 weighted power=1 计算 radial factor
    radial_factor = piecewise_average(radial_steps, weighted_power=1)

    return (lateral_factor, radial_factor, lateral_factor * radial_factor)


def piecewise_average(steps: List[dict], weighted_power: Optional[int] = None) -> float:
    """
    分段线性函数的平均值

    Args:
        steps: 分段点列表，每个包含 position (0-1) 和 value
        weighted_power: 如果为 1，则使用加权平均（径向 falloff 使用）
    """
    if not steps:
        return 1.0

    points = sorted(
        [
            {
                "position": min(1.0, max(0.0, float(item.get("position", 0.0)))),
                "value": float(item.get("value", 0.0)),
            }
            for item in steps
        ],
        key=lambda item: item["position"],
    )

    # 确保覆盖 [0, 1] 区间
    if points[0]["position"] > 0.0:
        points.insert(0, {"position": 0.0, "value": points[0]["value"]})
    if points[-1]["position"] < 1.0:
        points.append({"position": 1.0, "value": points[-1]["value"]})

    total = 0.0
    weight_total = 0.0

    for left, right in zip(points, points[1:]):
        x0 = left["position"]
        x1 = right["position"]
        if x1 <= x0:
            continue
        y0 = left["value"]
        y1 = right["value"]
        mid = (x0 + x1) * 0.5
        ymid = y0 + (y1 - y0) * ((mid - x0) / (x1 - x0))

        if weighted_power is None:
            # 梯形法则
            total += (y0 + y1) * (x1 - x0) * 0.5
            weight_total += (x1 - x0)
        else:
            # 加权 Simpson 法则
            w0 = x0 ** weighted_power
            wm = mid ** weighted_power
            w1 = x1 ** weighted_power
            total += ((y0 * w0) + (4.0 * ymid * wm) + (y1 * w1)) * (x1 - x0) / 6.0
            weight_total += (w0 + (4.0 * wm) + w1) * (x1 - x0) / 6.0

    if weight_total <= 0:
        return 1.0
    return total / weight_total


def calculate_solid_volume(boundary: dict) -> Tuple[float, float]:
    """
    计算固体资源的有效体积（截断后）

    Args:
        boundary: 边界定义（含 class, size, spline 等）

    Returns:
        (total_volume_m3, effective_volume_m3) - 截断前和截断后的体积
    """
    boundary_class = boundary.get("class", "")
    size = boundary.get("size", {})
    radius = float(size.get("r", 0.0))

    if boundary_class == "sphere":
        # 球体：V = 4/3 × π × r³
        total_volume = (4.0 / 3.0) * math.pi * (radius ** 3)
        # 截断：半径限制在 200km
        capped_radius = min(radius, 200_000)
        effective_volume = (4.0 / 3.0) * math.pi * (capped_radius ** 3)
        return (total_volume, effective_volume)

    elif boundary_class == "cylinder":
        linear = float(size.get("linear", 0.0))
        # 圆柱：V = π × r² × h
        total_volume = math.pi * (radius ** 2) * linear
        # 截断
        capped_radius = min(radius, SOLID_XZ_LIMIT)
        capped_height = min(linear, SOLID_Y_LIMIT * 2)  # 192km = 2 × 96km
        effective_volume = math.pi * (capped_radius ** 2) * capped_height
        return (total_volume, effective_volume)

    elif boundary_class == "splinetube":
        spline = boundary.get("spline", [])
        length = 0.0
        for i in range(len(spline) - 1):
            p0 = spline[i]
            p1 = spline[i + 1]
            dx = float(p1.get("x", 0.0)) - float(p0.get("x", 0.0))
            dy = float(p1.get("y", 0.0)) - float(p0.get("y", 0.0))
            dz = float(p1.get("z", 0.0)) - float(p0.get("z", 0.0))
            length += math.sqrt(dx*dx + dy*dy + dz*dz)

        # Tube: V = π × r² × length
        total_volume = math.pi * (radius ** 2) * length
        # 截断：X/Z 限制
        # 这里简化处理，假设 tube 沿着某个轴延伸
        capped_radius = min(radius, SOLID_XZ_LIMIT)
        capped_length = min(length, SOLID_XZ_LIMIT * 2)  # 最大 512km 长度
        effective_volume = math.pi * (capped_radius ** 2) * capped_length
        return (total_volume, effective_volume)

    else:
        return (0.0, 0.0)


def calculate_gas_block_count(
    region_pos: Dict[str, float],
    boundary: dict,
    sector_pos: Optional[Dict[str, float]] = None
) -> Tuple[int, int]:
    """
    计算气体资源命中的 64km³ 方块数量

    Args:
        region_pos: region 相对 sector 的坐标
        boundary: 边界定义
        sector_pos: sector 的世界坐标（用于坐标转换）

    Returns:
        (total_blocks, effective_blocks) - 总方块数和有效方块数
    """
    # 气体使用 64km 立方体网格
    block_size = GAS_BLOCK_SIZE

    # 有效范围
    xz_blocks = int(GAS_XZ_LIMIT / block_size) * 2 + 1  # 9 个方块（-256 到 +256）
    y_blocks = int(GAS_Y_LIMIT / block_size) * 2 + 1     # 3 个方块（-64 到 +64）

    # 获取 region 的边界参数
    radius = float(boundary.get("size", {}).get("r", 0.0))

    # 简化计算：假设 region 是球形，计算与网格的重合
    # 实际实现需要更精确的几何交集计算
    region_radius_blocks = radius / block_size

    # 计算总方块数（截断前）
    # 简化为球体内的方块数
    total_blocks = int((4.0 / 3.0) * math.pi * (region_radius_blocks ** 3))

    # 计算有效方块数（截断后）
    effective_blocks = 0

    # 遍历有效范围内的方块
    for bx in range(-xz_blocks, xz_blocks + 1):
        for by in range(-y_blocks, y_blocks + 1):
            for bz in range(-xz_blocks, xz_blocks + 1):
                # 方块中心坐标
                block_x = bx * block_size
                block_y = max(64_000, by * block_size)  # 气体最小高度 64km
                block_z = bz * block_size

                # 计算方块中心到 region 中心的距离
                dx = block_x - region_pos.get("x", 0.0)
                dy = block_y - region_pos.get("y", 0.0)
                dz = block_z - region_pos.get("z", 0.0)
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)

                # 如果方块中心在 region 内，则计数
                if dist <= radius:
                    effective_blocks += 1

    return (max(1, total_blocks), max(0, effective_blocks))


def calculate_region_resources_simplified(
    region: dict,
    region_pos: Optional[Dict[str, float]] = None,
) -> List[dict]:
    """
    简化版资源计算（8.0 新算法）

    公式：yield = base × falloff × resourcedensity

    Args:
        region: region 定义（含 boundary, falloff, resources）
        region_pos: region 相对 sector 的坐标（用于气体计算）

    Returns:
        资源列表
    """
    boundary = region.get("boundary", {})
    falloff = region.get("falloff")
    resources_raw = region.get("resources", [])

    # 计算 falloff
    lateral_f, radial_f, total_falloff = calculate_falloff_factor(falloff)

    results = []

    for res in resources_raw:
        ware = res.get("ware", "")
        resourcedensity = float(res.get("resourcedensity", 0.0))
        replenishtime = float(res.get("replenishtime", 60.0))

        if resourcedensity <= 0:
            continue

        if is_gas_ware(ware):
            # 气体资源：使用方块网格算法
            total_blocks, effective_blocks = calculate_gas_block_count(
                region_pos or {"x": 0, "y": 0, "z": 0},
                boundary
            )

            # yield = blocks × falloff × resourcedensity
            total_yield = total_blocks * total_falloff * resourcedensity
            effective_yield = effective_blocks * total_falloff * resourcedensity

            # respawn = yield × 60 / replenishtime
            total_respawn = total_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0
            effective_respawn = effective_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0

            results.append({
                "ware": ware,
                "resourcedensity": resourcedensity,
                "total_yield": int(total_yield),
                "total_respawn": int(total_respawn),
                "yield": int(effective_yield),
                "respawn": int(effective_respawn),
                "delay": replenishtime,
                "factor": 1.0,  # 气体不再使用 factor
            })
        else:
            # 固体资源：使用体积算法
            total_vol, effective_vol = calculate_solid_volume(boundary)

            # 转换为 km³
            total_vol_km3 = total_vol / 1_000_000_000.0
            effective_vol_km3 = effective_vol / 1_000_000_000.0

            # yield = volume × falloff × resourcedensity
            total_yield = total_vol_km3 * total_falloff * resourcedensity
            effective_yield = effective_vol_km3 * total_falloff * resourcedensity

            # respawn = yield × 60 / replenishtime
            total_respawn = total_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0
            effective_respawn = effective_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0

            results.append({
                "ware": ware,
                "resourcedensity": resourcedensity,
                "total_yield": int(total_yield),
                "total_respawn": int(total_respawn),
                "yield": int(effective_yield),
                "respawn": int(effective_respawn),
                "delay": replenishtime,
                "factor": 1.0,  # 固体不再使用 factor
            })

    return results


def main():
    # 加载 regions.json
    regions_path = Path(__file__).parent.parent.parent / "src" / "assets" / "x4_game_data" / "8.0-Diplomacy" / "data" / "regions.json"

    with open(regions_path, "r", encoding="utf-8") as f:
        regions = json.load(f)

    print(f"加载了 {len(regions)} 个 regions")

    # 测试前 5 个 region
    for region in regions[:5]:
        print(f"\n=== {region['id']} ===")
        print(f"  boundary: {region.get('boundary', {}).get('class', 'unknown')}")
        print(f"  volume_km3: {region.get('volume_km3', 'N/A')}")
        print(f"  falloff_factor: {region.get('falloff_factor', 'N/A')}")

        resources = region.get("resources", [])
        print(f"  resources: {len(resources)} 个")

        # 测试新算法
        new_resources = calculate_region_resources_simplified(region)
        print(f"  新算法 resources: {len(new_resources)} 个")

        for res in new_resources[:3]:
            print(f"    - {res['ware']}: yield={res['yield']:,}, respawn={res['respawn']:,}")


if __name__ == "__main__":
    main()
