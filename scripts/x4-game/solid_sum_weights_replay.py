#!/usr/bin/env python3
"""Minimal solid-field replay for the `sum_weights` branch in X4 runtime.

This script intentionally mirrors only the parts that contribute to:

  - `FUN_14073e110` field matching / weight accumulation
  - `FUN_140e84940` groupref writeback
  - `FUN_140e83f80` region-yield payload writeback
  - `FUN_140e80300` / `FUN_140e803e0`
  - `FUN_140e85b80`
  - `FUN_140e84990`

It omits geometry, `64k area`, falloff, local noise sampling, clamp, and all
non-contributing object plumbing on purpose.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


EPSILON = 0.0
ONE = 1.0
DEFAULT_RESOURCEPERCENTAGE_FLOOR = 0.0


@dataclass
class RegionObjectGroup:
    resource: str
    yield_value: float
    yieldvariation: float


@dataclass
class RegionYieldPayload:
    ware: str
    yield_name: str
    resourcedensity: float
    replenishtime: float = 0.0
    gatherspeedfactor: float = 1.0


@dataclass
class FieldState:
    name: str
    ware_key: str = ""
    yield_value: float = 0.0
    resourcepercentage: float = 1.0
    yieldvariation: float = 0.0
    densityfactor: float = 1.0
    region_density: float = 1.0
    field_0x1150_density_base_scaled: float = 0.0
    ref_type_id: int = 0x77
    ref_target_class_id: int = 0x77
    class_density_by_id: dict[int, float] = field(default_factory=dict)
    universe_yield_density_by_ware: dict[str, float] = field(default_factory=dict)
    universe_object_yield_density_by_ware: dict[str, float] = field(default_factory=dict)
    noise_window_width: float = 1.0
    yield_name: str = ""
    replenishtime: float = 0.0
    gatherspeedfactor: float = 1.0
    clamp_factor: float = 1.0
    falloff_weight: float = 1.0
    local_noise_value: float = 1.0

    @property
    def class_multiplier(self) -> float:
        """Convenience view of `FUN_140e80300` tree lookup."""
        class_id = resolve_class_id_from_ref_140e80300(self)
        return lookup_class_density_multiplier_140e80300(self, class_id)


def initialize_field_from_region_definition_140e842e0(
    field: FieldState,
    *,
    densityfactor: float,
    region_density: float,
    resourcepercentage: float = 1.0,
    yieldvariation: float = 0.0,
) -> None:
    """Minimal structure-preserving replay of the confirmed `FUN_140e842e0` writes.

    Retained writes:
      - `+0x1150 = densityfactor * region.density * 0.01`
      - `+0x1190 = resourcepercentage` (runtime default `100 * 0.01 = 1.0`)
      - `+0x1194 = yieldvariation`
    """
    field.densityfactor = densityfactor
    field.region_density = region_density
    field.field_0x1150_density_base_scaled = densityfactor * region_density * 0.01
    field.resourcepercentage = resourcepercentage
    field.yieldvariation = yieldvariation


def resolve_class_id_from_ref_140e80300(field: FieldState) -> int:
    """Mirror the class-id resolution branch inside `FUN_140e80300`."""
    if field.ref_type_id == 0x77:
        return field.ref_target_class_id
    return field.ref_type_id


def lookup_class_density_multiplier_140e80300(field: FieldState, class_id: int) -> float:
    """Mirror the `DAT_143df3f88 + 0xf0/+0xf8` tree lookup semantically."""
    value = field.class_density_by_id.get(class_id, 1.0)
    return value if value > 0.0 else 0.0


def apply_groupref_to_field_140e84940(field: FieldState, group: RegionObjectGroup) -> None:
    """`field->vfunc(+0x18, group)`."""
    if not field.ware_key:
        field.ware_key = group.resource
    if field.yield_value <= EPSILON:
        field.yield_value = group.yield_value
        field.yieldvariation = group.yieldvariation
        field.resourcepercentage = 0.0


def apply_region_yield_payload_to_field_140e83f80(
    field: FieldState,
    payload: RegionYieldPayload,
) -> None:
    """`field->vfunc(+0x20, payload)`."""
    if field.yield_value <= EPSILON:
        field.yield_value = payload.resourcedensity
    if field.replenishtime <= 0.0:
        field.replenishtime = payload.replenishtime
    if abs(field.gatherspeedfactor - ONE) <= EPSILON:
        field.gatherspeedfactor = payload.gatherspeedfactor
    field.yield_name = payload.yield_name


def compute_multiplier_a_140e80300(field: FieldState) -> float:
    """Structure-preserving replay of `FUN_140e80300`."""
    class_id = resolve_class_id_from_ref_140e80300(field)
    class_density_multiplier = lookup_class_density_multiplier_140e80300(field, class_id)
    return field.field_0x1150_density_base_scaled * class_density_multiplier


def lookup_universe_yield_density_by_ware_140e803e0(field: FieldState) -> float:
    """Mirror the `DAT_143df3f88 + 0x130` lookup semantically."""
    return field.universe_yield_density_by_ware.get(field.ware_key, 1.0)


def lookup_universe_object_yield_density_by_ware_140e803e0(field: FieldState) -> float:
    """Mirror the `DAT_143df3f88 + 0x170` lookup semantically."""
    return field.universe_object_yield_density_by_ware.get(field.ware_key, 1.0)


def compute_multiplier_b_140e803e0(field: FieldState) -> float:
    """Structure-preserving replay of `FUN_140e803e0`."""
    universe_yield_density = lookup_universe_yield_density_by_ware_140e803e0(field)
    universe_object_yield_density = (
        lookup_universe_object_yield_density_by_ware_140e803e0(field)
    )
    return universe_yield_density * field.yield_value * universe_object_yield_density


def compute_field_weight_140e85b80(
    field: FieldState,
    include_resourcepercentage: bool,
) -> float:
    """Region distribution weight function."""
    gate = field.resourcepercentage if include_resourcepercentage else 1.0
    return (
        compute_multiplier_a_140e80300(field)
        * compute_multiplier_b_140e803e0(field)
        * gate
        * field.noise_window_width
    )


def apply_per_field_value_writeback_140e84990(
    field: FieldState,
    per_field_value: float,
    resourcepercentage_floor: float = DEFAULT_RESOURCEPERCENTAGE_FLOOR,
) -> None:
    """Structure-preserving replay of `field->vfunc(+0x28, per_field_value)`.

    Confirmed retained branches:
      1. `resourcepercentage = per_field_value`
      2. if `per_field_value > 1`: clamp resourcepercentage to `1`, multiply yield
      3. else if runtime floor is non-negative and `per_field_value < floor`:
         rescale yield by `per_field_value / floor`, then clamp resourcepercentage to `floor`
    """
    field.resourcepercentage = per_field_value

    if per_field_value > ONE:
        field.resourcepercentage = ONE
        field.yield_value = per_field_value * field.yield_value
        return

    runtime_resourcepercentage_floor = resourcepercentage_floor
    if (
        runtime_resourcepercentage_floor >= 0.0
        and per_field_value < runtime_resourcepercentage_floor
        and runtime_resourcepercentage_floor > 0.0
    ):
        field.yield_value = (per_field_value / resourcepercentage_floor) * field.yield_value
        field.resourcepercentage = runtime_resourcepercentage_floor


def compute_area_contribution_140e84c30(field: FieldState) -> int:
    """Minimal replay of the confirmed main multiply chain in `FUN_140e84c30`.

    Omitted on purpose:
      - matrix / bbox transforms
      - runtime geometry query construction
      - exact clamp helper internals
      - exact falloff helper internals
      - exact local noise sampling internals

    Required retained inputs:
      - clamp_factor
      - falloff_weight
      - local_noise_value
      - resourcepercentage
      - MultiplierA
      - MultiplierB
    """
    if not field.ware_key:
        return 0

    base = (
        field.clamp_factor
        * field.falloff_weight
        * field.local_noise_value
        * field.resourcepercentage
        * compute_multiplier_a_140e80300(field)
    )
    area_value = compute_multiplier_b_140e803e0(field) * base
    if area_value <= 0.0:
        return 0
    return int(area_value)


def compute_object_amount_140e85c10(
    field: FieldState,
    random_gate_value: Optional[float] = None,
    random_variation_value: Optional[float] = None,
) -> int:
    """Minimal replay of the confirmed main branch in `FUN_140e85c10`.

    Omitted on purpose:
      - runtime RNG implementation details
      - caller-dependent `param_2` shortcut branch

    Retained semantics:
      - `resourcepercentage` random gate
      - `MultiplierB(after writeback)` as object amount base
      - `yieldvariation` random range `[1 - v, 1 + v]`
      - final integer truncation with minimum `1`
    """
    gate_value = 0.0 if random_gate_value is None else random_gate_value
    if field.resourcepercentage <= gate_value:
        return 0

    amount = compute_multiplier_b_140e803e0(field)
    variation = field.yieldvariation
    if variation > 0.0:
        variation_value = 0.5 if random_variation_value is None else random_variation_value
        amount *= (1.0 - variation) + (2.0 * variation * variation_value)

    if amount <= 0.0:
        return 0
    if amount < 1.0:
        return 1
    return int(amount)


def replay_region_solid_sum_weights_14073e110(
    fields: list[FieldState],
    payload: RegionYieldPayload,
    resourcepercentage_floor: float = DEFAULT_RESOURCEPERCENTAGE_FLOOR,
) -> dict[str, object]:
    """Minimal replay of the solid `sum_weights` path.

    This keeps only the contribution-relevant branch:

      1. `vfunc(+0x20)` to inject region-yield payload
      2. `vfunc(+0xa0, 1)` to accumulate `sum_weights`
      3. `per_field_value = universeyielddensities * resourcedensity / sum_weights`
      4. `vfunc(+0x28, per_field_value)` writeback
    """
    matching_fields = [field for field in fields if field.ware_key == payload.ware]

    for field in matching_fields:
        apply_region_yield_payload_to_field_140e83f80(field, payload)

    weight_rows: list[dict[str, float | str]] = []
    sum_weights = 0.0
    for field in matching_fields:
        multiplier_a = compute_multiplier_a_140e80300(field)
        multiplier_b = compute_multiplier_b_140e803e0(field)
        field_weight = compute_field_weight_140e85b80(
            field,
            include_resourcepercentage=False,
        )
        sum_weights += field_weight
        weight_rows.append(
            {
                "field": field.name,
                "multiplier_a": multiplier_a,
                "multiplier_b": multiplier_b,
                "noise_window_width": field.noise_window_width,
                "field_weight": field_weight,
            }
        )

    if sum_weights <= EPSILON:
        per_field_value = 0.0
    else:
        # Mirrors the runtime branch currently confirmed in `FUN_14073e110`.
        universe_multiplier_for_ware = lookup_universe_yield_density_by_ware_140e803e0(
            matching_fields[0]
        )
        per_field_value = (
            universe_multiplier_for_ware * payload.resourcedensity
        ) / sum_weights

    before_writeback = [
        {
            "field": field.name,
            "ware_key": field.ware_key,
            "yield_before": field.yield_value,
            "resourcepercentage_before": field.resourcepercentage,
        }
        for field in matching_fields
    ]

    for field in matching_fields:
        apply_per_field_value_writeback_140e84990(
            field,
            per_field_value,
            resourcepercentage_floor,
        )

    after_writeback = [
        {
            "field": field.name,
            "yield_after": field.yield_value,
            "resourcepercentage_after": field.resourcepercentage,
            "yield_times_resourcepercentage": (
                field.yield_value * field.resourcepercentage
            ),
        }
        for field in matching_fields
    ]

    return {
        "payload": payload,
        "matching_field_count": len(matching_fields),
        "weights": weight_rows,
        "sum_weights": sum_weights,
        "per_field_value": per_field_value,
        "before_writeback": before_writeback,
        "after_writeback": after_writeback,
        "area_contribution_after_writeback": [
            {
                "field": field.name,
                "area_value": compute_area_contribution_140e84c30(field),
                "area_value_float": (
                    field.clamp_factor
                    * field.falloff_weight
                    * field.local_noise_value
                    * field.resourcepercentage
                    * compute_multiplier_a_140e80300(field)
                    * compute_multiplier_b_140e803e0(field)
                ),
            }
            for field in matching_fields
        ],
        "object_amount_after_writeback": [
            {
                "field": field.name,
                "object_amount_mid_variation": compute_object_amount_140e85c10(
                    field,
                    random_gate_value=0.0,
                    random_variation_value=0.5,
                ),
            }
            for field in matching_fields
        ],
    }


def build_p1_40km_ice_field_example() -> tuple[list[FieldState], RegionYieldPayload]:
    """Approximate the concrete solid field set discussed in analysis."""
    payload = RegionYieldPayload(
        ware="ice",
        yield_name="medium",
        resourcedensity=15.0,
        replenishtime=0.0,
        gatherspeedfactor=1.0,
    )

    groups = {
        "ice_l": RegionObjectGroup(resource="ice", yield_value=400.0, yieldvariation=0.5),
        "ice_m": RegionObjectGroup(resource="ice", yield_value=200.0, yieldvariation=0.5),
        "ice_s": RegionObjectGroup(resource="ice", yield_value=100.0, yieldvariation=0.5),
        "ice_xs": RegionObjectGroup(resource="ice", yield_value=10.0, yieldvariation=0.5),
    }

    fields = [
        FieldState(
            name="ice_l",
            ref_type_id=0x77,
            ref_target_class_id=0x77,
            class_density_by_id={0x77: 1.0},
            universe_yield_density_by_ware={"ice": 1.0},
            universe_object_yield_density_by_ware={"ice": 1.0},
            noise_window_width=0.25,
            clamp_factor=1.0,
            falloff_weight=1.0,
            local_noise_value=1.0,
        ),
        FieldState(
            name="ice_m",
            ref_type_id=0x77,
            ref_target_class_id=0x77,
            class_density_by_id={0x77: 1.0},
            universe_yield_density_by_ware={"ice": 1.0},
            universe_object_yield_density_by_ware={"ice": 1.0},
            noise_window_width=0.25,
            clamp_factor=1.0,
            falloff_weight=1.0,
            local_noise_value=1.0,
        ),
        FieldState(
            name="ice_s",
            ref_type_id=0x77,
            ref_target_class_id=0x77,
            class_density_by_id={0x77: 1.0},
            universe_yield_density_by_ware={"ice": 1.0},
            universe_object_yield_density_by_ware={"ice": 1.0},
            noise_window_width=0.25,
            clamp_factor=1.0,
            falloff_weight=1.0,
            local_noise_value=1.0,
        ),
        FieldState(
            name="ice_xs",
            ref_type_id=0x77,
            ref_target_class_id=0x77,
            class_density_by_id={0x77: 1.0},
            universe_yield_density_by_ware={"ice": 1.0},
            universe_object_yield_density_by_ware={"ice": 1.0},
            noise_window_width=0.25,
            clamp_factor=1.0,
            falloff_weight=1.0,
            local_noise_value=1.0,
        ),
    ]

    initialize_field_from_region_definition_140e842e0(
        fields[0],
        densityfactor=3.0,
        region_density=1.5,
    )
    initialize_field_from_region_definition_140e842e0(
        fields[1],
        densityfactor=18.0,
        region_density=1.5,
    )
    initialize_field_from_region_definition_140e842e0(
        fields[2],
        densityfactor=24.0,
        region_density=1.5,
    )
    initialize_field_from_region_definition_140e842e0(
        fields[3],
        densityfactor=30.0,
        region_density=1.5,
    )

    apply_groupref_to_field_140e84940(fields[0], groups["ice_l"])
    apply_groupref_to_field_140e84940(fields[1], groups["ice_m"])
    apply_groupref_to_field_140e84940(fields[2], groups["ice_s"])
    apply_groupref_to_field_140e84940(fields[3], groups["ice_xs"])

    return fields, payload


def main() -> None:
    fields, payload = build_p1_40km_ice_field_example()
    result = replay_region_solid_sum_weights_14073e110(fields, payload)

    print("payload:", payload)
    print(f"matching_field_count={result['matching_field_count']}")
    print(f"sum_weights={result['sum_weights']:.6f}")
    print(f"per_field_value={result['per_field_value']:.6f}")
    print()

    print("weights:")
    for row in result["weights"]:
        print(
            f"  {row['field']}: "
            f"A={row['multiplier_a']:.6f}, "
            f"B={row['multiplier_b']:.6f}, "
            f"noise_window={row['noise_window_width']:.6f}, "
            f"weight={row['field_weight']:.6f}"
        )
    print()

    print("before_writeback:")
    for row in result["before_writeback"]:
        print(
            f"  {row['field']}: "
            f"yield={row['yield_before']:.6f}, "
            f"resourcepercentage={row['resourcepercentage_before']:.6f}"
        )
    print()

    print("after_writeback:")
    for row in result["after_writeback"]:
        print(
            f"  {row['field']}: "
            f"yield={row['yield_after']:.6f}, "
            f"resourcepercentage={row['resourcepercentage_after']:.6f}, "
            f"product={row['yield_times_resourcepercentage']:.6f}"
        )
    print()

    print("area_contribution_after_writeback:")
    area_total = 0
    area_total_float = 0.0
    for row in result["area_contribution_after_writeback"]:
        area_total += row["area_value"]
        area_total_float += row["area_value_float"]
        print(
            f"  {row['field']}: "
            f"area_value={row['area_value']}, "
            f"area_value_float={row['area_value_float']:.6f}"
        )
    print(f"  total: area_value={area_total}, area_value_float={area_total_float:.6f}")
    print()

    print("object_amount_after_writeback:")
    for row in result["object_amount_after_writeback"]:
        print(
            f"  {row['field']}: "
            f"object_amount_mid_variation={row['object_amount_mid_variation']}"
        )


if __name__ == "__main__":
    main()
