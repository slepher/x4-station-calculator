#!/usr/bin/env python3
"""
检查 Cluster_02_Sector002_macro 和 Cluster_7300_Sector001_macro 的 cluster_id

用法:
    python3 analysis/tmp_scripts/check_sector_cluster.py
"""

import json
from pathlib import Path

def main():
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/maps.json") as f:
        maps_data = json.load(f)

    target_sectors = ["Cluster_02_Sector002_macro", "Cluster_7300_Sector001_macro"]

    found = False
    clusters_dict = maps_data.get("clusters", {})
    for cluster_id, cluster in clusters_dict.items():
        sectors_dict = cluster.get("sectors", {})
        for sector_id, sector in sectors_dict.items():
            if sector_id in target_sectors:
                found = True
                print(f"{sector_id}:")
                print(f"  cluster_id={sector.get('cluster_id', 'MISSING')}")
                print(f"  实际 cluster={cluster_id}")

    if not found:
        print("未在 clusters 中找到这些 sector")
        # 尝试直接查找
        for target in target_sectors:
            print(f"\n查找 {target}:")
            for cluster_id, cluster in clusters_dict.items():
                sectors_dict = cluster.get("sectors", {})
                if target in sectors_dict:
                    print(f"  在 {cluster_id} 中找到")
                    print(f"  cluster_id={sectors_dict[target].get('cluster_id', 'MISSING')}")

if __name__ == "__main__":
    main()
