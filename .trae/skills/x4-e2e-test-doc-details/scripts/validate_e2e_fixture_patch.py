#!/usr/bin/env python3
"""
Validate X4 E2E fixture patch JSON files by applying them in memory.
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


BASE_BY_TARGET = {
    "db.json": Path("tests/fixtures/db.json"),
    "save.json": Path("tests/fixtures/save.json"),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate X4 E2E fixture patches")
    parser.add_argument("patch_files", nargs="+", help="Path(s) to *.patch.json")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    return parser.parse_args()


def add_error(errors: List[Dict[str, str]], file: Path, code: str, msg: str, path: Optional[str] = None) -> None:
    item = {"file": str(file), "error_code": code, "error_msg": msg}
    if path:
        item["path"] = path
    errors.append(item)


def is_object(value: Any) -> bool:
    return isinstance(value, dict)


def split_path(path: str) -> List[str]:
    return [part for part in path.split(".") if part]


def resolve_parent(root: Any, path: str) -> tuple[Any, str]:
    parts = split_path(path)
    if not parts:
        raise ValueError("path must not be empty")
    current = root
    for part in parts[:-1]:
        if isinstance(current, list):
            if not part.isdigit():
                raise ValueError(f"array path segment must be numeric: {part}")
            index = int(part)
            if index < 0 or index >= len(current):
                raise ValueError(f"array index out of range: {part}")
            current = current[index]
        elif isinstance(current, dict):
            if part not in current:
                raise ValueError(f"path segment not found: {part}")
            current = current[part]
        else:
            raise ValueError(f"path segment is not traversable: {part}")
    return current, parts[-1]


def apply_delete(root: Any, path: str) -> None:
    parent, key = resolve_parent(root, path)
    if isinstance(parent, list):
        if not key.isdigit():
            raise ValueError(f"array delete path segment must be numeric: {key}")
        index = int(key)
        if index < 0 or index >= len(parent):
            raise ValueError(f"array index out of range: {key}")
        parent.pop(index)
        return
    if isinstance(parent, dict):
        if key not in parent:
            raise ValueError(f"path segment not found: {key}")
        del parent[key]
        return
    raise ValueError("delete parent is not object or array")


def deep_merge(target: Any, patch: Any) -> Any:
    if isinstance(target, dict) and isinstance(patch, dict):
        for key, value in patch.items():
            if key in target:
                target[key] = deep_merge(target[key], value)
            else:
                target[key] = copy.deepcopy(value)
        return target
    return copy.deepcopy(patch)


def apply_append(root: Any, path: str, values: List[Any]) -> None:
    parent, key = resolve_parent(root, path)
    if isinstance(parent, list):
        if not key.isdigit():
            raise ValueError(f"array path segment must be numeric: {key}")
        index = int(key)
        if index < 0 or index >= len(parent):
            raise ValueError(f"array index out of range: {key}")
        target = parent[index]
    elif isinstance(parent, dict):
        if key not in parent:
            raise ValueError(f"path segment not found: {key}")
        target = parent[key]
    else:
        raise ValueError("append parent is not object or array")

    if not isinstance(target, list):
        raise ValueError("append target is not an array")
    for value in values:
        target.append(copy.deepcopy(value))


def validate_patch(path: Path) -> Dict[str, Any]:
    errors: List[Dict[str, str]] = []
    result: Dict[str, Any] = {"file": str(path), "ok": False, "target": "", "base": "", "operationCount": 0, "errors": errors}

    if not path.exists():
        add_error(errors, path, "PATCH_FILE_MISSING", f"File not found: {path}")
        return result

    try:
        patch = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        add_error(errors, path, "PATCH_JSON_INVALID", str(exc))
        return result

    if not is_object(patch):
        add_error(errors, path, "PATCH_ROOT_INVALID", "patch root must be an object")
        return result

    target = patch.get("$target")
    if target not in BASE_BY_TARGET:
        add_error(errors, path, "TARGET_INVALID", "$target must be db.json or save.json")
        return result

    base_path = BASE_BY_TARGET[target]
    result["target"] = target
    result["base"] = str(base_path)

    if not base_path.exists():
        add_error(errors, path, "BASE_FILE_MISSING", f"Base file not found: {base_path}")
        return result

    delete_paths = patch.get("$delete", [])
    merge_patch = patch.get("$merge")
    append_patch = patch.get("$append")

    if "$delete" in patch and not (isinstance(delete_paths, list) and all(isinstance(item, str) for item in delete_paths)):
        add_error(errors, path, "DELETE_INVALID", "$delete must be a string array")
    if "$merge" in patch and not is_object(merge_patch):
        add_error(errors, path, "MERGE_INVALID", "$merge must be an object")
    if "$append" in patch and not is_object(append_patch):
        add_error(errors, path, "APPEND_INVALID", "$append must be an object")
    if "$append" in patch and is_object(append_patch):
        for append_path, values in append_patch.items():
            if not isinstance(append_path, str):
                add_error(errors, path, "APPEND_PATH_INVALID", "$append keys must be dot paths")
            if not isinstance(values, list):
                add_error(errors, path, "APPEND_VALUE_INVALID", "$append values must be arrays", append_path)

    operation_count = len(delete_paths if isinstance(delete_paths, list) else [])
    operation_count += 1 if is_object(merge_patch) else 0
    operation_count += len(append_patch) if is_object(append_patch) else 0
    result["operationCount"] = operation_count

    if operation_count == 0:
        add_error(errors, path, "PATCH_EMPTY", "one of $delete, $merge, or $append is required")
    if errors:
        return result

    try:
        base = json.loads(base_path.read_text(encoding="utf-8"))
        data = copy.deepcopy(base)
        for delete_path in delete_paths:
            apply_delete(data, delete_path)
        if is_object(merge_patch):
            data = deep_merge(data, merge_patch)
        if is_object(append_patch):
            for append_path, values in append_patch.items():
                apply_append(data, append_path, values)
        json.dumps(data, ensure_ascii=False)
    except Exception as exc:  # noqa: BLE001
        add_error(errors, path, "PATCH_APPLY_FAILED", str(exc))
        return result

    result["ok"] = True
    return result


def main() -> int:
    args = parse_args()
    results = [validate_patch(Path(item)) for item in args.patch_files]
    ok = all(result["ok"] for result in results)

    if args.json:
        print(json.dumps({"ok": ok, "results": results}, ensure_ascii=False, indent=2))
    else:
        for result in results:
            if result["ok"]:
                print(f"{result['file']}: ok ({result['target']}, {result['operationCount']} operations)")
            else:
                for error in result["errors"]:
                    suffix = f" [{error['path']}]" if "path" in error else ""
                    print(f"{error['file']}: {error['error_code']}: {error['error_msg']}{suffix}")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
