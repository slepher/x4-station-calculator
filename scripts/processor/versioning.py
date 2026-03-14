import json
from copy import deepcopy
from pathlib import Path
from typing import Dict, List


CONFIG_FILE = "x4-station-calculator.config.json"


def load_version_config(config_file: str = CONFIG_FILE) -> Dict[str, object]:
    path = Path(config_file)
    if not path.exists():
        raise FileNotFoundError(f"Missing config file: {config_file}")
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def get_target_versions(v_config: Dict[str, object], args) -> List[Dict[str, object]]:
    versions = v_config.get("versions", [])
    if not versions:
        raise ValueError("❌ 错误: 配置中缺少 versions 数组。")

    if getattr(args, "all_versions", False):
        return list(versions)

    def matches_flavor(version_item: Dict[str, object]) -> bool:
        if getattr(args, "beta", False):
            return bool(version_item.get("beta", False)) is True
        if getattr(args, "stable", False):
            return bool(version_item.get("beta", False)) is False
        return True

    version_arg = getattr(args, "version", None)
    if version_arg:
        candidates = [v for v in versions if str(v.get("version")) == str(version_arg) and matches_flavor(v)]
        if not candidates:
            raise ValueError(f"❌ 错误: 未找到版本 {version_arg}（请检查 beta/stable 选项）。")
        if len(candidates) > 1:
            raise ValueError(f"❌ 错误: 版本 {version_arg} 同时存在多个候选，请显式指定 --beta 或 --stable。")
        return candidates

    current_version = v_config.get("current_version")
    current_beta = bool(v_config.get("beta", False))
    if getattr(args, "beta", False):
        current_beta = True
    elif getattr(args, "stable", False):
        current_beta = False

    for version_item in versions:
        if str(version_item.get("version")) == str(current_version) and bool(version_item.get("beta", False)) == current_beta:
            return [version_item]

    beta_str = "beta" if current_beta else "stable"
    raise ValueError(f"❌ 错误: 未找到版本 {current_version} ({beta_str}) 的配置。")


def merge_version_config(v_config: Dict[str, object], version_item: Dict[str, object]) -> Dict[str, object]:
    merged = deepcopy(v_config)
    merged.update(version_item)
    return merged
