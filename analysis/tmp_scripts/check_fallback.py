#!/usr/bin/env python3
"""
检查回退到 region ref 的 connection
"""

import xml.etree.ElementTree as ET
import json
import re
from pathlib import Path
from typing import Optional

# XML 目录
XML_DIR = Path("x4raw_assets/8.0-Diplomacy/maps/xu_ep2_universe")

# 使用与 map_processor.py 相同的正则
REGION_CONNECTION_RES = (
    re.compile(r"C(\d+)S(\d+)_", re.IGNORECASE),
    re.compile(r"Cluster(\d+)_Sector(\d+)_", re.IGNORECASE),
)

# Region Ref 解析正则
REGION_REF_RES = (
    re.compile(r"region_cluster_(\d+)_sector_(\d+)", re.IGNORECASE),
    re.compile(r"region(\d+)_cluster_(\d+)_sector_(\d+)", re.IGNORECASE),
)

def resolve_sector_macro_from_region_connection(connection_name: str) -> Optional[str]:
    """与 map_processor.py 相同的解析逻辑"""
    for pattern in REGION_CONNECTION_RES:
        match = pattern.search(connection_name)
        if match is None:
            continue
        cluster_num = int(match.group(1))
        sector_num = int(match.group(2))
        return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro"
    return None

def resolve_sector_macro_from_region_ref(region_ref: str) -> Optional[str]:
    """从 region ref 解析 sector"""
    for pattern in REGION_REF_RES:
        match = pattern.search(region_ref)
        if match is None:
            continue
        groups = match.groups()
        if len(groups) == 3:
            cluster_num = int(groups[1])
            sector_num = int(groups[2])
        else:
            cluster_num = int(groups[0])
            sector_num = int(groups[1])
        return f"Cluster_{cluster_num:02d}_Sector{sector_num:03d}_macro"
    return None

def main():
    # 加载 maps.json 获取实际存在的 sector
    maps_path = Path("src/assets/x4_game_data/8.0-Diplomacy/data/maps.json")
    with open(maps_path) as f:
        maps_data = json.load(f)

    actual_sectors = set()
    clusters_dict = maps_data.get("clusters", {})
    for cluster_id, cluster in clusters_dict.items():
        sectors_dict = cluster.get("sectors", {})
        for sector_id in sectors_dict.keys():
            actual_sectors.add(sector_id)

    # 查找所有 *_clusters.xml 文件 + clusters.xml 主文件
    xml_files = list(XML_DIR.glob("*_clusters.xml"))
    main_clusters = XML_DIR / "clusters.xml"
    if main_clusters.exists():
        xml_files.insert(0, main_clusters)

    # 查找所有 region connection
    for xml_file in xml_files:
        try:
            tree = ET.parse(xml_file)
            root = tree.getroot()

            for conn in root.iter("connection"):
                if conn.get("ref") == "regions":
                    conn_name = conn.get("name", "")
                    macro = conn.find("./macro")
                    if macro is not None:
                        macro_name = macro.get("name", "")
                        region_prop = macro.find("./properties/region")
                        region_ref = region_prop.get("ref", "") if region_prop is not None else ""

                        conn_sector = resolve_sector_macro_from_region_connection(conn_name)
                        if not conn_sector:
                            conn_sector = resolve_sector_macro_from_region_connection(macro_name)

                        # 检查是否需要回退
                        if conn_sector and conn_sector not in actual_sectors:
                            ref_sector = resolve_sector_macro_from_region_ref(region_ref) if region_ref else None
                            print(f"XML: {xml_file.name}")
                            print(f"  Connection: {conn_name}")
                            print(f"  Macro: {macro_name}")
                            print(f"  Region Ref: {region_ref}")
                            print(f"  Conn Sector: {conn_sector} (无效)")
                            print(f"  Ref Sector: {ref_sector}")
                            print(f"  Final Sector: {ref_sector if ref_sector else conn_sector}")
                            print()
        except Exception as e:
            print(f"解析 {xml_file} 时出错：{e}")

if __name__ == "__main__":
    main()
