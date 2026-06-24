#!/usr/bin/env python3
"""
Apply E2E test run results into e2e_test_tasks.md.

Usage:
    python3 .trae/skills/x4-e2e-test-run/scripts/apply_e2e_test_results.py <change-name> --successes "1.1,1.2"
    python3 .trae/skills/x4-e2e-test-run/scripts/apply_e2e_test_results.py <change-name> --failures "1.1" --fail-steps "1.1.2"
    python3 .trae/skills/x4-e2e-test-run/scripts/apply_e2e_test_results.py --file path/e2e_test_tasks.md --successes "1.1" --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


LINE_RE = re.compile(r"^(\s*-\s*\[)([ xX✓✗])(\]\s*)(\d+\.\d+(?:\.\d+)?)(\s+.*)$")


@dataclass
class Item:
    line_idx: int
    item_id: str
    level: int
    symbol: str
    prefix: str
    sep: str
    suffix: str


@dataclass
class ValidationError:
    case: str
    desc: str
    error_code: str
    error_msg: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply E2E test run results")
    parser.add_argument("change_name", nargs="?", help="Change name under openspec/changes/")
    parser.add_argument("--file", help="Path to e2e_test_tasks.md")
    parser.add_argument("--successes", default="", help="Comma-separated passed case ids, e.g. 1.1,1.2")
    parser.add_argument("--failures", default="", help="Comma-separated failed case ids, e.g. 1.3")
    parser.add_argument("--fail-steps", default="", help="Comma-separated failed subtask ids, e.g. 1.3.2")
    parser.add_argument("--json", action="store_true", help="Output JSON errors")
    return parser.parse_args()


def parse_csv(value: str) -> List[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


def normalize_symbol(value: str) -> str:
    if value in ("x", "X", "✓"):
        return "✓"
    if value == "✗":
        return "✗"
    return " "


def resolve_path(args: argparse.Namespace) -> Path:
    if args.file:
        path = Path(args.file)
    else:
        if not args.change_name:
            raise ValueError("change_name or --file is required")
        path = Path("openspec/changes") / args.change_name / "e2e_test_tasks.md"

    if not path.exists():
        raise FileNotFoundError(f"task file not found: {path}")
    return path


def top_id(item_id: str) -> str:
    parts = item_id.split(".")
    return ".".join(parts[:2])


def parse_items(content: str) -> Tuple[List[str], List[Item]]:
    lines = content.splitlines()
    items: List[Item] = []

    for idx, line in enumerate(lines):
        match = LINE_RE.match(line)
        if not match:
            continue
        item_id = match.group(4)
        items.append(
            Item(
                line_idx=idx,
                item_id=item_id,
                level=len(item_id.split(".")),
                symbol=normalize_symbol(match.group(2)),
                prefix=match.group(1),
                sep=match.group(3),
                suffix=match.group(5),
            )
        )

    return lines, items


def build_indices(items: List[Item]) -> Tuple[Dict[str, List[Item]], Dict[str, List[str]]]:
    by_id: Dict[str, List[Item]] = {}
    top_to_subtasks: Dict[str, List[str]] = {}

    for item in items:
        by_id.setdefault(item.item_id, []).append(item)
        if item.level == 3:
            parent = top_id(item.item_id)
            top_to_subtasks.setdefault(parent, [])
            if item.item_id not in top_to_subtasks[parent]:
                top_to_subtasks[parent].append(item.item_id)

    return by_id, top_to_subtasks


def set_symbol(by_id: Dict[str, List[Item]], item_id: str, symbol: str) -> None:
    for item in by_id.get(item_id, []):
        item.symbol = symbol


def apply_success(case_id: str, by_id: Dict[str, List[Item]], top_to_subtasks: Dict[str, List[str]], errors: List[ValidationError]) -> None:
    if len(case_id.split(".")) != 2:
        errors.append(ValidationError(case_id, "", "CASE_ID_INVALID", f"success case `{case_id}` must be x.x"))
        return
    if case_id not in by_id:
        errors.append(ValidationError(case_id, "", "CASE_NOT_FOUND", f"success case `{case_id}` not found"))
        return

    set_symbol(by_id, case_id, "✓")
    for subtask_id in top_to_subtasks.get(case_id, []):
        set_symbol(by_id, subtask_id, "✓")


def apply_failure(
    case_id: str,
    fail_step: str,
    by_id: Dict[str, List[Item]],
    top_to_subtasks: Dict[str, List[str]],
    errors: List[ValidationError],
) -> None:
    if len(case_id.split(".")) != 2:
        errors.append(ValidationError(case_id, "", "CASE_ID_INVALID", f"failure case `{case_id}` must be x.x"))
        return
    if len(fail_step.split(".")) != 3:
        errors.append(ValidationError(case_id, "", "FAIL_STEP_INVALID", f"failure step `{fail_step}` must be x.x.x"))
        return
    if top_id(fail_step) != case_id:
        errors.append(ValidationError(case_id, "", "FAIL_STEP_SCOPE_INVALID", f"failure step `{fail_step}` is outside case `{case_id}`"))
        return
    if case_id not in by_id:
        errors.append(ValidationError(case_id, "", "CASE_NOT_FOUND", f"failure case `{case_id}` not found"))
        return
    if fail_step not in by_id:
        errors.append(ValidationError(case_id, "", "FAIL_STEP_NOT_FOUND", f"failure step `{fail_step}` not found"))
        return

    subtask_ids = top_to_subtasks.get(case_id, [])
    if fail_step not in subtask_ids:
        errors.append(ValidationError(case_id, "", "FAIL_STEP_ORDER_MISSING", f"failure step `{fail_step}` is not an ordered subtask of `{case_id}`"))
        return

    fail_index = subtask_ids.index(fail_step)
    set_symbol(by_id, case_id, "✗")
    for index, subtask_id in enumerate(subtask_ids):
        if index < fail_index:
            set_symbol(by_id, subtask_id, "✓")
        elif index == fail_index:
            set_symbol(by_id, subtask_id, "✗")
        else:
            set_symbol(by_id, subtask_id, " ")


def render(lines: List[str], items: List[Item]) -> str:
    output = lines[:]
    for item in items:
        output[item.line_idx] = f"{item.prefix}{item.symbol}{item.sep}{item.item_id}{item.suffix}"
    return "\n".join(output) + ("\n" if output else "")


def validate_and_apply(content: str, successes: List[str], failures: List[str], fail_steps: List[str]) -> Tuple[str, List[ValidationError]]:
    errors: List[ValidationError] = []

    if len(failures) != len(fail_steps):
        errors.append(ValidationError("global", "", "INPUT_MISMATCH", "--failures and --fail-steps must have the same number of items"))

    for case_id in sorted(set(successes) & set(failures)):
        errors.append(ValidationError(case_id, "", "INPUT_CONFLICT", f"case `{case_id}` cannot be both success and failure"))

    lines, items = parse_items(content)
    by_id, top_to_subtasks = build_indices(items)

    for case_id in successes:
        apply_success(case_id, by_id, top_to_subtasks, errors)

    for index, case_id in enumerate(failures):
        if index >= len(fail_steps):
            continue
        apply_failure(case_id, fail_steps[index], by_id, top_to_subtasks, errors)

    return render(lines, items), errors


def main() -> int:
    args = parse_args()
    try:
        task_path = resolve_path(args)
        next_content, errors = validate_and_apply(
            task_path.read_text(encoding="utf-8"),
            parse_csv(args.successes),
            parse_csv(args.failures),
            parse_csv(args.fail_steps),
        )
        if not errors:
            task_path.write_text(next_content, encoding="utf-8")
    except Exception as exc:  # noqa: BLE001 - CLI should report cleanly
        errors = [ValidationError("global", "", "APPLY_ERROR", str(exc))]

    if args.json:
        print(json.dumps([error.__dict__ for error in errors], ensure_ascii=False, indent=2))
    else:
        if not errors:
            print("E2E test results applied")
        else:
            for error in errors:
                print(f"{error.case}: {error.error_code}: {error.error_msg}")

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
