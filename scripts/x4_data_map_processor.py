import argparse
import json
import math
import os
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

try:
    from processor.i18n import get_i18n_registry
except ModuleNotFoundError:
    from scripts.processor.i18n import get_i18n_registry  # type: ignore


config_file = "x4-station-calculator.config.json"
if not os.path.exists(config_file):
    raise SystemExit(f"Missing config file: {config_file}")
with open(config_file, "r", encoding="utf-8") as f:
    _config = json.load(f)

X4_UNPACKED_DATA_PATH = os.path.join(_config['raw_assets_dir'], _config['folder_name'])
OUTPUT_VERSION_DIR = os.path.join(_config['processed_assets_dir'], _config['folder_name'])
DEFAULT_MAP_DIR = str(Path(X4_UNPACKED_DATA_PATH) / "maps" / "xu_ep2_universe")
DEFAULT_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "maps.json")
DEFAULT_MAPDEFAULTS = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "mapdefaults_final.xml")
DEFAULT_GOD_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "god_final.xml")
DEFAULT_FACTIONS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "factions_final.xml")
DEFAULT_COLORS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "colors_final.xml")
DEFAULT_REGION_DEFINITIONS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "region_definitions_final.xml")
DEFAULT_REGIONYIELDS_XML = str(Path(X4_UNPACKED_DATA_PATH) / "libraries" / "regionyields_final.xml")
DEFAULT_FACTIONS_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "factions.json")
DEFAULT_REGIONS_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "regions.json")
DEFAULT_REGIONYIELDS_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / "data" / "regionyields.json")


CLUSTER_MACRO_RE = re.compile(r"Cluster_(\d+)_macro", re.IGNORECASE)
SECTOR_MACRO_RE = re.compile(r"Cluster_(\d+)_Sector(\d+)_macro", re.IGNORECASE)
ZONE_MACRO_RE = re.compile(r"Zone\d+_Cluster_(\d+)_Sector(\d+)_macro", re.IGNORECASE)
SHCON_ZONE_RE = re.compile(r"tzoneCluster_(\d+)_Sector(\d+)SHCon(\d+)_GateZone_macro", re.IGNORECASE)
CLUSTER_GATE_RE = re.compile(r"connection_ClusterGate(\d+)To(\d+)[a-z]?", re.IGNORECASE)
REGION_CONNECTION_RE = re.compile(r"C(\d+)S(\d+)_", re.IGNORECASE)
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
    parser.add_argument("--map-dir", default=DEFAULT_MAP_DIR)
    parser.add_argument("--mapdefaults-xml", default=DEFAULT_MAPDEFAULTS)
    parser.add_argument("--god-xml", default=DEFAULT_GOD_XML)
    parser.add_argument("--factions-xml", default=DEFAULT_FACTIONS_XML)
    parser.add_argument("--colors-xml", default=DEFAULT_COLORS_XML)
    parser.add_argument("--region-definitions-xml", default=DEFAULT_REGION_DEFINITIONS_XML)
    parser.add_argument("--regionyields-xml", default=DEFAULT_REGIONYIELDS_XML)
    parser.add_argument("--factions-output", default=DEFAULT_FACTIONS_OUTPUT)
    parser.add_argument("--regions-output", default=DEFAULT_REGIONS_OUTPUT)
    parser.add_argument("--regionyields-output", default=DEFAULT_REGIONYIELDS_OUTPUT)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
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


def split_tags(tags: Optional[str]) -> List[str]:
    if not tags:
        return []
    return [item for item in tags.split() if item]


def parse_select_tags(tags: Optional[str]) -> List[str]:
    if not tags:
        return []
    raw = tags.strip()
    if raw.startswith("[") and raw.endswith("]"):
        raw = raw[1:-1]
    parts = [item.strip() for item in re.split(r"[\s,]+", raw) if item.strip()]
    return parts


def station_type_priority(station_type: str) -> int:
    return 1 if station_type in {"tradingstation", "shipyard"} else 0


def station_tag_priority(tags: List[str]) -> int:
    preferred = {"tradingstation", "wharf", "shipyard", "equipmentdock"}
    return 1 if any(tag in preferred for tag in tags) else 0


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02X}{g:02X}{b:02X}"


def coerce_attr_value(value: Optional[str]):
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


def load_color_map_from_xml(colors_xml_path: Path) -> Dict[str, str]:
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
    i18n_registry,
) -> Tuple[List[dict], Dict[str, dict]]:
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


def migrate_regionyields(regionyields_xml_path: Path) -> List[dict]:
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


def load_region_definition_resources(
    region_definitions_xml_path: Path,
    yield_level_map: Dict[str, Dict[str, int]],
) -> Dict[str, List[dict]]:
    if not region_definitions_xml_path.exists():
        return {}
    root = parse_xml(region_definitions_xml_path)
    by_name: Dict[str, List[dict]] = {}
    for region_node in root.findall("./region[@name]"):
        region_name = (region_node.get("name") or "").strip()
        if not region_name:
            continue
        resources: List[dict] = []
        for resource_node in region_node.findall("./resources/resource[@ware]"):
            ware = (resource_node.get("ware") or "").strip()
            yield_name = (resource_node.get("yield") or "").strip()
            if not ware or not yield_name:
                continue
            level = yield_level_map.get(ware, {}).get(yield_name, 1)
            resources.append({
                "ware": ware,
                "yield": yield_name,
                "level": level,
            })
        by_name[region_name] = resources
    return by_name


def load_mapdefaults(mapdefaults_xml: Path) -> Tuple[Dict[str, str], Dict[str, dict]]:
    if not mapdefaults_xml.exists():
        return {}, {}

    root = parse_xml(mapdefaults_xml)
    name_id_by_macro: Dict[str, str] = {}
    area_by_sector_macro: Dict[str, dict] = {}

    for dataset in root.findall("./dataset[@macro]"):
        macro = dataset.get("macro")
        if not macro:
            continue
        macro_key = macro.lower()
        properties = dataset.find("./properties")
        if properties is None:
            continue

        identification = properties.find("./identification")
        if identification is not None:
            name_id = identification.get("name") or ""
            if name_id:
                name_id_by_macro[macro_key] = name_id

        area_node = properties.find("./area")
        if area_node is not None and SECTOR_MACRO_RE.fullmatch(macro):
            area_by_sector_macro[macro_key] = {
                "sunlight": as_float(area_node.get("sunlight"), 0.0),
                "economy": as_float(area_node.get("economy"), 0.0),
                "security": as_float(area_node.get("security"), 0.0),
                "tags": split_tags(area_node.get("tags")),
            }

    return name_id_by_macro, area_by_sector_macro


def parse_xml(path: Path) -> ET.Element:
    return ET.parse(path).getroot()


def parse_xml_group(map_dir: Path, suffix: str) -> List[ET.Element]:
    return [parse_xml(path) for path in sorted(map_dir.glob(f"*{suffix}"))]


def zone_connection_path_to_zone_macro(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    match = re.search(r"Zone(\d+)_Cluster_(\d+)_Sector(\d+)_connection", path, re.IGNORECASE)
    if not match:
        return None
    return f"Zone{int(match.group(1)):03d}_Cluster_{int(match.group(2)):02d}_Sector{int(match.group(3)):03d}_macro"

def generate_map_data(
    map_dir: Path,
    mapdefaults_path: Path,
    god_xml_path: Optional[Path] = None,
    factions_by_id: Optional[Dict[str, dict]] = None,
    region_definitions_xml_path: Optional[Path] = None,
    regionyields_xml_path: Optional[Path] = None,
    i18n_registry=None,
) -> Dict[str, object]:
    name_id_by_macro, area_by_sector_macro = load_mapdefaults(mapdefaults_path)
    registry = i18n_registry or get_i18n_registry()
    if i18n_registry is None:
        registry.configure(X4_UNPACKED_DATA_PATH, {
            "044": {"iso": "en", "name": "English"},
        })
    registry.collect_many(set(name_id_by_macro.values()))

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
    zonehighway_geometry: Dict[str, dict] = {}
    for zonehighways_root in zonehighway_roots:
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
    for clusters_root in cluster_roots:
        for cluster_macro_node in clusters_root.findall("./macro[@class='cluster']"):
            cluster_macro = cluster_macro_node.get("name")
            if not cluster_macro:
                continue
            if cluster_macro not in clusters:
                raw_pos = galaxy_cluster_positions.get(cluster_macro, {"x": 0.0, "z": 0.0})
                axial = cluster_world_to_axial(raw_pos)
                clusters[cluster_macro] = {
                    "id": cluster_macro,
                    "nameId": name_id_by_macro.get(cluster_macro.lower(), ""),
                    "name": registry.get_name(name_id_by_macro.get(cluster_macro.lower(), ""), "en"),
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
                region_match = REGION_CONNECTION_RE.search(connection_name)
                if region_match is None:
                    continue
                sector_macro = f"Cluster_{int(region_match.group(1)):02d}_Sector{int(region_match.group(2)):03d}_macro"
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
            area = area_by_sector_macro.get(
                sector_macro.lower(),
                {"sunlight": 0.0, "economy": 0.0, "security": 0.0, "tags": []},
            )
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
                "cluster_gate_ids": [],
                "highway_ids": [],
            }
            for conn in sector_macro_node.findall("./connections/connection[@ref='zones']"):
                macro_node = conn.find("./macro")
                zone_macro = macro_node.get("ref") if macro_node is not None else None
                if not zone_macro:
                    continue
                zone_offsets_by_sector[sector_macro][zone_macro] = pos_from(conn)
                sectors[sector_macro]["zone_ids"].append(zone_macro)
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
                    "from_zone_id": entry_zone_id,
                    "to_zone_id": exit_zone_id,
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

    resolved_region_definitions_path = region_definitions_xml_path or Path(DEFAULT_REGION_DEFINITIONS_XML)
    resolved_regionyields_path = regionyields_xml_path or Path(DEFAULT_REGIONYIELDS_XML)
    yield_level_map = build_yield_level_map(resolved_regionyields_path)
    resources_by_region_ref = load_region_definition_resources(resolved_region_definitions_path, yield_level_map)
    regions_rows: List[dict] = []
    for sector_id, links in sector_region_links.items():
        merged_by_ware: Dict[str, dict] = {}
        for link in links:
            link_resources = [dict(item) for item in resources_by_region_ref.get(link["region_ref"], [])]
            regions_rows.append({
                "name": link["name"],
                "region_ref": link["region_ref"],
                "cluster_id": link["cluster_id"],
                "sector_id": link["sector_id"],
                "resources": link_resources,
            })
            for resource in link_resources:
                ware = resource["ware"]
                prev = merged_by_ware.get(ware)
                if prev is None or resource["level"] > prev["level"]:
                    merged_by_ware[ware] = dict(resource)
        if sector_id in sectors:
            sectors[sector_id]["resources"] = sorted(merged_by_ware.values(), key=lambda item: item["ware"])
    for sector_id in sectors.keys():
        sectors[sector_id].setdefault("resources", [])
    regions_rows.sort(key=lambda item: (item["cluster_id"], item["sector_id"], item["name"]))

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
            zone_kind = "shcon" if SHCON_ZONE_RE.fullmatch(zone_macro or "") else "zone"
            zones[zone_macro] = {
                "id": zone_macro,
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
                    continue
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
        sector_norm = sectors[sector_id]["normalized"]
        scale_per_radius = sector_norm["scale_per_radius"]
        raw = gate["raw_local_pos"]
        gate["raw_local_pos"] = {
            "x": raw["x"],
            "z": raw["z"],
            "sx": raw["x"] * scale_per_radius,
            "sy": -raw["z"] * scale_per_radius,
        }

    for zone_id, zone in zones.items():
        sector_id = zone["sector_id"]
        sector_norm = sectors[sector_id]["normalized"]
        scale_per_radius = sector_norm["scale_per_radius"]
        raw = zone["raw_local_pos"]
        zone["raw_local_pos"] = {
            "x": raw["x"],
            "z": raw["z"],
            "sx": raw["x"] * scale_per_radius,
            "sy": -raw["z"] * scale_per_radius,
        }

    for highway_id, highway in sector_highways.items():
        sector_id = highway["sector_id"]
        sector_norm = sectors[sector_id]["normalized"]
        scale_per_radius = sector_norm["scale_per_radius"]
        highway["entry_sr"] = {
            "sx": highway["entry_pos"]["x"] * scale_per_radius,
            "sy": -highway["entry_pos"]["z"] * scale_per_radius,
        }
        highway["exit_sr"] = {
            "sx": highway["exit_pos"]["x"] * scale_per_radius,
            "sy": -highway["exit_pos"]["z"] * scale_per_radius,
        }
        highway["spline_sr"] = [
            {"sx": point["x"] * scale_per_radius, "sy": -point["z"] * scale_per_radius}
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

            base_pos = {"x": as_float(station_node.get("x"), 0.0), "z": as_float(station_node.get("z"), 0.0)}
            position = station_node.find("./position")
            if position is not None:
                base_pos = {"x": as_float(position.get("x"), 0.0), "z": as_float(position.get("z"), 0.0)}

            if location_class == "zone":
                zone_id = zone_macro_by_lower.get(location_macro.lower())
                if not zone_id or zone_id not in zones:
                    continue
                raw_sector_pos = vec_add({"x": zones[zone_id]["raw_local_pos"]["x"], "z": zones[zone_id]["raw_local_pos"]["z"]}, base_pos)
            else:
                raw_sector_pos = base_pos

            sector_norm = sectors[sector_id]["normalized"]
            scale_per_radius = sector_norm["scale_per_radius"]
            station_sector_pos = {
                "x": raw_sector_pos["x"],
                "z": raw_sector_pos["z"],
                "sx": raw_sector_pos["x"] * scale_per_radius,
                "sy": -raw_sector_pos["z"] * scale_per_radius,
            }

            select = station_node.find("./station/select")
            station_item = {
                "owner": (station_node.get("owner") or "").strip(),
                "race": (station_node.get("race") or "").strip(),
                "type": (station_node.get("type") or "").strip(),
                "tags": parse_select_tags(select.get("tags") if select is not None else None),
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
            key: value
            for key, value in sector.items()
            if key not in {"zone_ids", "cluster_gate_ids", "highway_ids"}
        }
        nested_sector["shcon_anchors"] = {}
        nested_sector["cluster_gates"] = {}
        nested_sector["highways"] = {}
        nested_sector["stations"] = []
        nested_clusters[cluster_id]["sectors"][sector_id] = nested_sector

    for zone_id, zone in zones.items():
        sector_id = zone["sector_id"]
        cluster_id = sectors[sector_id]["cluster_id"]
        if zone["kind"] != "shcon":
            continue
        nested_clusters[cluster_id]["sectors"][sector_id]["shcon_anchors"][zone_id] = {
            "id": zone_id,
            "raw_sector_pos": zone["raw_local_pos"],
        }

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

    payload = {
        "meta": {
            "version": "x4-map-xml-v2",
            "source_map_dir": str(map_dir),
            "mapdefaults_xml": str(mapdefaults_path) if mapdefaults_path.exists() else None,
            "structure": "clusters->sectors with zone data expanded into sector-space",
        },
        "clusters": nested_clusters,
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
            "stations": sum(len(items) for items in sector_stations.values()),
            "owner_resolution_ties": len(owner_resolution_ties),
        },
        "owner_resolution_ties": owner_resolution_ties,
    }


def write_map_output(payload: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    map_dir = Path(args.map_dir)
    output_path = Path(args.output)
    mapdefaults_path = Path(args.mapdefaults_xml)
    god_xml_path = Path(args.god_xml)
    factions_xml_path = Path(args.factions_xml)
    colors_xml_path = Path(args.colors_xml)
    region_definitions_xml_path = Path(args.region_definitions_xml)
    regionyields_xml_path = Path(args.regionyields_xml)
    factions_output_path = Path(args.factions_output)
    regions_output_path = Path(args.regions_output)
    regionyields_output_path = Path(args.regionyields_output)

    registry = get_i18n_registry()
    registry.configure(X4_UNPACKED_DATA_PATH, {
        "044": {"iso": "en", "name": "English"},
    })
    factions_rows, factions_by_id = migrate_factions(
        factions_xml_path=factions_xml_path,
        colors_xml_path=colors_xml_path,
        i18n_registry=registry,
    )
    regionyields_rows = migrate_regionyields(regionyields_xml_path)
    factions_output_path.parent.mkdir(parents=True, exist_ok=True)
    factions_output_path.write_text(json.dumps(factions_rows, ensure_ascii=False, indent=2), encoding="utf-8")
    regionyields_output_path.parent.mkdir(parents=True, exist_ok=True)
    regionyields_output_path.write_text(json.dumps(regionyields_rows, ensure_ascii=False, indent=2), encoding="utf-8")

    result = generate_map_data(
        map_dir=map_dir,
        mapdefaults_path=mapdefaults_path,
        god_xml_path=god_xml_path,
        factions_by_id=factions_by_id,
        region_definitions_xml_path=region_definitions_xml_path,
        regionyields_xml_path=regionyields_xml_path,
        i18n_registry=registry,
    )
    regions_output_path.parent.mkdir(parents=True, exist_ok=True)
    regions_output_path.write_text(json.dumps(result.get("regions", []), ensure_ascii=False, indent=2), encoding="utf-8")
    write_map_output(result["payload"], output_path)
    stats = result["stats"]
    missing = result["missing_name_ids"]
    print(f"Factions Output: {factions_output_path} count={len(factions_rows)}")
    print(f"Regionyields Output: {regionyields_output_path} count={len(regionyields_rows)}")
    print(f"Regions Output: {regions_output_path} count={len(result.get('regions', []))}")
    print(f"Output: {output_path}")
    print(
        f"clusters={stats['clusters']} sectors={stats['sectors']} zones={stats['zones']} "
        f"cluster_links={stats['cluster_links']} sector_links={stats['sector_links']} highways={stats['highways']} "
        f"stations={stats['stations']} owner_resolution_ties={stats['owner_resolution_ties']}"
    )
    ties = result.get("owner_resolution_ties", [])
    if ties:
        print("owner_resolution_tie_list:")
        for item in ties:
            candidates_text = "; ".join(
                [
                    f"{cand.get('owner')}|{cand.get('type')}|{','.join(cand.get('tags', []))}"
                    for cand in item.get("candidates", [])
                ]
            )
            chosen = item.get("chosen", {})
            chosen_text = f"{chosen.get('owner')}|{chosen.get('type')}|{','.join(chosen.get('tags', []))}"
            print(f"  {item.get('sector_id')} score={item.get('score')} chosen={chosen_text} candidates={candidates_text}")
    print(f"missing_cluster_nameId={len(missing['clusters'])}")
    if missing["clusters"]:
        print("  " + ", ".join(missing["clusters"]))
    print(f"missing_sector_nameId={len(missing['sectors'])}")
    if missing["sectors"]:
        print("  " + ", ".join(missing["sectors"]))


if __name__ == "__main__":
    main()


