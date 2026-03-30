"""Legacy solid tile-current aggregation for pre-enumerated candidate nodes.

This module is kept only for historical comparison after the runtime chain was
re-established around FUN_14075bd20 -> FUN_14075c250.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from field.resource_object_field import ResourceObjectField


def compute_region_clamp_weight_140e84c30(region: object) -> float:
    """Compute the shared clamp factor used by solid-field tile contribution."""

    boundary_list = getattr(region, "boundary_list", None)
    if boundary_list is None or not hasattr(boundary_list, "get_volume_0x78"):
        return 0.0

    volume = float(boundary_list.get_volume_0x78())
    return min(volume * 9.999999717180685e-10, 262144.0)


def compiled_resource_object_fields(field_list: list[object]) -> list["ResourceObjectField"]:
    """Select solid resource fields from the compiled region field list."""

    return [
        field
        for field in field_list
        if hasattr(field, "ware_key_0x1110")
        and hasattr(field, "resourcepercentage_0x1190")
        and hasattr(field, "get_multiplier_b_0x98")
        and hasattr(field, "get_multiplier_a_0x1b8")
    ]


def aggregate_tile_currents_for_nodes_14075C250(
    compiled: object,
    candidate_nodes: list[dict],
    ware_filter: str | None = None,
) -> tuple[dict[str, int], list[dict]]:
    """Aggregate tile currents from already enumerated candidate nodes."""

    all_tiles: dict[tuple[int, int, int], dict[str, int]] = {}
    all_tile_traces: dict[tuple[int, int, int], list[object]] = {}

    solid_fields = compiled_resource_object_fields(compiled.field_list)
    clamp_weight = compute_region_clamp_weight_140e84c30(compiled.region)

    for tile_node in candidate_nodes:
        world_x = tile_node.get("x", 0)
        world_y = tile_node.get("y", 0)
        world_z = tile_node.get("z", 0)
        query_weight = float(tile_node.get("occupancy", 1.0))
        storage_coord = (int(world_x), int(world_y), int(world_z))

        for field_obj in solid_fields:
            ware = field_obj.ware_key_0x1110
            if not ware:
                continue
            if ware_filter and ware != ware_filter:
                continue

            trace = field_obj.compute_tile_contribution_140e84c30(
                (float(world_x), float(world_y), float(world_z)),
                query_weight=query_weight,
                clamp_weight=clamp_weight,
            )
            if trace.contribution <= 0:
                continue

            if storage_coord not in all_tiles:
                all_tiles[storage_coord] = {}
            all_tile_traces.setdefault(storage_coord, []).append(trace)
            all_tiles[storage_coord][ware] = all_tiles[storage_coord].get(ware, 0) + trace.contribution

    totals: dict[str, int] = {}
    for values in all_tiles.values():
        for ware, amount in values.items():
            totals[ware] = totals.get(ware, 0) + amount

    per_tile = [
        {
            "coord": coord,
            "tile_values": values,
            "field_traces": all_tile_traces.get(coord, []),
        }
        for coord, values in sorted(all_tiles.items())
    ]
    return totals, per_tile
