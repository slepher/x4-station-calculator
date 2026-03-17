#!/usr/bin/env python3
"""
分析 resourceareas.json 中 position 字段的值
"""

import json
from pathlib import Path

def main():
    resourceareas_path = Path("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json")
    with open(resourceareas_path) as f:
        resourceareas = json.load(f)

    print(f"总 group 数量：{len(resourceareas)}")
    print()

    zero_positions = []
    non_zero_positions = []

    for group in resourceareas:
        cluster_id = group.get("cluster_id", "")
        sector_id = group.get("sector_id", "")
        for area in group.get("areas", []):
            position = area.get("position")
            if position:
                is_zero = (position.get("x", 0) == 0 and
                          position.get("y", 0) == 0 and
                          position.get("z", 0) == 0)
                if is_zero:
                    zero_positions.append({
                        "cluster_id": cluster_id,
                        "sector_id": sector_id,
                        "ref": area.get("ref", ""),
                    })
                else:
                    non_zero_positions.append({
                        "cluster_id": cluster_id,
                        "sector_id": sector_id,
                        "ref": area.get("ref", ""),
                        "position": position,
                    })

    print("=" * 180)
    print("position 为 (0, 0, 0) 的 area")
    print("=" * 180)

    if zero_positions:
        print(f"{'Ref':<60} {'Cluster':<30} {'Sector':<30}")
        print("-" * 180)
        for area in sorted(zero_positions, key=lambda x: x.get("ref", "")):
            ref = area.get("ref", "(无 ref)")
            cluster_id = area.get("cluster_id", "")
            sector_id = area.get("sector_id", "")
            print(f"{ref:<60} {cluster_id:<30} {sector_id:<30}")
    else:
        print("（没有 position 为 (0, 0, 0) 的 area）")

    print()
    print("=" * 180)
    print("统计")
    print("=" * 180)
    print(f"  position 非零的 area: {len(non_zero_positions)}")
    print(f"  position 为 (0, 0, 0) 的 area: {len(zero_positions)}")
    print(f"  总计：{len(non_zero_positions) + len(zero_positions)}")

if __name__ == "__main__":
    main()
