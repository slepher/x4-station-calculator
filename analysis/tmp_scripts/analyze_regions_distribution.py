#!/usr/bin/env python3
"""
统计 regions.json 中气体资源区域的几何分布
- 仅统计含有气体资源（helium, hydrogen, methane）的 region
- splinetube 半径分布
- 球形各个直径的分布
- 柱体半径和高度的分布
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

# 添加父目录到路径以便导入
sys.path.insert(0, str(Path(__file__).parent.parent))

def load_regions(json_path: str) -> list:
    """加载 regions.json 文件"""
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_resource_areas_ref(json_path: str) -> set:
    """加载 resourceareas.json 中所有被引用的 region ref"""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    refs = set()
    for item in data:
        for area in item.get('areas', []):
            ref = area.get('ref')
            if ref:
                refs.add(ref)
    return refs

def analyze_boundary(regions: list, referenced_refs: set = None) -> dict:
    """分析 boundary 类型和尺寸分布（仅气体资源）"""
    # 气体资源列表
    GAS_WARES = {'helium', 'hydrogen', 'methane'}

    stats = {
        'total': len(regions),
        'gas_regions': 0,
        'referenced_gas_regions': 0,
        'boundary_types': defaultdict(int),
        'splinetube_radius': [],
        'sphere_diameter': [],
        'cylinder_radius_height': [],
        'gas_type_count': defaultdict(int),
        'sphere_falloff': [],
    }

    for region in regions:
        # 检查 resources 是否包含气体
        resources = region.get('resources', [])
        if not resources:
            continue

        # 检查是否包含气体资源
        region_gases = set()
        for res in resources:
            ware = res.get('ware', '')
            if ware in GAS_WARES:
                region_gases.add(ware)

        if not region_gases:
            continue  # 跳过非气体区域

        # 如果有 referenced_refs，检查该 region 是否被引用
        region_id = region.get('id', region.get('ref', ''))
        if referenced_refs is not None and region_id not in referenced_refs:
            continue  # 跳过未被引用的 region

        stats['gas_regions'] += 1
        if referenced_refs is not None:
            stats['referenced_gas_regions'] += 1
        for gas in region_gases:
            stats['gas_type_count'][gas] += 1

        boundary = region.get('boundary')
        if boundary is None:
            stats['boundary_types']['none'] += 1
            continue

        boundary_class = boundary.get('class', 'unknown')
        stats['boundary_types'][boundary_class] += 1

        size = boundary.get('size', {})
        if size is None:
            size = {}
        radius = size.get('r', 0) if size else 0

        if boundary_class == 'splinetube':
            # Splinetube 半径
            stats['splinetube_radius'].append(radius)

        elif boundary_class == 'sphere':
            # 球体直径
            diameter = radius * 2
            stats['sphere_diameter'].append(diameter)
            # 收集球体气体的 falloff 数据
            falloff = region.get('falloff')
            if falloff:
                stats['sphere_falloff'].append({
                    'id': region.get('id', 'unknown'),
                    'radius_km': radius / 1000,
                    'lateral': falloff.get('lateral', []),
                    'radial': falloff.get('radial', []),
                    'lateral_factor': falloff.get('lateral_factor'),
                    'radial_factor': falloff.get('radial_factor'),
                    'effective_factor': falloff.get('effective_factor'),
                })

        elif boundary_class == 'cylinder':
            # 柱体半径和高度
            linear = size.get('linear', 0)
            stats['cylinder_radius_height'].append({
                'radius': radius,
                'height': linear,
                'id': region.get('id', 'unknown') if region.get('id', 'unknown') != 'unknown' else region.get('ref', 'unknown')
            })

    return stats

def bucket_radius(radius: float) -> str:
    """将半径分桶"""
    radius_km = radius / 1000  # 转换为 km
    if radius_km < 20:
        return "<20km"
    elif radius_km < 40:
        return "20-40km"
    elif radius_km < 60:
        return "40-60km"
    elif radius_km < 80:
        return "60-80km"
    elif radius_km < 100:
        return "80-100km"
    elif radius_km < 150:
        return "100-150km"
    elif radius_km < 200:
        return "150-200km"
    elif radius_km < 300:
        return "200-300km"
    elif radius_km < 500:
        return "300-500km"
    elif radius_km < 1000:
        return "500-1000km"
    else:
        return "≥1000km"

def bucket_diameter(diameter: float) -> str:
    """将直径分桶"""
    diameter_km = diameter / 1000  # 转换为 km
    if diameter_km < 40:
        return "<40km"
    elif diameter_km < 80:
        return "40-80km"
    elif diameter_km < 120:
        return "80-120km"
    elif diameter_km < 160:
        return "120-160km"
    elif diameter_km < 200:
        return "160-200km"
    elif diameter_km < 300:
        return "200-300km"
    elif diameter_km < 400:
        return "300-400km"
    elif diameter_km < 600:
        return "400-600km"
    elif diameter_km < 1000:
        return "600-1000km"
    else:
        return "≥1000km"

def bucket_height(height: float) -> str:
    """将高度分桶"""
    height_km = height / 1000  # 转换为 km
    if height_km < 20:
        return "<20km"
    elif height_km < 40:
        return "20-40km"
    elif height_km < 60:
        return "40-60km"
    elif height_km < 80:
        return "60-80km"
    elif height_km < 100:
        return "80-100km"
    elif height_km < 150:
        return "100-150km"
    elif height_km < 200:
        return "150-200km"
    else:
        return "≥200km"


def interpolate_piecewise(steps: list, x: float) -> float:
    """
    在分段线性曲线上插值求值。

    Args:
        steps: 分段曲线数据，每项包含 position 和 value
        x: 输入值 (0-1)

    Returns:
        插值后的 y 值
    """
    if not steps:
        return 1.0

    # 排序
    points = sorted(
        [{"position": float(s.get("position", 0)), "value": float(s.get("value", 0))} for s in steps],
        key=lambda p: p["position"]
    )

    # 边界处理
    if x <= points[0]["position"]:
        return points[0]["value"]
    if x >= points[-1]["position"]:
        return points[-1]["value"]

    # 找到 x 所在区间并插值
    for i in range(len(points) - 1):
        x0, y0 = points[i]["position"], points[i]["value"]
        x1, y1 = points[i + 1]["position"], points[i + 1]["value"]
        if x0 <= x <= x1:
            if x1 == x0:
                return y0
            t = (x - x0) / (x1 - x0)
            return y0 + t * (y1 - y0)

    return points[-1]["value"]

def print_stats(stats: dict, with_filter: bool = False):
    """打印统计结果"""
    print("=" * 80)
    print("气体资源区域统计报告")
    if with_filter:
        print("（已过滤未被 resourceareas.json 引用的 region）")
    print("=" * 80)

    print(f"\n【总体统计】")
    print(f"  总 region 数量：{stats['total']}")
    if with_filter:
        print(f"  过滤后气体区域数量：{stats['gas_regions']}")
    else:
        print(f"  气体区域数量：{stats['gas_regions']}")

    print(f"\n【气体类型分布】")
    gas_total = stats['gas_regions']
    for gas_type, count in sorted(stats['gas_type_count'].items(), key=lambda x: -x[1]):
        pct = count / gas_total * 100 if gas_total > 0 else 0
        print(f"  {gas_type}: {count} ({pct:.1f}%)")

    print(f"\n【Boundary 类型分布（气体区域）】")
    gas_total = sum(stats['boundary_types'].values())
    for btype, count in sorted(stats['boundary_types'].items(), key=lambda x: -x[1]):
        pct = count / gas_total * 100 if gas_total > 0 else 0
        print(f"  {btype}: {count} ({pct:.1f}%)")

    # Splinetube 半径分布
    print(f"\n【Splinetube 半径分布】")
    if stats['splinetube_radius']:
        radius_buckets = defaultdict(int)
        for r in stats['splinetube_radius']:
            radius_buckets[bucket_radius(r)] += 1

        print(f"  总数：{len(stats['splinetube_radius'])}")
        print(f"  最小值：{min(stats['splinetube_radius']) / 1000:.1f} km")
        print(f"  最大值：{max(stats['splinetube_radius']) / 1000:.1f} km")
        print(f"  平均值：{sum(stats['splinetube_radius']) / len(stats['splinetube_radius']) / 1000:.1f} km")
        print(f"  分布:")
        for bucket, count in sorted(radius_buckets.items()):
            print(f"    {bucket}: {count}")
    else:
        print("  无 splinetube 数据")

    # 球体直径分布
    print(f"\n【球体直径分布】")
    if stats['sphere_diameter']:
        diameter_buckets = defaultdict(int)
        for d in stats['sphere_diameter']:
            diameter_buckets[bucket_diameter(d)] += 1

        print(f"  总数：{len(stats['sphere_diameter'])}")
        print(f"  最小值：{min(stats['sphere_diameter']) / 1000:.1f} km")
        print(f"  最大值：{max(stats['sphere_diameter']) / 1000:.1f} km")
        print(f"  平均值：{sum(stats['sphere_diameter']) / len(stats['sphere_diameter']) / 1000:.1f} km")
        print(f"  分布:")
        for bucket, count in sorted(diameter_buckets.items()):
            print(f"    {bucket}: {count}")

        # 打印球体 falloff 统计
        print(f"\n【球体 Falloff 统计】")
        sphere_falloff_data = stats.get('sphere_falloff', [])
        if sphere_falloff_data:
            print(f"  有 falloff 数据的球体数量：{len(sphere_falloff_data)}")
            effective_factors = [f['effective_factor'] for f in sphere_falloff_data if f.get('effective_factor') is not None]
            if effective_factors:
                print(f"  effective_factor 分布:")
                print(f"    最小值：{min(effective_factors):.4f}")
                print(f"    最大值：{max(effective_factors):.4f}")
                print(f"    平均值：{sum(effective_factors) / len(effective_factors):.4f}")

            # 按直径分组统计
            print(f"\n  按直径分组统计:")
            small_spheres = [f for f in sphere_falloff_data if f['radius_km'] * 2 < 1000]
            large_spheres = [f for f in sphere_falloff_data if f['radius_km'] * 2 >= 1000]

            if small_spheres:
                factors = [f['effective_factor'] for f in small_spheres if f.get('effective_factor')]
                if factors:
                    print(f"    直径 < 1000km ({len(small_spheres)}个):")
                    print(f"      effective_factor 平均：{sum(factors) / len(factors):.4f}")

            if large_spheres:
                factors = [f['effective_factor'] for f in large_spheres if f.get('effective_factor')]
                if factors:
                    print(f"    直径 ≥ 1000km ({len(large_spheres)}个):")
                    print(f"      effective_factor 平均：{sum(factors) / len(factors):.4f}")

            # 打印详细列表
            print(f"\n  球体 falloff 详细列表:")
            for f in sorted(sphere_falloff_data, key=lambda x: x['radius_km']):
                print(f"    id={f['id']}, r={f['radius_km']:.1f}km, lateral_factor={f.get('lateral_factor', 'N/A')}, radial_factor={f.get('radial_factor', 'N/A')}, effective={f.get('effective_factor', 'N/A')}")

            # 统计 falloff 在 200km 半径以内的值
            print(f"\n【球体 falloff @ 200km 半径处统计】")
            print(f"  计算每个球体在距离球心 200km 处的 falloff 值（normalized_r = 200 / R）")
            falloff_at_200km = []
            for f in sphere_falloff_data:
                R = f['radius_km']
                if R <= 0:
                    continue
                # normalized_r = 200km / R
                normalized_r = 200.0 / R
                if normalized_r > 1.0:
                    # 200km 超出球体边界，falloff = 0
                    radial_val = 0.0
                else:
                    # 从 radial 曲线插值计算
                    radial_steps = f.get('radial', [])
                    if radial_steps:
                        radial_val = interpolate_piecewise(radial_steps, normalized_r)
                    else:
                        radial_val = 1.0
                # lateral 在球体中心点，取 lateral(0) = 1.0
                lateral_val = 1.0
                effective = radial_val * lateral_val
                falloff_at_200km.append({
                    'id': f['id'],
                    'R_km': R,
                    'normalized_r': normalized_r,
                    'radial_factor': radial_val,
                    'effective': effective,
                })

            if falloff_at_200km:
                print(f"  数量：{len(falloff_at_200km)}")
                effective_vals = [f['effective'] for f in falloff_at_200km]
                print(f"  effective @ 200km 分布:")
                print(f"    最小值：{min(effective_vals):.4f}")
                print(f"    最大值：{max(effective_vals):.4f}")
                print(f"    平均值：{sum(effective_vals) / len(effective_vals):.4f}")
                print(f"  详细列表:")
                for f in sorted(falloff_at_200km, key=lambda x: x['R_km']):
                    print(f"    id={f['id']}, R={f['R_km']:.1f}km, norm_r={f['normalized_r']:.4f}, radial={f['radial_factor']:.4f}, effective={f['effective']:.4f}")
            else:
                print(f"  无数据")

            # 统计半径 ≤ 200km 的球体
            print(f"\n【球体半径 ≤ 200km 统计】")
            small_spheres_200 = [f for f in sphere_falloff_data if f['radius_km'] <= 200]
            if small_spheres_200:
                print(f"  数量：{len(small_spheres_200)}")
                effective_factors_200 = [f['effective_factor'] for f in small_spheres_200 if f.get('effective_factor') is not None]
                if effective_factors_200:
                    print(f"  effective_factor 分布:")
                    print(f"    最小值：{min(effective_factors_200):.4f}")
                    print(f"    最大值：{max(effective_factors_200):.4f}")
                    print(f"    平均值：{sum(effective_factors_200) / len(effective_factors_200):.4f}")
                print(f"  详细列表:")
                for f in sorted(small_spheres_200, key=lambda x: x['radius_km']):
                    print(f"    id={f['id']}, r={f['radius_km']:.1f}km, effective={f.get('effective_factor', 'N/A')}")
            else:
                print(f"  无半径 ≤ 200km 的球体气体区域")
    else:
        print("  无球体数据")

    # 柱体半径和高度分布
    print(f"\n【柱体半径和高度分布】")
    if stats['cylinder_radius_height']:
        radius_buckets = defaultdict(int)
        height_buckets = defaultdict(int)

        for item in stats['cylinder_radius_height']:
            radius_buckets[bucket_radius(item['radius'])] += 1
            height_buckets[bucket_height(item['height'])] += 1

        print(f"  总数：{len(stats['cylinder_radius_height'])}")

        radii = [item['radius'] for item in stats['cylinder_radius_height']]
        heights = [item['height'] for item in stats['cylinder_radius_height']]

        print(f"\n  半径统计:")
        print(f"    最小值：{min(radii) / 1000:.1f} km")
        print(f"    最大值：{max(radii) / 1000:.1f} km")
        print(f"    平均值：{sum(radii) / len(radii) / 1000:.1f} km")
        print(f"    分布:")
        for bucket, count in sorted(radius_buckets.items()):
            print(f"      {bucket}: {count}")

        print(f"\n  高度统计:")
        print(f"    最小值：{min(heights) / 1000:.1f} km")
        print(f"    最大值：{max(heights) / 1000:.1f} km")
        print(f"    平均值：{sum(heights) / len(heights) / 1000:.1f} km")
        print(f"    分布:")
        for bucket, count in sorted(height_buckets.items()):
            print(f"      {bucket}: {count}")

        # 输出详细列表
        print(f"\n  柱体详细列表 (半径，高度，id):")
        for item in sorted(stats['cylinder_radius_height'], key=lambda x: x['radius']):
            r_km = item['radius'] / 1000
            h_km = item['height'] / 1000
            print(f"    r={r_km:.1f}km, h={h_km:.1f}km, id={item['id']}")
    else:
        print("  无柱体数据")

def main():
    # 支持 8.0 和 9.0 版本
    # 使用绝对路径
    base_dir = Path('/home/slepher/project/x4-station-calculator/worktrees/map-resource-calc')
    versions = ['8.0-Diplomacy', '9.0-Empire-beta']

    for version in versions:
        regions_path = base_dir / 'src' / 'assets' / 'x4_game_data' / version / 'data' / 'regions.json'
        resourceareas_path = base_dir / 'src' / 'assets' / 'x4_game_data' / version / 'data' / 'resourceareas.json'

        if not regions_path.exists():
            print(f"\n[跳过] {version}: regions.json 文件不存在")
            continue

        print(f"\n{'#' * 80}")
        print(f"# {version}")
        print(f"{'#' * 80}")

        regions = load_regions(str(regions_path))

        # 加载 resourceareas 中的引用 ref
        referenced_refs = None
        if resourceareas_path.exists():
            referenced_refs = load_resource_areas_ref(str(resourceareas_path))
            print(f"\n[info] {version}: resourceareas.json 中有 {len(referenced_refs)} 个被引用的 region ref")

        # 输出过滤后的统计
        stats_filtered = analyze_boundary(regions, referenced_refs)
        print_stats(stats_filtered, with_filter=True)

        # 只打印过滤后的详细柱体分布
        print(f"\n【柱体半径和高度分布】")
        if stats_filtered['cylinder_radius_height']:
            radius_buckets = defaultdict(int)
            height_buckets = defaultdict(int)

            for item in stats_filtered['cylinder_radius_height']:
                radius_buckets[bucket_radius(item['radius'])] += 1
                height_buckets[bucket_height(item['height'])] += 1

            print(f"  总数：{len(stats_filtered['cylinder_radius_height'])}")

            radii = [item['radius'] for item in stats_filtered['cylinder_radius_height']]
            heights = [item['height'] for item in stats_filtered['cylinder_radius_height']]

            print(f"\n  半径统计:")
            print(f"    最小值：{min(radii) / 1000:.1f} km")
            print(f"    最大值：{max(radii) / 1000:.1f} km")
            print(f"    平均值：{sum(radii) / len(radii) / 1000:.1f} km")
            print(f"    分布:")
            for bucket, count in sorted(radius_buckets.items()):
                print(f"      {bucket}: {count}")

            print(f"\n  高度统计:")
            print(f"    最小值：{min(heights) / 1000:.1f} km")
            print(f"    最大值：{max(heights) / 1000:.1f} km")
            print(f"    平均值：{sum(heights) / len(heights) / 1000:.1f} km")
            print(f"    分布:")
            for bucket, count in sorted(height_buckets.items()):
                print(f"      {bucket}: {count}")

            # 输出详细列表
            print(f"\n  柱体详细列表 (半径，高度，id):")
            for item in sorted(stats_filtered['cylinder_radius_height'], key=lambda x: x['radius']):
                r_km = item['radius'] / 1000
                h_km = item['height'] / 1000
                print(f"    r={r_km:.1f}km, h={h_km:.1f}km, id={item['id']}")
        else:
            print("  无柱体数据")

if __name__ == '__main__':
    main()
