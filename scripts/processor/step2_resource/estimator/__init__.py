"""Estimator module - 资源估算算法.

提供固体和气体资源的体积估算和理论储量计算功能。
"""

from processor.step2_resource.estimator.solid_estimator import (
    SOLID_XZ_LIMIT,
    SOLID_Y_LIMIT,
    SPLINETUBE_LENGTH_LIMIT,
    calculate_solid_volume_truncated,
    estimate_solid_yield,
    calculate_solid_volume_km3,
)

from processor.step2_resource.estimator.gas_estimator import (
    GAS_XZ_LIMIT,
    GAS_Y_LIMIT,
    GAS_BLOCK_SIZE,
    GAS_WARES,
    is_gas_ware,
    calculate_gas_volume_km3,
    estimate_gas_yield,
    calculate_gas_block_count,
)


__all__ = [
    # Solid constants
    "SOLID_XZ_LIMIT",
    "SOLID_Y_LIMIT",
    "SPLINETUBE_LENGTH_LIMIT",
    # Solid functions
    "calculate_solid_volume_truncated",
    "estimate_solid_yield",
    "calculate_solid_volume_km3",
    # Gas constants
    "GAS_XZ_LIMIT",
    "GAS_Y_LIMIT",
    "GAS_BLOCK_SIZE",
    "GAS_WARES",
    # Gas functions
    "is_gas_ware",
    "calculate_gas_volume_km3",
    "estimate_gas_yield",
    "calculate_gas_block_count",
]