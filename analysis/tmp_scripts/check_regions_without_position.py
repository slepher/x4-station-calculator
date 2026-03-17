#!/usr/bin/env python3
"""
分析 resourceareas.json 中是否存在没有 position 字段的 area
"""

import json
from pathlib import Path

def main():
    resourceareas_path = Path("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json")
    with open(resourceareas_path) as f:
        resourceareas = json.load(f)

    print(f"总 group 数量：{len(resourceareas)}")
    print()

    # 分类
    areas_with_position = []
    areas_without_position = []

    for group in resourceareas:
        cluster_id = group.get("cluster_id", "")
        sector_id = group.get("sector_id", "")
        for area in group.get("areas", []):
            has_position = "position" in area and area["position"] is not None
            if has_position:
                areas_with_position.append({
                    "cluster_id": cluster_id,
                    "sector_id": sector_id,
                    "ref": area.get("ref", ""),
                })
            else:
                areas_without_position.append({
                    "cluster_id": cluster_id,
                    "sector_id": sector_id,
                    "ref": area.get("ref", ""),
                })

    # 输出没有 position 的 area
    print("=" * 180)
    print("没有 position 字段的 area")
    print("=" * 180)

    if areas_without_position:
        print(f"{'Ref':<60} {'Cluster':<30} {'Sector':<30}")
        print("-" * 180)
        for area in sorted(areas_without_position, key=lambda x: x.get("ref", "")):
            ref = area.get("ref", "(无 ref)")
            cluster_id = area.get("cluster_id", "")
            sector_id = area.get("sector_id", "")
            print(f"{ref:<60} {cluster_id:<30} {sector_id:<30}")
    else:
        print("（所有 area 都有 position 字段）")

    print()
    print("=" * 180)
    print("统计")
    print("=" * 180)
    print(f"  有 position 的 area: {len(areas_with_position)}")
    print(f"  没有 position 的 area: {len(areas_without_position)}")
    print(f"  总计：{len(areas_with_position) + len(areas_without_position)}")

if __name__ == "__main__":
    main()
