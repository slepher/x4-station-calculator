"""X4 Map Data Processor - Modular Package."""

from processor.i18n import get_i18n_registry
from processor.versioning import get_target_versions, load_version_config, merge_version_config
from processor.config import (
    apply_runtime_config,
    default_version_item,
    parse_args,
    resolve_runtime_paths,
    X4_UNPACKED_DATA_PATH,
    OUTPUT_VERSION_DIR,
)
from processor.map import run_for_config, main

__all__ = [
    "get_i18n_registry",
    "get_target_versions",
    "load_version_config",
    "merge_version_config",
    "apply_runtime_config",
    "default_version_item",
    "parse_args",
    "resolve_runtime_paths",
    "run_for_config",
    "main",
    "X4_UNPACKED_DATA_PATH",
    "OUTPUT_VERSION_DIR",
]
