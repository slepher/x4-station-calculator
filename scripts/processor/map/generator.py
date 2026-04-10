"""Map 数据生成器 - X4 Map Data Processor."""

import math
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import xml.etree.ElementTree as ET

from processor.path_utils import get_map_xml_path
from processor.utils.math_utils import (
    as_float,
    compact_number,
    pos_from,
    pos3d_from,
    quaternion_from,
    vec_add,
    cluster_world_to_axial,
    axial_to_pixel_flat,
)
from processor.sector.parser import (
    load_mapdefaults,
    resolve_sector_macro_from_region_connection,
    resolve_sector_macro_from_region_ref,
    zone_connection_path_to_zone_macro,
)
from processor.sector.template import (
    centered_local_positions,
    template_positions_ratio,
    sector_radius_ratio,
    choose_sector_template,
)
from processor.resource.modern_processor import (
    migrate_resourcearea_definitions,
    migrate_sector_resourceareas,
    build_resourceareas_json_payload,
)
from processor.resource.legacy_processor import (
    migrate_region_definitions,
    build_yield_level_map,
    build_yield_density_map,
    build_yield_info_map,
    calculate_resourcearea_resources,
)
from processor.sector.resource_summary import summarize_sector_resources
from processor.map.converter import build_boundary, build_falloff
from processor.map.calculator import (
    boundary_volume,
    compute_spline_length,
    calculate_solid_volume_truncated,
    calculate_gas_block_count_truncated,
    is_gas_ware,
)
from processor.utils.data_utils import split_tags, coerce_attr_value, as_number
from processor.utils.math_utils import round_to_int
from processor.utils.xml_utils import parse_xml, parse_xml_attrs, parse_step_curve, piecewise_average
from processor.dlc_tag import build_direct_entity_dlc_tag_map


OWNER_COLORS = {
    "teladi": "#c6c000",
    "argon": "#0077cc",
    "antigone": "#00e5ff",
    "boron": "#63b3ff",
    "terran": "#2f7fd3",
    "pioneers": "#7ec8ff",
    "split": "#c00000",
    "freesplit": "#b26b00",
    "holyorder": "#b000b8",
    "paranid": "#d100d1",
    "hatikvah": "#7a4ea3",
    "kaori": "#8a6ad9",
    "loanshark": "#c58f00",
    "riptide": "#c58f00",
    "xenon": "#9a0000",
    "neutral": "#4b5563",
    "ownerless": "#4b5563",
    "scaleplate": "#4b5563",
    "scavenger": "#4b5563",
}

# 正则表达式模式
CLUSTER_MACRO_RE = re.compile(r"Cluster_(\d+)_macro", re.IGNORECASE)
SECTOR_MACRO_RE = re.compile(r"Cluster_(\d+)_Sector(\d+)_macro", re.IGNORECASE)
ZONE_MACRO_RE = re.compile(r"Zone\d+_Cluster_(\d+)_Sector(\d+)_macro", re.IGNORECASE)
SHCON_ZONE_RE = re.compile(r"tzoneCluster_(\d+)_Sector(\d+)SHCon(\d+)_GateZone_macro", re.IGNORECASE)
CLUSTER_GATE_RE = re.compile(r"connection_ClusterGate(\d+)To(\d+)[a-z]?", re.IGNORECASE)


def station_type_priority(station_type: str) -> int:
    """Station type priority."""
    priority_map = {
        "shipyard": 10,
        "equipmentdock": 9,
        "refinery": 8,
        "factory": 7,
        "tradingstation": 6,
        "miningstation": 5,
        "researchstation": 4,
        "militaryoutpost": 3,
        "piratebase": 2,
    }
    return priority_map.get(station_type, 0)


def station_tag_priority(tags: List[str]) -> int:
    """Station tag priority."""
    priority_tags = {"shipyard", "equipmentdock", "refinery", "factory"}
    return sum(1 for tag in tags if tag in priority_tags)


def generate_map_data(
    map_dir: Path,
    mapdefaults_path: Path,
    god_xml_path: Optional[Path] = None,
    factions_by_id: Optional[Dict[str, dict]] = None,
    region_definitions_xml_path: Optional[Path] = None,
    regionobjectgroups_xml_path: Optional[Path] = None,
    regionyields_xml_path: Optional[Path] = None,
    i18n_registry=None,
    resource_model: str = "regions",
    dlc_order: Optional[List[str]] = None,
    sector_resource_areas: Optional[Dict[str, List[dict]]] = None,
    definitions: Optional[Dict[str, dict]] = None,
) -> Dict[str, object]:
    """
    生成地图数据。

    这是核心处理函数，负责：
    1. 解析 galaxy.xml, clusters.xml, sectors.xml, zones.xml
    2. 构建 clusters, sectors, zones 层次结构
    3. 处理资源数据（根据 resource_model 选择不同逻辑）
    4. 生成输出 payload

    Args:
        map_dir: 地图 XML 文件目录
        mapdefaults_path: mapdefaults_final.xml 路径
        god_xml_path: god_final.xml 路径（可选）
        factions_by_id: 派系数据字典
        region_definitions_xml_path: region_definitions_final.xml 路径
        regionobjectgroups_xml_path: regionobjectgroups_final.xml 路径
        regionyields_xml_path: regionyields_final.xml 路径
        i18n_registry: 国际化注册表
        resource_model: 资源模型类型 ("regions" 或 "resourceareas")
        sector_resource_areas: sector 资源区引用（9.0+）
        definitions: 资源区定义模板（9.0+）

    Returns:
        包含 payload, regions, resourceareas, name_ids, missing_name_ids, stats 的字典
    """
    from collections import defaultdict
    from processor.i18n import get_i18n_registry

    name_id_by_macro, area_by_sector_macro, area_by_cluster_macro = load_mapdefaults(mapdefaults_path)
    registry = i18n_registry or get_i18n_registry()
    if i18n_registry is None:
        registry.configure("", {
            "044": {"iso": "en", "name": "English"},
        })
    registry.collect_many(set(name_id_by_macro.values()))
    cluster_dlc_tags = build_direct_entity_dlc_tag_map(
        map_dir / "clusters",
        dlc_order or [],
        lambda node: node.get("name") if node.tag == "macro" and node.get("class") == "cluster" else None,
    )

    galaxy_root = parse_xml(get_map_xml_path(str(map_dir), "galaxy"))
    clusters_root = parse_xml(get_map_xml_path(str(map_dir), "clusters"))
    sectors_root = parse_xml(get_map_xml_path(str(map_dir), "sectors"))
    zones_root = parse_xml(get_map_xml_path(str(map_dir), "zones"))
    zonehighways_root = parse_xml(get_map_xml_path(str(map_dir), "zonehighways"))
    sechighways_root = parse_xml(get_map_xml_path(str(map_dir), "sechighways"))

    clusters: Dict[str, dict] = {}
    sectors: Dict[str, dict] = {}
    zones: Dict[str, dict] = {}
    cluster_links: Dict[str, dict] = {}
    sector_links: Dict[str, dict] = {}
    sector_highways: Dict[str, dict] = {}
    sector_region_links: Dict[str, List[dict]] = defaultdict(list)

    for macro in galaxy_root.findall("./macro"):
        if macro.get("class") != "galaxy":
            continue
        for conn in macro.findall("./connections/connection[@ref='clusters']"):
            macro_node = conn.find("./macro")
            cluster_macro = macro_node.get("ref") if macro_node is not None else None
            if not cluster_macro:
                continue
            raw_pos = pos_from(conn)
            axial = cluster_world_to_axial(raw_pos)
            clusters[cluster_macro] = {
                "id": cluster_macro,
                "nameId": name_id_by_macro.get(cluster_macro.lower(), ""),
                "name": registry.get_name(name_id_by_macro.get(cluster_macro.lower(), ""), "en"),
                "dlc_tag": cluster_dlc_tags.get(cluster_macro, "base"),
                "owner": "neutral",
                "owner_color": OWNER_COLORS.get("neutral", "#94a3b8"),
                "raw_pos": raw_pos,
                "normalized": {
                    "axial": axial,
                    "pixel_basis": axial_to_pixel_flat(axial["q"], axial["r"], 1.0),
                },
                "sector_ids": [],
                "sector_link_ids": [],
            }

    sechighway_geometry: Dict[str, dict] = {}
    for macro in sechighways_root.findall("./macro[@class='highway']"):
        highway_id = macro.get("name")
        if not highway_id:
            continue
        entry = pos_from(macro.find("./connections/connection[@ref='entrypoint']"))
        exitp = pos_from(macro.find("./connections/connection[@ref='exitpoint']"))
        spline = []
        for spline_node in macro.findall("./properties/boundaries/boundary[@class='splinetube']/splineposition"):
            spline.append({
                "x": as_float(spline_node.get("x")),
                "z": as_float(spline_node.get("z")),
                "tx": as_float(spline_node.get("tx")),
                "tz": as_float(spline_node.get("tz")),
            })
        sechighway_geometry[highway_id] = {
            "entry_pos": entry,
            "exit_pos": exitp,
            "spline": spline,
        }
    zonehighway_geometry: Dict[str, dict] = {}
    for macro in zonehighways_root.findall("./macro[@class='highway']"):
            highway_id = macro.get("name")
            if not highway_id:
                continue
            entry = pos_from(macro.find("./connections/connection[@ref='entrypoint']"))
            exitp = pos_from(macro.find("./connections/connection[@ref='exitpoint']"))
            spline = []
            for spline_node in macro.findall("./properties/boundaries/boundary[@class='splinetube']/splineposition"):
                spline.append({
                    "x": as_float(spline_node.get("x")),
                    "z": as_float(spline_node.get("z")),
                    "tx": as_float(spline_node.get("tx")),
                    "tz": as_float(spline_node.get("tz")),
                })
            size_node = macro.find("./properties/boundaries/boundary[@class='splinetube']/size")
            radius = as_float(size_node.get("r")) if size_node is not None else 0.0
            zonehighway_geometry[highway_id] = {
                "entry_pos": entry,
                "exit_pos": exitp,
                "spline": spline,
                "radius": radius,
            }

    cluster_sector_offsets: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(dict)
    zone_offsets_by_sector: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(dict)
    for cluster_macro_node in clusters_root.findall("./macro[@class='cluster']"):
        cluster_macro = cluster_macro_node.get("name")
        if not cluster_macro:
            continue
        if cluster_macro not in clusters:
            raw_pos = {"x": 0.0, "z": 0.0}
            axial = cluster_world_to_axial(raw_pos)
            clusters[cluster_macro] = {
                "id": cluster_macro,
                "nameId": name_id_by_macro.get(cluster_macro.lower(), ""),
                "name": registry.get_name(name_id_by_macro.get(cluster_macro.lower(), ""), "en"),
                "dlc_tag": cluster_dlc_tags.get(cluster_macro, "base"),
                "owner": "neutral",
                "owner_color": OWNER_COLORS.get("neutral", "#94a3b8"),
                "raw_pos": raw_pos,
                "normalized": {
                    "axial": axial,
                    "pixel_basis": axial_to_pixel_flat(axial["q"], axial["r"], 1.0),
                },
                "sector_ids": [],
                "sector_link_ids": [],
            }
        for conn in cluster_macro_node.findall("./connections/connection[@ref='sectors']"):
            macro_node = conn.find("./macro")
            sector_macro = macro_node.get("ref") if macro_node is not None else None
            if not sector_macro:
                continue
            raw_local = pos_from(conn)
            cluster_sector_offsets[cluster_macro][sector_macro] = raw_local
            if sector_macro not in clusters[cluster_macro]["sector_ids"]:
                clusters[cluster_macro]["sector_ids"].append(sector_macro)
        for conn in cluster_macro_node.findall("./connections/connection[@ref='regions']"):
            connection_name = (conn.get("name") or "").strip()
            # 1. 优先从 connection 名称解析 sector
            sector_macro = resolve_sector_macro_from_region_connection(connection_name)
            # 2. 如果 connection 名称解析出的 sector 不存在于当前 cluster 中，则使用 region ref 解析
            cluster_sector_ids = clusters[cluster_macro]["sector_ids"]
            if sector_macro is None or sector_macro not in cluster_sector_ids:
                macro_node = conn.find("./macro")
                if macro_node is not None:
                    region_ref_node = macro_node.find("./properties/region")
                    region_ref = (region_ref_node.get("ref") if region_ref_node is not None else "") or ""
                    if region_ref:
                        sector_macro_from_ref = resolve_sector_macro_from_region_ref(region_ref)
                        # 如果 region ref 解析出的 sector 存在于当前 cluster 中，则使用它
                        if sector_macro_from_ref and sector_macro_from_ref in cluster_sector_ids:
                            sector_macro = sector_macro_from_ref
            # 3. 如果仍无法解析，则跳过
            if sector_macro is None:
                continue
            macro_node = conn.find("./macro")
            if macro_node is None:
                continue
            region_macro_name = (macro_node.get("name") or "").strip()
            if not region_macro_name:
                continue
            region_ref_node = macro_node.find("./properties/region")
            region_ref = (region_ref_node.get("ref") if region_ref_node is not None else "") or ""
            sector_region_links[sector_macro].append({
                "name": region_macro_name,
                "region_ref": region_ref,
                "cluster_id": cluster_macro,
                "sector_id": sector_macro,
                "offset": pos3d_from(conn),
                "rotation": quaternion_from(conn),
            })
        for conn in cluster_macro_node.findall("./connections/connection[@ref='sechighways']"):
            macro_node = conn.find("./macro")
            highway_macro = (macro_node.get("ref") if macro_node is not None else None)
            if not highway_macro:
                continue
            endpoint_macros = [m.get("ref") for m in conn.findall("./macro/connections/connection/macro") if m.get("ref")]
            unique_endpoints: List[str] = []
            seen_endpoints = set()
            for endpoint in endpoint_macros:
                if endpoint not in seen_endpoints:
                    unique_endpoints.append(endpoint)
                    seen_endpoints.add(endpoint)
            if len(unique_endpoints) < 2:
                continue
            pair: Optional[Tuple[str, str]] = None
            for idx, left in enumerate(unique_endpoints):
                left_match = SHCON_ZONE_RE.fullmatch(left)
                if left_match is None:
                    continue
                left_sector = f"Cluster_{int(left_match.group(1)):02d}_Sector{int(left_match.group(2)):03d}_macro"
                for right in unique_endpoints[idx + 1:]:
                    right_match = SHCON_ZONE_RE.fullmatch(right)
                    if right_match is None:
                        continue
                    right_sector = f"Cluster_{int(right_match.group(1)):02d}_Sector{int(right_match.group(2)):03d}_macro"
                    if left_sector != right_sector:
                        pair = (left, right)
                        break
                if pair is not None:
                    break
            if pair is None:
                continue
            link_id = highway_macro
            sector_links[link_id] = {
                "id": link_id,
                "kind": "sector_highway",
                "cluster_id": cluster_macro,
                "macro": highway_macro,
                "raw_local_pos": pos_from(conn),
                "zone_a_id": pair[0].lower(),
                "zone_b_id": pair[1].lower(),
                "geometry": sechighway_geometry.get(highway_macro, {"entry_pos": {"x": 0.0, "z": 0.0}, "exit_pos": {"x": 0.0, "z": 0.0}, "spline": []}),
            }
            if link_id not in clusters[cluster_macro]["sector_link_ids"]:
                clusters[cluster_macro]["sector_link_ids"].append(link_id)

    for sector_macro_node in sectors_root.findall("./macro[@class='sector']"):
        sector_macro = sector_macro_node.get("name")
        if not sector_macro:
            continue
        match = SECTOR_MACRO_RE.fullmatch(sector_macro)
        cluster_id = f"Cluster_{int(match.group(1)):02d}_macro" if match else None
        raw_local = cluster_sector_offsets.get(cluster_id or "", {}).get(sector_macro, {"x": 0.0, "z": 0.0})
        cluster_raw = clusters.get(cluster_id or "", {}).get("raw_pos", {"x": 0.0, "z": 0.0})
        # 获取area：优先使用sector自己的area，否则回退到cluster的area
        sector_area = area_by_sector_macro.get(sector_macro.lower())
        if sector_area is not None:
            area = sector_area
        elif cluster_id and cluster_id.lower() in area_by_cluster_macro:
            area = area_by_cluster_macro[cluster_id.lower()]
        else:
            area = {"sunlight": 0.0, "economy": 0.0, "security": 0.0, "tags": []}
        sectors[sector_macro] = {
            "id": sector_macro,
            "cluster_id": cluster_id,
            "nameId": name_id_by_macro.get(sector_macro.lower(), ""),
            "name": registry.get_name(name_id_by_macro.get(sector_macro.lower(), ""), "en"),
            "owner": clusters.get(cluster_id or "", {}).get("owner", "neutral"),
            "owner_color": OWNER_COLORS.get(clusters.get(cluster_id or "", {}).get("owner", "neutral"), "#94a3b8"),
            "area": area,
            "raw_local_pos": raw_local,
            "raw_world_pos": vec_add(cluster_raw, raw_local),
            "zone_ids": [],
            "zones": {},
            "cluster_gate_ids": [],
            "highway_ids": [],
        }
        for conn in sector_macro_node.findall("./connections/connection[@ref='zones']"):
            macro_node = conn.find("./macro")
            zone_macro = macro_node.get("ref") if macro_node is not None else None
            if not zone_macro:
                continue
            zone_offsets_by_sector[sector_macro][zone_macro] = pos3d_from(conn)
            zone_key = zone_macro.lower()
            sectors[sector_macro]["zone_ids"].append(zone_key)
            sectors[sector_macro]["zones"][zone_key] = {
                "id": zone_key,
            }
        for conn in sector_macro_node.findall("./connections/connection[@ref='zonehighways']"):
            macro_node = conn.find("./macro")
            highway_macro = macro_node.get("ref") if macro_node is not None else None
            if not highway_macro:
                continue
            geometry = zonehighway_geometry.get(
                highway_macro,
                {"entry_pos": {"x": 0.0, "z": 0.0}, "exit_pos": {"x": 0.0, "z": 0.0}, "spline": [], "radius": 0.0},
            )
            connection_name = conn.get("name") or highway_macro
            highway_id = f"{sector_macro}:{connection_name}"
            instance_offset = pos_from(conn)
            entry_pos = vec_add(instance_offset, geometry["entry_pos"])
            exit_pos = vec_add(instance_offset, geometry["exit_pos"])
            entry_macro = conn.find("./macro/connections/connection[@ref='entrypoint']/macro")
            exit_macro = conn.find("./macro/connections/connection[@ref='exitpoint']/macro")
            entry_zone_id = zone_connection_path_to_zone_macro(entry_macro.get("path") if entry_macro is not None else None)
            exit_zone_id = zone_connection_path_to_zone_macro(exit_macro.get("path") if exit_macro is not None else None)
            entry_conn = entry_macro.get("connection") if entry_macro is not None else None
            exit_conn = exit_macro.get("connection") if exit_macro is not None else None
            sector_highways[highway_id] = {
                "id": highway_id,
                "kind": "sector_highway",
                "sector_id": sector_macro,
                "macro": highway_macro,
                "name": connection_name,
                "from_zone_id": entry_zone_id.lower() if entry_zone_id else None,
                "to_zone_id": exit_zone_id.lower() if exit_zone_id else None,
                "from_zone_connection": entry_conn,
                "to_zone_connection": exit_conn,
                "instance_offset": instance_offset,
                "entry_pos": entry_pos,
                "exit_pos": exit_pos,
                "spline": [vec_add(instance_offset, {"x": point["x"], "z": point["z"]}) for point in geometry["spline"]],
                "radius": geometry["radius"],
                "source": "sectors_xml_zonehighways",
            }
            sectors[sector_macro]["highway_ids"].append(highway_id)

    regions_rows: List[dict] = []
    resourceareas_rows: List[dict] = []

    # 根据资源模型选择不同的处理逻辑
    if resource_model == "resourceareas" and sector_resource_areas and definitions:
        # 9.0+ 使用新版资源嵌入逻辑
        for sector_key in sectors.keys():
            sector_key_lower = sector_key.lower()
            areas = sector_resource_areas.get(sector_key_lower, [])

            cluster_id = sectors[sector_key].get("cluster_id", "")

            for area in areas:
                ref = area.get("ref", "")
                amount = area.get("amount", 1)
                definition = definitions.get(ref, {})

                if not definition:
                    continue

                ware = definition.get("ware", "")
                rating = definition.get("rating", 0.0)
                yield_val = definition.get("yield", 0.0)
                delay = definition.get("respawnDelay", 0.0)

                factor = definition.get("objectyieldfactor")
                if factor is None:
                    factor = definition.get("gatherspeedfactor")
                if factor is None:
                    factor = 1.0

                respawn = 0.0
                if delay > 0:
                    respawn = yield_val * 60.0 / delay

                # 构建该 area 的 resources 数组（每个 area 单独输出）
                # 注意：yield/respawn 是单个实例的值，不乘以 amount
                area_resources = [{
                    "ware": ware,
                    "yield": round_to_int(yield_val),
                    "respawn": round_to_int(respawn),
                    "delay": delay,
                    "gatherfactor": factor,
                    "rating": rating,
                }]

                # 添加到 resourceareas_rows（新结构：包含 resources 数组）
                resourceareas_rows.append({
                    "ref": ref,
                    "amount": amount,
                    "resources": area_resources,
                    "cluster_id": cluster_id,
                    "sector_id": sector_key,
                })

                # 9.0+ 填充 sector.regions（仅 ref 和 amount）
                sectors[sector_key].setdefault("regions", []).append({
                    "ref": ref,
                    "amount": amount,
                })

        # 9.0+ 不在分支内聚合，等分支结束后统一处理
    else:
        # 8.0- 使用旧版 region 处理逻辑
        resolved_region_definitions_path = region_definitions_xml_path or Path("")
        resolved_regionobjectgroups_path = regionobjectgroups_xml_path or Path("")
        resolved_regionyields_path = regionyields_xml_path or Path("")
        yield_level_map = build_yield_level_map(resolved_regionyields_path)
        yield_info_map = build_yield_info_map(resolved_regionyields_path)
        yield_density_map = build_yield_density_map(resolved_regionyields_path)

        # 同一个 region ref 会在多个 sector 复用，必须按 sector + instance 区分坐标。
        region_position_map: Dict[Tuple[str, str, str], Dict[str, object]] = {}
        for sector_id, links in sector_region_links.items():
            sector_data = sectors.get(sector_id, {})
            sector_local_pos = sector_data.get("raw_local_pos", {"x": 0.0, "y": 0.0, "z": 0.0})
            for link in links:
                region_ref = link["region_ref"]
                region_name = link.get("name", "")
                region_offset = link.get("offset", {"x": 0.0, "y": 0.0, "z": 0.0})
                cluster_rotation = link.get("rotation")
                cluster_pos = {
                    "x": compact_number(region_offset.get("x", 0.0)),
                    "y": compact_number(region_offset.get("y", 0.0)),
                    "z": compact_number(region_offset.get("z", 0.0)),
                }
                relative_pos = {
                    "x": compact_number(region_offset.get("x", 0.0) - sector_local_pos.get("x", 0.0)),
                    "y": compact_number(region_offset.get("y", 0.0) - sector_local_pos.get("y", 0.0)),
                    "z": compact_number(region_offset.get("z", 0.0) - sector_local_pos.get("z", 0.0)),
                }
                region_position_map[(sector_id, region_ref, region_name)] = {
                    "position": relative_pos,
                    "cluster_position": cluster_pos,
                    "rotation": cluster_rotation,
                }

        templates, calc_data = migrate_region_definitions(
            resolved_region_definitions_path,
            resolved_regionobjectgroups_path,
            yield_level_map,
            yield_density_map,
            yield_info_map,
            region_position_map,
        )
        for region_id, template in templates.items():
            regions_rows.append(template)
        regions_rows.sort(key=lambda item: item["id"])

        for sector_id, links in sector_region_links.items():
            if sector_id not in sectors:
                continue

            resourceareas_map: Dict[tuple, dict] = {}
            sector_region_rows: List[dict] = []
            referenced_region_ids: set = set()

            for link in links:
                region_ref = link["region_ref"]
                region_name = link.get("name", "")
                region_calc = calc_data.get(region_ref, {})
                if not region_calc:
                    continue

                position_entry = region_position_map.get((sector_id, region_ref, region_name)) if region_position_map else None
                position = position_entry.get("position") if position_entry else None
                cluster_position = position_entry.get("cluster_position") if position_entry else None
                rotation = position_entry.get("rotation") if position_entry else None

                template = templates.get(region_ref, {})
                template_resources = template.get("resources", [])
                if not template_resources:
                    continue

                referenced_region_ids.add(region_ref)

                position_key = None
                if position:
                    position_key = f"{position['x']},{position['y']},{position['z']}"

                key = (region_ref, position_key)
                if key not in resourceareas_map:
                    resourceareas_map[key] = {
                        "ref": region_ref,
                        "amount": 0,
                    }
                    if position:
                        resourceareas_map[key]["position"] = position
                    resourceareas_map[key]["cluster_position"] = cluster_position
                    if rotation is not None:
                        resourceareas_map[key]["rotation"] = rotation

                    # 从 region 模板复制 falloff 因子
                    template = templates.get(region_ref, {})
                    template_falloff = template.get("falloff")
                    if not template_falloff:
                        print(f"  ⚠️ 警告：region '{region_ref}' 缺少 falloff 数据")
                        template_falloff = {}
                    lateral_f = as_number(template_falloff.get("lateral_factor"), 1.0)
                    radial_f = as_number(template_falloff.get("radial_factor"), 1.0)
                    radial_f_2 = as_number(template_falloff.get("radial_factor_2"), radial_f)
                    total_falloff = lateral_f * radial_f
                    total_falloff_2 = as_number(template_falloff.get("effective_factor_2"), lateral_f * radial_f_2)

                    resourceareas_map[key]["lateral_factor"] = round(lateral_f, 4)
                    resourceareas_map[key]["radial_factor"] = round(radial_f, 4)
                    resourceareas_map[key]["falloff_factor"] = round(total_falloff, 4)
                    resourceareas_map[key]["radial_factor_2"] = round(radial_f_2, 4)
                    resourceareas_map[key]["effective_factor_2"] = round(total_falloff_2, 4)

                    # 从 region 模板复制完整的 boundary 数据用于计算（包括 spline）
                    template_boundary = template.get("boundary")
                    if not template_boundary:
                        print(f"  ⚠️ 警告：region '{region_ref}' 缺少 boundary 数据，跳过")
                        continue
                    boundary_for_calc = dict(template_boundary)

                    # 输出用的 boundary 只包含 class 和 size（供人类阅读）
                    boundary_for_output = {
                        "class": template_boundary.get("class", ""),
                    }
                    if "size" in template_boundary:
                        boundary_for_output["size"] = template_boundary["size"]

                    resourceareas_map[key]["boundary"] = boundary_for_output

                    # 从 region 模板复制 total_volume_km3
                    volume_km3 = template.get("volume_km3")
                    if volume_km3 is None:
                        print(f"  ⚠️ 警告：region '{region_ref}' 缺少 volume_km3 数据")
                        volume_km3 = 0
                    resourceareas_map[key]["total_volume_km3"] = volume_km3

                    has_solid = any(not is_gas_ware(t.get("ware", "")) for t in template_resources)

                    # block 统计统一对所有资源区计算，截断规则沿用气体的 64km 网格口径。
                    total_blocks, effective_blocks = calculate_gas_block_count_truncated(
                        position or {"x": 0.0, "y": 0.0, "z": 0.0},
                        boundary_for_calc
                    )
                    resourceareas_map[key]["total_blocks"] = total_blocks
                    resourceareas_map[key]["blocks"] = effective_blocks

                    if has_solid:
                        # 使用 position 重新计算有效体积
                        _, effective_vol = calculate_solid_volume_truncated(boundary_for_calc)
                        effective_vol_km3 = effective_vol / 1_000_000_000.0
                        resourceareas_map[key]["volume_km3"] = round_to_int(effective_vol_km3)

                    resourceareas_map[key]["resources"] = calculate_resourcearea_resources(
                        region_calc,
                        position,
                        template_resources,
                    )

                resourceareas_map[key]["amount"] += 1

                sector_region_rows.append(region_calc)

            sector_data = sectors.get(sector_id, {})
            cluster_id = sector_data.get("cluster_id", "")
            for area_item in resourceareas_map.values():
                area_item["cluster_id"] = cluster_id
                area_item["sector_id"] = sector_id
                resourceareas_rows.append(area_item)

                # 8.0 填充 sector.regions（含 ref, position, rotation, boundary, volume_km3）
                region_entry = {
                    "ref": area_item.get("ref", ""),
                    "position": area_item.get("position", {}),
                }
                if area_item.get("rotation"):
                    region_entry["rotation"] = area_item["rotation"]
                if area_item.get("boundary"):
                    region_entry["boundary"] = area_item["boundary"]
                if area_item.get("total_volume_km3"):
                    region_entry["volume_km3"] = area_item["total_volume_km3"]
                sectors[sector_id].setdefault("regions", []).append(region_entry)

    # Step 1 不再聚合 sector.resources，由 Step 2 回填
    # 初始化 sector.regions 为空数组（Step 2 可能会更新）
    for sector_id in sectors.keys():
        sectors[sector_id].setdefault("regions", [])
        sectors[sector_id].setdefault("resources", [])

    for zone_macro_node in zones_root.findall("./macro[@class='zone']"):
            zone_macro = zone_macro_node.get("name")
            if not zone_macro:
                continue
            sector_id = None
            for candidate_sector, candidate_zones in zone_offsets_by_sector.items():
                if zone_macro in candidate_zones:
                    sector_id = candidate_sector
                    break
            if sector_id is None:
                continue
            zone_key = zone_macro.lower()
            raw_local = zone_offsets_by_sector[sector_id][zone_macro]
            zone_kind = "shcon" if SHCON_ZONE_RE.fullmatch(zone_macro or "") else "zone"
            zones[zone_key] = {
                "id": zone_key,
                "sector_id": sector_id,
                "name": "",
                "kind": zone_kind,
                "raw_local_pos": raw_local,
                "cluster_gate_ids": [],
            }
            for conn in zone_macro_node.findall("./connections/connection"):
                conn_name = conn.get("name") or conn.get("ref") or ""
                match = CLUSTER_GATE_RE.fullmatch(conn_name)
                if match:
                    gate_id = f"{zone_key}:{conn_name}"
                    gate_raw = vec_add(raw_local, pos_from(conn))
                    cluster_links[gate_id] = {
                        "id": gate_id,
                        "kind": "cluster_gate",
                        "sector_id": sector_id,
                        "cluster_id": sectors[sector_id]["cluster_id"],
                        "zone_id": zone_key,
                        "name": conn_name,
                        "target_cluster_id": f"Cluster_{int(match.group(2)):02d}_macro",
                        "raw_local_pos": gate_raw,
                    }
                    zones[zone_key]["cluster_gate_ids"].append(gate_id)
                    sectors[sector_id]["cluster_gate_ids"].append(gate_id)
                    continue

    cluster_to_sectors: Dict[str, List[str]] = defaultdict(list)
    for sector_id, sector in sectors.items():
        if sector["cluster_id"]:
            cluster_to_sectors[sector["cluster_id"]].append(sector_id)

    def snap_sector_center(value: float) -> float:
        return round(value / 64000.0) * 64000.0

    sector_point_sets: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(dict)
    sector_zone_points: Dict[str, List[Dict[str, float]]] = defaultdict(list)
    for sector_id, sector in sectors.items():
        for gate_id in sector["cluster_gate_ids"]:
            sector_point_sets[sector_id][gate_id] = cluster_links[gate_id]["raw_local_pos"]
    for zone_id, zone in zones.items():
        sector_point_sets[zone["sector_id"]][zone_id] = zone["raw_local_pos"]
        sector_zone_points[zone["sector_id"]].append(zone["raw_local_pos"])
    sector_centers: Dict[str, Dict[str, float]] = {}
    for cluster_id, sector_ids in cluster_to_sectors.items():
        local_positions = {sector_id: sectors[sector_id]["raw_local_pos"] for sector_id in sector_ids}
        template_kind, slot_map, slot_positions = choose_sector_template(local_positions)
        radius_ratio = sector_radius_ratio(len(sector_ids))
        for sector_id in sector_ids:
            slot_name = slot_map.get(sector_id, "single")
            offset_ratio = slot_positions.get(slot_name, {"x": 0.0, "y": 0.0})
            point_set = sector_point_sets.get(sector_id, {})
            zone_points = sector_zone_points.get(sector_id, [])
            if zone_points:
                min_x = min(point["x"] for point in zone_points)
                max_x = max(point["x"] for point in zone_points)
                min_z = min(point["z"] for point in zone_points)
                max_z = max(point["z"] for point in zone_points)
                min_y = min(point.get("y", 0.0) for point in zone_points)
                max_y = max(point.get("y", 0.0) for point in zone_points)
                sector_center = {"x": snap_sector_center((min_x + max_x) / 2.0), "y": (min_y + max_y) / 2.0, "z": snap_sector_center((min_z + max_z) / 2.0)}
            else:
                sector_center = {"x": 0.0, "y": 0.0, "z": 0.0}
            sector_centers[sector_id] = sector_center
            centered_points = [
                {"x": point["x"] - sector_center["x"], "z": point["z"] - sector_center["z"]}
                for point in point_set.values()
            ]
            max_extent = max((math.hypot(point["x"], point["z"]) for point in centered_points), default=1.0)
            inner_ratio = math.sqrt(3.0) / 2.0
            extent_ratio = 0.8
            scale_per_radius = (inner_ratio * extent_ratio) / max(1.0, max_extent)
            sectors[sector_id]["normalized"] = {
                "template_kind": template_kind,
                "slot": slot_name,
                "sector_radius_ratio": radius_ratio,
                "center_offset_ratio": {
                    "x": compact_number(offset_ratio["x"]),
                    "y": compact_number(offset_ratio["y"]),
                },
                "scale_per_radius": scale_per_radius,
                "scale_basis": {
                    "hex_inner_ratio": inner_ratio,
                    "extent_ratio": extent_ratio,
                    "max_extent": max_extent,
                },
            }
            sectors[sector_id]["raw_center_pos"] = {
                "x": compact_number(sector_center["x"]),
                "y": compact_number(sector_center["y"]),
                "z": compact_number(sector_center["z"]),
            }

    for gate_id, gate in cluster_links.items():
        sector_id = gate["sector_id"]
        sector_norm = sectors[sector_id]["normalized"]
        scale_per_radius = sector_norm["scale_per_radius"]
        sector_center = sector_centers.get(sector_id, {"x": 0.0, "y": 0.0, "z": 0.0})
        raw = gate["raw_local_pos"]
        gate["raw_local_pos"] = {
            "x": raw["x"],
            "z": raw["z"],
            "sx": (raw["x"] - sector_center["x"]) * scale_per_radius,
            "sy": -(raw["z"] - sector_center["z"]) * scale_per_radius,
        }

    for zone_id, zone in zones.items():
        sector_id = zone["sector_id"]
        sector_norm = sectors[sector_id]["normalized"]
        scale_per_radius = sector_norm["scale_per_radius"]
        sector_center = sector_centers.get(sector_id, {"x": 0.0, "y": 0.0, "z": 0.0})
        raw = zone["raw_local_pos"]
        zone["raw_local_pos"] = {
            "x": raw["x"],
            "y": compact_number(raw.get("y", 0.0)),
            "z": raw["z"],
            "sx": (raw["x"] - sector_center["x"]) * scale_per_radius,
            "sy": -(raw["z"] - sector_center["z"]) * scale_per_radius,
        }

    for highway_id, highway in sector_highways.items():
        sector_id = highway["sector_id"]
        sector_norm = sectors[sector_id]["normalized"]
        scale_per_radius = sector_norm["scale_per_radius"]
        sector_center = sector_centers.get(sector_id, {"x": 0.0, "y": 0.0, "z": 0.0})
        highway["entry_sr"] = {
            "sx": (highway["entry_pos"]["x"] - sector_center["x"]) * scale_per_radius,
            "sy": -(highway["entry_pos"]["z"] - sector_center["z"]) * scale_per_radius,
        }
        highway["exit_sr"] = {
            "sx": (highway["exit_pos"]["x"] - sector_center["x"]) * scale_per_radius,
            "sy": -(highway["exit_pos"]["z"] - sector_center["z"]) * scale_per_radius,
        }
        highway["spline_sr"] = [
            {"sx": (point["x"] - sector_center["x"]) * scale_per_radius, "sy": -(point["z"] - sector_center["z"]) * scale_per_radius}
            for point in highway["spline"]
        ]

    for link_id, link in sector_links.items():
        zone_a = zones.get(link["zone_a_id"])
        zone_b = zones.get(link["zone_b_id"])
        if zone_a:
            link["sector_a_id"] = zone_a["sector_id"]
            link["from_zone_normalized_ratio"] = zone_a.get("normalized", {}).get("projected_local_ratio")
            link["from_zone_raw_local_pos"] = zone_a["raw_local_pos"]
        if zone_b:
            link["sector_b_id"] = zone_b["sector_id"]
            link["to_zone_normalized_ratio"] = zone_b.get("normalized", {}).get("projected_local_ratio")
            link["to_zone_raw_local_pos"] = zone_b["raw_local_pos"]

    sector_stations: Dict[str, List[dict]] = defaultdict(list)
    if god_xml_path and god_xml_path.exists():
        god_root = parse_xml(god_xml_path)
        sector_macro_by_lower = {key.lower(): key for key in sectors.keys()}
        zone_macro_by_lower = {key.lower(): key for key in zones.keys()}
        for station_node in god_root.findall(".//station[@id]"):
            location = station_node.find("./location")
            if location is None:
                continue
            location_class = (location.get("class") or "").strip().lower()
            location_macro = (location.get("macro") or "").strip()
            if not location_class or not location_macro:
                continue

            sector_id = None
            if location_class == "sector":
                sector_id = sector_macro_by_lower.get(location_macro.lower())
            elif location_class == "zone":
                zone_id = zone_macro_by_lower.get(location_macro.lower())
                if zone_id and zone_id in zones:
                    sector_id = zones[zone_id]["sector_id"]
            if not sector_id or sector_id not in sectors:
                continue

            base_pos = {
                "x": compact_number(as_float(station_node.get("x"), 0.0)),
                "z": compact_number(as_float(station_node.get("z"), 0.0)),
            }
            position = station_node.find("./position")
            if position is not None:
                base_pos = {
                    "x": compact_number(as_float(position.get("x"), 0.0)),
                    "z": compact_number(as_float(position.get("z"), 0.0)),
                }

            if location_class == "zone":
                zone_id = zone_macro_by_lower.get(location_macro.lower())
                if not zone_id or zone_id not in zones:
                    continue
                raw_sector_pos = vec_add({"x": zones[zone_id]["raw_local_pos"]["x"], "z": zones[zone_id]["raw_local_pos"]["z"]}, base_pos)
            else:
                raw_sector_pos = base_pos

            sector_norm = sectors[sector_id]["normalized"]
            scale_per_radius = sector_norm["scale_per_radius"]
            sector_center = sector_centers.get(sector_id, {"x": 0.0, "z": 0.0})
            station_sector_pos = {
                "x": compact_number(raw_sector_pos["x"]),
                "z": compact_number(raw_sector_pos["z"]),
                "sx": (raw_sector_pos["x"] - sector_center["x"]) * scale_per_radius,
                "sy": -(raw_sector_pos["z"] - sector_center["z"]) * scale_per_radius,
            }

            select = station_node.find("./station/select")
            station_item = {
                "owner": (station_node.get("owner") or "").strip(),
                "race": (station_node.get("race") or "").strip(),
                "type": (station_node.get("type") or "").strip(),
                "tags": split_tags(select.get("tags") if select is not None else None),
                "raw_sector_pos": station_sector_pos,
            }
            sector_stations[sector_id].append(station_item)

    faction_map = factions_by_id or {}
    owner_resolution_ties: List[dict] = []
    excluded_owners = {"player"}

    def owner_color(owner: str) -> str:
        if owner in faction_map:
            return faction_map[owner].get("color") or OWNER_COLORS.get(owner, "#4b5563")
        return OWNER_COLORS.get(owner, "#4b5563")

    for sector_id, sector in sectors.items():
        stations = sector_stations.get(sector_id, [])
        candidates = []
        for station in stations:
            owner = (station.get("owner") or "").strip()
            station_type = (station.get("type") or "").strip()
            tags = station.get("tags") or []
            if not owner or owner in excluded_owners:
                continue
            faction = faction_map.get(owner)
            if faction is not None and not faction.get("claimspace", False):
                continue
            if station_type == "piratebase":
                continue
            score = (station_type_priority(station_type), station_tag_priority(tags))
            candidates.append((score, station))

        if not candidates:
            sector["owner"] = "ownerless"
            sector["owner_color"] = owner_color("ownerless")
            continue

        candidates.sort(key=lambda item: item[0], reverse=True)
        best_score = candidates[0][0]
        top = [item[1] for item in candidates if item[0] == best_score]
        chosen = top[0]
        sector["owner"] = (chosen.get("owner") or "").strip() or "ownerless"
        sector["owner_color"] = owner_color(sector["owner"])
        if len(top) > 1:
            owner_resolution_ties.append(
                {
                    "sector_id": sector_id,
                    "score": {"type_priority": best_score[0], "tag_priority": best_score[1]},
                    "candidates": [
                        {
                            "owner": item.get("owner"),
                            "type": item.get("type"),
                            "tags": item.get("tags", []),
                        }
                        for item in top
                    ],
                    "chosen": {
                        "owner": chosen.get("owner"),
                        "type": chosen.get("type"),
                        "tags": chosen.get("tags", []),
                    },
                }
            )

    for cluster_id, cluster in clusters.items():
        sector_ids = cluster.get("sector_ids", [])
        if not sector_ids:
            cluster["owner"] = "ownerless"
            cluster["owner_color"] = owner_color("ownerless")
            continue
        owners = {sectors[sector_id]["owner"] for sector_id in sector_ids if sector_id in sectors}
        if len(owners) == 1 and "ownerless" not in owners:
            cluster_owner = next(iter(owners))
        else:
            cluster_owner = "ownerless"
        cluster["owner"] = cluster_owner
        cluster["owner_color"] = owner_color(cluster_owner)

    grouped_sector_links: Dict[Tuple[str, str, str], List[str]] = defaultdict(list)
    for link_id, link in sector_links.items():
        sector_a_id = link.get("sector_a_id")
        sector_b_id = link.get("sector_b_id")
        if not sector_a_id or not sector_b_id:
            continue
        grouped_sector_links[(link["cluster_id"],) + tuple(sorted((sector_a_id, sector_b_id)))].append(link_id)
    for _, group in grouped_sector_links.items():
        count = len(group)
        for index, link_id in enumerate(sorted(group)):
            sector_links[link_id].setdefault("render", {})["lane_index"] = index
            sector_links[link_id]["render"]["lane_count"] = count

    nested_clusters: Dict[str, dict] = {}
    for cluster_id, cluster in clusters.items():
        nested_cluster = {
            key: value
            for key, value in cluster.items()
            if key not in {"sector_ids", "sector_link_ids"}
        }
        nested_cluster["sectors"] = {}
        nested_cluster["sector_links"] = {}
        nested_clusters[cluster_id] = nested_cluster

    for sector_id, sector in sectors.items():
        cluster_id = sector.get("cluster_id")
        if not cluster_id or cluster_id not in nested_clusters:
            continue
        nested_sector = {
            "id": sector.get("id"),
            "cluster_id": sector.get("cluster_id"),
            "nameId": sector.get("nameId"),
            "name": sector.get("name"),
            "owner": sector.get("owner"),
            "owner_color": sector.get("owner_color"),
            "area": sector.get("area"),
            "raw_local_pos": sector.get("raw_local_pos"),
            "raw_world_pos": sector.get("raw_world_pos"),
            "raw_center_pos": sector.get("raw_center_pos"),
            "normalized": sector.get("normalized"),
            "zones": sector.get("zones", {}),
        }
        nested_sector["cluster_gates"] = {}
        nested_sector["highways"] = {}
        nested_sector["stations"] = []
        if "has_khaak_hive" in sector:
            nested_sector["has_khaak_hive"] = sector.get("has_khaak_hive")
        if "khaak_hive_sources" in sector:
            nested_sector["khaak_hive_sources"] = sector.get("khaak_hive_sources")
        if "regions" in sector:
            nested_sector["regions"] = sector.get("regions")
        if "resources" in sector:
            nested_sector["resources"] = sector.get("resources")
        nested_clusters[cluster_id]["sectors"][sector_id] = nested_sector

    for zone_id, zone in zones.items():
        sector_id = zone["sector_id"]
        cluster_id = sectors[sector_id]["cluster_id"]
        zone_entry = nested_clusters[cluster_id]["sectors"][sector_id]["zones"].setdefault(zone_id, {"id": zone_id})
        zone_entry["kind"] = zone["kind"]
        zone_entry["raw_sector_pos"] = zone["raw_local_pos"]

    for gate_id, gate in cluster_links.items():
        cluster_id = gate["cluster_id"]
        sector_id = gate["sector_id"]
        normalized_id = gate["name"]
        nested_gate = {
            "id": normalized_id,
            "target_cluster_id": gate["target_cluster_id"],
            "raw_local_pos": gate["raw_local_pos"],
        }
        nested_clusters[cluster_id]["sectors"][sector_id]["cluster_gates"][normalized_id] = nested_gate

    for highway_id, highway in sector_highways.items():
        sector_id = highway["sector_id"]
        cluster_id = sectors[sector_id]["cluster_id"]
        entry = {
            "x": highway["entry_pos"]["x"],
            "z": highway["entry_pos"]["z"],
            "sx": highway["entry_sr"]["sx"],
            "sy": highway["entry_sr"]["sy"],
        }
        exitp = {
            "x": highway["exit_pos"]["x"],
            "z": highway["exit_pos"]["z"],
            "sx": highway["exit_sr"]["sx"],
            "sy": highway["exit_sr"]["sy"],
        }
        spline_points = [
            {
                "x": point["x"],
                "z": point["z"],
                "sx": point_sr["sx"],
                "sy": point_sr["sy"],
            }
            for point, point_sr in zip(highway["spline"], highway["spline_sr"])
        ]
        nested_clusters[cluster_id]["sectors"][sector_id]["highways"][highway["name"]] = {
            "macro": highway["macro"],
            "entry": entry,
            "exit": exitp,
            "spline": spline_points,
        }

    for link_id, link in sector_links.items():
        cluster_id = link["cluster_id"]
        nested_link = {
            "id": link["id"],
            "sector_a_id": link.get("sector_a_id"),
            "sector_b_id": link.get("sector_b_id"),
            "from_zone_id": link.get("zone_a_id"),
            "to_zone_id": link.get("zone_b_id"),
            "render": link.get("render", {}),
        }
        nested_clusters[cluster_id]["sector_links"][link_id] = nested_link

    for sector_id, station_items in sector_stations.items():
        cluster_id = sectors[sector_id]["cluster_id"]
        if cluster_id and cluster_id in nested_clusters and sector_id in nested_clusters[cluster_id]["sectors"]:
            nested_clusters[cluster_id]["sectors"][sector_id]["stations"] = station_items

    def _lower(value):
        return value.lower() if isinstance(value, str) else value

    payload_clusters: Dict[str, dict] = {}
    payload_sectors: Dict[str, dict] = {}

    for cluster_id, cluster in nested_clusters.items():
        normalized_cluster_id = _lower(cluster_id)
        payload_clusters[normalized_cluster_id] = {
            **cluster,
            "id": _lower(cluster.get("id", cluster_id)),
            "sectors": sorted(_lower(sector_id) for sector_id in cluster.get("sectors", {}).keys()),
            "sector_links": {
                _lower(link_id): {
                    **link,
                    "id": _lower(link.get("id")),
                    "sector_a_id": _lower(link.get("sector_a_id")),
                    "sector_b_id": _lower(link.get("sector_b_id")),
                    "from_zone_id": _lower(link.get("from_zone_id")),
                    "to_zone_id": _lower(link.get("to_zone_id")),
                }
                for link_id, link in cluster.get("sector_links", {}).items()
            },
        }

        for sector_id, sector in cluster.get("sectors", {}).items():
            payload_sectors[_lower(sector_id)] = {
                **sector,
                "id": _lower(sector.get("id", sector_id)),
                "cluster_id": _lower(sector.get("cluster_id", cluster_id)),
                "cluster_gates": {
                    _lower(gate_id): {
                        **gate,
                        "id": _lower(gate.get("id")),
                        "target_cluster_id": _lower(gate.get("target_cluster_id")),
                    }
                    for gate_id, gate in sector.get("cluster_gates", {}).items()
                },
                "highways": {
                    _lower(highway_id): {
                        **highway,
                        "macro": _lower(highway.get("macro")),
                        "from_zone_id": _lower(highway.get("from_zone_id")),
                        "to_zone_id": _lower(highway.get("to_zone_id")),
                    }
                    for highway_id, highway in sector.get("highways", {}).items()
                },
                "khaak_hive_sources": sorted(_lower(source_id) for source_id in sector.get("khaak_hive_sources", [])),
            }

    payload = {
        "clusters": payload_clusters,
        "sectors": payload_sectors,
    }
    name_ids = sorted(
        {
            item["nameId"]
            for item in list(clusters.values()) + list(sectors.values())
            if item.get("nameId")
        }
    )
    missing_cluster_nameid = sorted([cluster_id for cluster_id, cluster in clusters.items() if not cluster.get("nameId")])
    missing_sector_nameid = sorted([sector_id for sector_id, sector in sectors.items() if not sector.get("nameId")])

    return {
        "payload": payload,
        "regions": regions_rows,
        "resourceareas": build_resourceareas_json_payload(resourceareas_rows),
        "name_ids": name_ids,
        "missing_name_ids": {
            "clusters": missing_cluster_nameid,
            "sectors": missing_sector_nameid,
        },
        "stats": {
            "clusters": len(clusters),
            "sectors": len(sectors),
            "zones": len(zones),
            "cluster_links": len(cluster_links),
            "sector_links": len(sector_links),
            "highways": len(sector_highways),
            "regions": len(regions_rows),
            "resourceareas": sum(len(g.get("areas", [])) for g in build_resourceareas_json_payload(resourceareas_rows)),
            "stations": sum(len(items) for items in sector_stations.values()),
            "owner_resolution_ties": len(owner_resolution_ties),
        },
        "owner_resolution_ties": owner_resolution_ties,
    }
