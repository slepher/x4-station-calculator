#!/usr/bin/env python3
"""
Test Results Validation Script

Validates that test_tasks.md has been correctly updated after test execution,
matching the actual test run results (pass/fail) with the checkbox states.

Supports partial test runs - only validates the tests that were executed.

Format: [✓] for passed, [✗] for failed

Usage:
    # Full run - all tests executed
    python3 skill-scripts/validate_test_results.py <change-name> --passed <n> --failed <n> --failures "<failure1>,<failure2>,..."

    # Partial run - only some tests executed
    python3 skill-scripts/validate_test_results.py <change-name> --passed <n> --failed <n> --failures "<failure1>,<failure2>,..." --executed "1.1,1.2,2.1,3.1"

    # Example: ship-build-stat with 15 passed, 2 failed (1.3 and 3.5)
    python3 skill-scripts/validate_test_results.py ship-build-stat --passed 15 --failed 2 --failures "1.3,3.5"

    # Example: Only ran Chapter 1 and 2 tests
    python3 skill-scripts/validate_test_results.py ship-build-stat --passed 6 --failed 1 --failures "1.3" --executed "1.1,1.2,1.3,1.4,1.5,1.6,1.7,2.1,2.2"
"""

import sys
import re
import argparse
from pathlib import Path

def parse_args():
    parser = argparse.ArgumentParser(description='Validate test_tasks.md matches test execution results')
    parser.add_argument('change_name', help='Change name (e.g., ship-build-stat)')
    parser.add_argument('--passed', type=int, required=True, help='Number of passed tests')
    parser.add_argument('--failed', type=int, required=True, help='Number of failed tests')
    parser.add_argument('--failures', type=str, default='', help='Comma-separated list of failed test IDs (e.g., "1.3,3.5")')
    parser.add_argument('--executed', type=str, default='', help='Comma-separated list of executed test IDs (e.g., "1.1,1.2,2.1"). If empty, validates all tests.')
    return parser.parse_args()

def load_test_tasks(change_name: str) -> str:
    """Load test_tasks.md content."""
    base_path = Path(f'openspec/changes/{change_name}/test_tasks.md')
    if not base_path.exists():
        print(f"ERROR: test_tasks.md not found at {base_path}")
        sys.exit(1)
    return base_path.read_text(encoding='utf-8')

def extract_tasks(content: str) -> dict:
    """Extract all tasks with their checkbox status from test_tasks.md."""
    tasks = {}

    # Match checkbox lines: - [✓], - [✗], or - [ ]
    # Format: - [✓] 1.1 任务描述
    #         - [✗] 1.2 任务描述
    #         - [ ] 1.3 任务描述
    pattern = r'- \[([✓✗ ])\] (\d+\.\d+)\s+(.+?)(?=\n- \[|$)'

    for match in re.finditer(pattern, content, re.DOTALL):
        symbol = match.group(1).strip()
        if symbol == '✓':
            checked = True
        elif symbol == '✗':
            checked = False  # Failed = unchecked for test result purposes
        else:
            checked = None  # Not executed or pending

        task_id = match.group(2).strip()
        description = match.group(3).strip().split('\n')[0]  # First line only

        tasks[task_id] = {
            'checked': checked,
            'symbol': symbol,
            'description': description
        }

    return tasks

def extract_chapter5_lessons(content: str) -> dict:
    """Extract Chapter 5 (失败原因及可能的推断) lessons."""
    lessons = {}

    # Find Chapter 5 section
    chapter5_match = re.search(r'## 5 失败原因及可能的推断\s*\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
    if not chapter5_match:
        return lessons

    chapter5_content = chapter5_match.group(1)

    # Extract failed test lessons
    # Format: - [ ] <test-id> - <lesson>
    pattern = r'- \[([✓✗ ])\] (\d+\.[\d\w]+)\s*[-:]\s*(.+?)(?=\n- \[|$)'

    for match in re.finditer(pattern, chapter5_content, re.DOTALL):
        checked = match.group(1).strip() == '✓'
        test_id = match.group(2).strip()
        lesson = match.group(3).strip()

        lessons[test_id] = {
            'checked': checked,
            'lesson': lesson
        }

    return lessons

def validate_results(change_name: str, passed: int, failed: int, failure_ids: list, executed_ids: list) -> bool:
    """
    Validate that test_tasks.md checkbox states match the provided test results.

    Supports partial test runs - only validates the tests that were executed.

    Format: [✓] = passed, [✗] = failed, [ ] = pending/not executed

    Also validates Chapter 5 lessons for failed tests.

    Returns True if validation passes, False if there are mismatches.
    """
    content = load_test_tasks(change_name)
    tasks = extract_tasks(content)
    chapter5_lessons = extract_chapter5_lessons(content)

    if not tasks:
        print("ERROR: No tasks found in test_tasks.md")
        return False

    print(f"\n{'='*50}")
    print(f"Test Results Validation")
    print(f"{'='*50}")
    print(f"Change: {change_name}")
    print(f"Format: [✓]=passed, [✗]=failed, [ ]=pending")
    print(f"Reported: Passed={passed}, Failed={failed}")
    print(f"Failed IDs: {failure_ids}")
    if executed_ids:
        print(f"Executed IDs: {executed_ids}")

    # Count tasks in each state
    passed_count = sum(1 for t in tasks.values() if t['checked'] is True)
    failed_count = sum(1 for t in tasks.values() if t['checked'] is False)
    pending_count = sum(1 for t in tasks.values() if t['checked'] is None)

    print(f"\n{'='*50}")
    print(f"test_tasks.md Current Status")
    print(f"{'='*50}")
    print(f"Total tasks: {len(tasks)}")
    print(f"[✓] Passed: {passed_count}")
    print(f"[✗] Failed: {failed_count}")
    print(f"[ ] Pending: {pending_count}")

    # Chapter 5 status
    print(f"\n{'='*50}")
    print(f"Chapter 5 (失败原因及可能的推断) Status")
    print(f"{'='*50}")
    print(f"Lessons recorded: {len(chapter5_lessons)}")
    for test_id, lesson_info in sorted(chapter5_lessons.items()):
        status = "[✓]" if lesson_info['checked'] else "[ ]"
        print(f"  {test_id}: {status} {lesson_info['lesson'][:60]}")

    # Filter to executed tasks if specified
    if executed_ids:
        tasks_to_validate = {k: v for k, v in tasks.items() if k in executed_ids}
    else:
        tasks_to_validate = tasks

    executed_passed = sum(1 for t in tasks_to_validate.values() if t['checked'] is True)
    executed_failed = sum(1 for t in tasks_to_validate.values() if t['checked'] is False)

    print(f"\nTasks to validate: {len(tasks_to_validate)}")
    print(f"  [✓] Passed: {executed_passed}")
    print(f"  [✗] Failed: {executed_failed}")

    errors = []

    # For partial runs, only validate the executed tests
    if executed_ids:
        # Rule: Failed tests should be marked [✗]
        for fail_id in failure_ids:
            if fail_id in tasks_to_validate:
                if tasks_to_validate[fail_id]['checked'] is not False:
                    errors.append(f"FAILED test {fail_id} should be marked [✗] in test_tasks.md")

        # Report status of executed tests
        print(f"\n{'='*50}")
        print(f"Executed Test Status")
        print(f"{'='*50}")
        for task_id in sorted(tasks_to_validate.keys(), key=lambda x: [int(y) for y in x.split('.')]):
            symbol = tasks_to_validate[task_id]['symbol']
            expected = "PASS" if task_id not in failure_ids else "FAIL"
            actual_symbol = "[✓]" if tasks_to_validate[task_id]['checked'] is True else "[✗]" if tasks_to_validate[task_id]['checked'] is False else "[ ]"
            match = "✓" if (task_id not in failure_ids) == (tasks_to_validate[task_id]['checked'] is True) else "✗"
            print(f"  {match} {task_id}: {actual_symbol} (expected: {expected})")

        # Additional validation: if we know total passed/failed, check global consistency
        if executed_passed + executed_failed == len(tasks):
            # Full run - strict validation
            if executed_passed != passed:
                errors.append(f"Passed count mismatch: test_tasks.md has {executed_passed} [✓], but --passed={passed}")
            if executed_failed != failed:
                errors.append(f"Failed count mismatch: test_tasks.md has {executed_failed} [✗], but --failed={failed}")
    else:
        # Full run - strict validation
        if passed_count != passed:
            errors.append(f"Passed count mismatch: test_tasks.md has {passed_count} [✓], but --passed={passed}")
        if failed_count != failed:
            errors.append(f"Failed count mismatch: test_tasks.md has {failed_count} [✗], but --failed={failed}")

        # Check failed IDs are marked [✗]
        for fail_id in failure_ids:
            if fail_id in tasks:
                if tasks[fail_id]['checked'] is not False:
                    errors.append(f"FAILED test {fail_id} should be marked [✗] in test_tasks.md")
            else:
                # Try partial match
                found = False
                for task_id, task_info in tasks.items():
                    if task_id.startswith(fail_id):
                        found = True
                        if task_info['checked'] is not False:
                            errors.append(f"FAILED test {task_id} should be marked [✗] in test_tasks.md")
                        break
                if not found:
                    errors.append(f"Failed test ID {fail_id} not found in test_tasks.md")

    # ===== Chapter 5 Validation =====
    print(f"\n{'='*50}")
    print(f"Chapter 5 Validation (失败原因及可能的推断)")
    print(f"{'='*50}")

    # Check if failed tests have corresponding lessons in Chapter 5
    if failure_ids:
        missing_lessons = []
        for fail_id in failure_ids:
            # Try exact match or prefix match
            if fail_id not in chapter5_lessons:
                # Try partial match
                found = False
                for lesson_id in chapter5_lessons.keys():
                    if lesson_id.startswith(fail_id.split('.')[0]):
                        found = True
                        break
                if not found:
                    missing_lessons.append(fail_id)

        if missing_lessons:
            errors.append(f"Failed tests missing Chapter 5 lessons: {', '.join(missing_lessons)}")
        else:
            print(f"✓ All {len(failure_ids)} failed tests have corresponding Chapter 5 lessons")

        # Check that lessons have actual content (not empty)
        empty_lessons = []
        for fail_id in failure_ids:
            for lesson_id, lesson_info in chapter5_lessons.items():
                if lesson_id.startswith(fail_id.split('.')[0]) or lesson_id == fail_id:
                    if not lesson_info['lesson'].strip():
                        empty_lessons.append(lesson_id)
        if empty_lessons:
            errors.append(f"Chapter 5 lessons with empty content: {', '.join(empty_lessons)}")
    else:
        print("No failed tests to validate Chapter 5 lessons")

    # Show all task status
    print(f"\n{'='*50}")
    print(f"All Tasks Status")
    print(f"{'='*50}")
    for task_id in sorted(tasks.keys(), key=lambda x: [int(y) for y in x.split('.')]):
        symbol = tasks[task_id]['symbol']
        print(f"  {task_id}: [{symbol}] {tasks[task_id]['description'][:50]}")

    print(f"\n{'='*50}")
    if errors:
        print("✗ FAIL - Validation errors found:")
        for error in errors:
            print(f"  - {error}")
        return False
    else:
        print("✓ PASS - test_tasks.md correctly reflects test execution results")
        return True

def main():
    args = parse_args()

    # Parse failure IDs
    failure_ids = []
    if args.failures:
        failure_ids = [f.strip() for f in args.failures.split(',') if f.strip()]

    # Parse executed IDs
    executed_ids = []
    if args.executed:
        executed_ids = [e.strip() for e in args.executed.split(',') if e.strip()]

    success = validate_results(
        args.change_name,
        args.passed,
        args.failed,
        failure_ids,
        executed_ids
    )

    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
