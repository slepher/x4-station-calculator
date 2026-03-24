"""Shared 模块 - X4 Map Data Processor.

提供共享的工具函数和输出管理器。
"""

from processor.shared.output_manager import (
    write_regionyields,
    write_factions,
    write_regions,
    write_map,
    write_resourceareas,
    write_regionyield_definitions,
)

__all__ = [
    "write_regionyields",
    "write_factions",
    "write_regions",
    "write_map",
    "write_resourceareas",
    "write_regionyield_definitions",
]