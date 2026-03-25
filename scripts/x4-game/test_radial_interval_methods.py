#!/usr/bin/env python3
"""
Test script to verify radial_interval calculation for SplineTube.

Key insight from Ghidra:
- FUN_14093ee10 calls +0x58 to get lateral_interval
- Then samples at the ENDPOINTS of lateral_interval
- Calculates radial_interval at each endpoint
- MERGES the two radial_intervals

The merge logic seems to be:
- final_lower = min(radial_lower_at_t0, radial_lower_at_t1)
- final_upper = max(radial_upper_at_t0, radial_upper_at_t1)

But this is WRONG when the query point is outside the tube and
the lateral_interval spans a large portion of the spline.

Correct approach should use:
- Find the NEAREST point on the spline to the query
- Calculate radial_interval at that nearest point
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
    """Build sampled points with normalized t in [0, 1]."""
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
    # Add endpoint
    last = spline[-1]
    points.append(((last['x'], last['y'], last['z']), 1.0))
    return points


def vec_sub(a, b):
    return (a[0]-b[0], a[1]-b[1], a[2]-b[2])


def vec_length(a):
    return math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2])


def find_nearest_point(query, points):
    """Find the nearest point on spline to query."""
    min_d = float('inf')
    nearest_pt = None
    nearest_t = None
    for pt, t in points:
        d = vec_length(vec_sub(pt, query))
        if d < min_d:
            min_d = d
            nearest_pt = pt
            nearest_t = t
    return nearest_pt, nearest_t, min_d


def find_points_in_threshold(query, points, threshold):
    """Find all spline points within threshold distance of query."""
    result = []
    for i, (pt, t) in enumerate(points):
        d = vec_length(vec_sub(pt, query))
        if d <= threshold:
            result.append((i, pt, t, d))
    return result


def compute_radial_interval(distance, query_radius, tube_radius, radial_factor):
    """Compute radial interval for a given distance."""
    lower = max((distance - query_radius) / tube_radius, 0)
    upper = min((distance + query_radius) / tube_radius, radial_factor)
    return lower, upper


def eval_radial_weight(lower, upper, profile_start=0.99, profile_end=RADIAL_FACTOR):
    """Compute EvalAvg for radial profile."""
    if upper <= lower or lower >= profile_end:
        return 0.0

    effective_upper = min(upper, profile_end)
    effective_lower = max(lower, 0)

    if effective_upper <= effective_lower:
        return 0.0

    integral = 0.0

    # Part 1: [effective_lower, profile_start] - value = 1
    if effective_lower < profile_start:
        part_upper = min(effective_upper, profile_start)
        integral += (part_upper - effective_lower) * 1.0

    # Part 2: [profile_start, effective_upper] - linear drop
    if effective_upper > profile_start:
        part_lower = max(effective_lower, profile_start)
        part_upper = min(effective_upper, profile_end)
        if part_upper > part_lower:
            h_lower = 1.0 - (part_lower - profile_start) / (profile_end - profile_start)
            h_upper = 0.0 if part_upper >= profile_end else 1.0 - (part_upper - profile_start) / (profile_end - profile_start)
            integral += 0.5 * (part_upper - part_lower) * (h_lower + h_upper)

    return integral / (upper - lower)


def analyze_method1_endpoint_merge(query, points, tube_radius, save_falloff=None):
    """Method 1: Use lateral_interval endpoints and merge radial_intervals (current impl)."""
    threshold = QUERY_RADIUS + tube_radius
    in_threshold = find_points_in_threshold(query, points, threshold)

    if not in_threshold:
        return {"error": "No points in threshold"}

    # Lateral interval
    t_lower = in_threshold[0][2]
    t_upper = in_threshold[-1][2]

    # Check if spline end is in threshold
    spline_end = points[-1][0]
    d_end = vec_length(vec_sub(spline_end, query))
    if d_end <= threshold:
        t_upper = 1.0
        d_at_upper = d_end
    else:
        d_at_upper = in_threshold[-1][3]

    d_at_lower = in_threshold[0][3]

    # Radial intervals at endpoints
    lower_0, upper_0 = compute_radial_interval(d_at_lower, QUERY_RADIUS, tube_radius, RADIAL_FACTOR)
    lower_1, upper_1 = compute_radial_interval(d_at_upper, QUERY_RADIUS, tube_radius, RADIAL_FACTOR)

    # Merged radial interval (union)
    final_lower = min(lower_0, lower_1)
    final_upper = max(upper_0, upper_1)

    radial_weight = eval_radial_weight(final_lower, final_upper)

    return {
        "method": "endpoint_merge",
        "lateral_interval": (t_lower, t_upper),
        "d_at_lower": d_at_lower,
        "d_at_upper": d_at_upper,
        "radial_interval": (final_lower, final_upper),
        "radial_weight": radial_weight,
        "computed_falloff": radial_weight,
        "save_falloff": save_falloff,
        "error_pct": abs(radial_weight - save_falloff) / save_falloff * 100 if save_falloff else None,
    }


def analyze_method2_nearest_point(query, points, tube_radius, save_falloff=None):
    """Method 2: Use nearest point on spline to calculate radial_interval."""
    nearest_pt, nearest_t, nearest_d = find_nearest_point(query, points)

    # Calculate radial interval at nearest point
    lower, upper = compute_radial_interval(nearest_d, QUERY_RADIUS, tube_radius, RADIAL_FACTOR)
    radial_weight = eval_radial_weight(lower, upper)

    return {
        "method": "nearest_point",
        "nearest_t": nearest_t,
        "nearest_d": nearest_d,
        "radial_interval": (lower, upper),
        "radial_weight": radial_weight,
        "computed_falloff": radial_weight,
        "save_falloff": save_falloff,
        "error_pct": abs(radial_weight - save_falloff) / save_falloff * 100 if save_falloff else None,
    }


def analyze_method3_iterative(query, points, tube_radius, save_falloff=None):
    """Method 3: Iteratively find the minimal radial_interval that contains all points in threshold."""
    threshold = QUERY_RADIUS + tube_radius
    in_threshold = find_points_in_threshold(query, points, threshold)

    if not in_threshold:
        return {"error": "No points in threshold"}

    # For each point in threshold, calculate its radial interval
    radial_intervals = []
    for _, pt, t, d in in_threshold:
        lower, upper = compute_radial_interval(d, QUERY_RADIUS, tube_radius, RADIAL_FACTOR)
        radial_intervals.append((lower, upper, d, t))

    # Also check spline endpoints
    spline_start = points[0][0]
    d_start = vec_length(vec_sub(spline_start, query))
    if d_start <= threshold:
        lower, upper = compute_radial_interval(d_start, QUERY_RADIUS, tube_radius, RADIAL_FACTOR)
        radial_intervals.append((lower, upper, d_start, 0.0))

    spline_end = points[-1][0]
    d_end = vec_length(vec_sub(spline_end, query))
    if d_end <= threshold:
        lower, upper = compute_radial_interval(d_end, QUERY_RADIUS, tube_radius, RADIAL_FACTOR)
        radial_intervals.append((lower, upper, d_end, 1.0))

    # Find the actual coverage
    min_lower = min(r[0] for r in radial_intervals)
    max_upper = max(r[1] for r in radial_intervals)

    # But we need to find what radial_interval is actually relevant
    # The key insight: we want the radial_interval that covers the QUERY
    # not the radial_interval that covers all points in threshold

    # Actually, let's compute the radial_interval based on the nearest point in threshold
    nearest_in_threshold = min(in_threshold, key=lambda x: x[3])
    _, _, _, nearest_d = nearest_in_threshold
    lower, upper = compute_radial_interval(nearest_d, QUERY_RADIUS, tube_radius, RADIAL_FACTOR)
    radial_weight = eval_radial_weight(lower, upper)

    return {
        "method": "iterative",
        "nearest_d_in_threshold": nearest_d,
        "radial_interval": (lower, upper),
        "radial_weight": radial_weight,
        "computed_falloff": radial_weight,
        "save_falloff": save_falloff,
        "error_pct": abs(radial_weight - save_falloff) / save_falloff * 100 if save_falloff else None,
    }


def main():
    region_id = "c602s1_region1"
    sector_id = "Cluster_602_Sector001_macro"

    region = load_region_data(region_id)
    save_data = load_save_data(sector_id)

    spline = region["boundary"]["spline"]
    tube_radius = region["boundary"]["size"]["r"]

    print(f"Region: {region_id}")
    print(f"Tube radius: {tube_radius}")
    print(f"Query radius: {QUERY_RADIUS}")
    print(f"Threshold: {QUERY_RADIUS + tube_radius}")
    print()

    # Build spline points
    points = build_spline_points(spline)

    # Get save data for ore/medium
    ore_save = save_data.get("ware", {}).get("ore", {}).get("medium", {}).get("resources", [])
    save_by_coord = {(r["x"], r["y"], r["z"]): r for r in ore_save}

    # Test specific points
    test_coords = [
        (192000, 0, -192000),   # Anomaly - high error
        (320000, 0, -256000),   # Anomaly - high error
        (0, 0, 0),              # Works well
        (64000, 0, 0),          # Works well
    ]

    print("=" * 100)
    print("Comparison of methods:")
    print("=" * 100)
    print()

    for coord in test_coords:
        query = (float(coord[0]), float(coord[1]), float(coord[2]))
        save_row = save_by_coord.get(coord)
        save_falloff = save_row["falloff"] if save_row else None

        if save_falloff is None:
            continue

        print(f"Coord: {coord}")
        print(f"  Save falloff: {save_falloff:.6f}")
        print()

        # Method 1: endpoint merge
        r1 = analyze_method1_endpoint_merge(query, points, tube_radius, save_falloff)
        print(f"  Method 1 (endpoint_merge):")
        print(f"    lateral_interval: ({r1['lateral_interval'][0]:.4f}, {r1['lateral_interval'][1]:.4f})")
        print(f"    d_at_lower: {r1['d_at_lower']:.1f}, d_at_upper: {r1['d_at_upper']:.1f}")
        print(f"    radial_interval: ({r1['radial_interval'][0]:.4f}, {r1['radial_interval'][1]:.4f})")
        print(f"    computed: {r1['computed_falloff']:.6f}, error: {r1['error_pct']:.1f}%")
        print()

        # Method 2: nearest point
        r2 = analyze_method2_nearest_point(query, points, tube_radius, save_falloff)
        print(f"  Method 2 (nearest_point):")
        print(f"    nearest_t: {r2['nearest_t']:.4f}, nearest_d: {r2['nearest_d']:.1f}")
        print(f"    radial_interval: ({r2['radial_interval'][0]:.4f}, {r2['radial_interval'][1]:.4f})")
        print(f"    computed: {r2['computed_falloff']:.6f}, error: {r2['error_pct']:.1f}%")
        print()

        # Method 3: iterative
        r3 = analyze_method3_iterative(query, points, tube_radius, save_falloff)
        print(f"  Method 3 (iterative):")
        print(f"    nearest_d_in_threshold: {r3['nearest_d_in_threshold']:.1f}")
        print(f"    radial_interval: ({r3['radial_interval'][0]:.4f}, {r3['radial_interval'][1]:.4f})")
        print(f"    computed: {r3['computed_falloff']:.6f}, error: {r3['error_pct']:.1f}%")
        print()

        print("-" * 80)
        print()


if __name__ == "__main__":
    main()