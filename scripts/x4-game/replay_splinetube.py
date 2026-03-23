#!/usr/bin/env python3
"""Splinetube gas field replay - reverse engineered from FUN_14075bd20.

All functions are implemented from C++ decompilation, starting from scratch.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

# Constants from C++ DAT_*
DAT_142d83660 = 1.5625e-05  # 1/64000
DAT_142d842b0 = 64000.0
DAT_142d83a50 = 7.8125e-06  # 1/(2*64000)
DAT_142d80994 = 64000.0
DAT_142d7ff50 = 0.5
DAT_142d800e8 = 1.0
DAT_142d7fbe8 = 1e-6
QUERY_RADIUS = 55425.625


def f32(value: float) -> float:
    import struct
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
    """Runtime state for field processing, corresponds to param_1 in FUN_14075bd20."""
    tile_results: list[TileResult] = field(default_factory=list)
    ware_totals: dict[str, int] = field(default_factory=dict)
    # Additional fields corresponding to C++ structure offsets


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


def sample_polyline_at_arclength(points, seg_lengths, accum, target):
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
    weight = DAT_142d800e8

    for boundary in boundary_list:
        # Check if boundary has lateral profile (vtable+0x48)
        # For splinetube, this returns true

        # Compute lateral interval (vtable+0x58)
        lateral_interval, _ = compute_lateral_interval_1414F3B30(
            local_pos, boundary['points'], boundary['seg_lengths'],
            boundary['accum'], boundary['total_length'], query_radius
        )

        if lateral_interval is None:
            return 0.0

        lateral_weight = eval_profile_avg_1414ED970(lateral_profile, lateral_interval)

        # Check if boundary has radial profile (vtable+0x60)
        # For splinetube, this returns true

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
    # Check if within bounds (vtable+0x10 check)
    # C++ does complex bounds checking here

    # Transform to local coordinates (FUN_1403a7e40 result is used)
    local_pos = tile_center  # Simplified, should use inverse transform

    # Compute weight via FUN_14093bf90
    weight = compute_weight_14093BF90(
        [boundary_data],
        field.falloff.lateral,
        field.falloff.radial,
        local_pos,
        QUERY_RADIUS
    )

    if weight <= DAT_142d7fbe8:
        return 0.0

    return weight


# ============================================================================
# FUN_14075c250 - Recursive square grid subdivision
# ============================================================================

def enumerate_tiles_recursive_14075C250(
    field_state: FieldState,
    field,
    boundary_data: dict,
    grid_origin: tuple[float, float, float, float],
    depth: int,
) -> None:
    """Recursive 2x2x2 subdivision.

    Corresponds to FUN_14075c250.
    Results are stored in field_state.
    """
    cell_size = DAT_142d80994 * (1 << depth)

    if depth == 0:
        # At lowest level, compute contribution
        tile_x = grid_origin[0] * DAT_142d842b0 + DAT_142d842b0 * 0.5
        tile_y = grid_origin[1] * DAT_142d842b0 + DAT_142d842b0 * 0.5
        tile_z = grid_origin[2] * DAT_142d842b0 + DAT_142d842b0 * 0.5

        tile_center = (tile_x, tile_y, tile_z)

        # Call FUN_14073f750
        weight = compute_tile_contribution_14073F750(
            field_state, field, tile_center, boundary_data
        )

        if weight > DAT_142d7fbe8:
            # Store result
            tile_coord = (
                int(grid_origin[0] * DAT_142d842b0),
                int(grid_origin[1] * DAT_142d842b0),
                int(grid_origin[2] * DAT_142d842b0)
            )

            # Compute ware values
            ware_values = {}
            for resource in field.resources:
                if resource.resourcedensity > 0:
                    base = resource.resourcedensity * field.linear
                    value = int(f32(f32(base) * f32(weight)))
                    ware_values[resource.ware_key] = value

            result = TileResult(
                coord=tile_coord,
                world_pos=tile_center,
                lateral_interval=(0.0, 1.0),  # Would be computed
                radial_interval=(0.0, 1.0),  # Would be computed
                weight=weight,
                ware_values=ware_values
            )
            field_state.tile_results.append(result)

        return

    # Subdivide into 2x2x2
    half = 0.5

    for dx in range(2):
        for dy in range(2):
            for dz in range(2):
                sub_origin = (
                    grid_origin[0] + dx * half * cell_size * DAT_142d83660,
                    grid_origin[1] + dy * half * cell_size * DAT_142d83660,
                    grid_origin[2] + dz * half * cell_size * DAT_142d83660,
                    grid_origin[3]
                )

                # Check if sub-cell intersects (vtable+0x10)
                # For now, always recurse
                enumerate_tiles_recursive_14075C250(
                    field_state, field, boundary_data, sub_origin, depth - 1
                )


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
# FUN_1403a7e40 - Coordinate transform
# ============================================================================

def coordinate_transform_1403A7E40(
    field,
    output: dict,
) -> None:
    """Transforms coordinates through hierarchy.

    Corresponds to FUN_1403a7e40.
    For gas fields with world-space position, this is identity.
    """
    # Simplified: use field position directly
    output['position'] = (field.position_x, field.position_y, field.position_z)
    output['rotation'] = [
        (1.0, 0.0, 0.0),
        (0.0, 1.0, 0.0),
        (0.0, 0.0, 1.0)
    ]


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
# Helper: Build spline sample data
# ============================================================================

def build_spline_boundary_data(spline_control_points: list, tube_radius: float) -> dict:
    """Builds boundary data structure for splinetube."""
    points = []
    segment_count = 2000

    for seg_index in range(len(spline_control_points) - 1):
        left = spline_control_points[seg_index]
        right = spline_control_points[seg_index + 1]

        p0 = (left.x, left.y, left.z)
        p1 = (right.x, right.y, right.z)
        c0 = (left.x + left.tx * left.outlength, left.y + left.ty * left.outlength, left.z + left.tz * left.outlength)
        c1 = (right.x - right.tx * right.inlength, right.y - right.ty * right.inlength, right.z - right.tz * right.inlength)

        start = 0 if seg_index == 0 else 1
        for i in range(start, segment_count + 1):
            t = i / segment_count
            point = cubic_bezier(p0, c0, c1, p1, t)
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
# FUN_14075bd20 - Main entry point
# ============================================================================

def replay_splinetube_field_14075BD20(field) -> dict:
    """Main entry point. Corresponds to FUN_14075bd20.

    C++ logic from decompilation:
    1. Check early exit (lines 41-43)
    2. Initialize transform data (lines 44-56)
    3. Call FUN_1403a7e40 (line 57)
    4. Get boundary via vtable+0x1430 (line 58)
    5. Check bounds validity (lines 60-85)
    6. Call FUN_1414ef820 (lines 86-93)
    7. Compute grid range (lines 94-200)
    8. Call FUN_14075c250 (line 201)
    9. Call FUN_14075cc00 if param_4 (line 202-204)
    """
    # Step 1: Early exit check
    # C++: if ((param_2[0x57] == param_2[0x58]) && (param_2[0x5a] == param_2[0x5b]))
    # This checks if field has valid resource bounds
    # For now, skip this check

    # Step 2-3: Initialize and transform
    transform = {}
    coordinate_transform_1403A7E40(field, transform)

    # Step 4: Get boundary (vtable call)
    # For splinetube, we need spline points
    if len(field.spline) < 2:
        return {"error": "Need at least 2 spline points"}

    boundary_data = build_spline_boundary_data(field.spline, field.radius)

    # Step 5-6: Compute bounding box
    extension = field.radius + QUERY_RADIUS
    min_corner, max_corner = compute_bounding_box_1414EF820(boundary_data['points'], extension)

    # Step 7: Compute grid range
    # C++ does complex float math with DAT_142d83660
    bbox_size = (
        max_corner[0] - min_corner[0],
        max_corner[1] - min_corner[1],
        max_corner[2] - min_corner[2]
    )

    # Compute depth from bounding box size
    max_size = max(bbox_size)
    depth = 0
    size = DAT_142d80994
    while size < max_size * DAT_142d7ff50:
        size *= 2
        depth += 1

    # TODO: Grid origin calculation based on FUN_14075bd20
    # C++ computes:
    #   local_d8 = grid_index * 64000 + 32000
    # where grid_index = floor(min_corner * 1/64000)
    # Need to trace exact calculation from decompilation

    # Grid origin in normalized coords (temporary, needs correct implementation)
    grid_origin = (
        (min_corner[0] + DAT_142d842b0 * DAT_142d83a50) * DAT_142d83660,
        (min_corner[1] + DAT_142d842b0 * DAT_142d83a50) * DAT_142d83660,
        (min_corner[2] + DAT_142d842b0 * DAT_142d83a50) * DAT_142d83660,
        DAT_142d842b0
    )

    # Step 8: Recursive enumeration
    field_state = FieldState()
    enumerate_tiles_recursive_14075C250(field_state, field, boundary_data, grid_origin, depth)

    # Step 9: Aggregate results
    aggregate_results_14075CC00(field_state)

    return {
        "field": field.name,
        "boundary_class": field.boundary_class,
        "tile_count": len(field_state.tile_results),
        "per_tile": [
            {
                "coord": r.coord,
                "world_pos": r.world_pos,
                "weight": r.weight,
                **r.ware_values
            }
            for r in field_state.tile_results
        ],
        "ware_totals": field_state.ware_totals,
    }