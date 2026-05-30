"""Standalone script: parse research wares → generate research.json only (no i18n).

Usage:
    python scripts/x4-game/research/run.py                        # default version from config
    python scripts/x4-game/research/run.py --version 8.0          # specific version
    python scripts/x4-game/research/run.py --version 9.0 --beta   # specific flavour
    python scripts/x4-game/research/run.py --stable               # stable (non-beta) of current version
"""
import argparse
import json
import os
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List

_project_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_project_root))

import importlib

_mod_build = importlib.import_module("scripts.x4-game.research.build")
build_research_data = _mod_build.build_research_data

_CONFIG_FILE = _project_root / "x4-station-calculator.config.json"


def _load_config() -> Dict[str, Any]:
    with open(_CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _get_target_versions(config: Dict[str, Any], args) -> List[Dict[str, Any]]:
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


def _merge_config(base: Dict[str, Any], version_item: Dict[str, Any]) -> Dict[str, Any]:
    m = deepcopy(base)
    m.update(version_item)
    return m


def _load_ware_dlc_tags(raw_path: str, dlc_order: list) -> Dict[str, str]:
    dlc_tag_path = "scripts.processor.dlc_tag"
    try:
        mod = importlib.import_module(dlc_tag_path)
        return mod.build_ware_dlc_tag_map(Path(raw_path) / "libraries" / "wares", dlc_order)
    except Exception:
        return {}


def _inject_english_names(data: List[Dict[str, Any]], output_dir: str) -> int:
    en_path = os.path.join(output_dir, "..", "locales", "en.json")
    if not os.path.exists(en_path):
        print(f"   WARNING: English locale not found at {en_path}, skipping name injection")
        return 0
    with open(en_path, "r", encoding="utf-8") as f:
        en_map = json.load(f)
    count = 0
    for item in data:
        for key in ('nameId', 'descriptionId'):
            raw_key = item.get(key)
            if raw_key and raw_key in en_map:
                item[key.replace('Id', '')] = en_map[raw_key]
                count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description="Research XML -> JSON standalone migration")
    parser.add_argument("--version", type=str, help="Target version, e.g. 8.0 or 9.0")
    parser.add_argument("--beta", action="store_true", help="Use beta flavour")
    parser.add_argument("--stable", action="store_true", help="Use stable flavour")
    args = parser.parse_args()

    config = _load_config()
    version_list = _get_target_versions(config, args)
    if not version_list:
        print("ERROR: no matching version configuration found.")
        sys.exit(1)

    for version_item in version_list:
        effective = _merge_config(config, version_item)
        version_label = effective["version"]
        folder_name = effective["folder_name"]
        flavour = "beta" if effective.get("beta", False) else "stable"
        print(f"Research data migration: {version_label} ({flavour}) -> {folder_name}")

        raw_assets_dir = effective["raw_assets_dir"]
        processed_assets_dir = effective["processed_assets_dir"]

        raw_path = os.path.join(raw_assets_dir, folder_name)
        if not os.path.isdir(raw_path):
            print(f"   WARNING: raw data directory does not exist: {raw_path}")
            continue

        dlc_order = effective.get("dlc_order", [])
        ware_dlc_tags = _load_ware_dlc_tags(raw_path, dlc_order)

        i18n_collector: set = set()
        items = build_research_data(raw_path, ware_dlc_tags, i18n_collector)

        output_dir = os.path.join(processed_assets_dir, folder_name, "data")
        os.makedirs(output_dir, exist_ok=True)

        injected = _inject_english_names(items, output_dir)
        if injected:
            print(f"   Injected {injected} English names")

        data = {"items": items}
        output_path = os.path.join(output_dir, "research.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        categories: Dict[str, int] = {}
        for item in items:
            cat = item["category"]
            categories[cat] = categories.get(cat, 0) + 1
        cat_summary = ", ".join(f"{k}: {v}" for k, v in sorted(categories.items()))

        print(f"   research.json -> {output_path}")
        print(f"   {len(items)} items ({cat_summary})")


if __name__ == "__main__":
    main()
