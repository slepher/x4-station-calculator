"""Map XML 转换器 - X4 Map Data Processor.

提供 XML 解析和数据转换函数。
"""

import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from processor.utils.xml_utils import parse_xml, parse_xml_attrs, parse_step_curve, piecewise_average
from processor.utils.data_utils import split_tags, coerce_attr_value
from processor.utils.math_utils import as_float, as_number, rgb_to_hex
from processor.map.calculator import compute_spline_length


def build_boundary(node: Optional[ET.Element]) -> Optional[dict]:
    """
    构建边界对象。

    支持两种 XML 结构：
    1. 直接 <boundary> 节点
    2. <boundaries><boundary .../></boundaries> 容器中的第一个 boundary

    对于 splinetube 类型，在 size 中添加等效 linear 字段（曲线弧长）。
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
            length = compute_spline_length(boundary)
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
    falloff["radial_factor"] = piecewise_average(radial)
    falloff["radial_factor_2"] = piecewise_average(radial, weighted_power=1)
    falloff["effective_factor"] = falloff["lateral_factor"] * falloff["radial_factor"]
    falloff["effective_factor_2"] = falloff["lateral_factor"] * falloff["radial_factor_2"]
    return falloff
