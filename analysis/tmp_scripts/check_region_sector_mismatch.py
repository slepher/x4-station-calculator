#!/usr/bin/env python3
"""
查找 region ref 与 connection 所在 sector 不匹配的情况

用法:
    python3 analysis/tmp_scripts/check_region_sector_mismatch.py
"""

import xml.etree.ElementTree as ET
import re
from pathlib import Path
from collections import defaultdict

# 配置路径
RAW_ASSETS_DIR = Path("/home/slepher/project/x4-station-calculator/worktrees/map-resource-calc/src/assets/x4_game_data/8.0-Diplomacy")
MAPS_XML = RAW_ASSETS_DIR / "maps" / "xu_ep2_universe" / "data" / "map.xml"

# 如果 map.xml 不存在，尝试其他可能的文件名
if not MAPS_XML.exists():
    for name in ["maps.xml", "galaxy.xml", "xu_ep2_universe.xml"]:
        alt_path = RAW_ASSETS_DIR / "maps" / "xu_ep2_universe" / name
        if alt_path.exists():
            MAPS_XML = alt_path
            break

def parse_sector_from_connection_name(name):
    """从 connection 或 macro 名称中解析 sector 信息"""
    # 模式：C02S02_Region002_macro 或 Cluster_02_Sector002_macro
    patterns = [
        r"C(\d+)S(\d+)_.*",  # C02S02_...
        r"Cluster_(\d+)_Sector(\d+)_.*",  # Cluster_02_Sector002_...
    ]
    for pattern in patterns:
        match = re.match(pattern, name, re.IGNORECASE)
        if match:
            cluster_num = int(match.group(1))
            sector_num = int(match.group(2))
            return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro"
    return None

def parse_sector_from_region_ref(ref):
    """从 region ref 中解析预期的 sector 信息"""
    # 模式：region_cluster_02_sector_001b 或 region_cluster_02_sector_01_a
    patterns = [
        r"region_cluster_(\d+)_sector_(\d+)([a-z])?",  # region_cluster_02_sector_001b
    ]
    for pattern in patterns:
        match = re.match(pattern, ref, re.IGNORECASE)
        if match:
            cluster_num = int(match.group(1))
            sector_num = int(match.group(2))
            suffix = match.group(3) or ""
            return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro", suffix
    return None, None

def find_region_connections(root):
    """查找所有 region connection"""
    connections = []

    # 查找所有 connection[@ref='regions']
    for conn in root.iter("connection"):
        if conn.get("ref") == "regions":
            conn_name = conn.get("name", "")
            macro = conn.find("./macro")
            if macro is not None:
                macro_name = macro.get("name", "")
                region_prop = macro.find("./properties/region")
                region_ref = region_prop.get("ref", "") if region_prop is not None else ""

                # 从 connection 名称解析 sector
                conn_sector = parse_sector_from_connection_name(conn_name)
                if not conn_sector:
                    conn_sector = parse_sector_from_connection_name(macro_name)[0] if macro_name else None

                # 从 region ref 解析预期 sector
                expected_sector, suffix = parse_sector_from_region_ref(region_ref)

                connections.append({
                    "connection_name": conn_name,
                    "macro_name": macro_name,
                    "region_ref": region_ref,
                    "conn_sector": conn_sector,
                    "expected_sector": expected_sector,
                    "suffix": suffix,
                })

    return connections

def main():
    if not MAPS_XML.exists():
        print(f"找不到 Maps XML 文件：{MAPS_XML}")
        print("请确认 XML 文件路径")
        return

    print(f"解析 XML: {MAPS_XML}")
    tree = ET.parse(MAPS_XML)
    root = tree.getroot()

    connections = find_region_connections(root)
    print(f"找到 {len(connections)} 个 region connection\n")

    # 找出不匹配的
    mismatches = []
    matches = []

    for conn in connections:
        if conn["conn_sector"] and conn["expected_sector"]:
            if conn["conn_sector"] != conn["expected_sector"]:
                mismatches.append(conn)
            else:
                matches.append(conn)
        else:
            # 无法解析的
            mismatches.append(conn)

    # 输出表格
    print("=" * 120)
    print("不匹配的 Region Connection（region ref 与 connection 所在 sector 不一致）")
    print("=" * 120)
    print(f"{'Connection Name':<50} {'Region Ref':<40} {'Connection Sector':<30} {'Expected Sector':<30}")
    print("-" * 120)

    for conn in sorted(mismatches, key=lambda x: x["connection_name"]):
        conn_sector = conn["conn_sector"] or "无法解析"
        expected_sector = conn["expected_sector"] or "无法解析"
        print(f"{conn['connection_name']:<50} {conn['region_ref']:<40} {conn_sector:<30} {expected_sector:<30}")

    print("\n" + "=" * 120)
    print(f"统计:")
    print(f"  匹配的 connection: {len(matches)}")
    print(f"  不匹配的 connection: {len(mismatches)}")
    print(f"  总计：{len(connections)}")

if __name__ == "__main__":
    main()
