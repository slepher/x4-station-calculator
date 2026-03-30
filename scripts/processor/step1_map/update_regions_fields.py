"""更新 regions.json 添加 field definitions 和 regionobjectgroups yield 数据。

从 region_definitions XML 提取 field 定义，
从 regionobjectgroups XML 提取 yield 数据，
合并到 regions.json。
"""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Any


ALLOWED_TAGS = ("asteroid", "debris", "nebula")


def parse_region_definitions(xml_path: Path) -> Dict[str, Dict[str, Any]]:
    """解析 region_definitions XML，返回 field definitions。

    只处理 asteroid, debris, nebula 三种 tag：
    - asteroid/debris: 提取固定 6 个属性 (tag, groupref, densityfactor, noisescale, seed, minnoisevalue, maxnoisevalue)
    - nebula: 直接提取 XML 元素上的所有实际属性
    """
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
                # 只处理 asteroid, debris, nebula
                if tag not in ALLOWED_TAGS:
                    continue

                if tag in ("asteroid", "debris"):
                    # 固定属性提取
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
                else:  # nebula
                    # 直接提取所有属性
                    field: Dict[str, Any] = {"tag": tag}
                    for attr_name, attr_value in node.attrib.items():
                        if attr_name in ("localred", "localgreen", "localblue",
                                         "uniformred", "uniformgreen", "uniformblue"):
                            field[attr_name] = int(attr_value)
                        elif attr_name in ("localdensity", "uniformdensity"):
                            field[attr_name] = float(attr_value)
                        elif attr_name == "backgroundfog":
                            field[attr_name] = attr_value.lower() == "true"
                        else:
                            field[attr_name] = attr_value
                    fields.append(field)

        result[region_id] = {
            "density": density,
            "fields": fields,
        }

    return result


def parse_regionobjectgroups(xml_path: Path) -> Dict[str, Dict[str, Any]]:
    """解析 regionobjectgroups XML，返回 yield 数据。

    Returns:
        Dict[groupref, {"resource": str, "yield": float, "yieldvariation": float}]
    """
    result = {}
    tree = ET.parse(xml_path)
    root = tree.getroot()

    for group_elem in root.findall(".//group"):
        name = group_elem.get("name", "")
        if not name:
            continue

        resource = group_elem.get("resource", "")
        yield_value = float(group_elem.get("yield", "1.0"))
        yieldvariation = float(group_elem.get("yieldvariation", "0.0"))

        result[name] = {
            "resource": resource,
            "yield": yield_value,
            "yieldvariation": yieldvariation,
        }

    return result


def update_regions_json(
    regions_json_path: Path,
    region_definitions_xml_path: Path,
    regionobjectgroups_xml_path: Optional[Path] = None,
) -> int:
    """更新 regions.json，添加 field definitions 和 yield 数据。

    Args:
        regions_json_path: regions.json 路径
        region_definitions_xml_path: region_definitions XML 路径
        regionobjectgroups_xml_path: regionobjectgroups XML 路径（可选）

    Returns:
        更新的 region 数量
    """
    # 解析 XML
    field_defs = parse_region_definitions(region_definitions_xml_path)

    # 解析 regionobjectgroups（如果提供）
    group_yields = {}
    if regionobjectgroups_xml_path and regionobjectgroups_xml_path.exists():
        group_yields = parse_regionobjectgroups(regionobjectgroups_xml_path)

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

            # 添加 yield 数据到每个 field
            fields = defs["fields"]
            for field in fields:
                groupref = field.get("groupref", "")
                if groupref in group_yields:
                    yield_data = group_yields[groupref]
                    field["resource"] = yield_data["resource"]
                    field["yield"] = yield_data["yield"]
                    field["yieldvariation"] = yield_data["yieldvariation"]

            region["fields"] = fields
            updated += 1

    # 写回
    with regions_json_path.open("w", encoding="utf-8") as f:
        json.dump(regions, f, indent=2)

    return updated


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Update regions.json with field definitions and yield data")
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
    parser.add_argument(
        "--regionobjectgroups-xml",
        type=Path,
        default=Path("x4raw_assets/8.0-Diplomacy/libraries/regionobjectgroups/final.xml"),
        help="Path to regionobjectgroups/final.xml",
    )

    args = parser.parse_args()

    updated = update_regions_json(
        args.regions_json,
        args.region_definitions_xml,
        args.regionobjectgroups_xml,
    )
    print(f"Updated {updated} regions with field definitions and yield data")