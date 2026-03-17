#!/usr/bin/env python3
"""
检查 resourceareas.json 中 cluster_id 为空的 sector 在 XML 中的定义

用法:
    python3 analysis/tmp_scripts/check_xml_sectors.py
"""

import xml.etree.ElementTree as ET
from pathlib import Path

def main():
    # 查找 maps.xml 文件
    maps_xml = Path("src/assets/x4_game_data/8.0-Diplomacy/maps/xu_ep2_universe/maps.xml")
    if not maps_xml.exists():
        print(f"找不到 {maps_xml}")
        return

    tree = ET.parse(maps_xml)
    root = tree.getroot()

    # 查找包含 Cluster_02_Sector002 或 Cluster_7300 的 macro
    target_sectors = ["Cluster_02_Sector002_macro", "Cluster_7300_Sector001_macro"]

    for macro in root.findall(".//macro"):
        name = macro.get("name", "")
        if name in target_sectors:
            print(f"\n找到 macro: {name}")
            print(f"  class={macro.get('class', 'unknown')}")
            # 打印父节点
            for parent in root.iter():
                for child in parent:
                    if child is macro:
                        print(f"  父节点：{parent.tag}, class={parent.get('class', 'unknown')}")
                        ref_attr = parent.get("ref", "")
                        if ref_attr:
                            print(f"  父节点 ref={ref_attr}")

if __name__ == "__main__":
    main()
