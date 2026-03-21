#!/usr/bin/env python3
"""Solid field replay v2 using the reverse-confirmed 64k query-box path.

Current scope:

- raw inputs only:
  - `resourceareas.json`: sector placement / resource row
  - `regions.json`: raw boundary + raw falloff control points
  - `region_definitions/final.xml`: solid field rows
  - `regionobjectgroups/final.xml`: group yield / variation
  - `regionyields/final.xml`: resourcedensity / replenishtime
- runtime chain:
  - `FUN_14073e110`
  - `FUN_140e84940`
  - `FUN_140e83f80`
  - `FUN_140e80300`
  - `FUN_140e803e0`
  - `FUN_140e84990`
  - `FUN_14073f750`
  - `FUN_140e84c30`
- sample target:
  - `Cluster_03_Sector001_macro / p1_40km_ice_field`

Important current boundary:

- `local_noise` only implements the reverse-confirmed fast path in
  `FUN_1414f4840`, i.e. `cell_count > 16 -> F(maxnoise) - F(minnoise)`.
- If a field/query combination falls into the small-cell branch, the script
  stops with an explicit error instead of guessing.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field
import json
import math
from pathlib import Path
import struct
import xml.etree.ElementTree as ET


AREA_SIZE = 64000.0
AREA_HALF = AREA_SIZE / 2.0
QUERY_RADIUS_14073F750 = 55425.625
NOISE_CLAMP_SCALE_140E84C30 = 9.999999717180685e-10
NOISE_CDF_CENTER_1414F5870 = 0.5
NOISE_CDF_SIGN_NEGATIVE_1414F5870 = -1.0
NOISE_CDF_ABS_SCALE_1414F5870 = 4.5
NOISE_CDF_LINEAR_1414F5870 = 0.30000001192092896
NOISE_CDF_CROSS_1414F5870 = 0.0009720000089146197
NOISE_CDF_QUAD_1414F5870 = 4.665377140045166
NOISE_CDF_CROSS_SCALE_1414F5870 = 20.25
NOISE_CDF_QUARTIC_1414F5870 = 32.02915954589844
CLAMP_UPPER_140E84C30 = 262144.0
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "src" / "assets" / "x4_game_data" / "8.0-Diplomacy" / "data"
RESOURCEAREAS_JSON = DATA_ROOT / "resourceareas.json"
REGIONS_JSON = DATA_ROOT / "regions.json"
REGION_DEFINITIONS_XML = PROJECT_ROOT / "x4raw_assets" / "8.0-Diplomacy" / "libraries" / "region_definitions" / "final.xml"
REGIONOBJECTGROUPS_XML = PROJECT_ROOT / "x4raw_assets" / "8.0-Diplomacy" / "libraries" / "regionobjectgroups" / "final.xml"
REGIONYIELDS_XML = PROJECT_ROOT / "x4raw_assets" / "8.0-Diplomacy" / "libraries" / "regionyields" / "final.xml"
SAVE_SAMPLE_ROOT = PROJECT_ROOT / "save_sample_data"


def f32(value: float) -> float:
    return struct.unpack("<f", struct.pack("<f", float(value)))[0]


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def truncate_to_runtime_int(value: float) -> int:
    if value <= 0.0:
        return 0
    return int(value)


@dataclass
class ProfilePoint:
    position: float
    value: float


@dataclass
class FalloffProfiles:
    lateral: list[ProfilePoint]
    radial: list[ProfilePoint]


@dataclass
class RegionYieldPayload:
    ware: str
    yield_name: str
    resourcedensity: float
    replenishtime: float
    gatherspeedfactor: float


@dataclass
class RegionObjectGroup:
    name: str
    resource: str
    yield_value: float
    yieldvariation: float


@dataclass
class SolidFieldDefinition:
    groupref: str
    densityfactor: float
    noisescale: float
    seed: str
    minnoisevalue: float
    maxnoisevalue: float


@dataclass
class SolidFieldState:
    name: str
    ware_key: str = ""
    yield_value: float = 0.0
    resourcepercentage: float = 1.0
    yieldvariation: float = 0.0
    densityfactor: float = 1.0
    region_density: float = 1.0
    field_0x1150_density_base_scaled: float = 0.0
    ref_target_class_id: int = 0x77
    class_density_by_id: dict[int, float] = field(default_factory=lambda: {0x77: 1.0})
    universe_yield_density_by_ware: dict[str, float] = field(default_factory=dict)
    universe_object_yield_density_by_ware: dict[str, float] = field(default_factory=dict)
    noisescale: float = 5000.0
    seed: str = ""
    minnoisevalue: float = 0.0
    maxnoisevalue: float = 1.0


@dataclass
class SolidRegionState:
    sector_id: str
    field_ref: str
    position_x: float
    position_y: float
    position_z: float
    radius: float
    linear: float
    region_density: float
    falloff: FalloffProfiles
    payload: RegionYieldPayload
    fields: list[SolidFieldState]


def load_json_rows(path: Path) -> object:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_xml_root(path: Path) -> ET.Element:
    return ET.parse(path).getroot()


def eval_profile_avg_1414ED970(profile: list[ProfilePoint], interval: tuple[float, float]) -> float:
    lower, upper = interval
    if upper <= lower:
        return 0.0

    def value_at(x: float) -> float:
        if x <= profile[0].position:
            return profile[0].value
        for left, right in zip(profile, profile[1:]):
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
    for x0, x1 in zip(xs, xs[1:]):
        y0 = value_at(x0)
        y1 = value_at(x1)
        area += (y0 + y1) * 0.5 * (x1 - x0)
    return area / (upper - lower)


def vec_sub(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vec_add(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def vec_mul(a: tuple[float, float, float], scale: float) -> tuple[float, float, float]:
    return (a[0] * scale, a[1] * scale, a[2] * scale)


def dot(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def vec_length(a: tuple[float, float, float]) -> float:
    return math.sqrt(dot(a, a))


def index_regions_by_id() -> dict[str, dict]:
    return {row["id"]: row for row in load_json_rows(REGIONS_JSON)}


def find_sector_area_entry(sector_id: str, field_ref: str) -> dict:
    for sector_entry in load_json_rows(RESOURCEAREAS_JSON):
        if sector_entry.get("sector_id") != sector_id:
            continue
        for area in sector_entry.get("areas", []):
            if area.get("ref") == field_ref:
                return area
    raise ValueError(f"sector/field not found: {sector_id} / {field_ref}")


def parse_region_definition_140E80D20(field_ref: str) -> tuple[float, list[SolidFieldDefinition], tuple[str, str]]:
    root = load_xml_root(REGION_DEFINITIONS_XML)
    for region in root.findall("region"):
        if region.get("name") != field_ref:
            continue
        density = float(region.get("density", "1"))
        field_defs = [
            SolidFieldDefinition(
                groupref=str(node.get("groupref")),
                densityfactor=float(node.get("densityfactor", "1")),
                noisescale=float(node.get("noisescale", "15000")),
                seed=str(node.get("seed", "")),
                minnoisevalue=float(node.get("minnoisevalue", "0")),
                maxnoisevalue=float(node.get("maxnoisevalue", "1")),
            )
            for node in region.find("fields").findall("asteroid")
        ]
        resource_node = region.find("resources").find("resource")
        return density, field_defs, (str(resource_node.get("ware")), str(resource_node.get("yield")))
    raise ValueError(f"region definition not found: {field_ref}")


def parse_region_object_groups_140E950A0() -> dict[str, RegionObjectGroup]:
    root = load_xml_root(REGIONOBJECTGROUPS_XML)
    groups: dict[str, RegionObjectGroup] = {}
    for node in root.findall("group"):
        groups[str(node.get("name"))] = RegionObjectGroup(
            name=str(node.get("name")),
            resource=str(node.get("resource")),
            yield_value=float(node.get("yield", "0")),
            yieldvariation=float(node.get("yieldvariation", "0")),
        )
    return groups


def parse_region_yield_payload_140E83F80(ware: str, yield_name: str) -> RegionYieldPayload:
    root = load_xml_root(REGIONYIELDS_XML)
    for resource in root.findall("resource"):
        if resource.get("ware") != ware:
            continue
        for node in resource.findall("yield"):
            if node.get("name") != yield_name:
                continue
            return RegionYieldPayload(
                ware=ware,
                yield_name=yield_name,
                resourcedensity=float(node.get("resourcedensity", "0")),
                replenishtime=float(node.get("replenishtime", "0")),
                gatherspeedfactor=1.0,
            )
    raise ValueError(f"region yield row not found: {ware} / {yield_name}")


def initialize_field_from_region_definition_140E842E0(
    field: SolidFieldState,
    *,
    densityfactor: float,
    region_density: float,
    noisescale: float,
    seed: str,
    minnoisevalue: float,
    maxnoisevalue: float,
) -> None:
    field.densityfactor = densityfactor
    field.region_density = region_density
    field.field_0x1150_density_base_scaled = densityfactor * region_density * 0.01
    field.noisescale = noisescale
    field.seed = seed
    field.minnoisevalue = minnoisevalue
    field.maxnoisevalue = maxnoisevalue


def apply_groupref_to_field_140E84940(field: SolidFieldState, group: RegionObjectGroup) -> None:
    if not field.ware_key:
        field.ware_key = group.resource
    if field.yield_value <= 0.0:
        field.yield_value = group.yield_value
        field.yieldvariation = group.yieldvariation
        field.resourcepercentage = 0.0


def apply_region_yield_payload_to_field_140E83F80(field: SolidFieldState, payload: RegionYieldPayload) -> None:
    if field.yield_value <= 0.0:
        field.yield_value = payload.resourcedensity


def compute_multiplier_a_140E80300(field: SolidFieldState) -> float:
    return field.field_0x1150_density_base_scaled * field.class_density_by_id.get(field.ref_target_class_id, 1.0)


def compute_multiplier_b_140E803E0(field: SolidFieldState) -> float:
    return (
        field.universe_yield_density_by_ware.get(field.ware_key, 1.0)
        * field.yield_value
        * field.universe_object_yield_density_by_ware.get(field.ware_key, 1.0)
    )


def compute_noise_window_weight_140E85B80(field: SolidFieldState) -> float:
    return (
        compute_multiplier_a_140E80300(field)
        * compute_multiplier_b_140E803E0(field)
        * compute_local_noise_fast_path_1414F4840(field)
    )


def apply_per_field_value_writeback_140E84990(field: SolidFieldState, per_field_value: float) -> None:
    field.resourcepercentage = per_field_value
    if per_field_value > 1.0:
        field.resourcepercentage = 1.0
        field.yield_value = per_field_value * field.yield_value


def compute_noise_cdf_1414F5870(param_1: float) -> float:
    x = f32(param_1 - NOISE_CDF_CENTER_1414F5870)
    if x < 0.0:
        sign = NOISE_CDF_SIGN_NEGATIVE_1414F5870
    elif x > 0.0:
        sign = 1.0
    else:
        sign = 0.0

    abs_scaled = f32(abs(x) * NOISE_CDF_ABS_SCALE_1414F5870)
    x2 = f32(x * x)
    poly = f32(
        x2 * NOISE_CDF_QUAD_1414F5870
        + abs_scaled * NOISE_CDF_LINEAR_1414F5870
        + abs_scaled * NOISE_CDF_CROSS_1414F5870 * x2 * NOISE_CDF_CROSS_SCALE_1414F5870
        + x2 * x2 * NOISE_CDF_QUARTIC_1414F5870
        + 1.0
    )
    poly_sq = f32(poly * poly)
    return f32(((sign - sign / f32(poly_sq * poly_sq)) + 1.0) * NOISE_CDF_CENTER_1414F5870)


def compute_local_noise_fast_path_1414F4840(field: SolidFieldState) -> float:
    return f32(compute_noise_cdf_1414F5870(field.maxnoisevalue) - compute_noise_cdf_1414F5870(field.minnoisevalue))


def assert_noise_fast_path_supported_1414F4840(field: SolidFieldState, tile_x: int, tile_y: int, tile_z: int) -> None:
    min_x = (tile_x - AREA_HALF) / field.noisescale
    max_x = (tile_x + AREA_HALF) / field.noisescale
    min_y = (tile_y - AREA_HALF) / field.noisescale
    max_y = (tile_y + AREA_HALF) / field.noisescale
    min_z = (tile_z - AREA_HALF) / field.noisescale
    max_z = (tile_z + AREA_HALF) / field.noisescale
    cell_count = (
        max(math.ceil(max_x), math.floor(min_x) + 1) - math.floor(min_x)
    ) * (
        max(math.ceil(max_y), math.floor(min_y) + 1) - math.floor(min_y)
    ) * (
        max(math.ceil(max_z), math.floor(min_z) + 1) - math.floor(min_z)
    )
    if cell_count < 17:
        raise NotImplementedError(
            f"local_noise small-cell path not implemented for {field.name} at {(tile_x, tile_y, tile_z)}; cell_count={cell_count}"
        )


def compute_cylinder_axial_interval_14093DD10(
    region: SolidRegionState,
    query: tuple[float, float, float],
) -> tuple[float, float]:
    p0 = (region.position_x, region.position_y - region.linear, region.position_z)
    p1 = (region.position_x, region.position_y + region.linear, region.position_z)
    axis = vec_sub(p1, p0)
    axis_len = vec_length(axis)
    axis_sq = dot(axis, axis)
    t = dot(vec_sub(query, p0), axis) / axis_sq
    delta = QUERY_RADIUS_14073F750 / axis_len
    return (clamp(t - delta, 0.0, 1.0), clamp(t + delta, 0.0, 1.0))


def compute_cylinder_radial_interval_14093DE40(
    region: SolidRegionState,
    query: tuple[float, float, float],
) -> tuple[float, float]:
    p0 = (region.position_x, region.position_y - region.linear, region.position_z)
    p1 = (region.position_x, region.position_y + region.linear, region.position_z)
    axis = vec_sub(p1, p0)
    axis_sq = dot(axis, axis)
    t = dot(vec_sub(query, p0), axis) / axis_sq
    closest = vec_add(p0, vec_mul(axis, t))
    distance_to_axis = vec_length(vec_sub(query, closest))
    return (
        clamp((distance_to_axis - QUERY_RADIUS_14073F750) / region.radius, 0.0, 1.0),
        clamp((distance_to_axis + QUERY_RADIUS_14073F750) / region.radius, 0.0, 1.0),
    )


def compute_cylinder_falloff_weight_14073F750(
    region: SolidRegionState,
    query: tuple[float, float, float],
) -> dict[str, object]:
    axial_interval = compute_cylinder_axial_interval_14093DD10(region, query)
    radial_interval = compute_cylinder_radial_interval_14093DE40(region, query)
    axial_weight = eval_profile_avg_1414ED970(region.falloff.lateral, axial_interval)
    radial_weight = eval_profile_avg_1414ED970(region.falloff.radial, radial_interval)
    return {
        "axial_interval": axial_interval,
        "radial_interval": radial_interval,
        "axial_weight": axial_weight,
        "radial_weight": radial_weight,
        "falloff": axial_weight * radial_weight,
    }


def compute_boundary_volume_14093E1A0(region: SolidRegionState) -> float:
    return (2.0 * region.linear) * math.pi * region.radius * region.radius


def compute_clamp_factor_140E84C30(region: SolidRegionState) -> float:
    return min(compute_boundary_volume_14093E1A0(region) * NOISE_CLAMP_SCALE_140E84C30, CLAMP_UPPER_140E84C30)


def area_intersects_field_query_box_140E83FF0(region: SolidRegionState, tile_x: int, tile_y: int, tile_z: int) -> bool:
    min_y = region.position_y - region.linear
    max_y = region.position_y + region.linear
    tile_min_y = tile_y - AREA_HALF
    tile_max_y = tile_y + AREA_HALF
    overlaps_y = not (tile_max_y < min_y or tile_min_y > max_y)
    if not overlaps_y:
        return False

    dx = abs(region.position_x - tile_x)
    dz = abs(region.position_z - tile_z)
    clamped_dx = max(dx - AREA_HALF, 0.0)
    clamped_dz = max(dz - AREA_HALF, 0.0)
    return (clamped_dx * clamped_dx + clamped_dz * clamped_dz) <= (region.radius * region.radius)


def enumerate_candidate_area_centers_for_64k_query_boxes_140760320(region: SolidRegionState) -> list[tuple[int, int, int]]:
    min_x = region.position_x - region.radius - AREA_HALF
    max_x = region.position_x + region.radius + AREA_HALF
    min_z = region.position_z - region.radius - AREA_HALF
    max_z = region.position_z + region.radius + AREA_HALF

    start_x = math.floor(min_x / AREA_SIZE) * int(AREA_SIZE)
    end_x = math.floor(max_x / AREA_SIZE) * int(AREA_SIZE)
    start_z = math.floor(min_z / AREA_SIZE) * int(AREA_SIZE)
    end_z = math.floor(max_z / AREA_SIZE) * int(AREA_SIZE)

    coords: list[tuple[int, int, int]] = []
    x = start_x
    while x <= end_x:
        z = start_z
        while z <= end_z:
            if area_intersects_field_query_box_140E83FF0(region, x, 0, z):
                coords.append((x, 0, z))
            z += int(AREA_SIZE)
        x += int(AREA_SIZE)
    return coords


def build_solid_region_from_raw_inputs_14073E110(sector_id: str, field_ref: str) -> SolidRegionState:
    area = find_sector_area_entry(sector_id, field_ref)
    region_json = index_regions_by_id()[field_ref]
    position = area["position"]
    boundary = region_json["boundary"]
    size = boundary["size"]
    falloff = region_json["falloff"]

    region_density, field_defs, (ware, yield_name) = parse_region_definition_140E80D20(field_ref)
    payload = parse_region_yield_payload_140E83F80(ware, yield_name)
    groups = parse_region_object_groups_140E950A0()

    fields: list[SolidFieldState] = []
    for field_def in field_defs:
        state = SolidFieldState(
            name=field_def.groupref,
            universe_yield_density_by_ware={ware: 1.0},
            universe_object_yield_density_by_ware={ware: 1.0},
        )
        initialize_field_from_region_definition_140E842E0(
            state,
            densityfactor=field_def.densityfactor,
            region_density=region_density,
            noisescale=field_def.noisescale,
            seed=field_def.seed,
            minnoisevalue=field_def.minnoisevalue,
            maxnoisevalue=field_def.maxnoisevalue,
        )
        apply_groupref_to_field_140E84940(state, groups[field_def.groupref])
        fields.append(state)

    return SolidRegionState(
        sector_id=sector_id,
        field_ref=field_ref,
        position_x=float(position["x"]),
        position_y=float(position["y"]),
        position_z=float(position["z"]),
        radius=float(size["r"]),
        linear=float(size["linear"]),
        region_density=region_density,
        falloff=FalloffProfiles(
            lateral=[ProfilePoint(float(p["position"]), float(p["value"])) for p in falloff["lateral"]],
            radial=[ProfilePoint(float(p["position"]), float(p["value"])) for p in falloff["radial"]],
        ),
        payload=payload,
        fields=fields,
    )


def replay_region_solid_sum_weights_and_areas_v2_14073E110(region: SolidRegionState) -> dict[str, object]:
    matching_fields = [field for field in region.fields if field.ware_key == region.payload.ware]
    for field in matching_fields:
        apply_region_yield_payload_to_field_140E83F80(field, region.payload)

    weight_rows: list[dict[str, object]] = []
    sum_weights = 0.0
    for field in matching_fields:
        field_weight = compute_noise_window_weight_140E85B80(field)
        sum_weights += field_weight
        weight_rows.append(
            {
                "field": field.name,
                "multiplier_a": compute_multiplier_a_140E80300(field),
                "multiplier_b_before": compute_multiplier_b_140E803E0(field),
                "local_noise_fast": compute_local_noise_fast_path_1414F4840(field),
                "weight": field_weight,
            }
        )

    if sum_weights <= 0.0:
        per_field_value = 0.0
    else:
        per_field_value = region.payload.resourcedensity / sum_weights

    for field in matching_fields:
        apply_per_field_value_writeback_140E84990(field, per_field_value)

    clamp_factor = compute_clamp_factor_140E84C30(region)
    per_tile: list[dict[str, object]] = []
    total_max = 0

    for coord in enumerate_candidate_area_centers_for_64k_query_boxes_140760320(region):
        tile_x, tile_y, tile_z = coord
        for field in matching_fields:
            assert_noise_fast_path_supported_1414F4840(field, tile_x, tile_y, tile_z)

        query = (float(tile_x), float(tile_y), float(tile_z))
        falloff_info = compute_cylinder_falloff_weight_14073F750(region, query)

        field_rows: list[dict[str, object]] = []
        tile_total_float = 0.0
        tile_total = 0
        for field in matching_fields:
            local_noise = compute_local_noise_fast_path_1414F4840(field)
            area_value_float = (
                compute_multiplier_b_140E803E0(field)
                * compute_multiplier_a_140E80300(field)
                * local_noise
                * field.resourcepercentage
                * falloff_info["falloff"]
                * clamp_factor
            )
            area_value = truncate_to_runtime_int(area_value_float)
            tile_total_float += area_value_float
            tile_total += area_value
            field_rows.append(
                {
                    "field": field.name,
                    "yield_after": field.yield_value,
                    "resourcepercentage_after": field.resourcepercentage,
                    "multiplier_a": compute_multiplier_a_140E80300(field),
                    "multiplier_b": compute_multiplier_b_140E803E0(field),
                    "local_noise": local_noise,
                    "area_value_float": area_value_float,
                    "area_value": area_value,
                }
            )

        total_max += tile_total
        per_tile.append(
            {
                "coord": coord,
                "axial_interval": falloff_info["axial_interval"],
                "radial_interval": falloff_info["radial_interval"],
                "axial_weight": falloff_info["axial_weight"],
                "radial_weight": falloff_info["radial_weight"],
                "falloff": falloff_info["falloff"],
                "tile_total_float": tile_total_float,
                "tile_total": tile_total,
                "fields": field_rows,
            }
        )

    return {
        "field": f"{region.sector_id} / {region.field_ref}",
        "payload": region.payload,
        "sum_weights": sum_weights,
        "per_field_value": per_field_value,
        "clamp_factor": clamp_factor,
        "weights": weight_rows,
        "per_tile": per_tile,
        "total_max": total_max,
    }


def load_save_sample_for_ware(sector_id: str, ware: str, yield_name: str) -> dict[tuple[int, int, int], dict]:
    save_path = SAVE_SAMPLE_ROOT / f"{sector_id.lower()}.json"
    with save_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    rows = data["ware"][ware][yield_name]["resources"]
    return {(int(row["x"]), int(row["y"]), int(row["z"])): row for row in rows}


def load_total_sample_for_ware(sector_id: str, ware: str, yield_name: str) -> dict:
    with (SAVE_SAMPLE_ROOT / "total.json").open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    for sector in data["sectors"]:
        if sector["sector_id"] == sector_id.lower():
            return sector["ware"][ware][yield_name]
    raise ValueError(f"sector not found in total.json: {sector_id}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Replay solid region weights and 64k area totals.")
    parser.add_argument("sector_id", nargs="?", default="Cluster_03_Sector001_macro")
    parser.add_argument("field_ref", nargs="?", default="p1_40km_ice_field")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    region = build_solid_region_from_raw_inputs_14073E110(args.sector_id, args.field_ref)
    result = replay_region_solid_sum_weights_and_areas_v2_14073E110(region)
    save_tiles = load_save_sample_for_ware(args.sector_id, region.payload.ware, region.payload.yield_name)
    save_total = load_total_sample_for_ware(args.sector_id, region.payload.ware, region.payload.yield_name)

    print(f"field={result['field']}")
    print(f"ware={region.payload.ware}")
    print(f"yield_name={region.payload.yield_name}")
    print(f"sum_weights={result['sum_weights']:.6f}")
    print(f"per_field_value={result['per_field_value']:.6f}")
    print(f"clamp_factor={result['clamp_factor']:.6f}")
    print("weights:")
    for row in result["weights"]:
        print(
            f"  {row['field']}: "
            f"A={row['multiplier_a']:.6f} "
            f"B_before={row['multiplier_b_before']:.6f} "
            f"local_noise_fast={row['local_noise_fast']:.6f} "
            f"weight={row['weight']:.6f}"
        )
    print("tile_values:")
    for entry in result["per_tile"]:
        coord = entry["coord"]
        save_row = save_tiles.get(coord)
        save_value = None if save_row is None else int(save_row["max"])
        error_ratio = None
        if save_value not in (None, 0):
            error_ratio = (entry["tile_total"] - save_value) / save_value
        print(
            f"  {coord} "
            f"falloff={entry['falloff']:.6f} "
            f"tile_total={entry['tile_total']} "
            f"tile_total_float={entry['tile_total_float']:.6f} "
            f"save_max={save_value if save_value is not None else 'N/A'} "
            f"error_ratio={f'{error_ratio:.4%}' if error_ratio is not None else 'N/A'}"
        )
    total_error_ratio = (result["total_max"] - int(save_total["max"])) / int(save_total["max"])
    print("total_compare:")
    print(f"  replay_total={result['total_max']}")
    print(f"  save_total={int(save_total['max'])}")
    print(f"  error_ratio={total_error_ratio:.4%}")


if __name__ == "__main__":
    main()
