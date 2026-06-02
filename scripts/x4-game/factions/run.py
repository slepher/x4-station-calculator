"""Standalone script: parse factions XML → generate factions.json.

Usage:
    python scripts/x4-game/factions/run.py                        # default version from config
    python scripts/x4-game/factions/run.py --version 8.0          # specific version
    python scripts/x4-game/factions/run.py --version 9.0 --beta   # specific flavour
    python scripts/x4-game/factions/run.py --stable               # stable (non-beta) of current version
"""
import importlib
import sys
from pathlib import Path
from typing import Any, Dict

_project_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(_project_root))
sys.path.insert(0, str(_project_root / "scripts"))

_mod_runner = importlib.import_module("scripts.x4-game.shared.runner")
_mod_build = importlib.import_module("scripts.x4-game.factions.build")
BaseRunner = _mod_runner.BaseRunner
build_factions_data = _mod_build.build_factions_data


class FactionsRunner(BaseRunner):
    name = "Factions"

    def build_data(self, raw_path: str, i18n_collector: set, **extra: Any) -> Dict[str, Any]:
        data = build_factions_data(raw_path, i18n_collector)
        licences_count = sum(len(f.get("licences", [])) for f in data)
        print(f"   {len(data)} factions, {licences_count} licence entries")
        return {"factions.json": data}


if __name__ == "__main__":
    FactionsRunner().run()
