"""Replay context for weight computation - reverse engineered from X4.exe.

FUN_140e860c0: Build NebulaField context from JSON data.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from .profile_eval import ProfilePoint

if TYPE_CHECKING:
    from boundary import Boundary
    from field import NebulaField

    from .grid_enumeration import QueryGridWindow


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_ROOT = PROJECT_ROOT / "src" / "assets" / "x4_game_data" / "8.0-Diplomacy" / "data"
RESOURCEAREAS_JSON = DATA_ROOT / "resourceareas.json"
REGIONS_JSON = DATA_ROOT / "regions.json"
SAVE_SAMPLE_ROOT = PROJECT_ROOT / "save_sample_data"


@dataclass
class GasResourceEntry:
    """Gas resource entry from region JSON.

    Corresponds to C++ resource entry structure.
    """
    ware_key: str
    resourcedensity: float
    recharge_time_seconds: float = 0.0
    gather_speed_factor: float = 1.0
    yield_name: str = ""


@dataclass
class FalloffProfiles:
    """Falloff profile curves for lateral and radial directions.

    Corresponds to C++ falloff structure.
    """
    lateral: list[ProfilePoint] = field(default_factory=list)
    radial: list[ProfilePoint] = field(default_factory=list)
    lateral_factor: float | None = None
    radial_factor: float | None = None


@dataclass
class ReplayContext:
    """Replay context for a specific field/ware combination.

    Holds all data needed to replay weight computation.
    """
    sector_id: str
    region_id: str
    ware_id: str

    # Field data
    field: 'NebulaField'
    boundary: 'Boundary'

    # Grid window for storage coordinates
    field_grid_window: 'QueryGridWindow'

    # Profile data
    falloff: FalloffProfiles

    # Resource data
    resources: list[GasResourceEntry] = field(default_factory=list)

    # Optional save sample for comparison
    save_sample: dict = field(default_factory=dict)
    save_total: dict = field(default_factory=dict)

    # Universe-level data
    universe_yield_density: dict[str, float] = field(default_factory=dict)


def _load_json_rows(path: Path) -> list[dict]:
    """Load JSON file as list of rows."""
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _index_regions_by_id() -> dict[str, dict]:
    """Index regions.json by region id."""
    return {row["id"]: row for row in _load_json_rows(REGIONS_JSON)}


def _find_sector_area_entry(sector_id: str, field_ref: str) -> dict:
    """Find area entry for a sector/field combination."""
    for sector_entry in _load_json_rows(RESOURCEAREAS_JSON):
        if sector_entry.get("sector_id") != sector_id:
            continue
        for area in sector_entry.get("areas", []):
            if area.get("ref") == field_ref:
                return area
    raise ValueError(f"sector/field not found in resourceareas.json: {sector_id} / {field_ref}")


def _build_falloff_profiles(falloff_data: dict) -> FalloffProfiles:
    """Build FalloffProfiles from JSON data."""
    return FalloffProfiles(
        lateral=[
            ProfilePoint(float(p["position"]), float(p["value"]))
            for p in falloff_data.get("lateral", [])
        ],
        radial=[
            ProfilePoint(float(p["position"]), float(p["value"]))
            for p in falloff_data.get("radial", [])
        ],
        lateral_factor=float(falloff_data["lateral_factor"]) if "lateral_factor" in falloff_data else None,
        radial_factor=float(falloff_data["radial_factor"]) if "radial_factor" in falloff_data else None,
    )


def _build_gas_resources(resources_data: list[dict]) -> list[GasResourceEntry]:
    """Build GasResourceEntry list from JSON data."""
    return [
        GasResourceEntry(
            ware_key=row["ware"],
            resourcedensity=float(row["resourcedensity"]),
            recharge_time_seconds=float(row.get("delay", 0)),
            gather_speed_factor=float(row.get("gatherfactor", 1.0)),
            yield_name=str(row.get("yield", row.get("yield_name", ""))),
        )
        for row in resources_data
    ]


def _load_save_sample_for_ware(sector_id: str, ware: str, region_filter: str = "") -> dict:
    """Load save sample data for a specific ware.

    Args:
        sector_id: Sector identifier
        ware: Ware identifier
        region_filter: Optional region filter (e.g., "region_cluster_713_sector_001_nebula_2")
    """
    save_path = SAVE_SAMPLE_ROOT / f"{sector_id.lower()}.json"
    if not save_path.exists():
        return {}

    with save_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if ware not in data.get("ware", {}):
        return {}

    ware_data = data["ware"][ware]

    if isinstance(ware_data, list):
        rows = ware_data
    elif "resources" in ware_data:
        rows = ware_data.get("resources", [])
    else:
        rows = []
        for yn, yd in ware_data.items():
            if isinstance(yd, dict) and "resources" in yd:
                rows.extend(yd["resources"])

    # Filter by region if specified
    if region_filter:
        filtered_rows = []
        for row in rows:
            regions = row.get("regions", [])
            # Check if any region matches the filter
            if any(region_filter in r for r in regions):
                filtered_rows.append(row)
        rows = filtered_rows

    return {(int(row["x"]), int(row["y"]), int(row["z"])): row for row in rows}


def _load_save_total_for_ware(sector_id: str, ware: str, region_filter: str = "") -> dict:
    """Load save total for a ware in a sector."""
    total_path = SAVE_SAMPLE_ROOT / "total.json"
    if not total_path.exists():
        return {}

    with total_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    for sector in data.get("sectors", []):
        if sector.get("sector_id") == sector_id.lower():
            ware_data = sector.get("ware", {}).get(ware, {})
            if isinstance(ware_data, list):
                total = {"max": 0, "cutted": 0}
                for entry in ware_data:
                    if region_filter:
                        regions = entry.get("regions", [])
                        if not any(region_filter in r.get("ref", "") for r in regions):
                            continue
                    total["max"] += entry.get("max", 0)
                    total["cutted"] += entry.get("cutted", 0)
                return total if total["max"] > 0 else {}
            return ware_data
    return {}


def build_replay_context_140e860c0(
    sector_id: str,
    region_id: str,
    ware_id: str,
) -> ReplayContext:
    """Build replay context from JSON data.

    Corresponds to FUN_140e860c0 - NebulaField initialization.

    Args:
        sector_id: Sector identifier (e.g., "Cluster_713_Sector001_macro")
        region_id: Region identifier (e.g., "region_cluster_713_sector_001_nebula_2")
        ware_id: Ware identifier (e.g., "hydrogen")

    Returns:
        ReplayContext with all data needed for weight computation
    """
    from boundary import Boundary
    from field import NebulaField

    from .grid_enumeration import build_query_grid_window_140760320

    # Load region and area data
    region = _index_regions_by_id().get(region_id)
    if region is None:
        raise ValueError(f"region not found in regions.json: {region_id}")

    area = _find_sector_area_entry(sector_id, region_id)

    # Get position
    position_data = area.get("position", {})
    area_position = (
        float(position_data.get("x", 0)),
        float(position_data.get("y", 0)),
        float(position_data.get("z", 0)),
    )

    # Create NebulaField using factory method
    nebula_field = NebulaField.from_region_json(
        region_data=region,
        area_position=area_position,
        ware_key=ware_id,
    )

    # Create boundary using factory method
    boundary_data = region.get("boundary", {})
    boundary = Boundary.from_json(boundary_data, area_position)

    # Build grid window for storage coordinates
    field_grid_window = build_query_grid_window_140760320(
        nebula_field.position_x,
        nebula_field.position_y,
        nebula_field.position_z,
    )

    # Build falloff profiles
    falloff_data = region.get("falloff", {})
    falloff = _build_falloff_profiles(falloff_data)

    # Build resources
    resources_data = region.get("resources", [])
    resources = _build_gas_resources(resources_data)

    # Load save samples for comparison (filtered by region)
    save_sample = _load_save_sample_for_ware(sector_id, ware_id, region_id)
    save_total = _load_save_total_for_ware(sector_id, ware_id, region_id)

    # Universe yield density (default to 1.0 for now)
    universe_yield_density = {row["ware"]: 1.0 for row in resources_data}

    return ReplayContext(
        sector_id=sector_id,
        region_id=region_id,
        ware_id=ware_id,
        field=nebula_field,
        boundary=boundary,
        field_grid_window=field_grid_window,
        falloff=falloff,
        resources=resources,
        save_sample=save_sample,
        save_total=save_total,
        universe_yield_density=universe_yield_density,
    )