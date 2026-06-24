#!/usr/bin/env python3
"""
Validate that e2e_test_tasks.md maps to Playwright E2E test cases.

Usage:
    python3 .trae/skills/x4-e2e-test-impl/scripts/validate_e2e_case_refs.py <change-name>
    python3 .trae/skills/x4-e2e-test-impl/scripts/validate_e2e_case_refs.py <change-name> --json
    python3 .trae/skills/x4-e2e-test-impl/scripts/validate_e2e_case_refs.py --tasks path/e2e_test_tasks.md --tests-dir tests/e2e/change
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


TOP_TASK_RE = re.compile(r"^- \[[ xX✓✗]\]\s+(\d+)\.(\d+)\s+(.+?)\s*$")
SUBTASK_RE = re.compile(r"^  - \[[ xX✓✗]\]\s+(\d+)\.(\d+)\.(\d+)\s+(.+?)\s*$")
TEST_RE = re.compile(r"\btest(?:\.(?:only|skip|fixme))?\s*\(\s*(['\"])(\d+\.\d+)\s+(.+?)\1", re.S)
SUBTASK_COMMENT_RE = re.compile(r"^\s*//\s+(\d+\.\d+\.\d+)\b(.*)$")


@dataclass
class Task:
    task_id: str
    desc: str
    line: int
    subtasks: Dict[str, Tuple[str, int]]


@dataclass
class TestCase:
    task_id: str
    desc: str
    path: Path
    line: int
    body: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate E2E task to Playwright case mapping")
    parser.add_argument("change_name", nargs="?", help="Change name under openspec/changes/")
    parser.add_argument("--tasks", help="Path to e2e_test_tasks.md")
    parser.add_argument("--tests-dir", help="Path to tests/e2e/<change-name>")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    return parser.parse_args()


def resolve_paths(args: argparse.Namespace) -> Tuple[Path, Path]:
    if args.tasks or args.tests_dir:
        if not args.tasks or not args.tests_dir:
            raise ValueError("--tasks and --tests-dir must be provided together")
        return Path(args.tasks), Path(args.tests_dir)
    if not args.change_name:
        raise ValueError("change_name or --tasks/--tests-dir is required")
    return Path("openspec/changes") / args.change_name / "e2e_test_tasks.md", Path("tests/e2e") / args.change_name


def add_error(errors: List[Dict[str, str]], file: Path, line: Optional[int], code: str, msg: str) -> None:
    errors.append(
        {
            "file": str(file),
            "line": "" if line is None else str(line),
            "error_code": code,
            "error_msg": msg,
        }
    )


def parse_tasks(path: Path) -> Tuple[Dict[str, Task], List[Dict[str, str]]]:
    errors: List[Dict[str, str]] = []
    tasks: Dict[str, Task] = {}
    current: Optional[Task] = None

    if not path.exists():
        add_error(errors, path, None, "TASK_FILE_MISSING", f"File not found: {path}")
        alt = path.with_name("test_e2e_tasks.md")
        if alt.exists():
            add_error(errors, alt, None, "TASK_FILE_NAME_INVALID", "Use canonical file name e2e_test_tasks.md")
        return tasks, errors

    for line_no, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.rstrip()
        top = TOP_TASK_RE.match(line)
        if top:
            task_id = f"{top.group(1)}.{top.group(2)}"
            desc = top.group(3).strip()
            if task_id in tasks:
                add_error(errors, path, line_no, "DUPLICATE_TASK", f"Duplicate task id {task_id}")
            current = Task(task_id=task_id, desc=desc, line=line_no, subtasks={})
            tasks[task_id] = current
            continue

        sub = SUBTASK_RE.match(line)
        if sub:
            sub_id = f"{sub.group(1)}.{sub.group(2)}.{sub.group(3)}"
            parent_id = f"{sub.group(1)}.{sub.group(2)}"
            if current is None or current.task_id != parent_id:
                add_error(errors, path, line_no, "SUBTASK_PARENT_INVALID", f"{sub_id} must appear under {parent_id}")
                continue
            current.subtasks[sub_id] = (sub.group(4).strip(), line_no)

    for task in tasks.values():
        if not task.subtasks:
            add_error(errors, path, task.line, "TASK_WITHOUT_SUBTASKS", f"{task.task_id} must have at least one subtask")

    return tasks, errors


def line_for_offset(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def parse_tests(tests_dir: Path) -> Tuple[Dict[str, List[TestCase]], List[Dict[str, str]]]:
    errors: List[Dict[str, str]] = []
    cases: Dict[str, List[TestCase]] = defaultdict(list)

    if not tests_dir.exists():
        add_error(errors, tests_dir, None, "TEST_DIR_MISSING", f"Directory not found: {tests_dir}")
        return cases, errors

    spec_files = sorted(tests_dir.rglob("*.spec.ts"))
    if not spec_files:
        add_error(errors, tests_dir, None, "TEST_FILE_MISSING", f"No *.spec.ts files under {tests_dir}")
        return cases, errors

    for path in spec_files:
        text = path.read_text(encoding="utf-8")
        matches = list(TEST_RE.finditer(text))
        for index, match in enumerate(matches):
            body_start = match.end()
            body_end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            task_id = match.group(2)
            case = TestCase(
                task_id=task_id,
                desc=match.group(3).strip(),
                path=path,
                line=line_for_offset(text, match.start()),
                body=text[body_start:body_end],
            )
            cases[task_id].append(case)

    return cases, errors


def comment_has_following_code(body: str, comment_line_index: int) -> bool:
    lines = body.splitlines()
    for line in lines[comment_line_index + 1 :]:
        stripped = line.strip()
        if not stripped:
            continue
        if re.fullmatch(r"[}\]);,]+", stripped):
            continue
        if stripped.startswith("//"):
            return False
        if stripped.startswith("test(") or stripped.startswith("test."):
            return False
        return True
    return False


def validate(tasks_path: Path, tests_dir: Path) -> List[Dict[str, str]]:
    errors: List[Dict[str, str]] = []
    tasks, task_errors = parse_tasks(tasks_path)
    cases, case_errors = parse_tests(tests_dir)
    errors.extend(task_errors)
    errors.extend(case_errors)
    if errors:
        return errors

    for task_id, task in tasks.items():
        matching_cases = cases.get(task_id, [])
        if not matching_cases:
            add_error(errors, tasks_path, task.line, "TEST_CASE_MISSING", f"Missing Playwright test case for task {task_id}")
            continue
        if len(matching_cases) > 1:
            locations = ", ".join(f"{case.path}:{case.line}" for case in matching_cases)
            add_error(errors, tasks_path, task.line, "TEST_CASE_DUPLICATE", f"Task {task_id} has multiple test cases: {locations}")
            continue

        case = matching_cases[0]
        comments: Dict[str, int] = {}
        for idx, line in enumerate(case.body.splitlines()):
            match = SUBTASK_COMMENT_RE.match(line)
            if match:
                comments[match.group(1)] = idx

        for subtask_id, (_, subtask_line) in task.subtasks.items():
            if subtask_id not in comments:
                add_error(
                    errors,
                    tasks_path,
                    subtask_line,
                    "SUBTASK_COMMENT_MISSING",
                    f"Missing `// {subtask_id}` marker in {case.path}:{case.line}",
                )
                continue
            if not comment_has_following_code(case.body, comments[subtask_id]):
                add_error(
                    errors,
                    case.path,
                    case.line,
                    "SUBTASK_COMMENT_WITHOUT_CODE",
                    f"`// {subtask_id}` must be followed by test action or assertion",
                )

        expected_subtasks = set(task.subtasks.keys())
        for comment_id in comments:
            if comment_id.startswith(task_id + ".") and comment_id not in expected_subtasks:
                add_error(errors, case.path, case.line, "SUBTASK_COMMENT_EXTRA", f"`// {comment_id}` is not defined in e2e_test_tasks.md")

    expected_cases = set(tasks.keys())
    for case_id, case_list in cases.items():
        if case_id not in expected_cases:
            for case in case_list:
                add_error(errors, case.path, case.line, "TEST_CASE_EXTRA", f"Test case {case_id} is not defined in e2e_test_tasks.md")

    return errors


def main() -> int:
    args = parse_args()
    try:
        tasks_path, tests_dir = resolve_paths(args)
        errors = validate(tasks_path, tests_dir)
    except Exception as exc:  # noqa: BLE001 - CLI should report cleanly
        errors = [{"file": "", "line": "", "error_code": "VALIDATOR_ERROR", "error_msg": str(exc)}]

    if args.json:
        print(json.dumps({"ok": not errors, "errors": errors}, ensure_ascii=False, indent=2))
    else:
        if not errors:
            print("E2E task to test mapping is valid")
        else:
            for err in errors:
                loc = err["file"]
                if err["line"]:
                    loc += f":{err['line']}"
                print(f"{loc}: {err['error_code']}: {err['error_msg']}")

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
