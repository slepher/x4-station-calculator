"""Map XML 转换器 - X4 Map Data Processor.

提供 XML 解析和数据转换函数。
"""

import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from processor.utils.xml_utils import parse_xml, parse_xml_attrs, parse_step_curve, piecewise_average
from processor.utils.data_utils import split_tags, coerce_attr_value
from processor.utils.math_utils import as_float, as_number, rgb_to_hex, distance_3d
from processor.map.calculator import compute_spline_length


def load_color_map_from_xml(colors_xml_path: Path) -> Dict[str, str]:
    """从 XML 加载颜色映射。"""
    if not colors_xml_path.exists():
        return {}
    root = parse_xml(colors_xml_path)
    color_map: Dict[str, str] = {}
    for color_node in root.findall(".//colors/color[@id]"):
        color_id = (color_node.get("id") or "").strip()
        if not color_id:
            continue
        r = int(as_float(color_node.get("r"), 0.0))
        g = int(as_float(color_node.get("g"), 0.0))
        b = int(as_float(color_node.get("b"), 0.0))
        color_map[color_id] = rgb_to_hex(r, g, b)
    for mapping_node in root.findall(".//mappings/mapping[@id]"):
        mapping_id = (mapping_node.get("id") or "").strip()
        ref_id = (mapping_node.get("ref") or "").strip()
        if mapping_id and ref_id and ref_id in color_map:
            color_map[mapping_id] = color_map[ref_id]
    return color_map


def migrate_factions(
    factions_xml_path: Path,
    colors_xml_path: Path,
    i18n_registry=None,
) -> Tuple[List[dict], Dict[str, dict]]:
    """迁移派系数据。"""
    if not factions_xml_path.exists():
        return [], {}
    colors_by_name = load_color_map_from_xml(colors_xml_path)
    factions_root = parse_xml(factions_xml_path)
    rows: List[dict] = []
    by_id: Dict[str, dict] = {}
    for node in factions_root.findall("./faction[@id]"):
        faction_id = (node.get("id") or "").strip()
        if not faction_id:
            continue
        name_id = (node.get("name") or "").strip()
        name = i18n_registry.get_name(name_id, "en") if name_id else ""
        tags = split_tags(node.get("tags"))
        color_node = node.find("./color")
        color_name = (color_node.get("ref") if color_node is not None else "") or ""
        color = colors_by_name.get(color_name, "#4b5563")
        item = {
            "id": faction_id,
            "name": name,
            "nameId": name_id,
            "tags": tags,
            "color_name": color_name,
            "color": color,
            "claimspace": "claimspace" in tags,
        }
        rows.append(item)
        by_id[faction_id] = item
    rows.sort(key=lambda item: item["id"])
    return rows, by_id


def build_boundary(node: Optional[ET.Element]) -> Optional[dict]:
    """
    构建边界对象。

    支持两种 XML 结构：
    1. 直接 <boundary> 节点
    2. <boundaries><boundary .../></boundaries> 容器中的第一个 boundary

    对于 splinetube 类型，在 size 中添加等效 linear 字段（控制点距离之和）。
    """
    if node is None:
        return None

    # 检查是否是 boundaries 容器，如果是则取第一个 boundary 子节点
    if node.tag == "boundaries":
        boundary_node = node.find("./boundary[@class]")
        if boundary_node is None:
            return None
        node = boundary_node

    boundary = {
        "class": (node.get("class") or "").strip(),
    }
    size_node = node.find("./size")
    if size_node is not None:
        boundary["size"] = parse_xml_attrs(size_node)
    spline_points = []
    for spline_node in node.findall("./splineposition"):
        spline_points.append(parse_xml_attrs(spline_node))
    if spline_points:
        boundary["spline"] = spline_points
        # 对于 splinetube 类型，计算并存储等效 linear 长度
        if boundary["class"] == "splinetube":
            length = 0.0
            for left, right in zip(spline_points, spline_points[1:]):
                length += distance_3d(left, right)
            if "size" not in boundary:
                boundary["size"] = {}
            boundary["size"]["linear"] = length
    return boundary


def build_falloff(node: Optional[ET.Element]) -> Optional[dict]:
    """构建衰减对象。"""
    if node is None:
        return None
    lateral = parse_step_curve(node.find("./lateral"))
    radial = parse_step_curve(node.find("./radial"))
    falloff = {
        "lateral": lateral,
        "radial": radial,
    }
    falloff["lateral_factor"] = piecewise_average(lateral)
    falloff["radial_factor"] = piecewise_average(radial, weighted_power=1)
    falloff["effective_factor"] = falloff["lateral_factor"] * falloff["radial_factor"]
    return falloff
