"""Step 1 Map 处理模块 - X4 Map Data Processor.

提供地图数据生成功能，处理 XML 文件并生成基础地图 JSON 数据。
"""

from processor.step1_map.service import process_map_for_version

__all__ = ["process_map_for_version"]