"""BaseRunner: unified CLI + version loop for standalone data-generation scripts.

Subclasses override:
    name         – display name (e.g. "blueprints")
    build_data   – returns {filename: data_dict}
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Set

from .config import (
    add_version_args,
    load_config,
    get_target_versions,
    merge_config,
)
from .i18n import inject_english_names, inject_locales


class BaseRunner:
    name: str = ""

    def build_data(self, raw_path: str, i18n_collector: Set[str], **extra: Any) -> Dict[str, Any]:
        raise NotImplementedError

    def get_extra_args(self, effective: Dict[str, Any], raw_path: str) -> Dict[str, Any]:
        return {}

    def _parse_args(self) -> argparse.Namespace:
        parser = argparse.ArgumentParser(description=f"{self.name} data generator")
        add_version_args(parser)
        return parser.parse_args()

    def run(self) -> None:
        args = self._parse_args()
        config = load_config()
        version_list = get_target_versions(config, args)
        if not version_list:
            print("ERROR: no matching version configuration found.")
            sys.exit(1)

        for version_item in version_list:
            effective = merge_config(config, version_item)
            version_label = effective["version"]
            folder_name = effective["folder_name"]
            flavour = "beta" if effective.get("beta", False) else "stable"
            print(f"{self.name} data: {version_label} ({flavour}) -> {folder_name}")

            raw_assets_dir = effective["raw_assets_dir"]
            processed_assets_dir = effective["processed_assets_dir"]

            raw_path = os.path.join(raw_assets_dir, folder_name)
            if not os.path.isdir(raw_path):
                print(f"   WARNING: raw data directory does not exist: {raw_path}")
                continue

            i18n_collector: Set[str] = set()
            extra = self.get_extra_args(effective, raw_path)

            data_files = self.build_data(raw_path, i18n_collector, **extra)
            if not data_files:
                print("   WARNING: build_data returned nothing, skipping.")
                continue

            output_dir = os.path.join(processed_assets_dir, folder_name, "data")
            os.makedirs(output_dir, exist_ok=True)

            locale_dir = os.path.join(processed_assets_dir, folder_name, "locales")
            en_path = os.path.join(locale_dir, "en.json")
            en_map: Dict[str, str] = {}
            if os.path.exists(en_path):
                with open(en_path, "r", encoding="utf-8") as f:
                    en_map = json.load(f)

            for filename, data in data_files.items():
                # inject English names into data
                injected = inject_english_names(data, en_map)
                if injected:
                    print(f"   Injected {injected} English names")

                output_path = os.path.join(output_dir, filename)
                with open(output_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"   {filename} -> {output_path}")

            # inject i18n into locale files
            if i18n_collector:
                locale_counts = inject_locales(locale_dir, i18n_collector, raw_path)
                if locale_counts:
                    total = sum(locale_counts.values())
                    langs = ", ".join(
                        f"{lang}(+{cnt})" for lang, cnt in sorted(locale_counts.items())
                    )
                    print(f"   i18n injected into locales: +{total} entries ({langs})")
