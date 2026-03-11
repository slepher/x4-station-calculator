import argparse
import json
import math
import os
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
            f'  <text x="28" y="40" font-size="24" font-family="Consolas, \'Courier New\', monospace" fill="#e5e7eb">Universe Map from maps.json</text>\n'
        )

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
                start_point = from_anchor.get('render', {}).get('cluster_ratio_point') if from_anchor else None
                end_point = to_anchor.get('render', {}).get('cluster_ratio_point') if to_anchor else None
                if not start_point or not end_point:
                    continue
                sa_center = (
                    cx + sector_a['normalized']['center_offset_ratio']['x'] * cluster_radius,
                    cy + sector_a['normalized']['center_offset_ratio']['y'] * cluster_radius,
                )
                sb_center = (
                    cx + sector_b['normalized']['center_offset_ratio']['x'] * cluster_radius,
                    cy + sector_b['normalized']['center_offset_ratio']['y'] * cluster_radius,
                )
                start = (
                    cx + start_point['x'] * cluster_radius,
                    cy + start_point['y'] * cluster_radius,
                )
                end = (
                    cx + end_point['x'] * cluster_radius,
                    cy + end_point['y'] * cluster_radius,
                )
                mid = ((sa_center[0] + sb_center[0]) / 2.0, (sa_center[1] + sb_center[1]) / 2.0)
                dx = sb_center[0] - sa_center[0]
                dy = sb_center[1] - sa_center[1]
                length = math.hypot(dx, dy) or 1.0
                nx = -dy / length
                ny = dx / length
                render = link.get('render', {})
                lane_count = max(1, int(render.get('lane_count', 1)))
                lane_index = int(render.get('lane_index', 0))
                lane_offset = (lane_index - (lane_count - 1) / 2.0) * 2.2
                seam = (mid[0] + nx * lane_offset, mid[1] + ny * lane_offset)
                f.write(f'  <line x1="{start[0]:.1f}" y1="{start[1]:.1f}" x2="{seam[0]:.1f}" y2="{seam[1]:.1f}" stroke="#1d4ed8" stroke-width="0.4" stroke-opacity="0.95" />\n')
                f.write(f'  <line x1="{end[0]:.1f}" y1="{end[1]:.1f}" x2="{seam[0]:.1f}" y2="{seam[1]:.1f}" stroke="#1d4ed8" stroke-width="0.4" stroke-opacity="0.95" />\n')
                f.write(f'  <circle cx="{start[0]:.1f}" cy="{start[1]:.1f}" r="0.7" fill="#1d4ed8" stroke="#dbeafe" stroke-width="0.4" />\n')
                f.write(f'  <circle cx="{end[0]:.1f}" cy="{end[1]:.1f}" r="0.7" fill="#1d4ed8" stroke="#dbeafe" stroke-width="0.4" />\n')

            for sector in sectors.values():
                sx = cx + sector['normalized']['center_offset_ratio']['x'] * cluster_radius
                sy = cy + sector['normalized']['center_offset_ratio']['y'] * cluster_radius
                sector_radius = sector['normalized']['sector_radius_ratio'] * cluster_radius
                sector_hex = hex_vertices(sx, sy, sector_radius)
                for highway in sector.get("highways", {}).values():
                    render = highway.get("render", {})
                    a_ratio = render.get("a_cluster_ratio")
                    b_ratio = render.get("b_cluster_ratio")
                    if not a_ratio or not b_ratio:
                        continue
                    p0 = (
                        cx + a_ratio["x"] * cluster_radius,
                        cy + a_ratio["y"] * cluster_radius,
                    )
                    p1 = (
                        cx + b_ratio["x"] * cluster_radius,
                        cy + b_ratio["y"] * cluster_radius,
                    )
                    clipped = clip_segment_to_convex_polygon(p0, p1, sector_hex)
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
                    point = gate.get('render', {}).get('cluster_ratio_point')
                    if not point:
                        continue
                    gx = cx + point['x'] * cluster_radius
                    gy = cy + point['y'] * cluster_radius
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
                    point = gate.get('render', {}).get('cluster_ratio_point')
                    if not point:
                        continue
                    gate_index[gate_id] = {
                        'cluster_id': cluster_id,
                        'target_cluster_id': gate.get('target_cluster_id'),
                        'point': (cx + point['x'] * cluster_radius, cy + point['y'] * cluster_radius),
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

