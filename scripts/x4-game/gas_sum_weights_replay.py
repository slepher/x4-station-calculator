#!/usr/bin/env python3
"""Gas field replay using reverse-confirmed geometry/profile chain.

This script keeps the original confirmed cylinder sample path and adds a
reverse-closure path for `splinetube` gas fields using only:

- raw boundary shape (`cylinder` / `splinetube`)
- raw falloff control points
- raw gas resource rows (`ware/resourcedensity/delay`)

For splinetube, the current closure is:

- `FUN_14093ee10` / `FUN_14093ed70`: radial interval from query-center to
  nearest spline centerline point, normalized by tube radius.
- `FUN_14093ed40`: lateral interval over the spline parameter range affected by
  `query_radius + tube_radius`.
- `FUN_1414ed970`: average evaluator over the raw profile curve.
- `FUN_140e84170`: `base_multiplier * profile_weight` replay for gas blocks.

The spline shape itself is reconstructed from raw region control points as cubic
Bezier segments whose handle vectors are given by `tx/ty/tz * inlength/outlength`.
That matches the region's sampled spline for
`region_cluster_713_sector_001_nebula_2` exactly.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field
import json
import math
from pathlib import Path
import struct


AREA_SIZE = 64000.0
AREA_HALF = AREA_SIZE / 2.0
SAVE_GRID_MIN_CENTER_XZ = -960000
SAVE_GRID_MAX_CENTER_XZ = 1024000
SAVE_GRID_MIN_CENTER_Y = -960000
SAVE_GRID_MAX_CENTER_Y = 1024000
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "src" / "assets" / "x4_game_data" / "8.0-Diplomacy" / "data"
RESOURCEAREAS_JSON = DATA_ROOT / "resourceareas.json"
REGIONS_JSON = DATA_ROOT / "regions.json"
SAVE_SAMPLE_ROOT = PROJECT_ROOT / "save_sample_data"
QUERY_RADIUS_14073F750 = 55425.625
SPLINETUBE_SEGMENT_COUNT_DEFAULT_14078EAC0 = 2000
SPLINETUBE_INTERVAL_SAMPLE_COUNT_14093ED40 = 5


def f32(value: float) -> float:
    return struct.unpack("<f", struct.pack("<f", float(value)))[0]


def truncate_to_runtime_int(value: float) -> int:
    if value <= 0.0:
        return 0
    return int(value)


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


@dataclass
class ProfilePoint:
    position: float
    value: float


@dataclass
class FalloffProfiles:
    lateral: list[ProfilePoint]
    radial: list[ProfilePoint]
    lateral_factor: float | None = None
    radial_factor: float | None = None


@dataclass
class GasResourceEntry:
    ware_key: str
    resourcedensity: float
    recharge_time_seconds: float
    gather_speed_factor: float
    yield_name: str = ""


@dataclass
class SplineControlPoint:
    x: float
    y: float
    z: float
    tx: float
    ty: float
    tz: float
    inlength: float
    outlength: float


@dataclass
class NebulaFieldState:
    name: str
    boundary_class: str
    position_x: float
    position_y: float
    position_z: float
    radius: float
    linear: float
    falloff: FalloffProfiles
    resources: list[GasResourceEntry]
    size_x: float = 0.0
    size_y: float = 0.0
    size_z: float = 0.0
    spline: list[SplineControlPoint] = field(default_factory=list)
    universe_yield_density_by_ware: dict[str, float] = field(default_factory=dict)


@dataclass
class QueryGridWindow:
    origin_x: int
    origin_y: int
    origin_z: int


def compute_axis_storage_origin_140760320(position: float, max_center: int) -> int:
    if abs(position) <= max_center:
        return 0
    return int(math.floor(position / AREA_SIZE) * AREA_SIZE)


def build_query_grid_window_140760320(
    position_x: float,
    position_y: float,
    position_z: float,
) -> QueryGridWindow:
    return QueryGridWindow(
        origin_x=compute_axis_storage_origin_140760320(position_x, SAVE_GRID_MAX_CENTER_XZ),
        origin_y=compute_axis_storage_origin_140760320(position_y, SAVE_GRID_MAX_CENTER_Y),
        origin_z=compute_axis_storage_origin_140760320(position_z, SAVE_GRID_MAX_CENTER_XZ),
    )


def world_coord_from_storage_coord_140760320(
    grid: QueryGridWindow,
    coord: tuple[int, int, int],
) -> tuple[int, int, int]:
    return (
        coord[0] + grid.origin_x,
        coord[1] + grid.origin_y,
        coord[2] + grid.origin_z,
    )


def compute_storage_axis_range_140760320(
    min_world: float,
    max_world: float,
    origin: int,
    min_center: int,
    max_center: int,
) -> tuple[int, int]:
    start = max(int(math.floor((min_world - origin) / AREA_SIZE) * int(AREA_SIZE)), min_center)
    end = min(int(math.floor((max_world - origin) / AREA_SIZE) * int(AREA_SIZE)), max_center)
    return start, end


def load_json_rows(path: Path) -> object:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def index_regions_by_id() -> dict[str, dict]:
    return {row["id"]: row for row in load_json_rows(REGIONS_JSON)}


def find_sector_area_entry(sector_id: str, field_ref: str) -> dict:
    for sector_entry in load_json_rows(RESOURCEAREAS_JSON):
        if sector_entry.get("sector_id") != sector_id:
            continue
        for area in sector_entry.get("areas", []):
            if area.get("ref") == field_ref:
                return area
    raise ValueError(f"sector/field not found in resourceareas.json: {sector_id} / {field_ref}")


def load_save_sample_for_ware(sector_id: str, ware: str, yield_name: str) -> dict[tuple[int, int, int], dict]:
    save_path = SAVE_SAMPLE_ROOT / f"{sector_id.lower()}.json"
    if not save_path.exists():
        return {}
    with save_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if ware not in data.get("ware", {}):
        return {}
    ware_data = data["ware"][ware]
    # Try yield_name first, then fallback to resources or iterate yield names
    if yield_name and yield_name in ware_data:
        rows = ware_data[yield_name].get("resources", [])
    elif "resources" in ware_data:
        rows = ware_data.get("resources", [])
    else:
        # Merge all yield_name resources
        rows = []
        for yn, yd in ware_data.items():
            if isinstance(yd, dict) and "resources" in yd:
                rows.extend(yd["resources"])
    return {(int(row["x"]), int(row["y"]), int(row["z"])): row for row in rows}


def load_total_sample_for_ware(sector_id: str, ware: str, yield_name: str) -> dict:
    total_path = SAVE_SAMPLE_ROOT / "total.json"
    if not total_path.exists():
        return {}
    with total_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    for sector in data.get("sectors", []):
        if sector.get("sector_id") == sector_id.lower():
            ware_data = sector.get("ware", {}).get(ware, {})
            if yield_name and yield_name in ware_data:
                return ware_data[yield_name]
            return ware_data
    return {}


def compute_resource_field_base_multiplier_140e80260(
    field: NebulaFieldState,
    resource: GasResourceEntry,
) -> float:
    universe_multiplier = field.universe_yield_density_by_ware.get(resource.ware_key, 1.0)
    return f32(f32(universe_multiplier) * f32(resource.resourcedensity))


def resource_field_is_enabled_140e802d0(resource: GasResourceEntry) -> bool:
    return 0.0 < resource.resourcedensity


def build_nebula_field_from_sector_area_json_140e860c0(
    sector_id: str,
    field_ref: str,
) -> NebulaFieldState:
    area = find_sector_area_entry(sector_id, field_ref)
    region = index_regions_by_id().get(field_ref)
    if region is None:
        raise ValueError(f"region not found in regions.json: {field_ref}")

    boundary = region["boundary"]
    boundary_size = boundary["size"]
    falloff = region["falloff"]
    position = area["position"]

    resources = [
        GasResourceEntry(
            ware_key=row["ware"],
            resourcedensity=float(row["resourcedensity"]),
            recharge_time_seconds=float(row["delay"]),
            gather_speed_factor=float(row.get("gatherfactor", 1.0)),
            yield_name=str(row.get("yield", row.get("yield_name", ""))),
        )
        for row in region["resources"]
    ]

    spline = [
        SplineControlPoint(
            x=float(row["x"]) + float(position["x"]),
            y=float(row["y"]) + float(position["y"]),
            z=float(row["z"]) + float(position["z"]),
            tx=float(row["tx"]),
            ty=float(row["ty"]),
            tz=float(row["tz"]),
            inlength=float(row["inlength"]),
            outlength=float(row["outlength"]),
        )
        for row in boundary.get("spline", [])
    ]

    return NebulaFieldState(
        name=f"{sector_id} / {field_ref}",
        boundary_class=str(boundary["class"]),
        position_x=float(position["x"]),
        position_y=float(position["y"]),
        position_z=float(position["z"]),
        radius=float(boundary_size.get("r", 0.0)),
        linear=float(boundary_size.get("linear", 0.0)),
        size_x=float(boundary_size.get("x", 0.0)),
        size_y=float(boundary_size.get("y", 0.0)),
        size_z=float(boundary_size.get("z", 0.0)),
        falloff=FalloffProfiles(
            lateral=[ProfilePoint(float(p["position"]), float(p["value"])) for p in falloff["lateral"]],
            radial=[ProfilePoint(float(p["position"]), float(p["value"])) for p in falloff["radial"]],
            lateral_factor=float(falloff["lateral_factor"]) if "lateral_factor" in falloff else None,
            radial_factor=float(falloff["radial_factor"]) if "radial_factor" in falloff else None,
        ),
        resources=resources,
        spline=spline,
        universe_yield_density_by_ware={row["ware"]: 1.0 for row in region["resources"]},
    )


def vec_add(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def vec_sub(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vec_mul(a: tuple[float, float, float], scale: float) -> tuple[float, float, float]:
    return (a[0] * scale, a[1] * scale, a[2] * scale)


def dot(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def vec_length(a: tuple[float, float, float]) -> float:
    return math.sqrt(dot(a, a))


def cubic_bezier_sample_14093E5C0(
    p0: tuple[float, float, float],
    c0: tuple[float, float, float],
    c1: tuple[float, float, float],
    p1: tuple[float, float, float],
    t: float,
) -> tuple[float, float, float]:
    omt = 1.0 - t
    omt2 = omt * omt
    omt3 = omt2 * omt
    t2 = t * t
    t3 = t2 * t
    return vec_add(
        vec_add(vec_mul(p0, omt3), vec_mul(c0, 3.0 * omt2 * t)),
        vec_add(vec_mul(c1, 3.0 * omt * t2), vec_mul(p1, t3)),
    )


def build_sampled_spline_points_from_region_bezier_closure_14093E5C0(
    field: NebulaFieldState,
) -> list[tuple[float, float, float]]:
    if len(field.spline) < 2:
        raise ValueError("splinetube requires at least two spline control points")

    points: list[tuple[float, float, float]] = []
    for seg_index in range(len(field.spline) - 1):
        left = field.spline[seg_index]
        right = field.spline[seg_index + 1]
        p0 = (left.x, left.y, left.z)
        p1 = (right.x, right.y, right.z)
        c0 = (left.x + left.tx * left.outlength, left.y + left.ty * left.outlength, left.z + left.tz * left.outlength)
        c1 = (right.x - right.tx * right.inlength, right.y - right.ty * right.inlength, right.z - right.tz * right.inlength)
        step_count = 16
        start = 0 if seg_index == 0 else 1
        for i in range(start, step_count + 1):
            points.append(cubic_bezier_sample_14093E5C0(p0, c0, c1, p1, i / step_count))
    return points


def sample_composite_spline_uniform_param_1402D55C0(
    field: NebulaFieldState,
    t: float,
) -> tuple[float, float, float]:
    segment_count = len(field.spline) - 1
    if segment_count <= 0:
        raise ValueError("splinetube requires at least two spline control points")
    t = clamp(t, 0.0, 1.0)
    scaled = t * segment_count
    seg_index = min(int(math.floor(scaled)), segment_count - 1)
    local_t = scaled - seg_index
    if t >= 1.0:
        seg_index = segment_count - 1
        local_t = 1.0
    left = field.spline[seg_index]
    right = field.spline[seg_index + 1]
    p0 = (left.x, left.y, left.z)
    p1 = (right.x, right.y, right.z)
    c0 = (left.x + left.tx * left.outlength, left.y + left.ty * left.outlength, left.z + left.tz * left.outlength)
    c1 = (right.x - right.tx * right.inlength, right.y - right.ty * right.inlength, right.z - right.tz * right.inlength)
    return cubic_bezier_sample_14093E5C0(p0, c0, c1, p1, local_t)


def build_runtime_sampled_splinetube_points_14078EAC0(
    field: NebulaFieldState,
) -> list[tuple[float, float, float]]:
    return [
        sample_composite_spline_uniform_param_1402D55C0(
            field,
            index / SPLINETUBE_SEGMENT_COUNT_DEFAULT_14078EAC0,
        )
        for index in range(SPLINETUBE_SEGMENT_COUNT_DEFAULT_14078EAC0 + 1)
    ]


def build_polyline_arclength_table_from_sampled_points_14093E5C0(
    points: list[tuple[float, float, float]],
) -> tuple[list[float], list[float], float]:
    seg_lengths: list[float] = []
    accum = [0.0]
    total = 0.0
    for a, b in zip(points, points[1:]):
        seg_len = vec_length(vec_sub(b, a))
        seg_lengths.append(seg_len)
        total += seg_len
        accum.append(total)
    return seg_lengths, accum, total


def eval_profile_avg_1414ED970(profile: list[ProfilePoint], interval: tuple[float, float]) -> float:
    if not profile:
        return 1.0
    lower, upper = interval
    if upper <= lower:
        return 0.0

    def value_at(x: float) -> float:
        if x <= profile[0].position:
            return profile[0].value
        for left, right in zip(profile, profile[1:]):
            if x <= right.position:
                if right.position == left.position:
                    return right.value
                t = (x - left.position) / (right.position - left.position)
                return left.value + (right.value - left.value) * t
        return profile[-1].value

    xs = [lower, upper]
    for node in profile:
        if lower < node.position < upper:
            xs.append(node.position)
    xs.sort()

    area = 0.0
    for x0, x1 in zip(xs, xs[1:]):
        y0 = value_at(x0)
        y1 = value_at(x1)
        area += (y0 + y1) * 0.5 * (x1 - x0)
    return area / (upper - lower)


def distance_point_to_segment_with_param(
    query: tuple[float, float, float],
    a: tuple[float, float, float],
    b: tuple[float, float, float],
) -> tuple[float, float]:
    ab = vec_sub(b, a)
    ab2 = dot(ab, ab)
    if ab2 <= 1e-6:
        return vec_length(vec_sub(query, a)), 0.0
    t = clamp(dot(vec_sub(query, a), ab) / ab2, 0.0, 1.0)
    closest = vec_add(a, vec_mul(ab, t))
    return vec_length(vec_sub(query, closest)), t


def nearest_distance_to_sampled_polyline_14093ED70(
    query: tuple[float, float, float],
    points: list[tuple[float, float, float]],
    seg_lengths: list[float],
    accum: list[float],
) -> tuple[float, float]:
    best_distance = float("inf")
    best_arclength = 0.0
    for index, (a, b) in enumerate(zip(points, points[1:])):
        distance_to_seg, t = distance_point_to_segment_with_param(query, a, b)
        if distance_to_seg < best_distance:
            best_distance = distance_to_seg
            best_arclength = accum[index] + seg_lengths[index] * t
    return best_distance, best_arclength


def sample_point_on_sampled_polyline_at_fraction_1402D55C0(
    points: list[tuple[float, float, float]],
    seg_lengths: list[float],
    accum: list[float],
    total_length: float,
    fraction: float,
) -> tuple[float, float, float]:
    if total_length <= 1e-6:
        return points[0]
    target = clamp(fraction, 0.0, 1.0) * total_length
    for index, seg_len in enumerate(seg_lengths):
        seg_start = accum[index]
        seg_end = accum[index + 1]
        if target <= seg_end or index == len(seg_lengths) - 1:
            if seg_len <= 1e-6:
                return points[index]
            t = clamp((target - seg_start) / seg_len, 0.0, 1.0)
            return vec_add(points[index], vec_mul(vec_sub(points[index + 1], points[index]), t))
    return points[-1]


def compute_composite_spline_nearest_global_t_1402D4FF0(
    query: tuple[float, float, float],
    points: list[tuple[float, float, float]],
    seg_lengths: list[float],
    accum: list[float],
    total_length: float,
) -> tuple[float, float]:
    nearest_distance, nearest_arclength = nearest_distance_to_sampled_polyline_14093ED70(query, points, seg_lengths, accum)
    if total_length <= 1e-6:
        return (0.0, nearest_distance)
    return (clamp(nearest_arclength / total_length, 0.0, 1.0), nearest_distance)


def compute_composite_spline_interval_scan_1414F3B30(
    query: tuple[float, float, float],
    points: list[tuple[float, float, float]],
    seg_lengths: list[float],
    accum: list[float],
    total_length: float,
    query_radius: float,
    sample_count: int,
) -> tuple[tuple[float, float] | None, float]:
    nearest_t, _nearest_distance = compute_composite_spline_nearest_global_t_1402D4FF0(
        query, points, seg_lengths, accum, total_length
    )
    if total_length <= 1e-6:
        sample_point = points[0]
        sample_distance = vec_length(vec_sub(sample_point, query))
        return ((0.0, 0.0), sample_distance) if sample_distance < query_radius else (None, sample_distance)

    window = (query_radius + query_radius) / total_length
    step = window / sample_count
    start = nearest_t - window
    end = start + window + window + step

    first_hit: float | None = None
    last_hit: float | None = None
    t = start
    while t < end:
        point = sample_point_on_sampled_polyline_at_fraction_1402D55C0(points, seg_lengths, accum, total_length, t)
        distance_to_query = vec_length(vec_sub(point, query))
        if distance_to_query < query_radius:
            hit_t = clamp(t, 0.0, 1.0)
            if first_hit is None:
                first_hit = hit_t
            last_hit = hit_t
        t += step

    representative_point = sample_point_on_sampled_polyline_at_fraction_1402D55C0(
        points, seg_lengths, accum, total_length, nearest_t
    )
    representative_distance = vec_length(vec_sub(representative_point, query))
    if first_hit is None or last_hit is None:
        return None, representative_distance
    return (first_hit, last_hit), representative_distance


def segment_param_interval_inside_radius(
    query: tuple[float, float, float],
    a: tuple[float, float, float],
    b: tuple[float, float, float],
    radius: float,
) -> tuple[float, float] | None:
    ab = vec_sub(b, a)
    aq = vec_sub(a, query)
    aa = dot(ab, ab)
    if aa <= 1e-6:
        if vec_length(aq) <= radius:
            return (0.0, 1.0)
        return None

    bb = 2.0 * dot(aq, ab)
    cc = dot(aq, aq) - radius * radius
    disc = bb * bb - 4.0 * aa * cc
    if disc < 0.0:
        if vec_length(aq) <= radius and vec_length(vec_sub(b, query)) <= radius:
            return (0.0, 1.0)
        return None

    root = math.sqrt(disc)
    lower = clamp(min((-bb - root) / (2.0 * aa), (-bb + root) / (2.0 * aa)), 0.0, 1.0)
    upper = clamp(max((-bb - root) / (2.0 * aa), (-bb + root) / (2.0 * aa)), 0.0, 1.0)
    if upper <= lower:
        if vec_length(aq) <= radius and vec_length(vec_sub(b, query)) <= radius:
            return (0.0, 1.0)
        return None
    return (lower, upper)


def compute_splinetube_lateral_interval_polyline_closure_14093ED40(
    query: tuple[float, float, float],
    points: list[tuple[float, float, float]],
    seg_lengths: list[float],
    accum: list[float],
    total_length: float,
    threshold: float,
) -> tuple[float, float] | None:
    hits: list[float] = []
    for index, (a, b) in enumerate(zip(points, points[1:])):
        local_interval = segment_param_interval_inside_radius(query, a, b, threshold)
        if local_interval is None:
            continue
        local_lower, local_upper = local_interval
        hits.append((accum[index] + seg_lengths[index] * local_lower) / total_length)
        hits.append((accum[index] + seg_lengths[index] * local_upper) / total_length)
    if not hits:
        return None
    return (min(hits), max(hits))


def compute_splinetube_radial_interval_polyline_closure_14093EE10(
    nearest_distance: float,
    tube_radius: float,
    query_radius: float,
) -> tuple[float, float]:
    return (
        clamp((nearest_distance - query_radius) / tube_radius, 0.0, 1.0),
        clamp((nearest_distance + query_radius) / tube_radius, 0.0, 1.0),
    )


def enumerate_planar_candidate_area_centers_for_splinetube_reverse_closure_14093EB60(
    field: NebulaFieldState,
    points: list[tuple[float, float, float]],
    tube_radius: float,
    query_radius: float,
) -> list[tuple[int, int, int]]:
    grid = build_query_grid_window_140760320(field.position_x, field.position_y, field.position_z)
    xs = [point[0] for point in points]
    zs = [point[2] for point in points]
    extension = tube_radius + query_radius
    min_x = min(xs) - extension
    max_x = max(xs) + extension
    min_z = min(zs) - extension
    max_z = max(zs) + extension

    start_x, end_x = compute_storage_axis_range_140760320(
        min_x, max_x, grid.origin_x, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )
    start_z, end_z = compute_storage_axis_range_140760320(
        min_z, max_z, grid.origin_z, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )

    coords: list[tuple[int, int, int]] = []
    x = start_x
    while x <= end_x:
        z = start_z
        while z <= end_z:
            coords.append((x, 0, z))
            z += int(AREA_SIZE)
        x += int(AREA_SIZE)
    return coords


def compute_uniform_profile_weight_for_40km_cylinder_14073F750(field: NebulaFieldState) -> float:
    if field.falloff.lateral_factor is None or field.falloff.radial_factor is None:
        raise ValueError("cylinder replay path requires precomputed lateral/radial factors")
    return f32(f32(field.falloff.lateral_factor) * f32(field.falloff.radial_factor))


def compute_cylinder_axial_interval_gas_reverse_14093DD10(
    field: NebulaFieldState,
    query: tuple[float, float, float],
) -> tuple[float, float]:
    p0 = (field.position_x, field.position_y, field.position_z)
    p1 = (field.position_x, field.position_y + field.linear, field.position_z)
    axis = vec_sub(p1, p0)
    axis_len = vec_length(axis)
    axis_sq = dot(axis, axis)
    t = dot(vec_sub(query, p0), axis) / axis_sq
    delta = QUERY_RADIUS_14073F750 / axis_len
    return (clamp(t - delta, 0.0, 1.0), clamp(t + delta, 0.0, 1.0))


def compute_cylinder_radial_interval_gas_reverse_14093DE40(
    field: NebulaFieldState,
    query: tuple[float, float, float],
) -> tuple[float, float]:
    p0 = (field.position_x, field.position_y, field.position_z)
    p1 = (field.position_x, field.position_y + field.linear, field.position_z)
    axis = vec_sub(p1, p0)
    axis_sq = dot(axis, axis)
    t = dot(vec_sub(query, p0), axis) / axis_sq
    closest = vec_add(p0, vec_mul(axis, t))
    distance_to_axis = vec_length(vec_sub(query, closest))
    return (
        clamp((distance_to_axis - QUERY_RADIUS_14073F750) / field.radius, 0.0, 1.0),
        clamp((distance_to_axis + QUERY_RADIUS_14073F750) / field.radius, 0.0, 1.0),
    )


def compute_cylinder_profile_weight_for_query_14073F750(
    field: NebulaFieldState,
    query: tuple[float, float, float],
) -> float:
    axial_interval = compute_cylinder_axial_interval_gas_reverse_14093DD10(field, query)
    radial_interval = compute_cylinder_radial_interval_gas_reverse_14093DE40(field, query)
    axial_weight = eval_profile_avg_1414ED970(field.falloff.lateral, axial_interval)
    radial_weight = eval_profile_avg_1414ED970(field.falloff.radial, radial_interval)
    return f32(f32(axial_weight) * f32(radial_weight))


def area_intersects_field_query_box_140E83FF0(
    field: NebulaFieldState,
    tile_x: int,
    tile_y: int,
    tile_z: int,
) -> bool:
    min_y = field.position_y
    max_y = field.position_y + field.linear
    tile_min_y = tile_y - AREA_HALF
    tile_max_y = tile_y + AREA_HALF
    overlaps_y = not (tile_max_y < min_y or tile_min_y > max_y)
    if not overlaps_y:
        return False

    dx = abs(field.position_x - tile_x)
    dz = abs(field.position_z - tile_z)
    clamped_dx = max(dx - AREA_HALF, 0.0)
    clamped_dz = max(dz - AREA_HALF, 0.0)
    return (clamped_dx * clamped_dx + clamped_dz * clamped_dz) <= (field.radius * field.radius)


def enumerate_candidate_area_centers_for_64k_query_boxes_140760320(
    field: NebulaFieldState,
) -> list[tuple[int, int, int]]:
    grid = build_query_grid_window_140760320(field.position_x, field.position_y, field.position_z)
    min_x = field.position_x - field.radius - AREA_HALF
    max_x = field.position_x + field.radius + AREA_HALF
    min_y = field.position_y - AREA_HALF
    max_y = field.position_y + field.linear + AREA_HALF
    min_z = field.position_z - field.radius - AREA_HALF
    max_z = field.position_z + field.radius + AREA_HALF

    start_x, end_x = compute_storage_axis_range_140760320(
        min_x, max_x, grid.origin_x, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )
    start_y, end_y = compute_storage_axis_range_140760320(
        min_y, max_y, grid.origin_y, SAVE_GRID_MIN_CENTER_Y, SAVE_GRID_MAX_CENTER_Y
    )
    start_z, end_z = compute_storage_axis_range_140760320(
        min_z, max_z, grid.origin_z, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )

    coords: list[tuple[int, int, int]] = []
    x = start_x
    while x <= end_x:
        y = start_y
        while y <= end_y:
            z = start_z
            while z <= end_z:
                world_coord = world_coord_from_storage_coord_140760320(grid, (x, y, z))
                if area_intersects_field_query_box_140E83FF0(field, *world_coord):
                    coords.append((x, y, z))
                z += int(AREA_SIZE)
            y += int(AREA_SIZE)
        x += int(AREA_SIZE)
    return coords


def replay_cylinder_field_1407603F0(field: NebulaFieldState) -> dict[str, object]:
    if len(field.resources) != 1:
        raise ValueError("legacy cylinder replay path expects one gas resource row")
    resource = field.resources[0]
    tile_coords = enumerate_candidate_area_centers_for_64k_query_boxes_140760320(field)
    per_tile: list[dict[str, object]] = []
    total = 0
    if resource_field_is_enabled_140e802d0(resource):
        base_multiplier = compute_resource_field_base_multiplier_140e80260(field, resource)
    else:
        base_multiplier = 0.0
    grid = build_query_grid_window_140760320(field.position_x, field.position_y, field.position_z)
    for coord in tile_coords:
        if base_multiplier <= 0.0:
            falloff_weight = 0.0
            tile_value = 0
        else:
            world_coord = world_coord_from_storage_coord_140760320(grid, coord)
            query = (float(world_coord[0]), float(world_coord[1]), float(world_coord[2]))
            falloff_weight = compute_cylinder_profile_weight_for_query_14073F750(field, query)
            tile_value = truncate_to_runtime_int(f32(f32(base_multiplier) * f32(falloff_weight)))
        total += tile_value
        per_tile.append(
            {
                "coord": coord,
                "world_coord": world_coord_from_storage_coord_140760320(grid, coord),
                "falloff_weight": falloff_weight,
                resource.ware_key: tile_value,
            }
        )
    return {
        "field": field.name,
        "boundary_class": field.boundary_class,
        "tile_count": len(tile_coords),
        "tile_coords": sorted(tile_coords),
        "per_tile": per_tile,
        "ware_totals": {resource.ware_key: total},
        "grid_window": grid,
    }


def replay_splinetube_field_planar_reverse_closure_1407603F0(
    field: NebulaFieldState,
) -> dict[str, object]:
    bezier_points = build_sampled_spline_points_from_region_bezier_closure_14093E5C0(field)
    sampled_points = build_runtime_sampled_splinetube_points_14078EAC0(field)
    seg_lengths, accum, total_length = build_polyline_arclength_table_from_sampled_points_14093E5C0(sampled_points)
    threshold = QUERY_RADIUS_14073F750 + field.radius
    grid = build_query_grid_window_140760320(field.position_x, field.position_y, field.position_z)
    candidate_tiles = enumerate_planar_candidate_area_centers_for_splinetube_reverse_closure_14093EB60(
        field,
        sampled_points,
        field.radius,
        QUERY_RADIUS_14073F750,
    )

    per_tile: list[dict[str, object]] = []
    ware_totals = {resource.ware_key: 0 for resource in field.resources}

    for coord in candidate_tiles:
        world_coord = world_coord_from_storage_coord_140760320(grid, coord)
        query = (float(world_coord[0]), float(world_coord[1]), float(world_coord[2]))
        lateral_interval, representative_distance = compute_composite_spline_interval_scan_1414F3B30(
            query,
            sampled_points,
            seg_lengths,
            accum,
            total_length,
            threshold,
            SPLINETUBE_INTERVAL_SAMPLE_COUNT_14093ED40,
        )
        if lateral_interval is None:
            continue

        radial_interval = compute_splinetube_radial_interval_polyline_closure_14093EE10(
            representative_distance,
            field.radius,
            QUERY_RADIUS_14073F750,
        )

        lateral_weight = eval_profile_avg_1414ED970(field.falloff.lateral, lateral_interval)
        radial_weight = eval_profile_avg_1414ED970(field.falloff.radial, radial_interval)
        tile_weight = lateral_weight * radial_weight

        tile_entry: dict[str, object] = {
            "coord": coord,
            "world_coord": world_coord,
            "representative_distance": representative_distance,
            "lateral_interval": lateral_interval,
            "radial_interval": radial_interval,
            "lateral_weight": lateral_weight,
            "radial_weight": radial_weight,
            "tile_weight": tile_weight,
        }
        for resource in field.resources:
            if not resource_field_is_enabled_140e802d0(resource):
                tile_value = 0
            else:
                base_multiplier = compute_resource_field_base_multiplier_140e80260(field, resource)
                tile_value = truncate_to_runtime_int(f32(f32(base_multiplier) * f32(tile_weight)))
            tile_entry[resource.ware_key] = tile_value
            ware_totals[resource.ware_key] += tile_value
        per_tile.append(tile_entry)

    return {
        "field": field.name,
        "boundary_class": field.boundary_class,
        "tile_count": len(per_tile),
        "tile_coords": [entry["coord"] for entry in per_tile],
        "per_tile": per_tile,
        "ware_totals": ware_totals,
        "sampled_point_count": len(bezier_points),
        "sampled_segment_count": len(bezier_points) - 1,
        "runtime_sampled_point_count": len(sampled_points),
        "runtime_sampled_segment_count": len(sampled_points) - 1,
        "query_radius": QUERY_RADIUS_14073F750,
        "grid_window": grid,
    }


def enumerate_planar_candidate_area_centers_for_sphere_reverse_closure_14093D1D0(
    field: NebulaFieldState,
) -> list[tuple[int, int, int]]:
    grid = build_query_grid_window_140760320(field.position_x, field.position_y, field.position_z)
    extension = field.radius + QUERY_RADIUS_14073F750
    min_x = field.position_x - extension
    max_x = field.position_x + extension
    min_y = field.position_y - extension
    max_y = field.position_y + extension
    min_z = field.position_z - extension
    max_z = field.position_z + extension
    start_x, end_x = compute_storage_axis_range_140760320(
        min_x, max_x, grid.origin_x, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )
    start_y, end_y = compute_storage_axis_range_140760320(
        min_y, max_y, grid.origin_y, SAVE_GRID_MIN_CENTER_Y, SAVE_GRID_MAX_CENTER_Y
    )
    start_z, end_z = compute_storage_axis_range_140760320(
        min_z, max_z, grid.origin_z, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )
    coords: list[tuple[int, int, int]] = []
    x = start_x
    while x <= end_x:
        y = start_y
        while y <= end_y:
            z = start_z
            while z <= end_z:
                coords.append((x, y, z))
                z += int(AREA_SIZE)
            y += int(AREA_SIZE)
        x += int(AREA_SIZE)
    return coords


def compute_sphere_radial_interval_14093D1D0(
    field: NebulaFieldState,
    query: tuple[float, float, float],
) -> tuple[float, float]:
    center = (field.position_x, field.position_y, field.position_z)
    distance_to_center = vec_length(vec_sub(query, center))
    return (
        clamp((distance_to_center - QUERY_RADIUS_14073F750) / field.radius, 0.0, 1.0),
        clamp((distance_to_center + QUERY_RADIUS_14073F750) / field.radius, 0.0, 1.0),
    )


def replay_sphere_field_planar_reverse_closure_1407603F0(
    field: NebulaFieldState,
) -> dict[str, object]:
    per_tile: list[dict[str, object]] = []
    ware_totals = {resource.ware_key: 0 for resource in field.resources}
    center = (field.position_x, field.position_y, field.position_z)
    threshold = field.radius + QUERY_RADIUS_14073F750
    grid = build_query_grid_window_140760320(field.position_x, field.position_y, field.position_z)

    for coord in enumerate_planar_candidate_area_centers_for_sphere_reverse_closure_14093D1D0(field):
        world_coord = world_coord_from_storage_coord_140760320(grid, coord)
        query = (float(world_coord[0]), float(world_coord[1]), float(world_coord[2]))
        distance_to_center = vec_length(vec_sub(query, center))
        if distance_to_center > threshold:
            continue
        radial_interval = compute_sphere_radial_interval_14093D1D0(field, query)
        radial_weight = eval_profile_avg_1414ED970(field.falloff.radial, radial_interval)
        tile_entry: dict[str, object] = {
            "coord": coord,
            "world_coord": world_coord,
            "radial_interval": radial_interval,
            "radial_weight": radial_weight,
            "tile_weight": radial_weight,
        }
        for resource in field.resources:
            if not resource_field_is_enabled_140e802d0(resource):
                tile_value = 0
            else:
                base_multiplier = compute_resource_field_base_multiplier_140e80260(field, resource)
                tile_value = truncate_to_runtime_int(f32(f32(base_multiplier) * f32(radial_weight)))
            tile_entry[resource.ware_key] = tile_value
            ware_totals[resource.ware_key] += tile_value
        per_tile.append(tile_entry)

    return {
        "field": field.name,
        "boundary_class": field.boundary_class,
        "tile_count": len(per_tile),
        "tile_coords": [entry["coord"] for entry in per_tile],
        "per_tile": per_tile,
        "ware_totals": ware_totals,
        "query_radius": QUERY_RADIUS_14073F750,
        "grid_window": grid,
    }


def enumerate_planar_candidate_area_centers_for_box_reverse_closure_14093CAC0(
    field: NebulaFieldState,
) -> list[tuple[int, int, int]]:
    grid = build_query_grid_window_140760320(field.position_x, field.position_y, field.position_z)
    extension_x = field.size_x + QUERY_RADIUS_14073F750
    extension_y = field.size_y + QUERY_RADIUS_14073F750
    extension_z = field.size_z + QUERY_RADIUS_14073F750
    min_x = field.position_x - extension_x
    max_x = field.position_x + extension_x
    min_y = field.position_y - extension_y
    max_y = field.position_y + extension_y
    min_z = field.position_z - extension_z
    max_z = field.position_z + extension_z
    start_x, end_x = compute_storage_axis_range_140760320(
        min_x, max_x, grid.origin_x, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )
    start_y, end_y = compute_storage_axis_range_140760320(
        min_y, max_y, grid.origin_y, SAVE_GRID_MIN_CENTER_Y, SAVE_GRID_MAX_CENTER_Y
    )
    start_z, end_z = compute_storage_axis_range_140760320(
        min_z, max_z, grid.origin_z, SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )
    coords: list[tuple[int, int, int]] = []
    x = start_x
    while x <= end_x:
        y = start_y
        while y <= end_y:
            z = start_z
            while z <= end_z:
                coords.append((x, y, z))
                z += int(AREA_SIZE)
            y += int(AREA_SIZE)
        x += int(AREA_SIZE)
    return coords


def compute_box_normalized_scalar_14093CA30(
    field: NebulaFieldState,
    query: tuple[float, float, float],
) -> float:
    dx = abs(query[0] - field.position_x)
    dy = abs(query[1] - field.position_y)
    dz = abs(query[2] - field.position_z)
    return max(
        dx / field.size_x if field.size_x > 0.0 else float("inf"),
        dy / field.size_y if field.size_y > 0.0 else float("inf"),
        dz / field.size_z if field.size_z > 0.0 else float("inf"),
    )


def compute_box_interval_14093CAC0(
    field: NebulaFieldState,
    query: tuple[float, float, float],
) -> tuple[float, float]:
    dx = abs(query[0] - field.position_x)
    dy = abs(query[1] - field.position_y)
    dz = abs(query[2] - field.position_z)
    lower = max(
        clamp((dx - QUERY_RADIUS_14073F750) / field.size_x, 0.0, 1.0) if field.size_x > 0.0 else 1.0,
        clamp((dy - QUERY_RADIUS_14073F750) / field.size_y, 0.0, 1.0) if field.size_y > 0.0 else 1.0,
        clamp((dz - QUERY_RADIUS_14073F750) / field.size_z, 0.0, 1.0) if field.size_z > 0.0 else 1.0,
    )
    upper = min(
        max(
            clamp((dx + QUERY_RADIUS_14073F750) / field.size_x, 0.0, 1.0) if field.size_x > 0.0 else 1.0,
            clamp((dy + QUERY_RADIUS_14073F750) / field.size_y, 0.0, 1.0) if field.size_y > 0.0 else 1.0,
            clamp((dz + QUERY_RADIUS_14073F750) / field.size_z, 0.0, 1.0) if field.size_z > 0.0 else 1.0,
        ),
        1.0,
    )
    return (lower, upper)


def replay_box_field_planar_reverse_closure_1407603F0(
    field: NebulaFieldState,
) -> dict[str, object]:
    per_tile: list[dict[str, object]] = []
    ware_totals = {resource.ware_key: 0 for resource in field.resources}
    grid = build_query_grid_window_140760320(field.position_x, field.position_y, field.position_z)

    for coord in enumerate_planar_candidate_area_centers_for_box_reverse_closure_14093CAC0(field):
        world_coord = world_coord_from_storage_coord_140760320(grid, coord)
        query = (float(world_coord[0]), float(world_coord[1]), float(world_coord[2]))
        normalized_scalar = compute_box_normalized_scalar_14093CA30(field, query)
        if normalized_scalar > (1.0 + (QUERY_RADIUS_14073F750 / min(v for v in (field.size_x, field.size_y, field.size_z) if v > 0.0))):
            continue
        radial_interval = compute_box_interval_14093CAC0(field, query)
        radial_weight = eval_profile_avg_1414ED970(field.falloff.radial, radial_interval)
        tile_entry: dict[str, object] = {
            "coord": coord,
            "world_coord": world_coord,
            "radial_interval": radial_interval,
            "radial_weight": radial_weight,
            "tile_weight": radial_weight,
        }
        for resource in field.resources:
            if not resource_field_is_enabled_140e802d0(resource):
                tile_value = 0
            else:
                base_multiplier = compute_resource_field_base_multiplier_140e80260(field, resource)
                tile_value = truncate_to_runtime_int(f32(f32(base_multiplier) * f32(radial_weight)))
            tile_entry[resource.ware_key] = tile_value
            ware_totals[resource.ware_key] += tile_value
        per_tile.append(tile_entry)

    return {
        "field": field.name,
        "boundary_class": field.boundary_class,
        "tile_count": len(per_tile),
        "tile_coords": [entry["coord"] for entry in per_tile],
        "per_tile": per_tile,
        "ware_totals": ware_totals,
        "query_radius": QUERY_RADIUS_14073F750,
        "grid_window": grid,
    }


def replay_gas_area_values_for_field_1407603F0(field: NebulaFieldState) -> dict[str, object]:
    if field.boundary_class == "cylinder":
        return replay_cylinder_field_1407603F0(field)
    if field.boundary_class == "sphere":
        return replay_sphere_field_planar_reverse_closure_1407603F0(field)
    if field.boundary_class == "box":
        return replay_box_field_planar_reverse_closure_1407603F0(field)
    if field.boundary_class == "splinetube":
        return replay_splinetube_field_planar_reverse_closure_1407603F0(field)
    raise ValueError(f"unsupported gas boundary class for replay: {field.boundary_class}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Replay one gas field from curated JSON sector data.")
    parser.add_argument("sector_id", nargs="?", default="Cluster_06_Sector001_macro")
    parser.add_argument("field_ref", nargs="?", default="p1_40km_methane_field")
    return parser.parse_args()


def describe_hit_check_mode() -> str:
    return (
        "reverse: cylinder 用有限高圆柱与 64k query box 相交；"
        "sphere 用半径归一化区间；"
        "box 用 box 度量归一化区间；"
        "splinetube 用 raw spline + raw falloff + query_radius=55425.625 的 planar box replay"
    )


def main() -> None:
    args = parse_args()
    field = build_nebula_field_from_sector_area_json_140e860c0(args.sector_id, args.field_ref)
    result = replay_gas_area_values_for_field_1407603F0(field)

    # Load save sample data for comparison
    save_tiles_by_ware: dict[str, dict] = {}
    save_total_by_ware: dict[str, dict] = {}
    for resource in field.resources:
        ware_key = resource.ware_key
        yield_name = resource.yield_name
        save_tiles_by_ware[ware_key] = load_save_sample_for_ware(args.sector_id, ware_key, yield_name)
        save_total_by_ware[ware_key] = load_total_sample_for_ware(args.sector_id, ware_key, yield_name)

    print(f"field={result['field']}")
    print(f"boundary_class={result['boundary_class']}")
    print("hit_check_mode=reverse")
    print(f"hit_check_note={describe_hit_check_mode()}")
    print(f"tile_count={result['tile_count']}")
    if "sampled_point_count" in result:
        print(f"sampled_point_count={result['sampled_point_count']}")
        print(f"sampled_segment_count={result['sampled_segment_count']}")
        print(f"query_radius={result['query_radius']:.6f}")
    print("ware_totals:")
    for ware_key, total in result["ware_totals"].items():
        print(f"  {ware_key}={total}")
    print("tile_values:")
    replay_total_by_ware: dict[str, int] = {ware_key: 0 for ware_key in result["ware_totals"].keys()}
    for entry in result["per_tile"]:
        coord = entry["coord"]
        values = [f"{key}={entry[key]}" for key in result["ware_totals"].keys()]
        print(f"  {coord} " + " ".join(values), end="")

        # Compare with save sample for each ware
        compare_parts = []
        for ware_key in result["ware_totals"].keys():
            tile_value = entry.get(ware_key, 0)
            replay_total_by_ware[ware_key] += tile_value
            save_tiles = save_tiles_by_ware.get(ware_key, {})
            save_row = save_tiles.get(coord)
            save_value = None if save_row is None else int(save_row.get("max", 0))
            error_ratio = None
            if save_value not in (None, 0):
                error_ratio = (tile_value - save_value) / save_value
            compare_parts.append(f"{ware_key}:save={save_value if save_value is not None else 'N/A'},err={f'{error_ratio:.4%}' if error_ratio is not None else 'N/A'}")
        print(" | " + " ".join(compare_parts))

    print("total_compare:")
    for ware_key in result["ware_totals"].keys():
        replay_total = replay_total_by_ware[ware_key]
        save_total = save_total_by_ware.get(ware_key, {})
        print(f"  {ware_key}: replay={replay_total}", end="")
        if save_total and "max" in save_total and int(save_total["max"]) != 0:
            total_error_ratio = (replay_total - int(save_total["max"])) / int(save_total["max"])
            print(f" save={int(save_total['max'])} error_ratio={total_error_ratio:.4%}")
        else:
            print(" save=N/A error_ratio=N/A")


if __name__ == "__main__":
    main()
