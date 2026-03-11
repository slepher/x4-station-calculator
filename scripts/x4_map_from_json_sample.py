import argparse
import json
import math
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


GATE_LINK_RE = re.compile(r"connection_ClusterGate(\d+)To(\d+)", re.IGNORECASE)
CLUSTER_ID_RE = re.compile(r"Cluster_(\d+)_", re.IGNORECASE)
SECTOR_GRID_SIZE = 88.0
CLUSTER_SPACING = 2


@dataclass
class Vec2:
    x: float
    z: float

    def __add__(self, other: "Vec2") -> "Vec2":
        return Vec2(self.x + other.x, self.z + other.z)


@dataclass
class Cluster:
    macro: str
    name: str
    pos: Vec2


@dataclass
class Sector:
    macro: str
    name: str
    cluster_macro: str
    cluster_id: Optional[int]
    local_pos: Vec2
    world_pos: Vec2


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


def cube_round(qf: float, rf: float) -> Tuple[int, int]:
    xf = qf
    zf = rf
    yf = -xf - zf
    rx = round(xf)
    ry = round(yf)
    rz = round(zf)
    x_diff = abs(rx - xf)
    y_diff = abs(ry - yf)
    z_diff = abs(rz - zf)
    if x_diff > y_diff and x_diff > z_diff:
        rx = -ry - rz
    elif y_diff > z_diff:
        ry = -rx - rz
    else:
        rz = -rx - ry
    return int(rx), int(rz)


def hex_points(cx: float, cy: float, radius: float) -> str:
    points: List[str] = []
    for index in range(6):
        angle = math.radians(60 * index - 30)
        px = cx + radius * math.cos(angle)
        py = cy + radius * math.sin(angle)
        points.append(f"{px:.1f},{py:.1f}")
    return " ".join(points)


def load_map_json(path: str) -> Tuple[Dict[str, Cluster], Dict[str, Sector], Dict[str, Zone], Dict[str, List[Gate]]]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    clusters_raw = raw["data"] if isinstance(raw, dict) and "data" in raw else raw

    clusters: Dict[str, Cluster] = {}
    sectors: Dict[str, Sector] = {}
    zones: Dict[str, Zone] = {}
    gates_by_sector: Dict[str, List[Gate]] = {}

    for cluster_node in clusters_raw:
        cluster_macro = (cluster_node.get("macro") or {}).get("ref") or cluster_node.get("name")
        cluster_name = ((cluster_node.get("qsnaAttributes") or {}).get("name")) or cluster_macro
        cluster_pos = pos_from(cluster_node)
        clusters[cluster_macro] = Cluster(cluster_macro, cluster_name, cluster_pos)

        for sector_node in cluster_node.get("sectors", []):
            sector_macro = (sector_node.get("macro") or {}).get("ref") or sector_node.get("name")
            sector_name = ((sector_node.get("qsnaAttributes") or {}).get("name")) or sector_macro
            sector_local = pos_from(sector_node)
            cluster_id = cluster_id_from_macro(cluster_macro)
            sector_world = cluster_pos + sector_local
            sectors[sector_macro] = Sector(
                macro=sector_macro,
                name=sector_name,
                cluster_macro=cluster_macro,
                cluster_id=cluster_id,
                local_pos=sector_local,
                world_pos=sector_world,
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
                    if not match:
                        continue
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

    return clusters, sectors, zones, gates_by_sector


def is_display_zone(zone: Zone) -> bool:
    name = zone.macro.lower()
    raw_name = zone.name.lower()
    return not (name.startswith("tzone") or raw_name.startswith("tzone"))


def nearest_hex_direction(dx: float, dz: float) -> Tuple[int, int]:
    # Use quadrants first so neighboring clusters land in the same broad positions as the game map.
    if abs(dx) < 1e-6 and abs(dz) < 1e-6:
        return (1, 0)
    if dx >= 0 and dz >= 0:
        return (1, -1)
    if dx >= 0 and dz < 0:
        return (0, 1)
    if dx < 0 and dz >= 0:
        return (0, -1)
    return (-1, 1)


def gate_vector_between_clusters(
    source_cluster: str,
    target_cluster: str,
    sectors: Dict[str, Sector],
    zones: Dict[str, Zone],
    gates_by_sector: Dict[str, List[Gate]],
) -> Optional[Vec2]:
    source_cluster_id = cluster_id_from_macro(source_cluster)
    target_cluster_id = cluster_id_from_macro(target_cluster)
    if source_cluster_id is None or target_cluster_id is None:
        return None

    samples: List[Vec2] = []
    for sector_name, sector in sectors.items():
        if sector.cluster_macro != source_cluster:
            continue
        for gate in gates_by_sector.get(sector_name, []):
            if gate.target_cluster_id != target_cluster_id:
                continue
            zone = zones.get(gate.zone_macro)
            if zone is None:
                continue
            samples.append(Vec2(sector.local_pos.x + zone.local_pos.x, sector.local_pos.z + zone.local_pos.z))

    if samples:
        return Vec2(sum(v.x for v in samples) / len(samples), sum(v.z for v in samples) / len(samples))

    reverse_samples: List[Vec2] = []
    for sector_name, sector in sectors.items():
        if sector.cluster_macro != target_cluster:
            continue
        for gate in gates_by_sector.get(sector_name, []):
            if gate.target_cluster_id != source_cluster_id:
                continue
            zone = zones.get(gate.zone_macro)
            if zone is None:
                continue
            reverse_samples.append(Vec2(sector.local_pos.x + zone.local_pos.x, sector.local_pos.z + zone.local_pos.z))
    if reverse_samples:
        avg = Vec2(sum(v.x for v in reverse_samples) / len(reverse_samples), sum(v.z for v in reverse_samples) / len(reverse_samples))
        return Vec2(-avg.x, -avg.z)
    return None


def build_sector_grid(
    sectors: Dict[str, Sector],
    sector_names: List[str],
    zones: Dict[str, Zone],
    gates_by_sector: Dict[str, List[Gate]],
    focus_cluster: int,
) -> Dict[str, Tuple[float, float]]:
    sample_cluster_names = sorted({sectors[name].cluster_macro for name in sector_names if name in sectors})
    focus_cluster_macro = next((cluster for cluster in sample_cluster_names if cluster_id_from_macro(cluster) == focus_cluster), None)

    cluster_cells: Dict[str, Tuple[int, int]] = {}
    occupied: set[Tuple[int, int]] = set()
    if focus_cluster_macro is not None:
        cluster_cells[focus_cluster_macro] = (0, 0)
        occupied.add((0, 0))

    for cluster_name in sample_cluster_names:
        if cluster_name in cluster_cells:
            continue
        desired = None
        if focus_cluster_macro is not None:
            vector = gate_vector_between_clusters(focus_cluster_macro, cluster_name, sectors, zones, gates_by_sector)
            if vector is not None:
                dq, dr = nearest_hex_direction(vector.x, vector.z)
                desired = (dq * CLUSTER_SPACING, dr * CLUSTER_SPACING)

        if desired is None:
            idx = len(cluster_cells)
            fallback_slots = [(3, 0), (3, -3), (0, -3), (-3, 0), (-3, 3), (0, 3), (6, 0), (6, -6)]
            desired = fallback_slots[idx] if idx < len(fallback_slots) else (idx * CLUSTER_SPACING, 0)

        if desired in occupied:
            dq, dr = desired
            direction = (0 if dq == 0 else int(dq / abs(dq)), 0 if dr == 0 else int(dr / abs(dr)))
            for step in range(2, 6):
                candidate = (direction[0] * CLUSTER_SPACING * step, direction[1] * CLUSTER_SPACING * step)
                if candidate not in occupied:
                    desired = candidate
                    break

        occupied.add(desired)
        cluster_cells[cluster_name] = desired

    local_slots = [(0, 0), (1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)]
    sector_grid: Dict[str, Tuple[float, float]] = {}
    grid_size = SECTOR_GRID_SIZE
    for cluster_name in sample_cluster_names:
        cluster_sector_names = [name for name in sector_names if sectors[name].cluster_macro == cluster_name]
        cluster_anchor = cluster_cells[cluster_name]
        cluster_sample_sector = next(name for name in sector_names if sectors[name].cluster_macro == cluster_name)
        cluster_origin = sectors[cluster_sample_sector].world_pos
        ordered = sorted(
            cluster_sector_names,
            key=lambda name: math.atan2(sectors[name].world_pos.z - cluster_origin.z, sectors[name].world_pos.x - cluster_origin.x),
        )
        for idx, sector_name in enumerate(ordered):
            dq, dr = local_slots[idx] if idx < len(local_slots) else (idx, 0)
            px, py = axial_to_pixel(cluster_anchor[0] + dq, cluster_anchor[1] + dr, grid_size)
            sector_grid[sector_name] = (px, py)
    return sector_grid


def render_sample(clusters: Dict[str, Cluster], sectors: Dict[str, Sector], zones: Dict[str, Zone], gates_by_sector: Dict[str, List[Gate]], focus_cluster: int, output: str) -> None:
    sector_names = [name for name, sector in sectors.items() if sector.cluster_id == focus_cluster or any(g.target_cluster_id == focus_cluster for g in gates_by_sector.get(name, []))]
    sector_names = sorted(set(sector_names))
    sector_grid = build_sector_grid(sectors, sector_names, zones, gates_by_sector, focus_cluster)

    width = 1700.0
    height = 1200.0
    pad = 80.0
    min_px = min((x for x, _ in sector_grid.values()), default=0.0)
    max_px = max((x for x, _ in sector_grid.values()), default=1.0)
    min_py = min((y for _, y in sector_grid.values()), default=0.0)
    max_py = max((y for _, y in sector_grid.values()), default=1.0)

    available_width = width - pad * 2
    available_height = height - pad * 2 - 120
    grid_width = max(max_px - min_px, 1.0)
    grid_height = max(max_py - min_py, 1.0)
    layout_scale = min(available_width / grid_width, available_height / grid_height)
    offset_x = pad + (available_width - grid_width * layout_scale) / 2.0
    offset_y = pad + 90 + (available_height - grid_height * layout_scale) / 2.0

    def place_sector(name: str) -> Tuple[float, float]:
        x, y = sector_grid[name]
        return offset_x + (x - min_px) * layout_scale, offset_y + (y - min_py) * layout_scale

    colors = ["#0f766e", "#1d4ed8", "#b45309", "#be123c", "#7c3aed", "#15803d", "#0f172a", "#4338ca"]

    def cluster_color(cluster_id: Optional[int]) -> str:
        if cluster_id is None:
            return "#475569"
        return colors[cluster_id % len(colors)]

    sector_radius = SECTOR_GRID_SIZE * layout_scale * 0.84
    zone_centers: Dict[str, Tuple[float, float]] = {}
    sector_center_px: Dict[str, Tuple[float, float]] = {name: place_sector(name) for name in sector_names}

    for sector_name in sector_names:
        sector_zones = [zone for zone in zones.values() if zone.sector_macro == sector_name and is_display_zone(zone)]
        cx, cy = sector_center_px[sector_name]
        if not sector_zones:
            continue
        max_offset = max((math.hypot(zone.local_pos.x, zone.local_pos.z) for zone in sector_zones), default=1.0)
        inner = sector_radius * 0.72
        for zone in sector_zones:
            dx = (zone.local_pos.x / max(1.0, max_offset)) * inner
            dy = -(zone.local_pos.z / max(1.0, max_offset)) * inner
            zone_centers[zone.macro] = (cx + dx, cy + dy)

    paired_edges: List[Tuple[str, str]] = []
    gate_index = {gate.id: gate for sector_name in sector_names for gate in gates_by_sector.get(sector_name, [])}
    gates_flat = list(gate_index.values())
    used: set[str] = set()
    for gate in gates_flat:
        if gate.id in used or gate.cluster_id is None or gate.target_cluster_id is None:
            continue
        reverse = next((candidate for candidate in gates_flat if candidate.cluster_id == gate.target_cluster_id and candidate.target_cluster_id == gate.cluster_id and candidate.id not in used), None)
        if reverse is None:
            continue
        if gate.zone_macro in zone_centers and reverse.zone_macro in zone_centers:
            paired_edges.append((gate.zone_macro, reverse.zone_macro))
        used.add(gate.id)
        used.add(reverse.id)

    os.makedirs(os.path.dirname(output), exist_ok=True)
    with open(output, "w", encoding="utf-8") as f:
        f.write(f"""<svg xmlns="http://www.w3.org/2000/svg" width="{int(width)}" height="{int(height)}" viewBox="0 0 {width:.1f} {height:.1f}">
  <rect width="100%" height="100%" fill="#f8fafc" />
  <text x="32" y="42" font-size="28" font-family="Consolas, 'Courier New', monospace" fill="#0f172a">Map.json Sector Sample around Cluster {focus_cluster:02d}</text>
  <text x="32" y="72" font-size="15" font-family="Consolas, 'Courier New', monospace" fill="#475569">Driven directly from src/assets/map.json. Sector is the main node, zones are rendered as gate points, and matching gates are linked between zones.</text>
""")
        for left_id, right_id in paired_edges:
            if left_id not in zone_centers or right_id not in zone_centers:
                continue
            x1, y1 = zone_centers[left_id]
            x2, y2 = zone_centers[right_id]
            f.write(f'  <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#7dd3fc" stroke-width="2.4" stroke-dasharray="10 7"/>\n')

        for sector_name in sector_names:
            sector = sectors[sector_name]
            cx, cy = sector_center_px[sector_name]
            fill = cluster_color(sector.cluster_id)
            f.write(f'  <polygon points="{hex_points(cx, cy, sector_radius)}" fill="{fill}" fill-opacity="0.10" stroke="{fill}" stroke-width="2.6" stroke-opacity="0.75"/>\n')
            f.write(f'  <text x="{cx:.1f}" y="{cy - 16:.1f}" text-anchor="middle" font-size="14" font-family="Consolas, \'Courier New\', monospace" fill="#334155">{sector.name}</text>\n')

        for zone_macro, (cx, cy) in zone_centers.items():
            sector = sectors[zones[zone_macro].sector_macro]
            fill = cluster_color(sector.cluster_id)
            f.write(f'  <circle cx="{cx:.1f}" cy="{cy:.1f}" r="5.2" fill="{fill}" stroke="#ffffff" stroke-width="1.5"/>\n')
        f.write("</svg>\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Render a map sample directly from src/assets/map.json.")
    parser.add_argument("--input", default=os.path.join("src", "assets", "map.json"))
    parser.add_argument("--focus-cluster", type=int, default=1)
    parser.add_argument("--output", default=os.path.join("docs", "x4_map_json_cluster_01.svg"))
    args = parser.parse_args()

    clusters, sectors, zones, gates_by_sector = load_map_json(args.input)
    render_sample(clusters, sectors, zones, gates_by_sector, args.focus_cluster, args.output)
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
