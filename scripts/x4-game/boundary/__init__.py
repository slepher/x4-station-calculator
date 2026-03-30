"""Boundary classes for X4 gas field computation.

This module contains reverse-engineered boundary classes from X4.exe.

Naming convention:
    Implementation: method_name_offset_address
        Example: get_axial_interval_0x58_14093dd10
        - method: get_axial_interval
        - vtable offset: +0x58
        - function address: 0x14093dd10

    External interface: method_name_offset
        Example: get_lateral_interval_0x58
        - Unified interface for BoundaryList to call
        - Same offset across all Boundary subclasses (polymorphism)

Classes:
    Boundary: Abstract base class for all boundary shapes
    SplineTubeBoundary: Tube along a spline path, generates CylinderBoundary list
    CylinderBoundary: Cylinder defined by two endpoints and radius
    SphereBoundary: Sphere defined by center and radius
    BoxBoundary: Axis-aligned box defined by center and half-extents
    BoundaryList: Container for multiple boundary objects
"""

from .boundary import Boundary
from .spline_tube_boundary import SplineTubeBoundary, SplineControlPoint
from .cylinder_boundary import CylinderBoundary
from .sphere_boundary import SphereBoundary
from .box_boundary import BoxBoundary
from .boundary_list import BoundaryList

__all__ = [
    'Boundary',
    'SplineTubeBoundary',
    'SplineControlPoint',
    'CylinderBoundary',
    'SphereBoundary',
    'BoxBoundary',
    'BoundaryList',
]