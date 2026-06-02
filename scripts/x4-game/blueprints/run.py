"""Standalone script: parse game data XML → generate blueprints.json.

Usage:
    python scripts/x4-game/blueprints/run.py                        # default version from config
    python scripts/x4-game/blueprints/run.py --version 8.0          # specific version
    python scripts/x4-game/blueprints/run.py --version 9.0 --beta   # specific flavour
    python scripts/x4-game/blueprints/run.py --stable               # stable (non-beta) of current version
"""
import importlib
import sys
from pathlib import Path
from typing import Any, Dict, Set

_project_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_project_root))
sys.path.insert(0, str(_project_root / "scripts"))

_mod_runner = importlib.import_module("scripts.x4-game.shared.runner")
_mod_build = importlib.import_module("scripts.x4-game.blueprints.build")
BaseRunner = _mod_runner.BaseRunner
build_blueprints_data = _mod_build.build_blueprints_data


class BlueprintsRunner(BaseRunner):
    name = "Blueprints"

    def build_data(self, raw_path: str, i18n_collector: Set[str], **extra: Any) -> Dict[str, Any]:
        data = build_blueprints_data(raw_path, i18n_collector)
        by_type = {}
        for item in data.get("blueprints", []):
            t = item.get("type", "?")
            by_type[t] = by_type.get(t, 0) + 1
        type_summary = ", ".join(f"{k}: {v}" for k, v in sorted(by_type.items()))
        print(f"   {len(data['blueprints'])} blueprints, {len(data['types'])} types, {len(data['classes'])} classes ({type_summary})")
        return {"blueprints.json": data}


if __name__ == "__main__":
    BlueprintsRunner().run()
