"""Sector 处理模块."""

from processor.sector.parser import (
    load_mapdefaults,
    resolve_sector_macro_from_region_connection,
    resolve_sector_macro_from_region_ref,
    zone_connection_path_to_zone_macro,
)
from processor.sector.template import (
    centered_local_positions,
    template_positions_ratio,
    best_slot_assignment,
    choose_sector_template,
    sector_radius_ratio,
)
from processor.sector.resource_summary import summarize_sector_resources

__all__ = [
    "load_mapdefaults",
    "resolve_sector_macro_from_region_connection",
    "resolve_sector_macro_from_region_ref",
    "zone_connection_path_to_zone_macro",
    "centered_local_positions",
    "template_positions_ratio",
    "best_slot_assignment",
    "choose_sector_template",
    "sector_radius_ratio",
    "summarize_sector_resources",
]
