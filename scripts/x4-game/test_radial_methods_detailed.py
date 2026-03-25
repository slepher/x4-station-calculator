#!/usr/bin/env python3
"""
Detailed analysis of splinetube radial_interval calculation.

Hypothesis: The correct approach is to find the minimum radial_distance
within the lateral_interval, not at the endpoints or the global nearest point.
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


def find_points_in_threshold(query, points, threshold):
    """Find all spline points within threshold distance of query."""
    result = []
    for i, (pt, t) in enumerate(points):
        d = vec_length(vec_sub(pt, query))
        if d <= threshold:
            result.append((i, pt, t, d))
    return result


def compute_radial_interval(distance, query_radius, tube_radius):
    """Compute radial interval for a given distance."""
    lower = max((distance - query_radius) / tube_radius, 0)
    upper = min((distance + query_radius) / tube_radius, RADIAL_FACTOR)
    return lower, upper


def eval_radial_weight(lower, upper, profile_start=0.99, profile_end=RADIAL_FACTOR):
    """Compute EvalAvg for radial profile [(0,1), (0.99,1), (1,0)]."""
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


def analyze_query(query, points, tube_radius, save_falloff=None):
    """Analyze all methods for a query point."""
    threshold = QUERY_RADIUS + tube_radius
    in_threshold = find_points_in_threshold(query, points, threshold)

    if not in_threshold:
        return {"error": "No points in threshold"}

    # Lateral interval from threshold
    t_lower = in_threshold[0][2]
    t_upper = in_threshold[-1][2]

    # Check spline endpoints
    spline_start = points[0][0]
    spline_end = points[-1][0]
    d_start = vec_length(vec_sub(spline_start, query))
    d_end = vec_length(vec_sub(spline_end, query))

    if d_start <= threshold:
        t_lower = 0.0
    if d_end <= threshold:
        t_upper = 1.0

    # Get all distances in lateral_interval
    distances_in_interval = [d for _, _, _, d in in_threshold]

    # Add endpoint distances if within threshold
    if d_start <= threshold:
        distances_in_interval.append(d_start)
    if d_end <= threshold:
        distances_in_interval.append(d_end)

    # Method A: Use nearest distance (current replay)
    nearest_d = min(distances_in_interval)
    lower_a, upper_a = compute_radial_interval(nearest_d, QUERY_RADIUS, tube_radius)
    weight_a = eval_radial_weight(lower_a, upper_a)

    # Method B: Use max distance in interval (conservative)
    max_d = max(distances_in_interval)
    lower_b, upper_b = compute_radial_interval(max_d, QUERY_RADIUS, tube_radius)
    weight_b = eval_radial_weight(lower_b, upper_b)

    # Method C: Intersection of all radial intervals
    all_lowers = []
    all_uppers = []
    for d in distances_in_interval:
        l, u = compute_radial_interval(d, QUERY_RADIUS, tube_radius)
        all_lowers.append(l)
        all_uppers.append(u)
    lower_c = max(all_lowers)  # Intersection: take max lower
    upper_c = min(all_uppers)  # Intersection: take min upper
    weight_c = eval_radial_weight(lower_c, upper_c)

    # Method D: Sample the distance profile within lateral_interval
    # Find the minimal radial distance within the lateral_interval
    # This is effectively finding where the query is closest to the tube surface
    # If query is inside tube: nearest_d <= tube_radius -> lower ~ 0
    # If query is outside: need to find where along the interval we get minimal radial coverage

    # For each point in threshold, calculate its "radial distance to tube surface"
    # radial_distance = max(0, d - tube_radius)
    # The point with smallest radial_distance will dominate the radial_interval
    radial_distances = [max(0, d - tube_radius) for d in distances_in_interval]
    min_radial_dist = min(radial_distances)

    # If min_radial_dist is small (query is near or inside tube), radial_interval is large
    # If min_radial_dist is large (query is far from tube), radial_interval is small
    effective_d = tube_radius + min_radial_dist
    lower_d, upper_d = compute_radial_interval(effective_d, QUERY_RADIUS, tube_radius)
    weight_d = eval_radial_weight(lower_d, upper_d)

    # Method E: Use distance at lateral_interval endpoints
    d_at_lower = in_threshold[0][3] if in_threshold else (d_start if d_start <= threshold else float('inf'))
    d_at_upper = in_threshold[-1][3] if in_threshold else (d_end if d_end <= threshold else float('inf'))

    # Handle case where spline endpoints are in threshold
    if d_start <= threshold and in_threshold and in_threshold[0][2] > 0:
        d_at_lower = d_start
    if d_end <= threshold:
        d_at_upper = d_end

    lower_e0, upper_e0 = compute_radial_interval(d_at_lower, QUERY_RADIUS, tube_radius)
    lower_e1, upper_e1 = compute_radial_interval(d_at_upper, QUERY_RADIUS, tube_radius)
    lower_e = min(lower_e0, lower_e1)
    upper_e = max(upper_e0, upper_e1)
    weight_e = eval_radial_weight(lower_e, upper_e)

    return {
        "lateral_interval": (t_lower, t_upper),
        "nearest_d": nearest_d,
        "max_d_in_interval": max_d,
        "d_at_lower": d_at_lower,
        "d_at_upper": d_at_upper,
        "methods": {
            "A_nearest": {"interval": (lower_a, upper_a), "weight": weight_a, "error_pct": abs(weight_a - save_falloff) / save_falloff * 100 if save_falloff else None},
            "B_max": {"interval": (lower_b, upper_b), "weight": weight_b, "error_pct": abs(weight_b - save_falloff) / save_falloff * 100 if save_falloff else None},
            "C_intersection": {"interval": (lower_c, upper_c), "weight": weight_c, "error_pct": abs(weight_c - save_falloff) / save_falloff * 100 if save_falloff else None},
            "D_min_radial_dist": {"interval": (lower_d, upper_d), "weight": weight_d, "error_pct": abs(weight_d - save_falloff) / save_falloff * 100 if save_falloff else None},
            "E_endpoint_merge": {"interval": (lower_e, upper_e), "weight": weight_e, "error_pct": abs(weight_e - save_falloff) / save_falloff * 100 if save_falloff else None},
        },
        "save_falloff": save_falloff,
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
    print(f"Radial factor: {RADIAL_FACTOR}")
    print()

    points = build_spline_points(spline)

    ore_save = save_data.get("ware", {}).get("ore", {}).get("medium", {}).get("resources", [])
    save_by_coord = {(r["x"], r["y"], r["z"]): r for r in ore_save}

    # Test all saved points
    print("=" * 120)
    print(f"{'Coord':<25} {'Save':<12} {'A_nearest':<12} {'B_max':<12} {'C_intersect':<12} {'D_min_rad':<12} {'E_endpoint':<12}")
    print("=" * 120)

    errors = {"A": 0, "B": 0, "C": 0, "D": 0, "E": 0}
    count = 0

    for coord, row in save_by_coord.items():
        query = (float(coord[0]), float(coord[1]), float(coord[2]))
        save_falloff = row["falloff"]

        result = analyze_query(query, points, tube_radius, save_falloff)
        if "error" in result:
            continue

        count += 1
        methods = result["methods"]

        # Find best method
        method_keys = list(methods.keys())
        best_method = min(method_keys, key=lambda m: methods[m]["error_pct"])
        for m in method_keys:
            short_key = m[0]  # A, B, C, D, E
            errors[short_key] += methods[m]["error_pct"]

        if count <= 20 or any(methods[m]["error_pct"] > 50 for m in methods):
            print(f"{str(coord):<25} {save_falloff:<12.6f} "
                  f"{methods['A_nearest']['weight']:<12.6f} "
                  f"{methods['B_max']['weight']:<12.6f} "
                  f"{methods['C_intersection']['weight']:<12.6f} "
                  f"{methods['D_min_radial_dist']['weight']:<12.6f} "
                  f"{methods['E_endpoint_merge']['weight']:<12.6f} "
                  f"best={best_method}")

    print()
    print("=" * 120)
    print(f"Average errors over {count} points:")
    for m in ["A", "B", "C", "D", "E"]:
        print(f"  Method {m}: {errors[m] / count:.2f}%")


if __name__ == "__main__":
    main()