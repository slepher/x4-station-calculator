"""SphereBoundary class - reverse engineered from X4.exe.

C++ class: U::SphereBoundary
Base class: U::Boundary
VTable (offset=0): 0x142c09b40
COL(offset=0): 0x142dc1ca8
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


# Constants from C++
PI_4_3 = 4.0 / 3.0 * math.pi  # 4/3 * π for volume


@dataclass
class SphereBoundary(Boundary):
    """SphereBoundary - a sphere defined by center and radius.

    C++ class: U::SphereBoundary
    VTable (offset=0): 0x142c09b40
    COL(offset=0): 0x142dc1ca8

    Memory layout (offsets from this pointer):
        +0x00: vptr
        +0x10: center.x (float)
        +0x14: center.y (float)
        +0x18: center.z (float)
        +0x30: radius (float)

    VTable slots (vfptr = 0x142c09b40):
        +0x10 -> 0x14011b510: check_intersection
        +0x60 -> 0x14009d970: has_lateral_falloff (return 1)
        +0x68 -> 0x14093d1a0: get_nearest_radial_distance
        +0x70 -> 0x14093d1d0: get_radial_interval
        +0x78 -> 0x14093d250: get_volume
    """

    # Center position
    center_x: float = 0.0
    center_y: float = 0.0
    center_z: float = 0.0

    # Radius
    radius: float = 0.0

    # ========================================================================
    # Properties
    # ========================================================================

    @property
    def center(self) -> Tuple[float, float, float]:
        """Sphere center point."""
        return (self.center_x, self.center_y, self.center_z)

    # ========================================================================
    # vtable+0x10 -> 0x14011b510: Sphere intersection test
    # ========================================================================

    def check_intersection_0x10_14011b510(
        self,
        pos: Tuple[float, float, float],
        bounding_radius: float,
    ) -> bool:
        """Check if sphere intersects with this sphere.

        Corresponds to vtable+0x10, function 0x14011b510.

        Formula:
            d = distance(pos, center)
            return d < (radius + bounding_radius)

        Args:
            pos: Query sphere center position
            bounding_radius: Query sphere radius

        Returns:
            True if spheres intersect
        """
        d = vec3_length(vec3_sub(pos, self.center))
        return d < (self.radius + bounding_radius)

    # ========================================================================
    # vtable+0x58 -> 0x140582cd0: Lateral interval (fixed [0, 1])
    # ========================================================================

    def get_lateral_interval_0x58_140582cd0(
        self,
        query: Tuple[float, float, float],
        query_radius: float,
    ) -> Tuple[float, float]:
        """Get lateral interval - always [0, 1] for sphere.

        Corresponds to vtable+0x58, function 0x140582cd0.

        Args:
            query: Query point (unused for sphere)
            query_radius: Query radius (unused for sphere)

        Returns:
            (0.0, 1.0) - sphere has no lateral direction
        """
        return (0.0, 1.0)

    # ========================================================================
    # vtable+0x68 -> 0x14093d1a0: External distance
    # ========================================================================

    def get_nearest_radial_distance_0x68_14093d1a0(
        self,
        query: Tuple[float, float, float],
    ) -> float:
        """Get distance from query to sphere surface (0 if inside).

        Corresponds to vtable+0x68, function 0x14093d1a0.

        Formula:
            d = distance(query, center)
            return max(d - radius, 0)

        Args:
            query: Query point

        Returns:
            Distance to sphere surface (0 if inside)
        """
        d = vec3_length(vec3_sub(query, self.center))
        return max(d - self.radius, 0.0)

    # ========================================================================
    # vtable+0x70 -> 0x14093d1d0: Radial interval
    # ========================================================================

    def get_radial_interval_0x70_14093d1d0(
        self,
        query: Tuple[float, float, float],
        query_radius: float,
    ) -> Tuple[float, float]:
        """Compute radial interval normalized to [0, 1].

        Corresponds to vtable+0x70, function 0x14093d1d0.

        Formula:
            d = distance(query, center)
            lower = max((d - query_radius) / R, 0)
            upper = min((d + query_radius) / R, 1)

        Args:
            query: Query point (center of 64k area)
            query_radius: Query radius (55425.625 for gas)

        Returns:
            (lower, upper) interval normalized to [0, 1]
        """
        if self.radius <= 1e-10:
            return (0.0, 1.0)

        d = vec3_length(vec3_sub(query, self.center))

        lower = clamp((d - query_radius) / self.radius, 0.0, 1.0)
        upper = clamp((d + query_radius) / self.radius, 0.0, 1.0)

        return (lower, upper)

    # ========================================================================
    # vtable+0x78 -> 0x14093d250: Volume
    # ========================================================================

    def get_volume_0x78_14093d250(self) -> float:
        """Compute sphere volume.

        Corresponds to vtable+0x78, function 0x14093d250.

        Formula:
            Volume = 4/3 * π * R³

        Returns:
            Sphere volume
        """
        return PI_4_3 * self.radius * self.radius * self.radius

    # ========================================================================
    # Unified interface
    # ========================================================================

    def check_intersection_0x10(self, pos: Tuple[float, float, float], bounding_radius: float) -> bool:
        """Unified interface at vtable+0x10."""
        return self.check_intersection_0x10_14011b510(pos, bounding_radius)

    def get_lateral_interval_0x58(self, query: Tuple[float, float, float], query_radius: float) -> Tuple[float, float]:
        """Unified interface at vtable+0x58."""
        return self.get_lateral_interval_0x58_140582cd0(query, query_radius)

    def get_radial_interval_0x70(self, query: Tuple[float, float, float], query_radius: float) -> Tuple[float, float]:
        """Unified interface at vtable+0x70."""
        return self.get_radial_interval_0x70_14093d1d0(query, query_radius)

    def get_volume_0x78(self) -> float:
        """Unified interface at vtable+0x78."""
        return self.get_volume_0x78_14093d250()

    # ========================================================================
    # Factory methods
    # ========================================================================

    @classmethod
    def from_center_radius(
        cls,
        center: Tuple[float, float, float],
        radius: float,
    ) -> 'SphereBoundary':
        """Create SphereBoundary from center and radius.

        Args:
            center: (x, y, z) center point
            radius: Sphere radius

        Returns:
            SphereBoundary instance
        """
        return cls(
            center_x=center[0],
            center_y=center[1],
            center_z=center[2],
            radius=radius,
        )