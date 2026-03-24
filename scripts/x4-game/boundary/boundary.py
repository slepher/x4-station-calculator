"""Boundary base class - reverse engineered from X4.exe.

C++ class: U::Boundary
Type descriptor: 0x1432f2a70

This is the abstract base class for all boundary shapes.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Tuple, Union, TYPE_CHECKING

if TYPE_CHECKING:
    from .spline_tube_boundary import SplineTubeBoundary
    from .cylinder_boundary import CylinderBoundary
    from .sphere_boundary import SphereBoundary
    from .box_boundary import BoxBoundary


@dataclass
class Boundary(ABC):
    """Boundary - abstract base class for all boundary shapes.

    C++ class: U::Boundary
    Type descriptor: 0x1432f2a70

    Common vtable slots (polymorphic across all subclasses):
        +0x10 -> check_intersection: Sphere/box intersection test
        +0x58 -> get_lateral_interval: Lateral (axial) interval [0, 1]
        +0x70 -> get_radial_interval: Radial interval [0, 1]
        +0x78 -> get_volume: Shape volume

    Subclasses:
        CylinderBoundary: Cylinder defined by two endpoints and radius
        SphereBoundary: Sphere defined by center and radius
        BoxBoundary: Axis-aligned box defined by center and half-extents
        SplineTubeBoundary: Tube along a spline path
    """

    # ========================================================================
    # Factory method
    # ========================================================================

    @classmethod
    def from_json(
        cls,
        boundary_data: dict,
        position: Tuple[float, float, float],
    ) -> Union['SplineTubeBoundary', 'CylinderBoundary', 'SphereBoundary', 'BoxBoundary', None]:
        """Create a boundary object from JSON data.

        Args:
            boundary_data: The 'boundary' dict from regions.json
            position: (x, y, z) position for the boundary

        Returns:
            Boundary instance or None if unsupported
        """
        boundary_class = boundary_data.get('class', '')
        boundary_size = boundary_data.get('size', {})

        if boundary_class == 'splinetube':
            return cls._create_spline_tube(boundary_data, boundary_size, position)
        elif boundary_class == 'cylinder':
            return cls._create_cylinder(boundary_size, position)
        elif boundary_class == 'sphere':
            return cls._create_sphere(boundary_size, position)
        elif boundary_class == 'box':
            return cls._create_box(boundary_size, position)

        return None

    @classmethod
    def _create_spline_tube(cls, boundary_data: dict, boundary_size: dict, position: Tuple[float, float, float]):
        """Create SplineTubeBoundary from JSON data."""
        from .spline_tube_boundary import SplineTubeBoundary, SplineControlPoint

        pos_x, pos_y, pos_z = position
        radius = float(boundary_size.get('r', 0.0))
        spline_data = boundary_data.get('spline', [])

        spline = [
            SplineControlPoint(
                x=float(sp.get('x', 0)),
                y=float(sp.get('y', 0)),
                z=float(sp.get('z', 0)),
                tx=float(sp.get('tx', 0)),
                ty=float(sp.get('ty', 0)),
                tz=float(sp.get('tz', 0)),
                inlength=float(sp.get('inlength', 0)),
                outlength=float(sp.get('outlength', 0)),
            )
            for sp in spline_data
        ]

        boundary = SplineTubeBoundary(
            position_x=pos_x,
            position_y=pos_y,
            position_z=pos_z,
            radius=radius,
            spline=spline,
        )
        boundary.transform_spline_to_world()
        return boundary

    @classmethod
    def _create_cylinder(cls, boundary_size: dict, position: Tuple[float, float, float]):
        """Create CylinderBoundary from JSON data.

        JSON format: {"r": radius, "linear": half_height}
        """
        from .cylinder_boundary import CylinderBoundary

        pos_x, pos_y, pos_z = position
        radius = float(boundary_size.get('r', 0.0))
        half_height = float(boundary_size.get('linear', 0.0))

        # Cylinder centered at position, extending half_height in both Y directions
        p0 = (pos_x, pos_y - half_height, pos_z)
        p1 = (pos_x, pos_y + half_height, pos_z)

        return CylinderBoundary.from_endpoints(p0, p1, radius)

    @classmethod
    def _create_sphere(cls, boundary_size: dict, position: Tuple[float, float, float]):
        """Create SphereBoundary from JSON data.

        JSON format: {"r": radius}
        """
        from .sphere_boundary import SphereBoundary

        radius = float(boundary_size.get('r', 0.0))
        return SphereBoundary.from_center_radius(position, radius)

    @classmethod
    def _create_box(cls, boundary_size: dict, position: Tuple[float, float, float]):
        """Create BoxBoundary from JSON data.

        JSON format: {"x": half_x, "y": half_y, "z": half_z}
        Note: JSON contains half-sizes (extents).
        """
        from .box_boundary import BoxBoundary

        half_x = float(boundary_size.get('x', 0.0))
        half_y = float(boundary_size.get('y', 0.0))
        half_z = float(boundary_size.get('z', 0.0))

        return BoxBoundary.from_center_extents(position, (half_x, half_y, half_z))

    # ========================================================================
    # vtable+0x10 -> check_intersection
    # ========================================================================

    @abstractmethod
    def check_intersection_0x10(
        self,
        pos: Tuple[float, float, float],
        bounding_radius: float,
    ) -> bool:
        """Check if sphere intersects with this boundary.

        Args:
            pos: Query sphere center position
            bounding_radius: Query sphere radius

        Returns:
            True if spheres intersect
        """
        pass

    # ========================================================================
    # vtable+0x48 -> is_enabled
    # ========================================================================

    def is_enabled_0x48(self) -> bool:
        """Check if boundary is enabled.

        Corresponds to vtable+0x48.
        Default implementation returns True.

        Returns:
            True if boundary is active/enabled
        """
        return True

    # ========================================================================
    # vtable+0x60 -> has_radial
    # ========================================================================

    def has_radial_0x60(self) -> bool:
        """Check if boundary has radial dimension.

        Corresponds to vtable+0x60.
        Most boundaries have radial dimension, so default is True.
        Override for boundaries without radial (e.g., infinite extent).

        Returns:
            True if boundary has radial dimension
        """
        return True

    # ========================================================================
    # vtable+0x58 -> get_lateral_interval
    # ========================================================================

    def get_lateral_interval_0x58(
        self,
        query: Tuple[float, float, float],
        query_radius: float,
    ) -> Tuple[float, float]:
        """Get lateral interval normalized to [0, 1].

        Default implementation returns (0, 1) for shapes without
        lateral direction (sphere, box).

        Args:
            query: Query point (center of 64k area)
            query_radius: Query radius (55425.625 for gas)

        Returns:
            (lower, upper) interval normalized to [0, 1]
        """
        return (0.0, 1.0)

    # ========================================================================
    # vtable+0x70 -> get_radial_interval
    # ========================================================================

    @abstractmethod
    def get_radial_interval_0x70(
        self,
        query: Tuple[float, float, float],
        query_radius: float,
    ) -> Tuple[float, float]:
        """Get radial interval normalized to [0, 1].

        Args:
            query: Query point (center of 64k area)
            query_radius: Query radius (55425.625 for gas)

        Returns:
            (lower, upper) interval normalized to [0, 1]
        """
        pass

    # ========================================================================
    # vtable+0x78 -> get_volume
    # ========================================================================

    @abstractmethod
    def get_volume_0x78(self) -> float:
        """Get shape volume.

        Returns:
            Volume in cubic units
        """
        pass