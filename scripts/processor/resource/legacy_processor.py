"""8.0- 传统资源处理模块 - X4 Map Data Processor."""

from pathlib import Path
from typing import Dict, List, Optional, Tuple

import xml.etree.ElementTree as ET

from processor.utils.xml_utils import parse_xml, parse_xml_attrs
from processor.utils.data_utils import coerce_attr_value
from processor.utils.math_utils import as_float, as_number, round_significant, round_to_int, rgb_to_hex, distance_3d
from processor.map.constants import GAS_BLOCK_SIZE
from processor.map.calculator import (
    is_gas_ware,
    calculate_falloff_factors,
    boundary_volume,
    compute_spline_length,
    calculate_gas_block_count_truncated,
    calculate_solid_volume_truncated,
)


def migrate_regionyields(regionyields_xml_path: Path) -> List[dict]:
    """迁移旧版 regionyields。"""
    if not regionyields_xml_path.exists():
        return []
    root = parse_xml(regionyields_xml_path)
    resources: List[dict] = []
    for resource_node in root.findall("./resource[@ware]"):
        ware = (resource_node.get("ware") or "").strip()
        if not ware:
            continue
        effect_r = int(as_float(resource_node.get("effect_r"), 0.0))
        effect_g = int(as_float(resource_node.get("effect_g"), 0.0))
        effect_b = int(as_float(resource_node.get("effect_b"), 0.0))
        resource_item = {
            "ware": ware,
            "color": rgb_to_hex(effect_r, effect_g, effect_b),
            "yields": [],
        }
        for yield_node in resource_node.findall("./yield[@name]"):
            yield_item: Dict[str, object] = {}
            for key, value in yield_node.attrib.items():
                yield_item[key] = coerce_attr_value(value)
            # 添加 density 作为 resourcedensity 的别名（level 标识）
            if "resourcedensity" in yield_item:
                yield_item["density"] = yield_item["resourcedensity"]
            resource_item["yields"].append(yield_item)
        resources.append(resource_item)
    resources.sort(key=lambda item: item["ware"])
    return resources


def build_yield_level_map(regionyields_xml_path: Path) -> Dict[str, Dict[str, int]]:
    levels: Dict[str, Dict[str, int]] = {}
    for resource in migrate_regionyields(regionyields_xml_path):
        ware = (resource.get("ware") or "").strip()
        if not ware:
            continue
        yield_map: Dict[str, int] = {}
        for index, yield_item in enumerate(resource.get("yields", []), start=1):
            name = str(yield_item.get("name") or "").strip()
            if not name:
                continue
            yield_map[name] = index
        levels[ware] = yield_map
    return levels


def build_yield_density_map(regionyields_xml_path: Path) -> Dict[str, Dict[str, float]]:
    """
    构建资源密度映射表（仅 resourcedensity）。
    兼容旧函数，新代码请使用 build_yield_info_map。
    """
    info_map = build_yield_info_map(regionyields_xml_path)
    return {
        ware: {
            yield_name: info["resourcedensity"]
            for yield_name, info in yields.items()
        }
        for ware, yields in info_map.items()
    }


def build_yield_info_map(regionyields_xml_path: Path) -> Dict[str, Dict[str, dict]]:
    """
    构建资源完整信息映射表，包含 resourcedensity、replenishtime、gatherspeedfactor。

    Returns:
        {ware: {yield_name: {resourcedensity, replenishtime, gatherspeedfactor}}}
    """
    info_map: Dict[str, Dict[str, dict]] = {}
    for resource in migrate_regionyields(regionyields_xml_path):
        ware = str(resource.get("ware") or "").strip()
        if not ware:
            continue
        info_map[ware] = {}
        for yield_item in resource.get("yields", []):
            yield_name = str(yield_item.get("name") or "").strip()
            if not yield_name:
                continue
            info_map[ware][yield_name] = {
                "resourcedensity": as_number(yield_item.get("resourcedensity"), 0.0),
                "replenishtime": as_number(yield_item.get("replenishtime"), 0.0),
                "gatherspeedfactor": as_number(yield_item.get("gatherspeedfactor"), 1.0),
            }
    return info_map


def load_region_object_groups(
    regionobjectgroups_xml_path: Path,
) -> Dict[str, dict]:
    """加载区域对象组。"""
    if not regionobjectgroups_xml_path.exists():
        return {}
    root = parse_xml(regionobjectgroups_xml_path)
    groups: Dict[str, dict] = {}
    for group_node in root.findall("./group[@name]"):
        group_name = (group_node.get("name") or "").strip()
        if not group_name:
            continue
        groups[group_name] = {
            "resource": (group_node.get("resource") or "").strip(),
            "yield": as_number(group_node.get("yield"), 0.0),
            "yieldvariation": as_number(group_node.get("yieldvariation"), 0.0),
        }
    return groups


def parse_region_fields(
    region_node: ET.Element,
    group_index: Dict[str, dict],
    resources_map: Optional[Dict[str, dict]] = None,
) -> dict:
    """
    解析 region 的 <fields> 节点，提取 asteroid、debris 和 nebula 字段数据。

    Args:
        region_node: region XML 节点
        group_index: regionobjectgroups 的 group 索引
        resources_map: region 的 <resources> 节点解析结果，ware → {yield_name, ...}

    Returns:
        包含 asteroids、debris、nebulae 列表的字典
    """
    fields_data = {
        "asteroids": [],
        "debris": [],
        "nebulae": [],
    }

    fields_node = region_node.find("./fields")
    if fields_node is None:
        return fields_data

    def parse_field_node(node: ET.Element, node_type: str) -> Optional[dict]:
        """解析单个 field 节点（asteroid 或 debris）"""
        groupref = (node.get("groupref") or "").strip()
        if not groupref or groupref not in group_index:
            return None

        group = group_index[groupref]
        ware = group["resource"]
        densityfactor = as_float(node.get("densityfactor"), 1.0)
        minnoisevalue = as_float(node.get("minnoisevalue"), 0.0)
        maxnoisevalue = as_float(node.get("maxnoisevalue"), 1.0)
        resourcepercentage = as_float(node.get("resourcepercentage"), 100.0) / 100.0

        return {
            "groupref": groupref,
            "resource": ware,
            "yield": group["yield"],
            "densityfactor": densityfactor,
            "minnoisevalue": minnoisevalue,
            "maxnoisevalue": maxnoisevalue,
            "resourcepercentage": resourcepercentage,
        }

    # 解析 asteroid 字段（固体资源）
    for asteroid_node in fields_node.findall("./asteroid[@groupref]"):
        asteroid_data = parse_field_node(asteroid_node, "asteroid")
        if asteroid_data:
            fields_data["asteroids"].append(asteroid_data)

    # 解析 debris 字段（固体资源）
    for debris_node in fields_node.findall("./debris[@groupref]"):
        debris_data = parse_field_node(debris_node, "debris")
        if debris_data:
            fields_data["debris"].append(debris_data)

    # 解析 nebula 字段（气体资源）
    # 只有带 resources="..." 属性的 nebula 才生成资源
    for nebula_node in fields_node.findall("./nebula[@resources]"):
        resources_str = (nebula_node.get("resources") or "").strip()
        if resources_str:
            resources_list = [r.strip() for r in resources_str.split() if r.strip()]
            fields_data["nebulae"].append({
                "resources": resources_list,
            })

    return fields_data


def parse_region_resources_node(
    region_node: ET.Element,
) -> Dict[str, dict]:
    """
    解析 region 的 <resources> 节点，提取 ware → yield_name 映射。

    Args:
        region_node: region XML 节点

    Returns:
        字典，key 为 ware，value 包含 yield_name 等信息
    """
    resources_map: Dict[str, dict] = {}
    resources_node = region_node.find("./resources")
    if resources_node is None:
        return resources_map

    for resource_node in resources_node.findall("./resource[@ware]"):
        ware = (resource_node.get("ware") or "").strip()
        yield_name = (resource_node.get("yield") or "").strip()
        if not ware or not yield_name:
            continue
        resources_map[ware] = {
            "ware": ware,
            "yield": yield_name,
        }

    return resources_map


def build_region_legacy_resource_map(
    region_definitions_xml_path: Path,
    yield_level_map: Dict[str, Dict[str, int]],
    yield_density_map: Dict[str, Dict[str, float]],
) -> Dict[str, Dict[str, dict]]:
    """构建区域旧版资源映射。"""
    if not region_definitions_xml_path.exists():
        return {}
    root = parse_xml(region_definitions_xml_path)
    by_name: Dict[str, Dict[str, dict]] = {}
    for region_node in root.findall("./region[@name]"):
        region_name = (region_node.get("name") or "").strip()
        if not region_name:
            continue
        resources: Dict[str, dict] = {}
        for resource_node in region_node.findall("./resources/resource[@ware]"):
            ware = (resource_node.get("ware") or "").strip()
            yield_name = (resource_node.get("yield") or "").strip()
            if not ware or not yield_name:
                continue
            level = yield_level_map.get(ware, {}).get(yield_name, 1)
            resources[ware] = {
                "ware": ware,
                "yield": yield_name,
                "level": level,
                "resourcedensity": yield_density_map.get(ware, {}).get(yield_name, 0.0),
            }
        by_name[region_name] = resources
    return by_name


def summarize_region_resources(
    region_item: dict,
    fields_data: dict,
    resources_map: Dict[str, dict],
    yield_info_map: Optional[Dict[str, Dict[str, dict]]] = None,
) -> List[dict]:
    """
    总结 region 的资源产出（8.0 版本，使用 fields 解析）。
    """
    region_density = as_number(region_item.get("density"), 1.0)
    falloff_factor = as_number(region_item.get("falloff_factor"), 1.0)
    noise_probability = as_number(region_item.get("noise_probability"), 1.0)
    volume_km3 = as_number(region_item.get("volume_km3"), 0.0)

    F_region = region_density * falloff_factor * noise_probability

    by_ware: Dict[str, dict] = {}

    def process_field_resource(
        ware: str,
        densityfactor: float,
        noise_width: float,
        group_yield: float,
        resourcepercentage: float,
        is_gas: bool = False,
        gatherspeedfactor: float = 1.0,
    ) -> None:
        field_contribution = densityfactor * noise_width * group_yield * resourcepercentage

        if not ware or not ware.strip():
            return

        ware = ware.strip()

        if not resources_map:
            return

        if ware not in resources_map:
            return

        yield_name = resources_map[ware].get("yield")

        resourcedensity: float = 0.0
        replenishtime: float = 60.0
        actual_gatherspeedfactor: float = gatherspeedfactor

        if not yield_info_map or ware not in yield_info_map:
            return

        if not yield_name or yield_name not in yield_info_map[ware]:
            return

        resourcedensity = yield_info_map[ware][yield_name].get("resourcedensity", 0.0)
        replenishtime = yield_info_map[ware][yield_name].get("replenishtime", 60.0)
        if is_gas:
            actual_gatherspeedfactor = yield_info_map[ware][yield_name].get("gatherspeedfactor", 1.0)

        if resourcedensity <= 0:
            return

        if is_gas:
            density = resourcedensity * F_region
        else:
            density = resourcedensity * F_region * field_contribution

        respawn_density = density * 60.0 / replenishtime if replenishtime > 0 else 0.0
        yield_total = density * volume_km3
        respawn_total = respawn_density * volume_km3

        item = by_ware.setdefault(ware, {
            "ware": ware,
            "density": 0.0,
            "respawn_density": 0.0,
            "yield": 0.0,
            "respawn": 0.0,
            "replenishtime": replenishtime,
            "is_gas": is_gas,
            "gatherspeedfactor": actual_gatherspeedfactor,
            "yield_name": yield_name,
            "resourcedensity": resourcedensity,
        })

        item["density"] += density
        item["respawn_density"] += respawn_density
        item["yield"] += yield_total
        item["respawn"] += respawn_total
        item["replenishtime"] = replenishtime
        item["gatherspeedfactor"] = actual_gatherspeedfactor
        item["yield_name"] = yield_name
        item["resourcedensity"] = resourcedensity

    for asteroid in fields_data.get("asteroids", []):
        ware = asteroid["resource"]
        densityfactor = asteroid["densityfactor"]
        minnoisevalue = asteroid["minnoisevalue"]
        maxnoisevalue = asteroid["maxnoisevalue"]
        noise_width = max(0.0, maxnoisevalue - minnoisevalue)
        group_yield = asteroid["yield"]
        resourcepercentage = asteroid["resourcepercentage"]

        process_field_resource(
            ware=ware,
            densityfactor=densityfactor,
            noise_width=noise_width,
            group_yield=group_yield,
            resourcepercentage=resourcepercentage,
            is_gas=False,
        )

    for debris in fields_data.get("debris", []):
        ware = debris["resource"]
        densityfactor = debris["densityfactor"]
        minnoisevalue = debris["minnoisevalue"]
        maxnoisevalue = debris["maxnoisevalue"]
        noise_width = max(0.0, maxnoisevalue - minnoisevalue)
        group_yield = debris["yield"]
        resourcepercentage = debris["resourcepercentage"]

        process_field_resource(
            ware=ware,
            densityfactor=densityfactor,
            noise_width=noise_width,
            group_yield=group_yield,
            resourcepercentage=resourcepercentage,
            is_gas=False,
        )

    for nebula in fields_data.get("nebulae", []):
        resources_list = nebula.get("resources", [])
        for ware in resources_list:
            process_field_resource(
                ware=ware,
                densityfactor=1.0,
                noise_width=1.0,
                group_yield=1.0,
                resourcepercentage=1.0,
                is_gas=True,
            )

    resources: List[dict] = []
    for ware, item in sorted(by_ware.items(), key=lambda x: x[0]):
        replenishtime = item["replenishtime"]
        delay = replenishtime if replenishtime > 0 else 60.0
        factor = item.get("gatherspeedfactor", 1.0) if item.get("is_gas") else 1.0

        resource_item = {
            "ware": ware,
            "yield": round_to_int(item["yield"]),
            "delay": delay,
            "respawn": round_to_int(item["respawn"]),
            "density": round_significant(item["density"]),
            "respawn_density": round_significant(item["respawn_density"]),
            "factor": factor,
            "yield_name": item.get("yield_name"),
            "resourcedensity": item.get("resourcedensity", 0.0),
        }
        resources.append(resource_item)

    return resources


def summarize_region_resources_only(
    region_item: dict,
    resources_map: Dict[str, dict],
    yield_info_map: Optional[Dict[str, Dict[str, dict]]] = None,
) -> List[dict]:
    """
    总结 region 的资源产出（仅使用 <resources> 节点，不使用 field 数据）。
    """
    region_density = as_number(region_item.get("density"), 1.0)
    falloff_factor = as_number(region_item.get("falloff_factor"), 1.0)
    noise_probability = as_number(region_item.get("noise_probability"), 1.0)
    volume_km3 = as_number(region_item.get("volume_km3"), 0.0)

    F_region = region_density * falloff_factor * noise_probability

    by_ware: Dict[str, dict] = {}

    for ware, res_info in resources_map.items():
        yield_name = res_info.get("yield")

        resourcedensity: float = 0.0
        replenishtime: float = 60.0
        if yield_info_map and ware in yield_info_map:
            if yield_name and yield_name in yield_info_map[ware]:
                resourcedensity = yield_info_map[ware][yield_name].get("resourcedensity", 0.0)
                replenishtime = yield_info_map[ware][yield_name].get("replenishtime", 60.0)
            else:
                yield_entries = list(yield_info_map[ware].values())
                if yield_entries:
                    resourcedensity = yield_entries[0].get("resourcedensity", 0.0)
                    replenishtime = yield_entries[0].get("replenishtime", 60.0)

        if resourcedensity <= 0:
            continue

        density = resourcedensity * F_region
        respawn_density = density * 60.0 / replenishtime if replenishtime > 0 else 0.0
        yield_total = density * volume_km3
        respawn_total = respawn_density * volume_km3

        is_gas = is_gas_ware(ware)
        gatherspeedfactor = 1.0
        if is_gas and yield_info_map and ware in yield_info_map:
            if yield_name and yield_name in yield_info_map[ware]:
                gatherspeedfactor = yield_info_map[ware][yield_name].get("gatherspeedfactor", 1.0)

        item = {
            "ware": ware,
            "density": density,
            "respawn_density": respawn_density,
            "yield": yield_total,
            "respawn": respawn_total,
            "replenishtime": replenishtime,
            "is_gas": is_gas,
            "gatherspeedfactor": gatherspeedfactor,
            "yield_name": yield_name,
            "resourcedensity": resourcedensity,
        }
        by_ware[ware] = item

    resources: List[dict] = []
    for ware, item in sorted(by_ware.items(), key=lambda x: x[0]):
        replenishtime = item["replenishtime"]
        delay = replenishtime if replenishtime > 0 else 60.0
        factor = item.get("gatherspeedfactor", 1.0) if item.get("is_gas") else 1.0

        resource_item = {
            "ware": ware,
            "yield": round_to_int(item["yield"]),
            "delay": delay,
            "respawn": round_to_int(item["respawn"]),
            "density": round_significant(item["density"]),
            "respawn_density": round_significant(item["respawn_density"]),
            "factor": factor,
            "yield_name": item.get("yield_name"),
            "resourcedensity": item.get("resourcedensity", 0.0),
        }
        resources.append(resource_item)

    return resources


def summarize_region_fields_only(
    region_item: dict,
    fields_data: dict,
    yield_info_map: Optional[Dict[str, Dict[str, dict]]] = None,
) -> List[dict]:
    """
    总结 region 的资源产出（仅使用 <fields> 节点数据，使用 densityfactor）。
    """
    region_density = as_number(region_item.get("density"), 1.0)
    falloff_factor = as_number(region_item.get("falloff_factor"), 1.0)
    noise_probability = as_number(region_item.get("noise_probability"), 1.0)
    volume_km3 = as_number(region_item.get("volume_km3"), 0.0)

    F_region = region_density * falloff_factor * noise_probability

    by_ware: Dict[str, dict] = {}

    def process_field_resource(
        ware: str,
        densityfactor: float,
        noise_width: float,
        group_yield: float,
        resourcepercentage: float,
        is_gas: bool = False,
        gatherspeedfactor: float = 1.0,
    ) -> None:
        field_contribution = noise_width * group_yield * resourcepercentage

        resourcedensity: float = 0.0
        replenishtime: float = 60.0
        actual_gatherspeedfactor: float = gatherspeedfactor

        if yield_info_map and ware in yield_info_map:
            yield_entries = list(yield_info_map[ware].values())
            if yield_entries:
                resourcedensity = yield_entries[0].get("resourcedensity", 0.0)
                replenishtime = yield_entries[0].get("replenishtime", 60.0)
                if is_gas:
                    actual_gatherspeedfactor = yield_entries[0].get("gatherspeedfactor", 1.0)

        if resourcedensity <= 0:
            return

        if is_gas:
            density = (densityfactor / 100) * F_region
        else:
            density = (densityfactor / 100) * F_region * field_contribution

        respawn_density = density * 60.0 / replenishtime if replenishtime > 0 else 0.0
        yield_total = density * volume_km3
        respawn_total = respawn_density * volume_km3

        item = by_ware.setdefault(ware, {
            "ware": ware,
            "density": 0.0,
            "respawn_density": 0.0,
            "yield": 0.0,
            "respawn": 0.0,
            "replenishtime": replenishtime,
            "is_gas": is_gas,
            "gatherspeedfactor": actual_gatherspeedfactor,
        })

        item["density"] += density
        item["respawn_density"] += respawn_density
        item["yield"] += yield_total
        item["respawn"] += respawn_total
        item["replenishtime"] = replenishtime
        item["gatherspeedfactor"] = actual_gatherspeedfactor

    for asteroid in fields_data.get("asteroids", []):
        ware = asteroid["resource"]
        densityfactor = asteroid["densityfactor"]
        minnoisevalue = asteroid["minnoisevalue"]
        maxnoisevalue = asteroid["maxnoisevalue"]
        noise_width = max(0.0, maxnoisevalue - minnoisevalue)
        group_yield = asteroid["yield"]
        resourcepercentage = asteroid["resourcepercentage"]

        process_field_resource(
            ware=ware,
            densityfactor=densityfactor,
            noise_width=noise_width,
            group_yield=group_yield,
            resourcepercentage=resourcepercentage,
            is_gas=False,
        )

    for debris in fields_data.get("debris", []):
        ware = debris["resource"]
        densityfactor = debris["densityfactor"]
        minnoisevalue = debris["minnoisevalue"]
        maxnoisevalue = debris["maxnoisevalue"]
        noise_width = max(0.0, maxnoisevalue - minnoisevalue)
        group_yield = debris["yield"]
        resourcepercentage = debris["resourcepercentage"]

        process_field_resource(
            ware=ware,
            densityfactor=densityfactor,
            noise_width=noise_width,
            group_yield=group_yield,
            resourcepercentage=resourcepercentage,
            is_gas=False,
        )

    for nebula in fields_data.get("nebulae", []):
        resources_list = nebula.get("resources", [])
        for ware in resources_list:
            process_field_resource(
                ware=ware,
                densityfactor=1.0,
                noise_width=1.0,
                group_yield=1.0,
                resourcepercentage=1.0,
                is_gas=True,
            )

    resources: List[dict] = []
    for ware, item in sorted(by_ware.items(), key=lambda x: x[0]):
        replenishtime = item["replenishtime"]
        delay = replenishtime if replenishtime > 0 else 60.0
        factor = item.get("gatherspeedfactor", 1.0) if item.get("is_gas") else 1.0

        resource_item = {
            "ware": ware,
            "yield": round_to_int(item["yield"]),
            "delay": delay,
            "respawn": round_to_int(item["respawn"]),
            "density": round_significant(item["density"]),
            "respawn_density": round_significant(item["respawn_density"]),
            "factor": factor,
        }
        resources.append(resource_item)

    return resources


def migrate_region_definitions(
    region_definitions_xml_path: Path,
    regionobjectgroups_xml_path: Path,
    yield_level_map: Dict[str, Dict[str, int]],
    yield_density_map: Dict[str, Dict[str, float]],
    yield_info_map: Optional[Dict[str, Dict[str, dict]]] = None,
    region_position_map: Optional[Dict[str, Dict[str, float]]] = None,
) -> Tuple[Dict[str, dict], Dict[str, dict]]:
    """
    迁移 region 定义。
    """
    from processor.map.writer import build_boundary, build_falloff, boundary_volume, compute_spline_length

    if not region_definitions_xml_path.exists():
        return {}, {}
    root = parse_xml(region_definitions_xml_path)
    group_index = load_region_object_groups(regionobjectgroups_xml_path)
    templates: Dict[str, dict] = {}
    calc_data: Dict[str, dict] = {}

    for region_node in root.findall("./region[@name]"):
        region_name = (region_node.get("name") or "").strip()
        if not region_name:
            continue
        boundary_node = region_node.find("./boundary")
        if boundary_node is None:
            boundary_node = region_node.find("./boundaries")
        falloff_node = region_node.find("./falloff")

        region_item = {
            "id": region_name,
            "boundary": build_boundary(boundary_node),
            "falloff": build_falloff(falloff_node),
        }

        boundary = region_item["boundary"]
        falloff = region_item["falloff"] or {}

        volume_m3 = boundary_volume(boundary)
        volume_km3 = volume_m3 / 1_000_000_000.0

        spline_linear = compute_spline_length(boundary)
        if spline_linear > 0:
            region_item["linear"] = spline_linear

        region_item["volume_km3"] = round_to_int(volume_km3)
        region_item["falloff_factor"] = round(as_number(falloff.get("effective_factor"), 1.0), 4)

        resources_map = parse_region_resources_node(region_node)
        fields_data = parse_region_fields(region_node, group_index, resources_map)

        region_template = {
            "id": region_name,
            "boundary": region_item["boundary"],
            "falloff": region_item["falloff"],
            "volume_km3": region_item["volume_km3"],
            "resources": [],
        }
        if "linear" in region_item:
            region_template["linear"] = region_item["linear"]

        for ware, res_info in resources_map.items():
            yield_name = res_info.get("yield")

            resourcedensity: float = 0.0
            replenishtime: float = 60.0
            gatherfactor: float = 1.0

            if yield_info_map and ware in yield_info_map:
                if yield_name and yield_name in yield_info_map[ware]:
                    resourcedensity = yield_info_map[ware][yield_name].get("resourcedensity", 0.0)
                    replenishtime = yield_info_map[ware][yield_name].get("replenishtime", 60.0)
                    gatherfactor = yield_info_map[ware][yield_name].get("gatherspeedfactor", 1.0)
                else:
                    yield_entries = list(yield_info_map[ware].values())
                    if yield_entries:
                        resourcedensity = yield_entries[0].get("resourcedensity", 0.0)
                        replenishtime = yield_entries[0].get("replenishtime", 60.0)
                        gatherfactor = yield_entries[0].get("gatherspeedfactor", 1.0)

            if resourcedensity > 0:
                region_template["resources"].append({
                    "ware": ware,
                    "resourcedensity": resourcedensity,
                    "delay": replenishtime,
                    "gatherfactor": gatherfactor if is_gas_ware(ware) else 1.0,
                    "yield_name": yield_name,
                })

        if region_template["resources"]:
            templates[region_name] = region_template

        region_item["asteroids"] = fields_data.get("asteroids", [])
        region_item["debris"] = fields_data.get("debris", [])
        region_item["nebulae"] = fields_data.get("nebulae", [])

        calc_data[region_name] = region_item

    return templates, calc_data


def summarize_region_resources_simplified(
    region_item: dict,
    resources_map: Dict[str, dict],
    yield_info_map: Optional[Dict[str, Dict[str, dict]]] = None,
    region_pos: Optional[Dict[str, float]] = None,
) -> List[dict]:
    """
    简化版资源计算（8.0 新算法）

    公式：yield = base × falloff × resourcedensity
    """
    boundary = region_item.get("boundary", {})
    falloff = region_item.get("falloff")
    volume_km3 = as_number(region_item.get("volume_km3"), 0.0)

    if not resources_map:
        return []

    lateral_f, radial_f, total_falloff = calculate_falloff_factors(falloff)

    results = []

    for ware, res_info in resources_map.items():
        yield_name = res_info.get("yield")

        resourcedensity = as_number(res_info.get("resourcedensity"), 0.0)
        replenishtime = as_number(res_info.get("replenishtime"), 60.0)
        gatherfactor = as_number(res_info.get("gatherfactor"), 1.0)

        if resourcedensity <= 0 and yield_info_map:
            if ware in yield_info_map:
                if yield_name and yield_name in yield_info_map[ware]:
                    resourcedensity = as_number(
                        yield_info_map[ware][yield_name].get("resourcedensity"), 0.0
                    )
                    replenishtime = as_number(
                        yield_info_map[ware][yield_name].get("replenishtime"), 60.0
                    )
                    gatherfactor = as_number(
                        yield_info_map[ware][yield_name].get("gatherspeedfactor"), 1.0
                    )

        if resourcedensity <= 0:
            continue

        if is_gas_ware(ware):
            total_blocks, effective_blocks = calculate_gas_block_count_truncated(
                region_pos or {"x": 0.0, "y": 0.0, "z": 0.0},
                boundary
            )

            total_yield = total_blocks * total_falloff * resourcedensity
            effective_yield = effective_blocks * total_falloff * resourcedensity

            total_respawn = total_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0
            effective_respawn = effective_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0

            results.append({
                "ware": ware,
                "resourcedensity": resourcedensity,
                "total_yield": round_to_int(total_yield),
                "total_respawn": round_to_int(total_respawn),
                "yield": round_to_int(effective_yield),
                "respawn": round_to_int(effective_respawn),
                "delay": replenishtime,
                "factor": 1.0,
            })
        else:
            total_vol, effective_vol = calculate_solid_volume_truncated(boundary)

            total_vol_km3 = total_vol / 1_000_000_000.0
            effective_vol_km3 = effective_vol / 1_000_000_000.0

            total_yield = total_vol_km3 * total_falloff * resourcedensity
            effective_yield = effective_vol_km3 * total_falloff * resourcedensity

            total_respawn = total_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0
            effective_respawn = effective_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0

            results.append({
                "ware": ware,
                "resourcedensity": resourcedensity,
                "total_yield": round_to_int(total_yield),
                "total_respawn": round_to_int(total_respawn),
                "yield": round_to_int(effective_yield),
                "respawn": round_to_int(effective_respawn),
                "delay": replenishtime,
                "factor": 1.0,
            })

    return results


def calculate_resourcearea_resources(
    region_calc: dict,
    region_pos: Optional[Dict[str, float]],
    template_resources: List[dict],
) -> List[dict]:
    """
    计算 resourcearea 级别的资源数据（实例计算）

    基于 region 计算数据（boundary, falloff）和 position，计算每个资源的产量。

    公式：yield = base × falloff × resourcedensity

    Args:
        region_calc: region 计算数据（含 boundary, falloff）
        region_pos: region 相对 sector 的坐标（用于气体计算和截断）
        template_resources: 模板资源列表（含 ware, resourcedensity, delay, gatherfactor, yield_name）

    Returns:
        资源列表，包含 total_yield/total_respawn/yield/respawn/density/respawn_density 字段
    """
    boundary = region_calc.get("boundary", {})
    falloff = region_calc.get("falloff")

    if not template_resources:
        return []

    # 计算 falloff
    lateral_f, radial_f, total_falloff = calculate_falloff_factors(falloff)

    results = []

    for template_res in template_resources:
        ware = template_res.get("ware", "")
        if not ware:
            continue

        resourcedensity = as_number(template_res.get("resourcedensity"), 0.0)
        replenishtime = as_number(template_res.get("delay"), 60.0)
        gatherfactor = as_number(template_res.get("gatherfactor"), 1.0)

        if resourcedensity <= 0:
            continue

        if is_gas_ware(ware):
            # 气体资源：使用方块网格算法
            total_blocks, effective_blocks = calculate_gas_block_count_truncated(
                region_pos or {"x": 0.0, "y": 0.0, "z": 0.0},
                boundary
            )

            # yield = blocks × falloff × resourcedensity
            total_yield = total_blocks * total_falloff * resourcedensity
            effective_yield = effective_blocks * total_falloff * resourcedensity

            # respawn = yield × 60 / replenishtime
            total_respawn = total_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0
            effective_respawn = effective_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0

            # density = yield / volume (单位体积产量)
            # 气体的体积按有效方块数 × 64km³ 计算
            effective_vol_km3 = effective_blocks * (GAS_BLOCK_SIZE ** 3) / 1_000_000_000.0
            density = effective_yield / effective_vol_km3 if effective_vol_km3 > 0 else 0.0
            respawn_density = effective_respawn / effective_vol_km3 if effective_vol_km3 > 0 else 0.0

            results.append({
                "ware": ware,
                "resourcedensity": resourcedensity,
                "total_yield": round_to_int(total_yield),
                "total_respawn": int(round(total_respawn)),
                "yield": round_to_int(effective_yield),
                "respawn": int(round(effective_respawn)),
                "delay": replenishtime,
                "gatherfactor": gatherfactor,
                "density": round_significant(density),
                "respawn_density": round_significant(respawn_density),
            })
        else:
            # 固体资源：使用体积算法
            total_vol, effective_vol = calculate_solid_volume_truncated(boundary)

            # 转换为 km³
            total_vol_km3 = total_vol / 1_000_000_000.0
            effective_vol_km3 = effective_vol / 1_000_000_000.0

            # yield = volume × falloff × resourcedensity
            total_yield = total_vol_km3 * total_falloff * resourcedensity
            effective_yield = effective_vol_km3 * total_falloff * resourcedensity

            # respawn = yield × 60 / replenishtime
            total_respawn = total_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0
            effective_respawn = effective_yield * 60.0 / replenishtime if replenishtime > 0 else 0.0

            # density = yield / volume (单位体积产量)
            density = effective_yield / effective_vol_km3 if effective_vol_km3 > 0 else 0.0
            respawn_density = effective_respawn / effective_vol_km3 if effective_vol_km3 > 0 else 0.0

            results.append({
                "ware": ware,
                "resourcedensity": resourcedensity,
                "total_yield": round_to_int(total_yield),
                "total_respawn": int(round(total_respawn)),
                "yield": round_to_int(effective_yield),
                "respawn": int(round(effective_respawn)),
                "delay": replenishtime,
                "gatherfactor": gatherfactor,
                "density": round_significant(density),
                "respawn_density": round_significant(respawn_density),
            })

    return results
