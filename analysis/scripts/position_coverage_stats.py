#!/usr/bin/env python3
"""
统计包含 position 字段的 region 数量

用法:
    python3 analysis/scripts/position_coverage_stats.py
"""

import json
from pathlib import Path

def load_regions(version="8.0"):
    """加载指定版本的 regions.json"""
    regions_path = Path(f"src/assets/x4_game_data/{version}-Diplomacy/data/regions.json")
    with open(regions_path) as f:
        return json.load(f)

def main():
    regions = load_regions("8.0")

    with_position = [r for r in regions if 'position' in r]
    without_position = [r for r in regions if 'position' not in r]

    print(f"总 region 数量：{len(regions)}")
    print(f"有 position 字段：{len(with_position)} ({len(with_position)/len(regions)*100:.1f}%)")
    print(f"无 position 字段：{len(without_position)} ({len(without_position)/len(regions)*100:.1f}%)")

    # 打印示例
    print("\n有 position 的示例:")
    for r in with_position[:3]:
        print(f"  {r['id']}: {r.get('position')}")

if __name__ == "__main__":
    main()
