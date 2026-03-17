#!/usr/bin/env python3
"""
分析 region ref 指向的 sector 是否实际存在于 maps.json 中

用法:
    python3 analysis/tmp_scripts/analyze_valid_sector_refs.py
"""

import re
import json
from pathlib import Path
from collections import defaultdict

def parse_sector_from_region_ref(ref):
    """从 region ref 中解析预期的 sector 信息"""
    patterns = [
        r"region_cluster_(\d+)_sector_(\d+)([a-z])?",
        r"region(\d+)_cluster_(\d+)_sector_(\d+)",
    ]
    for pattern in patterns:
        match = re.match(pattern, ref, re.IGNORECASE)
        if match:
            groups = match.groups()
            if len(groups) == 3:
                cluster_num, sector_num, suffix = groups
            else:
                cluster_num, sector_num = groups[1], groups[2]
                suffix = ""
            cluster_num = int(cluster_num)
            sector_num = int(sector_num)
            return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro", suffix
    return None, None

def main():
    with open("src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json") as f:
        resourceareas = json.load(f)

    with open("src/assets/x4_game_data/8.0-Diplomacy/data/maps.json") as f:
        maps_data = json.load(f)

    # 构建所有实际存在的 sector 集合
    actual_sectors = set()
    clusters_dict = maps_data.get("clusters", {})
    for cluster_id, cluster in clusters_dict.items():
        sectors_dict = cluster.get("sectors", {})
        for sector_id in sectors_dict.keys():
            actual_sectors.add(sector_id)

    print(f"实际存在的 sector 数量：{len(actual_sectors)}")
    print()

    # 收集所有 unique region ref 及其位置
    all_refs = defaultdict(list)
    for group in resourceareas:
        cluster_id = group.get("cluster_id", "")
        sector_id = group.get("sector_id", "")
        for area in group.get("areas", []):
            region_ref = area.get("ref", "")
            all_refs[region_ref].append({
                "cluster_id": cluster_id,
                "sector_id": sector_id,
            })

    # 分析 region ref 指向的 sector 是否存在
    valid_refs = []    # region ref 指向的 sector 实际存在
    invalid_refs = []  # region ref 指向的 sector 不存在

    for ref, locations in all_refs.items():
        expected_sector, suffix = parse_sector_from_region_ref(ref)
        if expected_sector:
            if expected_sector in actual_sectors:
                valid_refs.append({
                    "region_ref": ref,
                    "expected_sector": expected_sector,
                    "suffix": suffix,
                    "actual_locations": locations,
                })
            else:
                invalid_refs.append({
                    "region_ref": ref,
                    "expected_sector": expected_sector,
                    "suffix": suffix,
                    "actual_locations": locations,
                })

    # 输出表格 1：指向有效 sector 的 region ref
    print("=" * 140)
    print("表 1: Region Ref 指向实际存在的 Sector（有效引用）")
    print("=" * 140)
    print(f"{'Region Ref':<50} {'Expected Sector':<35} {'Actual Location(s)'}")
    print("-" * 140)

    for item in sorted(valid_refs, key=lambda x: x["region_ref"])[:50]:
        locs = ", ".join([f"{loc['cluster_id']}/{loc['sector_id']}" for loc in item["actual_locations"]])
        print(f"{item['region_ref']:<50} {item['expected_sector']:<35} {locs}")

    if len(valid_refs) > 50:
        print(f"... 还有 {len(valid_refs) - 50} 条记录")

    # 输出表格 2：指向无效 sector 的 region ref
    print("\n" + "=" * 140)
    print("表 2: Region Ref 指向不存在的 Sector（无效引用）")
    print("=" * 140)
    print(f"{'Region Ref':<50} {'Expected Sector':<35} {'Actual Location(s)'}")
    print("-" * 140)

    for item in sorted(invalid_refs, key=lambda x: x["region_ref"]):
        locs = ", ".join([f"{loc['cluster_id']}/{loc['sector_id']}" for loc in item["actual_locations"]])
        print(f"{item['region_ref']:<50} {item['expected_sector']:<35} {locs}")

    if not invalid_refs:
        print("（无无效引用）")

    # 统计
    print("\n" + "=" * 140)
    print("统计摘要")
    print("=" * 140)
    print(f"  使用 region_cluster_X_sector_Y 模式的 region: {len(valid_refs) + len(invalid_refs)}")
    print(f"  指向有效 sector 的 region: {len(valid_refs)}")
    print(f"  指向无效 sector 的 region: {len(invalid_refs)}")
    print()
    print("  实际存在的 sector 数量:", len(actual_sectors))

    # 列出所有无效的 sector
    invalid_sectors = set(item["expected_sector"] for item in invalid_refs)
    if invalid_sectors:
        print(f"\n  无效 sector 列表（{len(invalid_sectors)} 个）:")
        for s in sorted(invalid_sectors):
            print(f"    - {s}")

if __name__ == "__main__":
    main()
