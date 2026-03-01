#!/usr/bin/env python3
"""
Apply test run results into test_tasks.md.

Modes:
- change (default): update openspec/changes/<change>/test_tasks.md
- test: load --file and compare applied output with sibling test_tasks_run-*.md (no in-place write)

Output:
- --json: [{case, desc, error_code, error_msg}]
Exit code:
- 0 pass
- 1 fail
"""

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

LINE_RE = re.compile(r"^(\s*-\s*\[)([ ✓✗x])(\]\s*)(\d+(?:\.\d+){1,3})(\s+.*)$")


@dataclass
class Item:
    line_idx: int
    item_id: str
    level: int
    symbol: str
    prefix: str
    sep: str
    suffix: str
    raw_desc: str


@dataclass
class ValidationError:
    case: str
    desc: str
    error_code: str
    error_msg: str


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Apply test run results")
    p.add_argument("change_name", nargs="?", help="change name in change mode")
    p.add_argument("--mode", choices=["change", "test"], default="change")
    p.add_argument("--file", help="path to test_tasks-NN-*.md in mode=test")
    p.add_argument("--successes", default="", help="comma-separated success case ids (x.x)")
    p.add_argument("--failures", default="", help="comma-separated failed case ids (x.x)")
    p.add_argument("--fail-steps", default="", help="comma-separated failed marker ids (x.x.x or x.x.x.n)")
    p.add_argument("--json", action="store_true", help="output json errors")
    return p.parse_args()


def parse_csv(value: str) -> List[str]:
    return [x.strip() for x in value.split(",") if x.strip()]


def normalize_symbol(ch: str) -> str:
    if ch in ("✓", "x"):
        return "✓"
    if ch == "✗":
        return "✗"
    return " "


def to_top_id(item_id: str) -> str:
    seg = item_id.split(".")
    if len(seg) < 2:
        return item_id
    return f"{seg[0]}.{seg[1]}"


def resolve_paths(args: argparse.Namespace) -> Tuple[Path, Optional[Path]]:
    if args.mode == "test":
        if not args.file:
            raise ValueError("--file is required when --mode=test")
        task = Path(args.file)
        if not task.exists():
            raise FileNotFoundError(f"task file not found: {task}")
        m = re.match(r"^test_tasks-(\d{2}-[a-z0-9-]+)\.md$", task.name)
        if not m:
            raise ValueError("invalid task file name, expected test_tasks-NN-<case-name>.md")
        expected = task.parent / f"test_tasks_run-{m.group(1)}.md"
        return task, expected

    if not args.change_name:
        raise ValueError("change_name is required in change mode")
    task = Path("openspec/changes") / args.change_name / "test_tasks.md"
    if not task.exists():
        raise FileNotFoundError(f"task file not found: {task}")
    return task, None


def parse_items(content: str) -> Tuple[List[str], List[Item]]:
    lines = content.splitlines()
    items: List[Item] = []
    for idx, line in enumerate(lines):
        m = LINE_RE.match(line)
        if not m:
            continue
        item_id = m.group(4)
        items.append(Item(
            line_idx=idx,
            item_id=item_id,
            level=len(item_id.split(".")),
            symbol=normalize_symbol(m.group(2)),
            prefix=m.group(1),
            sep=m.group(3),
            suffix=m.group(5),
            raw_desc=m.group(5).strip(),
        ))
    return lines, items


def build_indices(items: List[Item]) -> Tuple[Dict[str, List[Item]], Dict[str, List[str]], Dict[str, List[str]]]:
    by_id: Dict[str, List[Item]] = {}
    top_to_l2: Dict[str, List[str]] = {}
    l2_to_l3: Dict[str, List[str]] = {}

    for it in items:
        by_id.setdefault(it.item_id, []).append(it)

        seg = it.item_id.split(".")
        if len(seg) == 3:
            top = f"{seg[0]}.{seg[1]}"
            top_to_l2.setdefault(top, [])
            if it.item_id not in top_to_l2[top]:
                top_to_l2[top].append(it.item_id)
        elif len(seg) == 4:
            parent = f"{seg[0]}.{seg[1]}.{seg[2]}"
            l2_to_l3.setdefault(parent, [])
            if it.item_id not in l2_to_l3[parent]:
                l2_to_l3[parent].append(it.item_id)

    return by_id, top_to_l2, l2_to_l3


def set_symbol(by_id: Dict[str, List[Item]], item_id: str, sym: str) -> None:
    for it in by_id.get(item_id, []):
        it.symbol = sym


def set_l2_subtree(by_id: Dict[str, List[Item]], l2_to_l3: Dict[str, List[str]], l2_id: str, sym_l2: str, sym_l3: str) -> None:
    set_symbol(by_id, l2_id, sym_l2)
    for c in l2_to_l3.get(l2_id, []):
        set_symbol(by_id, c, sym_l3)


def apply_success_case(case_id: str, by_id: Dict[str, List[Item]], top_to_l2: Dict[str, List[str]], l2_to_l3: Dict[str, List[str]], errors: List[ValidationError]) -> None:
    if case_id not in by_id:
        errors.append(ValidationError(case=case_id, desc="", error_code="CASE_NOT_FOUND", error_msg=f"success case `{case_id}` not found"))
        return
    if len(case_id.split(".")) != 2:
        errors.append(ValidationError(case=case_id, desc="", error_code="CASE_ID_INVALID", error_msg=f"success case `{case_id}` must be x.x"))
        return

    set_symbol(by_id, case_id, "✓")
    for l2 in top_to_l2.get(case_id, []):
        set_l2_subtree(by_id, l2_to_l3, l2, "✓", "✓")


def apply_failure_case(case_id: str, fail_marker: str, by_id: Dict[str, List[Item]], top_to_l2: Dict[str, List[str]], l2_to_l3: Dict[str, List[str]], errors: List[ValidationError]) -> None:
    if case_id not in by_id:
        errors.append(ValidationError(case=case_id, desc="", error_code="CASE_NOT_FOUND", error_msg=f"failure case `{case_id}` not found"))
        return
    if len(case_id.split(".")) != 2:
        errors.append(ValidationError(case=case_id, desc="", error_code="CASE_ID_INVALID", error_msg=f"failure case `{case_id}` must be x.x"))
        return
    if fail_marker not in by_id:
        errors.append(ValidationError(case=case_id, desc="", error_code="FAIL_MARKER_NOT_FOUND", error_msg=f"failure marker `{fail_marker}` not found"))
        return
    if to_top_id(fail_marker) != case_id:
        errors.append(ValidationError(case=case_id, desc="", error_code="FAIL_MARKER_SCOPE_INVALID", error_msg=f"failure marker `{fail_marker}` is outside case `{case_id}`"))
        return

    seg = fail_marker.split(".")
    level = len(seg)

    if level == 3:
        l2_list = top_to_l2.get(case_id, [])
        if fail_marker not in l2_list:
            errors.append(ValidationError(case=fail_marker, desc="", error_code="FAIL_MARKER_LEVEL_INVALID", error_msg=f"failure marker `{fail_marker}` must be case subtask id"))
            return
        idx = l2_list.index(fail_marker)
        set_symbol(by_id, case_id, "✗")
        for i, l2 in enumerate(l2_list):
            if i < idx:
                set_l2_subtree(by_id, l2_to_l3, l2, "✓", "✓")
            elif i == idx:
                set_l2_subtree(by_id, l2_to_l3, l2, "✗", " ")
            else:
                set_l2_subtree(by_id, l2_to_l3, l2, " ", " ")
        return

    if level == 4:
        parent = f"{seg[0]}.{seg[1]}.{seg[2]}"
        l2_list = top_to_l2.get(case_id, [])
        if parent not in l2_list:
            errors.append(ValidationError(case=fail_marker, desc="", error_code="FAIL_MARKER_LEVEL_INVALID", error_msg=f"failure marker `{fail_marker}` parent not found in case"))
            return
        l3_list = l2_to_l3.get(parent, [])
        if fail_marker not in l3_list:
            errors.append(ValidationError(case=fail_marker, desc="", error_code="FAIL_MARKER_LEVEL_INVALID", error_msg=f"failure marker `{fail_marker}` must be level-3 id"))
            return

        pidx = l2_list.index(parent)
        cidx = l3_list.index(fail_marker)
        set_symbol(by_id, case_id, "✗")

        for i, l2 in enumerate(l2_list):
            if i < pidx:
                set_l2_subtree(by_id, l2_to_l3, l2, "✓", "✓")
            elif i > pidx:
                set_l2_subtree(by_id, l2_to_l3, l2, " ", " ")
            else:
                set_symbol(by_id, l2, "✗")
                for j, c in enumerate(l3_list):
                    if j < cidx:
                        set_symbol(by_id, c, "✓")
                    elif j == cidx:
                        set_symbol(by_id, c, "✗")
                    else:
                        set_symbol(by_id, c, " ")
        return

    errors.append(ValidationError(case=fail_marker, desc="", error_code="FAIL_MARKER_LEVEL_INVALID", error_msg=f"failure marker `{fail_marker}` must be x.x.x or x.x.x.n"))


def render(lines: List[str], items: List[Item]) -> str:
    out = lines[:]
    for it in items:
        out[it.line_idx] = f"{it.prefix}{it.symbol}{it.sep}{it.item_id}{it.suffix}"
    return "\n".join(out) + ("\n" if out else "")


def validate_and_apply(content: str, successes: List[str], failures: List[str], fail_steps: List[str]) -> Tuple[str, List[ValidationError]]:
    errors: List[ValidationError] = []

    if len(failures) != len(fail_steps):
        errors.append(ValidationError(case="global", desc="", error_code="INPUT_MISMATCH", error_msg="--failures and --fail-steps must have the same number of items"))

    overlap = set(successes) & set(failures)
    for c in sorted(overlap):
        errors.append(ValidationError(case=c, desc="", error_code="INPUT_CONFLICT", error_msg=f"case `{c}` cannot be both success and failure"))

    lines, items = parse_items(content)
    by_id, top_to_l2, l2_to_l3 = build_indices(items)

    for c in successes:
        apply_success_case(c, by_id, top_to_l2, l2_to_l3, errors)

    for i, c in enumerate(failures):
        if i >= len(fail_steps):
            errors.append(ValidationError(case=c, desc="", error_code="FAIL_STEP_MISSING", error_msg=f"failure case `{c}` requires fail marker id"))
            continue
        apply_failure_case(c, fail_steps[i], by_id, top_to_l2, l2_to_l3, errors)

    return render(lines, items), errors


def main() -> None:
    args = parse_args()
    try:
        task_path, expected_path = resolve_paths(args)
    except Exception as e:
        payload = [ValidationError(case="global", desc="", error_code="PATH_RESOLVE_ERROR", error_msg=str(e))]
        if args.json:
            print(json.dumps([x.__dict__ for x in payload], ensure_ascii=False))
        else:
            print(f"Error: {e}")
        sys.exit(1)

    successes = parse_csv(args.successes)
    failures = parse_csv(args.failures)
    fail_steps = parse_csv(args.fail_steps)

    original = task_path.read_text(encoding="utf-8")
    updated, errors = validate_and_apply(original, successes, failures, fail_steps)

    if args.mode == "test" and len(errors) == 0:
        if expected_path is None or not expected_path.exists():
            errors.append(ValidationError(case="global", desc="", error_code="RUN_EXPECTED_FILE_MISSING", error_msg=f"expected run file not found: {expected_path}"))
        else:
            expected = expected_path.read_text(encoding="utf-8")
            if updated != expected:
                errors.append(ValidationError(
                    case="global",
                    desc=task_path.name,
                    error_code="RUN_OUTPUT_MISMATCH",
                    error_msg=f"applied output does not match expected file `{expected_path.name}`",
                ))

    if args.mode == "change" and len(errors) == 0:
        task_path.write_text(updated, encoding="utf-8")

    if args.json:
        print(json.dumps([x.__dict__ for x in errors], ensure_ascii=False))
    else:
        if errors:
            print("✗ FAIL - apply errors:")
            for e in errors:
                print(f"  [{e.error_code}] case={e.case} desc={e.desc} :: {e.error_msg}")
        else:
            print("✓ PASS - apply finished")

    sys.exit(0 if len(errors) == 0 else 1)


if __name__ == "__main__":
    main()
