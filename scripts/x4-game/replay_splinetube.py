#!/usr/bin/env python3
"""Splinetube gas field replay - reverse engineered from FUN_14075bd20.

All functions are implemented from C++ decompilation.
Grid enumeration uses the verified approach from gas_sum_weights_replay.py.
"""

from __future__ import annotations

import math
import struct
from dataclasses import dataclass, field
from typing import Any

# Constants from C++ DAT_*
AREA_SIZE = 64000.0
AREA_HALF = AREA_SIZE / 2.0
QUERY_RADIUS = 55425.625
DAT_142d7ff50 = 0.5
DAT_142d7fbe8 = 1e-6

# Save grid limits
SAVE_GRID_MIN_CENTER_XZ = -960000
SAVE_GRID_MAX_CENTER_XZ = 1024000
SAVE_GRID_MIN_CENTER_Y = -960000
SAVE_GRID_MAX_CENTER_Y = 1024000


def f32(value: float) -> float:
    return struct.unpack("<f", struct.pack("<f", float(value)))[0]


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


@dataclass
class ProfilePoint:
    position: float
    value: float


@dataclass
class TileResult:
    coord: tuple[int, int, int]
    world_pos: tuple[float, float, float]
    lateral_interval: tuple[float, float]
    radial_interval: tuple[float, float]
    weight: float
    ware_values: dict[str, int]


@dataclass
class FieldState:
    """Runtime state for field processing."""
    tile_results: list[TileResult] = field(default_factory=list)
    ware_totals: dict[str, int] = field(default_factory=dict)


@dataclass
class QueryGridWindow:
    origin_x: int
    origin_y: int
    origin_z: int


# ============================================================================
# Vector operations
# ============================================================================

def vec3_add(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])

def vec3_sub(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])

def vec3_mul(a: tuple[float, float, float], s: float) -> tuple[float, float, float]:
    return (a[0] * s, a[1] * s, a[2] * s)

def vec3_dot(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

def vec3_length(a: tuple[float, float, float]) -> float:
    return math.sqrt(vec3_dot(a, a))


# ============================================================================
# FUN_140760320 - Grid coordinate utilities (VERIFIED)
# ============================================================================

def compute_axis_storage_origin_140760320(position: float, max_center: int) -> int:
    """Computes storage origin for an axis.

    Corresponds to FUN_140760320.
    """
    if abs(position) <= max_center:
        return 0
    return int(math.floor(position / AREA_SIZE) * AREA_SIZE)


def build_query_grid_window_140760320(
    position_x: float,
    position_y: float,
    position_z: float,
) -> QueryGridWindow:
    """Builds grid window for coordinate transformation.

    Corresponds to FUN_140760320.
    """
    return QueryGridWindow(
        origin_x=compute_axis_storage_origin_140760320(position_x, SAVE_GRID_MAX_CENTER_XZ),
        origin_y=compute_axis_storage_origin_140760320(position_y, SAVE_GRID_MAX_CENTER_Y),
        origin_z=compute_axis_storage_origin_140760320(position_z, SAVE_GRID_MAX_CENTER_XZ),
    )


def world_coord_from_storage_coord_140760320(
    grid: QueryGridWindow,
    coord: tuple[int, int, int],
) -> tuple[int, int, int]:
    """Converts storage coordinate to world coordinate.

    Corresponds to FUN_140760320.
    """
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
    """Computes storage axis range from world bounds.

    Corresponds to FUN_140760320.
    """
    start = max(int(math.floor((min_world - origin) / AREA_SIZE) * int(AREA_SIZE)), min_center)
    end = min(int(math.floor((max_world - origin) / AREA_SIZE) * int(AREA_SIZE)), max_center)
    return start, end


# ============================================================================
# FUN_1414ed970 - Profile average (VERIFIED)
# ============================================================================

def eval_profile_avg_1414ED970(profile: list[ProfilePoint], interval: tuple[float, float]) -> float:
    """Computes average value over interval using trapezoid integration.

    Corresponds to FUN_1414ed970.
    """
    if not profile:
        return 1.0

    lower, upper = interval
    if upper <= lower:
        return 0.0

    def value_at(x: float) -> float:
        if x <= profile[0].position:
            return profile[0].value
        for i in range(len(profile) - 1):
            left, right = profile[i], profile[i + 1]
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
    for i in range(len(xs) - 1):
        x0, x1 = xs[i], xs[i + 1]
        y0, y1 = value_at(x0), value_at(x1)
        area += (y0 + y1) * DAT_142d7ff50 * (x1 - x0)

    return area / (upper - lower)


# ============================================================================
# FUN_14093ed70 - Nearest distance to sampled polyline (VERIFIED)
# ============================================================================

def nearest_distance_to_polyline_14093ED70(
    query: tuple[float, float, float],
    points: list[tuple[float, float, float]],
    seg_lengths: list[float],
    accum: list[float],
) -> tuple[float, float]:
    """Finds nearest distance from query point to polyline.

    Corresponds to FUN_14093ed70.
    Returns (distance, normalized_arclength).
    """
    best_dist = float('inf')
    best_t = 0.0
    total = accum[-1] if accum else 0.0

    for i, (a, b) in enumerate(zip(points, points[1:])):
        ab = vec3_sub(b, a)
        ab2 = vec3_dot(ab, ab)

        if ab2 <= 1e-6:
            dist = vec3_length(vec3_sub(query, a))
            t = 0.0
        else:
            t = clamp(vec3_dot(vec3_sub(query, a), ab) / ab2, 0.0, 1.0)
            closest = vec3_add(a, vec3_mul(ab, t))
            dist = vec3_length(vec3_sub(query, closest))

        if dist < best_dist:
            best_dist = dist
            best_t = (accum[i] + seg_lengths[i] * t) / total if total > 0 else 0.0

    return best_dist, best_t


# ============================================================================
# FUN_14093ee10 - Radial interval for splinetube (VERIFIED)
# ============================================================================

def compute_radial_interval_14093EE10(
    distance: float,
    tube_radius: float,
    query_radius: float,
) -> tuple[float, float]:
    """Computes radial interval normalized by tube radius.

    Corresponds to FUN_14093ee10.
    """
    lower = (distance - query_radius) / tube_radius
    upper = (distance + query_radius) / tube_radius

    lower = max(0.0, lower)
    upper = min(1.0, upper)

    if lower > upper:
        lower = upper

    return (lower, upper)


# ============================================================================
# FUN_1414f3b30 - Composite spline interval scan (VERIFIED)
# ============================================================================

def sample_polyline_at_arclength(
    points: list[tuple[float, float, float]],
    seg_lengths: list[float],
    accum: list[float],
    target: float,
) -> tuple[float, float, float]:
    """Samples point at given arclength."""
    for i, seg_len in enumerate(seg_lengths):
        seg_start = accum[i]
        seg_end = accum[i + 1]
        if target <= seg_end or i == len(seg_lengths) - 1:
            if seg_len <= 1e-6:
                return points[i]
            local_t = clamp((target - seg_start) / seg_len, 0.0, 1.0)
            return vec3_add(points[i], vec3_mul(vec3_sub(points[i + 1], points[i]), local_t))
    return points[-1]


def compute_lateral_interval_1414F3B30(
    query: tuple[float, float, float],
    points: list[tuple[float, float, float]],
    seg_lengths: list[float],
    accum: list[float],
    total_length: float,
    query_radius: float,
    sample_count: int = 5,
) -> tuple[tuple[float, float] | None, float]:
    """Scans along spline to find lateral parameter interval.

    Corresponds to FUN_1414f3b30.
    Returns (interval, representative_distance).
    """
    if total_length <= 1e-6:
        return (0.0, 0.0), vec3_length(vec3_sub(points[0], query))

    dist, nearest_t = nearest_distance_to_polyline_14093ED70(query, points, seg_lengths, accum)

    window = (query_radius + query_radius) / total_length
    step = window / sample_count
    start_t = nearest_t - window
    end_t = nearest_t + window + step

    first_hit = None
    last_hit = None

    t = start_t
    while t < end_t:
        target = clamp(t, 0.0, 1.0) * total_length
        point = sample_polyline_at_arclength(points, seg_lengths, accum, target)

        d = vec3_length(vec3_sub(point, query))
        if d < query_radius:
            hit_t = clamp(t, 0.0, 1.0)
            if first_hit is None:
                first_hit = hit_t
            last_hit = hit_t

        t += step

    if first_hit is None or last_hit is None:
        return None, dist

    return (first_hit, last_hit), dist


# ============================================================================
# FUN_14075c250 - Tile enumeration (simplified, equivalent result)
# ============================================================================

def enumerate_tile_grid_14075C250(
    points: list[tuple[float, float, float]],
    tube_radius: float,
    query_radius: float,
    grid: QueryGridWindow,
) -> list[tuple[int, int, int]]:
    """Enumerates candidate tiles for splinetube.

    Corresponds to FUN_14075c250 recursive subdivision.
    Uses simple grid enumeration which produces equivalent tiles.

    IMPORTANT: This is a 3D enumeration, not just 2D planar.
    The C++ code has a 2x2x2 recursive subdivision for all three axes.
    """
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    zs = [point[2] for point in points]
    extension = tube_radius + query_radius
    min_x = min(xs) - extension
    max_x = max(xs) + extension
    min_y = min(ys) - extension
    max_y = max(ys) + extension
    min_z = min(zs) - extension
    max_z = max(zs) + extension

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


# ============================================================================
# FUN_14075cc00 - Aggregate results
# ============================================================================

def aggregate_results_14075CC00(field_state: FieldState) -> None:
    """Aggregates tile results into totals.

    Corresponds to FUN_14075cc00.
    """
    field_state.ware_totals = {}

    for result in field_state.tile_results:
        for ware_key, value in result.ware_values.items():
            field_state.ware_totals[ware_key] = field_state.ware_totals.get(ware_key, 0) + value


# ============================================================================
# Helper: Build spline sample data (using uniform parameter sampling)
# ============================================================================

SPLINETUBE_SEGMENT_COUNT_DEFAULT = 2000


def sample_composite_spline_uniform_param(
    spline_control_points: list,
    t: float,
) -> tuple[float, float, float]:
    """Samples the composite spline at uniform parameter t.

    Corresponds to FUN_1402d55c0.
    Uses uniform parameter across all segments, not per-segment sampling.
    """
    segment_count = len(spline_control_points) - 1
    if segment_count <= 0:
        raise ValueError("splinetube requires at least two spline control points")

    t = clamp(t, 0.0, 1.0)
    scaled = t * segment_count
    seg_index = min(int(scaled), segment_count - 1)
    local_t = scaled - seg_index

    if t >= 1.0:
        seg_index = segment_count - 1
        local_t = 1.0

    left = spline_control_points[seg_index]
    right = spline_control_points[seg_index + 1]

    p0 = (left.x, left.y, left.z)
    p1 = (right.x, right.y, right.z)
    c0 = (left.x + left.tx * left.outlength, left.y + left.ty * left.outlength, left.z + left.tz * left.outlength)
    c1 = (right.x - right.tx * right.inlength, right.y - right.ty * right.inlength, right.z - right.tz * right.inlength)

    return cubic_bezier(p0, c0, c1, p1, local_t)


def build_spline_boundary_data(spline_control_points: list, tube_radius: float) -> dict:
    """Builds boundary data structure for splinetube.

    Uses uniform parameter sampling across all segments.
    Corresponds to FUN_14078eac0.
    """
    points = []

    # Sample at uniform parameter intervals across entire spline
    for index in range(SPLINETUBE_SEGMENT_COUNT_DEFAULT + 1):
        t = index / SPLINETUBE_SEGMENT_COUNT_DEFAULT
        point = sample_composite_spline_uniform_param(spline_control_points, t)
        points.append(point)

    seg_lengths = []
    accum = [0.0]
    total = 0.0

    for a, b in zip(points, points[1:]):
        seg_len = vec3_length(vec3_sub(b, a))
        seg_lengths.append(seg_len)
        total += seg_len
        accum.append(total)

    return {
        'points': points,
        'seg_lengths': seg_lengths,
        'accum': accum,
        'total_length': total,
        'radius': tube_radius
    }


def cubic_bezier(p0, c0, c1, p1, t):
    omt = 1.0 - t
    omt2 = omt * omt
    omt3 = omt2 * omt
    t2 = t * t
    t3 = t2 * t
    return vec3_add(
        vec3_add(vec3_mul(p0, omt3), vec3_mul(c0, 3.0 * omt2 * t)),
        vec3_add(vec3_mul(c1, 3.0 * omt * t2), vec3_mul(p1, t3))
    )


# ============================================================================
# FUN_1414ef820 - Bounding box calculation
# ============================================================================

def compute_bounding_box_1414EF820(
    points: list[tuple[float, float, float]],
    extension: float,
) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    """Computes axis-aligned bounding box.

    Corresponds to FUN_1414ef820.
    """
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    zs = [p[2] for p in points]

    return (
        (min(xs) - extension, min(ys) - extension, min(zs) - extension),
        (max(xs) + extension, max(ys) + extension, max(zs) + extension)
    )


# ============================================================================
# FUN_14093bf90 - Compute weight via boundary vtable
# ============================================================================

def compute_weight_14093BF90(
    boundary_list: list,
    lateral_profile: list[ProfilePoint],
    radial_profile: list[ProfilePoint],
    local_pos: tuple[float, float, float],
    query_radius: float,
) -> float:
    """Computes weight for a tile position.

    Corresponds to FUN_14093bf90.
    Iterates boundary list and accumulates weight contributions.
    """
    DAT_142d800e8 = 1.0

    weight = DAT_142d800e8

    for boundary in boundary_list:
        # Compute lateral interval (vtable+0x58)
        lateral_interval, _ = compute_lateral_interval_1414F3B30(
            local_pos, boundary['points'], boundary['seg_lengths'],
            boundary['accum'], boundary['total_length'], query_radius
        )

        if lateral_interval is None:
            return 0.0

        lateral_weight = eval_profile_avg_1414ED970(lateral_profile, lateral_interval)

        # Compute radial interval (vtable+0x70)
        distance, _ = nearest_distance_to_polyline_14093ED70(
            local_pos, boundary['points'], boundary['seg_lengths'], boundary['accum']
        )
        radial_interval = compute_radial_interval_14093EE10(
            distance, boundary['radius'], query_radius
        )

        radial_weight = eval_profile_avg_1414ED970(radial_profile, radial_interval)

        weight = weight * (lateral_weight * radial_weight)

    return weight


# ============================================================================
# FUN_14073f750 - Compute tile contribution
# ============================================================================

def compute_tile_contribution_14073F750(
    field_state: FieldState,
    field,
    tile_center: tuple[float, float, float],
    boundary_data: dict,
) -> float:
    """Computes contribution for a single tile.

    Corresponds to FUN_14073f750.
    Returns the weight value.
    """
    # Compute weight via FUN_14093bf90
    weight = compute_weight_14093BF90(
        [boundary_data],
        field.falloff.lateral,
        field.falloff.radial,
        tile_center,
        QUERY_RADIUS
    )

    if weight <= DAT_142d7fbe8:
        return 0.0

    return weight


# ============================================================================
# FUN_14075bd20 - Grid origin calculation (from C++ decompilation)
# ============================================================================

def floor_to_int(f: float) -> int:
    """C++ style floor for positive and negative numbers."""
    i = int(f)
    if f < 0 and f != i:
        return i - 1
    return i


def compute_grid_origin_and_depth_14075BD20(
    min_corner: tuple[float, float, float],
    max_corner: tuple[float, float, float],
) -> tuple[tuple[float, float, float], int]:
    """Computes grid origin and depth from bounding box.

    Corresponds to FUN_14075bd20 lines 150-210.

    C++ logic:
    1. Compute bbox size
    2. Clamp to [-800000, 800000]
    3. Convert min/max to grid indices (floor(pos * 1/64000))
    4. Compute grid center index = floor((min_idx + max_idx) / 2)
    5. grid_origin = center_idx * 64000 + 32000
    6. depth = log2(bbox_size * 0.5 / 64000)
    """
    DAT_142d84300 = 800000.0  # max clamp
    DAT_142d84580 = -800000.0  # min clamp
    DAT_142d83660 = 1.5625e-05  # 1/64000
    DAT_142d842b0 = 64000.0
    DAT_142d84280 = 32000.0
    DAT_142d80994 = 64000.0
    DAT_142d7ff50 = 0.5

    # Step 1: Compute bbox size
    bbox_size = (
        max_corner[0] - min_corner[0],
        max_corner[1] - min_corner[1],
        max_corner[2] - min_corner[2],
    )

    # Step 2: Clamp size to [-800000, 800000] (C++ lines 170-175)
    # maxps(auVar34, auVar31) then minps with auVar43
    clamped_size = tuple(
        max(DAT_142d84580, min(DAT_142d84300, s)) for s in bbox_size
    )

    # Step 3: Convert min/max to grid indices
    # C++ lines 176-192: multiply by 1/64000 and floor
    min_grid_idx = tuple(floor_to_int(c * DAT_142d83660) for c in min_corner)
    max_grid_idx = tuple(floor_to_int(c * DAT_142d83660) for c in max_corner)

    # Step 4: Compute grid center index
    # C++ lines 201-215: (max_idx + min_idx) * (1/2) then floor
    grid_center_idx = tuple(
        floor_to_int((min_grid_idx[i] + max_grid_idx[i]) * DAT_142d7ff50)
        for i in range(3)
    )

    # Step 5: Final grid_origin
    # C++ line 216: grid_origin = center_idx * 64000 + 32000
    grid_origin = tuple(
        grid_center_idx[i] * DAT_142d842b0 + DAT_142d84280
        for i in range(3)
    )

    # Step 6: Compute depth
    # C++ lines 218-222: while (64000 * (1<<depth) < bbox_size * 0.5)
    max_size = max(bbox_size)
    depth = 0
    cell_size = DAT_142d80994
    while cell_size < max_size * DAT_142d7ff50:
        cell_size *= 2
        depth += 1

    return grid_origin, depth


# ============================================================================
# FUN_14075c250 - Tile enumeration with correct grid calculation
# ============================================================================

def enumerate_tiles_from_grid_14075C250(
    grid_origin: tuple[float, float, float],
    depth: int,
) -> list[tuple[int, int, int]]:
    """Enumerates tile coordinates from grid origin and depth.

    Corresponds to FUN_14075c250.
    Uses 2x2x2 recursive subdivision.
    """
    DAT_142d80994 = 64000.0
    DAT_142d842b0 = 64000.0
    DAT_142d7ff50 = 0.5
    DAT_142d83660 = 1.5625e-05
    DAT_142d83a50 = 0.5

    cell_size = DAT_142d80994 * (1 << depth)

    tiles = []

    # 2x2x2 loop
    for i in range(2):
        for j in range(2):
            for k in range(2):
                # Compute tile center position
                # C++: tile_pos = (loop_var - 0.5) * cell_size + grid_origin
                tile_x = (i - DAT_142d7ff50) * cell_size + grid_origin[0]
                tile_y = (j - DAT_142d7ff50) * cell_size + grid_origin[1]
                tile_z = (k - DAT_142d7ff50) * cell_size + grid_origin[2]

                # Convert to tile coordinate
                # C++ lines 100-130: normalize, floor, then multiply by 64000
                norm_x = tile_x * DAT_142d83660 + DAT_142d83a50
                norm_y = tile_y * DAT_142d83660 + DAT_142d83a50
                norm_z = tile_z * DAT_142d83660 + DAT_142d83a50

                tile_coord = (
                    floor_to_int(norm_x) * int(DAT_142d842b0),
                    floor_to_int(norm_y) * int(DAT_142d842b0),
                    floor_to_int(norm_z) * int(DAT_142d842b0),
                )

                tiles.append(tile_coord)

    return tiles


# ============================================================================
# FUN_14075bd20 - Main entry point
# ============================================================================

# ============================================================================
# FUN_14075c250 - Recursive tile enumeration (from C++ decompilation)
# ============================================================================

def check_sphere_tube_intersection(
    cell_center: tuple[float, float, float],
    bounding_radius: float,
    boundary_data: dict,
) -> bool:
    """Check if sphere intersects with splinetube boundary.

    Corresponds to vtable+0x10 call in FUN_14075c250.
    For splinetube: distance to centerline < (tube_radius + bounding_radius).
    """
    # Find nearest distance from cell center to spline centerline
    dist, _ = nearest_distance_to_polyline_14093ED70(
        cell_center,
        boundary_data['points'],
        boundary_data['seg_lengths'],
        boundary_data['accum']
    )

    # Intersection if distance < (tube_radius + bounding_radius)
    return dist < (boundary_data['radius'] + bounding_radius)


def enumerate_tiles_recursive_14075C250(
    field_state: FieldState,
    field,
    boundary_data: dict,
    grid_origin: tuple[float, float, float],
    depth: int,
) -> None:
    """Recursive 2x2x2 subdivision.

    Corresponds to FUN_14075c250.
    Results are stored in field_state.
    """
    DAT_142d80994 = 64000.0
    DAT_142d842b0 = 64000.0
    DAT_142d7ff50 = 0.5
    DAT_142d83660 = 1.5625e-05
    DAT_142d83a50 = 0.5
    DAT_142d7fbe8 = 1e-6
    DAT_142d80300 = 1.7320508  # sqrt(3), from C++ DAT_142d80300

    cell_size = DAT_142d80994 * (1 << depth)

    # 2x2x2 loop (C++ lines 60-210)
    for i in range(2):
        for j in range(2):
            for k in range(2):
                # Compute cell position (C++ lines 70-73)
                cell_x = (i - DAT_142d7ff50) * cell_size + grid_origin[0]
                cell_y = (j - DAT_142d7ff50) * cell_size + grid_origin[1]
                cell_z = (k - DAT_142d7ff50) * cell_size + grid_origin[2]

                if depth == 0:
                    # At leaf level, compute tile contribution
                    # C++ lines 80-140

                    # Convert to tile coordinate (C++ lines 100-130)
                    norm_x = cell_x * DAT_142d83660 + DAT_142d83a50
                    norm_y = cell_y * DAT_142d83660 + DAT_142d83a50
                    norm_z = cell_z * DAT_142d83660 + DAT_142d83a50

                    tile_coord = (
                        floor_to_int(norm_x) * int(DAT_142d842b0),
                        floor_to_int(norm_y) * int(DAT_142d842b0),
                        floor_to_int(norm_z) * int(DAT_142d842b0),
                    )

                    # World position for weight computation
                    tile_center = (float(tile_coord[0]), float(tile_coord[1]), float(tile_coord[2]))

                    # Compute weight via FUN_14073f750
                    weight = compute_tile_contribution_14073F750(
                        field_state, field, tile_center, boundary_data
                    )

                    if weight > DAT_142d7fbe8:
                        # Compute ware values
                        ware_values = {}
                        for resource in field.resources:
                            if resource.resourcedensity > 0:
                                # FUN_140e80260: base_multiplier = universe_yield * resourcedensity
                                universe_multiplier = field.universe_yield_density_by_ware.get(resource.ware_key, 1.0)
                                base_multiplier = f32(f32(universe_multiplier) * f32(resource.resourcedensity))
                                tile_value = int(f32(f32(base_multiplier) * f32(weight)))
                                ware_values[resource.ware_key] = tile_value

                        result = TileResult(
                            coord=tile_coord,
                            world_pos=tile_center,
                            lateral_interval=(0.0, 1.0),
                            radial_interval=(0.0, 1.0),
                            weight=weight,
                            ware_values=ware_values
                        )
                        field_state.tile_results.append(result)
                else:
                    # Check if sub-cell intersects boundary (vtable+0x10)
                    # C++ lines 145-165
                    # bounding_radius = cell_size * sqrt(3)
                    bounding_radius = cell_size * DAT_142d80300

                    cell_center = (cell_x, cell_y, cell_z)

                    # Intersection test for splinetube
                    if check_sphere_tube_intersection(cell_center, bounding_radius, boundary_data):
                        enumerate_tiles_recursive_14075C250(
                            field_state, field, boundary_data,
                            (cell_x, cell_y, cell_z),
                            depth - 1
                        )


def replay_splinetube_field_14075BD20(field) -> dict:
    """Main entry point. Corresponds to FUN_14075bd20.

    C++ logic from decompilation:
    1. Check early exit
    2. Initialize transform data
    3. Get boundary via vtable
    4. Compute bounding box
    5. Compute grid origin and depth
    6. Recursive tile enumeration
    7. Aggregate results
    """
    # Step 1: Check valid spline
    if len(field.spline) < 2:
        return {"error": "Need at least 2 spline points"}

    # Step 2: Build spline boundary data
    boundary_data = build_spline_boundary_data(field.spline, field.radius)

    # Step 3: Compute bounding box
    extension = field.radius + QUERY_RADIUS
    min_corner, max_corner = compute_bounding_box_1414EF820(boundary_data['points'], extension)

    # Step 4: Compute grid origin and depth (FUN_14075bd20 lines 150-220)
    grid_origin, depth = compute_grid_origin_and_depth_14075BD20(min_corner, max_corner)

    # Step 5: Recursive enumeration (FUN_14075c250)
    field_state = FieldState()
    enumerate_tiles_recursive_14075C250(
        field_state, field, boundary_data, grid_origin, depth
    )

    # Step 6: Aggregate results
    aggregate_results_14075CC00(field_state)

    return {
        "field": field.name,
        "boundary_class": field.boundary_class,
        "tile_count": len(field_state.tile_results),
        "per_tile": [
            {
                "coord": r.coord,
                "world_pos": r.world_pos,
                "lateral_interval": r.lateral_interval,
                "radial_interval": r.radial_interval,
                "weight": r.weight,
                **r.ware_values
            }
            for r in field_state.tile_results
        ],
        "ware_totals": field_state.ware_totals,
    }