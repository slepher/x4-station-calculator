#!/usr/bin/env python3
"""
Verify bug-task sync between bugs.md and test_tasks.md.

Single-source rule:
- Execution closure is determined by test_tasks.md only.
- bugs.md status is informational and is not used for gating.

This script scans all bugs in bugs.md and verifies that:
1. Each bug has a corresponding task in test_tasks.md Chapter 4
2. The corresponding task is marked as completed

Usage:
    python3 skill-scripts/verify_bug_sync.py <change-name> [--json]
"""

import argparse
import json
import re
import sys
from pathlib import Path


def parse_bugs_md(bugs_path: Path) -> dict:
    """Parse bugs.md and extract bug ids"""
    content = bugs_path.read_text(encoding='utf-8')

    bugs = {}
    id_pattern = re.compile(r'^- \*\*ID\*\*: (BUG-[A-Za-z0-9-]+)', re.MULTILINE)

    for match in id_pattern.finditer(content):
        bug_id = match.group(1)
        bugs[bug_id] = {}

    return bugs


def parse_test_tasks_md(tasks_path: Path) -> dict:
    """Parse test_tasks.md and extract bug tasks from Chapter 4"""
    if not tasks_path.exists():
        return {}

    content = tasks_path.read_text(encoding='utf-8')
    chapter_match = re.search(r'^## 4 Bug 测试\s*$', content, re.MULTILINE)
    if not chapter_match:
        return {}

    chapter_start = chapter_match.end()
    next_chapter = re.search(r'^## \d+', content[chapter_start:], re.MULTILINE)
    if next_chapter:
        chapter_content = content[chapter_start:chapter_start + next_chapter.start()]
    else:
        chapter_content = content[chapter_start:]

    bug_tasks = {}
    task_pattern = re.compile(r'^(\s*)- \[([ x✓])\] (\d+\.\d+) (BUG-[A-Za-z0-9-]+):', re.MULTILINE)

    for match in task_pattern.finditer(chapter_content):
        checkbox = match.group(2)
        task_num = match.group(3)
        bug_id = match.group(4)

        is_completed = checkbox == '✓'
        bug_tasks[bug_id] = {
            'task_num': task_num,
            'completed': is_completed,
            'line': match.group(0)
        }

    return bug_tasks


def main():
    parser = argparse.ArgumentParser(description='Verify bug-task sync between bugs.md and test_tasks.md')
    parser.add_argument('change_name', help='Change name (e.g., build-ship-equipment-panel)')
    parser.add_argument('--json', action='store_true', help='Output errors in JSON format')

    args = parser.parse_args()

    base_dir = Path(__file__).parent.parent
    change_dir = base_dir / 'openspec' / 'changes' / args.change_name
    bugs_path = change_dir / 'bugs.md'
    tasks_path = change_dir / 'test_tasks.md'

    if not bugs_path.exists():
        error = [{"case": "global", "desc": f"bugs.md not found at {bugs_path}", "error_code": "FILE_NOT_FOUND", "error_msg": str(bugs_path)}]
        if args.json:
            print(json.dumps(error))
        else:
            print(f"Error: bugs.md not found at {bugs_path}")
        sys.exit(1)

    bugs = parse_bugs_md(bugs_path)
    bug_tasks = parse_test_tasks_md(tasks_path)

    issues = []

    for bug_id in bugs.keys():
        if bug_id not in bug_tasks:
            issues.append({
                "case": bug_id,
                "desc": "bug has no corresponding task in test_tasks.md",
                "error_code": "MISSING_TASK",
                "error_msg": "no task found in Chapter 4"
            })
            continue

        task_info = bug_tasks[bug_id]
        if not task_info['completed']:
            issues.append({
                "case": bug_id,
                "desc": f"bug task {task_info['task_num']} is not completed",
                "error_code": "TASK_NOT_COMPLETED",
                "error_msg": f"task {task_info['task_num']} should be [✓]"
            })

    if args.json:
        print(json.dumps(issues))
    else:
        if issues:
            print(f"=== Issues Found: {len(issues)} ===")
            for issue in issues:
                print(f"  - {issue['case']}: {issue['desc']}")
            sys.exit(1)
        else:
            print("=== All bugs in sync ===")
            sys.exit(0)


if __name__ == '__main__':
    main()
