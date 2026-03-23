#!/usr/bin/env python3

import argparse
import copy
import json
import math
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from processor.map.calculator import generate_boundary_block_coordinates
from processor.utils.math_utils import sample_spline_curve_points

BLOCK_SIZE = 64000
BLOCK_HALF = BLOCK_SIZE / 2


def normalize(value: str) -> str:
    return value.strip().lower()


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def cube_faces(cx: float, cy: float, cz: float, size: float):
    half = size / 2
    v = [
        (cx - half, cy - half, cz - half),
        (cx + half, cy - half, cz - half),
        (cx + half, cy + half, cz - half),
        (cx - half, cy + half, cz - half),
        (cx - half, cy - half, cz + half),
        (cx + half, cy - half, cz + half),
        (cx + half, cy + half, cz + half),
        (cx - half, cy + half, cz + half),
    ]
    return [
        [v[0], v[1], v[2], v[3]],
        [v[4], v[5], v[6], v[7]],
        [v[0], v[1], v[5], v[4]],
        [v[2], v[3], v[7], v[6]],
        [v[1], v[2], v[6], v[5]],
        [v[4], v[7], v[3], v[0]],
    ]


def add_cubes(ax, centers, color, alpha, edgecolor, linewidth):
    for cx, cy, cz in centers:
        faces = cube_faces(cx, cy, cz, BLOCK_SIZE)
        poly = Poly3DCollection(
            faces,
            facecolors=color,
            edgecolors=edgecolor,
            linewidths=linewidth,
            alpha=alpha,
        )
        ax.add_collection3d(poly)


def normalize_vec(vec):
    length = math.sqrt(sum(component * component for component in vec))
    if length <= 1e-9:
        return None
    return tuple(component / length for component in vec)


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def build_tube_faces(points, radius, radial_segments=16):
    if len(points) < 2:
        return []

    rings = []
    previous_normal = None
    for index, point in enumerate(points):
        if index == 0:
            tangent = (
                points[1]["x"] - point["x"],
                points[1]["y"] - point["y"],
                points[1]["z"] - point["z"],
            )
        elif index == len(points) - 1:
            tangent = (
                point["x"] - points[index - 1]["x"],
                point["y"] - points[index - 1]["y"],
                point["z"] - points[index - 1]["z"],
            )
        else:
            tangent = (
                points[index + 1]["x"] - points[index - 1]["x"],
                points[index + 1]["y"] - points[index - 1]["y"],
                points[index + 1]["z"] - points[index - 1]["z"],
            )
        tangent = normalize_vec(tangent)
        if tangent is None:
            continue

        reference = (0.0, 1.0, 0.0) if abs(tangent[1]) < 0.9 else (1.0, 0.0, 0.0)
        normal = normalize_vec(cross(tangent, reference))
        if normal is None:
            reference = (0.0, 0.0, 1.0)
            normal = normalize_vec(cross(tangent, reference))
        if normal is None:
            continue
        if previous_normal is not None and sum(a * b for a, b in zip(previous_normal, normal)) < 0:
            normal = tuple(-component for component in normal)
        previous_normal = normal
        binormal = normalize_vec(cross(tangent, normal))
        if binormal is None:
            continue

        ring = []
        for step in range(radial_segments):
            angle = (2.0 * math.pi * step) / radial_segments
            offset = tuple(
                radius * (math.cos(angle) * normal[i] + math.sin(angle) * binormal[i])
                for i in range(3)
            )
            ring.append(
                (
                    point["x"] + offset[0],
                    point["y"] + offset[1],
                    point["z"] + offset[2],
                )
            )
        rings.append(ring)

    faces = []
    for left_ring, right_ring in zip(rings, rings[1:]):
        for index in range(radial_segments):
            next_index = (index + 1) % radial_segments
            faces.append(
                [
                    left_ring[index],
                    left_ring[next_index],
                    right_ring[next_index],
                    right_ring[index],
                ]
            )
    return faces


def enrich_splines(sector_areas: list[dict], regions_json: list[dict]) -> list[dict]:
    region_map = {normalize(item.get("id", "") or item.get("ref", "")): item for item in regions_json}
    enriched = []
    for area in sector_areas:
        cloned = copy.deepcopy(area)
        if cloned.get("boundary", {}).get("class") == "splinetube":
            region = region_map.get(normalize(cloned.get("ref", "")))
            if region and region.get("boundary", {}).get("spline"):
                cloned["boundary"]["spline"] = region["boundary"]["spline"]
        enriched.append(cloned)
    return enriched


def collect_actual_blocks(sector_json: dict, ware: str):
    result = set()
    for yield_group in sector_json.get("ware", {}).get(ware, {}).values():
        for resource in yield_group.get("resources", []):
            result.add((resource["x"], resource["y"], resource["z"]))
    return result


def main():
    parser = argparse.ArgumentParser(description="绘制 sector tube 3D 方块图")
    parser.add_argument("--sector", required=True)
    parser.add_argument("--ware", required=True)
    parser.add_argument("--region", required=True)
    parser.add_argument("--save", default="save_005")
    parser.add_argument("--version", default="8.0")
    parser.add_argument("--output")
    parser.add_argument("--tube-only", action="store_true")
    args = parser.parse_args()

    version_dir = ROOT / f"src/assets/x4_game_data/{args.version}-Diplomacy/data"
    resourceareas = load_json(version_dir / "resourceareas.json")
    regions_json = load_json(version_dir / "regions.json")
    sector_json = load_json(ROOT / "save_data" / args.save / f"{normalize(args.sector)}.json")

    sector = next(item for item in resourceareas if normalize(item["sector_id"]) == normalize(args.sector))
    sector_areas = enrich_splines(sector["areas"], regions_json)
    area = next(item for item in sector_areas if normalize(item["ref"]) == normalize(args.region))

    theory_blocks, _ = generate_boundary_block_coordinates(area["position"], area["boundary"])
    theory_blocks = set(theory_blocks)
    actual_blocks = collect_actual_blocks(sector_json, normalize(args.ware))

    shared_blocks = sorted(theory_blocks & actual_blocks)
    theory_only = sorted(theory_blocks - actual_blocks)
    actual_only = sorted(actual_blocks - theory_blocks)

    spline_points = sample_spline_curve_points(area["boundary"].get("spline", []), samples_per_segment=32)
    xs = [p["x"] for p in spline_points]
    ys = [p["y"] for p in spline_points]
    zs = [p["z"] for p in spline_points]

    fig = plt.figure(figsize=(13, 10))
    ax = fig.add_subplot(111, projection="3d")
    ax.set_title(f"{args.sector} | {args.ware} | {args.region}")

    if not args.tube_only:
        add_cubes(ax, shared_blocks, color="#b59b57", alpha=0.18, edgecolor="#d6bf84", linewidth=0.5)
        add_cubes(ax, theory_only, color="#d95f5f", alpha=0.20, edgecolor="#ffb3b3", linewidth=0.8)
        add_cubes(ax, actual_only, color="#5fa8d9", alpha=0.20, edgecolor="#b8e1ff", linewidth=0.8)

    if spline_points:
        tube_faces = build_tube_faces(spline_points, float(area["boundary"]["size"]["r"]), radial_segments=16)
        if tube_faces:
            tube_poly = Poly3DCollection(
                tube_faces,
                facecolors="#f2f2f2",
                edgecolors="#d0d0d0",
                linewidths=0.15,
                alpha=0.08,
            )
            ax.add_collection3d(tube_poly)
        ax.plot(xs, ys, zs, color="#ffffff", linewidth=2.5, label="tube center spline")
        ax.scatter(xs[0], ys[0], zs[0], color="#7CFC00", s=30, label="spline start")
        ax.scatter(xs[-1], ys[-1], zs[-1], color="#ff8c00", s=30, label="spline end")

    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_zlabel("z")
    ax.legend(loc="upper right")
    ax.grid(True)

    all_points = list(shared_blocks) + list(theory_only) + list(actual_only)
    if spline_points:
        all_points += [(p["x"], p["y"], p["z"]) for p in spline_points]
    if all_points:
        min_x = min(p[0] for p in all_points) - BLOCK_SIZE
        max_x = max(p[0] for p in all_points) + BLOCK_SIZE
        min_y = min(p[1] for p in all_points) - BLOCK_SIZE
        max_y = max(p[1] for p in all_points) + BLOCK_SIZE
        min_z = min(p[2] for p in all_points) - BLOCK_SIZE
        max_z = max(p[2] for p in all_points) + BLOCK_SIZE
        ax.set_xlim(min_x, max_x)
        ax.set_ylim(min_y, max_y)
        ax.set_zlim(min_z, max_z)

    output = (
        Path(args.output)
        if args.output
        else ROOT / "analysis" / "doc" / "resource" / f"{normalize(args.sector)}_{normalize(args.ware)}_{normalize(args.region)}_3d.png"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout()
    fig.savefig(output, dpi=180)
    print(output)


if __name__ == "__main__":
    main()
