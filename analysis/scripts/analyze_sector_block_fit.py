#!/usr/bin/env python3
"""
分析指定星区中 theoretical block 命中与实际 save block 的差异，
并在“假设实际 save 中的所有 block 都应命中”的前提下，重算理论资源总量。

用法:
    python3 analysis/scripts/analyze_sector_block_fit.py --sector cluster_703_sector001_macro
    python3 analysis/scripts/analyze_sector_block_fit.py --sector cluster_06_sector001_macro --save save_005 --version 8.0
"""

import argparse
import copy
import json
import math
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from processor.map.calculator import generate_boundary_block_coordinates

BLOCK_SIZE = 64000
BLOCK_VOLUME_KM3 = 64 * 64 * 64
GAS_WARES = {"helium", "hydrogen", "methane"}


def normalize(value: str) -> str:
    return value.strip().lower()


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def build_region_boundary_map(regions_json: list[dict]) -> dict[str, dict]:
    result: dict[str, dict] = {}
    for item in regions_json:
        key = normalize(item.get("id", "") or item.get("ref", ""))
        if not key:
            continue
        boundary = item.get("boundary")
        if not isinstance(boundary, dict):
            continue
        result[key] = boundary
    return result


def enrich_sector_areas_with_region_boundaries(sector_areas: list[dict], region_boundary_map: dict[str, dict]) -> list[dict]:
    enriched: list[dict] = []
    for area in sector_areas:
        cloned = copy.deepcopy(area)
        area_ref = normalize(cloned.get("ref", ""))
        boundary = cloned.get("boundary", {})
        if boundary.get("class") == "splinetube":
            region_boundary = region_boundary_map.get(area_ref, {})
            spline = region_boundary.get("spline")
            if spline:
                cloned.setdefault("boundary", {})
                cloned["boundary"]["spline"] = spline
        enriched.append(cloned)
    return enriched


def scaled_boundary(boundary: dict, radius_scale: float) -> dict:
    cloned = copy.deepcopy(boundary)
    size = cloned.get("size", {})
    if cloned.get("class") in {"sphere", "cylinder", "splinetube"} and "r" in size:
        size["r"] = float(size["r"]) * radius_scale
    return cloned


def generate_theoretical_blocks(area: dict, radius_scale: float = 1.0) -> tuple[set[tuple[int, int, int]], str | None]:
    total_coords, _effective_coords = generate_boundary_block_coordinates(
        region_pos=area.get("position", {}),
        boundary=scaled_boundary(area.get("boundary", {}), radius_scale),
    )
    if not total_coords and area.get("boundary", {}).get("class") not in {"cylinder", "sphere", "box", "splinetube"}:
        return set(), f"unsupported boundary class: {area.get('boundary', {}).get('class')}"
    return set(total_coords), None


def format_pct(value: float) -> str:
    return f"{value:.2f}%"


def boundary_center(area: dict) -> tuple[float, float, float]:
    position = area.get("position", {})
    boundary = area.get("boundary", {})
    size = boundary.get("size", {})
    if boundary.get("class") == "cylinder":
        return (
            float(position["x"]),
            float(position["y"]) + float(size["linear"]) / 2,
            float(position["z"]),
        )
    return (float(position["x"]), float(position["y"]), float(position["z"]))


def boundary_reach_radius(area: dict) -> float:
    boundary = area.get("boundary", {})
    size = boundary.get("size", {})
    shape = boundary.get("class")
    if shape == "sphere":
        return float(size["r"])
    if shape == "box":
        return math.sqrt(
            (float(size["x"]) / 2) ** 2 + (float(size["y"]) / 2) ** 2 + (float(size["z"]) / 2) ** 2
        )
    if shape == "cylinder":
        return math.sqrt(float(size["r"]) ** 2 + (float(size["linear"]) / 2) ** 2)
    return float(size.get("r", 0) or 0) + float(size.get("linear", 0) or 0) / 2


def areas_overlap(left: dict, right: dict) -> bool:
    left_center = boundary_center(left)
    right_center = boundary_center(right)
    dx = left_center[0] - right_center[0]
    dy = left_center[1] - right_center[1]
    dz = left_center[2] - right_center[2]
    center_distance = math.sqrt(dx * dx + dy * dy + dz * dz)
    return center_distance <= boundary_reach_radius(left) + boundary_reach_radius(right)


def build_overlap_components_for_ware(sector_areas: list[dict], ware: str) -> dict[str, list[str]]:
    relevant = []
    for area in sector_areas:
        if any(normalize(resource.get("ware", "")) == ware for resource in area.get("resources", [])):
            relevant.append(area)

    adjacency: dict[str, set[str]] = {}
    for area in relevant:
        ref = area.get("ref", "")
        adjacency.setdefault(ref, set()).add(ref)

    for i, left in enumerate(relevant):
        left_ref = left.get("ref", "")
        for right in relevant[i + 1 :]:
            right_ref = right.get("ref", "")
            if areas_overlap(left, right):
                adjacency.setdefault(left_ref, set()).add(right_ref)
                adjacency.setdefault(right_ref, set()).add(left_ref)

    components: dict[str, list[str]] = {}
    visited = set()
    for ref in adjacency:
        if ref in visited:
            continue
        stack = [ref]
        component = []
        visited.add(ref)
        while stack:
            current = stack.pop()
            component.append(current)
            for neighbor in adjacency.get(current, set()):
                if neighbor in visited:
                    continue
                visited.add(neighbor)
                stack.append(neighbor)
        component.sort()
        for member in component:
            components[member] = component
    return components


def point_matches_area(
    area: dict,
    point: tuple[int, int, int],
    block_cache: dict[tuple[str, float], set[tuple[int, int, int]]],
    radius_scale: float = 1.0,
) -> bool:
    area_ref = normalize(area.get("ref", ""))
    cache_key = (area_ref, radius_scale)
    if cache_key not in block_cache:
        total_coords, _effective_coords = generate_boundary_block_coordinates(
            region_pos=area.get("position", {}),
            boundary=scaled_boundary(area.get("boundary", {}), radius_scale),
        )
        block_cache[cache_key] = set(total_coords)
    return point in block_cache[cache_key]


def collect_bucket_actuals(sector_areas: list[dict], sector_json: dict) -> tuple[dict[tuple[str, tuple[str, ...]], dict], dict[str, dict[str, list[str]]]]:
    bucket_actuals: dict[tuple[str, tuple[str, ...]], dict] = {}
    overlap_components_by_ware: dict[str, dict[str, list[str]]] = {}
    block_cache: dict[tuple[str, float], set[tuple[int, int, int]]] = {}

    for ware, yield_map in sector_json.get("ware", {}).items():
        ware_key = normalize(ware)
        overlap_components = build_overlap_components_for_ware(sector_areas, ware_key)
        overlap_components_by_ware[ware_key] = overlap_components

        for yield_name, group in yield_map.items():
            yield_key = normalize(yield_name)
            for resource in group.get("resources", []):
                point = (int(resource["x"]), int(resource["y"]), int(resource["z"]))
                candidates = []
                matches = []
                for area in sector_areas:
                    if not any(
                        normalize(definition.get("ware", "")) == ware_key
                        and normalize(definition.get("yield_name", "")) == yield_key
                        for definition in area.get("resources", [])
                    ):
                        continue
                    candidates.append(area.get("ref", ""))
                    if point_matches_area(area, point, block_cache, 1.0):
                        matches.append(area.get("ref", ""))

                unique_candidates = tuple(sorted(set(ref for ref in candidates if ref)))
                if len(unique_candidates) == 1:
                    refs = unique_candidates
                elif not matches:
                    relaxed_matches = []
                    for area in sector_areas:
                        area_ref = area.get("ref", "")
                        if area_ref not in unique_candidates:
                            continue
                        if point_matches_area(area, point, block_cache, 2.0):
                            relaxed_matches.append(area_ref)

                    if relaxed_matches:
                        bucket_refs = set()
                        for ref in relaxed_matches:
                            for expanded in overlap_components.get(ref, [ref]):
                                bucket_refs.add(expanded)
                        refs = tuple(sorted(bucket_refs))
                    else:
                        bucket_refs = set()
                        for ref in unique_candidates:
                            for expanded in overlap_components.get(ref, [ref]):
                                bucket_refs.add(expanded)
                        refs = tuple(sorted(bucket_refs)) if bucket_refs else ("",)
                else:
                    bucket_refs = set()
                    for ref in matches:
                        for expanded in overlap_components.get(ref, [ref]):
                            bucket_refs.add(expanded)
                    refs = tuple(sorted(bucket_refs))

                key = (ware_key, refs)
                entry = bucket_actuals.setdefault(
                    key,
                    {
                        "ware": ware_key,
                        "regions": list(refs),
                        "actual_blocks": set(),
                        "actual_total": 0.0,
                        "yield_names": set(),
                    },
                )
                entry["actual_blocks"].add(point)
                entry["actual_total"] += float(resource.get("max", 0) or 0)
                entry["yield_names"].add(yield_key)

    return bucket_actuals, overlap_components_by_ware


def main():
    parser = argparse.ArgumentParser(description="分析 sector 的 theoretical block 与实际 save block 的差异")
    parser.add_argument("--sector", required=True, help="sector id，例如 cluster_703_sector001_macro")
    parser.add_argument("--save", default="save_005", help="save 目录名，默认 save_005")
    parser.add_argument("--version", default="8.0", help="数据版本，默认 8.0")
    parser.add_argument("--json-out", help="将结果写入指定 JSON 文件")
    args = parser.parse_args()

    version_dir = ROOT / f"src/assets/x4_game_data/{args.version}-Diplomacy/data"
    resourceareas = load_json(version_dir / "resourceareas.json")
    regions_json = load_json(version_dir / "regions.json")
    total_json = load_json(ROOT / "save_data" / args.save / "total.json")
    sector_json = load_json(ROOT / "save_data" / args.save / f"{normalize(args.sector)}.json")

    sector_areas = None
    for sector in resourceareas:
        if normalize(sector.get("sector_id", "")) == normalize(args.sector):
            sector_areas = sector.get("areas", [])
            break

    if sector_areas is None:
        raise SystemExit(f"未找到 sector: {args.sector}")

    region_boundary_map = build_region_boundary_map(regions_json)
    sector_areas = enrich_sector_areas_with_region_boundaries(sector_areas, region_boundary_map)

    sector_total = None
    for sector in total_json.get("sectors", []):
        if normalize(sector.get("sector_id", "")) == normalize(args.sector):
            sector_total = sector
            break

    if sector_total is None:
        raise SystemExit(f"未找到 total.json sector: {args.sector}")

    bucket_actuals, _overlap_components_by_ware = collect_bucket_actuals(sector_areas, sector_json)

    sector_key = normalize(args.sector)
    print(f"Sector: {sector_key}")
    print()
    print("== Block 命中差异 ==")

    results = []

    for ware, buckets in sector_total.get("ware", {}).items():
        ware_key = normalize(ware)
        for bucket in buckets:
            refs = tuple(sorted(normalize(item.get("ref", "")) for item in bucket.get("regions", [])))
            bucket_key = (ware_key, refs)
            actual_entry = bucket_actuals.get(
                bucket_key,
                {"actual_blocks": set(), "actual_total": 0.0, "yield_names": set(), "regions": list(refs)},
            )

            if refs == ("",):
                theoretical_blocks = set()
                warnings = []
                matched_areas = []
            else:
                matched_areas = [area for area in sector_areas if normalize(area.get("ref", "")) in refs]
                theoretical_blocks = set()
                warnings = []
                for area in matched_areas:
                    area_blocks, warning = generate_theoretical_blocks(area)
                    if warning:
                        warnings.append(f"{area.get('ref')}: {warning}")
                        continue
                    theoretical_blocks |= area_blocks

            actual_blocks = set(actual_entry["actual_blocks"])
            intersection = theoretical_blocks & actual_blocks
            theory_only = sorted(theoretical_blocks - actual_blocks)
            actual_only = sorted(actual_blocks - theoretical_blocks)
            actual_total = float(actual_entry["actual_total"])

            density_sum = 0.0
            falloff_weighted_sum = 0.0
            factor2_weighted_sum = 0.0
            solid_theory_f1 = 0.0
            solid_theory_f2 = 0.0
            for area in matched_areas:
                area_total_volume_km3 = float(area.get("total_volume_km3", 0) or 0)
                area_falloff_factor = float(area.get("falloff_factor", 0) or 0)
                area_effective_factor_2 = float(area.get("effective_factor_2", 0) or 0)
                for resource in area.get("resources", []):
                    if normalize(resource.get("ware", "")) != ware_key:
                        continue
                    density = float(resource.get("resourcedensity", 0) or 0)
                    density_sum += density
                    falloff_weighted_sum += density * float(area.get("falloff_factor", 0) or 0)
                    factor2_weighted_sum += density * float(area.get("effective_factor_2", 0) or 0)
                    if ware_key not in GAS_WARES:
                        solid_theory_f1 += area_total_volume_km3 * density * area_falloff_factor
                        solid_theory_f2 += area_total_volume_km3 * density * area_effective_factor_2

            if density_sum > 0:
                falloff_factor = falloff_weighted_sum / density_sum
                effective_factor_2 = factor2_weighted_sum / density_sum
            else:
                falloff_factor = 0.0
                effective_factor_2 = 0.0

            if ware_key in GAS_WARES:
                theory_actual_blocks_f1 = len(actual_blocks) * density_sum * falloff_factor
                theory_actual_blocks_f2 = len(actual_blocks) * density_sum * effective_factor_2
            else:
                theory_actual_blocks_f1 = solid_theory_f1
                theory_actual_blocks_f2 = solid_theory_f2

            diff_f1 = actual_total - theory_actual_blocks_f1
            diff_f2 = actual_total - theory_actual_blocks_f2
            pct_f1 = 0.0 if theory_actual_blocks_f1 == 0 else diff_f1 / theory_actual_blocks_f1 * 100
            pct_f2 = 0.0 if theory_actual_blocks_f2 == 0 else diff_f2 / theory_actual_blocks_f2 * 100

            result = {
                "ware": ware_key,
                "regions": list(refs),
                "yield_names": sorted(actual_entry["yield_names"]),
                "theory_count": len(theoretical_blocks),
                "actual_count": len(actual_blocks),
                "intersection": len(intersection),
                "theory_only": theory_only,
                "actual_only": actual_only,
                "actual_total": actual_total,
                "theory_f1": theory_actual_blocks_f1,
                "theory_f2": theory_actual_blocks_f2,
                "diff_f1": diff_f1,
                "diff_f2": diff_f2,
                "pct_f1": pct_f1,
                "pct_f2": pct_f2,
            }
            if warnings:
                result["warnings"] = warnings
            results.append(result)

            print(f"[{'|'.join(refs)}] {ware_key}")
            print(
                f"  theory_blocks={len(theoretical_blocks)} actual_blocks={len(actual_blocks)} "
                f"intersection={len(intersection)}"
            )
            print(f"  theory_only={theory_only}")
            print(f"  actual_only={actual_only}")
            if warnings:
                print(f"  warnings={warnings}")

    print()
    print("== 假设实际 save block 全部应命中时的资源差异 ==")

    for item in results:
        print(f"[{'|'.join(item['regions'])}] {item['ware']}")
        print(f"  actual_total={item['actual_total']:.3f}")
        print(
            f"  theory_f1={item['theory_f1']:.3f} diff={item['diff_f1']:.3f} "
            f"pct={format_pct(item['pct_f1'])}"
        )
        print(
            f"  theory_f2={item['theory_f2']:.3f} diff={item['diff_f2']:.3f} "
            f"pct={format_pct(item['pct_f2'])}"
        )

    if args.json_out:
        output_path = Path(args.json_out)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "sector_id": sector_key,
            "save": args.save,
            "version": args.version,
            "results": results,
        }
        with output_path.open("w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        print()
        print(f"JSON written to {output_path}")


if __name__ == "__main__":
    main()
