"""资源处理模块."""

from processor.resource.model_detector import detect_map_resource_model
from processor.resource.modern_processor import (
    migrate_resourcearea_definitions,
    migrate_sector_resourceareas,
    build_sector_resource_summaries_from_resourceareas,
    build_resourceareas_json_payload,
)
from processor.resource.legacy_processor import (
    migrate_regionyields,
    summarize_region_resources,
    summarize_region_resources_simplified,
)

__all__ = [
    "detect_map_resource_model",
    "migrate_resourcearea_definitions",
    "migrate_sector_resourceareas",
    "build_sector_resource_summaries_from_resourceareas",
    "build_resourceareas_json_payload",
    "migrate_regionyields",
    "summarize_region_resources",
    "summarize_region_resources_simplified",
]
