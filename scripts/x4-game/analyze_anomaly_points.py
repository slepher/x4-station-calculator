#!/usr/bin/env python3
"""Detailed analysis of anomaly points."""

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


def main():
    region_id = "c602s1_region1"
    sector_id = "Cluster_602_Sector001_macro"

    region = load_region_data(region_id)
    save_data = load_save_data(sector_id)

    spline = region["boundary"]["spline"]
    tube_radius = region["boundary"]["size"]["r"]
    threshold = QUERY_RADIUS + tube_radius

    points = build_spline_points(spline)

    # Anomaly points
    anomaly_coords = [
        (192000, 0, -192000),   # save=0.244, Method E works
        (320000, 0, -256000),   # save=0.320, no method works
        (0, 0, 0),              # save=0.991, Method A works
    ]

    for coord in anomaly_coords:
        query = (float(coord[0]), float(coord[1]), float(coord[2]))

        # Get save falloff
        ore_save = save_data.get("ware", {}).get("ore", {}).get("medium", {}).get("resources", [])
        save_by_coord = {(r["x"], r["y"], r["z"]): r for r in ore_save}
        save_falloff = save_by_coord.get(coord, {}).get("falloff")

        print(f"\n{'='*80}")
        print(f"Coord: {coord}")
        print(f"Save falloff: {save_falloff}")
        print()

        # Find all points in threshold
        in_threshold = []
        for i, (pt, t) in enumerate(points):
            d = vec_length(vec_sub(pt, query))
            if d <= threshold:
                in_threshold.append((i, pt, t, d))

        if not in_threshold:
            print("  No points in threshold!")
            continue

        # Sort by distance
        in_threshold.sort(key=lambda x: x[3])

        print(f"  Points in threshold: {len(in_threshold)}")
        print(f"  Lateral interval: t=[{in_threshold[0][2]:.4f}, {in_threshold[-1][2]:.4f}]")
        print()

        # Distance distribution
        distances = [d for _, _, _, d in in_threshold]
        print(f"  Distance range: [{min(distances):.1f}, {max(distances):.1f}]")
        print(f"  Nearest distance: {min(distances):.1f}")
        print()

        # Check if query is inside or outside tube
        nearest_d = min(distances)
        if nearest_d <= tube_radius:
            print(f"  Query is INSIDE tube (nearest_d={nearest_d:.1f} <= tube_radius={tube_radius})")
        else:
            print(f"  Query is OUTSIDE tube (nearest_d={nearest_d:.1f} > tube_radius={tube_radius})")
        print()

        # Print first and last few points in threshold
        print("  First 5 points in threshold:")
        for i, pt, t, d in in_threshold[:5]:
            radial_frac = d / tube_radius
            print(f"    t={t:.4f}, d={d:.1f}, r/r_tube={radial_frac:.4f}")

        print()
        print("  Last 5 points in threshold:")
        for i, pt, t, d in in_threshold[-5:]:
            radial_frac = d / tube_radius
            print(f"    t={t:.4f}, d={d:.1f}, r/r_tube={radial_frac:.4f}")

        # Check spline endpoints
        spline_start = points[0][0]
        spline_end = points[-1][0]
        d_start = vec_length(vec_sub(spline_start, query))
        d_end = vec_length(vec_sub(spline_end, query))

        print()
        print(f"  Distance to spline start (t=0): {d_start:.1f}, in_threshold={d_start <= threshold}")
        print(f"  Distance to spline end (t=1): {d_end:.1f}, in_threshold={d_end <= threshold}")

        # For points outside tube, check if we need to consider lateral_weight
        if nearest_d > tube_radius:
            # The query is outside the tube
            # The radial_interval should be based on how much of the query sphere
            # intersects with the tube
            #
            # If query is far from tube: small intersection
            # If query is near tube: large intersection

            # Calculate radial interval at nearest point
            lower = max((nearest_d - QUERY_RADIUS) / tube_radius, 0)
            upper = min((nearest_d + QUERY_RADIUS) / tube_radius, RADIAL_FACTOR)

            print()
            print(f"  Radial interval at nearest point: [{lower:.4f}, {upper:.4f}]")

            # The key insight: when query is outside tube, the radial_interval
            # should NOT cover [0, ...]. It should start from a positive value.

            # But the save_falloff tells us something different...
            if save_falloff and save_falloff > 0.9:
                print(f"  Save falloff is high ({save_falloff:.3f}), suggesting query is well inside the effective region")
            elif save_falloff and save_falloff < 0.5:
                print(f"  Save falloff is low ({save_falloff:.3f}), suggesting query is near the edge of effective region")

                # Check the distance at lateral_interval endpoints
                d_lower = in_threshold[0][3]
                d_upper = in_threshold[-1][3]

                # If d_end is within threshold
                if d_end <= threshold:
                    d_upper = d_end

                lower_e = max((d_lower - QUERY_RADIUS) / tube_radius, 0)
                upper_e = min((d_upper + QUERY_RADIUS) / tube_radius, RADIAL_FACTOR)
                lower_2 = max((d_upper - QUERY_RADIUS) / tube_radius, 0)
                upper_2 = min((d_upper + QUERY_RADIUS) / tube_radius, RADIAL_FACTOR)

                merged_lower = min(lower_e, lower_2)
                merged_upper = max(upper_e, upper_2)

                print()
                print(f"  At lateral lower (d={d_lower:.1f}): radial=[{lower_e:.4f}, {upper_e:.4f}]")
                print(f"  At lateral upper (d={d_upper:.1f}): radial=[{lower_2:.4f}, {upper_2:.4f}]")
                print(f"  Merged radial: [{merged_lower:.4f}, {merged_upper:.4f}]")


if __name__ == "__main__":
    main()