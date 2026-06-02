"""Standalone script: parse research wares → generate research.json.

Usage:
    python scripts/x4-game/research/run.py                        # default version from config
    python scripts/x4-game/research/run.py --version 8.0          # specific version
    python scripts/x4-game/research/run.py --version 9.0 --beta   # specific flavour
    python scripts/x4-game/research/run.py --stable               # stable (non-beta) of current version
"""
import importlib
import sys
from pathlib import Path
from typing import Any, Dict

_project_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_project_root))
sys.path.insert(0, str(_project_root / "scripts"))

_mod_runner = importlib.import_module("scripts.x4-game.shared.runner")
_mod_build = importlib.import_module("scripts.x4-game.research.build")
BaseRunner = _mod_runner.BaseRunner
build_research_data = _mod_build.build_research_data


def _load_ware_dlc_tags(raw_path: str, dlc_order: list) -> Dict[str, str]:
    dlc_tag_path = "scripts.processor.dlc_tag"
    try:
        mod = importlib.import_module(dlc_tag_path)
        return mod.build_ware_dlc_tag_map(Path(raw_path) / "libraries" / "wares", dlc_order)
    except Exception:
        return {}


class ResearchRunner(BaseRunner):
    name = "Research"

    def get_extra_args(self, effective: Dict[str, Any], raw_path: str) -> Dict[str, Any]:
        dlc_order = effective.get("dlc_order", [])
        ware_dlc_tags = _load_ware_dlc_tags(raw_path, dlc_order)
        return {"ware_dlc_tags": ware_dlc_tags}

    def build_data(self, raw_path: str, i18n_collector: set, **extra: Any) -> Dict[str, Any]:
        ware_dlc_tags = extra.get("ware_dlc_tags", {})
        items = build_research_data(raw_path, ware_dlc_tags, i18n_collector)
        categories: Dict[str, int] = {}
        for item in items:
            cat = item["category"]
            categories[cat] = categories.get(cat, 0) + 1
        cat_summary = ", ".join(f"{k}: {v}" for k, v in sorted(categories.items()))
        print(f"   {len(items)} items ({cat_summary})")
        return {"research.json": {"items": items}}


if __name__ == "__main__":
    ResearchRunner().run()
