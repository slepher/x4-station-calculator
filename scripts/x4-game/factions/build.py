"""Build factions.json from X4 game data XML (factions/final.xml).

Output: X4Faction[] flat array with licences per faction.
"""

import os
from pathlib import Path
from typing import Any, Dict, Optional, Set

from .converter import migrate_factions


def build_factions_data(
    raw_path: str,
    i18n_collector: Optional[Set[str]] = None,
) -> list:
    factions_xml_path = Path(raw_path) / "libraries" / "factions" / "final.xml"
    colors_xml_path = Path(raw_path) / "libraries" / "colors" / "final.xml"

    factions_rows, factions_by_id = migrate_factions(
        factions_xml_path=factions_xml_path,
        colors_xml_path=colors_xml_path,
        i18n_collector=i18n_collector,
    )

    return factions_rows


def process_factions(loader: Any) -> None:
    data = build_factions_data(
        raw_path=loader.raw_path,
        i18n_collector=loader.needed_raw_names,
    )
    loader.factions_data = data
    licences_count = sum(
        len(f.get("licences", [])) for f in data
    )
    print(f"   ✅ 生成 {len(data)} 个派系, {licences_count} 条 licence。")
