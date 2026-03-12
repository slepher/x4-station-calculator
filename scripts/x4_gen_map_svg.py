import argparse
import json
import math
import os
import re
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

config_file = "x4-station-calculator.config.json"
if not os.path.exists(config_file):
    raise SystemExit(f"Missing config file: {config_file}")
with open(config_file, "r", encoding="utf-8") as f:
    _config = json.load(f)

OUTPUT_VERSION_DIR = os.path.join(_config['processed_assets_dir'], _config['folder_name'])
DEFAULT_INPUT = str(Path(OUTPUT_VERSION_DIR) / 'data' / 'maps.json')
DEFAULT_OUTPUT = str(Path(OUTPUT_VERSION_DIR) / 'data' / 'maps.svg')

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

REGION_CLUSTER_IDS = [29, 501, 502, 503, 500, 704, 2, 3, 39, 1, 5, 6, 740, 725, 4, 47]


class LayoutConfig:
    def __init__(self, width: float = 1800.0, height: float = 1300.0, pad_x: float = 90.0, pad_y: float = 90.0, top_pad: float = 70.0):
        self.width = width
        self.height = height
        self.pad_x = pad_x
        self.pad_y = pad_y
        self.top_pad = top_pad


def layout_config(include_all: bool = True) -> LayoutConfig:
    if include_all:
        return LayoutConfig(width=3600.0, height=2600.0, pad_x=180.0, pad_y=180.0, top_pad=140.0)
    return LayoutConfig()


def owner_color(owner: str) -> str:
    return OWNER_COLORS.get(owner, "#94a3b8")


def hex_points(cx: float, cy: float, radius: float) -> str:
    points: List[str] = []
    for index in range(6):
        angle = math.radians(60 * index)
        px = cx + radius * math.cos(angle)
        py = cy + radius * math.sin(angle)
        points.append(f"{px:.1f},{py:.1f}")
    return " ".join(points)

def hex_vertices(cx: float, cy: float, radius: float) -> List[Tuple[float, float]]:
    vertices: List[Tuple[float, float]] = []
    for index in range(6):
        angle = math.radians(60 * index)
        px = cx + radius * math.cos(angle)
        py = cy + radius * math.sin(angle)
        vertices.append((px, py))
    return vertices


def svg_id_safe(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", value)


def sector_clip_id(cluster_id: str, sector_id: str) -> str:
    return f"sector-clip-{svg_id_safe(cluster_id)}-{svg_id_safe(sector_id)}"


def catmull_rom_to_bezier_path(points: List[Tuple[float, float]]) -> str:
    if len(points) < 2:
        return ""
    if len(points) == 2:
        return f"M {points[0][0]:.1f},{points[0][1]:.1f} L {points[1][0]:.1f},{points[1][1]:.1f}"

    path_parts: List[str] = [f"M {points[0][0]:.1f},{points[0][1]:.1f}"]
    count = len(points)
    for index in range(count - 1):
        p0 = points[index - 1] if index - 1 >= 0 else points[index]
        p1 = points[index]
        p2 = points[index + 1]
        p3 = points[index + 2] if index + 2 < count else points[index + 1]
        c1x = p1[0] + (p2[0] - p0[0]) / 6.0
        c1y = p1[1] + (p2[1] - p0[1]) / 6.0
        c2x = p2[0] - (p3[0] - p1[0]) / 6.0
        c2y = p2[1] - (p3[1] - p1[1]) / 6.0
        path_parts.append(
            f"C {c1x:.1f},{c1y:.1f} {c2x:.1f},{c2y:.1f} {p2[0]:.1f},{p2[1]:.1f}"
        )
    return " ".join(path_parts)


def build_highway_path_points(
    start: Tuple[float, float],
    end: Tuple[float, float],
    middle_points: List[Tuple[float, float]],
    eps: float = 0.1,
) -> List[Tuple[float, float]]:
    points: List[Tuple[float, float]] = [start]
    for point in middle_points:
        if math.hypot(point[0] - start[0], point[1] - start[1]) <= eps:
            continue
        if math.hypot(point[0] - end[0], point[1] - end[1]) <= eps:
            continue
        points.append(point)
    points.append(end)

    deduped: List[Tuple[float, float]] = []
    for point in points:
        if not deduped:
            deduped.append(point)
            continue
        prev = deduped[-1]
        if math.hypot(point[0] - prev[0], point[1] - prev[1]) > eps:
            deduped.append(point)
    return deduped


def sector_ratio_to_cluster_ratio(
    sector_norm: dict,
    local_ratio: dict,
) -> Tuple[float, float] | None:
    if not local_ratio:
        return None
    center_ratio = sector_norm.get("center_offset_ratio")
    sector_radius_ratio = sector_norm.get("sector_radius_ratio")
    if not center_ratio or sector_radius_ratio is None:
        return None
    return (
        center_ratio["x"] + local_ratio["x"] * sector_radius_ratio,
        center_ratio["y"] + local_ratio["y"] * sector_radius_ratio,
    )


def cluster_ratio_to_screen(
    cx: float,
    cy: float,
    cluster_radius: float,
    cluster_ratio: Tuple[float, float],
) -> Tuple[float, float]:
    return (
        cx + cluster_ratio[0] * cluster_radius,
        cy + cluster_ratio[1] * cluster_radius,
    )


def gate_cluster_ratio_from_raw(gate: dict, sector_norm: dict) -> Tuple[float, float] | None:
    raw = gate.get("raw_local_pos", {})
    sx = raw.get("sx")
    sy = raw.get("sy")
    if sx is None or sy is None:
        return None
    return sector_ratio_to_cluster_ratio(sector_norm, {"x": sx, "y": sy})


def clip_segment_to_convex_polygon(
    p0: Tuple[float, float],
    p1: Tuple[float, float],
    polygon: List[Tuple[float, float]],
) -> Tuple[Tuple[float, float], Tuple[float, float]] | None:
    # Cyrus-Beck clipping for convex polygon (vertices in CCW order).
    dx = p1[0] - p0[0]
    dy = p1[1] - p0[1]
    t_enter = 0.0
    t_leave = 1.0
    eps = 1e-9

    for index in range(len(polygon)):
        ax, ay = polygon[index]
        bx, by = polygon[(index + 1) % len(polygon)]
        ex = bx - ax
        ey = by - ay

        c = ex * (p0[1] - ay) - ey * (p0[0] - ax)
        d = ex * dy - ey * dx
        n = -c

        if abs(d) <= eps:
            if c < -eps:
                return None
            continue

        t = n / d
        if d > 0:
            t_enter = max(t_enter, t)
        else:
            t_leave = min(t_leave, t)

        if t_enter - t_leave > eps:
            return None

    q0 = (p0[0] + dx * t_enter, p0[1] + dy * t_enter)
    q1 = (p0[0] + dx * t_leave, p0[1] + dy * t_leave)
    return q0, q1



def fit_world_to_screen(points: Iterable[Tuple[float, float]], cfg: LayoutConfig) -> Tuple[float, float, float, float, float]:
    point_list = list(points)
    min_x = min((x for x, _ in point_list), default=0.0)
    max_x = max((x for x, _ in point_list), default=1.0)
    min_y = min((-y for _, y in point_list), default=0.0)
    max_y = max((-y for _, y in point_list), default=1.0)
    available_w = cfg.width - cfg.pad_x * 2
    available_h = cfg.height - cfg.pad_y * 2 - cfg.top_pad
    world_w = max(max_x - min_x, 1.0)
    world_h = max(max_y - min_y, 1.0)
    scale = min(available_w / world_w, available_h / world_h)
    offset_x = cfg.pad_x + (available_w - world_w * scale) / 2.0
    offset_y = cfg.pad_y + cfg.top_pad + (available_h - world_h * scale) / 2.0
    return min_x, min_y, scale, offset_x, offset_y


def cluster_center_screen(cluster: dict, fit: Tuple[float, float, float, float, float]) -> Tuple[float, float]:
    min_x, min_y, scale, offset_x, offset_y = fit
    basis = cluster["normalized"]["pixel_basis"]
    return offset_x + (basis["x"] - min_x) * scale, offset_y + ((-basis["y"]) - min_y) * scale


def min_center_distance(centers: Dict[str, Tuple[float, float]]) -> float:
    values = list(centers.values())
    if len(values) < 2:
        return 1.0
    best = None
    for idx, left in enumerate(values):
        for right in values[idx + 1:]:
            dist = math.hypot(left[0] - right[0], left[1] - right[1])
            if best is None or dist < best:
                best = dist
    return best or 1.0


def compute_cluster_radius(centers: Dict[str, Tuple[float, float]]) -> float:
    min_distance = min_center_distance(centers)
    return max(82.0, min(126.0, min_distance / math.sqrt(3.0)))


def scaled_layout_config(cfg: LayoutConfig, factor: float) -> LayoutConfig:
    return LayoutConfig(
        width=cfg.width * factor,
        height=cfg.height * factor,
        pad_x=cfg.pad_x * factor,
        pad_y=cfg.pad_y * factor,
        top_pad=cfg.top_pad * factor,
    )


def select_region_clusters(clusters: Dict[str, dict], include_all: bool = True) -> List[str]:
    if include_all:
        return list(clusters.keys())
    allowed = {f"Cluster_{cluster_id:02d}_macro" for cluster_id in REGION_CLUSTER_IDS}
    return [cluster_id for cluster_id in clusters if cluster_id in allowed]


def render_from_maps_json(input_path: str, output_path: str, include_all: bool = True) -> None:
    data = json.loads(Path(input_path).read_text(encoding='utf-8'))
    clusters: Dict[str, dict] = data["clusters"]
    region_ids = select_region_clusters(clusters, include_all=include_all)
    region_clusters = {cluster_id: clusters[cluster_id] for cluster_id in region_ids}

    cfg = layout_config(include_all=include_all)
    fit = fit_world_to_screen(((c["normalized"]["pixel_basis"]["x"], c["normalized"]["pixel_basis"]["y"]) for c in region_clusters.values()), cfg)
    cluster_centers = {cluster_id: cluster_center_screen(cluster, fit) for cluster_id, cluster in region_clusters.items()}
    if include_all:
        min_distance = min_center_distance(cluster_centers)
        cluster_radius = compute_cluster_radius(cluster_centers)
        required_distance = math.sqrt(3.0) * cluster_radius
        if min_distance < required_distance:
            cfg = scaled_layout_config(cfg, required_distance / min_distance)
            fit = fit_world_to_screen(((c["normalized"]["pixel_basis"]["x"], c["normalized"]["pixel_basis"]["y"]) for c in region_clusters.values()), cfg)
            cluster_centers = {cluster_id: cluster_center_screen(cluster, fit) for cluster_id, cluster in region_clusters.items()}
    cluster_radius = compute_cluster_radius(cluster_centers)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{int(cfg.width)}" height="{int(cfg.height)}" viewBox="0 0 {cfg.width:.1f} {cfg.height:.1f}">\n'
            f'  <rect width="100%" height="100%" fill="#050505" />\n'
        )
        f.write('  <defs>\n')
        for cluster_id in region_ids:
            cluster = clusters[cluster_id]
            cx, cy = cluster_centers[cluster_id]
            for sector in cluster.get("sectors", {}).values():
                sx = cx + sector['normalized']['center_offset_ratio']['x'] * cluster_radius
                sy = cy + sector['normalized']['center_offset_ratio']['y'] * cluster_radius
                sector_radius = sector['normalized']['sector_radius_ratio'] * cluster_radius
                clip_id = sector_clip_id(cluster_id, sector["id"])
                f.write(
                    f'    <clipPath id="{clip_id}"><polygon points="{hex_points(sx, sy, sector_radius)}" /></clipPath>\n'
                )
        f.write('  </defs>\n')

        for cluster_id in region_ids:
            cluster = clusters[cluster_id]
            color = owner_color(cluster.get('owner', 'neutral'))
            cx, cy = cluster_centers[cluster_id]
            sectors = cluster['sectors']

            for link in cluster.get('cluster_links', {}).values():
                # defer; cluster links drawn after collecting opposite ends
                pass

            for link in cluster.get('sector_links', {}).values():
                sector_a_id = link.get('sector_a_id')
                sector_b_id = link.get('sector_b_id')
                from_zone_id = link.get('from_zone_id')
                to_zone_id = link.get('to_zone_id')
                if not from_zone_id or not to_zone_id or sector_a_id not in sectors or sector_b_id not in sectors:
                    continue
                sector_a = sectors[sector_a_id]
                sector_b = sectors[sector_b_id]
                from_anchor = sector_a.get('shcon_anchors', {}).get(from_zone_id)
                to_anchor = sector_b.get('shcon_anchors', {}).get(to_zone_id)
                from_raw = from_anchor.get('raw_sector_pos') if from_anchor else None
                to_raw = to_anchor.get('raw_sector_pos') if to_anchor else None
                from_local_ratio = {"x": from_raw["sx"], "y": from_raw["sy"]} if from_raw and "sx" in from_raw and "sy" in from_raw else None
                to_local_ratio = {"x": to_raw["sx"], "y": to_raw["sy"]} if to_raw and "sx" in to_raw and "sy" in to_raw else None
                start_cluster_ratio = sector_ratio_to_cluster_ratio(sector_a.get("normalized", {}), from_local_ratio)
                end_cluster_ratio = sector_ratio_to_cluster_ratio(sector_b.get("normalized", {}), to_local_ratio)
                if not start_cluster_ratio or not end_cluster_ratio:
                    continue
                start = cluster_ratio_to_screen(cx, cy, cluster_radius, start_cluster_ratio)
                end = cluster_ratio_to_screen(cx, cy, cluster_radius, end_cluster_ratio)
                f.write(f'  <line x1="{start[0]:.1f}" y1="{start[1]:.1f}" x2="{end[0]:.1f}" y2="{end[1]:.1f}" stroke="#1d4ed8" stroke-width="0.4" stroke-opacity="0.95" />\n')
                f.write(f'  <circle cx="{start[0]:.1f}" cy="{start[1]:.1f}" r="0.7" fill="#1d4ed8" stroke="#dbeafe" stroke-width="0.4" />\n')
                f.write(f'  <circle cx="{end[0]:.1f}" cy="{end[1]:.1f}" r="0.7" fill="#1d4ed8" stroke="#dbeafe" stroke-width="0.4" />\n')

            for sector in sectors.values():
                sx = cx + sector['normalized']['center_offset_ratio']['x'] * cluster_radius
                sy = cy + sector['normalized']['center_offset_ratio']['y'] * cluster_radius
                sector_radius = sector['normalized']['sector_radius_ratio'] * cluster_radius
                sector_hex = hex_vertices(sx, sy, sector_radius)
                for highway in sector.get("highways", {}).values():
                    sector_norm = sector.get("normalized", {})
                    center_ratio = sector_norm.get("center_offset_ratio", {"x": 0.0, "y": 0.0})
                    sector_radius_ratio = float(sector_norm.get("sector_radius_ratio", 1.0))
                    entry_point = highway.get("entry")
                    exit_point = highway.get("exit")
                    if not entry_point or not exit_point:
                        continue
                    if "sx" not in entry_point or "sy" not in entry_point or "sx" not in exit_point or "sy" not in exit_point:
                        continue
                    start_cluster_ratio = (
                        center_ratio["x"] + entry_point["sx"] * sector_radius_ratio,
                        center_ratio["y"] + entry_point["sy"] * sector_radius_ratio,
                    )
                    end_cluster_ratio = (
                        center_ratio["x"] + exit_point["sx"] * sector_radius_ratio,
                        center_ratio["y"] + exit_point["sy"] * sector_radius_ratio,
                    )
                    start = (
                        cx + start_cluster_ratio[0] * cluster_radius,
                        cy + start_cluster_ratio[1] * cluster_radius,
                    )
                    end = (
                        cx + end_cluster_ratio[0] * cluster_radius,
                        cy + end_cluster_ratio[1] * cluster_radius,
                    )
                    spline_points = highway.get("spline", [])
                    middle_points: List[Tuple[float, float]] = []
                    for point in spline_points:
                        if "sx" not in point or "sy" not in point:
                            continue
                        cluster_ratio_x = center_ratio["x"] + point["sx"] * sector_radius_ratio
                        cluster_ratio_y = center_ratio["y"] + point["sy"] * sector_radius_ratio
                        middle_points.append(
                            (
                                cx + cluster_ratio_x * cluster_radius,
                                cy + cluster_ratio_y * cluster_radius,
                            )
                        )
                    path_points = build_highway_path_points(start, end, middle_points)
                    clip_id = sector_clip_id(cluster_id, sector["id"])
                    if len(path_points) >= 3:
                        path_d = catmull_rom_to_bezier_path(path_points)
                        f.write(
                            f'  <path d="{path_d}" clip-path="url(#{clip_id})" fill="none" stroke="#0ea5e9" stroke-width="0.45" stroke-opacity="0.92" />\n'
                        )
                    else:
                        clipped = clip_segment_to_convex_polygon(start, end, sector_hex)
                        if clipped is None:
                            continue
                        (x1, y1), (x2, y2) = clipped
                        f.write(f'  <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#0ea5e9" stroke-width="0.45" stroke-opacity="0.92" />\n')


            if len(sectors) == 1:
                only_sector = next(iter(sectors.values()))
                radius = only_sector['normalized']['sector_radius_ratio'] * cluster_radius
                f.write(f'  <polygon points="{hex_points(cx, cy, radius)}" fill="{color}" fill-opacity="0.08" stroke="{color}" stroke-width="2.8" stroke-opacity="0.95" />\n')
                f.write(f'  <text x="{cx:.1f}" y="{cy - radius * 0.72:.1f}" text-anchor="middle" font-size="14" font-family="Consolas, \'Courier New\', monospace" fill="#f8fafc">{only_sector["name"]}</text>\n')
            else:
                f.write(f'  <polygon points="{hex_points(cx, cy, cluster_radius)}" fill="none" stroke="{color}" stroke-width="2.8" stroke-opacity="0.95" />\n')
                for sector in sectors.values():
                    sx = cx + sector['normalized']['center_offset_ratio']['x'] * cluster_radius
                    sy = cy + sector['normalized']['center_offset_ratio']['y'] * cluster_radius
                    radius = sector['normalized']['sector_radius_ratio'] * cluster_radius
                    f.write(f'  <polygon points="{hex_points(sx, sy, radius)}" fill="{color}" fill-opacity="0.08" stroke="{color}" stroke-width="2.2" stroke-opacity="0.9" />\n')
                    f.write(f'  <text x="{sx:.1f}" y="{sy - radius * 0.72:.1f}" text-anchor="middle" font-size="14" font-family="Consolas, \'Courier New\', monospace" fill="#f8fafc">{sector["name"]}</text>\n')

            for sector in sectors.values():
                sx = cx + sector['normalized']['center_offset_ratio']['x'] * cluster_radius
                sy = cy + sector['normalized']['center_offset_ratio']['y'] * cluster_radius
                radius = sector['normalized']['sector_radius_ratio'] * cluster_radius
                for gate in sector.get('cluster_gates', {}).values():
                    cluster_ratio = gate_cluster_ratio_from_raw(gate, sector.get("normalized", {}))
                    if not cluster_ratio:
                        continue
                    gx, gy = cluster_ratio_to_screen(cx, cy, cluster_radius, cluster_ratio)
                    r = 1.1 if len(sectors) == 1 else 0.8
                    f.write(f'  <circle cx="{gx:.1f}" cy="{gy:.1f}" r="{r:.1f}" fill="{color}" stroke="#ffffff" stroke-width="0.3" />\n')

        # cross-cluster gate lines
        gate_index = {}
        for cluster_id in region_ids:
            cluster = clusters[cluster_id]
            cx, cy = cluster_centers[cluster_id]
            for sector_id, sector in cluster['sectors'].items():
                sx = cx + sector['normalized']['center_offset_ratio']['x'] * cluster_radius
                sy = cy + sector['normalized']['center_offset_ratio']['y'] * cluster_radius
                for gate_id, gate in sector.get('cluster_gates', {}).items():
                    cluster_ratio = gate_cluster_ratio_from_raw(gate, sector.get("normalized", {}))
                    if not cluster_ratio:
                        continue
                    gate_key = gate.get('id') or gate_id
                    gate_index[gate_key] = {
                        'cluster_id': cluster_id,
                        'target_cluster_id': gate.get('target_cluster_id'),
                        'point': cluster_ratio_to_screen(cx, cy, cluster_radius, cluster_ratio),
                    }

        used = set()
        for gate_id, gate in gate_index.items():
            if gate_id in used:
                continue
            reverse_id = next((other_id for other_id, other in gate_index.items() if other_id not in used and other['cluster_id'] == gate['target_cluster_id'] and other['target_cluster_id'] == gate['cluster_id']), None)
            if reverse_id is None:
                continue
            left = gate['point']
            right = gate_index[reverse_id]['point']
            f.write(f'  <line x1="{left[0]:.1f}" y1="{left[1]:.1f}" x2="{right[0]:.1f}" y2="{right[1]:.1f}" stroke="#e5e7eb" stroke-width="0.6" stroke-opacity="0.85" />\n')
            used.add(gate_id)
            used.add(reverse_id)

        f.write('</svg>\n')


def main() -> None:
    parser = argparse.ArgumentParser(description='Render universe SVG from processed maps.json.')
    parser.add_argument('--input', default=DEFAULT_INPUT)
    parser.add_argument('--output', default=DEFAULT_OUTPUT)
    parser.add_argument('--trial', action='store_true', help='Render trial region only (default renders all clusters).')
    args = parser.parse_args()
    render_from_maps_json(args.input, args.output, include_all=not args.trial)
    print(f'Output: {args.output}')


if __name__ == '__main__':
    main()

