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


def build_sector_grid(sectors: Dict[str, Sector], sector_names: List[str]) -> Dict[str, Tuple[float, float]]:
    sample_cluster_names = sorted({sectors[name].cluster_macro for name in sector_names if name in sectors})
    cluster_positions = [sectors[next(name for name in sector_names if sectors[name].cluster_macro == cluster)].world_pos for cluster in sample_cluster_names]
    min_x = min((p.x for p in cluster_positions), default=0.0)
    max_x = max((p.x for p in cluster_positions), default=1.0)
    min_z = min((p.z for p in cluster_positions), default=0.0)
    max_z = max((p.z for p in cluster_positions), default=1.0)

    coarse_step = 4
    cluster_cells: Dict[str, Tuple[int, int]] = {}
    occupied: set[Tuple[int, int]] = set()
    for cluster_name in sample_cluster_names:
        cluster_sample_sector = next(name for name in sector_names if sectors[name].cluster_macro == cluster_name)
        cluster_pos = sectors[cluster_sample_sector].world_pos
        qf = ((cluster_pos.x - min_x) / max(1.0, max_x - min_x)) * 10.0 - 5.0
        rf = ((cluster_pos.z - min_z) / max(1.0, max_z - min_z)) * 8.0 - 4.0
        base_q, base_r = cube_round(qf, rf)
        candidates = [
            (base_q * coarse_step, base_r * coarse_step),
            ((base_q + 1) * coarse_step, base_r * coarse_step),
            ((base_q - 1) * coarse_step, base_r * coarse_step),
            (base_q * coarse_step, (base_r + 1) * coarse_step),
            (base_q * coarse_step, (base_r - 1) * coarse_step),
        ]
        chosen = next((cell for cell in candidates if cell not in occupied), candidates[0])
        occupied.add(chosen)
        cluster_cells[cluster_name] = chosen

    local_slots = [(0, 0), (1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)]
    sector_grid: Dict[str, Tuple[float, float]] = {}
    grid_size = 88.0
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
    sector_grid = build_sector_grid(sectors, sector_names)

    width = 1700.0
    height = 1200.0
    pad = 80.0
    min_px = min((x for x, _ in sector_grid.values()), default=0.0)
    max_px = max((x for x, _ in sector_grid.values()), default=1.0)
    min_py = min((y for _, y in sector_grid.values()), default=0.0)
    max_py = max((y for _, y in sector_grid.values()), default=1.0)

    def place_sector(name: str) -> Tuple[float, float]:
        x, y = sector_grid[name]
        nx = 0.5 if max_px == min_px else (x - min_px) / (max_px - min_px)
        ny = 0.5 if max_py == min_py else (y - min_py) / (max_py - min_py)
        return pad + nx * (width - pad * 2), pad + 90 + ny * (height - pad * 2 - 120)

    colors = ["#0f766e", "#1d4ed8", "#b45309", "#be123c", "#7c3aed", "#15803d", "#0f172a", "#4338ca"]

    def cluster_color(cluster_id: Optional[int]) -> str:
        if cluster_id is None:
            return "#475569"
        return colors[cluster_id % len(colors)]

    sector_radius = 70.0
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
            r = zone_radius[zone_macro]
            f.write(f'  <polygon points="{hex_points(cx, cy, r)}" fill="{fill}" fill-opacity="0.18" stroke="{fill}" stroke-width="1.5" stroke-opacity="0.55"/>\n')

        for gate in gates_flat:
            if gate.id not in gate_draw_pos:
                continue
            x, y = gate_draw_pos[gate.id]
            fill = cluster_color(gate.cluster_id)
            f.write(f'  <circle cx="{x:.1f}" cy="{y:.1f}" r="5.2" fill="{fill}" stroke="#ffffff" stroke-width="1.5"/>\n')
            f.write(f'  <text x="{x + 7:.1f}" y="{y + 3:.1f}" font-size="8.8" font-family="Consolas, \'Courier New\', monospace" fill="#1e293b">C{gate.cluster_id:03d}→C{gate.target_cluster_id:03d}</text>\n')
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
