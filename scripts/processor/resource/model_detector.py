"""资源模型检测 - X4 Map Data Processor."""

import re
from typing import Optional


def detect_map_resource_model(version_str: str) -> str:
    """
    根据游戏版本号判定资源模型类型。

    规则：主版本号 < 9 使用 'regions' 模型，>= 9 使用 'resourceareas' 模型。

    Args:
        version_str: 版本字符串，如 "8.0", "9.0", "9.0-Empire-beta"

    Returns:
        "regions" 或 "resourceareas"
    """
    if not version_str:
        return "regions"
    # 提取主版本号
    match = re.match(r"(\d+)", str(version_str))
    if not match:
        return "regions"
    major_version = int(match.group(1))
    return "resourceareas" if major_version >= 9 else "regions"
