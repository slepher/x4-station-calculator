"""Noise computation for solid fields - reverse engineered from X4.exe.

C++ functions:
- FUN_1414F4840: compute_local_noise (main entry)
- FUN_1414F5870: compute_noise_cdf (CDF transformation)
- Small cell path: uses noise table for cell_count <= 16
"""

from __future__ import annotations

import math
import struct
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .solid_context import SolidFieldState


# C++ constants from FUN_1414F5870
DAT_142d7ff50 = 0.5  # Center point
DAT_142d80b2c = -1.0  # Negative sign
DAT_142d800e8 = 1.0  # Positive sign / unity
_DAT_142d80658 = 0.550000011920929  # Linear coefficient
_DAT_142d80670 = 0.5554999709129333  # Quadratic coefficient
_DAT_142d7feac = 0.2783930003643036  # Linear term
_DAT_142d7fc20 = 0.0009720000089146197  # Cross term
_DAT_142d807d0 = 0.5773502588272095  # 1/sqrt(3)
_DAT_142d80808 = 0.5833333730697632  # Quartic coefficient


def _float_to_bits(f: float) -> int:
    """Convert float to its bit representation."""
    return struct.unpack('<I', struct.pack('<f', f))[0]


def _bits_to_float(b: int) -> float:
    """Convert bit representation to float."""
    return struct.unpack('<f', struct.pack('<I', b & 0xFFFFFFFF))[0]


def _float_abs_bits(f: float) -> int:
    """Get absolute value of float via bit manipulation."""
    return _float_to_bits(f) & 0x7FFFFFFF


def compute_noise_cdf_1414F5870(param_1: float) -> float:
    """Compute noise CDF transformation.

    Corresponds to FUN_1414F5870.

    This is a CDF transformation applied to noise values.
    The function maps [0, 1] to approximately [0, 1] with S-curve shape.

    Args:
        param_1: Input noise value (0-1 range)

    Returns:
        Transformed noise value (approximately 0-1 range)
    """
    # Center the input around 0.5
    param_1 = param_1 - DAT_142d7ff50  # -0.5 to 0.5

    # Determine sign factor
    if param_1 < 0.0:
        fVar3 = DAT_142d80b2c  # -1.0
    else:
        fVar3 = DAT_142d800e8  # 1.0

    # Get absolute value via bit manipulation
    abs_param = _bits_to_float(_float_abs_bits(param_1))

    # Compute polynomial terms
    fVar2 = abs_param * _DAT_142d80658  # Linear term

    abs_sq = abs_param * abs_param
    fVar1 = abs_sq * _DAT_142d80670  # Quadratic term

    # Full polynomial: fVar1 = quad * quad_coeff + linear * linear_term + cross + quartic + 1
    cross_term = fVar2 * _DAT_142d7fc20 * abs_sq * _DAT_142d807d0
    quartic_term = abs_sq * abs_sq * _DAT_142d80808

    fVar1 = fVar1 + fVar2 * _DAT_142d7feac + cross_term + quartic_term + DAT_142d800e8

    # Final computation
    fVar1 = fVar1 * fVar1
    result = ((fVar3 - fVar3 / (fVar1 * fVar1)) + DAT_142d800e8) * DAT_142d7ff50

    return result


def compute_cell_count(tile_x: int, tile_y: int, tile_z: int, seed: str) -> int:
    """Compute cell count for a tile position.

    This determines the noise sampling density based on position and seed.

    Args:
        tile_x, tile_y, tile_z: Tile world coordinates
        seed: Seed string from field definition

    Returns:
        Number of noise cells to sample
    """
    # Simple hash-based cell count
    # The actual C++ implementation is more complex
    hash_val = hash(seed) if seed else 0
    combined = (tile_x * 73856093) ^ (tile_y * 19349663) ^ (tile_z * 83492791) ^ hash_val
    return abs(combined) % 32 + 1


def generate_noise_table(seed: str, min_val: float, max_val: float, count: int = 256) -> list[float]:
    """Generate noise lookup table.

    For small-cell path when cell_count <= 16.

    Args:
        seed: Seed string from field definition
        min_val: Minimum noise value
        max_val: Maximum noise value
        count: Table size (default 256)

    Returns:
        List of noise values
    """
    import random

    # Use seed to initialize RNG
    rng = random.Random(seed if seed else 0)

    # Generate uniform random values and apply CDF
    table = []
    for _ in range(count):
        raw = rng.random()
        cdf = compute_noise_cdf_1414F5870(raw)
        # Scale to [min_val, max_val]
        value = min_val + (max_val - min_val) * cdf
        table.append(value)

    return table


def compute_local_noise_fast_path_1414F4840(field: SolidFieldState) -> float:
    """Compute local noise using fast path.

    Corresponds to FUN_1414F4840 fast path (cell_count > 16).

    Uses F(maxnoise) - F(minnoise) approximation.

    Args:
        field: SolidFieldState with noise parameters

    Returns:
        Local noise value
    """
    # Fast path: use CDF of max - CDF of min
    cdf_max = compute_noise_cdf_1414F5870(field.maxnoisevalue)
    cdf_min = compute_noise_cdf_1414F5870(field.minnoisevalue)
    return cdf_max - cdf_min


def compute_local_noise_1414F4840(field: SolidFieldState, tile_x: int, tile_y: int, tile_z: int) -> float:
    """Compute local noise for a tile.

    Corresponds to FUN_1414F4840.

    Two paths:
    - Fast path (cell_count > 16): F(max) - F(min)
    - Small cell path (cell_count <= 16): Average from noise table

    Args:
        field: SolidFieldState with noise parameters
        tile_x, tile_y, tile_z: Tile world coordinates

    Returns:
        Local noise value
    """
    cell_count = compute_cell_count(tile_x, tile_y, tile_z, field.seed)

    if cell_count > 16:
        # Fast path
        return compute_local_noise_fast_path_1414F4840(field)

    # Small cell path: use noise table
    if field._noise_table is None:
        field._noise_table = generate_noise_table(
            field.seed,
            field.minnoisevalue,
            field.maxnoisevalue
        )

    # Sample from noise table based on position
    table = field._noise_table
    index = abs((tile_x * 73856093) ^ (tile_y * 19349663) ^ (tile_z * 83492791)) % len(table)

    # Average multiple samples for small cells
    total = 0.0
    for i in range(cell_count):
        idx = (index + i) % len(table)
        total += table[idx]

    return total / cell_count


def compute_noise_window_weight_140E85B80(field: SolidFieldState) -> float:
    """Compute noise window weight.

    Corresponds to FUN_140E85B80.

    This combines multiplier A, multiplier B, and local noise.

    Args:
        field: SolidFieldState with all parameters set

    Returns:
        Noise window weight value
    """
    from .solid_context import compute_multiplier_a_140E80300, compute_multiplier_b_140E803E0

    return (
        compute_multiplier_a_140E80300(field)
        * compute_multiplier_b_140E803E0(field)
        * compute_local_noise_fast_path_1414F4840(field)
    )