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
import xml.etree.ElementTree as ET
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List

_project_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_project_root))

import importlib

# Dynamic imports for x4-game directory (hyphen in name prevents standard Python import)
_mod_lib = importlib.import_module("scripts.x4-game.terraforming.parse_library")
parse_stats = _mod_lib.parse_stats
parse_project_groups = _mod_lib.parse_project_groups
parse_projects = _mod_lib.parse_projects

_mod_md = importlib.import_module("scripts.x4-game.terraforming.parse_md")
parse_md = _mod_md.parse_md
resolve_cluster_objective_texts = _mod_md.resolve_cluster_objective_texts

_mod_build = importlib.import_module("scripts.x4-game.terraforming.build")
_compute_actual_ware_amounts = _mod_build._compute_actual_ware_amounts
_build_delivery_ships = _mod_build._build_delivery_ships


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


def _load_cluster_name_ids(folder_name: str) -> Dict[str, str]:
    alt_path = os.path.join(
        _project_root, "src", "assets", "x4_game_data",
        folder_name, "data", "maps.json",
    )
    if not os.path.exists(alt_path):
        return {}
    try:
        with open(alt_path, "r", encoding="utf-8") as f:
            maps_data = json.load(f)
        result: Dict[str, str] = {}
        clusters = maps_data.get("clusters", {})
        sectors_map = maps_data.get("sectors", {})
        for macro_id, cluster_info in clusters.items():
            sector_list = cluster_info.get("sectors", [])
            if len(sector_list) == 1:
                sector = sectors_map.get(sector_list[0], {})
                name_id = sector.get("nameId", "")
            else:
                name_id = cluster_info.get("nameId", "")
            if name_id:
                result[macro_id] = name_id
        return result
    except Exception:
        return {}


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


def _load_ship_ware_data(raw_path: str) -> tuple:
    """Load component_to_ware and ware_index from raw wares XML for deliveryShips nameId resolution."""
    import xml.etree.ElementTree as ET2
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


def process_terraforming_standalone(raw_path: str, folder_name: str) -> dict | None:
    library_path = os.path.join(raw_path, "libraries", "terraforming", "final.xml")
    md_path = os.path.join(raw_path, "md", "terraforming", "final.xml")

    if not os.path.exists(library_path):
        print(f"   WARNING: terraforming library file not found: {library_path}")
        return None

    try:
        lib_tree = ET.parse(library_path)
        lib_root = lib_tree.getroot()

        stats = parse_stats(lib_root)
        project_groups = parse_project_groups(lib_root)
        projects, _lib_name_ids = parse_projects(lib_root)

        clusters: List[Dict[str, Any]] = []
        predecessors_map: Dict[str, List[Dict[str, Any]]] = {}

        if os.path.exists(md_path):
            try:
                md_tree = ET.parse(md_path)
                md_root = md_tree.getroot()
                clusters, predecessors_map = parse_md(md_root)
            except Exception as e:
                print(f"   WARNING: MD terraforming parsing failed: {e}")

        clusters = [c for c in clusters if len(c.get("projectIds", [])) > 0]

        cluster_name_map = _load_cluster_name_ids(folder_name)
        resolve_cluster_objective_texts(clusters, cluster_name_map)

        for proj in projects:
            pid = proj["id"]
            if pid in predecessors_map:
                proj["predecessors"] = predecessors_map[pid]

        for proj in projects:
            preds = proj.get("predecessors")
            if not preds:
                continue
            resolved = []
            for p in preds:
                if p.get("ref") == "$PilotTrainingCourseProject":
                    resolved.append({**p, "ref": "trn_pilot"})
                else:
                    resolved.append(p)
            proj["predecessors"] = resolved

        # Compute actual in-game ware amounts using max prices from wares.json
        wares_path = os.path.join(
            _project_root, "src", "assets", "x4_game_data",
            folder_name, "data", "wares.json",
        )
        if os.path.exists(wares_path):
            try:
                with open(wares_path, "r", encoding="utf-8") as f:
                    wares_data = json.load(f)
                _compute_actual_ware_amounts(projects, wares_data)
            except Exception as e:
                print(f"   WARNING: Failed to load wares data: {e}")

        # Build deliveryShips (nameId from raw wares XML)
        ctow, widx = _load_ship_ware_data(raw_path)
        delivery_ships = _build_delivery_ships(projects, ctow, widx)

        # Strip buildDuration from deliveries (moved to deliveryShips)
        for proj in projects:
            for d in proj.get("deliveries", []):
                d.pop("buildDuration", None)

        print(f"   Parsed terraforming: {len(stats)} stats, {len(project_groups)} groups, "
              f"{len(projects)} projects, {len(clusters)} clusters, {len(delivery_ships)} delivery ships")

        return {
            "stats": stats,
            "projectGroups": project_groups,
            "projects": projects,
            "clusters": clusters,
            "deliveryShips": delivery_ships,
        }

    except Exception as e:
        print(f"   Terraforming XML Error: {e}")
        return None


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

        data = process_terraforming_standalone(raw_path, folder_name)
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
        tf_stats = data.get("stats", [])
        tf_groups = data.get("projectGroups", [])
        tf_projects = data.get("projects", [])
        tf_clusters = data.get("clusters", [])
        print(f"   {len(tf_stats)} stats | {len(tf_groups)} groups | "
              f"{len(tf_projects)} projects | {len(tf_clusters)} clusters | "
              f"{len(data.get('deliveryShips', []))} delivery ships")


if __name__ == "__main__":
    main()
