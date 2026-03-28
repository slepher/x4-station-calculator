"""Shared Sector 模块 - X4 Map Data Processor."""

from processor.shared.sector.parser import (
    load_mapdefaults,
    resolve_sector_macro_from_region_connection,
    resolve_sector_macro_from_region_ref,
    zone_connection_path_to_zone_macro,
)

__all__ = [
    "load_mapdefaults",
    "resolve_sector_macro_from_region_connection",
    "resolve_sector_macro_from_region_ref",
    "zone_connection_path_to_zone_macro",
]