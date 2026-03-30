"""Region resource field initialization - C++ FUN_14073e110 replication.

This module implements the region resource field initialization logic
reverse-engineered from X4.exe FUN_14073e110.

Function purpose (based on Ghidra analysis):
- Read region configuration
- Create resource field objects via factory chain (FUN_140e82530)
- Bind yield and long range scan data to fields
- Normalize weights across fields of the same ware

Note: This does NOT include tile processing/query logic, which is handled
by separate functions (FUN_14073f750, etc.).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from field.resource_object_field import ResourceObjectField


# Paths
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "src" / "assets" / "x4_game_data" / "8.0-Diplomacy" / "data"


@dataclass
class ResourceInfo:
    """Resource information from region data."""
    ware: str
    resourcedensity: float
    delay: float = 0.0
    gatherfactor: float = 1.0
    yield_name: str = ""


@dataclass
class FieldInfo:
    """Field information extracted from region data."""
    tag: str
    groupref: str = ""
    densityfactor: float = 1.0
    noisescale: float = 5000.0
    seed: str = ""
    minnoisevalue: float = 0.0
    maxnoisevalue: float = 1.0


@dataclass
class RegionResourceFieldResult:
    """Result for region resource field initialization.

    Corresponds to the state produced by C++ FUN_14073e110.
    """
    sector_id: str
    region_id: str
    field_list: list[ResourceObjectField] = field(default_factory=list)
    ware_list: list[str] = field(default_factory=list)
    # Per-field normalized values after weight distribution
    per_field_values: dict[str, float] = field(default_factory=dict)


def region_resource_field_14073E110(
    sector_id: str,
    region_data: dict,
    area_data: dict,
    fields: list[FieldInfo],
    resources: list[ResourceInfo],
    ware_filter: str | None = None,
) -> RegionResourceFieldResult:
    """Initialize region resource fields - C++ FUN_14073e110 replication.

    This function implements the core logic of FUN_14073e110:
    1. Read region configuration from JSON
    2. Create resource field objects via factory chain (FUN_140e82530)
    3. Inject payload (resourcedensity, yield) via vfunc(+0x20)
    4. Compute field weights via vfunc(+0xa0)
    5. Normalize weights and write back via vfunc(+0x28)
    6. Bind long range scan data to fields

    Note: Tile processing is NOT performed here - it is handled by
    separate functions (FUN_14073f750, etc.) that operate on the
    initialized fields returned by this function.

    Args:
        sector_id: Sector identifier
        region_data: Region JSON data from regions.json
        area_data: Area JSON data from resourceareas.json
        fields: List of FieldInfo (asteroid/debris field definitions)
        resources: List of ResourceInfo (ware/yield definitions)
        ware_filter: Optional ware to filter (for single-ware computation)

    Returns:
        RegionResourceFieldResult containing initialized field objects
        with normalized per-field values bound.
    """
    from field import ResourceObjectField
    from field.field_factory import iterate_resources_140e82530, FIELD_TYPE_ASTEROID, FIELD_TYPE_DEBRIS

    region_id = region_data["id"]
    position = area_data.get("position", {})
    boundary = region_data.get("boundary", {})
    size = boundary.get("size", {})

    pos_x = float(position.get("x", 0))
    pos_y = float(position.get("y", 0))
    pos_z = float(position.get("z", 0))
    radius = float(size.get("r", 0))
    linear = float(size.get("linear", 0))
    region_density = float(region_data.get("density", 1.0))

    # Filter solid fields (C++: case 0x08, 0x13 in FUN_140e81620)
    solid_field_infos = [f for f in fields if f.tag in {"asteroid", "debris"}]

    if not solid_field_infos:
        return RegionResourceFieldResult(
            sector_id=sector_id,
            region_id=region_id,
            field_list=[],
            ware_list=[],
            per_field_values={},
        )

    # ========================================================================
    # Step 1: Build field list via FUN_140e82530 factory chain
    # C++: FUN_140e82530 iterates resources and creates field objects
    # ========================================================================
    field_list: list[ResourceObjectField] = []

    for f in solid_field_infos:
        xml_data = {
            "name": f.groupref or "default",
            "groupref": f.groupref,
            "densityfactor": f.densityfactor,
            "noisescale": f.noisescale,
            "seed": f.seed,
            "minnoisevalue": f.minnoisevalue,
            "maxnoisevalue": f.maxnoisevalue,
            "resourcepercentage": 100.0,
            "region_density": region_density,
            "type": FIELD_TYPE_ASTEROID if f.tag == "asteroid" else FIELD_TYPE_DEBRIS,
            "resources": [],
        }

        # FUN_140e82530: Factory chain creates ResourceObjectField instances
        created = iterate_resources_140e82530(
            field_list, xml_data,
            pos_x, pos_y, pos_z, radius,
            scale_factor=1.0, linear=linear
        )

        if ware_filter:
            created = [f for f in created if f.ware_key == ware_filter]

    if not field_list:
        return RegionResourceFieldResult(
            sector_id=sector_id,
            region_id=region_id,
            field_list=[],
            ware_list=[],
            per_field_values={},
        )

    unique_wares = list(set(f.ware_key for f in field_list))

    # ========================================================================
    # Step 2: Inject payload via vfunc(+0x20)
    # C++: receive_region_payload_0x20 binds region data to each field
    # ========================================================================
    for field_obj in field_list:
        matching_res = [r for r in resources if r.ware == field_obj.ware_key]
        resourcedensity = matching_res[0].resourcedensity if matching_res else 1.0
        yield_name = matching_res[0].yield_name if matching_res else ""
        region_yield = matching_res[0].resourcedensity if matching_res else 0.0

        # vfunc(+0x20): receive_region_payload
        field_obj.receive_region_payload_0x20(
            payload_resourcedensity=resourcedensity,
            payload_yield_name=yield_name,
            payload_region_yield=region_yield
        )

    # ========================================================================
    # Step 3: Accumulate weights via vfunc(+0xa0)
    # C++: compute_field_weight_0xa0 calculates contribution weight
    # ========================================================================
    sum_weights_by_ware: dict[str, float] = {}
    for field_obj in field_list:
        ware = field_obj.ware_key
        # vfunc(+0xa0): use_resourcepercentage=False for region allocation
        field_weight = field_obj.compute_field_weight_0xa0(use_resourcepercentage=False)
        if ware not in sum_weights_by_ware:
            sum_weights_by_ware[ware] = 0.0
        sum_weights_by_ware[ware] += field_weight

    # ========================================================================
    # Step 4: Compute per-field value (normalization)
    # C++: fVar39 = (fVar43 * *(float *)(uVar21 + 8)) / fVar39
    # ========================================================================
    per_field_value_by_ware: dict[str, float] = {}
    for ware in unique_wares:
        matching_res = [r for r in resources if r.ware == ware]
        resourcedensity = matching_res[0].resourcedensity if matching_res else 1.0
        sum_weights = sum_weights_by_ware.get(ware, 0.0)
        per_field_value = resourcedensity / sum_weights if sum_weights > 0 else 0.0
        per_field_value_by_ware[ware] = per_field_value

    # ========================================================================
    # Step 5: Writeback via vfunc(+0x28)
    # C++: writeback_per_field_value_0x28 stores normalized value
    # ========================================================================
    for field_obj in field_list:
        ware = field_obj.ware_key
        per_field_value = per_field_value_by_ware.get(ware, 0.0)
        # vfunc(+0x28): writeback_per_field_value
        field_obj.writeback_per_field_value_0x28(per_field_value)

    # ========================================================================
    # Step 6: Bind long range scan data (optional in C++, via vfunc calls)
    # C++: Additional vfunc calls bind scan data to each field
    # ========================================================================
    # Note: Long range scan data binding is implicit in Python
    # through the ResourceObjectField initialization

    return RegionResourceFieldResult(
        sector_id=sector_id,
        region_id=region_id,
        field_list=field_list,
        ware_list=unique_wares,
        per_field_values=per_field_value_by_ware,
    )
