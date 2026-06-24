#!/usr/bin/env python3
"""
Validate X4 e2e_tests.md structure.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional


CHAPTER_RE = re.compile(r"^##\s+(\d+)\s+(.+?)\s*$")
TOP_TASK_RE = re.compile(r"^- \[([ xX✓✗])\]\s+(\d+)\.(\d+)\s+(.+?)\s*$")
ANY_CHECKBOX_RE = re.compile(r"^(\s*)- \[[^\]]+\]\s+(.+?)\s*$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate e2e_tests.md")
    parser.add_argument("change_name", nargs="?", help="Change name under openspec/changes/")
    parser.add_argument("--file", help="Path to e2e_tests.md")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    return parser.parse_args()


def resolve_path(args: argparse.Namespace) -> Path:
    if args.file:
        return Path(args.file)
    if not args.change_name:
        raise ValueError("change_name or --file is required")
    return Path("openspec/changes") / args.change_name / "e2e_tests.md"


def add_error(errors: List[Dict[str, str]], file: Path, line: Optional[int], code: str, msg: str) -> None:
    errors.append({
        "file": str(file),
        "line": "" if line is None else str(line),
        "error_code": code,
        "error_msg": msg,
    })


def validate(path: Path) -> List[Dict[str, str]]:
    errors: List[Dict[str, str]] = []
    if not path.exists():
        add_error(errors, path, None, "FILE_MISSING", f"File not found: {path}")
        return errors

    current_chapter: Optional[int] = None
    chapters: List[int] = []
    tasks: Dict[str, str] = {}
    top_index_by_chapter: Dict[int, List[int]] = defaultdict(list)

    for idx, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("# "):
            continue

        chapter = CHAPTER_RE.match(stripped)
        if chapter:
            current_chapter = int(chapter.group(1))
            chapters.append(current_chapter)
            continue

        checkbox = ANY_CHECKBOX_RE.match(line)
        if checkbox and current_chapter is None:
            add_error(errors, path, idx, "TASK_OUTSIDE_CHAPTER", "Checklist task appears before first chapter")
            continue

        task = TOP_TASK_RE.match(line)
        if task:
            chapter_no = int(task.group(2))
            task_no = int(task.group(3))
            task_id = f"{chapter_no}.{task_no}"
            if chapter_no != current_chapter:
                add_error(errors, path, idx, "TASK_CHAPTER_MISMATCH", f"Task {task_id} appears under chapter {current_chapter}")
            if task_id in tasks:
                add_error(errors, path, idx, "DUPLICATE_TASK", f"Duplicate task id {task_id}")
            tasks[task_id] = task.group(4).strip()
            top_index_by_chapter[chapter_no].append(task_no)
            continue

        if checkbox:
            add_error(errors, path, idx, "CHECKLIST_FORMAT_INVALID", "e2e_tests.md allows only top-level `- [ ] x.x ...` tasks")
            continue

        if stripped.startswith("##"):
            add_error(errors, path, idx, "CHAPTER_FORMAT_INVALID", "Chapter heading must be `## <number> <title>`")

    if not chapters:
        add_error(errors, path, None, "CHAPTER_MISSING", "At least one `## <number> <title>` chapter is required")
    if chapters != sorted(chapters) or len(chapters) != len(set(chapters)):
        add_error(errors, path, None, "CHAPTER_ORDER_INVALID", f"Chapter numbers must be unique ascending; got {chapters}")

    for chapter_no, numbers in top_index_by_chapter.items():
        expected = list(range(1, len(numbers) + 1))
        if numbers != expected:
            add_error(errors, path, None, "TASK_NUMBERING_INVALID", f"Chapter {chapter_no} task numbers must be contiguous {expected}; got {numbers}")

    return errors


def main() -> int:
    args = parse_args()
    try:
        errors = validate(resolve_path(args))
    except Exception as exc:  # noqa: BLE001
        errors = [{"file": "", "line": "", "error_code": "VALIDATOR_ERROR", "error_msg": str(exc)}]

    if args.json:
        print(json.dumps({"ok": not errors, "errors": errors}, ensure_ascii=False, indent=2))
    else:
        if not errors:
            print("e2e_tests.md is valid")
        else:
            for error in errors:
                loc = error["file"]
                if error["line"]:
                    loc += f":{error['line']}"
                print(f"{loc}: {error['error_code']}: {error['error_msg']}")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
