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

    Supports new checkbox format:
    - [x] 1.1 档位默认状态
    - [x] 2.1 状态: heron-selected
    - [x] 2.2 切换: heron-selected -> detail-mode
    - [x] 3.1 Case: 中列属性区双档位渲染

    Returns:
    {
        'chapter1': ['<test name>', ...],
        'chapter2_states': ['<state-id>', ...],
        'chapter2_transitions': ['<from> -> <to>', ...],
        'chapter3': ['<scenario name>', ...],
        'chapter4_bugs': ['BUG-<id> <description>', ...],
        'chapter5_failures': ['<failure description>', ...],
    }

    Note: Chapter 5 (失败原因及可能的推断) does NOT have corresponding test files.
    It is used to record test failures after runs, not for test implementation.
    """
    result = {
        'chapter1': [],
        'chapter2_states': [],
        'chapter2_transitions': [],
        'chapter3': [],
        'chapter4_bugs': [],
        'chapter5_failures': [],
    }

    lines = content.split("\n")
    current_chapter = 0

    # Patterns for new checkbox format: - [x] <number> <description>
    # Group 1: full description (without checkbox prefix)
    # Support three states: [✓]=passed, [✗]=failed, [ ]=pending
    checkbox_pattern = re.compile(r"^-\s*\[[ ✓✗]\]\s+\d+\.\d+\s+(.+)$")

    for line in lines:
        stripped = line.strip()

        # Detect chapter headers (support both ## 1 and ## 1. formats)
        if re.match(r"^##\s*\d+\.?\s*单元测试", stripped):
            current_chapter = 1
            continue
        elif re.match(r"^##\s*\d+\.?\s*E2E\s+标准状态与状态迁移", stripped):
            current_chapter = 2
            continue
        elif re.match(r"^##\s*\d+\.?\s*E2E\s+测试场景", stripped):
            current_chapter = 3
            continue
        elif re.match(r"^##\s*\d+\.?\s*Bug\s+测试", stripped):
            current_chapter = 4
            continue
        elif re.match(r"^##\s*\d+\.?\s*失败原因", stripped):
            current_chapter = 5
            continue

        # Skip if not in a valid chapter
        if current_chapter == 0:
            continue

        # Parse checkbox items
        match = checkbox_pattern.match(stripped)
        if not match:
            continue

        description = match.group(1).strip()

        # Parse based on chapter and content
        if current_chapter == 1:
            # Unit tests: just use the description as-is
            result['chapter1'].append(description)

        elif current_chapter == 2:
            # States and transitions: check prefix
            if description.startswith('状态:'):
                state_id = description[len('状态:'):].strip()
                result['chapter2_states'].append(state_id)
            elif description.startswith('切换:'):
                transition = description[len('切换:'):].strip()
                result['chapter2_transitions'].append(transition)

        elif current_chapter == 3:
            # E2E scenarios: use as-is (may have Case: prefix)
            result['chapter3'].append(description)

        elif current_chapter == 4:
            # Bug tests: extract bug id if present
            if description.startswith('Bug:'):
                # Format: "Bug: <description>" or could have ID
                bug_desc = description[len('Bug:'):].strip()
                result['chapter4_bugs'].append(bug_desc)
            else:
                result['chapter4_bugs'].append(description)

        elif current_chapter == 5:
            # Chapter 5: failures (for display only, not validated)
            result['chapter5_failures'].append(description)

    return result


def parse_steps_from_test_tasks(content: str) -> Dict[str, List[str]]:
    """
    Parse test_tasks.md and extract steps for each test case.

    New format (checkbox format):
    - - [ ] 1.1 档位默认状态
      - [ ] 步骤 1: xxx

    Returns:
    {
        '<test case name>': ['步骤 1: xxx', '步骤 2: xxx', ...],
        ...
    }
    """
    result: Dict[str, List[str]] = {}
    lines = content.split("\n")
    current_chapter = 0
    current_task = ""
    in_task = False

    # Detect chapter headers (support both ## 1 and ## 1. formats)
    for i, line in enumerate(lines):
        stripped = line.strip()

        if re.match(r"^##\s*\d+\.?\s*单元测试", stripped):
            current_chapter = 1
            in_task = False
            continue
        elif re.match(r"^##\s*\d+\.?\s*E2E\s+标准状态与状态迁移", stripped):
            current_chapter = 2
            in_task = False
            continue
        elif re.match(r"^##\s*\d+\.?\s*E2E\s+测试场景", stripped):
            current_chapter = 3
            in_task = False
            continue
        elif re.match(r"^##\s*\d+\.?\s*Bug\s+测试", stripped):
            current_chapter = 4
            in_task = False
            continue
        elif re.match(r"^##\s*\d+\.?\s*失败原因", stripped):
            current_chapter = 5
            in_task = False
            continue

        # Skip if not in valid chapter
        if current_chapter not in [1, 2, 3]:
            continue

        # Calculate indent
        indent = len(line) - len(line.lstrip())

        # Parse task names: - [x] 1.1 档位默认状态 or - [x] 2.1 状态: xxx
        # Also support: - [ ] (unchecked)
        # Support three states: [✓]=passed, [✗]=failed, [ ]=pending
        task_match = re.match(r"^-\s*\[[ ✓✗]\]\s*(\d+\.\d+)\s+(.+)$", stripped)
        if task_match and indent == 0:
            # Include the format prefix (状态:, 切换:, Case:, Bug:)
            current_task = f"{task_match.group(1)} {task_match.group(2)}"
            result[current_task] = []
            in_task = True
            continue

        # Parse steps: - [x] 步骤 1: xxx (indent 2)
        if in_task and current_task and indent == 2:
            # Support three states: [✓]=passed, [✗]=failed, [ ]=pending
            step_match = re.match(r"^-\s*\[[ ✓✗]\]\s*(步骤\s*\d+[:：].+)$", stripped)
            if step_match:
                result[current_task].append(step_match.group(1))
                continue

            # Check for sub-items (indented at 4 spaces under steps)
            # e.g., "    - [x] 引擎: engine_ter_m_allround_01_mk1 × 1"
            # OR with assertion: "    - [x] 船体: **16,100 MJ**（期望 toBe('16,100 MJ')）"
            # Support three states: [✓]=passed, [✗]=failed, [ ]=pending
            subitem_match = re.match(r"^    -\s*\[[ ✓✗]\]\s*(.+)$", stripped)
            if subitem_match and result[current_task]:
                # Append to last step
                result[current_task][-1] += " " + subitem_match.group(1)

    return result


def extract_subitem_assertions(step_content: str) -> List[str]:
    """
    Extract assertion expectations from step content.

    Looks for patterns like:
    - "（期望 toBe('16,100 MJ')）"
    - "(expected toBe(1000))"
    - "期望 toBe(...)"

    Returns list of assertion expectations found.
    """
    assertions = []

    # Pattern for Chinese: （期望 toBe(...)）
    cn_pattern = re.compile(r"（期望\s+(toBe\([^)]+\)|greaterThan\([^)]+\)|lessThan\([^)]+\)|toContain\([^)]+\)|toHaveCount\([^)]+\)|toEqual\([^)]+\)|toBeTruthy\(\)|toBeFalsy\(\))\)")
    # Pattern for parentheses assertion: (toBe(...))
    paren_pattern = re.compile(r"\(toBe\([^)]+\)|\(greaterThan\([^)]+\)|\(lessThan\([^)]+\)")

    for match in cn_pattern.finditer(step_content):
        assertions.append(match.group(1))

    for match in paren_pattern.finditer(step_content):
        assertions.append(match.group(0))

    return assertions


def parse_step_comments_from_test_file(content: str) -> Dict[str, List[Tuple[str, str]]]:
    """
    Parse test file and extract step comments and assertions for each test case.

    Returns:
    {
        '<test case name>': [('// 步骤 1: xxx', 'expect(...).toBe(1000)'), ...],
        ...
    }
    """
    result: Dict[str, List[Tuple[str, str]]] = {}
    lines = content.split("\n")
    current_task = ""
    in_test_case = False

    # Pattern to match test case name
    test_case_pattern = re.compile(r"(?:it|test)\s*\(\s*['\"]([^'\"]+)['\"]")

    # Pattern to match step comments
    step_comment_pattern = re.compile(r"^\s*//\s*(步骤\s*\d+[:：].+)$")

    # Pattern to match assertion lines (expect, assert, etc.)
    assertion_pattern = re.compile(r"^\s*(expect|assert|chai\.expect).*$")

    for i, line in enumerate(lines):
        # Check if this line defines a test case
        task_match = test_case_pattern.search(line)
        if task_match:
            current_task = task_match.group(1)
            result[current_task] = []
            in_test_case = True
            continue

        if not in_test_case or not current_task:
            continue

        # Check for step comments
        step_match = step_comment_pattern.match(line)
        if step_match:
            step_comment = step_match.group(1)
            # Look for assertion on the next line(s)
            assertion = ""
            for j in range(i + 1, min(i + 5, len(lines))):
                next_line = lines[j].strip()
                # Skip empty lines
                if not next_line:
                    continue
                # Skip lines that are still comments
                if next_line.startswith("//"):
                    continue
                # Check if it's an assertion line
                if assertion_pattern.match(next_line):
                    assertion = next_line
                    break
                # If we hit another step comment or code, stop looking
                break

            result[current_task].append((step_comment, assertion))

    return result


def validate_test_file(file_path: Path) -> Tuple[bool, List[str]]:
    """Validate a single test file's step comments."""
    errors = []

    if not file_path.exists():
        return True, []  # No file = no validation needed

    content = file_path.read_text(encoding="utf-8")

    # Find test_tasks.md in the same change directory
    test_tasks_path = file_path.parent.parent.parent / "test_tasks.md"
    if not test_tasks_path.exists():
        return True, []  # No test_tasks.md = skip validation

    tasks_content = test_tasks_path.read_text(encoding="utf-8")
    expected_steps = parse_steps_from_test_tasks(tasks_content)
    actual_comments = parse_step_comments_from_test_file(content)

    # Validate each test case
    for test_name, expected in expected_steps.items():
        if test_name not in actual_comments:
            # Check if there's a partial match (in case numbering is different)
            matching_cases = [k for k in actual_comments.keys() if test_name.split()[0] in k]
            if matching_cases:
                # Check if the test case exists but has no step comments
                if len(actual_comments[matching_cases[0]]) == 0 and len(expected) > 0:
                    errors.append(
                        f"测试用例 '{test_name}' - 缺少步骤注释，应包含 {len(expected)} 个步骤"
                    )
            continue

        actual = actual_comments[test_name]

        # Check if step count matches
        if len(actual) != len(expected):
            errors.append(
                f"测试用例 '{test_name}' - 步骤数量不匹配: "
                f"test_tasks.md 有 {len(expected)} 个步骤，测试文件有 {len(actual)} 个注释"
            )
            continue

        # Check each step comment and assertion matches
        for i, (exp_step, act_tuple) in enumerate(zip(expected, actual), 1):
            act_comment, act_assertion = act_tuple

            # Normalize step comment for comparison: remove checkbox markers [ ] [x] and extra spaces
            # Expected comes from test_tasks.md like: "步骤 1: 渲染已选飞船..."
            # Actual comes from test file like: "步骤 1: 渲染已选飞船..."
            # Also remove assertion expectations for step content comparison
            exp_content = re.sub(r"（期望\s+[^）]+\）", "", exp_step)  # Remove （期望 toBe(...)）
            exp_content = re.sub(r"\s+", " ", exp_content.strip())

            act_content = re.sub(r'\s+', ' ', act_comment.strip())

            # Full text match (not just step number)
            if exp_content != act_content:
                errors.append(
                    f"测试用例 '{test_name}' 步骤 {i} - 步骤内容不匹配:\n"
                    f"  test_tasks.md: '{exp_content}'\n"
                    f"  测试文件: '{act_content}'"
                )

            # Check main assertion matches (if test_tasks.md has assertion)
            # Look for assertion pattern in expected step (e.g., "toBe(1000)", "greaterThan(300)")
            assertion_match = re.search(r'(toBe\([^)]+\)|greaterThan\([^)]+\)|lessThan\([^)]+\)|toContain\([^)]+\)|toHaveCount\([^)]+\)|toEqual\([^)]+\)|toBeTruthy\(\)|toBeFalsy\(\)|toBeDefined\(\)|toBeUndefined\(\)|toBeNull\(\)|not\.toBe\([^)]+\)|not\.toContain\([^)]+\))', exp_step)
            if assertion_match:
                expected_assertion = assertion_match.group(1)
                # Check if actual assertion contains the expected assertion method with same value
                if expected_assertion not in act_assertion:
                    errors.append(
                        f"测试用例 '{test_name}' 步骤 {i} - 断言不匹配:\n"
                        f"  test_tasks.md 断言: '{expected_assertion}'\n"
                        f"  测试文件断言: '{act_assertion}'"
                    )

            # Check sub-item assertions (e.g., "    - [x] 船体: **16,100 MJ**（期望 toBe('16,100 MJ')）")
            subitem_assertions = extract_subitem_assertions(exp_step)
            if subitem_assertions:
                # Extract all assertions from the actual assertion block
                # The assertion block may contain multiple assertions for sub-items
                for exp_assertion in subitem_assertions:
                    if exp_assertion not in act_assertion:
                        errors.append(
                            f"测试用例 '{test_name}' 步骤 {i} - 子项目断言缺失:\n"
                            f"  test_tasks.md 期望: '{exp_assertion}'\n"
                            f"  测试文件断言: '{act_assertion}'"
                        )

    return len(errors) == 0, errors


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
    print(f"  Chapter 5 (失败原因及可能的推断): {len(tasks['chapter5_failures'])} items (无需验证，无对应测试文件)")

    # Display test file cases
    print(f"\nTest cases from files:")
    for file_type, file_path in files.items():
        cases = parse_test_file(file_path)
        print(f"  {file_type} ({file_path.name}): {len(cases)} cases")
        for case in cases:
            print(f"    - {case}")

    is_valid, errors = validate_correspondence(change_name, args.test_dir, test_tasks_path, files)

    # Validate step comments in each test file
    print(f"\n=== Step Comment Validation ===")
    for file_type, file_path in files.items():
        step_valid, step_errors = validate_test_file(file_path)
        if not step_valid:
            is_valid = False
            errors.extend(step_errors)
            print(f"  {file_type}: ✗ FAILED")
            for error in step_errors:
                print(f"    - {error}")
        else:
            print(f"  {file_type}: ✓ PASSED")

    print(f"\n=== Validation Result ===")
    if is_valid:
        print("✓ PASS - All validations passed")
        sys.exit(0)
    else:
        print("✗ FAIL - Validation errors found:")
        for error in errors:
            print(f"  {error}")
        sys.exit(1)


if __name__ == "__main__":
    main()
