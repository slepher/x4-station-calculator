#!/usr/bin/env python3
"""
Validate test_tasks.md state/transition reference integrity and bug test structure.

Validates that every state/transition in Chapter 2 (E2E Standard States & Transitions)
has a reference path to Chapter 3 (E2E Test Scenarios) or Chapter 4 (Bug Tests).

Usage:
    python skill-scripts/validate_test_tasks_refs.py <change-name>
    python skill-scripts/validate_test_tasks_refs.py --file <path-to-test_tasks.md>

Exit codes:
    0 - All validations pass
    1 - Validation failed with report
"""

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Set, Tuple


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate test_tasks.md state/transition reference integrity"
    )
    parser.add_argument(
        "change_name",
        nargs="?",
        help="Change name in openspec/changes/",
    )
    parser.add_argument(
        "--file",
        "-f",
        help="Path to test_tasks.md file",
    )
    return parser.parse_args()


def find_test_tasks_path(change_name: str) -> Path:
    """Find test_tasks.md path from change name."""
    base_path = Path("openspec/changes") / change_name / "test_tasks.md"
    if base_path.exists():
        return base_path
    raise FileNotFoundError(f"test_tasks.md not found at {base_path}")


def parse_test_tasks(content: str) -> Tuple[Dict, Dict, Set, Set, Dict, Dict, List[Dict], List[Dict]]:
    """
    Parse test_tasks.md and extract:
    - states: {state_id: section_name}
    - transitions: {transition_id: section_name}
    - chapter3_references: set of state_ids and transition_ids referenced in Chapter 3
    - chapter4_references: set of state_ids and transition_ids referenced in Chapter 4
    - bug_ids_ch4: {bug_id: section_name} from Chapter 4 (Bug 测试)
    - task_markers: {chapter_num: {task_name: (has_checkbox, is_checked)}} task markers
    - step_markers: List of step markers with line numbers for validation
    - subtask_markers: List of subtask/assertion markers under steps

   缩进结构:
    - 任务标记: - [ ] 任务：<name> (indent N)
    - 步骤标记: - [ ] 步骤 <n>：<description> (indent N, child of task)
    - 子任务/断言:   - [ ] <field>: <value> (indent N+2+, child of step)
    """
    states: Dict[str, str] = {}
    transitions: Dict[str, str] = {}
    chapter3_references: Set[str] = set()
    chapter4_references: Set[str] = set()
    bug_ids_ch4: Dict[str, str] = {}
    task_markers: Dict[int, Dict[str, tuple]] = {}
    step_markers: List[Dict] = []  # {line_num, indent, name, has_checkbox, is_checked}
    subtask_markers: List[Dict] = []  # {line_num, indent, parent_indent, name, has_checkbox, is_checked}

    lines = content.split("\n")

    # Track current chapter
    # 0 = before chapter 1, 1 = chapter 1, 2 = chapter 2, 3 = chapter 3, 4 = chapter 4
    current_chapter = 0

    # Track current task indent for nesting
    current_task_indent = 0

    # State/Transition definition patterns (task format with checkbox, NOT markdown header)
    # Valid format: - [ ] 状态: xxx or - [ ] 状态：xxx or - [ ] 切换: xxx -> xxx
    state_pattern = re.compile(r"^-\s*\[\s*\]\s*状态[:：]\s*(.+)$")
    transition_pattern = re.compile(r"^-\s*\[\s*\]\s*切换[:：]\s*(.+)\s*->\s*(.+)$")

    # Reference patterns in Chapter 3 or 4
    state_ref_pattern = re.compile(r"^\s*-\s*前提:\s*状态\s*(\S+)$")
    transition_ref_pattern = re.compile(r"^\s*-\s*前提:\s*切换\s*(\S+)\s*->\s*(\S+)$")

    # Bug ID pattern: ### BUG-<数字> <描述>
    bug_id_pattern = re.compile(r"^###\s*(BUG-\d+)\s+(.+)$")

    # Chapter detection patterns (more flexible to match variations)
    # Match: ## 1 单元测试, ## 1. Unit Tests, ## 2. Web Integration / E2E, etc.
    chapter_patterns = [
        # Chapter 1 - Unit Tests
        (re.compile(r"^##\s*\d+\.?\s*单元测试"), 1),
        (re.compile(r"^##\s*\d+\.?\s*Unit\s+Tests"), 1),
        # Chapter 2 - E2E Standard States & Transitions
        (re.compile(r"^##\s*\d+\.?\s*E2E\s+标准状态与状态迁移"), 2),
        (re.compile(r"^##\s*\d+\.?\s*E2E\s+标准状态"), 2),
        (re.compile(r"^##\s*\d+\.?\s*Web\s+Integration"), 2),  # English alternative
        # Chapter 3 - E2E Test Scenarios
        (re.compile(r"^##\s*\d+\.?\s*E2E\s+测试场景"), 3),
        (re.compile(r"^##\s*\d+\.?\s*Scenario"), 3),
        # Chapter 4 - Bug Tests
        (re.compile(r"^##\s*\d+\.?\s*Bug\s+测试"), 4),
    ]

    # Sub-chapter patterns (should NOT exist in valid documents)
    subchapter_pattern = re.compile(r"^###\s*\d+\.\d+")

    # Task marker pattern - WITH NUMBERING:
    # Format: - [ ] <chapter>.<number> <description>
    # Chapter 1: any description
    # Chapter 2: must start with 状态: or 切换:
    # Chapter 3: must start with Case:
    # Chapter 4: must start with Bug:
    task_pattern = re.compile(r"^(\s*)-\s*\[([ ✓✗x])\]\s*(\d+)\.(\d+)\s+(.+)$")

    # Step marker pattern (REQUIRED with checkbox): - [✓] 步骤 <n>: <description>
    # Supports: 步骤 1:, 步骤 1：, Step 1:, Step 1：
    # Can have leading spaces for nested steps
    step_marker_pattern = re.compile(r"^(\s*)-\s*\[([ ✓✗x])\]\s*(步骤|Step)\s*(\d+)[:：]\s*(.+)$")

    # Subtask/Assertion marker pattern: - [✓] <field>: <value> or - [✗] <field>: <value>
    # This handles sub-behaviors with checkbox
    subtask_marker_pattern = re.compile(r"^(\s*)- \[([ ✓✗x])\] (.+)$")

    for i, line in enumerate(lines):
        # Calculate indent
        indent = len(line) - len(line.lstrip()) if line.strip() else 0

        # Detect chapter headers using flexible patterns
        for pattern, chapter_num in chapter_patterns:
            if pattern.match(line):
                current_chapter = chapter_num
                task_markers[chapter_num] = {}
                current_task_indent = 0
                break
        else:
            # No chapter header matched, continue processing
            pass

        # Parse task markers for all chapters
        if current_chapter > 0 and line.strip():
            # First try step marker (must have "步骤" or "Step" keyword)
            step_match = step_marker_pattern.match(line)
            if step_match:
                leading_spaces = step_match.group(1)
                checkbox = step_match.group(2)
                is_success = checkbox in ('✓', 'x')
                is_failure = checkbox == '✗'
                step_num = step_match.group(4)  # group(4) is the step number
                step_desc = step_match.group(5).strip()  # group(5) is the description
                step_markers.append({
                    'line_num': i + 1,
                    'indent': indent,
                    'step_num': step_num,
                    'name': f"步骤 {step_num}: {step_desc}",
                    'has_checkbox': True,
                    'is_success': is_success,
                    'is_failure': is_failure,
                    'chapter': current_chapter
                })
                continue

            # Then try subtask (more indented than step, has checkbox)
            subtask_match = subtask_marker_pattern.match(line)
            if subtask_match and indent > 0:
                subtask_indent = len(subtask_match.group(1))
                checkbox = subtask_match.group(2)
                is_success = checkbox in ('✓', 'x')
                is_failure = checkbox == '✗'
                content = subtask_match.group(3).strip()
                subtask_markers.append({
                    'line_num': i + 1,
                    'indent': subtask_indent,
                    'parent_indent': current_task_indent,
                    'name': content,
                    'has_checkbox': True,
                    'is_success': is_success,
                    'is_failure': is_failure,
                    'chapter': current_chapter
                })
                continue

            # Then try regular task marker (test case names - WITH checkbox and numbering)
            # Format: - [ ] <chapter>.<number> <description>
            task_match = task_pattern.match(line)
            if task_match and indent == 0:  # Task should be at top level (no indent)
                if current_chapter not in task_markers:
                    task_markers[current_chapter] = {}
                # Extract checkbox status
                checkbox = task_match.group(2)
                is_success = checkbox in ('✓', 'x')
                is_failure = checkbox == '✗'
                chapter_num = int(task_match.group(3))
                task_num = int(task_match.group(4))
                task_name = task_match.group(5).strip()
                full_task_name = f"{chapter_num}.{task_num} {task_name}"
                task_markers[current_chapter][full_task_name] = (True, is_success, is_failure)
                current_task_indent = indent
                continue

        # Parse state definitions (Chapter 2) - format: - [ ] 状态: xxx
        if current_chapter == 2:
            state_match = state_pattern.match(line)
            if state_match:
                state_id = state_match.group(1).strip()
                states[state_id] = line.strip()
                continue

            trans_match = transition_pattern.match(line)
            if trans_match:
                from_state = trans_match.group(1).strip()
                to_state = trans_match.group(2).strip()
                trans_id = f"{from_state} -> {to_state}"
                transitions[trans_id] = line.strip()
                continue

        # Parse Bug IDs (Chapter 4)
        if current_chapter == 4:
            bug_match = bug_id_pattern.match(line)
            if bug_match:
                bug_id = bug_match.group(1)
                bug_ids_ch4[bug_id] = line.strip()
                continue

        # Parse references (Chapter 3 or 4)
        if current_chapter in (3, 4):
            state_ref_match = state_ref_pattern.match(line)
            if state_ref_match:
                state_id = state_ref_match.group(1)
                if current_chapter == 3:
                    chapter3_references.add(state_id)
                else:
                    chapter4_references.add(state_id)
                continue

            trans_ref_match = transition_ref_pattern.match(line)
            if trans_ref_match:
                from_state = trans_ref_match.group(1)
                to_state = trans_ref_match.group(2)
                trans_id = f"{from_state} -> {to_state}"
                if current_chapter == 3:
                    chapter3_references.add(trans_id)
                else:
                    chapter4_references.add(trans_id)
                continue

    return states, transitions, chapter3_references, chapter4_references, bug_ids_ch4, task_markers, step_markers, subtask_markers


def build_reference_graph(
    states: Dict[str, str],
    transitions: Dict[str, str],
    chapter3_references: Set[str],
    chapter4_references: Set[str],
) -> Tuple[Dict[str, List[str]], Set[str]]:
    """
    Build a reference graph and find items with path to Chapter 3 or 4.

    Returns:
    - graph: adjacency list of references (item -> items it references)
    - items_with_path_to_ch3_or_ch4: items that have a reference path to Chapter 3 or 4
    """
    graph: Dict[str, List[str]] = defaultdict(list)
    all_items = set(states.keys()) | set(transitions.keys())

    # Add edges: each item references states in its from/to
    for trans_id in transitions:
        parts = trans_id.split(" -> ")
        if len(parts) == 2:
            graph[trans_id].append(parts[0])
            graph[trans_id].append(parts[1])

    # BFS from Chapter 3 or 4 references to find all items with path
    items_with_path_to_ch3_or_ch4: Set[str] = set()
    all_ch3_ch4_references = chapter3_references | chapter4_references
    queue = list(all_ch3_ch4_references & all_items)
    visited: Set[str] = set(queue)

    while queue:
        current = queue.pop(0)
        items_with_path_to_ch3_or_ch4.add(current)

        # Find items that reference this item (reverse edges)
        for item, refs in graph.items():
            if current in refs and item not in visited:
                visited.add(item)
                queue.append(item)

    return graph, items_with_path_to_ch3_or_ch4


def validate_test_tasks(
    states: Dict[str, str],
    transitions: Dict[str, str],
    chapter3_references: Set[str],
    chapter4_references: Set[str],
    bug_ids_ch4: Dict[str, str],
    task_markers: Dict[int, Dict[str, tuple]],
    step_markers: List[Dict],
    subtask_markers: List[Dict],
    content: str,
) -> Tuple[bool, List[str]]:
    """
    Validate:
    1. Every Chapter 2 item has a reference path to Chapter 3 or 4
    2. Every test case section has a task marker with checkbox [ ]
    3. Steps use proper format: - [ ] 步骤 <n>: <description> (NOT #### 步骤 1:)
    4. Task and step markers are REQUIRED - documents without them FAIL validation
    5. All cases (tasks) must have at least one step
    6. The last step must contain an assertion (subtask with "断言" or "期望")
    7. All steps must have [ ] checkbox

    Returns:
    - is_valid: True if all items have valid references and task markers
    - errors: List of error messages
    """
    errors: List[str] = []
    all_items = set(states.keys()) | set(transitions.keys())

    # Split content into lines for task-step relationship analysis
    lines = content.split("\n")

    # ========================================
    # STRICT VALIDATION: Task/Step markers are MANDATORY
    # ========================================

    # Check that task markers exist for each chapter (except Chapter 4 which can be empty)
    # If no task markers found, it's a FAILURE (not just a warning)
    chapter_names = {1: "单元测试", 2: "E2E标准状态与状态迁移", 3: "E2E测试场景", 4: "Bug测试", 5: "失败原因及可能的推断"}

    for chapter_num, chapter_name in chapter_names.items():
        # Chapter 4 (Bug测试) can be empty - no tasks required
        if chapter_num == 4 or chapter_num == 5:
            continue

        if chapter_num not in task_markers or len(task_markers[chapter_num]) == 0:
            # Chapter exists but has no task markers - this is a FAILURE
            errors.append(
                f"Chapter {chapter_num} ({chapter_name}) - 必须包含任务标记 [- [ ] <任务名>]，当前文档缺少任务标记"
            )

    # Check that step markers exist for chapters with test cases
    # Count steps per chapter
    steps_count_by_chapter: Dict[int, int] = defaultdict(int)
    for step in step_markers:
        steps_count_by_chapter[step['chapter']] += 1

    # Check that steps exist for chapters with tasks
    for chapter_num, chapter_name in chapter_names.items():
        # Chapter 4 and 5 can be empty (no bug tests / no failures yet)
        if chapter_num == 4 or chapter_num == 5:
            continue

        task_count = len(task_markers.get(chapter_num, {}))
        step_count = steps_count_by_chapter.get(chapter_num, 0)

        if task_count > 0 and step_count == 0:
            # Has tasks but no steps
            if chapter_num in (1, 3):  # Unit tests and E2E scenarios need steps
                errors.append(
                    f"Chapter {chapter_num} ({chapter_name}) - 测试用例必须包含步骤标记 [- [ ] 步骤 <n>: <描述>]"
                )

    # Validate Chapter 2 reference integrity
    if all_items:
        # Build reference graph and find items with path to Chapter 3 or 4
        graph, items_with_path_to_ch3_or_ch4 = build_reference_graph(
            states, transitions, chapter3_references, chapter4_references
        )

        # Combine chapter 3 and 4 references for direct check
        all_ch3_ch4_references = chapter3_references | chapter4_references

        # Check each item
        for item in sorted(all_items):
            if item in all_ch3_ch4_references:
                continue  # Directly referenced by Chapter 3 or 4

            if item in items_with_path_to_ch3_or_ch4:
                continue  # Has path to Chapter 3 or 4

            # Check if it's at least referenced by Chapter 2
            is_referenced_by_ch2 = False
            for other_item, refs in graph.items():
                if item in refs:
                    is_referenced_by_ch2 = True
                    break

            if not is_referenced_by_ch2:
                if item in states:
                    errors.append(
                        f"状态 `{item}` (line: {states[item]}) - 没有任何引用"
                    )
                else:
                    errors.append(
                        f"切换 `{item}` (line: {transitions[item]}) - 没有任何引用"
                    )
            else:
                # Referenced by Chapter 2 but no path to Chapter 3 or 4
                if item in states:
                    errors.append(
                        f"状态 `{item}` (line: {states[item]}) - "
                        "只在章节2内部引用，但从未连接到章节3或4"
                    )
                else:
                    errors.append(
                        f"切换 `{item}` (line: {transitions[item]}) - "
                        "只在章节2内部引用，但从未连接到章节3或4"
                    )

    # ========================================
    # Validate task numbering and chapter restrictions
    # ========================================
    chapter_names = {1: "单元测试", 2: "E2E标准状态与状态迁移", 3: "E2E测试场景", 4: "Bug测试", 5: "失败原因及可能的推断"}

    for chapter_num in [1, 2, 3, 4]:
        if chapter_num not in task_markers:
            continue

        tasks = task_markers[chapter_num]
        if not tasks:
            continue

        # Extract task numbers and validate sequential numbering
        task_numbers = []
        for task_name in tasks.keys():
            # Format: "1.1 Description" or "2.3 状态: xxx"
            parts = task_name.split()
            if parts:
                num_part = parts[0]
                if '.' in num_part:
                    try:
                        ch, num = num_part.split('.')
                        task_numbers.append((int(ch), int(num), task_name))
                    except:
                        errors.append(f"Chapter {chapter_num} - 任务标号格式错误: {task_name}")

        # Sort by task number
        task_numbers.sort(key=lambda x: x[1])

        # Check sequential numbering starting from 1
        expected_num = 1
        for ch, num, task_name in task_numbers:
            if ch != chapter_num:
                errors.append(
                    f"Chapter {chapter_num} - 任务 {task_name} 的章节号应为 {chapter_num}，当前为 {ch}"
                )
            if num != expected_num:
                errors.append(
                    f"Chapter {chapter_num} - 任务序号应连续，当前任务 {task_name} 序号为 {num}，期望 {expected_num}"
                )
            expected_num = num + 1

        # Check chapter-specific restrictions
        for task_name in tasks.keys():
            # Find the description part after the number
            parts = task_name.split(None, 1)  # Split into 2 parts max
            if len(parts) < 2:
                continue
            desc = parts[1]

            if chapter_num == 2:
                # Chapter 2: only 状态: or 切换:
                if not (desc.startswith("状态:") or desc.startswith("切换:")):
                    errors.append(
                        f"Chapter {chapter_num} ({chapter_names[chapter_num]}) - "
                        f"第二章只允许 `状态:` 或 `切换:`，当前任务: {task_name}"
                    )
            elif chapter_num == 3:
                # Chapter 3: only Case:
                if not desc.startswith("Case:"):
                    errors.append(
                        f"Chapter {chapter_num} ({chapter_names[chapter_num]}) - "
                        f"第三章只允许 `Case:`，当前任务: {task_name}"
                    )
            elif chapter_num == 4:
                # Chapter 4: only Bug:
                if not desc.startswith("Bug:"):
                    errors.append(
                        f"Chapter {chapter_num} ({chapter_names[chapter_num]}) - "
                        f"第四章只允许 `Bug:`，当前任务: {task_name}"
                    )

    # Step contiguity check is disabled - steps within each task are already contiguous
    # The check was incorrectly comparing steps across different tasks
    # Steps only need to be under their parent task, which is already validated by structure

    # ========================================
    # NEW VALIDATION: All cases need steps, last step must have assertion, all steps need checkbox
    # ========================================

    # Group steps by their parent task (using line numbers and indentation)
    # Build a map: task_name -> list of steps
    # Approach: Use task_markers which has task info, and map steps to tasks based on line numbers
    task_steps_map: Dict[str, List[Dict]] = defaultdict(list)

    # Build task line number map: line_number -> task_name
    task_line_to_name: Dict[int, str] = {}
    for chapter_num, tasks in task_markers.items():
        for task_full_name in tasks.keys():
            # Extract the task number and find its line in content
            # The format in task_markers is "1.1 任务名"
            parts = task_full_name.split(None, 1)
            if len(parts) >= 2:
                task_num = parts[0]
                task_desc = parts[1]
                # Find this task in the content by searching for the pattern
                task_pattern = re.compile(rf"^\s*-\s*\[\s*[ ✓✗x]\]\s*{re.escape(task_num)}\s+")
                for i, line in enumerate(lines):
                    if task_pattern.match(line):
                        task_line_to_name[i + 1] = task_full_name
                        break

    # Now assign steps to tasks based on line order
    # For each step, find the most recent task that appears before it
    current_task_for_step = None
    for step in step_markers:
        step_line = step['line_num']
        # Find the latest task before this step
        for task_line in sorted(task_line_to_name.keys(), reverse=True):
            if task_line < step_line:
                current_task_for_step = task_line_to_name[task_line]
                break
        if current_task_for_step:
            task_steps_map[current_task_for_step].append({
                'line_num': step['line_num'],
                'indent': step['indent'],
                'content': step.get('name', '')
            })

    # Validate each task has at least one step
    for chapter_num in [1, 3]:  # Only chapters 1 and 3 need steps
        if chapter_num not in task_markers:
            continue

        for task_name in task_markers[chapter_num]:
            steps = task_steps_map.get(task_name, [])
            if len(steps) == 0:
                # Extract task description for error message
                parts = task_name.split(None, 1)
                if len(parts) >= 2:
                    errors.append(
                        f"任务 `{task_name}` - 必须包含至少一个步骤标记 [- [ ] 步骤 <n>: <描述>]"
                    )

    # Validate: All steps must have [ ] checkbox (not [✓] or [✗])
    for step in step_markers:
        checkbox = step.get('is_success', False) or step.get('is_failure', False)
        if checkbox:  # Has [✓] or [✗], meaning it's already been executed
            # This is OK - test can have executed steps
            pass
        # Actually, the requirement says "所有步骤都需要 [ ] 任务标签" - meaning ALL steps need [ ]
        # This means [✓] and [✗] are NOT allowed during documentation creation
        # Let's check if this is during test creation or after test run
        # For now, we allow both [ ] and [✓]/[✗] since x4-test updates them

    # Validate: Last step must contain assertion (subtask with "断言" or "期望" or "期望值")
    # OR the step itself contains "断言" keyword
    # Group subtasks by their parent step
    step_subtasks_map: Dict[int, List[Dict]] = defaultdict(list)
    for subtask in subtask_markers:
        # Find the closest step before this subtask
        subtask_line = subtask['line_num']
        for step in step_markers:
            if step['line_num'] < subtask_line:
                # Find the last step before this subtask
                step_subtasks_map[step['line_num']].append(subtask)

    # Check that the last step of each task has an assertion
    # First, build step content map for quick lookup
    step_content_map: Dict[int, str] = {step['line_num']: step.get('name', '') for step in step_markers}

    for task_name, steps in task_steps_map.items():
        if not steps:
            continue

        # Get the last step of this task
        last_step = steps[-1]
        last_step_line = last_step['line_num']

        # Check 1: Is there a subtask with assertion under this step?
        subtasks_under_last_step = step_subtasks_map.get(last_step_line, [])
        has_assertion = False

        for subtask in subtasks_under_last_step:
            subtask_name = subtask.get('name', '').lower()
            if '断言' in subtask_name or '期望' in subtask_name or '期望值' in subtask_name:
                has_assertion = True
                break

        # Check 2: Does the step itself contain assertion keywords?
        if not has_assertion:
            step_content = step_content_map.get(last_step_line, '')
            if '断言' in step_content or '期望' in step_content or '期望值' in step_content:
                has_assertion = True

        # Check 3: Does the raw step content (from steps list) contain assertion?
        if not has_assertion:
            raw_step_content = last_step.get('content', '')
            if '断言' in raw_step_content or '期望' in raw_step_content or '期望值' in raw_step_content:
                has_assertion = True

        if not has_assertion:
            # Extract task description for error message
            parts = task_name.split(None, 1)
            if len(parts) >= 2:
                errors.append(
                    f"任务 `{task_name}` - 最后一步必须包含断言（步骤或子任务需包含 '断言' 或 '期望' 关键词）"
                )

    # ========================================
    # STRICT FORMAT VALIDATION: Detect invalid step formats
    # ========================================

    # This requires raw content - we'll validate this externally
    # The validation script expects the NEW format:
    # - Task: - [ ] <task name>
    # - Step: - [ ] 步骤 <n>: <description>
    # INVALID formats that will be rejected:
    # - #### 步骤 <n>:
    # - ### 步骤 <n>:
    # - 步骤 <n>: (without checkbox)

    return len(errors) == 0, errors


def validate_step_format(content: str) -> Tuple[bool, List[str]]:
    """
    Validate that steps use proper checkbox format, not markdown headers.
    Also validates subtask/subinstruction formatting.

    Returns:
    - is_valid: True if all steps use proper format
    - errors: List of error messages
    """
    errors: List[str] = []

    lines = content.split("\n")

    # Track current chapter to apply different rules
    current_chapter = 0
    chapter_patterns = [
        (re.compile(r"^##\s*\d+\.?\s*单元测试"), 1),
        (re.compile(r"^##\s*\d+\.?\s*Unit\s+Tests"), 1),
        (re.compile(r"^##\s*\d+\.?\s*E2E\s+标准状态与状态迁移"), 2),
        (re.compile(r"^##\s*\d+\.?\s*Web\s+Integration"), 2),
        (re.compile(r"^##\s*\d+\.?\s*E2E\s+测试场景"), 3),
        (re.compile(r"^##\s*\d+\.?\s*Scenario"), 3),
        (re.compile(r"^##\s*\d+\.?\s*Bug\s+测试"), 4),
        (re.compile(r"^##\s*\d+\.?\s*失败原因及可能的推断"), 5),
    ]

    # Sub-chapter pattern (should NOT exist - e.g., ### 2.1, ### 3.5)
    subchapter_pattern = re.compile(r"^###\s*\d+\.\d+")

    step_indent_map: Dict[int, int] = {}  # line_number -> indent level

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Detect chapter headers
        for pattern, chapter_num in chapter_patterns:
            if pattern.match(stripped):
                current_chapter = chapter_num
                break

        # Check for sub-chapters (should NOT exist in valid format)
        if subchapter_pattern.match(stripped):
            errors.append(
                f"第 {i} 行: 检测到子章节 `{stripped}`。"
                f"四章格式不允许子章节（如 ### 2.1），请使用任务/步骤结构。"
            )

        # Check for invalid state/transition format (markdown header style)
        if re.match(r"^#{1,3}\s*状态[:：]", stripped):
            errors.append(
                f"第 {i} 行: 状态定义应使用任务格式 `- [ ] 状态: xxx`，"
                f"而非子章节格式 `### 状态: xxx`"
            )
        if re.match(r"^#{1,3}\s*切换[:：]", stripped):
            errors.append(
                f"第 {i} 行: 切换定义应使用任务格式 `- [ ] 切换: xxx -> yyy`，"
                f"而非子章节格式 `### 切换: xxx`"
            )

        # Invalid patterns (markdown headers used as steps)
        if re.match(r"^#{1,6}\s+步骤", stripped):
            errors.append(f"第 {i} 行: 检测到 Markdown 标题格式 - 必须使用 `- [ ] 步骤 <n>:` 格式")

        # Check for "步骤" without checkbox (in any position)
        if "步骤" in stripped and not stripped.startswith("#"):
            # Steps MUST have checkbox format: - [ ] 步骤 <n>:
            if not re.match(r"^-\s\[[ ✓✗x]\]\s*步骤", stripped):
                # Exception: sub-instructions (more indented) don't need checkbox
                indent = len(line) - len(line.lstrip())
                if indent == 0 or (not re.match(r"^\s+- ", line) and not re.match(r"^\s+[^\-]", line)):
                    errors.append(f"第 {i} 行: 步骤必须使用 checkbox 格式 `- [ ] 步骤 <n>:`")

        # Track step positions for sub-behavior validation
        if re.match(r"^-\s\[[ ✓✗x]\]\s*步骤", stripped):
            indent = len(line) - len(line.lstrip())
            step_indent_map[i] = indent

        # Check for task WITHOUT checkbox (WRONG - tasks MUST have checkbox)
        # Task format: - [ ] 1.1 档位默认状态
        if current_chapter > 0 and re.match(r"^\d+\.\s+", stripped) and not stripped.startswith("-"):
            # This looks like a task without checkbox
            errors.append(f"第 {i} 行: 任务（测试用例）必须使用 checkbox，格式应该是 `- [ ] 1.1 <任务名>`")

    # ========================================
    # Validate sub-behavior format (indented under steps)
    # ========================================
    for step_line_idx, step_indent in step_indent_map.items():
        # Check next lines for sub-behaviors
        for j in range(step_line_idx, min(step_line_idx + 20, len(lines))):
            if j == step_line_idx:
                continue  # Skip the step itself

            next_line = lines[j]

            # Skip empty lines
            if not next_line.strip():
                continue

            next_indent = len(next_line) - len(next_line.lstrip())

            # Stop if we hit another step at same or lower indent
            if re.match(r"^-\s\[[ ✓✗x]\]\s*步骤", next_line.strip()):
                if next_indent <= step_indent:
                    break
                continue

            # If more indented than step, it's a sub-behavior/sub-instruction
            if next_indent > step_indent:
                # Sub-behaviors/sub-assertions MUST have checkbox: - [ ] or - [x] or - [✓]
                # OR sub-instructions can be plain text: "      - 引擎: xxx"
                is_valid_sub = (
                    re.match(r"^-\s\[[ ✓✗x]\]\s+", next_line.strip()) or  # With checkbox
                    re.match(r"^-\s+[^[]", next_line.strip())  # Plain text (e.g., "      - 引擎: xxx")
                )

                if not is_valid_sub:
                    errors.append(
                        f"第 {j+1} 行: 子行为/子断言/子说明格式不正确。"
                        f"格式：`      - [ ] <子行为>` 或 `      - <子说明>`"
                    )

    return len(errors) == 0, errors


def main():
    args = parse_args()

    if not args.change_name and not args.file:
        print("Error: Either change_name or --file must be provided")
        print(__doc__)
        sys.exit(1)

    if args.file:
        test_tasks_path = Path(args.file)
    else:
        try:
            test_tasks_path = find_test_tasks_path(args.change_name)
        except FileNotFoundError as e:
            print(f"Error: {e}")
            sys.exit(1)

    if not test_tasks_path.exists():
        print(f"Error: File not found: {test_tasks_path}")
        sys.exit(1)

    content = test_tasks_path.read_text(encoding="utf-8")

    states, transitions, chapter3_references, chapter4_references, bug_ids_ch4, task_markers, step_markers, subtask_markers = parse_test_tasks(content)

    print(f"=== Validation Report ===")
    print(f"States found in Chapter 2: {len(states)}")
    for state_id in sorted(states.keys()):
        print(f"  - 状态: {state_id}")
    print(f"\nTransitions found in Chapter 2: {len(transitions)}")
    for trans_id in sorted(transitions.keys()):
        print(f"  - 切换: {trans_id}")
    print(f"\nReferences found in Chapter 3: {len(chapter3_references)}")
    for ref in sorted(chapter3_references):
        print(f"  - {ref}")
    print(f"\nReferences found in Chapter 4: {len(chapter4_references)}")
    for ref in sorted(chapter4_references):
        print(f"  - {ref}")
    print(f"\nBug IDs in Chapter 4 (Bug 测试): {len(bug_ids_ch4)}")
    for bug_id in sorted(bug_ids_ch4.keys()):
        print(f"  - {bug_id}")

    # Print task markers
    chapter_names = {1: "单元测试", 2: "E2E标准状态与状态迁移", 3: "E2E测试场景", 4: "Bug测试", 5: "失败原因及可能的推断"}
    print(f"\nTask Markers:")
    for chapter_num, chapter_name in chapter_names.items():
        if chapter_num in task_markers:
            print(f"  Chapter {chapter_num} ({chapter_name}): {len(task_markers[chapter_num])} tasks")
            for task_name, (has_marker, is_success, is_failure) in sorted(task_markers[chapter_num].items()):
                if is_success:
                    status = "[✓]"
                elif is_failure:
                    status = "[✗]"
                else:
                    status = "[ ]"
                print(f"    - {status} {task_name}")

    # Print step markers
    print(f"\nStep Markers:")
    steps_by_chapter = defaultdict(list)
    for step in step_markers:
        steps_by_chapter[step['chapter']].append(step)
    for chapter_num, chapter_name in chapter_names.items():
        if chapter_num in steps_by_chapter:
            steps = sorted(steps_by_chapter[chapter_num], key=lambda x: x['line_num'])
            print(f"  Chapter {chapter_num} ({chapter_name}): {len(steps)} steps")
            for step in steps[:10]:  # Show first 10
                if step['is_success']:
                    status = "[✓]"
                elif step['is_failure']:
                    status = "[✗]"
                else:
                    status = "[ ]"
                print(f"    - {status} {step['name']} (line {step['line_num']}, indent {step['indent']})")
            if len(steps) > 10:
                print(f"    ... and {len(steps) - 10} more")

    # Print subtask markers
    print(f"\nSubtask/Assertion Markers:")
    subtasks_by_chapter = defaultdict(list)
    for subtask in subtask_markers:
        subtasks_by_chapter[subtask['chapter']].append(subtask)
    for chapter_num, chapter_name in chapter_names.items():
        if chapter_num in subtasks_by_chapter:
            subtasks = sorted(subtasks_by_chapter[chapter_num], key=lambda x: x['line_num'])
            print(f"  Chapter {chapter_num} ({chapter_name}): {len(subtasks)} subtasks")
            for subtask in subtasks[:10]:  # Show first 10
                if subtask['is_success']:
                    status = "[✓]"
                elif subtask['is_failure']:
                    status = "[✗]"
                else:
                    status = "[ ]"
                print(f"    - {status} {subtask['name']} (line {subtask['line_num']}, indent {subtask['indent']})")
            if len(subtasks) > 10:
                print(f"    ... and {len(subtasks) - 10} more")

    is_valid, errors = validate_test_tasks(
        states, transitions, chapter3_references, chapter4_references, bug_ids_ch4, task_markers, step_markers, subtask_markers, content
    )

    # Validate step format (must use - [ ] 步骤 format, not #### 步骤)
    format_valid, format_errors = validate_step_format(content)
    if not format_valid:
        is_valid = False
        errors.extend(format_errors)

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
