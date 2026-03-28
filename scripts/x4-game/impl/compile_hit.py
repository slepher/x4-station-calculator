"""Region runtime preparation for dispatch-driven solid replay."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from impl.region_add import compile_region_runtime_14075AE40 as _compile_region_runtime


@dataclass
class CompiledRegionRuntime:
    """Compiled runtime region state used by later hit/contribution stages."""

    sector_id: str
    region_id: str
    region: Any
    field_list: list[object]


def compile_region_runtime_14075AE40(
    sector_id: str,
    region_id: str,
    region_data: dict | None = None,
    area_data: dict | None = None,
) -> CompiledRegionRuntime:
    """Compile the region runtime object without dispatch-side orchestration."""

    result = _compile_region_runtime(
        sector_id=sector_id,
        region_id=region_id,
        region_data=region_data,
        area_data=area_data,
    )
    if not result.success or result.region is None:
        raise ValueError(result.error_message or f"Failed to compile region runtime: {region_id}")

    return CompiledRegionRuntime(
        sector_id=sector_id,
        region_id=region_id,
        region=result.region,
        field_list=result.field_list,
    )


def prepare_region_runtime_for_dispatch(
    sector_id: str,
    region_id: str,
    region_data: dict | None = None,
    area_data: dict | None = None,
) -> CompiledRegionRuntime:
    """Prepare only the compiled region runtime used by FUN_14075bd20 replay."""

    return compile_region_runtime_14075AE40(
        sector_id=sector_id,
        region_id=region_id,
        region_data=region_data,
        area_data=area_data,
    )
