import argparse
import math
import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple


GATE_LINK_RE = re.compile(r"connection_ClusterGate(\d+)To(\d+)", re.IGNORECASE)
CLUSTER_NAME_RE = re.compile(r"Cluster_(\d+)_macro", re.IGNORECASE)


@dataclass
class Vec2:
    x: float
    z: float

    def __add__(self, other: "Vec2") -> "Vec2":
        return Vec2(self.x + other.x, self.z + other.z)


@dataclass
class SectorPlacement:
    cluster_macro: str
    cluster_id: Optional[int]
    offset: Vec2


@dataclass
class ZonePlacement:
    sector_macro: str
    cluster_macro: str
    cluster_id: Optional[int]
    offset: Vec2


@dataclass
class GateRecord:
    gate_id: str
    gate_name: str
    zone_macro: str
    sector_macro: str
    cluster_macro: str
    source_cluster_id: Optional[int]
    target_cluster_id: int
    position: Vec2


@dataclass
class Bounds2:
    min_x: float
    max_x: float
    min_z: float
    max_z: float


def vec_distance(a: Vec2, b: Vec2) -> float:
    return math.hypot(a.x - b.x, a.z - b.z)


def hex_points(cx: float, cy: float, radius: float) -> str:
    points: List[str] = []
    for index in range(6):
        angle = math.radians(60 * index - 30)
        px = cx + radius * math.cos(angle)
        py = cy + radius * math.sin(angle)
        points.append(f"{px:.1f},{py:.1f}")
    return " ".join(points)


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def collect_bounds(positions: List[Vec2]) -> Bounds2:
    return Bounds2(
        min_x=min(p.x for p in positions),
        max_x=max(p.x for p in positions),
        min_z=min(p.z for p in positions),
        max_z=max(p.z for p in positions),
    )


def project_into_bounds(pos: Vec2, bounds: Bounds2, left: float, top: float, width: float, height: float, padding: float = 0.0) -> Tuple[float, float]:
    usable_w = max(1.0, width - padding * 2)
    usable_h = max(1.0, height - padding * 2)
    span_x = max(1.0, bounds.max_x - bounds.min_x)
    span_z = max(1.0, bounds.max_z - bounds.min_z)
    x = left + padding + ((pos.x - bounds.min_x) / span_x) * usable_w
    y = top + padding + (1.0 - ((pos.z - bounds.min_z) / span_z)) * usable_h
    return x, y


def hex_grid_offset(index: int, radius: float) -> Tuple[float, float]:
    if index == 0:
        return 0.0, 0.0
    ring = [
        (0.0, -radius * 1.1),
        (radius * 0.95, -radius * 0.55),
        (radius * 0.95, radius * 0.55),
        (0.0, radius * 1.1),
        (-radius * 0.95, radius * 0.55),
        (-radius * 0.95, -radius * 0.55),
    ]
    if index - 1 < len(ring):
        return ring[index - 1]
    extra = index - 1 - len(ring)
    angle = math.radians(extra * 45)
    return math.cos(angle) * radius * 1.75, math.sin(angle) * radius * 1.75


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


def parse_position(connection: ET.Element) -> Vec2:
    pos = connection.find("./offset/position")
    if pos is None:
        return Vec2(0.0, 0.0)
    return Vec2(float(pos.get("x", "0")), float(pos.get("z", "0")))


def parse_cluster_id(name: str) -> Optional[int]:
    match = CLUSTER_NAME_RE.search(name or "")
    return int(match.group(1)) if match else None


def iter_map_files(map_dir: str, suffix: str) -> Iterable[str]:
    for name in sorted(os.listdir(map_dir)):
        if name.lower().endswith(suffix.lower()):
            yield os.path.join(map_dir, name)


def load_cluster_positions(map_dir: str) -> Dict[str, Vec2]:
    path = os.path.join(map_dir, "galaxy.xml")
    tree = ET.parse(path)
    positions: Dict[str, Vec2] = {}
    for macro in tree.findall(".//macro[@class='galaxy']"):
        for connection in macro.findall("./connections/connection[@ref='clusters']"):
            ref_macro = connection.find("./macro")
            if ref_macro is None:
                continue
            macro_name = ref_macro.get("ref")
            if not macro_name:
                continue
            positions[macro_name] = parse_position(connection)
    return positions


def load_sector_placements(map_dir: str, cluster_positions: Dict[str, Vec2]) -> Dict[str, SectorPlacement]:
    placements: Dict[str, SectorPlacement] = {}
    for file_path in iter_map_files(map_dir, "clusters.xml"):
        tree = ET.parse(file_path)
        for cluster_macro in tree.findall(".//macro[@class='cluster']"):
            cluster_name = cluster_macro.get("name")
            if not cluster_name:
                continue
            cluster_id = parse_cluster_id(cluster_name)
            cluster_pos = cluster_positions.get(cluster_name, Vec2(0.0, 0.0))
            for connection in cluster_macro.findall("./connections/connection[@ref='sectors']"):
                sector_macro = connection.find("./macro")
                if sector_macro is None:
                    continue
                sector_ref = sector_macro.get("ref")
                if not sector_ref:
                    continue
                placements[sector_ref] = SectorPlacement(
                    cluster_macro=cluster_name,
                    cluster_id=cluster_id,
                    offset=cluster_pos + parse_position(connection),
                )
    return placements


def load_zone_placements(map_dir: str, sector_placements: Dict[str, SectorPlacement]) -> Dict[str, ZonePlacement]:
    placements: Dict[str, ZonePlacement] = {}
    for file_path in iter_map_files(map_dir, "sectors.xml"):
        tree = ET.parse(file_path)
        for sector_macro in tree.findall(".//macro[@class='sector']"):
            sector_name = sector_macro.get("name")
            if not sector_name or sector_name not in sector_placements:
                continue
            sector_info = sector_placements[sector_name]
            for connection in sector_macro.findall("./connections/connection[@ref='zones']"):
                zone_macro = connection.find("./macro")
                if zone_macro is None:
                    continue
                zone_ref = zone_macro.get("ref")
                if not zone_ref:
                    continue
                placements[zone_ref] = ZonePlacement(
                    sector_macro=sector_name,
                    cluster_macro=sector_info.cluster_macro,
                    cluster_id=sector_info.cluster_id,
                    offset=sector_info.offset + parse_position(connection),
                )
    return placements


def load_gate_records(map_dir: str, zone_placements: Dict[str, ZonePlacement]) -> List[GateRecord]:
    gates: List[GateRecord] = []
    for file_path in iter_map_files(map_dir, "zones.xml"):
        tree = ET.parse(file_path)
        for zone_macro in tree.findall(".//macro[@class='zone']"):
            zone_name = zone_macro.get("name")
            if not zone_name or zone_name not in zone_placements:
                continue
            zone_info = zone_placements[zone_name]
            for connection in zone_macro.findall("./connections/connection[@ref='gates']"):
                gate_name = connection.get("name") or ""
                match = GATE_LINK_RE.fullmatch(gate_name)
                if not match:
                    continue
                target_cluster_id = int(match.group(2))
                gates.append(
                    GateRecord(
                        gate_id=f"{zone_name}:{gate_name}",
                        gate_name=gate_name,
                        zone_macro=zone_name,
                        sector_macro=zone_info.sector_macro,
                        cluster_macro=zone_info.cluster_macro,
                        source_cluster_id=zone_info.cluster_id,
                        target_cluster_id=target_cluster_id,
                        position=zone_info.offset + parse_position(connection),
                    )
                )
    return gates


def pair_gate_links(gates: List[GateRecord]) -> List[Tuple[GateRecord, GateRecord]]:
    edges: List[Tuple[GateRecord, GateRecord]] = []
    indexed: Dict[Tuple[int, int], List[GateRecord]] = {}
    for gate in gates:
        if gate.source_cluster_id is None:
            continue
        indexed.setdefault((gate.source_cluster_id, gate.target_cluster_id), []).append(gate)

    used: set[str] = set()
    for gate in gates:
        if gate.source_cluster_id is None or gate.gate_id in used:
            continue
        reverse_candidates = indexed.get((gate.target_cluster_id, gate.source_cluster_id), [])
        reverse = next((candidate for candidate in reverse_candidates if candidate.gate_id not in used), None)
        if reverse is None:
            continue
        used.add(gate.gate_id)
        used.add(reverse.gate_id)
        edges.append((gate, reverse))
    return edges


def filter_sample(gates: List[GateRecord], focus_cluster: int, hop_clusters: int = 1) -> Tuple[List[GateRecord], List[Tuple[GateRecord, GateRecord]]]:
    paired = pair_gate_links(gates)
    allowed_clusters = {focus_cluster}
    for left, right in paired:
        if left.source_cluster_id == focus_cluster:
            allowed_clusters.add(left.target_cluster_id)
        if right.source_cluster_id == focus_cluster:
            allowed_clusters.add(right.target_cluster_id)

    filtered_gates = [
        gate for gate in gates
        if gate.source_cluster_id in allowed_clusters or gate.target_cluster_id in allowed_clusters
    ]
    filtered_edges = [
        (left, right) for left, right in paired
        if left.source_cluster_id in allowed_clusters and right.source_cluster_id in allowed_clusters
    ]
    return filtered_gates, filtered_edges


def render_nested_svg(
    gates: List[GateRecord],
    edges: List[Tuple[GateRecord, GateRecord]],
    cluster_positions: Dict[str, Vec2],
    sector_placements: Dict[str, SectorPlacement],
    zone_placements: Dict[str, ZonePlacement],
    output_path: str,
    title: str,
) -> None:
    if not gates or not zone_placements:
        raise ValueError("No gates available for rendering.")
    width = 1600.0
    height = 1100.0
    pad = 64.0

    cluster_colors = [
        "#0f766e", "#1d4ed8", "#b45309", "#be123c",
        "#7c3aed", "#15803d", "#0f172a", "#4338ca",
    ]

    def cluster_color(cluster_id: Optional[int]) -> str:
        if cluster_id is None:
            return "#475569"
        return cluster_colors[cluster_id % len(cluster_colors)]

    zone_gates: Dict[str, List[GateRecord]] = {}
    for gate in gates:
        zone_gates.setdefault(gate.zone_macro, []).append(gate)

    sample_sector_names = sorted({gate.sector_macro for gate in gates})
    sample_cluster_names = sorted({sector_placements[name].cluster_macro for name in sample_sector_names if name in sector_placements})
    cluster_positions_sample = {
        name: cluster_positions[name]
        for name in sample_cluster_names
        if name in cluster_positions
    }
    cluster_bounds = collect_bounds(list(cluster_positions_sample.values()) or [Vec2(0.0, 0.0)])

    coarse_step = 4
    occupied_cluster_cells: set[Tuple[int, int]] = set()
    cluster_anchor_cells: Dict[str, Tuple[int, int]] = {}
    cluster_anchor_pixels: Dict[str, Tuple[float, float]] = {}
    for cluster_name in sample_cluster_names:
        cluster_pos = cluster_positions_sample.get(cluster_name, Vec2(0.0, 0.0))
        qf = ((cluster_pos.x - cluster_bounds.min_x) / max(1.0, cluster_bounds.max_x - cluster_bounds.min_x)) * 10.0 - 5.0
        rf = ((cluster_pos.z - cluster_bounds.min_z) / max(1.0, cluster_bounds.max_z - cluster_bounds.min_z)) * 8.0 - 4.0
        base_q, base_r = cube_round(qf, rf)
        candidate_cells = [
            (base_q * coarse_step, base_r * coarse_step),
            ((base_q + 1) * coarse_step, base_r * coarse_step),
            ((base_q - 1) * coarse_step, base_r * coarse_step),
            (base_q * coarse_step, (base_r + 1) * coarse_step),
            (base_q * coarse_step, (base_r - 1) * coarse_step),
            ((base_q + 1) * coarse_step, (base_r - 1) * coarse_step),
            ((base_q - 1) * coarse_step, (base_r + 1) * coarse_step),
        ]
        chosen = next((cell for cell in candidate_cells if cell not in occupied_cluster_cells), candidate_cells[0])
        occupied_cluster_cells.add(chosen)
        cluster_anchor_cells[cluster_name] = chosen

    grid_size = 76.0
    pixel_positions = [axial_to_pixel(q, r, grid_size) for q, r in cluster_anchor_cells.values()]
    pixel_min_x = min((x for x, _ in pixel_positions), default=0.0)
    pixel_max_x = max((x for x, _ in pixel_positions), default=0.0)
    pixel_min_y = min((y for _, y in pixel_positions), default=0.0)
    pixel_max_y = max((y for _, y in pixel_positions), default=0.0)
    grid_left = pad + 120.0
    grid_top = 140.0
    grid_width = width - grid_left - pad - 120.0
    grid_height = height - grid_top - pad - 120.0
    for cluster_name, cell in cluster_anchor_cells.items():
        px, py = axial_to_pixel(cell[0], cell[1], grid_size)
        norm_x = 0.5 if pixel_max_x == pixel_min_x else (px - pixel_min_x) / (pixel_max_x - pixel_min_x)
        norm_y = 0.5 if pixel_max_y == pixel_min_y else (py - pixel_min_y) / (pixel_max_y - pixel_min_y)
        cluster_anchor_pixels[cluster_name] = (
            grid_left + norm_x * grid_width,
            grid_top + norm_y * grid_height,
        )

    sector_frames: Dict[str, Tuple[float, float, float, float]] = {}
    sector_centers: Dict[str, Tuple[float, float]] = {}
    sector_w = 168.0
    sector_h = 152.0
    sectors_by_cluster: Dict[str, List[str]] = {}
    for sector_name in sample_sector_names:
        sector_info = sector_placements.get(sector_name)
        if sector_info is not None:
            sectors_by_cluster.setdefault(sector_info.cluster_macro, []).append(sector_name)

    local_sector_slots = [
        (0, 0),
        (1, 0),
        (0, 1),
        (-1, 1),
        (-1, 0),
        (0, -1),
        (1, -1),
    ]
    for cluster_name, sector_names in sectors_by_cluster.items():
        anchor_px = cluster_anchor_pixels.get(cluster_name)
        cluster_pos = cluster_positions_sample.get(cluster_name, Vec2(0.0, 0.0))
        if anchor_px is None:
            continue
        ax, ay = anchor_px
        ordered_sector_names = sorted(
            sector_names,
            key=lambda sector_name: math.atan2(
                sector_placements[sector_name].offset.z - cluster_pos.z,
                sector_placements[sector_name].offset.x - cluster_pos.x,
            ),
        )
        for index, sector_name in enumerate(ordered_sector_names):
            slot_q, slot_r = local_sector_slots[index] if index < len(local_sector_slots) else (index, 0)
            dx, dy = axial_to_pixel(slot_q, slot_r, 54.0)
            cx = ax + dx
            cy = ay + dy
            sector_frames[sector_name] = (cx - sector_w / 2, cy - sector_h / 2, sector_w, sector_h)
            sector_centers[sector_name] = (cx, cy)

    sample_zone_names = sorted(zone_placements.keys())
    zones_by_sector: Dict[str, List[str]] = {}
    for zone_name, zone_info in zone_placements.items():
        zones_by_sector.setdefault(zone_info.sector_macro, []).append(zone_name)

    zone_centers: Dict[str, Tuple[float, float]] = {}
    zone_radius_px: Dict[str, float] = {}
    for sector_name, zone_names in zones_by_sector.items():
        sector_frame = sector_frames.get(sector_name)
        if sector_frame is None:
            continue
        left, top, sw, sh = sector_frame
        cx = left + sw / 2
        cy = top + sh / 2
        if len(zone_names) == 1:
            zone_name = zone_names[0]
            zone_centers[zone_name] = (cx, cy)
            zone_radius_px[zone_name] = 58.0
            continue

        inner_radius = 24.0 if len(zone_names) <= 3 else 20.0
        for index, zone_name in enumerate(zone_names):
            dx, dy = hex_grid_offset(index, inner_radius * 1.5)
            zone_centers[zone_name] = (cx + dx, cy + dy)
            zone_radius_px[zone_name] = inner_radius

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"""<svg xmlns="http://www.w3.org/2000/svg" width="{int(width)}" height="{int(height)}" viewBox="0 0 {width:.1f} {height:.1f}">
  <rect width="100%" height="100%" fill="#f8fafc" />
  <text x="32" y="42" font-size="28" font-family="Consolas, 'Courier New', monospace" fill="#0f172a">{title}</text>
  <text x="32" y="72" font-size="15" font-family="Consolas, 'Courier New', monospace" fill="#475569">Sector is the main universe node. Cluster has no frame. Sector size is uniform. Zones are tiled tightly inside each sector.</text>
""")

        for sector_name, (left, top, sw, sh) in sector_frames.items():
            sector_info = sector_placements.get(sector_name)
            fill = cluster_color(sector_info.cluster_id if sector_info else None)
            cx = left + sw / 2
            cy = top + sh / 2
            f.write(
                f'  <polygon points="{hex_points(cx, cy, 66)}" '
                f'fill="{fill}" fill-opacity="0.10" stroke="{fill}" stroke-width="2.4" stroke-opacity="0.65" />\n'
            )
            f.write(f'  <text x="{left + 18:.1f}" y="{top + 30:.1f}" font-size="12" font-family="Consolas, \'Courier New\', monospace" fill="#334155">{sector_name.replace("_macro", "")}</text>\n')

        for zone_name, zone_info in zone_placements.items():
            x, y = zone_centers[zone_name]
            radius = zone_radius_px[zone_name]
            fill = cluster_color(zone_info.cluster_id)
            f.write(
                f'  <polygon points="{hex_points(x, y, radius)}" '
                f'fill="{fill}" fill-opacity="0.14" stroke="{fill}" stroke-width="1.6" stroke-opacity="0.55" />\n'
            )
            f.write(
                f'  <text x="{x:.1f}" y="{y + 4:.1f}" text-anchor="middle" font-size="7.8" '
                f'font-family="Consolas, \'Courier New\', monospace" fill="#334155">{zone_name.replace("_macro", "").replace("Zone", "Z")}</text>\n'
            )

        gate_draw_positions: Dict[str, Tuple[float, float]] = {}
        for gate in gates:
            zone_center = zone_placements.get(gate.zone_macro)
            center = zone_centers.get(gate.zone_macro)
            if zone_center is None or center is None:
                gate_draw_positions[gate.gate_id] = (0.0, 0.0)
                continue
            zx, zy = center
            radius = zone_radius_px.get(gate.zone_macro, 14.0)
            local_gates = zone_gates.get(gate.zone_macro, [])
            max_local_offset = max(
                (
                    vec_distance(local_gate.position, zone_center.offset)
                    for local_gate in local_gates
                ),
                default=1.0,
            )
            local_dx = gate.position.x - zone_center.offset.x
            local_dz = gate.position.z - zone_center.offset.z
            interior_radius = radius * 0.62
            local_scale = interior_radius / max(1.0, max_local_offset)
            draw_x = zx + clamp(local_dx * local_scale, -interior_radius, interior_radius)
            draw_y = zy - clamp(local_dz * local_scale, -interior_radius, interior_radius)
            gate_draw_positions[gate.gate_id] = (draw_x, draw_y)

        for left, right in edges:
            x1, y1 = gate_draw_positions[left.gate_id]
            x2, y2 = gate_draw_positions[right.gate_id]
            f.write(
                f'  <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                f'stroke="#94a3b8" stroke-width="2.5" stroke-dasharray="8 6" />\n'
            )

        for gate in gates:
            fill = cluster_color(gate.source_cluster_id)
            zone_center = zone_placements.get(gate.zone_macro)
            draw_x, draw_y = gate_draw_positions[gate.gate_id]
            center = zone_centers.get(gate.zone_macro)
            if zone_center is not None and center is not None:
                zx, zy = center
                f.write(
                    f'  <line x1="{zx:.1f}" y1="{zy:.1f}" x2="{draw_x:.1f}" y2="{draw_y:.1f}" '
                    f'stroke="{fill}" stroke-opacity="0.45" stroke-width="1.4" />\n'
                )
            f.write(f'  <circle cx="{draw_x:.1f}" cy="{draw_y:.1f}" r="4.8" fill="{fill}" stroke="#ffffff" stroke-width="1.4" />\n')
            f.write(
                f'  <text x="{draw_x + 6:.1f}" y="{draw_y + 3:.1f}" font-size="8.5" '
                f'font-family="Consolas, \'Courier New\', monospace" fill="#1e293b">'
                f'C{gate.source_cluster_id:03d}→C{gate.target_cluster_id:03d}</text>\n'
            )

        legend_y = height - 92
        f.write(f'  <rect x="24" y="{legend_y - 50:.1f}" width="720" height="86" rx="10" fill="#ffffff" stroke="#cbd5e1" />\n')
        f.write(
            f'  <polygon points="{hex_points(60, legend_y - 16, 16)}" '
            f'fill="#1d4ed8" fill-opacity="0.10" stroke="#1d4ed8" stroke-width="2.4" stroke-opacity="0.65" />\n'
        )
        f.write(f'  <text x="104" y="{legend_y - 10:.1f}" font-size="13" font-family="Consolas, \'Courier New\', monospace" fill="#334155">Uniform sector node in universe layout</text>\n')
        f.write(
            f'  <polygon points="{hex_points(60, legend_y + 18, 10)}" '
            f'fill="#1d4ed8" fill-opacity="0.14" stroke="#1d4ed8" stroke-width="1.6" stroke-opacity="0.55" />\n'
        )
        f.write(f'  <text x="104" y="{legend_y + 24:.1f}" font-size="13" font-family="Consolas, \'Courier New\', monospace" fill="#334155">Zone tiled tightly inside sector; single-zone sectors fill the whole sector</text>\n')
        f.write(f'  <circle cx="60" cy="{legend_y + 50:.1f}" r="4.8" fill="#1d4ed8" stroke="#ffffff" stroke-width="1.4" />\n')
        f.write(f'  <text x="104" y="{legend_y + 55:.1f}" font-size="13" font-family="Consolas, \'Courier New\', monospace" fill="#334155">Gate uses zone-local placement only</text>\n')
        f.write("</svg>\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Render a small SVG sample of the X4 universe gate map.")
    parser.add_argument(
        "--map-dir",
        default=os.path.join("x4raw_assets", "8.0-Diplomacy", "maps", "xu_ep2_universe"),
        help="Directory containing distilled universe map XML files.",
    )
    parser.add_argument(
        "--focus-cluster",
        type=int,
        default=1,
        help="Render the focus cluster and its one-hop neighboring clusters.",
    )
    parser.add_argument(
        "--output",
        default=os.path.join("docs", "x4_universe_gate_sample_cluster_01.svg"),
        help="SVG output path.",
    )
    args = parser.parse_args()

    cluster_positions = load_cluster_positions(args.map_dir)
    sector_placements = load_sector_placements(args.map_dir, cluster_positions)
    zone_placements = load_zone_placements(args.map_dir, sector_placements)
    gates = load_gate_records(args.map_dir, zone_placements)
    sample_gates, sample_edges = filter_sample(gates, focus_cluster=args.focus_cluster)
    sample_zone_names = {gate.zone_macro for gate in sample_gates}
    sample_zone_placements = {
        zone_name: zone_info
        for zone_name, zone_info in zone_placements.items()
        if zone_name in sample_zone_names
    }
    sample_cluster_names = {zone_info.cluster_macro for zone_info in sample_zone_placements.values()}
    sample_sector_placements = {
        sector_name: sector_info
        for sector_name, sector_info in sector_placements.items()
        if sector_info.cluster_macro in sample_cluster_names and sector_name in {z.sector_macro for z in sample_zone_placements.values()}
    }
    sample_cluster_positions = {
        cluster_name: cluster_pos
        for cluster_name, cluster_pos in cluster_positions.items()
        if cluster_name in sample_cluster_names
    }
    render_nested_svg(
        sample_gates,
        sample_edges,
        sample_cluster_positions,
        sample_sector_placements,
        sample_zone_placements,
        args.output,
        title=f"X4 Universe Gate Sample around Cluster {args.focus_cluster:02d}",
    )

    print(f"Rendered {len(sample_gates)} gates and {len(sample_edges)} gate links.")
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
