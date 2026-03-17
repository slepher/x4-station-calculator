#!/usr/bin/env python3
"""调试 nebula 的 boundary 值在 calc_data 中是什么"""
import sys
sys.path.insert(0, 'scripts')
from pathlib import Path
from x4_data_map_processor import (
    migrate_region_definitions,
    build_yield_level_map,
    build_yield_density_map,
    build_yield_info_map,
    parse_xml,
)

# 模拟 processor 的逻辑
DEFAULT_REGION_DEFINITIONS_XML = "/home/slepher/.local/share/Steam/steamapps/common/X4 Foundations/42862520/libraries/region_definitions_final.xml"
DEFAULT_REGIONOBJECTGROUPS_XML = "/home/slepher/.local/share/Steam/steamapps/common/X4 Foundations/42862520/libraries/regionobjectgroups_final.xml"
DEFAULT_REGIONYIELDS_XML = "/home/slepher/.local/share/Steam/steamapps/common/X4 Foundations/42862520/libraries/regionyields_final.xml"

yield_level_map = build_yield_level_map(Path(DEFAULT_REGIONYIELDS_XML))
yield_density_map = build_yield_density_map(Path(DEFAULT_REGIONYIELDS_XML))
yield_info_map = build_yield_info_map(Path(DEFAULT_REGIONYIELDS_XML))

templates, calc_data = migrate_region_definitions(
    Path(DEFAULT_REGION_DEFINITIONS_XML),
    Path(DEFAULT_REGIONOBJECTGROUPS_XML),
    yield_level_map,
    yield_density_map,
    yield_info_map,
)

# 找到 nebula
for region_id, region_item in calc_data.items():
    if '703' in region_id and 'nebula' in region_id:
        print(f"=== {region_id} (calc_data) ===")
        print(f"keys: {list(region_item.keys())}")
        print(f"boundary: {region_item.get('boundary')}")
        print(f"volume_km3: {region_item.get('volume_km3')}")
        print(f"asteroids: {region_item.get('asteroids', [])[:2]}")
        print(f"debris: {region_item.get('debris', [])[:2]}")
        print(f"nebulae: {region_item.get('nebulae', [])[:2]}")
