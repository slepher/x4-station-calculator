#!/usr/bin/env python3
"""
Validate X4 e2e_tests.md and e2e_test_tasks.md structure and mapping.

Usage:
    python3 .trae/skills/x4-e2e-test-doc-details/scripts/validate_e2e_test_docs.py <change-name>
    python3 .trae/skills/x4-e2e-test-doc-details/scripts/validate_e2e_test_docs.py <change-name> --json
    python3 .trae/skills/x4-e2e-test-doc-details/scripts/validate_e2e_test_docs.py --tests path/e2e_tests.md --tasks path/e2e_test_tasks.md

Exit codes:
    0 - pass
    1 - fail
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple


CHAPTER_RE = re.compile(r"^##\s+(\d+)\s+(.+?)\s*$")
TOP_TASK_RE = re.compile(r"^- \[([ xX✓✗])\]\s+(\d+)\.(\d+)\s+(.+?)\s*$")
SUBTASK_RE = re.compile(r"^  - \[([ xX✓✗])\]\s+(\d+)\.(\d+)\.(\d+)\s+(.+?)\s*$")
ANY_CHECKBOX_RE = re.compile(r"^(\s*)- \[[^\]]+\]\s+(.+?)\s*$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate E2E test docs")
    parser.add_argument("change_name", nargs="?", help="Change name under openspec/changes/")
    parser.add_argument("--tests", help="Path to e2e_tests.md")
    parser.add_argument("--tasks", help="Path to e2e_test_tasks.md")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    return parser.parse_args()


def resolve_paths(args: argparse.Namespace) -> Tuple[Path, Path]:
    if args.tests or args.tasks:
        if not args.tests or not args.tasks:
            raise ValueError("--tests and --tasks must be provided together")
        return Path(args.tests), Path(args.tasks)
    if not args.change_name:
        raise ValueError("change_name or --tests/--tasks is required")
    base = Path("openspec/changes") / args.change_name
    return base / "e2e_tests.md", base / "e2e_test_tasks.md"


def normalize_desc(desc: str) -> str:
    desc = desc.strip()
    if desc.startswith("Task: "):
        desc = desc[len("Task: ") :].strip()
    return re.sub(r"\s+", " ", desc)


def add_error(errors: List[Dict[str, str]], file: Path, line: Optional[int], code: str, msg: str) -> None:
    errors.append(
        {
            "file": str(file),
            "line": "" if line is None else str(line),
            "error_code": code,
            "error_msg": msg,
        }
    )


def parse_doc(path: Path, *, allow_subtasks: bool) -> Tuple[List[Tuple[int, str]], Dict[str, str], Dict[str, List[str]], List[Dict[str, str]]]:
    errors: List[Dict[str, str]] = []
    chapters: List[Tuple[int, str]] = []
    tasks: Dict[str, str] = {}
    subtasks: Dict[str, List[str]] = defaultdict(list)
    current_chapter: Optional[int] = None
    seen_chapter_nums: List[int] = []
    top_index_by_chapter: Dict[int, List[int]] = defaultdict(list)
    sub_index_by_parent: Dict[str, List[int]] = defaultdict(list)

    if not path.exists():
        add_error(errors, path, None, "FILE_MISSING", f"File not found: {path}")
        return chapters, tasks, subtasks, errors

    lines = path.read_text(encoding="utf-8").splitlines()
    for idx, raw in enumerate(lines, 1):
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("# "):
            continue

        cm = CHAPTER_RE.match(stripped)
        if cm:
            current_chapter = int(cm.group(1))
            title = cm.group(2).strip()
            chapters.append((current_chapter, title))
            seen_chapter_nums.append(current_chapter)
            continue

        checkbox = ANY_CHECKBOX_RE.match(line)
        if checkbox and current_chapter is None:
            add_error(errors, path, idx, "TASK_OUTSIDE_CHAPTER", "Checklist task appears before first chapter")
            continue

        tm = TOP_TASK_RE.match(line)
        if tm:
            ch = int(tm.group(2))
            no = int(tm.group(3))
            desc = normalize_desc(tm.group(4))
            task_id = f"{ch}.{no}"
            if ch != current_chapter:
                add_error(errors, path, idx, "TASK_CHAPTER_MISMATCH", f"Task {task_id} appears under chapter {current_chapter}")
            if task_id in tasks:
                add_error(errors, path, idx, "DUPLICATE_TASK", f"Duplicate task id {task_id}")
            tasks[task_id] = desc
            top_index_by_chapter[ch].append(no)
            continue

        sm = SUBTASK_RE.match(line)
        if sm:
            ch = int(sm.group(2))
            parent_no = int(sm.group(3))
            sub_no = int(sm.group(4))
            desc = sm.group(5).strip()
            parent_id = f"{ch}.{parent_no}"
            if not allow_subtasks:
                add_error(errors, path, idx, "SUBTASK_FORBIDDEN", "e2e_tests.md must not contain subtasks")
            if ch != current_chapter:
                add_error(errors, path, idx, "SUBTASK_CHAPTER_MISMATCH", f"Subtask {parent_id}.{sub_no} appears under chapter {current_chapter}")
            subtasks[parent_id].append(desc)
            sub_index_by_parent[parent_id].append(sub_no)
            continue

        if checkbox:
            indent = len(checkbox.group(1))
            add_error(errors, path, idx, "CHECKLIST_FORMAT_INVALID", f"Invalid checklist format or indentation {indent}")
            continue

        if stripped.startswith("##"):
            add_error(errors, path, idx, "CHAPTER_FORMAT_INVALID", "Chapter heading must be `## <number> <title>`")

    if seen_chapter_nums != sorted(seen_chapter_nums) or len(seen_chapter_nums) != len(set(seen_chapter_nums)):
        add_error(errors, path, None, "CHAPTER_ORDER_INVALID", f"Chapter numbers must be unique ascending; got {seen_chapter_nums}")

    for ch, numbers in top_index_by_chapter.items():
        expected = list(range(1, len(numbers) + 1))
        if numbers != expected:
            add_error(errors, path, None, "TASK_NUMBERING_INVALID", f"Chapter {ch} task numbers must be contiguous {expected}; got {numbers}")

    for parent_id, numbers in sub_index_by_parent.items():
        expected = list(range(1, len(numbers) + 1))
        if numbers != expected:
            add_error(errors, path, None, "SUBTASK_NUMBERING_INVALID", f"{parent_id} subtask numbers must be contiguous {expected}; got {numbers}")

    return chapters, tasks, subtasks, errors


def validate(tests_path: Path, tasks_path: Path) -> List[Dict[str, str]]:
    errors: List[Dict[str, str]] = []
    tests_chapters, tests_tasks, tests_subtasks, test_errors = parse_doc(tests_path, allow_subtasks=False)
    task_chapters, task_tasks, task_subtasks, task_errors = parse_doc(tasks_path, allow_subtasks=True)
    errors.extend(test_errors)
    errors.extend(task_errors)

    if errors:
        return errors

    if tests_chapters != task_chapters:
        add_error(
            errors,
            tasks_path,
            None,
            "CHAPTER_MAPPING_INVALID",
            f"Chapter list must match e2e_tests.md; expected {tests_chapters}, got {task_chapters}",
        )

    for task_id, desc in tests_tasks.items():
        if task_id not in task_tasks:
            add_error(errors, tasks_path, None, "TASK_MAPPING_MISSING", f"Missing e2e_test_tasks.md task for {task_id}: {desc}")
            continue
        if task_tasks[task_id] != desc:
            add_error(
                errors,
                tasks_path,
                None,
                "TASK_DESCRIPTION_MISMATCH",
                f"{task_id} description mismatch; expected `{desc}`, got `{task_tasks[task_id]}`",
            )
        if not task_subtasks.get(task_id):
            add_error(errors, tasks_path, None, "TASK_DETAIL_MISSING", f"{task_id} must have at least one subtask in e2e_test_tasks.md")

    for task_id, desc in task_tasks.items():
        if task_id not in tests_tasks:
            add_error(errors, tasks_path, None, "TASK_MAPPING_EXTRA", f"Extra e2e_test_tasks.md task {task_id}: {desc}")

    if tests_subtasks:
        add_error(errors, tests_path, None, "TESTS_SUBTASKS_FORBIDDEN", "e2e_tests.md must contain top-level tasks only")

    return errors


def main() -> int:
    args = parse_args()
    try:
        tests_path, tasks_path = resolve_paths(args)
        errors = validate(tests_path, tasks_path)
    except Exception as exc:  # noqa: BLE001 - CLI should report cleanly
        errors = [{"file": "", "line": "", "error_code": "VALIDATOR_ERROR", "error_msg": str(exc)}]

    if args.json:
        print(json.dumps({"ok": not errors, "errors": errors}, ensure_ascii=False, indent=2))
    else:
        if not errors:
            print("E2E test docs are valid")
        else:
            for err in errors:
                loc = err["file"]
                if err["line"]:
                    loc += f":{err['line']}"
                print(f"{loc}: {err['error_code']}: {err['error_msg']}")

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
