import argparse
import json
import itertools
import math
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


GATE_LINK_RE = re.compile(r"connection_ClusterGate(\d+)To(\d+)", re.IGNORECASE)
LOCAL_HIGHWAY_GATE_RE = re.compile(r"Highway(\d+)Connection(\d+)_gate", re.IGNORECASE)
CLUSTER_ID_RE = re.compile(r"Cluster_(\d+)_", re.IGNORECASE)

REGION_CLUSTER_IDS = [29, 501, 502, 503, 500, 704, 2, 3, 39, 1, 5, 6, 740, 725, 4, 47]
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


@dataclass
class Vec2:
    x: float
    z: float

    def __add__(self, other: "Vec2") -> "Vec2":
        return Vec2(self.x + other.x, self.z + other.z)

    def __sub__(self, other: "Vec2") -> "Vec2":
        return Vec2(self.x - other.x, self.z - other.z)


@dataclass
class Cluster:
    macro: str
    name: str
    pos: Vec2
    owner: str


@dataclass
class Sector:
    macro: str
    name: str
    cluster_macro: str
    cluster_id: Optional[int]
    local_pos: Vec2
    world_pos: Vec2
    owner: str


@dataclass
class Zone:
    macro: str
    name: str
    sector_macro: str
    local_pos: Vec2


@dataclass
class Gate:
    id: str
    name: str
    zone_macro: str
    sector_macro: str
    cluster_id: Optional[int]
    local_pos: Vec2
    target_cluster_id: Optional[int]


@dataclass
class Highway:
    id: str
    name: str
    cluster_macro: str
    local_pos: Vec2
    zone_a_macro: str
    zone_b_macro: str
    sector_a_macro: str
    sector_b_macro: str


@dataclass
class LocalSectorHighway:
    id: str
    sector_macro: str
    endpoint_a_id: str
    endpoint_b_id: str
    zone_a_macro: str
    zone_b_macro: str
    local_a_pos: Vec2
    local_b_pos: Vec2


@dataclass
class LayoutConfig:
    width: float = 1800.0
    height: float = 1300.0
    pad_x: float = 90.0
    pad_y: float = 90.0
    top_pad: float = 70.0


def layout_config(include_all: bool = False) -> LayoutConfig:
    if include_all:
        return LayoutConfig(width=3600.0, height=2600.0, pad_x=180.0, pad_y=180.0, top_pad=140.0)
    return LayoutConfig()


def pos_from(node: dict) -> Vec2:
    position = ((node or {}).get("offset") or {}).get("position") or {}
    return Vec2(float(position.get("x", 0.0)), float(position.get("z", 0.0)))


def cluster_id_from_macro(macro: str) -> Optional[int]:
    match = CLUSTER_ID_RE.search(macro or "")
    return int(match.group(1)) if match else None


def axial_to_pixel(q: int, r: int, size: float) -> Tuple[float, float]:
    x = size * math.sqrt(3.0) * (q + r / 2.0)
    y = size * 1.5 * r
    return x, y


def axial_to_pixel_flat(q: int, r: int, size: float) -> Tuple[float, float]:
    x = size * 1.5 * q
    y = size * math.sqrt(3.0) * (r + q / 2.0)
    return x, y


def cluster_world_to_axial(pos: Vec2) -> Tuple[int, int]:
    q = round(pos.x / 15000.0)
    r = round((pos.z - 8660.0 * q) / 17320.0)
    return int(q), int(r)


def hex_points(cx: float, cy: float, radius: float) -> str:
    points: List[str] = []
    for index in range(6):
        angle = math.radians(60 * index)
        px = cx + radius * math.cos(angle)
        py = cy + radius * math.sin(angle)
        points.append(f"{px:.1f},{py:.1f}")
    return " ".join(points)


def owner_color(owner: str) -> str:
    return OWNER_COLORS.get(owner, "#94a3b8")


def load_map_json(path: str) -> Tuple[Dict[str, Cluster], Dict[str, Sector], Dict[str, Zone], Dict[str, List[Gate]], List[Highway], List[LocalSectorHighway]]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    clusters_raw = raw["data"] if isinstance(raw, dict) and "data" in raw else raw

    clusters: Dict[str, Cluster] = {}
    sectors: Dict[str, Sector] = {}
    zones: Dict[str, Zone] = {}
    gates_by_sector: Dict[str, List[Gate]] = {}
    highways: List[Highway] = []
    local_highways: List[LocalSectorHighway] = []

    for cluster_node in clusters_raw:
        cluster_macro = (cluster_node.get("macro") or {}).get("ref") or cluster_node.get("name")
        attrs = cluster_node.get("qsnaAttributes") or {}
        cluster_name = attrs.get("name") or cluster_macro
        cluster_pos = pos_from(cluster_node)
        cluster_owner = attrs.get("owner") or "neutral"
        clusters[cluster_macro] = Cluster(cluster_macro, cluster_name, cluster_pos, cluster_owner)

        for sector_node in cluster_node.get("sectors", []):
            sector_macro = (sector_node.get("macro") or {}).get("ref") or sector_node.get("name")
            sector_attrs = sector_node.get("qsnaAttributes") or {}
            sector_name = sector_attrs.get("name") or sector_macro
            sector_local = pos_from(sector_node)
            cluster_id = cluster_id_from_macro(cluster_macro)
            sector_world = cluster_pos + sector_local
            sector_owner = sector_attrs.get("owner") or cluster_owner
            local_highway_gate_ids: Dict[str, List[str]] = {}
            sectors[sector_macro] = Sector(
                macro=sector_macro,
                name=sector_name,
                cluster_macro=cluster_macro,
                cluster_id=cluster_id,
                local_pos=sector_local,
                world_pos=sector_world,
                owner=sector_owner,
            )

            for zone_node in sector_node.get("zones", []):
                zone_macro = (zone_node.get("macro") or {}).get("ref") or zone_node.get("name")
                zones[zone_macro] = Zone(
                    macro=zone_macro,
                    name=zone_node.get("name", zone_macro),
                    sector_macro=sector_macro,
                    local_pos=pos_from(zone_node),
                )

                for item in zone_node.get("items", []):
                    item_name = item.get("name") or item.get("ref") or ""
                    match = GATE_LINK_RE.fullmatch(item_name)
                    if match:
                        gates_by_sector.setdefault(sector_macro, []).append(
                            Gate(
                                id=f"{zone_macro}:{item_name}",
                                name=item_name,
                                zone_macro=zone_macro,
                                sector_macro=sector_macro,
                                cluster_id=cluster_id,
                                local_pos=pos_from(item),
                                target_cluster_id=int(match.group(2)),
                            )
                        )
                        continue
                    local_highway_match = LOCAL_HIGHWAY_GATE_RE.fullmatch(item_name)
                    if local_highway_match:
                        highway_key = local_highway_match.group(1)
                        local_highway_gate_ids.setdefault(highway_key, []).append((f"{zone_macro}:{item_name}", zone_macro, pos_from(item)))

            for highway_key, endpoint_entries in local_highway_gate_ids.items():
                deduped_entries = []
                seen_endpoint_ids: set[str] = set()
                for endpoint_entry in endpoint_entries:
                    endpoint_id = endpoint_entry[0]
                    if endpoint_id in seen_endpoint_ids:
                        continue
                    seen_endpoint_ids.add(endpoint_id)
                    deduped_entries.append(endpoint_entry)
                if len(deduped_entries) < 2:
                    continue
                endpoint_a_id, zone_a_macro, local_a_pos = deduped_entries[0]
                endpoint_b_id, zone_b_macro, local_b_pos = deduped_entries[1]
                local_highways.append(
                    LocalSectorHighway(
                        id=f"{sector_macro}:Highway{highway_key}",
                        sector_macro=sector_macro,
                        endpoint_a_id=endpoint_a_id,
                        endpoint_b_id=endpoint_b_id,
                        zone_a_macro=zone_a_macro,
                        zone_b_macro=zone_b_macro,
                        local_a_pos=local_a_pos,
                        local_b_pos=local_b_pos,
                    )
                )

        for highway_node in cluster_node.get("sechighways", []):
            connections = (((highway_node.get("macro") or {}).get("connections")) or [])
            endpoint_macros: List[str] = []
            for conn in connections:
                macro_ref = ((conn.get("macro") or {}).get("ref"))
                if macro_ref in zones and macro_ref not in endpoint_macros:
                    endpoint_macros.append(macro_ref)
            if len(endpoint_macros) < 2:
                continue
            zone_a_macro: Optional[str] = None
            zone_b_macro: Optional[str] = None
            for idx, left_macro in enumerate(endpoint_macros):
                left_sector = zones[left_macro].sector_macro
                for right_macro in endpoint_macros[idx + 1 :]:
                    right_sector = zones[right_macro].sector_macro
                    if left_sector != right_sector:
                        zone_a_macro = left_macro
                        zone_b_macro = right_macro
                        break
                if zone_a_macro is not None:
                    break
            if zone_a_macro is None or zone_b_macro is None:
                continue
            sector_a_macro = zones[zone_a_macro].sector_macro
            sector_b_macro = zones[zone_b_macro].sector_macro
            highways.append(
                Highway(
                    id=((highway_node.get("macro") or {}).get("ref") or highway_node.get("name") or f"{zone_a_macro}->{zone_b_macro}"),
                    name=highway_node.get("name") or "superhighway",
                    cluster_macro=cluster_macro,
                    local_pos=pos_from(highway_node),
                    zone_a_macro=zone_a_macro,
                    zone_b_macro=zone_b_macro,
                    sector_a_macro=sector_a_macro,
                    sector_b_macro=sector_b_macro,
                )
            )

    return clusters, sectors, zones, gates_by_sector, highways, local_highways


def is_display_zone(zone: Zone) -> bool:
    name = zone.macro.lower()
    raw_name = zone.name.lower()
    return not (name.startswith("tzone") or raw_name.startswith("tzone"))


def select_region_clusters(clusters: Dict[str, Cluster], include_all: bool = False) -> List[str]:
    if include_all:
        return sorted(
            clusters.keys(),
            key=lambda macro: (cluster_id_from_macro(macro) is None, cluster_id_from_macro(macro) or 0, clusters[macro].name),
        )

    region_macros: List[str] = []
    selected_ids = set(REGION_CLUSTER_IDS)
    for macro, cluster in clusters.items():
        cluster_id = cluster_id_from_macro(macro)
        if cluster_id in selected_ids:
            region_macros.append(macro)
    return sorted(region_macros, key=lambda macro: REGION_CLUSTER_IDS.index(cluster_id_from_macro(macro)))


def fit_world_to_screen(points: Iterable[Vec2], cfg: LayoutConfig) -> Tuple[float, float, float, float, float]:
    grid_points = [axial_to_pixel_flat(*cluster_world_to_axial(point), 1.0) for point in points]
    min_x = min((x for x, _ in grid_points), default=0.0)
    max_x = max((x for x, _ in grid_points), default=1.0)
    min_y = min((-y for _, y in grid_points), default=0.0)
    max_y = max((-y for _, y in grid_points), default=1.0)
    available_w = cfg.width - cfg.pad_x * 2
    available_h = cfg.height - cfg.pad_y * 2 - cfg.top_pad
    world_w = max(max_x - min_x, 1.0)
    world_h = max(max_y - min_y, 1.0)
    scale = min(available_w / world_w, available_h / world_h)
    offset_x = cfg.pad_x + (available_w - world_w * scale) / 2.0
    offset_y = cfg.pad_y + cfg.top_pad + (available_h - world_h * scale) / 2.0
    return min_x, min_y, scale, offset_x, offset_y


def scaled_layout_config(cfg: LayoutConfig, factor: float) -> LayoutConfig:
    return LayoutConfig(
        width=cfg.width * factor,
        height=cfg.height * factor,
        pad_x=cfg.pad_x * factor,
        pad_y=cfg.pad_y * factor,
        top_pad=cfg.top_pad * factor,
    )


def min_center_distance(centers: Dict[str, Tuple[float, float]]) -> float:
    values = list(centers.values())
    distances: List[float] = []
    for idx, (x1, y1) in enumerate(values):
        for x2, y2 in values[idx + 1 :]:
            distances.append(math.hypot(x2 - x1, y2 - y1))
    return min(distances, default=float('inf'))


def cluster_center_screen(cluster: Cluster, fit: Tuple[float, float, float, float, float]) -> Tuple[float, float]:
    min_x, min_y, scale, offset_x, offset_y = fit
    gx, gy = axial_to_pixel_flat(*cluster_world_to_axial(cluster.pos), 1.0)
    return offset_x + (gx - min_x) * scale, offset_y + ((-gy) - min_y) * scale


def compute_cluster_radius(centers: Dict[str, Tuple[float, float]]) -> float:
    distances: List[float] = []
    center_values = list(centers.values())
    for idx, (x1, y1) in enumerate(center_values):
        for x2, y2 in center_values[idx + 1 :]:
            distances.append(math.hypot(x2 - x1, y2 - y1))
    min_distance = min(distances, default=240.0)
    return max(82.0, min(126.0, min_distance / math.sqrt(3.0)))


def centered_local_positions(points: List[Tuple[str, Vec2]]) -> Dict[str, Vec2]:
    if not points:
        return {}
    avg = Vec2(
        sum(point.x for _, point in points) / len(points),
        sum(point.z for _, point in points) / len(points),
    )
    return {name: point - avg for name, point in points}


def cluster_sector_radius(cluster_radius: float, sector_count: int) -> float:
    if sector_count <= 1:
        return cluster_radius
    if sector_count in (2, 3):
        return cluster_radius * 0.5
    return cluster_radius * 0.36



def template_positions(sector_count: int, cluster_radius: float, variant: int = 0) -> Dict[str, Tuple[float, float]]:
    s = math.sqrt(3.0) / 4.0 * cluster_radius
    if sector_count == 2:
        templates = [
            {'upper': (-cluster_radius * 0.25, -s), 'lower': (cluster_radius * 0.25, s)},
            {'upper': (cluster_radius * 0.25, -s), 'lower': (-cluster_radius * 0.25, s)},
        ]
        return templates[variant % len(templates)]
    if sector_count == 3:
        templates = [
            {
                'left': (-cluster_radius * 0.5, 0.0),
                'center': (cluster_radius * 0.25, s),
                'upper_right': (cluster_radius * 0.25, -s),
            },
            {
                'upper_left': (-cluster_radius * 0.25, -s),
                'lower_left': (-cluster_radius * 0.25, s),
                'right': (cluster_radius * 0.5, 0.0),
            },
        ]
        return templates[variant % len(templates)]
    return {'single': (0.0, 0.0)}


def unit_vec(x: float, y: float) -> Tuple[float, float]:
    length = math.hypot(x, y)
    if length <= 1e-6:
        return (0.0, 0.0)
    return (x / length, y / length)



def best_slot_assignment(local_positions: Dict[str, Vec2], slots: Dict[str, Tuple[float, float]]) -> Dict[str, Tuple[float, float]]:
    centered = centered_local_positions(list(local_positions.items()))
    slot_items = list(slots.items())
    best_mapping: Optional[Dict[str, Tuple[float, float]]] = None
    best_score: Optional[float] = None

    actual_vectors = {
        name: unit_vec(pos.x, -pos.z)
        for name, pos in centered.items()
    }
    slot_vectors = {
        slot_name: unit_vec(slot_pos[0], slot_pos[1])
        for slot_name, slot_pos in slot_items
    }

    for perm in itertools.permutations(local_positions.keys(), len(slot_items)):
        score = 0.0
        mapping: Dict[str, Tuple[float, float]] = {}
        for (slot_name, slot_pos), sector_name in zip(slot_items, perm):
            ax, ay = actual_vectors[sector_name]
            sx, sy = slot_vectors[slot_name]
            score += (ax - sx) ** 2 + (ay - sy) ** 2
            mapping[sector_name] = slot_pos
        if best_score is None or score < best_score:
            best_score = score
            best_mapping = mapping

    return best_mapping or {}



def sector_roman_rank(name: str) -> Optional[int]:
    roman_map = {' I': 1, ' II': 2, ' III': 3, ' IV': 4, ' V': 5, ' VI': 6, ' VII': 7, ' VIII': 8, ' IX': 9, ' X': 10}
    for suffix, rank in sorted(roman_map.items(), key=lambda item: -len(item[0])):
        if name.endswith(suffix):
            return rank
    return None



def assign_template_slots(local_positions: Dict[str, Vec2], cluster_radius: float, sector_names: Dict[str, str]) -> Dict[str, Tuple[float, float]]:
    names = list(local_positions.keys())
    if len(names) == 1:
        return {names[0]: (0.0, 0.0)}

    if len(names) == 3:
        variants = [template_positions(3, cluster_radius, 0), template_positions(3, cluster_radius, 1)]
        best_mapping: Optional[Dict[str, Tuple[float, float]]] = None
        best_score: Optional[float] = None
        centered = centered_local_positions(list(local_positions.items()))
        actual_vectors = {name: unit_vec(pos.x, -pos.z) for name, pos in centered.items()}
        for slots in variants:
            mapping = best_slot_assignment(local_positions, slots)
            slot_vectors = {slot_name: unit_vec(slot_pos[0], slot_pos[1]) for slot_name, slot_pos in slots.items()}
            score = 0.0
            for sector_name, slot_pos in mapping.items():
                slot_name = next(name for name, pos in slots.items() if pos == slot_pos)
                ax, ay = actual_vectors[sector_name]
                sx, sy = slot_vectors[slot_name]
                score += (ax - sx) ** 2 + (ay - sy) ** 2
            if best_score is None or score < best_score:
                best_score = score
                best_mapping = mapping
        return best_mapping or {}

    if len(names) == 2:
        variants = [template_positions(2, cluster_radius, 0), template_positions(2, cluster_radius, 1)]
        best_mapping: Optional[Dict[str, Tuple[float, float]]] = None
        best_score: Optional[float] = None
        centered = centered_local_positions(list(local_positions.items()))
        actual_vectors = {name: unit_vec(pos.x, -pos.z) for name, pos in centered.items()}
        x_values = [pos.x for pos in centered.values()]
        x_span = max(x_values) - min(x_values) if x_values else 0.0
        for variant_index, slots in enumerate(variants):
            mapping = best_slot_assignment(local_positions, slots)
            slot_vectors = {slot_name: unit_vec(slot_pos[0], slot_pos[1]) for slot_name, slot_pos in slots.items()}
            score = 0.0
            for sector_name, slot_pos in mapping.items():
                slot_name = next(name for name, pos in slots.items() if pos == slot_pos)
                ax, ay = actual_vectors[sector_name]
                sx, sy = slot_vectors[slot_name]
                score += (ax - sx) ** 2 + (ay - sy) ** 2
            if x_span <= 1e-6:
                score += 0.0 if variant_index == 1 else 1e-3
            if best_score is None or score < best_score:
                best_score = score
                best_mapping = mapping
        return best_mapping or {}

    return {name: pos for name, pos in zip(names, template_positions(len(names), cluster_radius).values())}



def sector_centers_for_cluster(
    cluster_macro: str,
    sectors: Dict[str, Sector],
    cluster_centers: Dict[str, Tuple[float, float]],
    cluster_radius: float,
) -> Tuple[Dict[str, Tuple[float, float]], Dict[str, float]]:
    sector_list = [sector for sector in sectors.values() if sector.cluster_macro == cluster_macro]
    cluster_cx, cluster_cy = cluster_centers[cluster_macro]
    if not sector_list:
        return {}, {}

    sector_radius = cluster_sector_radius(cluster_radius, len(sector_list))
    if len(sector_list) == 1:
        return {sector_list[0].macro: (cluster_cx, cluster_cy)}, {sector_list[0].macro: sector_radius}

    local_positions = {sector.macro: sector.local_pos for sector in sector_list}
    snapped = assign_template_slots(local_positions, cluster_radius, {sector.macro: sector.name for sector in sector_list})
    centers = {
        sector.macro: (cluster_cx + snapped[sector.macro][0], cluster_cy + snapped[sector.macro][1])
        for sector in sector_list
    }
    radii = {sector.macro: sector_radius for sector in sector_list}
    return centers, radii


def highway_stub_segments(
    highways: List[Highway],
    zone_anchors: Dict[str, Tuple[float, float]],
    sector_centers: Dict[str, Tuple[float, float]],
) -> Dict[str, List[Tuple[Tuple[float, float], Tuple[float, float]]]]:
    segments: Dict[str, List[Tuple[Tuple[float, float], Tuple[float, float]]]] = {}
    grouped: Dict[Tuple[str, str], List[Highway]] = {}
    for highway in highways:
        left = zone_anchors.get(highway.zone_a_macro)
        right = zone_anchors.get(highway.zone_b_macro)
        if left is None or right is None:
            continue
        key = tuple(sorted((highway.sector_a_macro, highway.sector_b_macro)))
        grouped.setdefault(key, []).append(highway)

    for _, group in grouped.items():
        count = len(group)
        for index, highway in enumerate(group):
            left = zone_anchors.get(highway.zone_a_macro)
            right = zone_anchors.get(highway.zone_b_macro)
            sector_a = sector_centers.get(highway.sector_a_macro)
            sector_b = sector_centers.get(highway.sector_b_macro)
            if left is None or right is None or sector_a is None or sector_b is None:
                continue
            dx = sector_b[0] - sector_a[0]
            dy = sector_b[1] - sector_a[1]
            length = math.hypot(dx, dy)
            if length <= 1e-6:
                continue
            ux = dx / length
            uy = dy / length
            nx = -dy / length
            ny = dx / length
            lane_offset = (index - (count - 1) / 2.0) * 6.0
            seam = ((sector_a[0] + sector_b[0]) / 2.0 + nx * lane_offset, (sector_a[1] + sector_b[1]) / 2.0 + ny * lane_offset)
            left_start = (left[0] + nx * lane_offset, left[1] + ny * lane_offset)
            right_start = (right[0] + nx * lane_offset, right[1] + ny * lane_offset)
            segments[highway.id] = [(left_start, seam), (right_start, seam)]
    return segments


def hex_boundary_distance(radius: float, dx: float, dy: float) -> float:
    direction_len = math.hypot(dx, dy)
    if direction_len <= 1e-6:
        return 0.0
    vertices = [
        (
            radius * math.cos(math.radians(60 * index)),
            radius * math.sin(math.radians(60 * index)),
        )
        for index in range(6)
    ]
    best_t: Optional[float] = None
    for index in range(6):
        x1, y1 = vertices[index]
        x2, y2 = vertices[(index + 1) % 6]
        sx = x2 - x1
        sy = y2 - y1
        det = dx * sy - dy * sx
        if abs(det) <= 1e-9:
            continue
        rx = x1
        ry = y1
        t = (rx * sy - ry * sx) / det
        u = (rx * dy - ry * dx) / det
        if t >= 0.0 and 0.0 <= u <= 1.0:
            if best_t is None or t < best_t:
                best_t = t
    return best_t if best_t is not None else 0.0



def project_sector_local_points(
    sector_points: Dict[str, List[Tuple[str, Vec2]]],
    sector_centers: Dict[str, Tuple[float, float]],
    sector_radii: Dict[str, float],
    extent_ratio: float = 0.80,
) -> Dict[str, Tuple[float, float]]:
    anchors: Dict[str, Tuple[float, float]] = {}
    for sector_macro, points in sector_points.items():
        if sector_macro not in sector_centers or not points:
            continue
        radius = sector_radii.get(sector_macro, 24.0)
        max_extent = max((math.hypot(point.x, point.z) for _, point in points), default=1.0)
        extent = radius * (math.sqrt(3.0) / 2.0) * extent_ratio
        scale = extent / max(1.0, max_extent)
        cx, cy = sector_centers[sector_macro]
        for point_id, point in points:
            anchors[point_id] = (cx + point.x * scale, cy - point.z * scale)
    return anchors



def sector_anchor_positions(
    zones: Dict[str, Zone],
    gates_by_sector: Dict[str, List[Gate]],
    highways: List[Highway],
    local_highways: List[LocalSectorHighway],
    sector_centers: Dict[str, Tuple[float, float]],
    sector_radii: Dict[str, float],
) -> Tuple[Dict[str, Tuple[float, float]], Dict[str, Tuple[float, float]], Dict[str, Tuple[float, float]]]:
    sector_points: Dict[str, List[Tuple[str, Vec2]]] = {}

    for sector_macro, sector_gates in gates_by_sector.items():
        for gate in sector_gates:
            zone = zones.get(gate.zone_macro)
            if zone is None or not is_display_zone(zone):
                continue
            sector_points.setdefault(sector_macro, []).append((gate.id, zone.local_pos + gate.local_pos))

    seen_zones: set[str] = set()
    for highway in highways:
        for zone_macro in (highway.zone_a_macro, highway.zone_b_macro):
            if zone_macro in seen_zones:
                continue
            zone = zones.get(zone_macro)
            if zone is None:
                continue
            sector_points.setdefault(zone.sector_macro, []).append((zone_macro, zone.local_pos))
            seen_zones.add(zone_macro)

    for local_highway in local_highways:
        zone_a = zones.get(local_highway.zone_a_macro)
        zone_b = zones.get(local_highway.zone_b_macro)
        if zone_a is None or zone_b is None:
            continue
        sector_points.setdefault(local_highway.sector_macro, []).append((local_highway.endpoint_a_id, zone_a.local_pos + local_highway.local_a_pos))
        sector_points.setdefault(local_highway.sector_macro, []).append((local_highway.endpoint_b_id, zone_b.local_pos + local_highway.local_b_pos))

    anchors = project_sector_local_points(sector_points, sector_centers, sector_radii)
    gate_anchors = {anchor_id: pos for anchor_id, pos in anchors.items() if ':' in anchor_id and 'Highway' not in anchor_id}
    zone_anchors = {anchor_id: pos for anchor_id, pos in anchors.items() if anchor_id in zones}
    local_highway_anchors = {anchor_id: pos for anchor_id, pos in anchors.items() if 'Highway' in anchor_id}
    return gate_anchors, zone_anchors, local_highway_anchors

def highway_pairs_for_region(highways: List[Highway], region_sector_macros: set[str]) -> List[Highway]:
    return [
        highway
        for highway in highways
        if highway.sector_a_macro in region_sector_macros and highway.sector_b_macro in region_sector_macros
    ]


def paired_cluster_edges(region_sector_macros: set[str], gates_by_sector: Dict[str, List[Gate]]) -> List[Tuple[Gate, Gate]]:
    gate_index = {
        gate.id: gate
        for sector_macro in region_sector_macros
        for gate in gates_by_sector.get(sector_macro, [])
    }
    gates_flat = list(gate_index.values())
    used: set[str] = set()
    pairs: List[Tuple[Gate, Gate]] = []
    for gate in gates_flat:
        if gate.id in used or gate.cluster_id is None or gate.target_cluster_id is None:
            continue
        reverse = next(
            (
                candidate
                for candidate in gates_flat
                if candidate.cluster_id == gate.target_cluster_id
                and candidate.target_cluster_id == gate.cluster_id
                and candidate.id not in used
            ),
            None,
        )
        if reverse is None:
            continue
        pairs.append((gate, reverse))
        used.add(gate.id)
        used.add(reverse.id)
    return pairs


def render_region(input_path: str, output: str, include_all: bool = False) -> Dict[str, Tuple[float, float]]:
    clusters, sectors, zones, gates_by_sector, highways, local_highways = load_map_json(input_path)
    region_macros = select_region_clusters(clusters, include_all=include_all)
    region_clusters = {macro: clusters[macro] for macro in region_macros}
    region_sector_macros = {sector.macro for sector in sectors.values() if sector.cluster_macro in region_clusters}
    cfg = layout_config(include_all=include_all)
    fit = fit_world_to_screen([cluster.pos for cluster in region_clusters.values()], cfg)
    cluster_centers = {macro: cluster_center_screen(cluster, fit) for macro, cluster in region_clusters.items()}
    if include_all:
        min_distance = min_center_distance(cluster_centers)
        cluster_radius = compute_cluster_radius(cluster_centers)
        required_distance = math.sqrt(3.0) * cluster_radius
        if min_distance < required_distance:
            cfg = scaled_layout_config(cfg, required_distance / min_distance)
            fit = fit_world_to_screen([cluster.pos for cluster in region_clusters.values()], cfg)
            cluster_centers = {macro: cluster_center_screen(cluster, fit) for macro, cluster in region_clusters.items()}
    cluster_radius = compute_cluster_radius(cluster_centers)
    sector_centers: Dict[str, Tuple[float, float]] = {}
    sector_radii: Dict[str, float] = {}
    for cluster_macro in region_macros:
        centers, radii = sector_centers_for_cluster(cluster_macro, sectors, cluster_centers, cluster_radius)
        sector_centers.update(centers)
        sector_radii.update(radii)

    edge_pairs = paired_cluster_edges(region_sector_macros, gates_by_sector)
    highway_pairs = highway_pairs_for_region(highways, region_sector_macros)
    gate_anchors, zone_anchors, local_highway_anchors = sector_anchor_positions(zones, gates_by_sector, highway_pairs, local_highways, sector_centers, sector_radii)
    highway_segments = highway_stub_segments(highway_pairs, zone_anchors, sector_centers)

    os.makedirs(os.path.dirname(output), exist_ok=True)
    with open(output, "w", encoding="utf-8") as f:
        f.write(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{int(cfg.width)}" height="{int(cfg.height)}" viewBox="0 0 {cfg.width:.1f} {cfg.height:.1f}">\n'
            f'  <rect width="100%" height="100%" fill="#050505" />\n'
            f'  <text x="28" y="40" font-size="24" font-family="Consolas, \'Courier New\', monospace" fill="#e5e7eb">Cluster Region Trial from map.json</text>\n'
            f'  <text x="28" y="66" font-size="13" font-family="Consolas, \'Courier New\', monospace" fill="#94a3b8">Cluster positions come from cluster offsets in map.json; sector stitching comes from sector offsets inside each cluster.</text>\n'
        )
        for left_gate, right_gate in edge_pairs:
            left = gate_anchors.get(left_gate.id)
            right = gate_anchors.get(right_gate.id)
            if left is None or right is None:
                continue
            f.write(
                f'  <line x1="{left[0]:.1f}" y1="{left[1]:.1f}" x2="{right[0]:.1f}" y2="{right[1]:.1f}" stroke="#e5e7eb" stroke-width="0.6" stroke-opacity="0.85" />\n'
            )

        for highway in highway_pairs:
            segments = highway_segments.get(highway.id)
            if not segments:
                continue
            for start, end in segments:
                f.write(
                    f'  <line x1="{start[0]:.1f}" y1="{start[1]:.1f}" x2="{end[0]:.1f}" y2="{end[1]:.1f}" stroke="#1d4ed8" stroke-width="0.4" stroke-opacity="0.95" />\n'
                )
                f.write(
                    f'  <circle cx="{start[0]:.1f}" cy="{start[1]:.1f}" r="0.7" fill="#1d4ed8" fill-opacity="0.95" stroke="#dbeafe" stroke-width="0.4" />\n'
                )

        for local_highway in local_highways:
            if local_highway.sector_macro not in region_sector_macros:
                continue
            left = local_highway_anchors.get(local_highway.endpoint_a_id)
            right = local_highway_anchors.get(local_highway.endpoint_b_id)
            if left is None or right is None:
                continue
            f.write(
                f'  <line x1="{left[0]:.1f}" y1="{left[1]:.1f}" x2="{right[0]:.1f}" y2="{right[1]:.1f}" stroke="#38bdf8" stroke-width="0.35" stroke-opacity="0.8" />\n'
            )

        for cluster_macro in region_macros:
            cluster = clusters[cluster_macro]
            cx, cy = cluster_centers[cluster_macro]
            color = owner_color(cluster.owner)
            cluster_sectors = [sector for sector in sectors.values() if sector.cluster_macro == cluster_macro]
            if len(cluster_sectors) == 1:
                sector = cluster_sectors[0]
                radius = sector_radii[sector.macro]
                f.write(
                    f'  <polygon points="{hex_points(cx, cy, radius)}" fill="{color}" fill-opacity="0.08" stroke="{color}" stroke-width="2.8" stroke-opacity="0.95" />\n'
                )
                f.write(
                    f'  <text x="{cx:.1f}" y="{cy - radius * 0.72:.1f}" text-anchor="middle" font-size="14" font-family="Consolas, \'Courier New\', monospace" fill="#f8fafc">{sector.name}</text>\n'
                )
                continue

            f.write(
                f'  <polygon points="{hex_points(cx, cy, cluster_radius)}" fill="none" stroke="{color}" stroke-width="2.8" stroke-opacity="0.95" />\n'
            )
            for sector in cluster_sectors:
                sx, sy = sector_centers[sector.macro]
                radius = sector_radii[sector.macro]
                f.write(
                    f'  <polygon points="{hex_points(sx, sy, radius)}" fill="{color}" fill-opacity="0.10" stroke="{color}" stroke-width="2.1" stroke-opacity="0.95" />\n'
                )
                f.write(
                    f'  <text x="{sx:.1f}" y="{sy - radius * 0.72:.1f}" text-anchor="middle" font-size="12" font-family="Consolas, \'Courier New\', monospace" fill="#f8fafc">{sector.name}</text>\n'
                )

        for sector_macro in region_sector_macros:
            sector = sectors[sector_macro]
            cluster = clusters[sector.cluster_macro]
            for gate in gates_by_sector.get(sector_macro, []):
                anchor = gate_anchors.get(gate.id)
                if anchor is None:
                    continue
                radius = 1.1 if len([s for s in sectors.values() if s.cluster_macro == sector.cluster_macro]) == 1 else 0.8
                f.write(
                    f'  <circle cx="{anchor[0]:.1f}" cy="{anchor[1]:.1f}" r="{radius:.1f}" fill="{owner_color(cluster.owner)}" stroke="#ffffff" stroke-width="0.3" />\n'
                )

        f.write("</svg>\n")

    return cluster_centers


def main() -> None:
    parser = argparse.ArgumentParser(description="Render a cluster-first region sample from src/assets/map.json.")
    parser.add_argument("--input", default=os.path.join("src", "assets", "map.json"))
    parser.add_argument("--output", default=os.path.join("docs", "x4_cluster_region_trial.svg"))
    parser.add_argument("--all", action="store_true", help="Render all clusters in map.json instead of the trial region.")
    args = parser.parse_args()

    centers = render_region(args.input, args.output, include_all=args.all)
    print(f"Output: {args.output}")
    for macro, (x, y) in centers.items():
        print(f"{macro} {x:.1f} {y:.1f}")


if __name__ == "__main__":
    main()
