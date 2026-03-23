"""更新 regions.json 添加 field definitions。

从 region_definitions XML 提取 field 定义，合并到 regions.json。
"""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Any


def parse_region_definitions(xml_path: Path) -> Dict[str, Dict[str, Any]]:
    """解析 region_definitions XML，返回 field definitions。"""
    result = {}
    tree = ET.parse(xml_path)
    root = tree.getroot()

    for region in root.findall("region"):
        region_id = region.get("name", "")
        if not region_id:
            continue

        density = float(region.get("density", "1.0"))

        fields = []
        fields_elem = region.find("fields")
        if fields_elem is not None:
            for node in fields_elem:
                tag = node.tag
                groupref = node.get("groupref", "")
                if not groupref:
                    groupref = node.get("ref", tag)

                fields.append({
                    "tag": tag,
                    "groupref": groupref,
                    "densityfactor": float(node.get("densityfactor", "1.0")),
                    "noisescale": float(node.get("noisescale", "15000.0")),
                    "seed": node.get("seed", ""),
                    "minnoisevalue": float(node.get("minnoisevalue", "0.0")),
                    "maxnoisevalue": float(node.get("maxnoisevalue", "1.0")),
                })

        result[region_id] = {
            "density": density,
            "fields": fields,
        }

    return result


def update_regions_json(
    regions_json_path: Path,
    region_definitions_xml_path: Path,
) -> int:
    """更新 regions.json，添加 field definitions。

    Returns:
        更新的 region 数量
    """
    # 解析 XML
    field_defs = parse_region_definitions(region_definitions_xml_path)

    # 读取 regions.json
    with regions_json_path.open("r", encoding="utf-8") as f:
        regions = json.load(f)

    # 更新每个 region
    updated = 0
    for region in regions:
        region_id = region.get("id", "")
        if region_id in field_defs:
            defs = field_defs[region_id]
            region["density"] = defs["density"]
            region["fields"] = defs["fields"]
            updated += 1

    # 写回
    with regions_json_path.open("w", encoding="utf-8") as f:
        json.dump(regions, f, indent=2)

    return updated


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Update regions.json with field definitions")
    parser.add_argument(
        "--regions-json",
        type=Path,
        default=Path("src/assets/x4_game_data/8.0-Diplomacy/data/regions.json"),
        help="Path to regions.json",
    )
    parser.add_argument(
        "--region-definitions-xml",
        type=Path,
        default=Path("x4raw_assets/8.0-Diplomacy/libraries/region_definitions/final.xml"),
        help="Path to region_definitions/final.xml",
    )

    args = parser.parse_args()

    updated = update_regions_json(args.regions_json, args.region_definitions_xml)
    print(f"Updated {updated} regions with field definitions")