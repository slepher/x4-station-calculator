"""Config loading and version resolution reused across standalone run.py scripts."""

import argparse
import json
import os
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List

_project_root = str(Path(__file__).resolve().parents[3])


def get_config_path() -> Path:
    return Path(_project_root) / "x4-station-calculator.config.json"


def load_config() -> Dict[str, Any]:
    with open(str(get_config_path()), "r", encoding="utf-8") as f:
        return json.load(f)


def get_target_versions(config: Dict[str, Any], args) -> List[Dict[str, Any]]:
    versions: list = config.get("versions", [])
    if getattr(args, "all_versions", False):
        return list(versions)

    def _matches_flavor(v: Dict[str, Any]) -> bool:
        if getattr(args, "beta", False):
            return bool(v.get("beta", False)) is True
        if getattr(args, "stable", False):
            return bool(v.get("beta", False)) is False
        return True

    version_arg = getattr(args, "version", None)
    if version_arg:
        candidates = [
            v for v in versions
            if str(v.get("version")) == str(version_arg) and _matches_flavor(v)
        ]
        if not candidates:
            raise ValueError(f"未找到版本 {version_arg}")
        return candidates

    current_version = config.get("current_version")
    current_beta = bool(config.get("beta", False))
    if getattr(args, "beta", False):
        current_beta = True
    elif getattr(args, "stable", False):
        current_beta = False
    for v in versions:
        if str(v.get("version")) == str(current_version) and bool(v.get("beta", False)) == current_beta:
            return [v]
    return []


def merge_config(base: Dict[str, Any], version_item: Dict[str, Any]) -> Dict[str, Any]:
    m = deepcopy(base)
    m.update(version_item)
    return m


def add_version_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--version", type=str, help="Target version, e.g. 8.0 or 9.0")
    parser.add_argument("--beta", action="store_true", help="Use beta flavour")
    parser.add_argument("--stable", action="store_true", help="Use stable flavour")
    parser.add_argument("--all-versions", action="store_true", help="Process all versions")
