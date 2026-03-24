"""Solid field contribution computation - reverse engineered from X4.exe.

C++ entry: FUN_14073fee0

This is the main entry point for computing solid field (AsteroidField/DebrisField)
contributions. It iterates over all fields, filters by ware, and computes weights.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from .field_type_detection import FieldType
from .resource_object_field import ResourceObjectFieldState
from .weight_computation import fun_14073f750, f32

if TYPE_CHECKING:
    from .replay_context import ReplayContext


# C++ constants
DAT_142d7fbe8 = 0.0000001  # Epsilon for weight comparison
DAT_142d843a0 = 0x7fffffff  # Float max mask


@dataclass
class FieldContribution:
    """Contribution from a single field."""
    field_state: ResourceObjectFieldState
    weight: float
    is_valid: bool


def fun_14073fee0(
    ctx: ReplayContext,
    world_pos: tuple[float, float, float],
    ware_id: str,
) -> float:
    """Compute solid field contribution for a tile position.

    Corresponds to C++ FUN_14073fee0.

    C++ logic:
    1. Get field list from param_1 (ctx.field_states)
    2. For each field:
       a. Check if field is valid for ware (vtable+0x1d0)
       b. If valid, compute noise (FUN_1414f4840)
       c. Call FUN_14073f750 to get profile weight
       d. Get field multiplier (vtable+0x200)
       e. Accumulate: weight += profile_weight * multiplier * noise
    3. Return average: weight / valid_field_count

    Args:
        ctx: Replay context with field states
        world_pos: World position (x, y, z)
        ware_id: Ware ID to filter by

    Returns:
        Average contribution weight
    """
    # Import field states - in C++ these come from param_1->field_list
    # For now, we need to get them from somewhere
    if not hasattr(ctx, 'field_states') or not ctx.field_states:
        return 0.0

    field_states = ctx.field_states
    total_weight = 0.0
    valid_count = 0

    for field_state in field_states:
        # Check if field is valid for this ware (C++: vtable+0x1d0)
        # Field must produce the requested ware
        if field_state.ware_key != ware_id:
            continue

        # Check if enabled (C++: field->is_enabled_0x48)
        if hasattr(field_state, 'is_enabled') and not field_state.is_enabled:
            continue

        # Compute noise (C++: FUN_1414f4840)
        # This uses the noise table and seed
        noise = _compute_field_noise(field_state, world_pos)

        # Compute profile weight (C++: FUN_14073f750)
        profile_weight = fun_14073f750(ctx, world_pos)

        if profile_weight <= DAT_142d7fbe8:
            continue

        # Get field multiplier (C++: vtable+0x200)
        # This is typically the yield value or resource percentage
        multiplier = _get_field_multiplier(field_state)

        # Accumulate weight
        total_weight += profile_weight * multiplier * noise
        valid_count += 1

    # Return average (C++: if uVar7 != 0, fVar14 = fVar14 / uVar7)
    if valid_count == 0:
        return 0.0

    return total_weight / valid_count


def _compute_field_noise(
    field_state: ResourceObjectFieldState,
    world_pos: tuple[float, float, float],
) -> float:
    """Compute noise value for a field at position.

    Corresponds to C++ FUN_1414f4840.

    C++ logic:
    - Uses noise table at field + 0x10d0
    - Scales by noisescale
    - Clamps to [minnoisevalue, maxnoisevalue]

    Args:
        field_state: Field state with noise params
        world_pos: World position

    Returns:
        Noise value (0.0 to 1.0)
    """
    # Simplified noise computation
    # In C++, this uses a 1024-entry noise table
    # For now, return a default value
    import random

    # Use seed to get deterministic noise
    if field_state.seed:
        random.seed(f"{field_state.seed}_{world_pos}")
        noise = random.random()
    else:
        noise = 1.0

    # Clamp to [minnoisevalue, maxnoisevalue]
    noise = max(field_state.minnoisevalue, min(noise, field_state.maxnoisevalue))

    return noise


def _get_field_multiplier(field_state: ResourceObjectFieldState) -> float:
    """Get field multiplier for contribution.

    Corresponds to C++ vtable+0x200.

    Returns:
        Multiplier value (typically yield or resource percentage)
    """
    # In C++, this is the field's yield value or resource percentage
    # For debris fields, it's the yield from object groups
    if hasattr(field_state, 'resourcepercentage'):
        return field_state.resourcepercentage * field_state.yield_value

    return field_state.yield_value
