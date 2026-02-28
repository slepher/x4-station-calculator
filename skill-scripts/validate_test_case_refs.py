#!/usr/bin/env python3
"""
Validate test case correspondence between test files and test_tasks.md.

Validates that every test case in test files has a corresponding test item in test_tasks.md.

Usage:
    python skill-scripts/validate_test_case_refs.py <change-name>
    python skill-scripts/validate_test_case_refs.py --change <change-name> --test-dir tests

Exit codes:
    0 - All validations pass
    1 - Validation failed with report
"""

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate test case correspondence between test files and test_tasks.md"
    )
    parser.add_argument(
        "change_name",
        nargs="?",
        help="Change name in openspec/changes/",
    )
    parser.add_argument(
        "--change",
        help="Change name (alias for positional argument)",
    )
    parser.add_argument(
        "--test-dir",
        default="tests",
        help="Test directory (default: tests)",
    )
    return parser.parse_args()


def find_test_tasks_path(change_name: str) -> Path:
    """Find test_tasks.md path from change name."""
    base_path = Path("openspec/changes") / change_name / "test_tasks.md"
    if base_path.exists():
        return base_path
    raise FileNotFoundError(f"test_tasks.md not found at {base_path}")


def find_test_dirs(change_name: str, test_dir: str) -> Tuple[Path, Path]:
    """Find unit and e2e test directories."""
    unit_dir = Path(test_dir) / "unit" / change_name
    e2e_dir = Path(test_dir) / "e2e" / change_name
    return unit_dir, e2e_dir


def parse_test_tasks(content: str) -> Dict[str, List[str]]:
    """
    Parse test_tasks.md and extract test items by chapter.

    Returns:
    {
        'chapter1': ['<test name>', ...],
        'chapter2_states': ['<state-id>', ...],
        'chapter2_transitions': ['<from> -> <to>', ...],
        'chapter3': ['<scenario name>', ...],
        'chapter4_bugs': ['BUG-<id> <description>', ...],
    }
    """
    result = {
        'chapter1': [],
        'chapter2_states': [],
        'chapter2_transitions': [],
        'chapter3': [],
        'chapter4_bugs': [],
    }

    lines = content.split("\n")
    current_chapter = 0

    # Patterns
    state_pattern = re.compile(r"^###\s*状态:\s*(.+)$")
    transition_pattern = re.compile(r"^###\s*切换:\s*(.+)$")
    bug_pattern = re.compile(r"^###\s*(BUG-\d+)\s+(.+)$")
    section_pattern = re.compile(r"^###\s+(.+)$")

    for line in lines:
        # Detect chapter headers
        if re.match(r"^##\s*\d+\s+单元测试", line):
            current_chapter = 1
            continue
        elif re.match(r"^##\s*\d+\s+E2E\s+标准状态与状态迁移", line):
            current_chapter = 2
            continue
        elif re.match(r"^##\s*\d+\s+E2E\s+测试场景", line):
            current_chapter = 3
            continue
        elif re.match(r"^##\s*\d+\s+Bug\s+测试", line):
            current_chapter = 4
            continue

        # Parse based on chapter
        if current_chapter == 1:
            # Unit tests - all ### sections
            match = section_pattern.match(line)
            if match:
                result['chapter1'].append(match.group(1).strip())

        elif current_chapter == 2:
            # States and transitions
            state_match = state_pattern.match(line)
            if state_match:
                result['chapter2_states'].append(state_match.group(1).strip())
                continue

            trans_match = transition_pattern.match(line)
            if trans_match:
                result['chapter2_transitions'].append(trans_match.group(1).strip())

        elif current_chapter == 3:
            # E2E scenarios
            match = section_pattern.match(line)
            if match:
                result['chapter3'].append(match.group(1).strip())

        elif current_chapter == 4:
            # Bug tests
            bug_match = bug_pattern.match(line)
            if bug_match:
                bug_id = bug_match.group(1).strip()
                desc = bug_match.group(2).strip()
                result['chapter4_bugs'].append(f"{bug_id} {desc}")

    return result


def parse_test_file(file_path: Path) -> List[str]:
    """Parse test file and extract test case names."""
    if not file_path.exists():
        return []

    content = file_path.read_text(encoding="utf-8")
    test_cases = []

    # Match describe() and it() test names
    # Pattern: describe('name', ...) or it('name', ...)
    describe_pattern = re.compile(r"(?:describe|context|it|test)\s*\(\s*['\"]([^'\"]+)['\"]")
    matches = describe_pattern.findall(content)
    test_cases.extend(matches)

    return test_cases


def find_test_files(change_name: str, test_dir: str) -> Dict[str, Path]:
    """Find all relevant test files for a change."""
    unit_dir, e2e_dir = find_test_dirs(change_name, test_dir)

    files = {}

    # Unit test file
    unit_file = unit_dir / f"{change_name}.spec.test"
    if unit_file.exists():
        files['unit'] = unit_file

    # E2E test file
    e2e_file = e2e_dir / f"{change_name}.spec.test"
    if e2e_file.exists():
        files['e2e'] = e2e_file

    # Bug reproduction file
    bug_file = e2e_dir / f"bug-{change_name}.spec.test"
    if bug_file.exists():
        files['bug'] = bug_file

    # Bug fix file
    bugfix_file = e2e_dir / f"bugfix-{change_name}.spec.test"
    if bugfix_file.exists():
        files['bugfix'] = bugfix_file

    return files


def validate_correspondence(
    change_name: str,
    test_dir: str,
    test_tasks_path: Path,
    files: Dict[str, Path],
) -> Tuple[bool, List[str]]:
    """Validate correspondence between test tasks and test files."""
    errors = []

    # Parse test_tasks.md
    content = test_tasks_path.read_text(encoding="utf-8")
    tasks = parse_test_tasks(content)

    # Parse test files
    test_cases = {}
    for file_type, file_path in files.items():
        test_cases[file_type] = parse_test_file(file_path)

    # Validate Chapter 1 (Unit Tests) -> Unit test file
    if tasks['chapter1']:
        unit_cases = set(test_cases.get('unit', []))
        for task in tasks['chapter1']:
            if task not in unit_cases:
                errors.append(
                    f"Chapter 1 单元测试 '{task}' - 在 unit test 文件中无对应测试用例"
                )
        # Check for extra test cases not in test_tasks.md
        for case in unit_cases:
            if case not in tasks['chapter1']:
                errors.append(
                    f"Unit test 测试用例 '{case}' - 在 test_tasks.md Chapter 1 中无对应项"
                )

    # Validate Chapter 2 (States) -> E2E test file
    if tasks['chapter2_states']:
        e2e_cases = set(test_cases.get('e2e', []))
        for state in tasks['chapter2_states']:
            # State can be referenced as "状态: <id>" or just "<id>"
            if state not in e2e_cases and f"状态: {state}" not in e2e_cases:
                errors.append(
                    f"Chapter 2 状态 '{state}' - 在 e2e test 文件中无对应测试用例"
                )

    # Validate Chapter 2 (Transitions) -> E2E test file
    if tasks['chapter2_transitions']:
        e2e_cases = set(test_cases.get('e2e', []))
        for trans in tasks['chapter2_transitions']:
            # Transition can be referenced as "切换: <from> -> <to>" or just the id
            if trans not in e2e_cases and f"切换: {trans}" not in e2e_cases:
                errors.append(
                    f"Chapter 2 切换 '{trans}' - 在 e2e test 文件中无对应测试用例"
                )

    # Validate Chapter 3 (E2E Scenarios) -> E2E test file
    if tasks['chapter3']:
        e2e_cases = set(test_cases.get('e2e', []))
        for scenario in tasks['chapter3']:
            if scenario not in e2e_cases:
                errors.append(
                    f"Chapter 3 E2E测试场景 '{scenario}' - 在 e2e test 文件中无对应测试用例"
                )

    # Validate Chapter 4 (Bug Tests) -> Bug and Bugfix test files
    if tasks['chapter4_bugs']:
        bug_cases = set(test_cases.get('bug', []))
        bugfix_cases = set(test_cases.get('bugfix', []))

        for bug in tasks['chapter4_bugs']:
            # Check if bug has test in bug reproduction file
            if bug not in bug_cases and f"BUG-" not in bug:
                # Try just the bug ID
                bug_id = bug.split()[0] if bug.split() else bug
                if bug_id not in bug_cases:
                    errors.append(
                        f"Chapter 4 Bug测试 '{bug}' - 在 bug-{change_name}.spec.test 文件中无对应测试用例"
                    )

            # Check if bug has test in bugfix file
            if bug not in bugfix_cases:
                bug_id = bug.split()[0] if bug.split() else bug
                if bug_id not in bugfix_cases:
                    errors.append(
                        f"Chapter 4 Bug测试 '{bug}' - 在 bugfix-{change_name}.spec.test 文件中无对应测试用例"
                    )

    return len(errors) == 0, errors


def main():
    args = parse_args()

    change_name = args.change_name or args.change
    if not change_name:
        print("Error: change_name must be provided")
        print(__doc__)
        sys.exit(1)

    try:
        test_tasks_path = find_test_tasks_path(change_name)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)

    files = find_test_files(change_name, args.test_dir)

    print(f"=== Test Case Correspondence Validation ===")
    print(f"Change: {change_name}")
    print(f"Test Tasks: {test_tasks_path}")
    print(f"\nFound test files:")
    for file_type, file_path in files.items():
        print(f"  - {file_type}: {file_path}")

    # Parse and display test_tasks.md items
    content = test_tasks_path.read_text(encoding="utf-8")
    tasks = parse_test_tasks(content)

    print(f"\nTest tasks from test_tasks.md:")
    print(f"  Chapter 1 (单元测试): {len(tasks['chapter1'])} items")
    for item in tasks['chapter1']:
        print(f"    - {item}")
    print(f"  Chapter 2 (状态): {len(tasks['chapter2_states'])} items")
    for item in tasks['chapter2_states']:
        print(f"    - 状态: {item}")
    print(f"  Chapter 2 (切换): {len(tasks['chapter2_transitions'])} items")
    for item in tasks['chapter2_transitions']:
        print(f"    - 切换: {item}")
    print(f"  Chapter 3 (E2E测试场景): {len(tasks['chapter3'])} items")
    for item in tasks['chapter3']:
        print(f"    - {item}")
    print(f"  Chapter 4 (Bug测试): {len(tasks['chapter4_bugs'])} items")
    for item in tasks['chapter4_bugs']:
        print(f"    - {item}")

    # Display test file cases
    print(f"\nTest cases from files:")
    for file_type, file_path in files.items():
        cases = parse_test_file(file_path)
        print(f"  {file_type} ({file_path.name}): {len(cases)} cases")
        for case in cases:
            print(f"    - {case}")

    is_valid, errors = validate_correspondence(change_name, args.test_dir, test_tasks_path, files)

    print(f"\n=== Validation Result ===")
    if is_valid:
        print("✓ PASS - All test cases have corresponding items in test_tasks.md")
        sys.exit(0)
    else:
        print("✗ FAIL - Validation errors found:")
        for error in errors:
            print(f"  {error}")
        sys.exit(1)


if __name__ == "__main__":
    main()
