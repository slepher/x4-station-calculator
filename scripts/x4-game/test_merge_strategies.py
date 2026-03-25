#!/usr/bin/env python3
"""
Test intersection merge for radial_interval.

Hypothesis: When merging radial_intervals from lateral endpoints,
use INTERSECTION (max of lowers, min of uppers) instead of UNION.
"""

import json
import math
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "src" / "assets" / "x4_game_data" / "8.0-Diplomacy" / "data"
SAVE_SAMPLE_ROOT = PROJECT_ROOT / "save_sample_data"

QUERY_RADIUS = 55425.625
RADIAL_FACTOR = 0.995


def load_region_data(region_id: str) -> dict:
    data = json.load(open(DATA_ROOT / "regions.json"))
    for row in data:
        if row["id"] == region_id:
            return row
    raise ValueError(f"Region not found: {region_id}")


def load_save_data(sector_id: str) -> dict:
    path = SAVE_SAMPLE_ROOT / f"{sector_id.lower()}.json"
    if not path.exists():
        return {}
    return json.load(open(path))


def cubic_bezier(p0, c0, c1, p1, t):
    omt = 1.0 - t
    return (
        omt**3 * p0[0] + 3 * omt**2 * t * c0[0] + 3 * omt * t**2 * c1[0] + t**3 * p1[0],
        omt**3 * p0[1] + 3 * omt**2 * t * c0[1] + 3 * omt * t**2 * c1[1] + t**3 * p1[1],
        omt**3 * p0[2] + 3 * omt**2 * t * c0[2] + 3 * omt * t**2 * c1[2] + t**3 * p1[2],
    )


def build_spline_points(spline: list, steps_per_segment: int = 100):
    points = []
    num_segments = len(spline) - 1
    for seg_index in range(num_segments):
        left = spline[seg_index]
        right = spline[seg_index + 1]
        p0 = (left['x'], left['y'], left['z'])
        p1 = (right['x'], right['y'], right['z'])
        c0 = (left['x'] + left['tx'] * left['outlength'],
              left['y'] + left['ty'] * left['outlength'],
              left['z'] + left['tz'] * left['outlength'])
        c1 = (right['x'] - right['tx'] * right['inlength'],
              right['y'] - right['ty'] * right['inlength'],
              right['z'] - right['tz'] * right['inlength'])
        for i in range(steps_per_segment):
            local_t = i / steps_per_segment
            normalized_t = (seg_index + local_t) / num_segments
            points.append((cubic_bezier(p0, c0, c1, p1, local_t), normalized_t))
    last = spline[-1]
    points.append(((last['x'], last['y'], last['z']), 1.0))
    return points


def vec_sub(a, b):
    return (a[0]-b[0], a[1]-b[1], a[2]-b[2])


def vec_length(a):
    return math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2])


def eval_radial_weight(lower, upper, profile_start=0.99, profile_end=RADIAL_FACTOR):
    """Compute EvalAvg for radial profile [(0,1), (0.99,1), (1,0)]."""
    if upper <= lower or lower >= profile_end:
        return 0.0

    effective_upper = min(upper, profile_end)
    effective_lower = max(lower, 0)

    if effective_upper <= effective_lower:
        return 0.0

    integral = 0.0

    if effective_lower < profile_start:
        part_upper = min(effective_upper, profile_start)
        integral += (part_upper - effective_lower) * 1.0

    if effective_upper > profile_start:
        part_lower = max(effective_lower, profile_start)
        part_upper = min(effective_upper, profile_end)
        if part_upper > part_lower:
            h_lower = 1.0 - (part_lower - profile_start) / (profile_end - profile_start)
            h_upper = 0.0 if part_upper >= profile_end else 1.0 - (part_upper - profile_start) / (profile_end - profile_start)
            integral += 0.5 * (part_upper - part_lower) * (h_lower + h_upper)

    return integral / (upper - lower)


def compute_radial_interval(distance, tube_radius):
    lower = max((distance - QUERY_RADIUS) / tube_radius, 0)
    upper = min((distance + QUERY_RADIUS) / tube_radius, RADIAL_FACTOR)
    return lower, upper


def main():
    region_id = "c602s1_region1"
    sector_id = "Cluster_602_Sector001_macro"

    region = load_region_data(region_id)
    save_data = load_save_data(sector_id)

    spline = region["boundary"]["spline"]
    tube_radius = region["boundary"]["size"]["r"]
    threshold = QUERY_RADIUS + tube_radius

    points = build_spline_points(spline)

    ore_save = save_data.get("ware", {}).get("ore", {}).get("medium", {}).get("resources", [])
    save_by_coord = {(r["x"], r["y"], r["z"]): r for r in ore_save}

    # Test different merge strategies
    print("=" * 140)
    print(f"{'Coord':<25} {'Save':>10} {'UNION':>10} {'INTERSECT':>10} {'NEAREST':>10} {'MAX_D':>10} {'Best':>12}")
    print("=" * 140)

    total_errors = {"union": 0, "intersect": 0, "nearest": 0, "max_d": 0}
    count = 0

    for coord, row in save_by_coord.items():
        query = (float(coord[0]), float(coord[1]), float(coord[2]))
        save_falloff = row["falloff"]

        # Find points in threshold
        in_threshold = []
        for i, (pt, t) in enumerate(points):
            d = vec_length(vec_sub(pt, query))
            if d <= threshold:
                in_threshold.append((i, pt, t, d))

        if not in_threshold:
            continue

        # Get lateral interval
        in_threshold.sort(key=lambda x: x[2])
        t_lower = in_threshold[0][2]
        t_upper = in_threshold[-1][2]

        # Check spline endpoints
        spline_end = points[-1][0]
        d_end = vec_length(vec_sub(spline_end, query))
        if d_end <= threshold:
            t_upper = 1.0

        # Get distances at endpoints
        d_at_lower = in_threshold[0][3]
        d_at_upper = in_threshold[-1][3]

        # Handle spline end in threshold
        if d_end <= threshold:
            d_at_upper = d_end

        # Get all distances in interval
        distances = [d for _, _, _, d in in_threshold]
        nearest_d = min(distances)
        max_d = max(distances)

        # Method 1: UNION merge (min lower, max upper)
        r_lower_1, r_upper_1 = compute_radial_interval(d_at_lower, tube_radius)
        r_lower_2, r_upper_2 = compute_radial_interval(d_at_upper, tube_radius)
        union_lower = min(r_lower_1, r_lower_2)
        union_upper = max(r_upper_1, r_upper_2)
        union_weight = eval_radial_weight(union_lower, union_upper)

        # Method 2: INTERSECTION merge (max lower, min upper)
        intersect_lower = max(r_lower_1, r_lower_2)
        intersect_upper = min(r_upper_1, r_upper_2)
        intersect_weight = eval_radial_weight(intersect_lower, intersect_upper)

        # Method 3: Nearest distance
        near_lower, near_upper = compute_radial_interval(nearest_d, tube_radius)
        near_weight = eval_radial_weight(near_lower, near_upper)

        # Method 4: Max distance in interval
        max_lower, max_upper = compute_radial_interval(max_d, tube_radius)
        max_weight = eval_radial_weight(max_lower, max_upper)

        # Calculate errors
        union_err = abs(union_weight - save_falloff) / save_falloff * 100
        inter_err = abs(intersect_weight - save_falloff) / save_falloff * 100
        near_err = abs(near_weight - save_falloff) / save_falloff * 100
        max_err = abs(max_weight - save_falloff) / save_falloff * 100

        total_errors["union"] += union_err
        total_errors["intersect"] += inter_err
        total_errors["nearest"] += near_err
        total_errors["max_d"] += max_err
        count += 1

        # Find best method
        errors = [("union", union_err), ("intersect", inter_err), ("nearest", near_err), ("max_d", max_err)]
        best = min(errors, key=lambda x: x[1])

        if union_err > 50 or inter_err > 50 or near_err > 50 or max_err > 50:
            print(f"{str(coord):<25} {save_falloff:>10.6f} {union_weight:>10.6f} {intersect_weight:>10.6f} {near_weight:>10.6f} {max_weight:>10.6f} {best[0]:>12}")

    print()
    print("=" * 140)
    print(f"Average errors over {count} points:")
    for method, total in total_errors.items():
        print(f"  {method}: {total / count:.2f}%")


if __name__ == "__main__":
    main()