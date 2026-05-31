"""Standalone script: parse terraforming XML → generate terraforming.json only (no i18n).

Usage:
    python scripts/x4-game/terraforming/run.py                        # default version from config
    python scripts/x4-game/terraforming/run.py --version 8.0          # specific version
    python scripts/x4-game/terraforming/run.py --version 9.0 --beta   # specific flavour
    python scripts/x4-game/terraforming/run.py --stable               # stable (non-beta) of current version
"""
import argparse
import json
import os
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List
import xml.etree.ElementTree as ET2

_project_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_project_root))

import importlib

_mod_build = importlib.import_module("scripts.x4-game.terraforming.build")
build_terraforming_data = _mod_build.build_terraforming_data


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


def _load_ship_ware_data(raw_path: str) -> "tuple[Dict[str, str], Dict[str, dict]]":
    component_to_ware: Dict[str, str] = {}
    ware_index: Dict[str, dict] = {}
    wares_path = os.path.join(raw_path, "libraries", "wares", "final.xml")
    if not os.path.exists(wares_path):
        return component_to_ware, ware_index
    try:
        tree = ET2.parse(wares_path)
        for ware in tree.getroot().findall("ware"):
            w_id = ware.get("id", "")
            if not w_id:
                continue
            name = ware.get("name", "")
            ware_index[w_id] = {"nameId": name}
            comp = ware.find("component")
            if comp is not None:
                ref = comp.get("ref", "")
                if ref and ref not in component_to_ware:
                    component_to_ware[ref] = w_id
    except Exception:
        pass
    return component_to_ware, ware_index


def _inject_english_names(data: dict, output_dir: str) -> int:
    en_path = os.path.join(output_dir, "..", "locales", "en.json")
    if not os.path.exists(en_path):
        print(f"   WARNING: English locale not found at {en_path}, skipping name injection")
        return 0
    with open(en_path, "r", encoding="utf-8") as f:
        en_map = json.load(f)
    count = 0
    for section in ("stats", "projectGroups", "projects", "deliveryShips"):
        for item in data.get(section, []):
            for key in ("nameId", "descriptionId", "inactiveTextId"):
                raw_key = item.get(key)
                if raw_key and raw_key in en_map:
                    item[key.replace("Id", "")] = en_map[raw_key]
                    count += 1
    for item in data.get("stats", []):
        for r in item.get("ranges", []):
            raw_key = r.get("descriptionId")
            if raw_key and raw_key in en_map:
                r["description"] = en_map[raw_key]
                count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description="Terraforming XML -> JSON standalone migration")
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
        print(f"Terraforming data migration: {version_label} ({flavour}) -> {folder_name}")

        raw_assets_dir = effective["raw_assets_dir"]
        processed_assets_dir = effective["processed_assets_dir"]

        raw_path = os.path.join(raw_assets_dir, folder_name)
        if not os.path.isdir(raw_path):
            print(f"   WARNING: raw data directory does not exist: {raw_path}")
            continue

        ctow, widx = _load_ship_ware_data(raw_path)

        wares_path = os.path.join(processed_assets_dir, folder_name, "data", "wares.json")
        wares_data: list = []
        if os.path.exists(wares_path):
            with open(wares_path, "r", encoding="utf-8") as f:
                wares_data = json.load(f)

        try:
            data = build_terraforming_data(raw_path, ctow, widx, wares_data)
        except Exception as e:
            print(f"   Terraforming XML Error: {e}")
            continue

        if data is None:
            continue

        output_dir = os.path.join(processed_assets_dir, folder_name, "data")
        os.makedirs(output_dir, exist_ok=True)

        injected = _inject_english_names(data, output_dir)
        if injected:
            print(f"   Injected {injected} English names")

        output_path = os.path.join(output_dir, "terraforming.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"   terraforming.json -> {output_path}")
        print(f"   {len(data['stats'])} stats | {len(data['projectGroups'])} groups | "
              f"{len(data['projects'])} projects | {len(data['clusters'])} clusters | "
              f"{len(data.get('deliveryShips', []))} delivery ships")


if __name__ == "__main__":
    main()
