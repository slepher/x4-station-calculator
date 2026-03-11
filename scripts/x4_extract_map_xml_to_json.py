import argparse
import json
import math
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


CLUSTER_MACRO_RE = re.compile(r"Cluster_(\d+)_macro", re.IGNORECASE)
SECTOR_MACRO_RE = re.compile(r"Cluster_(\d+)_Sector(\d+)_macro", re.IGNORECASE)
ZONE_MACRO_RE = re.compile(r"Zone\d+_Cluster_(\d+)_Sector(\d+)_macro", re.IGNORECASE)
SHCON_ZONE_RE = re.compile(r"tzoneCluster_(\d+)_Sector(\d+)SHCon(\d+)_GateZone_macro", re.IGNORECASE)
CLUSTER_GATE_RE = re.compile(r"connection_ClusterGate(\d+)To(\d+)", re.IGNORECASE)
ZONE_HIGHWAY_MACRO_RE = re.compile(r"Highway(\d+)_Cluster_?(\d+)_(?:Sector|S)(\d+)_macro", re.IGNORECASE)
SEC_HIGHWAY_MACRO_RE = re.compile(r"SuperHighway(\d+)_Cluster_?(\d+)_macro", re.IGNORECASE)


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract and normalize X4 universe map data from distilled XML.")
    parser.add_argument("--map-dir", default=str(Path("x4raw_assets") / "8.0-Diplomacy" / "maps" / "xu_ep2_universe"))
    parser.add_argument("--metadata-json", default=str(Path("src") / "assets" / "map.json"))
    parser.add_argument("--output", default=str(Path("docs") / "x4_map_extracted_from_xml.json"))
    return parser.parse_args()


def as_float(value: Optional[str], default: float = 0.0) -> float:
    return float(value) if value is not None else default


def pos_from(parent: Optional[ET.Element]) -> Dict[str, float]:
    position = None
    if parent is not None:
        position = parent.find("./offset/position")
    if position is None:
        return {"x": 0.0, "z": 0.0}
    return {"x": as_float(position.get("x")), "z": as_float(position.get("z"))}


def vec_add(left: Dict[str, float], right: Dict[str, float]) -> Dict[str, float]:
    return {"x": left["x"] + right["x"], "z": left["z"] + right["z"]}


def cluster_world_to_axial(pos: Dict[str, float]) -> Dict[str, int]:
    q = round(pos["x"] / 15000000.0)
    r = round((pos["z"] - 8660000.0 * q) / 17320000.0)
    return {"q": int(q), "r": int(r)}


def axial_to_pixel_flat(q: int, r: int, size: float = 1.0) -> Dict[str, float]:
    return {
        "x": size * 1.5 * q,
        "y": size * math.sqrt(3.0) * (r + q / 2.0),
    }


def centered_local_positions(points: Dict[str, Dict[str, float]]) -> Dict[str, Dict[str, float]]:
    if not points:
        return {}
    avg_x = sum(point["x"] for point in points.values()) / len(points)
    avg_z = sum(point["z"] for point in points.values()) / len(points)
    return {
        key: {"x": point["x"] - avg_x, "z": point["z"] - avg_z}
        for key, point in points.items()
    }


def unit_vec(x: float, y: float) -> Tuple[float, float]:
    length = math.hypot(x, y)
    if length <= 1e-6:
        return (0.0, 0.0)
    return (x / length, y / length)


def template_positions_ratio(sector_count: int, variant: int = 0) -> Dict[str, Dict[str, float]]:
    s = math.sqrt(3.0) / 4.0
    if sector_count == 1:
        return {"single": {"x": 0.0, "y": 0.0}}
    if sector_count == 2:
        templates = [
            {"upper": {"x": -0.25, "y": -s}, "lower": {"x": 0.25, "y": s}},
            {"upper": {"x": 0.25, "y": -s}, "lower": {"x": -0.25, "y": s}},
        ]
        return templates[variant % len(templates)]
    if sector_count == 3:
        templates = [
            {
                "left": {"x": -0.5, "y": 0.0},
                "center": {"x": 0.25, "y": s},
                "upper_right": {"x": 0.25, "y": -s},
            },
            {
                "upper_left": {"x": -0.25, "y": -s},
                "lower_left": {"x": -0.25, "y": s},
                "right": {"x": 0.5, "y": 0.0},
            },
        ]
        return templates[variant % len(templates)]
    raise ValueError(f"Unsupported sector count: {sector_count}")


def best_slot_assignment(local_positions: Dict[str, Dict[str, float]], slots: Dict[str, Dict[str, float]]) -> Dict[str, str]:
    centered = centered_local_positions(local_positions)
    actual_vectors = {key: unit_vec(value["x"], -value["z"]) for key, value in centered.items()}
    slot_vectors = {slot: unit_vec(value["x"], value["y"]) for slot, value in slots.items()}
    slot_names = list(slots.keys())
    sector_names = list(local_positions.keys())
    best_score = None
    best_mapping: Dict[str, str] = {}
    import itertools
    for perm in itertools.permutations(sector_names, len(slot_names)):
        score = 0.0
        mapping: Dict[str, str] = {}
        for slot_name, sector_name in zip(slot_names, perm):
            ax, ay = actual_vectors[sector_name]
            sx, sy = slot_vectors[slot_name]
            score += (ax - sx) ** 2 + (ay - sy) ** 2
            mapping[sector_name] = slot_name
        if best_score is None or score < best_score:
            best_score = score
            best_mapping = mapping
    return best_mapping


def choose_sector_template(local_positions: Dict[str, Dict[str, float]]) -> Tuple[str, Dict[str, str], Dict[str, Dict[str, float]]]:
    names = list(local_positions.keys())
    count = len(names)
    if count == 1:
        slots = template_positions_ratio(1)
        return ("single", {names[0]: "single"}, slots)
    if count == 2:
        centered = centered_local_positions(local_positions)
        x_values = [point["x"] for point in centered.values()]
        x_span = max(x_values) - min(x_values) if x_values else 0.0
        best = None
        for variant in [0, 1]:
            slots = template_positions_ratio(2, variant)
            mapping = best_slot_assignment(local_positions, slots)
            score = 0.0
            actual_vectors = {key: unit_vec(value["x"], -value["z"]) for key, value in centered.items()}
            for sector_name, slot_name in mapping.items():
                ax, ay = actual_vectors[sector_name]
                sx, sy = unit_vec(slots[slot_name]["x"], slots[slot_name]["y"])
                score += (ax - sx) ** 2 + (ay - sy) ** 2
            if x_span <= 1e-6:
                score += 0.0 if variant == 1 else 1e-3
            if best is None or score < best[0]:
                best = (score, variant, mapping, slots)
        assert best is not None
        return ("dual_b" if best[1] == 1 else "dual_a", best[2], best[3])
    if count == 3:
        best = None
        centered = centered_local_positions(local_positions)
        actual_vectors = {key: unit_vec(value["x"], -value["z"]) for key, value in centered.items()}
        for variant in [0, 1]:
            slots = template_positions_ratio(3, variant)
            mapping = best_slot_assignment(local_positions, slots)
            score = 0.0
            for sector_name, slot_name in mapping.items():
                ax, ay = actual_vectors[sector_name]
                sx, sy = unit_vec(slots[slot_name]["x"], slots[slot_name]["y"])
                score += (ax - sx) ** 2 + (ay - sy) ** 2
            if best is None or score < best[0]:
                best = (score, variant, mapping, slots)
        assert best is not None
        return ("triple_b" if best[1] == 1 else "triple_a", best[2], best[3])
    return (f"multi_{count}", {}, {})


def sector_radius_ratio(sector_count: int) -> float:
    if sector_count <= 1:
        return 1.0
    if sector_count in (2, 3):
        return 0.5
    return 0.36


def load_metadata(metadata_json: Path) -> Tuple[Dict[str, dict], Dict[str, dict], Dict[str, dict]]:
    if not metadata_json.exists():
        return {}, {}, {}
    raw = json.loads(metadata_json.read_text(encoding="utf-8"))
    data = raw.get("data", raw)
    clusters: Dict[str, dict] = {}
    sectors: Dict[str, dict] = {}
    zones: Dict[str, dict] = {}
    for cluster in data:
        cluster_macro = (cluster.get("macro") or {}).get("ref") or cluster.get("name")
        clusters[cluster_macro] = cluster
        for sector in cluster.get("sectors", []):
            sector_macro = (sector.get("macro") or {}).get("ref") or sector.get("name")
            sectors[sector_macro] = sector
            for zone in sector.get("zones", []):
                zone_macro = (zone.get("macro") or {}).get("ref") or zone.get("name")
                zones[zone_macro] = zone
    return clusters, sectors, zones


def parse_xml(path: Path) -> ET.Element:
    return ET.parse(path).getroot()


def parse_xml_group(map_dir: Path, suffix: str) -> List[ET.Element]:
    return [parse_xml(path) for path in sorted(map_dir.glob(f"*{suffix}"))]


def enrich_name_owner(macro: str, metadata: Dict[str, dict]) -> Tuple[str, Optional[str]]:
    node = metadata.get(macro)
    if not node:
        return macro, None
    attrs = node.get("qsnaAttributes") or {}
    return attrs.get("name") or macro, attrs.get("owner")


def main() -> None:
    args = parse_args()
    map_dir = Path(args.map_dir)
    output_path = Path(args.output)
    cluster_meta, sector_meta, zone_meta = load_metadata(Path(args.metadata_json))

    galaxy_root = parse_xml(map_dir / "galaxy.xml")
    cluster_roots = parse_xml_group(map_dir, "clusters.xml")
    sector_roots = parse_xml_group(map_dir, "sectors.xml")
    zone_roots = parse_xml_group(map_dir, "zones.xml")
    zonehighway_roots = parse_xml_group(map_dir, "zonehighways.xml")
    sechighway_roots = parse_xml_group(map_dir, "sechighways.xml")

    clusters: Dict[str, dict] = {}
    sectors: Dict[str, dict] = {}
    zones: Dict[str, dict] = {}
    cluster_links: Dict[str, dict] = {}
    sector_links: Dict[str, dict] = {}
    local_highways: Dict[str, dict] = {}

    for macro in galaxy_root.findall("./macro"):
        if macro.get("class") != "galaxy":
            continue
        for conn in macro.findall("./connections/connection[@ref='clusters']"):
            macro_node = conn.find("./macro")
            cluster_macro = macro_node.get("ref") if macro_node is not None else None
            if not cluster_macro:
                continue
            name, owner = enrich_name_owner(cluster_macro, cluster_meta)
            raw_pos = pos_from(conn)
            axial = cluster_world_to_axial(raw_pos)
            clusters[cluster_macro] = {
                "id": cluster_macro,
                "name": name,
                "owner": owner or "neutral",
                "owner_color": OWNER_COLORS.get(owner or "neutral", "#94a3b8"),
                "raw_pos": raw_pos,
                "normalized": {
                    "axial": axial,
                    "pixel_basis": axial_to_pixel_flat(axial["q"], axial["r"], 1.0),
                },
                "sector_ids": [],
                "sector_link_ids": [],
            }

    sechighway_geometry: Dict[str, dict] = {}
    for sechighways_root in sechighway_roots:
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

    cluster_sector_offsets: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(dict)
    zone_offsets_by_sector: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(dict)

    for clusters_root in cluster_roots:
        for cluster_macro_node in clusters_root.findall("./macro[@class='cluster']"):
            cluster_macro = cluster_macro_node.get("name")
            if not cluster_macro:
                continue
            if cluster_macro not in clusters:
                name, owner = enrich_name_owner(cluster_macro, cluster_meta)
                raw_pos = galaxy_cluster_positions.get(cluster_macro, {"x": 0.0, "z": 0.0})
                axial = cluster_world_to_axial(raw_pos)
                clusters[cluster_macro] = {
                    "id": cluster_macro,
                    "name": name,
                    "owner": owner or "neutral",
                    "owner_color": OWNER_COLORS.get(owner or "neutral", "#94a3b8"),
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
                    "zone_a_id": pair[0],
                    "zone_b_id": pair[1],
                    "geometry": sechighway_geometry.get(highway_macro, {"entry_pos": {"x": 0.0, "z": 0.0}, "exit_pos": {"x": 0.0, "z": 0.0}, "spline": []}),
                }
                if link_id not in clusters[cluster_macro]["sector_link_ids"]:
                    clusters[cluster_macro]["sector_link_ids"].append(link_id)

    for sectors_root in sector_roots:
        for sector_macro_node in sectors_root.findall("./macro[@class='sector']"):
            sector_macro = sector_macro_node.get("name")
            if not sector_macro:
                continue
            match = SECTOR_MACRO_RE.fullmatch(sector_macro)
            cluster_id = f"Cluster_{int(match.group(1)):02d}_macro" if match else None
            raw_local = cluster_sector_offsets.get(cluster_id or "", {}).get(sector_macro, {"x": 0.0, "z": 0.0})
            cluster_raw = clusters.get(cluster_id or "", {}).get("raw_pos", {"x": 0.0, "z": 0.0})
            name, owner = enrich_name_owner(sector_macro, sector_meta)
            sectors[sector_macro] = {
                "id": sector_macro,
                "cluster_id": cluster_id,
                "name": name,
                "owner": owner or clusters.get(cluster_id or "", {}).get("owner", "neutral"),
                "owner_color": OWNER_COLORS.get(owner or clusters.get(cluster_id or "", {}).get("owner", "neutral"), "#94a3b8"),
                "raw_local_pos": raw_local,
                "raw_world_pos": vec_add(cluster_raw, raw_local),
                "zone_ids": [],
                "cluster_gate_ids": [],
                "local_highway_ids": [],
            }
            for conn in sector_macro_node.findall("./connections/connection[@ref='zones']"):
                macro_node = conn.find("./macro")
                zone_macro = macro_node.get("ref") if macro_node is not None else None
                if not zone_macro:
                    continue
                zone_offsets_by_sector[sector_macro][zone_macro] = pos_from(conn)
                sectors[sector_macro]["zone_ids"].append(zone_macro)

    for zones_root in zone_roots:
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
            raw_local = zone_offsets_by_sector[sector_id][zone_macro]
            name, _ = enrich_name_owner(zone_macro, zone_meta)
            zone_kind = "shcon" if SHCON_ZONE_RE.fullmatch(zone_macro or "") else "zone"
            zones[zone_macro] = {
                "id": zone_macro,
                "sector_id": sector_id,
                "name": name,
                "kind": zone_kind,
                "raw_local_pos": raw_local,
                "cluster_gate_ids": [],
            }
            for conn in zone_macro_node.findall("./connections/connection"):
                conn_name = conn.get("name") or conn.get("ref") or ""
                match = CLUSTER_GATE_RE.fullmatch(conn_name)
                if not match:
                    continue
                gate_id = f"{zone_macro}:{conn_name}"
                gate_raw = vec_add(raw_local, pos_from(conn))
                cluster_links[gate_id] = {
                    "id": gate_id,
                    "kind": "cluster_gate",
                    "sector_id": sector_id,
                    "cluster_id": sectors[sector_id]["cluster_id"],
                    "zone_id": zone_macro,
                    "name": conn_name,
                    "target_cluster_id": f"Cluster_{int(match.group(2)):02d}_macro",
                    "raw_local_pos": gate_raw,
                }
                zones[zone_macro]["cluster_gate_ids"].append(gate_id)
                sectors[sector_id]["cluster_gate_ids"].append(gate_id)

    for zonehighways_root in zonehighway_roots:
        for macro in zonehighways_root.findall("./macro[@class='highway']"):
            macro_name = macro.get("name")
            if not macro_name:
                continue
            match = ZONE_HIGHWAY_MACRO_RE.fullmatch(macro_name)
            if not match:
                continue
            sector_id = f"Cluster_{int(match.group(2)):02d}_Sector{int(match.group(3)):03d}_macro"
            if sector_id not in sectors:
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
            local_highways[macro_name] = {
                "id": macro_name,
                "kind": "local_highway",
                "sector_id": sector_id,
                "highway_index": int(match.group(1)),
                "entry_pos": entry,
                "exit_pos": exitp,
                "spline": spline,
            }
            sectors[sector_id]["local_highway_ids"].append(macro_name)

    cluster_to_sectors: Dict[str, List[str]] = defaultdict(list)
    for sector_id, sector in sectors.items():
        if sector["cluster_id"]:
            cluster_to_sectors[sector["cluster_id"]].append(sector_id)

    sector_point_sets: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(dict)
    for sector_id, sector in sectors.items():
        for gate_id in sector["cluster_gate_ids"]:
            sector_point_sets[sector_id][gate_id] = cluster_links[gate_id]["raw_local_pos"]
    for zone_id, zone in zones.items():
        if zone["kind"] == "shcon":
            sector_point_sets[zone["sector_id"]][zone_id] = zone["raw_local_pos"]
    for highway_id, highway in local_highways.items():
        sector_point_sets[highway["sector_id"]][f"{highway_id}:entry"] = highway["entry_pos"]
        sector_point_sets[highway["sector_id"]][f"{highway_id}:exit"] = highway["exit_pos"]
        for idx, point in enumerate(highway["spline"]):
            sector_point_sets[highway["sector_id"]][f"{highway_id}:spline:{idx}"] = {"x": point["x"], "z": point["z"]}

    for cluster_id, sector_ids in cluster_to_sectors.items():
        local_positions = {sector_id: sectors[sector_id]["raw_local_pos"] for sector_id in sector_ids}
        template_kind, slot_map, slot_positions = choose_sector_template(local_positions)
        radius_ratio = sector_radius_ratio(len(sector_ids))
        for sector_id in sector_ids:
            slot_name = slot_map.get(sector_id, "single")
            offset_ratio = slot_positions.get(slot_name, {"x": 0.0, "y": 0.0})
            point_set = sector_point_sets.get(sector_id, {})
            max_extent = max((math.hypot(point["x"], point["z"]) for point in point_set.values()), default=1.0)
            inner_ratio = math.sqrt(3.0) / 2.0
            extent_ratio = 0.8
            scale_per_radius = (inner_ratio * extent_ratio) / max(1.0, max_extent)
            sectors[sector_id]["normalized"] = {
                "template_kind": template_kind,
                "slot": slot_name,
                "sector_radius_ratio": radius_ratio,
                "center_offset_ratio": {"x": offset_ratio["x"], "y": offset_ratio["y"]},
                "scale_per_radius": scale_per_radius,
                "scale_basis": {
                    "hex_inner_ratio": inner_ratio,
                    "extent_ratio": extent_ratio,
                    "max_extent": max_extent,
                },
            }

    for gate_id, gate in cluster_links.items():
        sector_id = gate["sector_id"]
        scale_per_radius = sectors[sector_id]["normalized"]["scale_per_radius"]
        gate["normalized"] = {
            "projected_local_ratio": {
                "x": gate["raw_local_pos"]["x"] * scale_per_radius,
                "y": -gate["raw_local_pos"]["z"] * scale_per_radius,
            }
        }

    for zone_id, zone in zones.items():
        sector_id = zone["sector_id"]
        scale_per_radius = sectors[sector_id]["normalized"]["scale_per_radius"]
        zone["normalized"] = {
            "projected_local_ratio": {
                "x": zone["raw_local_pos"]["x"] * scale_per_radius,
                "y": -zone["raw_local_pos"]["z"] * scale_per_radius,
            }
        }

    for highway_id, highway in local_highways.items():
        sector_id = highway["sector_id"]
        scale_per_radius = sectors[sector_id]["normalized"]["scale_per_radius"]
        highway["normalized"] = {
            "entry_ratio": {"x": highway["entry_pos"]["x"] * scale_per_radius, "y": -highway["entry_pos"]["z"] * scale_per_radius},
            "exit_ratio": {"x": highway["exit_pos"]["x"] * scale_per_radius, "y": -highway["exit_pos"]["z"] * scale_per_radius},
            "spline_ratio": [
                {"x": point["x"] * scale_per_radius, "y": -point["z"] * scale_per_radius}
                for point in highway["spline"]
            ],
        }

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

    nested_clusters: Dict[str, dict] = {}
    for cluster_id, cluster in clusters.items():
        nested_cluster = {
            key: value
            for key, value in cluster.items()
            if key not in {"sector_ids", "sector_link_ids"}
        }
        nested_cluster["sectors"] = {}
        nested_cluster["cluster_links"] = {}
        nested_cluster["sector_links"] = {}
        nested_clusters[cluster_id] = nested_cluster

    for sector_id, sector in sectors.items():
        cluster_id = sector.get("cluster_id")
        if not cluster_id or cluster_id not in nested_clusters:
            continue
        nested_sector = {
            key: value
            for key, value in sector.items()
            if key not in {"zone_ids", "cluster_gate_ids", "local_highway_ids"}
        }
        nested_sector["shcon_anchors"] = {}
        nested_sector["cluster_gates"] = {}
        nested_sector["local_highways"] = {}
        nested_clusters[cluster_id]["sectors"][sector_id] = nested_sector

    for zone_id, zone in zones.items():
        sector_id = zone["sector_id"]
        cluster_id = sectors[sector_id]["cluster_id"]
        if zone["kind"] != "shcon":
            continue
        nested_clusters[cluster_id]["sectors"][sector_id]["shcon_anchors"][zone_id] = {
            "id": zone_id,
            "kind": zone["kind"],
            "name": zone["name"],
            "raw_sector_pos": zone["raw_local_pos"],
            "normalized": zone.get("normalized", {}),
        }

    for gate_id, gate in cluster_links.items():
        cluster_id = gate["cluster_id"]
        sector_id = gate["sector_id"]
        nested_gate = {
            key: value
            for key, value in gate.items()
            if key != "zone_id"
        }
        nested_clusters[cluster_id]["cluster_links"][gate_id] = nested_gate
        nested_clusters[cluster_id]["sectors"][sector_id]["cluster_gates"][gate_id] = nested_gate

    for highway_id, highway in local_highways.items():
        sector_id = highway["sector_id"]
        cluster_id = sectors[sector_id]["cluster_id"]
        nested_clusters[cluster_id]["sectors"][sector_id]["local_highways"][highway_id] = highway

    for link_id, link in sector_links.items():
        cluster_id = link["cluster_id"]
        nested_link = {
            key: value
            for key, value in link.items()
            if key not in {"zone_a_id", "zone_b_id"}
        }
        nested_clusters[cluster_id]["sector_links"][link_id] = nested_link

    payload = {
        "meta": {
            "version": "x4-map-xml-v2",
            "source_map_dir": str(map_dir),
            "metadata_json": str(args.metadata_json) if Path(args.metadata_json).exists() else None,
            "structure": "clusters->sectors with zone data expanded into sector-space",
        },
        "clusters": nested_clusters,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Output: {output_path}")
    print(f"clusters={len(clusters)} sectors={len(sectors)} zones={len(zones)} cluster_links={len(cluster_links)} sector_links={len(sector_links)} local_highways={len(local_highways)}")


if __name__ == "__main__":
    main()
