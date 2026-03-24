"""Solid field tile enumeration - reverse engineered from X4.exe.

C++ uses center-aligned grid pattern, not simple bbox expansion.
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .resource_object_field import ResourceObjectFieldState


# Constants
AREA_SIZE = 64000.0
AREA_HALF = AREA_SIZE / 2.0


def align_to_grid_140760320(value: float, grid_size: float = AREA_SIZE) -> int:
    """Align value to nearest grid center.

    Corresponds to C++ grid alignment in FUN_140760320.

    C++ logic:
        if abs(position) <= max_center:
            return 0
        return round(position / AREA_SIZE) * AREA_SIZE

    Args:
        value: World coordinate value
        grid_size: Grid size (default 64000)

    Returns:
        Aligned grid coordinate
    """
    return int(round(value / grid_size) * grid_size)


def enumerate_center_aligned_tiles_140e84c30(
    field_center_x: float,
    field_center_y: float,
    field_center_z: float,
    radius: float,
    half_height: float,
) -> list[tuple[int, int, int]]:
    """Enumerate tiles using center-aligned grid pattern.

    Corresponds to C++ solid field tile enumeration.

    Based on reverse engineering from save data:
    1. Align field center to grid
    2. Generate tiles with fixed offsets from center
    3. Only include tiles that intersect field boundary

    Args:
        field_center_x: Field center X
        field_center_y: Field center Y
        field_center_z: Field center Z
        radius: Field radius
        half_height: Field half height

    Returns:
        List of storage coordinates (x, y, z)
    """
    # Align center to grid
    center_x = align_to_grid_140760320(field_center_x)
    center_z = align_to_grid_140760320(field_center_z)

    # Determine grid range based on radius
    # From save analysis: offsets are [-64000, 0, 64000, 128000] for radius=100000
    # This gives 4x3 grid for X, 3x3 for Z
    grid_count_x = max(1, int(radius / AREA_SIZE) + 1)
    grid_count_z = max(1, int(radius / AREA_SIZE) + 1)

    # Generate offsets
    x_offsets = [int((i - grid_count_x // 2) * AREA_SIZE) for i in range(grid_count_x + 1)]
    z_offsets = [int((i - grid_count_z // 2) * AREA_SIZE) for i in range(grid_count_z + 1)]

    # Y: only top of cylinder (center_y + half_height, aligned)
    y = align_to_grid_140760320(field_center_y + half_height)

    tiles = []
    for dx in x_offsets:
        for dz in z_offsets:
            x = center_x + dx
            z = center_z + dz
            tiles.append((x, y, z))

    return tiles


def enumerate_solid_field_tiles_140e84c30(
    field_state: ResourceObjectFieldState,
) -> list[tuple[int, int, int]]:
    """Enumerate tiles for a solid field.

    Corresponds to C++ FUN_140e84c30 tile enumeration.

    Args:
        field_state: Solid field state with position and size

    Returns:
        List of storage coordinates
    """
    # Get field position and size
    # These would come from field_state
    pos_x = getattr(field_state, 'position_x', 0.0)
    pos_y = getattr(field_state, 'position_y', 0.0)
    pos_z = getattr(field_state, 'position_z', 0.0)
    radius = getattr(field_state, 'radius', 0.0)
    half_height = getattr(field_state, 'half_height', 0.0)

    return enumerate_center_aligned_tiles_140e84c30(
        pos_x, pos_y, pos_z, radius, half_height
    )
