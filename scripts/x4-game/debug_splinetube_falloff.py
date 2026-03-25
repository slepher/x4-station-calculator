#!/usr/bin/env python3
"""Debug script to analyze the discrepancy between replay and save for solid splinetube."""

import json
import math
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "src" / "assets" / "x4_game_data" / "8.0-Diplomacy" / "data"
SAVE_SAMPLE_ROOT = PROJECT_ROOT / "save_sample_data"

QUERY_RADIUS = 55425.625
RADIAL_FACTOR = 0.995  # From regions.json falloff.radial_factor
PROFILE_START = 0.99   # Position where radial profile starts to drop


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
        omt**3 * p0[2] + 3 * omt**2 * t * c0[2] + 3 * omt * t**2 * c1[2] + t**3 * p1[2]
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
    return points


def compute_arclengths(points: list) -> tuple:
    """Compute arclengths and total length."""
    arclengths = [0.0]
    total = 0.0
    for i in range(len(points) - 1):
        pt0, _ = points[i]
        pt1, _ = points[i + 1]
        seg_len = math.sqrt((pt1[0]-pt0[0])**2 + (pt1[1]-pt0[1])**2 + (pt1[2]-pt0[2])**2)
        total += seg_len
        arclengths.append(total)
    return arclengths, total


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


def compute_radial_interval(distance, query_radius, tube_radius, radial_factor):
    """Compute radial interval for a given distance."""
    lower = max((distance - query_radius) / tube_radius, 0)
    upper = min((distance + query_radius) / tube_radius, radial_factor)
    return lower, upper


def eval_radial_weight(lower, upper, profile_start=PROFILE_START, profile_end=RADIAL_FACTOR):
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


def analyze_point(query, points, arclengths, total_length, tube_radius, save_falloff=None):
    """Analyze a single query point."""
    threshold = QUERY_RADIUS + tube_radius

    # Find points in threshold
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

    # Compute weights
    radial_weight = eval_radial_weight(final_lower, final_upper)
    lateral_weight = 1.0  # Flat profile
    total_falloff = radial_weight * lateral_weight

    # Find nearest point
    nearest_d = min(d for _, _, _, d in in_threshold)

    return {
        "query": query,
        "threshold": threshold,
        "lateral_interval": (t_lower, t_upper),
        "lateral_width": t_upper - t_lower,
        "d_at_lower": d_at_lower,
        "d_at_upper": d_at_upper,
        "nearest_d": nearest_d,
        "radial_interval_0": (lower_0, upper_0),
        "radial_interval_1": (lower_1, upper_1),
        "final_radial_interval": (final_lower, final_upper),
        "radial_weight": radial_weight,
        "computed_falloff": total_falloff,
        "save_falloff": save_falloff,
        "error_ratio": abs(total_falloff - save_falloff) / save_falloff * 100 if save_falloff else None,
    }


def main():
    region_id = "c602s1_region1"
    sector_id = "Cluster_602_Sector001_macro"

    region = load_region_data(region_id)
    save_data = load_save_data(sector_id)

    spline = region["boundary"]["spline"]
    tube_radius = region["boundary"]["size"]["r"]
    radial_factor = region["falloff"].get("radial_factor", 0.995)

    print(f"Region: {region_id}")
    print(f"Tube radius: {tube_radius}")
    print(f"Radial factor: {radial_factor}")
    print()

    # Build spline points
    points = build_spline_points(spline)
    arclengths, total_length = compute_arclengths(points)

    print(f"Spline points: {len(points)}")
    print(f"Total length: {total_length:.1f}")
    print()

    # Get save data for ore/medium
    ore_save = save_data.get("ware", {}).get("ore", {}).get("medium", {}).get("resources", [])
    save_by_coord = {(r["x"], r["y"], r["z"]): r for r in ore_save}

    # Analyze specific points
    test_coords = [
        (192000, 0, -192000),   # Anomaly
        (320000, 0, -256000),   # Anomaly
        (128000, 0, -256000),   # Normal
        (-320000, 0, 256000),   # Normal (near start)
        (64000, 0, 0),          # Normal (middle)
        (0, 0, 0),              # Normal (middle)
    ]

    print("Analysis of specific points:")
    print("=" * 100)
    print()

    for coord in test_coords:
        query = (float(coord[0]), float(coord[1]), float(coord[2]))
        save_row = save_by_coord.get(coord)
        save_falloff = save_row["falloff"] if save_row else None

        result = analyze_point(query, points, arclengths, total_length, tube_radius, save_falloff)

        print(f"Coord: {coord}")
        print(f"  Lateral interval: ({result['lateral_interval'][0]:.4f}, {result['lateral_interval'][1]:.4f}), width={result['lateral_width']:.4f}")
        print(f"  Distance at lower: {result['d_at_lower']:.1f}, at upper: {result['d_at_upper']:.1f}")
        print(f"  Nearest distance: {result['nearest_d']:.1f}")
        print(f"  Radial interval: ({result['final_radial_interval'][0]:.4f}, {result['final_radial_interval'][1]:.4f})")
        print(f"  Radial weight: {result['radial_weight']:.6f}")
        print(f"  Computed falloff: {result['computed_falloff']:.6f}")
        print(f"  Save falloff: {result['save_falloff']:.6f}" if result['save_falloff'] else "  Save falloff: N/A")
        print(f"  Error: {result['error_ratio']:.2f}%" if result['error_ratio'] else "")
        print()

    # Pattern analysis
    print("=" * 100)
    print("Pattern analysis:")
    print()

    # Check correlation between lateral_width and falloff error
    print("Hypothesis: lateral_width affects the final falloff")
    print()

    all_coords = list(save_by_coord.keys())[:20]  # Check first 20 points
    for coord in all_coords:
        query = (float(coord[0]), float(coord[1]), float(coord[2]))
        save_falloff = save_by_coord[coord]["falloff"]

        result = analyze_point(query, points, arclengths, total_length, tube_radius, save_falloff)

        # Check if error ratio correlates with lateral_width or nearest_d
        if result.get("error_ratio") is not None and result["error_ratio"] > 10:
            print(f"High error ({result['error_ratio']:.1f}%): {coord}")
            print(f"  lateral_width={result['lateral_width']:.4f}, nearest_d={result['nearest_d']:.1f}")


if __name__ == "__main__":
    main()