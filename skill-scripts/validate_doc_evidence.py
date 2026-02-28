#!/usr/bin/env python3
"""
Validate evidence quality for test-doc artifacts.

Goal:
1) Reduce hallucinated IDs by checking mentioned ship/equipment IDs against source data.
2) Enforce that key claim lines in ui_knowledge.md carry traceable code/data references.

Usage:
  python3 skill-scripts/validate_doc_evidence.py <change-name>
  python3 skill-scripts/validate_doc_evidence.py <change-name> --strict

Exit code:
  0 = pass
  1 = fail
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Iterable, List, Set, Tuple


SHIPS_JSON = Path("src/assets/x4_game_data/8.0-Diplomacy/data/ships.json")
EQUIPMENTS_JSON = Path("src/assets/x4_game_data/8.0-Diplomacy/data/equipments.json")

SOURCE_REF_PATTERN = re.compile(r"\[src:\s*([^\]:]+(?:/[^\]:]+)*)(?::(\d+))?\]")
CODE_PATH_PATTERN = re.compile(r"`((?:src|tests|skill-scripts|openspec)/[^`]+?\.(?:ts|tsx|js|vue|json|md|py))(?::(\d+))?`")
# Require real ship-id shape like ship_ter_l_destroyer_01_a (at least two segments after `ship_`)
SHIP_ID_PATTERN = re.compile(r"\b(ship_[a-z0-9]+_[a-z0-9_]+)\b")
EQUIP_ID_PATTERN = re.compile(r"\b((?:engine|shield|weapon|turret|thruster)_[a-z0-9_]+)\b")
CLAIM_KEYWORDS = (
    "结论",
    "对应",
    "可见",
    "验证",
    "候选",
    "路径",
    "必须",
    "不成立",
    "selectedShipId",
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Validate doc evidence quality")
    p.add_argument("change_name", help="Change name in openspec/changes/")
    p.add_argument(
        "--strict",
        action="store_true",
        help="Fail on missing source refs for claim lines (default: warning only)",
    )
    return p.parse_args()


def read_json_array(path: Path) -> list:
    if not path.exists():
        raise FileNotFoundError(f"Missing data file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def collect_known_ids() -> Tuple[Set[str], Set[str]]:
    ships = read_json_array(SHIPS_JSON)
    eqs = read_json_array(EQUIPMENTS_JSON)
    ship_ids = {item.get("id") for item in ships if isinstance(item, dict) and isinstance(item.get("id"), str)}
    eq_ids = {item.get("id") for item in eqs if isinstance(item, dict) and isinstance(item.get("id"), str)}
    return ship_ids, eq_ids


def extract_ids(text: str) -> Tuple[Set[str], Set[str]]:
    return set(SHIP_ID_PATTERN.findall(text)), set(EQUIP_ID_PATTERN.findall(text))


def iter_claim_lines(lines: List[str]) -> Iterable[Tuple[int, str]]:
    in_code = False
    for i, raw in enumerate(lines, 1):
        line = raw.strip()
        if line.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        if not line:
            continue
        if line.startswith("#") or line.startswith("|") or line.startswith("---"):
            continue
        if not line.startswith("-"):
            continue
        if any(k in line for k in CLAIM_KEYWORDS):
            yield i, line


def has_local_source_ref(lines: List[str], idx: int) -> bool:
    # Same line or next two lines can carry source refs.
    start = idx - 1
    end = min(len(lines), idx + 2)
    for i in range(start, end):
        text = lines[i]
        for m in SOURCE_REF_PATTERN.finditer(text):
            p = Path(m.group(1))
            if p.exists():
                ln = m.group(2)
                if ln is None:
                    return True
                if ln.isdigit() and int(ln) >= 1:
                    return True
        for m in CODE_PATH_PATTERN.finditer(text):
            p = Path(m.group(1))
            if p.exists():
                ln = m.group(2)
                if ln is None:
                    return True
                if ln.isdigit() and int(ln) >= 1:
                    return True
    return False


def validate_change(change_name: str, strict: bool) -> Tuple[bool, List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []

    base = Path("openspec/changes") / change_name
    test_tasks = base / "test_tasks.md"
    ui_knowledge = base / "ui_knowledge.md"
    if not test_tasks.exists():
        errors.append(f"Missing file: {test_tasks}")
        return False, errors, warnings
    if not ui_knowledge.exists():
        errors.append(f"Missing file: {ui_knowledge}")
        return False, errors, warnings

    ship_ids, eq_ids = collect_known_ids()
    tt_text = test_tasks.read_text(encoding="utf-8")
    uk_text = ui_knowledge.read_text(encoding="utf-8")

    # 1) ID existence check
    for source_name, text in (("test_tasks.md", tt_text), ("ui_knowledge.md", uk_text)):
        mentioned_ship_ids, mentioned_equip_ids = extract_ids(text)
        for sid in sorted(mentioned_ship_ids):
            if sid not in ship_ids:
                errors.append(f"{source_name}: unknown ship id `{sid}` (not found in ships.json)")
        for eid in sorted(mentioned_equip_ids):
            if eid not in eq_ids:
                errors.append(f"{source_name}: unknown equipment id `{eid}` (not found in equipments.json)")

    # 2) ui_knowledge claim-line evidence check
    uk_lines = uk_text.splitlines()
    for line_no, claim in iter_claim_lines(uk_lines):
        if not has_local_source_ref(uk_lines, line_no):
            msg = (
                f"ui_knowledge.md:{line_no} claim lacks source ref: `{claim}`; "
                "add `[src: path:line]` or backticked file path"
            )
            if strict:
                errors.append(msg)
            else:
                warnings.append(msg)

    return len(errors) == 0, errors, warnings


def main() -> None:
    args = parse_args()
    ok, errors, warnings = validate_change(args.change_name, args.strict)

    print("=== Evidence Validation Report ===")
    if warnings:
        print("\nWarnings:")
        for w in warnings:
            print(f"  - {w}")
    if errors:
        print("\nErrors:")
        for e in errors:
            print(f"  - {e}")
        print("\n✗ FAIL - Evidence validation failed")
        sys.exit(1)

    print("\n✓ PASS - Evidence validation passed")
    sys.exit(0)


if __name__ == "__main__":
    main()
