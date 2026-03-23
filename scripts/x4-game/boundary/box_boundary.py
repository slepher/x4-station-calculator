"""BoxBoundary class - reverse engineered from X4.exe.

C++ class: U::BoxBoundary
Base class: U::Boundary
VTable (offset=8): 0x142c09be0
COL(offset=8): 0x142dc1c80
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Tuple

from .boundary import Boundary


def vec3_sub(a: Tuple[float, float, float], b: Tuple[float, float, float]) -> Tuple[float, float, float]:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vec3_dot(a: Tuple[float, float, float], b: Tuple[float, float, float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def vec3_length(a: Tuple[float, float, float]) -> float:
    return math.sqrt(vec3_dot(a, a))


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


@dataclass
class BoxBoundary(Boundary):
    """BoxBoundary - an axis-aligned box defined by center and half-extents.

    C++ class: U::BoxBoundary
    VTable (offset=8): 0x142c09be0
    COL(offset=8): 0x142dc1c80

    Memory layout (offsets from this pointer):
        +0x00: vptr
        +0x10: center.x (float)
        +0x14: center.y (float)
        +0x18: center.z (float)
        +0x20: extent_x (float) - half-size along local X
        +0x24: extent_y (float) - half-size along local Y
        +0x28: extent_z (float) - half-size along local Z

    Note: extents are HALF-SIZES, not full sizes.

    VTable slots (vfptr = 0x142c09be0):
        +0x08 -> 0x14093c5a0: contains_point (with extent check)
        +0x10 -> 0x14093c620: check_intersection (with extent + query_radius)
    """

    # Center position
    center_x: float = 0.0
    center_y: float = 0.0
    center_z: float = 0.0

    # Half-extents (not full sizes!)
    extent_x: float = 0.0
    extent_y: float = 0.0
    extent_z: float = 0.0

    # ========================================================================
    # Properties
    # ========================================================================

    @property
    def center(self) -> Tuple[float, float, float]:
        """Box center point."""
        return (self.center_x, self.center_y, self.center_z)

    @property
    def extents(self) -> Tuple[float, float, float]:
        """Half-extents (half-sizes)."""
        return (self.extent_x, self.extent_y, self.extent_z)

    # ========================================================================
    # vtable+0x08 -> 0x14093c5a0: Point containment test
    # ========================================================================

    def contains_point_0x08_14093c5a0(self, pos: Tuple[float, float, float]) -> bool:
        """Check if point is inside the box.

        Corresponds to vtable+0x08, function 0x14093c5a0.

        Formula:
            local = pos - center
            return |local_x| <= extent_x
                and |local_y| <= extent_y
                and |local_z| <= extent_z

        Args:
            pos: Point to test

        Returns:
            True if point is inside the box
        """
        local = vec3_sub(pos, self.center)
        return (
            abs(local[0]) <= self.extent_x
            and abs(local[1]) <= self.extent_y
            and abs(local[2]) <= self.extent_z
        )

    # ========================================================================
    # vtable+0x10 -> 0x14093c620: Box intersection test
    # ========================================================================

    def check_intersection_0x10_14093c620(
        self,
        pos: Tuple[float, float, float],
        bounding_radius: float,
    ) -> bool:
        """Check if sphere intersects with box (Minkowski sum).

        Corresponds to vtable+0x10, function 0x14093c620.

        Formula:
            local = pos - center
            return |local_x| <= extent_x + bounding_radius
                and |local_y| <= extent_y + bounding_radius
                and |local_z| <= extent_z + bounding_radius

        Args:
            pos: Query sphere center position
            bounding_radius: Query sphere radius

        Returns:
            True if sphere intersects box
        """
        local = vec3_sub(pos, self.center)
        return (
            abs(local[0]) <= self.extent_x + bounding_radius
            and abs(local[1]) <= self.extent_y + bounding_radius
            and abs(local[2]) <= self.extent_z + bounding_radius
        )

    # ========================================================================
    # Radial interval (for gas field calculation)
    # ========================================================================

    def get_radial_interval_0x70(
        self,
        query: Tuple[float, float, float],
        query_radius: float,
    ) -> Tuple[float, float]:
        """Compute radial interval for box boundary.

        The radial interval is based on the normalized scalar metric:
            normalized = max(|local_x|/extent_x, |local_y|/extent_y, |local_z|/extent_z)

        Args:
            query: Query point (center of 64k area)
            query_radius: Query radius (55425.625 for gas)

        Returns:
            (lower, upper) interval normalized to [0, 1]
        """
        if self.extent_x <= 1e-10 or self.extent_y <= 1e-10 or self.extent_z <= 1e-10:
            return (0.0, 1.0)

        local = vec3_sub(query, self.center)

        # Normalized scalar at query center
        norm_x = abs(local[0]) / self.extent_x
        norm_y = abs(local[1]) / self.extent_y
        norm_z = abs(local[2]) / self.extent_z

        # Compute interval considering query_radius
        # Each axis contributes independently
        lower_x = max((abs(local[0]) - query_radius) / self.extent_x, 0.0)
        lower_y = max((abs(local[1]) - query_radius) / self.extent_y, 0.0)
        lower_z = max((abs(local[2]) - query_radius) / self.extent_z, 0.0)

        upper_x = min((abs(local[0]) + query_radius) / self.extent_x, 1.0)
        upper_y = min((abs(local[1]) + query_radius) / self.extent_y, 1.0)
        upper_z = min((abs(local[2]) + query_radius) / self.extent_z, 1.0)

        # Combined interval: take maximum of lower bounds
        lower = max(lower_x, lower_y, lower_z)
        upper = min(max(upper_x, upper_y, upper_z), 1.0)

        return (lower, upper)

    # ========================================================================
    # Volume
    # ========================================================================

    def get_volume_0x78(self) -> float:
        """Compute box volume.

        Formula:
            Volume = (2 * extent_x) * (2 * extent_y) * (2 * extent_z)
                   = 8 * extent_x * extent_y * extent_z

        Returns:
            Box volume
        """
        return 8.0 * self.extent_x * self.extent_y * self.extent_z

    # ========================================================================
    # Unified interface
    # ========================================================================

    def check_intersection_0x10(self, pos: Tuple[float, float, float], bounding_radius: float) -> bool:
        """Unified interface at vtable+0x10."""
        return self.check_intersection_0x10_14093c620(pos, bounding_radius)

    def get_lateral_interval_0x58(self, query: Tuple[float, float, float], query_radius: float) -> Tuple[float, float]:
        """Unified interface at vtable+0x58 - box has no lateral direction."""
        return (0.0, 1.0)

    # ========================================================================
    # Factory methods
    # ========================================================================

    @classmethod
    def from_center_extents(
        cls,
        center: Tuple[float, float, float],
        extents: Tuple[float, float, float],
    ) -> 'BoxBoundary':
        """Create BoxBoundary from center and half-extents.

        Args:
            center: (x, y, z) center point
            extents: (half_x, half_y, half_z) half-sizes

        Returns:
            BoxBoundary instance
        """
        return cls(
            center_x=center[0],
            center_y=center[1],
            center_z=center[2],
            extent_x=extents[0],
            extent_y=extents[1],
            extent_z=extents[2],
        )

    @classmethod
    def from_min_max(
        cls,
        min_point: Tuple[float, float, float],
        max_point: Tuple[float, float, float],
    ) -> 'BoxBoundary':
        """Create BoxBoundary from min and max corners.

        Args:
            min_point: (min_x, min_y, min_z) minimum corner
            max_point: (max_x, max_y, max_z) maximum corner

        Returns:
            BoxBoundary instance
        """
        center = (
            (min_point[0] + max_point[0]) / 2.0,
            (min_point[1] + max_point[1]) / 2.0,
            (min_point[2] + max_point[2]) / 2.0,
        )
        extents = (
            (max_point[0] - min_point[0]) / 2.0,
            (max_point[1] - min_point[1]) / 2.0,
            (max_point[2] - min_point[2]) / 2.0,
        )
        return cls.from_center_extents(center, extents)