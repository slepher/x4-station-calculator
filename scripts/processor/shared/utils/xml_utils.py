"""XML 解析工具 - X4 Map Data Processor."""

import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Optional


def parse_xml(path: Path) -> ET.Element:
    """解析 XML 文件并返回根元素。"""
    tree = ET.parse(str(path))
    return tree.getroot()


def parse_xml_group(map_dir: Path, suffix: str) -> List[ET.Element]:
    """解析 XML 文件组。"""
    import glob
    pattern = str(map_dir / suffix)
    files = sorted(glob.glob(pattern))
    roots: List[ET.Element] = []
    for file in files:
        tree = ET.parse(file)
        roots.append(tree.getroot())
    return roots


def parse_xml_attrs(node: ET.Element) -> Dict[str, object]:
    """解析 XML 节点属性。"""
    return {key: coerce_attr_value(value) for key, value in node.attrib.items()}


def parse_step_curve(node: Optional[ET.Element]) -> List[dict]:
    """解析 step 曲线。"""
    if node is None:
        return []
    steps: List[dict] = []
    for step_node in node.findall("./step"):
        steps.append({
            "position": as_number(coerce_attr_value(step_node.get("position")), 0.0),
            "value": as_number(coerce_attr_value(step_node.get("value")), 0.0),
        })
    steps.sort(key=lambda item: item["position"])
    return steps


def piecewise_average(steps: List[dict], weighted_power: Optional[int] = None) -> float:
    """分段平均值计算。"""
    if not steps:
        return 1.0
    points = sorted(
        [
            {
                "position": min(1.0, max(0.0, float(item.get("position", 0.0)))),
                "value": float(item.get("value", 0.0)),
            }
            for item in steps
        ],
        key=lambda item: item["position"],
    )
    if points[0]["position"] > 0.0:
        points.insert(0, {"position": 0.0, "value": points[0]["value"]})
    if points[-1]["position"] < 1.0:
        points.append({"position": 1.0, "value": points[-1]["value"]})

    total = 0.0
    weight_total = 0.0
    for left, right in zip(points, points[1:]):
        x0 = left["position"]
        x1 = right["position"]
        if x1 <= x0:
            continue
        y0 = left["value"]
        y1 = right["value"]
        mid = (x0 + x1) * 0.5
        ymid = y0 + (y1 - y0) * ((mid - x0) / (x1 - x0))
        if weighted_power is None:
            total += (y0 + y1) * (x1 - x0) * 0.5
            weight_total += (x1 - x0)
        else:
            w0 = x0 ** weighted_power
            wm = mid ** weighted_power
            w1 = x1 ** weighted_power
            total += ((y0 * w0) + (4.0 * ymid * wm) + (y1 * w1)) * (x1 - x0) / 6.0
            weight_total += (w0 + (4.0 * wm) + w1) * (x1 - x0) / 6.0
    if weight_total <= 0:
        return 1.0
    return total / weight_total


def as_number(value, default: float = 0.0) -> float:
    """将值安全转换为 number。"""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        raw = value.strip()
        if raw:
            try:
                return float(raw)
            except ValueError:
                return default
    return default


def coerce_attr_value(value):
    """强制转换属性值。"""
    if value is None:
        return ""
    raw = value.strip()
    if raw == "":
        return ""
    try:
        if any(char in raw for char in (".", "e", "E")):
            return float(raw)
        return int(raw)
    except ValueError:
        return raw