#!/usr/bin/env python3
"""
检查 p1_40km_asteroid_field 在哪些 sector 中被引用

用法:
    python3 analysis/tmp_scripts/check_region_refs.py
"""

import json
from pathlib import Path
from collections import defaultdict

def main():
    # 读取 maps.json 查看 sector-region 链接
    maps_path = Path("src/assets/x4_game_data/8.0-Diplomacy/data/maps.json")
    with open(maps_path) as f:
        maps_data = json.load(f)

    # 查找引用 p1_40km_asteroid_field 的 sector
    target_ref = "p1_40km_asteroid_field"
    found_refs = []

    # 检查 clusters
    clusters_dict = maps_data.get("clusters", {})
    for cluster_id, cluster in clusters_dict.items():
        sectors_dict = cluster.get("sectors", {})
        for sector_id, sector in sectors_dict.items():
            regions = sector.get("regions", [])
            if regions:
                for region_ref in regions:
                    if region_ref == target_ref:
                        found_refs.append({
                            "cluster_id": cluster_id,
                            "sector_id": sector_id
                        })

    print(f"引用 {target_ref} 的 sector:")
    for ref in found_refs:
        print(f"  Cluster_{ref['cluster_id']}_Sector_{ref['sector_id']}")

    print(f"\n总计：{len(found_refs)} 个 sector")

    # 检查 resourceareas.json 中的 position
    resourceareas_path = Path("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json")
    with open(resourceareas_path) as f:
        resourceareas = json.load(f)

    print("\nresourceareas.json 中的 entry:")
    for cluster in resourceareas:
        cluster_id = cluster.get("cluster_id", "unknown")
        sector_id = cluster.get("sector_id", "unknown")
        for area in cluster.get("areas", []):
            if area["ref"] == target_ref:
                print(f"  cluster={cluster_id}, sector={sector_id}, ref={area['ref']}, amount={area['amount']}, position={area.get('position')}")

if __name__ == "__main__":
    main()
