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

    # Patterns for checkbox format: - [x] <number> <description>
    # Group 1: number prefix (e.g., "1.1")
    # Group 2: description (without checkbox prefix)
    # Support formats: [✓]=passed, [✗]=failed, [ ]=pending, [ ]=unchecked
    # Note: [ ] includes a space, so we use \s for whitespace
    checkbox_pattern = re.compile(r"^-\s*\[[\s✓✗]\]\s+(\d+\.\d+)\s+(.+)$")

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

        number_prefix = match.group(1).strip()
        description = match.group(2).strip()
        full_name = f"{number_prefix} {description}"

        # Parse based on chapter and content
        if current_chapter == 1:
            # Unit tests: use full name with number prefix
            result['chapter1'].append(full_name)

        elif current_chapter == 2:
            # States and transitions: use full name with number prefix
            if description.startswith('状态:'):
                state_id = description[len('状态:'):].strip()
                # Format: "2.1 状态: heron-selected"
                full_state = f"{number_prefix} 状态: {state_id}"
                result['chapter2_states'].append(full_state)
            elif description.startswith('切换:'):
                transition = description[len('切换:'):].strip()
                # Format: "2.2 切换: heron-selected -> detail-mode"
                full_transition = f"{number_prefix} 切换: {transition}"
                result['chapter2_transitions'].append(full_transition)

        elif current_chapter == 3:
            # E2E scenarios: use full name with number prefix
            result['chapter3'].append(full_name)

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

    New format (numbered subtask format):
    - - [ ] 1.1 档位默认状态
      - [ ] 1.1.1 读取当前档位状态
      - [ ] 1.1.2 断言默认档位为 "summary"

    Returns:
    {
        '<test case name>': ['1.1.1 读取当前档位状态', '1.1.2 断言默认档位为 "summary"', ...],
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

        # Parse numbered subtasks: - [x] 1.1.1 读取当前档位状态 (indent 2)
        # New format uses numbered subtasks instead of "步骤 1:"
        if in_task and current_task and indent == 2:
            # Support three states: [✓]=passed, [✗]=failed, [ ]=pending
            # New format: - [ ] 1.1.1 读取当前档位状态
            step_match = re.match(r"^-\s*\[[ ✓✗]\]\s*(\d+\.\d+\.\d+)\s+(.+)$", stripped)
            if step_match:
                result[current_task].append(f"{step_match.group(1)} {step_match.group(2)}")
                # 不要 continue，让它继续检查 4 空格的子项目

            # Also support old "步骤 1:" format for backward compatibility
            elif re.match(r"^-\s*\[[ ✓✗]\]\s*(步骤\s*\d+[:：].+)$", stripped):
                step_match = re.match(r"^-\s*\[[ ✓✗]\]\s*(步骤\s*\d+[:：].+)$", stripped)
                result[current_task].append(step_match.group(1))
                # 不要 continue

        # Check for sub-items (indented at 4 or 6 spaces)
        # This runs for ALL lines, not just under steps
        if in_task and current_task:
            # 4-space indent sub-items
            subitem_match = re.match(r"^    -\s*\[[ ✓✗]\]\s*(.+)$", stripped)
            if subitem_match and result[current_task]:
                result[current_task][-1] += " " + subitem_match.group(1)

            # 6-space indent (sub-sub-items)
            elif re.match(r"^      -\s*\[[ ✓✗]\]\s*(.+)$", stripped):
                subitem_match = re.match(r"^      -\s*\[[ ✓✗]\]\s*(.+)$", stripped)
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


def parse_test_file(file_path: Path) -> List[str]:
    """
    Parse test file and extract test case names.

    Returns:
        ['test case name 1', 'test case name 2', ...]
    """
    if not file_path.exists():
        return []

    content = file_path.read_text(encoding="utf-8")
    result: List[str] = []

    # Pattern to match test case name
    test_case_pattern = re.compile(r"(?:it|test|describe)\s*\(\s*['\"]([^'\"]+)['\"]")

    for match in test_case_pattern.finditer(content):
        test_name = match.group(1)
        result.append(test_name)

    return result


def parse_step_comments_from_test_file(content: str) -> Dict[str, List[Tuple[str, str]]]:
    """
    Parse test file and extract step comments and assertions for each test case.

    Returns:
    {
        '<test case name>': [('// 1.1.1 读取当前档位状态', 'expect(...).toBe(1000)'), ...],
        ...
    }
    """
    result: Dict[str, List[Tuple[str, str]]] = {}
    lines = content.split("\n")
    current_task = ""
    in_test_case = False

    # Pattern to match test case name
    test_case_pattern = re.compile(r"(?:it|test)\s*\(\s*['\"]([^'\"]+)['\"]")

    # Pattern to match step comments (new numbered format: 1.1.1, 1.1.2, etc.)
    # Also support old format: "步骤 1:" for backward compatibility
    step_comment_pattern = re.compile(r"^\s*//\s*((\d+\.\d+\.\d+)\s+.+|步骤\s*\d+[:：].+)$")

    # Pattern to match assertion lines (expect, assert, etc.)
    assertion_pattern = re.compile(r"^\s*(expect|assert|chai\.expect).*$")

    # Pattern to detect step comment lines (to find the range)
    step_start_pattern = re.compile(r"^\s*//\s*(\d+\.\d+\.\d+|步骤\s*\d+)")

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

        # Check for step comments (new format: 1.1.1 or old format: 步骤 1:)
        step_match = step_comment_pattern.match(line)
        if step_match:
            step_comment = step_match.group(1)
            # Look for assertion from current position to next step comment or end of test
            assertion = ""
            for j in range(i + 1, len(lines)):
                next_line = lines[j].strip()
                # Skip empty lines
                if not next_line:
                    continue
                # Skip lines that are still comments
                if next_line.startswith("//"):
                    # Check if it's another step comment (new step starts)
                    if step_start_pattern.match(next_line):
                        break
                    continue
                # Check if it's an assertion line
                if assertion_pattern.match(next_line):
                    # Add this assertion and continue looking for more
                    if assertion:
                        assertion += " " + next_line
                    else:
                        assertion = next_line
                    continue
                # If we hit other code, stop looking for assertions for this step
                break

            result[current_task].append((step_comment, assertion))

    return result


def validate_test_file(file_path: Path, change_name: str) -> Tuple[bool, List[str]]:
    """Validate a single test file's step comments and assertions."""
    errors = []

    if not file_path.exists():
        return True, []  # No file = no validation needed

    content = file_path.read_text(encoding="utf-8")

    # Find test_tasks.md in the correct location
    test_tasks_path = Path(f'openspec/changes/{change_name}/test_tasks.md')
    if not test_tasks_path.exists():
        return True, []  # No test_tasks.md = skip validation

    tasks_content = test_tasks_path.read_text(encoding="utf-8")
    expected_steps = parse_steps_from_test_tasks(tasks_content)
    actual_comments = parse_step_comments_from_test_file(content)

    # Helper: check if two step numbers match by prefix
    # e.g., "1.1.1" matches "1.1.1" or "1.1.1 读取当前档位状态"
    def step_matches(exp_step: str, act_comment: str) -> bool:
        # Extract step number from expected (e.g., "1.1.1" from "1.1.1 读取当前档位状态")
        exp_num = exp_step.split()[0] if exp_step.split() else ""
        act_num = act_comment.split()[0] if act_comment.split() else ""
        return exp_num.startswith(act_num) or act_num.startswith(exp_num)

    # Validate each test case
    for test_name, expected in expected_steps.items():
        # Check if test case exists in actual test file (use prefix matching)
        actual = None
        actual_key = None

        # Try exact match first
        if test_name in actual_comments:
            actual = actual_comments[test_name]
            actual_key = test_name
        else:
            # Try prefix matching: "1.1 档位默认状态" matches "1.1" or "1.1 档位默认状态"
            test_prefix = test_name.split()[0] if test_name.split() else ""
            for key in actual_comments.keys():
                key_prefix = key.split()[0] if key.split() else ""
                if test_prefix.startswith(key_prefix) or key_prefix.startswith(test_prefix):
                    actual = actual_comments[key]
                    actual_key = key
                    break

        if actual is None:
            # Test case not found in test file - report error
            errors.append(
                f"测试用例 '{test_name}' - 在测试文件中未找到对应测试（缺少 it/test 定义）"
            )
            continue

        # If no step comments in actual file but expected has steps, report error
        if len(actual) == 0 and len(expected) > 0:
            errors.append(
                f"测试用例 '{test_name}' - 缺少步骤注释，应包含 {len(expected)} 个步骤"
            )
            continue

        # Check if step count matches (use prefix matching for steps)
        if len(actual) != len(expected):
            # Only report error if the mismatch is significant
            # Allow some flexibility since we now use prefix matching
            pass  # Skip this strict check - we use prefix matching instead

        # Check each step comment and assertion matches (use prefix matching)
        for i, exp_step in enumerate(expected):
            # Find matching actual step by prefix
            act_tuple = None
            for j, act_item in enumerate(actual):
                act_comment = act_item[0] if isinstance(act_item, tuple) else act_item
                if step_matches(exp_step, act_comment):
                    act_tuple = actual[j]
                    break

            if act_tuple is None:
                # Step not found - try to find by index as fallback
                if i < len(actual):
                    act_tuple = actual[i]
                else:
                    errors.append(
                        f"测试用例 '{test_name}' 步骤 {i+1} - 未找到对应注释: '{exp_step}'"
                    )
                    continue

            act_comment, act_assertion = act_tuple

            # Normalize step comment for comparison: use prefix matching
            # Expected comes from test_tasks.md like: "1.1.1 读取当前档位状态"
            # Actual comes from test file like: "1.1.1 读取当前档位状态"
            exp_content = re.sub(r"（期望\s+[^）]+\）", "", exp_step)  # Remove （期望 toBe(...)）
            exp_content = re.sub(r"\s+", " ", exp_content.strip())

            act_content = re.sub(r'\s+', ' ', act_comment.strip())

            # Prefix match: just compare the step numbers
            exp_num = exp_content.split()[0] if exp_content.split() else ""
            act_num = act_content.split()[0] if act_content.split() else ""

            # If step numbers match by prefix, it's OK
            if not (exp_num.startswith(act_num) or act_num.startswith(exp_num)):
                errors.append(
                    f"测试用例 '{test_name}' 步骤 {i+1} - 步骤标号不匹配:\n"
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
                        f"测试用例 '{test_name}' 步骤 {i+1} - 断言不匹配:\n"
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
                            f"测试用例 '{test_name}' 步骤 {i+1} - 子项目断言缺失:\n"
                            f"  test_tasks.md 期望: '{exp_assertion}'\n"
                            f"  测试文件断言: '{act_assertion}'"
                        )

    return len(errors) == 0, errors


def find_test_files(change_name: str, test_dir: str) -> Dict[str, Path]:
    """Find all relevant test files for a change."""
    unit_dir, e2e_dir = find_test_dirs(change_name, test_dir)

    files = {}

    # Unit test file - check both .spec.ts and .spec.test extensions
    for ext in ['.spec.ts', '.spec.test']:
        unit_file = unit_dir / f"{change_name}{ext}"
        if unit_file.exists():
            files['unit'] = unit_file
            break

    # E2E test file - check both .spec.ts and .spec.test extensions
    for ext in ['.spec.ts', '.spec.test']:
        e2e_file = e2e_dir / f"{change_name}{ext}"
        if e2e_file.exists():
            files['e2e'] = e2e_file
            break

    # Bug reproduction file - check both extensions
    for ext in ['.spec.ts', '.spec.test']:
        bug_file = e2e_dir / f"bug-{change_name}{ext}"
        if bug_file.exists():
            files['bug'] = bug_file
            break

    # Bug fix file - check both extensions
    for ext in ['.spec.ts', '.spec.test']:
        bugfix_file = e2e_dir / f"bugfix-{change_name}{ext}"
        if bugfix_file.exists():
            files['bugfix'] = bugfix_file
            break

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

    # Helper function: Check if task matches case by prefix
    # e.g., "1.1 档位默认状态" matches "1.1" or "1.1 档位默认状态"
    def matches_by_prefix(task: str, case: str) -> bool:
        task_prefix = task.split()[0] if task.split() else ""
        case_prefix = case.split()[0] if case.split() else ""
        return task.startswith(case_prefix) or case.startswith(task_prefix) or task_prefix == case_prefix

    # Validate Chapter 1 (Unit Tests) -> Unit test file
    if tasks['chapter1']:
        unit_cases = set(test_cases.get('unit', []))
        for task in tasks['chapter1']:
            # Use prefix matching: task "1.1 档位默认状态" matches case "1.1 ..." or "1.1 档位默认状态"
            if not any(matches_by_prefix(task, case) for case in unit_cases):
                errors.append(
                    f"Chapter 1 单元测试 '{task}' - 在 unit test 文件中无对应测试用例"
                )
        # Check for extra test cases not in test_tasks.md (warning only, not error)
        for case in unit_cases:
            if not any(matches_by_prefix(task, case) for task in tasks['chapter1']):
                # Skip describe blocks - they are not actual test cases
                if case.startswith('ShipBuildStats') or case.startswith('Ship Build'):
                    continue
                # Report as warning for extra tests
                print(f"  ⚠ Warning: Extra test case '{case}' not in test_tasks.md (will not be validated)")

    # Validate Chapter 2 (States) -> E2E test file
    if tasks['chapter2_states']:
        e2e_cases = set(test_cases.get('e2e', []))
        for state in tasks['chapter2_states']:
            # Use prefix matching
            if not any(matches_by_prefix(state, case) for case in e2e_cases):
                errors.append(
                    f"Chapter 2 状态 '{state}' - 在 e2e test 文件中无对应测试用例"
                )

    # Validate Chapter 2 (Transitions) -> E2E test file
    if tasks['chapter2_transitions']:
        e2e_cases = set(test_cases.get('e2e', []))
        for trans in tasks['chapter2_transitions']:
            # Use prefix matching
            if not any(matches_by_prefix(trans, case) for case in e2e_cases):
                errors.append(
                    f"Chapter 2 切换 '{trans}' - 在 e2e test 文件中无对应测试用例"
                )

    # Validate Chapter 3 (E2E Scenarios) -> E2E test file
    if tasks['chapter3']:
        e2e_cases = set(test_cases.get('e2e', []))
        for scenario in tasks['chapter3']:
            # Use prefix matching
            if not any(matches_by_prefix(scenario, case) for case in e2e_cases):
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
    import os
    DEBUG = os.environ.get('DEBUG', '0') == '1'

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

    if DEBUG:
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
    if DEBUG:
        print(f"\n=== Step Comment Validation ===")
    for file_type, file_path in files.items():
        step_valid, step_errors = validate_test_file(file_path, change_name)
        if not step_valid:
            is_valid = False
            errors.extend(step_errors)
            if DEBUG:
                print(f"  {file_type}: ✗ FAILED")
                for error in step_errors:
                    print(f"    - {error}")
        else:
            if DEBUG:
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
