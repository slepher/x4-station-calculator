"""BoundaryList class - reverse engineered from X4.exe.

C++ class: U::BoundaryList
VTable: 0x142bde608 (placeholder, needs verification)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .spline_tube_boundary import SplineTubeBoundary
    from .cylinder_boundary import CylinderBoundary


@dataclass
class BoundaryList:
    """BoundaryList - container for multiple boundary objects.

    C++ class: U::BoundaryList

    Memory layout (offsets from this pointer):
        +0x00: vptr
        +0x08: boundaries array start (pointer)
        +0x10: boundaries array end (pointer)
        +0x18: boundaries capacity end (pointer)

    Used by:
        - SplineTubeBoundary at offset +0x70
        - Stores CylinderBoundary objects generated from spline samples
    """

    # Member data
    boundaries: list[Any] = field(default_factory=list)

    # ========================================================================
    # vtable+0x10: Sphere intersection test (delegates to all boundaries)
    # ========================================================================

    def check_intersection_0x10(
        self,
        pos: tuple[float, float, float],
        bounding_radius: float
    ) -> bool:
        """Check if sphere intersects with any boundary in the list.

        Delegates to each boundary's check_intersection_0x10 method.
        Returns True if ANY boundary intersects.

        Args:
            pos: Sphere center position
            bounding_radius: Sphere radius

        Returns:
            True if sphere intersects any boundary
        """
        return any(b.check_intersection_0x10(pos, bounding_radius) for b in self.boundaries)

    # ========================================================================
    # vtable+0x58: Lateral interval (delegates to boundaries)
    # ========================================================================

    def get_lateral_interval_0x58(
        self,
        pos: tuple[float, float, float],
        query_radius: float
    ) -> tuple[float, float] | None:
        """Get lateral interval from boundaries.

        Delegates to each boundary's get_lateral_interval_0x58 method.
        Returns first non-None result.

        Args:
            pos: Query position
            query_radius: Query radius

        Returns:
            (lower, upper) interval or None
        """
        for boundary in self.boundaries:
            result = boundary.get_lateral_interval_0x58(pos, query_radius)
            if result is not None:
                return result
        return None

    # ========================================================================
    # vtable+0x70: Radial interval (delegates to boundaries)
    # ========================================================================

    def get_radial_interval_0x70(
        self,
        pos: tuple[float, float, float],
        query_radius: float
    ) -> tuple[float, float]:
        """Get radial interval from boundaries.

        Delegates to each boundary's get_radial_interval_0x70 method.
        Returns first valid result.

        Args:
            pos: Query position
            query_radius: Query radius

        Returns:
            (lower, upper) interval
        """
        for boundary in self.boundaries:
            return boundary.get_radial_interval_0x70(pos, query_radius)
        return (0.0, 1.0)

    # ========================================================================
    # vtable+0x78: Volume (sum of all boundaries)
    # ========================================================================

    def get_volume_0x78(self) -> float:
        """Get total volume from all boundaries.

        Corresponds to function 0x14093c2c0 which iterates and sums.

        Returns:
            Sum of all boundary volumes
        """
        return sum(b.get_volume_0x78() for b in self.boundaries)