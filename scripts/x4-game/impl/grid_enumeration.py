"""Grid enumeration functions - reverse engineered from X4.exe.

FUN_140760320: Storage coordinate system and grid window management.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


# Constants from C++
AREA_SIZE = 64000.0
AREA_HALF = AREA_SIZE / 2.0

# Grid bounds (from DAT_* in C++)
SAVE_GRID_MIN_CENTER_XZ = -960000
SAVE_GRID_MAX_CENTER_XZ = 1024000
SAVE_GRID_MIN_CENTER_Y = -960000
SAVE_GRID_MAX_CENTER_Y = 1024000

# Query radius for FUN_14073f750
QUERY_RADIUS_14073F750 = 55425.625


@dataclass
class QueryGridWindow:
    """Storage coordinate origin for a query region.

    Corresponds to C++ grid window structure from FUN_140760320.
    """
    origin_x: int
    origin_y: int
    origin_z: int


def compute_axis_storage_origin_140760320(position: float, max_center: int) -> int:
    """Compute storage origin for a single axis.

    Corresponds to FUN_140760320 axis origin computation.

    C++ logic:
        if abs(position) <= max_center:
            return 0
        return floor(position / AREA_SIZE) * AREA_SIZE

    Args:
        position: World position on this axis
        max_center: Maximum center value for this axis

    Returns:
        Storage origin offset for this axis
    """
    if abs(position) <= max_center:
        return 0
    return int(math.floor(position / AREA_SIZE) * AREA_SIZE)


def build_query_grid_window_140760320(
    position_x: float,
    position_y: float,
    position_z: float,
) -> QueryGridWindow:
    """Build query grid window for a field position.

    Corresponds to FUN_140760320 - grid window construction.

    The grid window defines the storage coordinate system origin.
    Tiles are enumerated as offsets from this origin.

    Args:
        position_x: Field center X position
        position_y: Field center Y position
        position_z: Field center Z position

    Returns:
        QueryGridWindow with origin offsets for each axis
    """
    return QueryGridWindow(
        origin_x=compute_axis_storage_origin_140760320(position_x, SAVE_GRID_MAX_CENTER_XZ),
        origin_y=compute_axis_storage_origin_140760320(position_y, SAVE_GRID_MAX_CENTER_Y),
        origin_z=compute_axis_storage_origin_140760320(position_z, SAVE_GRID_MAX_CENTER_XZ),
    )


def storage_coord_to_world_coord_140760320(
    grid: QueryGridWindow,
    coord: tuple[int, int, int],
) -> tuple[int, int, int]:
    """Convert storage coordinate to world coordinate.

    Corresponds to FUN_140760320 coordinate conversion.

    Args:
        grid: Query grid window with origin offsets
        coord: Storage coordinate (x, y, z)

    Returns:
        World coordinate (x, y, z)
    """
    return (
        coord[0] + grid.origin_x,
        coord[1] + grid.origin_y,
        coord[2] + grid.origin_z,
    )


def world_coord_to_storage_coord_140760320(
    grid: QueryGridWindow,
    world_coord: tuple[int, int, int],
) -> tuple[int, int, int]:
    """Convert world coordinate to storage coordinate.

    Inverse of storage_coord_to_world_coord_140760320.

    Args:
        grid: Query grid window with origin offsets
        world_coord: World coordinate (x, y, z)

    Returns:
        Storage coordinate (x, y, z)
    """
    return (
        world_coord[0] - grid.origin_x,
        world_coord[1] - grid.origin_y,
        world_coord[2] - grid.origin_z,
    )


def compute_storage_axis_range_140760320(
    min_world: float,
    max_world: float,
    origin: int,
    min_center: int,
    max_center: int,
) -> tuple[int, int]:
    """Compute storage axis range for a bounding interval.

    Corresponds to FUN_140760320 range computation.

    C++ logic:
        start = max(floor((min_world - origin) / AREA_SIZE) * AREA_SIZE, min_center)
        end = min(floor((max_world - origin) / AREA_SIZE) * AREA_SIZE, max_center)

    Args:
        min_world: Minimum world coordinate
        max_world: Maximum world coordinate
        origin: Storage origin for this axis
        min_center: Minimum center value for this axis
        max_center: Maximum center value for this axis

    Returns:
        (start, end) storage coordinates
    """
    start = max(int(math.floor((min_world - origin) / AREA_SIZE) * int(AREA_SIZE)), min_center)
    end = min(int(math.floor((max_world - origin) / AREA_SIZE) * int(AREA_SIZE)), max_center)
    return start, end


# 15x15x3 网格范围（验收模式）
CUT_MODE_15X15X3_MIN_XZ = -480000
CUT_MODE_15X15X3_MAX_XZ = 480000
CUT_MODE_15X15X3_MIN_Y = -96000
CUT_MODE_15X15X3_MAX_Y = 96000


def enumerate_storage_coords_for_bbox(
    bbox_min: tuple[float, float, float],
    bbox_max: tuple[float, float, float],
    grid: QueryGridWindow,
    cut_mode: str = "full",
) -> list[tuple[int, int, int]]:
    """Enumerate all storage coordinates within a bounding box.

    Corresponds to the grid enumeration part of FUN_14075c250.

    Args:
        bbox_min: (x, y, z) minimum corner
        bbox_max: (x, y, z) maximum corner
        grid: Query grid window
        cut_mode: "full" for all tiles, "15x15x3" for limited range

    Returns:
        List of storage coordinates (x, y, z)
    """
    start_x, end_x = compute_storage_axis_range_140760320(
        bbox_min[0], bbox_max[0],
        grid.origin_x,
        SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )
    start_y, end_y = compute_storage_axis_range_140760320(
        bbox_min[1], bbox_max[1],
        grid.origin_y,
        SAVE_GRID_MIN_CENTER_Y, SAVE_GRID_MAX_CENTER_Y
    )
    start_z, end_z = compute_storage_axis_range_140760320(
        bbox_min[2], bbox_max[2],
        grid.origin_z,
        SAVE_GRID_MIN_CENTER_XZ, SAVE_GRID_MAX_CENTER_XZ
    )

    # Apply cut mode limits
    if cut_mode == "15x15x3":
        start_x = max(start_x, CUT_MODE_15X15X3_MIN_XZ)
        end_x = min(end_x, CUT_MODE_15X15X3_MAX_XZ)
        start_y = max(start_y, CUT_MODE_15X15X3_MIN_Y)
        end_y = min(end_y, CUT_MODE_15X15X3_MAX_Y)
        start_z = max(start_z, CUT_MODE_15X15X3_MIN_XZ)
        end_z = min(end_z, CUT_MODE_15X15X3_MAX_XZ)

    coords: list[tuple[int, int, int]] = []
    x = start_x
    while x <= end_x:
        y = start_y
        while y <= end_y:
            z = start_z
            while z <= end_z:
                coords.append((x, y, z))
                z += int(AREA_SIZE)
            y += int(AREA_SIZE)
        x += int(AREA_SIZE)

    return coords