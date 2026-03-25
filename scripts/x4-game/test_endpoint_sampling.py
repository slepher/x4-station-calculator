#!/usr/bin/env python3
"""
Test sampling at lateral_interval endpoints for radial_interval calculation.

Hypothesis:
- +0x58 returns lateral_interval [t_lower, t_upper]
- +0x70 samples at BOTH endpoints
- Calculates radial_interval at each endpoint
- Merges them (union or intersection?)
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


def build_spline_points(spline: list, steps_per_segment: int = 200):
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


def sample_spline_at_t(spline, t):
    """Sample the spline at a specific normalized t value."""
    num_segments = len(spline) - 1
    if t >= 1.0:
        last = spline[-1]
        return (last['x'], last['y'], last['z'])
    if t <= 0.0:
        first = spline[0]
        return (first['x'], first['y'], first['z'])

    seg_float = t * num_segments
    seg_index = int(seg_float)
    local_t = seg_float - seg_index

    if seg_index >= num_segments:
        seg_index = num_segments - 1
        local_t = 1.0

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

    return cubic_bezier(p0, c0, c1, p1, local_t)


def vec_sub(a, b):
    return (a[0]-b[0], a[1]-b[1], a[2]-b[2])


def vec_length(a):
    return math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2])


def eval_radial_weight(lower, upper, profile_start=0.99, profile_end=RADIAL_FACTOR):
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

    print("Testing: sample at lateral_interval endpoints")
    print("=" * 100)

    test_coords = [
        (192000, 0, -192000),
        (320000, 0, -256000),
        (0, 0, 0),
        (64000, 0, 0),
    ]

    for coord in test_coords:
        query = (float(coord[0]), float(coord[1]), float(coord[2]))
        save_falloff = save_by_coord.get(coord, {}).get("falloff")

        # Find lateral interval
        in_threshold = []
        for i, (pt, t) in enumerate(points):
            d = vec_length(vec_sub(pt, query))
            if d <= threshold:
                in_threshold.append((i, pt, t, d))

        if not in_threshold:
            continue

        # Sort by t
        in_threshold.sort(key=lambda x: x[2])
        t_lower = in_threshold[0][2]
        t_upper = in_threshold[-1][2]

        # Check endpoints
        spline_end = points[-1][0]
        d_end = vec_length(vec_sub(spline_end, query))
        if d_end <= threshold:
            t_upper = 1.0

        # Sample at t_lower and t_upper
        pt_lower = sample_spline_at_t(spline, t_lower)
        pt_upper = sample_spline_at_t(spline, t_upper)

        d_lower = vec_length(vec_sub(pt_lower, query))
        d_upper = vec_length(vec_sub(pt_upper, query))

        # Calculate radial intervals
        ri_lower = (max((d_lower - QUERY_RADIUS) / tube_radius, 0), min((d_lower + QUERY_RADIUS) / tube_radius, RADIAL_FACTOR))
        ri_upper = (max((d_upper - QUERY_RADIUS) / tube_radius, 0), min((d_upper + QUERY_RADIUS) / tube_radius, RADIAL_FACTOR))

        # Merge: union (min lower, max upper)
        ri_union = (min(ri_lower[0], ri_upper[0]), max(ri_lower[1], ri_upper[1]))

        # Merge: intersection (max lower, min upper)
        ri_intersect = (max(ri_lower[0], ri_upper[0]), min(ri_lower[1], ri_upper[1]))

        # Weights
        w_union = eval_radial_weight(ri_union[0], ri_union[1])
        w_intersect = eval_radial_weight(ri_intersect[0], ri_intersect[1])

        # Also compute using nearest distance (current method)
        nearest_d = min(d for _, _, _, d in in_threshold)
        ri_nearest = (max((nearest_d - QUERY_RADIUS) / tube_radius, 0), min((nearest_d + QUERY_RADIUS) / tube_radius, RADIAL_FACTOR))
        w_nearest = eval_radial_weight(ri_nearest[0], ri_nearest[1])

        print(f"\nCoord: {coord}")
        print(f"  Save falloff: {save_falloff:.6f}")
        print(f"  Lateral interval: [{t_lower:.4f}, {t_upper:.4f}]")
        print(f"  Sample at t_lower ({t_lower:.4f}): d={d_lower:.1f}, ri=[{ri_lower[0]:.4f}, {ri_lower[1]:.4f}]")
        print(f"  Sample at t_upper ({t_upper:.4f}): d={d_upper:.1f}, ri=[{ri_upper[0]:.4f}, {ri_upper[1]:.4f}]")
        print(f"  Union merge: ri=[{ri_union[0]:.4f}, {ri_union[1]:.4f}], weight={w_union:.6f}, error={abs(w_union-save_falloff)/save_falloff*100:.1f}%")
        print(f"  Intersect: ri=[{ri_intersect[0]:.4f}, {ri_intersect[1]:.4f}], weight={w_intersect:.6f}, error={abs(w_intersect-save_falloff)/save_falloff*100:.1f}%")
        print(f"  Nearest: d={nearest_d:.1f}, ri=[{ri_nearest[0]:.4f}, {ri_nearest[1]:.4f}], weight={w_nearest:.6f}, error={abs(w_nearest-save_falloff)/save_falloff*100:.1f}%")


if __name__ == "__main__":
    main()