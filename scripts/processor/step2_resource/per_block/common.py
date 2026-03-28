"""Common utilities for per-block resource calculations.

This module contains shared data structures and functions used by both solid and gas
resource calculations. Code is extracted from verified replay scripts:
- scripts/x4-game/solid_sum_weights_replay_v2.py
- scripts/x4-game/gas_sum_weights_replay.py
"""

from __future__ import annotations

import math
import struct
from dataclasses import dataclass, field
from typing import Optional


# =============================================================================
# Constants
# =============================================================================

AREA_SIZE = 64000.0
AREA_HALF = AREA_SIZE / 2.0
# 15×15×3 网格参数（与文档 solid_per_block.md 一致）
# 用于 compute_storage_axis_range 的范围限制
SAVE_GRID_MIN_CENTER_XZ = -480000
SAVE_GRID_MAX_CENTER_XZ = 480000
SAVE_GRID_MIN_CENTER_Y = -96000
SAVE_GRID_MAX_CENTER_Y = 96000

# 完整网格参数（用于 build_query_grid_window 的 origin 计算）
# 注意：origin 计算必须使用完整网格范围，否则会导致坐标偏移
FULL_GRID_MAX_CENTER_XZ = 1024000
FULL_GRID_MAX_CENTER_Y = 1024000
QUERY_RADIUS = 55425.625
SPLINETUBE_SEGMENT_COUNT_DEFAULT = 2000
SPLINETUBE_INTERVAL_SAMPLE_COUNT = 5

# Noise CDF constants (for solid resources)
NOISE_CLAMP_SCALE = 9.999999717180685e-10
NOISE_CDF_CENTER = 0.5
NOISE_CDF_SIGN_NEGATIVE = -1.0
NOISE_CDF_ABS_SCALE = 4.5
NOISE_CDF_LINEAR = 0.30000001192092896
NOISE_CDF_CROSS = 0.0009720000089146197
NOISE_CDF_QUAD = 4.665377140045166
NOISE_CDF_CROSS_SCALE = 20.25
NOISE_CDF_QUARTIC = 32.02915954589844
CLAMP_UPPER = 262144.0


# =============================================================================
# Utility Functions
# =============================================================================

def f32(value: float) -> float:
    """Cast to 32-bit float for exact parity with game runtime."""
    return struct.unpack("<f", struct.pack("<f", float(value)))[0]


def clamp(value: float, lower: float, upper: float) -> float:
    """Clamp value to [lower, upper] range."""
    return max(lower, min(upper, value))


def truncate_to_runtime_int(value: float) -> int:
    """Truncate float to non-negative integer matching game runtime behavior."""
    if value <= 0.0:
        return 0
    return int(value)


# =============================================================================
# Vector Operations
# =============================================================================

def vec_add(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    """Vector addition."""
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def vec_sub(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    """Vector subtraction."""
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vec_mul(a: tuple[float, float, float], scale: float) -> tuple[float, float, float]:
    """Vector scalar multiplication."""
    return (a[0] * scale, a[1] * scale, a[2] * scale)


def dot(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    """Vector dot product."""
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def vec_length(a: tuple[float, float, float]) -> float:
    """Vector length."""
    return math.sqrt(dot(a, a))


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class ProfilePoint:
    """A point on a falloff profile curve."""
    position: float
    value: float


@dataclass
class FalloffProfiles:
    """Lateral and radial falloff profiles for a region."""
    lateral: list[ProfilePoint]
    radial: list[ProfilePoint]
    lateral_factor: Optional[float] = None
    radial_factor: Optional[float] = None


@dataclass
class SplineControlPoint:
    """A control point for a spline tube boundary."""
    x: float
    y: float
    z: float
    tx: float
    ty: float
    tz: float
    inlength: float
    outlength: float


@dataclass
class QueryGridWindow:
    """Grid window for 64k area storage coordinates."""
    origin_x: int
    origin_y: int
    origin_z: int


# =============================================================================
# Grid Coordinate Functions
# =============================================================================

def compute_axis_storage_origin(position: float, max_center: int) -> int:
    """Compute storage origin for an axis based on position."""
    if abs(position) <= max_center:
        return 0
    return int(math.floor(position / AREA_SIZE) * AREA_SIZE)


def build_query_grid_window(
    position_x: float,
    position_y: float,
    position_z: float,
) -> QueryGridWindow:
    """Build a query grid window for the given position.

    Note: Uses FULL_GRID limits for origin calculation to avoid coordinate offset.
    The cut-mode limits are applied later in compute_storage_axis_range.
    """
    return QueryGridWindow(
        origin_x=compute_axis_storage_origin(position_x, FULL_GRID_MAX_CENTER_XZ),
        origin_y=compute_axis_storage_origin(position_y, FULL_GRID_MAX_CENTER_Y),
        origin_z=compute_axis_storage_origin(position_z, FULL_GRID_MAX_CENTER_XZ),
    )


def world_coord_from_storage_coord(
    grid: QueryGridWindow,
    coord: tuple[int, int, int],
) -> tuple[int, int, int]:
    """Convert storage coordinate to world coordinate."""
    return (
        coord[0] + grid.origin_x,
        coord[1] + grid.origin_y,
        coord[2] + grid.origin_z,
    )


def compute_storage_axis_range(
    min_world: float,
    max_world: float,
    origin: int,
    min_center: int,
    max_center: int,
) -> tuple[int, int]:
    """Compute the range of storage axis values for a world coordinate range."""
    start = max(int(math.floor((min_world - origin) / AREA_SIZE) * int(AREA_SIZE)), min_center)
    end = min(int(math.floor((max_world - origin) / AREA_SIZE) * int(AREA_SIZE)), max_center)
    return start, end


# =============================================================================
# Profile Evaluation
# =============================================================================

def eval_profile_avg(profile: list[ProfilePoint], interval: tuple[float, float]) -> float:
    """Evaluate the average value of a profile over an interval.

    Uses trapezoidal integration with automatic subdivision at profile points.
    """
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


# =============================================================================
# Spline Functions
# =============================================================================

def cubic_bezier_sample(
    p0: tuple[float, float, float],
    c0: tuple[float, float, float],
    c1: tuple[float, float, float],
    p1: tuple[float, float, float],
    t: float,
) -> tuple[float, float, float]:
    """Sample a cubic Bezier curve at parameter t."""
    omt = 1.0 - t
    omt2 = omt * omt
    omt3 = omt2 * omt
    t2 = t * t
    t3 = t2 * t
    return vec_add(
        vec_add(vec_mul(p0, omt3), vec_mul(c0, 3.0 * omt2 * t)),
        vec_add(vec_mul(c1, 3.0 * omt * t2), vec_mul(p1, t3)),
    )


def sample_composite_spline_uniform_param(
    spline: list[SplineControlPoint],
    t: float,
) -> tuple[float, float, float]:
    """Sample a composite spline at uniform parameter t."""
    segment_count = len(spline) - 1
    if segment_count <= 0:
        raise ValueError("splinetube requires at least two spline control points")
    t = clamp(t, 0.0, 1.0)
    scaled = t * segment_count
    seg_index = min(int(math.floor(scaled)), segment_count - 1)
    local_t = scaled - seg_index
    if t >= 1.0:
        seg_index = segment_count - 1
        local_t = 1.0
    left = spline[seg_index]
    right = spline[seg_index + 1]
    p0 = (left.x, left.y, left.z)
    p1 = (right.x, right.y, right.z)
    c0 = (left.x + left.tx * left.outlength, left.y + left.ty * left.outlength, left.z + left.tz * left.outlength)
    c1 = (right.x - right.tx * right.inlength, right.y - right.ty * right.inlength, right.z - right.tz * right.inlength)
    return cubic_bezier_sample(p0, c0, c1, p1, local_t)


def build_runtime_sampled_splinetube_points(spline: list[SplineControlPoint]) -> list[tuple[float, float, float]]:
    """Build a list of sampled points along the spline tube."""
    return [
        sample_composite_spline_uniform_param(
            spline,
            index / SPLINETUBE_SEGMENT_COUNT_DEFAULT,
        )
        for index in range(SPLINETUBE_SEGMENT_COUNT_DEFAULT + 1)
    ]


def build_polyline_arclength_table(
    points: list[tuple[float, float, float]],
) -> tuple[list[float], list[float], float]:
    """Build arc length table for a polyline.

    Returns:
        Tuple of (segment_lengths, cumulative_lengths, total_length)
    """
    seg_lengths: list[float] = []
    accum = [0.0]
    total = 0.0
    for a, b in zip(points, points[1:]):
        seg_len = vec_length(vec_sub(b, a))
        seg_lengths.append(seg_len)
        total += seg_len
        accum.append(total)
    return seg_lengths, accum, total


def distance_point_to_segment_with_param(
    query: tuple[float, float, float],
    a: tuple[float, float, float],
    b: tuple[float, float, float],
) -> tuple[float, float]:
    """Compute distance from point to line segment, with parameter."""
    ab = vec_sub(b, a)
    ab2 = dot(ab, ab)
    if ab2 <= 1e-6:
        return vec_length(vec_sub(query, a)), 0.0
    t = clamp(dot(vec_sub(query, a), ab) / ab2, 0.0, 1.0)
    closest = vec_add(a, vec_mul(ab, t))
    return vec_length(vec_sub(query, closest)), t


def nearest_distance_to_sampled_polyline(
    query: tuple[float, float, float],
    points: list[tuple[float, float, float]],
    seg_lengths: list[float],
    accum: list[float],
) -> tuple[float, float]:
    """Find the nearest distance from a query point to a sampled polyline.

    Returns:
        Tuple of (distance, arc_length_at_nearest_point)
    """
    best_distance = float("inf")
    best_arclength = 0.0
    for index, (a, b) in enumerate(zip(points, points[1:])):
        distance_to_seg, t = distance_point_to_segment_with_param(query, a, b)
        if distance_to_seg < best_distance:
            best_distance = distance_to_seg
            best_arclength = accum[index] + seg_lengths[index] * t
    return best_distance, best_arclength


def sample_point_on_sampled_polyline_at_fraction(
    points: list[tuple[float, float, float]],
    seg_lengths: list[float],
    accum: list[float],
    total_length: float,
    fraction: float,
) -> tuple[float, float, float]:
    """Sample a point on a polyline at a given fraction of total length."""
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


def compute_composite_spline_nearest_global_t(
    query: tuple[float, float, float],
    points: list[tuple[float, float, float]],
    seg_lengths: list[float],
    accum: list[float],
    total_length: float,
) -> tuple[float, float]:
    """Compute the normalized parameter t for the nearest point on a composite spline."""
    nearest_distance, nearest_arclength = nearest_distance_to_sampled_polyline(query, points, seg_lengths, accum)
    if total_length <= 1e-6:
        return (0.0, nearest_distance)
    return (clamp(nearest_arclength / total_length, 0.0, 1.0), nearest_distance)


def segment_param_interval_inside_radius(
    query: tuple[float, float, float],
    a: tuple[float, float, float],
    b: tuple[float, float, float],
    radius: float,
) -> Optional[tuple[float, float]]:
    """Compute the parameter interval where a segment is inside a radius from query."""
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


def compute_composite_spline_interval_scan(
    query: tuple[float, float, float],
    points: list[tuple[float, float, float]],
    seg_lengths: list[float],
    accum: list[float],
    total_length: float,
    query_radius: float,
    sample_count: int,
) -> tuple[Optional[tuple[float, float]], float]:
    """Scan along a composite spline to find the interval within query radius."""
    nearest_t, _nearest_distance = compute_composite_spline_nearest_global_t(
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

    first_hit: Optional[float] = None
    last_hit: Optional[float] = None
    t = start
    while t < end:
        point = sample_point_on_sampled_polyline_at_fraction(points, seg_lengths, accum, total_length, t)
        distance_to_query = vec_length(vec_sub(point, query))
        if distance_to_query < query_radius:
            hit_t = clamp(t, 0.0, 1.0)
            if first_hit is None:
                first_hit = hit_t
            last_hit = hit_t
        t += step

    representative_point = sample_point_on_sampled_polyline_at_fraction(
        points, seg_lengths, accum, total_length, nearest_t
    )
    representative_distance = vec_length(vec_sub(representative_point, query))
    if first_hit is None or last_hit is None:
        return None, representative_distance
    return (first_hit, last_hit), representative_distance


def compute_splinetube_lateral_interval_polyline(
    query: tuple[float, float, float],
    points: list[tuple[float, float, float]],
    seg_lengths: list[float],
    accum: list[float],
    total_length: float,
    threshold: float,
) -> Optional[tuple[float, float]]:
    """Compute the lateral interval for a spline tube at a query point."""
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


def compute_splinetube_radial_interval(
    nearest_distance: float,
    tube_radius: float,
    query_radius: float,
) -> tuple[float, float]:
    """Compute the radial interval for a spline tube."""
    return (
        clamp((nearest_distance - query_radius) / tube_radius, 0.0, 1.0),
        clamp((nearest_distance + query_radius) / tube_radius, 0.0, 1.0),
    )


__all__ = [
    # Constants
    "AREA_SIZE",
    "AREA_HALF",
    "SAVE_GRID_MIN_CENTER_XZ",
    "SAVE_GRID_MAX_CENTER_XZ",
    "SAVE_GRID_MIN_CENTER_Y",
    "SAVE_GRID_MAX_CENTER_Y",
    "QUERY_RADIUS",
    "SPLINETUBE_SEGMENT_COUNT_DEFAULT",
    "SPLINETUBE_INTERVAL_SAMPLE_COUNT",
    # Noise CDF constants
    "NOISE_CLAMP_SCALE",
    "NOISE_CDF_CENTER",
    "NOISE_CDF_SIGN_NEGATIVE",
    "NOISE_CDF_ABS_SCALE",
    "NOISE_CDF_LINEAR",
    "NOISE_CDF_CROSS",
    "NOISE_CDF_QUAD",
    "NOISE_CDF_CROSS_SCALE",
    "NOISE_CDF_QUARTIC",
    "CLAMP_UPPER",
    # Utility functions
    "f32",
    "clamp",
    "truncate_to_runtime_int",
    # Vector operations
    "vec_add",
    "vec_sub",
    "vec_mul",
    "dot",
    "vec_length",
    # Data classes
    "ProfilePoint",
    "FalloffProfiles",
    "SplineControlPoint",
    "QueryGridWindow",
    # Grid coordinate functions
    "compute_axis_storage_origin",
    "build_query_grid_window",
    "world_coord_from_storage_coord",
    "compute_storage_axis_range",
    # Profile evaluation
    "eval_profile_avg",
    # Spline functions
    "cubic_bezier_sample",
    "sample_composite_spline_uniform_param",
    "build_runtime_sampled_splinetube_points",
    "build_polyline_arclength_table",
    "distance_point_to_segment_with_param",
    "nearest_distance_to_sampled_polyline",
    "sample_point_on_sampled_polyline_at_fraction",
    "compute_composite_spline_nearest_global_t",
    "segment_param_interval_inside_radius",
    "compute_composite_spline_interval_scan",
    "compute_splinetube_lateral_interval_polyline",
    "compute_splinetube_radial_interval",
]