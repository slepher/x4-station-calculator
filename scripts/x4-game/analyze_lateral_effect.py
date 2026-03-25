#!/usr/bin/env python3
"""
Analyze the effect of lateral_weight on falloff.

Hypothesis: The game calculates:
  total_falloff = lateral_weight * radial_weight

Where:
  lateral_weight = EvalAvg(lateral_profile, lateral_interval)
  radial_weight = EvalAvg(radial_profile, radial_interval)

The lateral_interval is the range of t values where the spline is within threshold.
The radial_interval is based on the distance to the tube surface.
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


def eval_profile_avg(profile, interval):
    """Compute EvalAvg for a profile."""
    lower, upper = interval
    if upper <= lower:
        return 0.0

    def value_at(x):
        if x <= profile[0]["position"]:
            return profile[0]["value"]
        for left, right in zip(profile, profile[1:]):
            if x <= right["position"]:
                if right["position"] == left["position"]:
                    return right["value"]
                t = (x - left["position"]) / (right["position"] - left["position"])
                return left["value"] + (right["value"] - left["value"]) * t
        return profile[-1]["value"]

    xs = [lower, upper]
    for node in profile:
        if lower < node["position"] < upper:
            xs.append(node["position"])
    xs.sort()

    area = 0.0
    for x0, x1 in zip(xs, xs[1:]):
        y0 = value_at(x0)
        y1 = value_at(x1)
        area += (y0 + y1) * 0.5 * (x1 - x0)
    return area / (upper - lower)


def main():
    region_id = "c602s1_region1"
    sector_id = "Cluster_602_Sector001_macro"

    region = load_region_data(region_id)
    save_data = load_save_data(sector_id)

    spline = region["boundary"]["spline"]
    tube_radius = region["boundary"]["size"]["r"]
    lateral_profile = region["falloff"]["lateral"]
    radial_profile = region["falloff"]["radial"]
    threshold = QUERY_RADIUS + tube_radius

    points = build_spline_points(spline)

    # Anomaly points
    test_coords = [
        (192000, 0, -192000),
        (320000, 0, -256000),
        (0, 0, 0),
        (64000, 0, 0),
    ]

    ore_save = save_data.get("ware", {}).get("ore", {}).get("medium", {}).get("resources", [])
    save_by_coord = {(r["x"], r["y"], r["z"]): r for r in ore_save}

    print(f"Lateral profile: {[(p['position'], p['value']) for p in lateral_profile]}")
    print(f"Radial profile: {[(p['position'], p['value']) for p in radial_profile]}")
    print()

    for coord in test_coords:
        query = (float(coord[0]), float(coord[1]), float(coord[2]))
        save_falloff = save_by_coord.get(coord, {}).get("falloff")

        # Find points in threshold
        in_threshold = []
        for i, (pt, t) in enumerate(points):
            d = vec_length(vec_sub(pt, query))
            if d <= threshold:
                in_threshold.append((i, pt, t, d))

        if not in_threshold:
            continue

        # Sort by t to get lateral interval
        in_threshold.sort(key=lambda x: x[2])
        t_values = [t for _, _, t, _ in in_threshold]

        # Get lateral interval
        t_lower = t_values[0]
        t_upper = t_values[-1]

        # Check spline endpoints
        spline_end = points[-1][0]
        d_end = vec_length(vec_sub(spline_end, query))
        if d_end <= threshold:
            t_upper = 1.0

        lateral_interval = (t_lower, t_upper)
        lateral_weight = eval_profile_avg(lateral_profile, lateral_interval)

        # Get nearest distance
        distances = [d for _, _, _, d in in_threshold]
        nearest_d = min(distances)

        # Radial interval
        radial_lower = max((nearest_d - QUERY_RADIUS) / tube_radius, 0)
        radial_upper = min((nearest_d + QUERY_RADIUS) / tube_radius, RADIAL_FACTOR)
        radial_interval = (radial_lower, radial_upper)
        radial_weight = eval_profile_avg(radial_profile, radial_interval)

        # Combined
        combined = lateral_weight * radial_weight

        print(f"Coord: {coord}")
        print(f"  Save falloff: {save_falloff:.6f}")
        print(f"  Lateral interval: [{t_lower:.4f}, {t_upper:.4f}], width={t_upper-t_lower:.4f}")
        print(f"  Lateral weight: {lateral_weight:.6f}")
        print(f"  Nearest distance: {nearest_d:.1f}")
        print(f"  Radial interval: [{radial_lower:.4f}, {radial_upper:.4f}]")
        print(f"  Radial weight: {radial_weight:.6f}")
        print(f"  Combined: {combined:.6f}")
        print(f"  Error: {abs(combined - save_falloff) / save_falloff * 100:.1f}%")
        print()


if __name__ == "__main__":
    main()