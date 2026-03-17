#!/usr/bin/env python3
"""
分析不包含坐标的 region 的形状和资源分布

用法:
    python3 analysis/scripts/analyze_regions_without_position.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path

def load_regions(version="8.0"):
    """加载指定版本的 regions.json"""
    regions_path = Path(f"src/assets/x4_game_data/{version}-Diplomacy/data/regions.json")
    with open(regions_path) as f:
        return json.load(f)

def analyze_regions_without_position(regions):
    """分析不包含 position 字段的 region"""
    without_position = [r for r in regions if 'position' not in r]

    print(f"不包含 position 的 region 数量：{len(without_position)}")
    print()

    # 统计形状分布
    shape_dist = defaultdict(int)
    for r in without_position:
        boundary = r.get('boundary', {})
        shape_class = boundary.get('class', 'unknown')
        shape_dist[shape_class] += 1

    print("形状分布:")
    for shape, count in sorted(shape_dist.items(), key=lambda x: -x[1]):
        print(f"  {shape}: {count}")

    # 按形状分类统计
    by_shape = defaultdict(list)
    for r in without_position:
        boundary = r.get('boundary', {})
        shape_class = boundary.get('class', 'unknown')
        size = boundary.get('size', {})
        by_shape[shape_class].append({
            'id': r['id'],
            'size': size,
            'volume_km3': r.get('volume_km3', 0),
            'resources': [res['ware'] for res in r.get('resources', [])]
        })

    print()
    print("大小分布详情:")

    for shape, items in sorted(by_shape.items(), key=lambda x: -len(x[1])):
        print(f"\n{shape} ({len(items)} 个):")

        # 统计资源类型
        resource_dist = defaultdict(int)
        for item in items:
            for ware in item['resources']:
                resource_dist[ware] += 1

        print("  资源类型分布:")
        for ware, count in sorted(resource_dist.items(), key=lambda x: -x[1])[:10]:
            print(f"    {ware}: {count}")

        # 统计大小（按体积）
        volumes = [item['volume_km3'] for item in items]
        if volumes:
            print(f"  体积范围 (km³): min={min(volumes):,}, max={max(volumes):,}, avg={sum(volumes)/len(volumes):,.0f}")

    return without_position

def analyze_by_naming_pattern(without_position):
    """按命名模式分类分析"""
    print("\n" + "="*60)
    print("按命名模式分类:")
    print()

    # globalregion 模式
    globalregion = [r for r in without_position if 'globalregion' in r['id']]
    print(f"globalregion 模式：{len(globalregion)}")
    for r in globalregion:
        print(f"  {r['id']}")

    # region_cluster_X_sector_Y 模式（可能是全局 sector 区域）
    cluster_sector = [r for r in without_position if re.search(r'region_cluster_\d+_sector_\d+', r['id'])]
    print(f"\nregion_cluster_X_sector_Y 模式：{len(cluster_sector)}")
    for r in cluster_sector:
        shape = r.get('boundary', {}).get('class', 'unknown')
        print(f"  {r['id']} - {shape}")

    # 测试/演示区域
    test_demo = [r for r in without_position if 'test' in r['id'].lower() or 'demo' in r['id'].lower()]
    print(f"\n测试/演示区域：{len(test_demo)}")
    for r in test_demo:
        print(f"  {r['id']}")

    # 其他模式
    other = [r for r in without_position if r not in globalregion and r not in cluster_sector and r not in test_demo]
    print(f"\n其他：{len(other)}")
    for r in other:
        shape = r.get('boundary', {}).get('class', 'unknown')
        print(f"  {r['id']} - {shape}")

def main():
    regions = load_regions("8.0")
    print(f"总 region 数量：{len(regions)}")
    print()

    without_position = analyze_regions_without_position(regions)
    analyze_by_naming_pattern(without_position)

if __name__ == "__main__":
    main()
