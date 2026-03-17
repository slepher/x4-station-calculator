#!/usr/bin/env python3
"""
临时分析脚本 - 详细统计无坐标 region 的信息

用法:
    python3 analysis/tmp_scripts/detailed_region_stats.py
"""

import json
from pathlib import Path

def main():
    with open('src/assets/x4_game_data/8.0-Diplomacy/data/regions.json') as f:
        regions = json.load(f)

    without_position = [r for r in regions if 'position' not in r]

    print("无坐标的 region ID 列表:")
    for r in sorted(without_position, key=lambda x: x['id']):
        boundary = r.get('boundary', {})
        shape = boundary.get('class', 'unknown')
        size = boundary.get('size', {})
        resources = [res['ware'] for res in r.get('resources', [])]
        print(f"  {r['id']}")
        print(f"    形状：{shape}, 体积：{r.get('volume_km3', 0):,} km³")
        print(f"    资源：{', '.join(resources)}")
        if size:
            print(f"    尺寸：{size}")
        print()

if __name__ == "__main__":
    main()
