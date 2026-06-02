"""i18n injection utilities for standalone run.py scripts.

- inject_english_names: recursive English name injection into data dicts.
- inject_locales: inject new nameId translations into existing locale JSON files.
"""

import json
import os
from typing import Any, Dict, Set

from scripts.processor.i18n import I18nRegistry

X4_LANG_CONFIG = {
    '044': {'iso': 'en',    'name': 'English'},
    '086': {'iso': 'zh-CN', 'name': '简体中文'},
    '088': {'iso': 'zh-TW', 'name': '繁體中文'},
    '049': {'iso': 'de',    'name': 'Deutsch'},
    '033': {'iso': 'fr',    'name': 'Français'},
    '039': {'iso': 'it',    'name': 'Italiano'},
    '034': {'iso': 'es',    'name': 'Español'},
    '007': {'iso': 'ru',    'name': 'Русский'},
    '081': {'iso': 'ja',    'name': '日本語'},
    '082': {'iso': 'ko',    'name': '한국어'},
    '055': {'iso': 'pt-BR', 'name': 'Português (Brasil)'},
    '048': {'iso': 'pl',    'name': 'Polski'}
}

_NAME_ID_KEYS = frozenset({"nameId", "descriptionId", "inactiveTextId"})


def inject_english_names(data: Any, en_map: dict) -> int:
    """Recursively walk data and inject English names for nameId/descriptionId/inactiveTextId fields."""
    count = 0

    def _inject_item(item: Dict[str, Any]) -> int:
        c = 0
        for key in _NAME_ID_KEYS:
            raw_key = item.get(key)
            if raw_key and raw_key in en_map:
                name_key = key.replace("Id", "")
                item[name_key] = en_map[raw_key]
                c += 1
        return c

    def _walk(obj: Any) -> int:
        c = 0
        if isinstance(obj, dict):
            for key, val in obj.items():
                if key.endswith("Id") and isinstance(val, str):
                    if key in _NAME_ID_KEYS and val in en_map:
                        name_key = key.replace("Id", "")
                        obj[name_key] = en_map[val]
                        c += 1
                else:
                    c += _walk(val)
        elif isinstance(obj, list):
            for item in obj:
                c += _walk(item)
        return c

    return _walk(data)


def inject_locales(
    locale_dir: str,
    new_name_ids: Set[str],
    raw_path: str,
) -> Dict[str, int]:
    """Inject new nameId translations into existing locale JSON files.

    Returns dict of {lang_code: added_count}.
    """
    if not new_name_ids:
        return {}

    if not os.path.exists(raw_path):
        print(f"   WARNING: raw path not found for i18n injection: {raw_path}")
        return {}

    registry = I18nRegistry()
    registry.configure(raw_path, X4_LANG_CONFIG)
    registry.collect_many(new_name_ids)

    counts: Dict[str, int] = {}
    for x4_id, conf in sorted(X4_LANG_CONFIG.items()):
        iso = conf["iso"]
        new_entries = registry.export_collected(iso)
        if not new_entries:
            continue

        locale_path = os.path.join(locale_dir, f"{iso}.json")
        existing: Dict[str, str] = {}
        if os.path.exists(locale_path):
            with open(locale_path, "r", encoding="utf-8") as f:
                existing = json.load(f)

        added = 0
        for name_id, text in new_entries.items():
            if name_id not in existing:
                existing[name_id] = text
                added += 1

        if added > 0:
            sorted_items = dict(sorted(existing.items()))
            with open(locale_path, "w", encoding="utf-8") as f:
                json.dump(sorted_items, f, indent=2, ensure_ascii=False)
            counts[iso] = added

    return counts
