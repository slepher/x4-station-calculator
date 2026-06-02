"""Standalone script: parse terraforming XML → generate terraforming.json.

Usage:
    python scripts/x4-game/terraforming/run.py                        # default version from config
    python scripts/x4-game/terraforming/run.py --version 8.0          # specific version
    python scripts/x4-game/terraforming/run.py --version 9.0 --beta   # specific flavour
    python scripts/x4-game/terraforming/run.py --stable               # stable (non-beta) of current version
"""
import importlib
import json
import os
import sys
import xml.etree.ElementTree as ET2
from pathlib import Path
from typing import Any, Dict

_project_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_project_root))
sys.path.insert(0, str(_project_root / "scripts"))

_mod_runner = importlib.import_module("scripts.x4-game.shared.runner")
_mod_build = importlib.import_module("scripts.x4-game.terraforming.build")
BaseRunner = _mod_runner.BaseRunner
build_terraforming_data = _mod_build.build_terraforming_data


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


class TerraformingRunner(BaseRunner):
    name = "Terraforming"

    def get_extra_args(self, effective: Dict[str, Any], raw_path: str) -> Dict[str, Any]:
        ctow, widx = _load_ship_ware_data(raw_path)
        folder_name = effective["folder_name"]
        processed_assets_dir = effective["processed_assets_dir"]
        wares_path = os.path.join(processed_assets_dir, folder_name, "data", "wares.json")
        wares_data: list = []
        if os.path.exists(wares_path):
            with open(wares_path, "r", encoding="utf-8") as f:
                wares_data = json.load(f)
        return {"component_to_ware": ctow, "ware_index": widx, "wares_data": wares_data}

    def build_data(self, raw_path: str, i18n_collector: set, **extra: Any) -> Dict[str, Any]:
        ctow = extra.get("component_to_ware", {})
        widx = extra.get("ware_index", {})
        wares_data = extra.get("wares_data", [])

        data = build_terraforming_data(raw_path, ctow, widx, wares_data)
        if data is None:
            return {}

        print(f"   {len(data['stats'])} stats | {len(data['projectGroups'])} groups | "
              f"{len(data['projects'])} projects | {len(data['clusters'])} clusters | "
              f"{len(data.get('deliveryShips', []))} delivery ships")
        return {"terraforming.json": data}


if __name__ == "__main__":
    TerraformingRunner().run()
