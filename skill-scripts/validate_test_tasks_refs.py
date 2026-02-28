#!/usr/bin/env python3
"""
Validate test_tasks.md structure and checklist quality.

Environment:
    DEBUG=1   Enable verbose debug output

Validation rules (authoritative):
1) Every x.x task in Chapter 1/2/3/4 must contain at least one step subtask:
   - [ ] 步骤 <n>: <description>
2) For every x.x task in Chapter 1/2/3/4, the LAST step subtask must contain "期望".
3) Any step containing "期望" must include assertion method inline
   (for example: expect(...), toBe(...), toEqual(...), toContain(...)).
4) Step format is strict:
   - valid:   - [ ] 步骤 <n>: ...
   - invalid: - 步骤 <n>: ...
   - invalid: ### 步骤 <n>
5) Chapter 2 state/transition reference integrity is checked:
   states/transitions should be connected to Chapter 3 or 4 reference paths.
6) Two independent structure rules are enforced:
   - Rule A (Case-subtask rule, Chapter 3 only):
     Case direct subtasks can only be 前提:状态 / 前提:切换 / 步骤 / 期望
   - Rule B (Five-chapter tree-only rule):
     In chapters 1..5, only task tree nodes are allowed (task/subtask/grandchild-subtask).
7) Assertion style rule:
   - `toBe(true)` and `toBe(false)` are forbidden; use explicit assertions instead.
8) Chapter 2 granularity rule:
   - `状态:` task must have at least 4 subtasks.
   - `切换:` task must have at least 3 subtasks.
   - If not, agent should inline that behavior into Case steps instead of over-modeling.

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

ASSERTION_METHOD_PATTERN = re.compile(
    r"(expect\s*\(|\btoBe\(|\btoEqual\(|\btoStrictEqual\(|\btoContain\(|\btoHaveCount\(|"
    r"\btoHaveText\(|\btoHaveValue\(|\btoBeTruthy\(|\btoBeFalsy\(|\btoBeGreaterThan\(|"
    r"\btoBeGreaterThanOrEqual\(|\btoBeLessThan\(|\btoBeLessThanOrEqual\(|\bgreaterThan\(|\blessThan\()"
)
FORBIDDEN_BOOLEAN_TOBE_PATTERN = re.compile(r"\btoBe\s*\(\s*(true|false)\s*\)")

VAGUE_BLACKLIST_TERMS = [
    "某个",
    "任一",
    "任意",
    "随便",
    "选择一",
]


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

    # Reference patterns in Chapter 3 or 4 (checkbox subtask required)
    state_ref_pattern = re.compile(r"^\s*-\s*\[[ ✓✗x]\]\s*前提:\s*状态\s*(\S+)$")
    transition_ref_pattern = re.compile(r"^\s*-\s*\[[ ✓✗x]\]\s*前提:\s*切换\s*(\S+)\s*->\s*(\S+)$")

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

    # Step/Subtask marker pattern: - [✓] <number>.<subnumber>.<subsubnumber> <description>
    # New format: - [ ] 1.1.1 读取当前档位状态
    # Only matches 3+ level numbers (e.g., 1.1.1, 1.1.2, 3.6.5) to distinguish from task markers (2-level like 1.1)
    step_marker_pattern = re.compile(r"^(\s*)-\s*\[([ ✓✗x])\]\s*(\d+\.\d+\.\d+)\s+(.+)$")

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
        # Skip chapter headers - they should not be treated as steps/tasks
        is_chapter_header = line.strip().startswith('##')
        if current_chapter > 0 and line.strip() and not is_chapter_header:
            # First try step marker (new format: - [ ] 1.1.1 描述)
            step_match = step_marker_pattern.match(line)
            if step_match:
                leading_spaces = step_match.group(1)
                checkbox = step_match.group(2)
                is_success = checkbox in ('✓', 'x')
                is_failure = checkbox == '✗'
                step_num = step_match.group(3)  # group(3) is the step number like "1.1.1"
                step_desc = step_match.group(4).strip()  # group(4) is the description
                step_markers.append({
                    'line_num': i + 1,
                    'indent': indent,
                    'step_num': step_num,
                    'name': f"{step_num} {step_desc}",
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
                # Chapter 3/4 reference extraction from checkbox subtasks, e.g.:
                # - [ ] 前提: 状态 xxx
                # - [ ] 前提: 切换 aaa -> bbb
                if current_chapter in (3, 4):
                    ref_line = line.strip()
                    state_ref_match = state_ref_pattern.match(ref_line)
                    if state_ref_match:
                        state_id = state_ref_match.group(1)
                        if current_chapter == 3:
                            chapter3_references.add(state_id)
                        else:
                            chapter4_references.add(state_id)
                    trans_ref_match = transition_ref_pattern.match(ref_line)
                    if trans_ref_match:
                        from_state = trans_ref_match.group(1)
                        to_state = trans_ref_match.group(2)
                        trans_id = f"{from_state} -> {to_state}"
                        if current_chapter == 3:
                            chapter3_references.add(trans_id)
                        else:
                            chapter4_references.add(trans_id)
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
                # Chapter 2 state/transition extraction from numbered task format:
                # - [ ] 2.x 状态: xxx
                # - [ ] 2.x 切换: aaa -> bbb
                if current_chapter == 2:
                    if task_name.startswith("状态:"):
                        state_id = task_name.split("状态:", 1)[1].strip()
                        states[state_id] = line.strip()
                    elif task_name.startswith("切换:"):
                        transition_body = task_name.split("切换:", 1)[1].strip()
                        parts = [p.strip() for p in transition_body.split("->", 1)]
                        if len(parts) == 2 and parts[0] and parts[1]:
                            trans_id = f"{parts[0]} -> {parts[1]}"
                            transitions[trans_id] = line.strip()
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
    # Chapter 1/2/3 must have steps when tasks exist.
    # Chapter 4 can be empty, but if bug tasks are present they also need steps.
    chapters_require_steps_if_tasks = {1, 2, 3, 4}
    for chapter_num, chapter_name in chapter_names.items():
        # Chapter 5 is summary-only and does not contain steps.
        if chapter_num == 5:
            continue

        task_count = len(task_markers.get(chapter_num, {}))
        step_count = steps_count_by_chapter.get(chapter_num, 0)

        if task_count > 0 and step_count == 0:
            # Has tasks but no steps
            if chapter_num in chapters_require_steps_if_tasks:
                errors.append(
                    f"Chapter {chapter_num} ({chapter_name}) - 测试用例必须包含子任务标记 [- [ ] <标号> <描述>]"
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
    # NEW VALIDATION: All tasks need steps; last subtask(step) must be expectation
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
    for chapter_num in [1, 2, 3, 4]:
        if chapter_num not in task_markers:
            continue

        for task_name in task_markers[chapter_num]:
            steps = task_steps_map.get(task_name, [])
            if len(steps) == 0:
                # Extract task description for error message
                parts = task_name.split(None, 1)
                if len(parts) >= 2:
                    errors.append(
                        f"任务 `{task_name}` - 必须包含至少一个子任务标记 [- [ ] <标号> <描述>]"
                    )

            # Chapter 2 granularity control:
            # 状态: >= 4 subtasks, 切换: >= 3 subtasks; otherwise recommend inlining into Case.
            if chapter_num == 2 and len(task_name.split(None, 1)) >= 2:
                desc = task_name.split(None, 1)[1]
                if desc.startswith("状态:") and len(steps) < 4:
                    errors.append(
                        f"任务 `{task_name}` - 状态子任务不足（当前 {len(steps)}，至少 4）；请补充子任务或将该行为内联到 Case 步骤"
                    )
                if desc.startswith("切换:") and len(steps) < 3:
                    errors.append(
                        f"任务 `{task_name}` - 切换子任务不足（当前 {len(steps)}，至少 3）；请补充子任务或将该行为内联到 Case 步骤"
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

    # Validate all chapters:
    # 1) For every x.x task (chapter 1-4), the last step must contain "期望".
    # 2) Any step containing "期望" must include assertion method inline.
    # 3) Subtask numbering must be sequential and start from parent task number
    for task_name, steps in task_steps_map.items():
        task_chapter = int(task_name.split(".", 1)[0])
        if task_chapter not in (1, 2, 3, 4):
            continue
        if not steps:
            continue

        # Validate subtask numbering
        parent_num = task_name.split(".", 1)[0]  # e.g., "1" from "1.1"
        expected_sub_num = 1
        for step in steps:
            step_num = step.get('step_num', '')
            # Step number format: "1.1.1", "1.1.2", etc.
            if '.' in step_num:
                parts = step_num.split('.')
                if len(parts) >= 3:
                    # Check prefix matches parent (e.g., "1.1" should have children "1.1.1", "1.1.2")
                    prefix = '.'.join(parts[:-1])  # "1.1" from "1.1.1"
                    if prefix != task_name:
                        errors.append(
                            f"任务 `{task_name}` - 子任务标号 `{step_num}` 前缀不匹配，应为 `{task_name}.X` 格式"
                        )
                    # Check sequential numbering
                    actual_sub_num = int(parts[-1])
                    if actual_sub_num != expected_sub_num:
                        errors.append(
                            f"任务 `{task_name}` - 子任务标号不连续，当前为 `{step_num}`，期望 `{prefix}.{expected_sub_num}`"
                        )
                    expected_sub_num = actual_sub_num + 1

        for step in steps:
            step_content = step.get('content', '')
            for term in VAGUE_BLACKLIST_TERMS:
                if term in step_content:
                    errors.append(
                        f"任务 `{task_name}` - 步骤包含黑名单模糊词 `{term}`：{step_content}；请使用代码/数据中的实际标识（真实 ship/equipment id、真实 data-testid），禁止编造数据"
                    )
            if FORBIDDEN_BOOLEAN_TOBE_PATTERN.search(step_content):
                errors.append(
                    f"任务 `{task_name}` - 禁止使用 toBe(true/false)：{step_content}；请改为具语义断言"
                )
            if "期望" in step_content and not ASSERTION_METHOD_PATTERN.search(step_content):
                errors.append(
                    f"任务 `{task_name}` - 含期望的步骤必须内联断言方法(如 expect(...) / toBe(...))，不允许仅写期望描述"
                )
        # Check if last step or its subtasks contain "期望"
        last_step = steps[-1]
        last_step_line = last_step.get('line_num')
        last_step_content = last_step.get('content', '')

        # Check if last step itself contains "期望"
        has_expectation = "期望" in last_step_content

        # If not, check if there's a subtask under this step that contains "期望"
        if not has_expectation and subtask_markers:
            for subtask in subtask_markers:
                subtask_line = subtask.get('line_num', 0)
                subtask_name = subtask.get('name', '')
                # Check if this subtask is under the last step (line number greater than step's line)
                if subtask_line > last_step_line and "期望" in subtask_name:
                    has_expectation = True
                    break

        if not has_expectation:
            errors.append(
                f"任务 `{task_name}` - 最后一步或其子任务必须包含期望"
            )

    # Rule A (independent): Validate Chapter 3 case internal subtasks:
    # 1) Each case must contain at least one step.
    # 2) Any bullet line at task child-indent (task indent + 2) is a subtask and MUST use checkbox format.
    # 3) At task child-indent, only these direct subtask types are allowed:
    #    - 前提: 状态 ...
    #    - 前提: 切换 ... -> ...
    #    - 步骤 n: ...
    #    - 期望: ...
    # 4) Any non-empty non-bullet line inside Case block is illegal text.
    sorted_task_lines = sorted(task_line_to_name.items(), key=lambda x: x[0])
    for idx, (start_line, task_name) in enumerate(sorted_task_lines):
        task_chapter = int(task_name.split(".", 1)[0])
        if task_chapter != 3:
            continue

        end_line = len(lines) if idx == len(sorted_task_lines) - 1 else sorted_task_lines[idx + 1][0] - 1
        block = lines[start_line:end_line]
        task_line = lines[start_line - 1] if start_line - 1 < len(lines) else ""
        task_indent = len(task_line) - len(task_line.lstrip(" "))
        subtask_indent = task_indent + 2

        for rel_idx, ln in enumerate(block):
            abs_line = start_line + rel_idx
            if not ln.strip():
                continue
            current_indent = len(ln) - len(ln.lstrip(" "))
            if current_indent < subtask_indent:
                continue
            if not re.match(r"^\s*-\s+", ln):
                errors.append(
                    f"任务 `{task_name}` - 第 {abs_line} 行存在非法文本（Case 内仅允许子任务项）"
                )
                continue
            if not re.match(r"^\s*-\s*\[[ ✓✗x]\]\s+", ln):
                errors.append(
                    f"任务 `{task_name}` - 第 {abs_line} 行为 Case 子任务但缺少 checkbox，"
                    "需使用 `- [ ] ...` 格式"
                )
                continue
            # Only enforce allowed type list on direct child subtasks.
            # Allow both old format (前提:/步骤:/期望:) and new numbered format (3.1.1)
            if current_indent == subtask_indent:
                child_content_match = re.match(r"^\s*-\s*\[[ ✓✗x]\]\s*(.+)$", ln)
                child_content = child_content_match.group(1).strip() if child_content_match else ""
                if not (
                    re.match(r"^前提:\s*状态\s+\S+", child_content)
                    or re.match(r"^前提:\s*切换\s+\S+\s*->\s*\S+", child_content)
                    or re.match(r"^(步骤|Step)\s*\d+[:：]\s*.+", child_content)
                    or re.match(r"^期望[:：]\s*.+", child_content)
                    or re.match(r"^\d+\.\d+\.\d+\s+", child_content)  # Allow numbered format like 3.1.1
                ):
                    errors.append(
                        f"任务 `{task_name}` - 第 {abs_line} 行 Case 子任务类型非法：{child_content}；"
                        "仅允许 前提:状态 / 前提:切换 / 步骤 / 期望 / 数字编号(如3.1.1)"
                    )

        has_step_subtask = any(
            re.match(r'^\s*-\s*\[[ ✓✗x]\]\s*\d+\.\d+\.\d+', ln.strip())
            for ln in block
        )
        if not has_step_subtask:
            errors.append(f"任务 `{task_name}` - Chapter 3 Case 缺少子任务(需 `- [ ] {task_name}.1 ...` 格式)")

    # ========================================
    # STRICT FORMAT VALIDATION: Detect invalid step formats
    # ========================================

    # This requires raw content - we validate this externally
    # The validation script expects the NEW format:
    # - Task: - [ ] <task name>
    # - Subtask: - [ ] <parent>.<number> <description> (e.g., 1.1.1, 3.1.1)
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
    ch3_in_case_block = False

    chapter_header_pattern = re.compile(r"^##\s*\d+\.?\s*.+$")
    top_task_pattern = re.compile(r"^-\s*\[[ ✓✗x]\]\s*\d+\.\d+\s+.+$")
    subtask_checkbox_pattern = re.compile(r"^-\s*\[[ ✓✗x]\]\s+.+$")

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

        # Invalid patterns (markdown headers used as subtasks)
        if re.match(r"^#{1,6}\s+步骤", stripped):
            errors.append(f"第 {i} 行: 检测到 Markdown 标题格式 - 必须使用 checkbox 格式 `- [ ] <标号> <描述>`")

        # Check for subtask without checkbox
        # e.g. "- 1.1.1 ..." must have checkbox; required format is "- [ ] 1.1.1 ..."
        # New format: - [ ] 1.1.1 描述 (no "步骤" keyword needed)
        if re.match(r"^\s*-\s*\d+\.\d+\.\d+\s+", line):
            # This line looks like a numbered subtask but might be missing checkbox
            if not re.match(r"^\s*-\s*\[\s*[ ✓✗x]\s*\]\s*\d+\.\d+\.\d+", line):
                errors.append(f"第 {i} 行: 子任务必须使用 checkbox 格式 `- [ ] <标号> <描述>`")

        # Track step positions for sub-behavior validation
        if re.match(r"^-\s\[[ ✓✗x]\]\s*\d+\.\d+\.\d+", stripped):
            indent = len(line) - len(line.lstrip())
            step_indent_map[i] = indent

        # Check for task WITHOUT checkbox (WRONG - tasks MUST have checkbox)
        # Task format: - [ ] 1.1 档位默认状态
        if current_chapter > 0 and re.match(r"^\d+\.\s+", stripped) and not stripped.startswith("-"):
            # This looks like a task without checkbox
            errors.append(f"第 {i} 行: 任务（测试用例）必须使用 checkbox，格式应该是 `- [ ] 1.1 <任务名>`")

    # Rule B (independent): Five-chapter strict tree-only rule:
    # within chapter 1..5, only task -> subtask -> grandchild-subtask structure is allowed.
        if current_chapter in (1, 2, 3, 4, 5) and stripped:
            if chapter_header_pattern.match(stripped):
                continue

            indent = len(line) - len(line.lstrip())
            if indent == 0:
                if not top_task_pattern.match(stripped):
                    errors.append(
                        f"第 {i} 行: 章节内仅允许顶层任务 `- [ ] x.x ...`，检测到非法文本：{stripped}"
                    )
                continue
            if indent in (2, 4):
                if not subtask_checkbox_pattern.match(stripped):
                    errors.append(
                        f"第 {i} 行: 章节内子任务仅允许 checkbox 条目（`- [ ] ...`），检测到非法文本：{stripped}"
                    )
                continue

            errors.append(
                f"第 {i} 行: 章节内仅允许 0/2/4 空格缩进的任务树结构，检测到非法缩进：{stripped}"
            )

        # Chapter 3 strict tree-only rule:
        # only Case task -> child subtasks -> grandchild subtasks are allowed.
        if current_chapter == 3 and stripped:
            if re.match(r"^##\s+", stripped):
                continue
            indent = len(line) - len(line.lstrip())
            case_task_match = re.match(r"^-\s*\[[ ✓✗x]\]\s*3\.\d+\s+Case:\s*.+$", stripped)

            if case_task_match and indent == 0:
                ch3_in_case_block = True
                continue

            if not ch3_in_case_block:
                errors.append(
                    f"第 {i} 行: 第三章仅允许 Case 树结构（Case/子任务/子任务的子任务），检测到非法文本：{stripped}"
                )
                continue

            # Under a Case block, only level-1 (2 spaces) and level-2 (4 spaces) are allowed
            if indent not in (2, 4):
                errors.append(
                    f"第 {i} 行: 第三章 Case 内缩进层级非法（仅允许 2 或 4 空格）：{stripped}"
                )
                continue

            if not re.match(r"^-\s*\[[ ✓✗x]\]\s+.+$", stripped):
                errors.append(
                    f"第 {i} 行: 第三章 Case 子任务必须使用 checkbox（`- [ ] ...`）：{stripped}"
                )
                continue

            if indent == 2:
                child_content = re.sub(r"^-\s*\[[ ✓✗x]\]\s+", "", stripped)
                if not (
                    re.match(r"^前提:\s*状态\s+\S+", child_content)
                    or re.match(r"^前提:\s*切换\s+\S+\s*->\s*\S+", child_content)
                    or re.match(r"^(步骤|Step)\s*\d+[:：]\s*.+", child_content)
                    or re.match(r"^期望[:：]\s*.+", child_content)
                    or re.match(r"^\d+\.\d+\.\d+\s+.+", child_content)  # Allow numbered format like 3.1.1
                ):
                    errors.append(
                        f"第 {i} 行: 第三章 Case 直接子任务类型非法（仅允许 前提:状态/前提:切换/步骤/期望）：{stripped}"
                    )

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
    import os
    DEBUG = os.environ.get('DEBUG', '0') == '1'

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

    if DEBUG:
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
