"""9.0+ 资源处理模块 - X4 Map Data Processor.

提供 9.0+ 版本的资源处理功能，包括：
- definition 解析
- sector resourceareas 解析
- resourceareas.json 组装
- sector.resources 聚合
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import xml.etree.ElementTree as ET

from processor.shared.utils.math_utils import round_to_int


# 正则表达式模式
SECTOR_MACRO_RE = re.compile(r"Cluster_(\d+)_Sector(\d+)_macro", re.IGNORECASE)
GAS_WARES = {"hydrogen", "helium", "methane"}


def _as_float(value, default: float = 0.0) -> float:
    """将值安全转换为 float。"""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_xml(path: Path) -> ET.Element:
    """解析 XML 文件并返回根元素。"""
    tree = ET.parse(str(path))
    return tree.getroot()


def _build_definitions_from_new_regionyields_format(root: ET.Element) -> Dict[str, dict]:
    """从 9.0 新版 XML 结构构建 definition 索引。"""
    boundaries: Dict[str, float] = {}
    for boundary_node in root.findall("./boundaries/boundary[@id]"):
        boundary_id = (boundary_node.get("id") or "").strip()
        size_node = boundary_node.find("./size")
        if not boundary_id or size_node is None:
            continue
        boundaries[boundary_id] = _as_float(size_node.get("r"), 0.0)

    gather_speeds: Dict[str, dict] = {}
    for gather_node in root.findall("./gatherspeeds/gatherspeed[@id]"):
        gather_id = (gather_node.get("id") or "").strip()
        if not gather_id:
            continue
        gather_speeds[gather_id] = {
            "factor": _as_float(gather_node.get("factor"), 0.0),
            "rating": _as_float(gather_node.get("rating"), 0.0),
        }

    definitions: Dict[str, dict] = {}
    for yield_node in root.findall("./yields/yield[@id]"):
        yield_id = (yield_node.get("id") or "").strip()
        yield_tag = (yield_node.get("tag") or yield_id).strip()
        if not yield_id or not yield_tag:
            continue

        scaneffect = (yield_node.get("scaneffect") or "").strip()
        scaneffectintensity = _as_float(yield_node.get("scaneffectintensity"), 0.0)
        scaneffectcolor = (yield_node.get("scaneffectcolor") or "").strip()

        for ware_node in yield_node.findall("./ware[@id]"):
            ware = (ware_node.get("id") or "").strip()
            if not ware:
                continue

            yield_val = _as_float(ware_node.get("yield"), 0.0)
            respawn_delay = _as_float(ware_node.get("respawndelay"), 0.0)
            sustainable_yield_per_hour = 0.0
            if respawn_delay > 0:
                sustainable_yield_per_hour = yield_val / respawn_delay * 60.0

            for boundary_id, radius in boundaries.items():
                if not boundary_id.startswith("sphere_"):
                    continue
                size = boundary_id.split("_", 1)[1].lower()
                for gather_id, gather_data in gather_speeds.items():
                    def_id = f"{boundary_id}_{ware}_{yield_id}_{gather_id}"
                    definition: Dict[str, object] = {
                        "id": def_id,
                        "ware": ware,
                        "tag": yield_tag,
                        "size": size,
                        "radius": radius,
                        "yield": yield_val,
                        "respawnDelay": respawn_delay,
                        "rating": gather_data["rating"],
                        "sustainableYieldPerHour": sustainable_yield_per_hour,
                    }

                    if scaneffect:
                        definition["scaneffect"] = scaneffect
                    if scaneffectintensity > 0:
                        definition["scaneffectintensity"] = scaneffectintensity
                    if scaneffectcolor:
                        definition["scaneffectcolor"] = scaneffectcolor

                    factor = gather_data["factor"]
                    if ware in GAS_WARES:
                        definition["gatherspeedfactor"] = factor
                    else:
                        definition["objectyieldfactor"] = factor

                    definitions[def_id] = definition

    return definitions


# =============================================================================
# Definition 解析
# =============================================================================

def migrate_resourcearea_definitions(regionyields_xml_path: Path) -> Dict[str, dict]:
    """解析 9.0+ 版本的 regionyields_final.xml，提取 definition 节点。

    该版本使用 <definition> 元素定义资源区模板，而非旧版的 <resource><yield> 结构。

    Args:
        regionyields_xml_path: regionyields_final.xml 文件路径

    Returns:
        按 definition id 索引的定义字典
    """
    if not regionyields_xml_path.exists():
        return {}
    root = _parse_xml(regionyields_xml_path)
    synthesized_definitions = _build_definitions_from_new_regionyields_format(root)
    if synthesized_definitions:
        return synthesized_definitions

    definitions: Dict[str, dict] = {}

    for def_node in root.findall("./definitions/definition[@id]"):
        def_id = (def_node.get("id") or "").strip()
        if not def_id:
            continue

        # 基础标识
        ware = (def_node.get("ware") or "").strip()
        tag = (def_node.get("tag") or "").strip()  # verylow/low/medium/high/veryhigh

        # 产能参数
        yield_val = _as_float(def_node.get("yield"), 0.0)
        respawn_delay = _as_float(def_node.get("respawndelay"), 0.0)  # 分钟

        # 展示参数
        rating = _as_float(def_node.get("rating"), 0.0)
        scaneffect = (def_node.get("scaneffect") or "").strip()
        scaneffectintensity = _as_float(def_node.get("scaneffectintensity"), 0.0)
        scaneffectcolor = (def_node.get("scaneffectcolor") or "").strip()

        # 类型系数：矿物用 objectyieldfactor，气体用 gatherspeedfactor
        objectyieldfactor = _as_float(def_node.get("objectyieldfactor"), None)
        gatherspeedfactor = _as_float(def_node.get("gatherspeedfactor"), None)

        # 尺寸参数：从 boundary/size/@r 读取半径
        radius = 0.0
        boundary_node = def_node.find("./boundary[@class='sphere']/size")
        if boundary_node is not None:
            radius = _as_float(boundary_node.get("r"), 0.0)

        # 派生字段：从 id 命名中提取尺寸
        size = ""
        if "_tiny_" in def_id:
            size = "tiny"
        elif "_small_" in def_id:
            size = "small"
        elif "_medium_" in def_id:
            size = "medium"
        elif "_large_" in def_id:
            size = "large"

        # 派生字段：可持续产量/小时 = yield / respawnDelay * 60
        sustainable_yield_per_hour = 0.0
        if respawn_delay > 0:
            sustainable_yield_per_hour = yield_val / respawn_delay * 60.0

        definition: Dict[str, object] = {
            "id": def_id,
            "ware": ware,
            "tag": tag,
            "size": size,
            "radius": radius,
            "yield": yield_val,
            "respawnDelay": respawn_delay,
            "rating": rating,
            "sustainableYieldPerHour": sustainable_yield_per_hour,
        }

        # 可选字段
        if scaneffect:
            definition["scaneffect"] = scaneffect
        if scaneffectintensity > 0:
            definition["scaneffectintensity"] = scaneffectintensity
        if scaneffectcolor:
            definition["scaneffectcolor"] = scaneffectcolor
        if objectyieldfactor is not None:
            definition["objectyieldfactor"] = objectyieldfactor
        if gatherspeedfactor is not None:
            definition["gatherspeedfactor"] = gatherspeedfactor

        definitions[def_id] = definition

    return definitions


def load_regionyield_definitions_from_json(json_path: Path) -> Dict[str, dict]:
    """从 regionyield_definitions.json 加载 definitions（按 id 索引）。

    Args:
        json_path: regionyield_definitions.json 文件路径

    Returns:
        按 definition id 索引的定义字典
    """
    if not json_path.exists():
        return {}
    with json_path.open("r", encoding="utf-8") as f:
        definitions_list = json.load(f)
    return {d.get("id", ""): d for d in definitions_list if d.get("id")}


# =============================================================================
# Sector ResourceAreas 解析
# =============================================================================

def migrate_sector_resourceareas(mapdefaults_xml_path: Path) -> Dict[str, List[dict]]:
    """解析 mapdefaults_final.xml 中各 sector 的 resourceareas 引用。

    Args:
        mapdefaults_xml_path: mapdefaults_final.xml 文件路径

    Returns:
        按 sector macro 索引的资源区引用列表
    """
    if not mapdefaults_xml_path.exists():
        return {}
    root = _parse_xml(mapdefaults_xml_path)
    sector_resource_areas: Dict[str, List[dict]] = {}

    for dataset in root.findall("./dataset[@macro]"):
        macro = (dataset.get("macro") or "").strip().lower()
        if not macro:
            continue
        # 只处理 sector macro
        if not SECTOR_MACRO_RE.fullmatch(macro):
            continue

        resourceareas_node = dataset.find("./properties/resourceareas")
        if resourceareas_node is None:
            continue

        areas: List[dict] = []
        for area_node in resourceareas_node.findall("./resourcearea[@ref]"):
            ref = (area_node.get("ref") or "").strip()
            amount = _as_float(area_node.get("amount"), 0.0)
            if ref:
                areas.append({
                    "ref": ref,
                    "amount": int(amount) if amount > 0 else 1,
                })

        if areas:
            sector_resource_areas[macro] = areas

    return sector_resource_areas


def extract_sector_regions_from_maps_data(maps_data: dict) -> Dict[str, List[dict]]:
    """从 maps.json 数据中提取各 sector 的 regions 引用。

    Args:
        maps_data: maps.json 加载后的字典数据

    Returns:
        按 sector macro（小写）索引的 regions 引用列表
    """
    sector_regions: Dict[str, List[dict]] = {}

    sectors = maps_data.get("sectors", {})
    if isinstance(sectors, dict):
        for sector_macro, sector in sectors.items():
            if not isinstance(sector, dict):
                continue

            regions = sector.get("regions", [])
            if not regions:
                continue

            sector_regions[sector_macro.lower()] = regions
        return sector_regions

    clusters = maps_data.get("clusters", {})
    for cluster_macro, cluster_data in clusters.items():
        if not isinstance(cluster_data, dict):
            continue

        sectors_dict = cluster_data.get("sectors", {})
        for sector_macro, sector in sectors_dict.items():
            if not isinstance(sector, dict):
                continue

            regions = sector.get("regions", [])
            if not regions:
                continue

            sector_macro_lower = sector_macro.lower()
            sector_regions[sector_macro_lower] = regions

    return sector_regions


# =============================================================================
# Sector 资源聚合
# =============================================================================

def build_sector_resource_summaries_from_resourceareas(
    sector_resource_areas: Dict[str, List[dict]],
    definitions: Dict[str, dict],
) -> Dict[str, List[dict]]:
    """从 resourceareas 数据聚合出 sector 级资源摘要。

    输出统一使用 reserve/respawn 字段：
    - reserve: 来自 definition.yield
    - respawn: 来自 yield / respawnDelay * 60

    Args:
        sector_resource_areas: sector 的资源区引用
        definitions: 资源区定义模板

    Returns:
        按 sector macro 索引的资源摘要列表
    """
    from processor.step2_resource.shared import calculate_rating

    summaries: Dict[str, List[dict]] = {}

    for sector_macro, areas in sector_resource_areas.items():
        by_ware: Dict[str, dict] = {}

        for area in areas:
            ref = area.get("ref", "")
            amount = area.get("amount", 1)
            definition = definitions.get(ref, {})

            ware = definition.get("ware", "")
            if not ware:
                continue

            yield_val = _as_float(definition.get("yield"), 0.0)
            respawn_delay = _as_float(definition.get("respawnDelay"), 0.0)

            respawn = 0.0
            if respawn_delay > 0:
                respawn = yield_val * 60.0 / respawn_delay

            # 按 ware 聚合，reserve 和 respawn 需要乘以 amount
            entry = by_ware.setdefault(ware, {
                "ware": ware,
                "reserve": 0.0,
                "respawn": 0.0,
            })
            entry["reserve"] += yield_val * amount
            entry["respawn"] += respawn * amount

        # 转换为兼容格式
        resources: List[dict] = []
        for ware, entry in sorted(by_ware.items()):
            rating = calculate_rating(entry["respawn"], ware)
            resources.append({
                "ware": ware,
                "reserve": round_to_int(entry["reserve"]),
                "respawn": round_to_int(entry["respawn"]),
                "rating": rating,
            })

        summaries[sector_macro] = resources

    return summaries


# =============================================================================
# ResourceAreas JSON 组装
# =============================================================================

def build_resourceareas_json_payload(
    sector_resource_areas: Dict[str, List[dict]],
    definitions: Dict[str, dict],
    cluster_id: str = "",
) -> List[dict]:
    """构建 resourceareas.json 格式的数据。

    从 sector_resource_areas 和 definitions 组装 resourceareas.json 数据结构。

    Args:
        sector_resource_areas: sector 的资源区引用
        definitions: 资源区定义模板
        cluster_id: cluster ID（用于分组）

    Returns:
        resourceareas.json 格式的数据列表
    """
    result: List[dict] = []

    for sector_macro, areas in sorted(sector_resource_areas.items()):
        formatted_areas: List[dict] = []

        for area in areas:
            ref = area.get("ref", "")
            amount = area.get("amount", 1)
            definition = definitions.get(ref, {})

            if not definition:
                continue

            ware = definition.get("ware", "")
            yield_val = _as_float(definition.get("yield"), 0.0)
            respawn_delay = _as_float(definition.get("respawnDelay"), 0.0)
            rating = _as_float(definition.get("rating"), 0.0)
            gatherspeedfactor = definition.get("gatherspeedfactor")
            objectyieldfactor = definition.get("objectyieldfactor")

            respawn = 0.0
            if respawn_delay > 0:
                respawn = yield_val * 60.0 / respawn_delay

            resource_entry = {
                "ware": ware,
                "reserve": round_to_int(yield_val),
                "respawn": round_to_int(respawn),
                "delay": respawn_delay,
                "rating": rating,
            }

            if gatherspeedfactor is not None:
                resource_entry["gatherfactor"] = gatherspeedfactor
            if objectyieldfactor is not None:
                resource_entry["objectyieldfactor"] = objectyieldfactor

            formatted_areas.append({
                "ref": ref,
                "amount": amount,
                "resources": [resource_entry],
            })

        if formatted_areas:
            result.append({
                "cluster_id": cluster_id,
                "sector_id": sector_macro,
                "areas": formatted_areas,
            })

    return result


__all__ = [
    "migrate_resourcearea_definitions",
    "migrate_sector_resourceareas",
    "load_regionyield_definitions_from_json",
    "extract_sector_regions_from_maps_data",
    "build_sector_resource_summaries_from_resourceareas",
    "build_resourceareas_json_payload",
]
