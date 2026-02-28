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


def parse_test_tasks(content: str) -> Tuple[Dict, Dict, Set, Set, Dict]:
    """
    Parse test_tasks.md and extract:
    - states: {state_id: section_name}
    - transitions: {transition_id: section_name}
    - chapter3_references: set of state_ids and transition_ids referenced in Chapter 3
    - chapter4_references: set of state_ids and transition_ids referenced in Chapter 4
    - bug_ids_ch4: {bug_id: section_name} from Chapter 4 (Bug 测试)

    State format: ### 状态: <state-id>
    Transition format: ### 切换: <from> -> <to>
    Reference format: - 前提: 状态 <state-id>
                      - 前提: 切换 <from> -> <to>
    Bug ID format: ### BUG-<数字> <描述>
    """
    states: Dict[str, str] = {}
    transitions: Dict[str, str] = {}
    chapter3_references: Set[str] = set()
    chapter4_references: Set[str] = set()
    bug_ids_ch4: Dict[str, str] = {}

    lines = content.split("\n")

    # Track current chapter
    # 0 = before chapter 1, 1 = chapter 1, 2 = chapter 2, 3 = chapter 3, 4 = chapter 4
    current_chapter = 0

    # State/Transition definition patterns
    state_pattern = re.compile(r"^###\s*状态:\s*(\S+)$")
    transition_pattern = re.compile(r"^###\s*切换:\s*(\S+)\s*->\s*(\S+)$")

    # Reference patterns in Chapter 3 or 4
    state_ref_pattern = re.compile(r"^\s*-\s*前提:\s*状态\s*(\S+)$")
    transition_ref_pattern = re.compile(r"^\s*-\s*前提:\s*切换\s*(\S+)\s*->\s*(\S+)$")

    # Bug ID pattern: ### BUG-<数字> <描述>
    bug_id_pattern = re.compile(r"^###\s*(BUG-\d+)\s+(.+)$")

    for i, line in enumerate(lines):
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

        # Parse state definitions (Chapter 2)
        if current_chapter == 2:
            state_match = state_pattern.match(line)
            if state_match:
                state_id = state_match.group(1)
                states[state_id] = line.strip()
                continue

            trans_match = transition_pattern.match(line)
            if trans_match:
                from_state = trans_match.group(1)
                to_state = trans_match.group(2)
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

    return states, transitions, chapter3_references, chapter4_references, bug_ids_ch4


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
) -> Tuple[bool, List[str]]:
    """
    Validate:
    1. Every Chapter 2 item has a reference path to Chapter 3 or 4

    Returns:
    - is_valid: True if all items have valid references
    - errors: List of error messages
    """
    errors: List[str] = []
    all_items = set(states.keys()) | set(transitions.keys())

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

    states, transitions, chapter3_references, chapter4_references, bug_ids_ch4 = parse_test_tasks(content)

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

    is_valid, errors = validate_test_tasks(
        states, transitions, chapter3_references, chapter4_references, bug_ids_ch4
    )

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
