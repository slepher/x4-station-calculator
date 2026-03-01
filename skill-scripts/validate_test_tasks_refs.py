#!/usr/bin/env python3
"""
Validate test_tasks.md structure and expectation rules.

Usage:
    python3 skill-scripts/validate_test_tasks_refs.py <change-name>
    python3 skill-scripts/validate_test_tasks_refs.py --file <path-to-test_tasks.md>
    python3 skill-scripts/validate_test_tasks_refs.py --file <path-to-test_tasks.md> --json

Exit codes:
    0 - pass
    1 - fail
"""

import argparse
import json
import re
import sys
from collections import defaultdict, deque
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

CHAPTER_HEADER_RE = re.compile(r"^##\s*(\d+)\.?\s+.+$")
SUBCHAPTER_RE = re.compile(r"^###\s+")

TOP_TASK_RE = re.compile(r"^(\s*)-\s*\[([ ✓✗x])\]\s*(\d+)\.(\d+)\s+(.+)$")
SUBTASK_RE = re.compile(r"^(\s{2})-\s*\[([ ✓✗x])\]\s*(\d+)\.(\d+)\.(\d+)\s+(.+)$")
CHILD_RE = re.compile(r"^(\s{4})-\s*\[([ ✓✗x])\]\s*(\d+)\.(\d+)\.(\d+)\.(\d+)\s+(.+)$")

STATE_TASK_RE = re.compile(r"^状态:\s*(\S+)\s*$")
TRANS_TASK_RE = re.compile(r"^切换:\s*(.+?)\s*->\s*(.+)$")
CASE_TASK_RE = re.compile(r"^Case:\s+(.+)$")
BUG_TASK_RE = re.compile(r"^BUG-(\d+):\s+(.+)$")
STATE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
GENERIC_PLACEHOLDER_RE = re.compile(r"(待补充|待完善|TODO|TBD|N/?A|占位)", re.IGNORECASE)
ROOT_CAUSE_HINT_RE = re.compile(r"(因为|由于|根因|源码|代码问题|实现问题|逻辑错误)")

STATE_REF_RE = re.compile(r"^状态:\s*(\S+)\s*$")
TRANS_REF_RE = re.compile(r"^切换:\s*(.+?)\s*->\s*(.+)$")

EXPECT_MARKER_RE = re.compile(r"#期望:\s*\[(.+)\]\s*$")


class Node:
    def __init__(self, chapter: int, task_no: str, desc: str, line_no: int):
        self.chapter = chapter
        self.task_no = task_no
        self.desc = desc
        self.line_no = line_no
        self.subtasks: List[Dict] = []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate test_tasks.md")
    parser.add_argument("change_name", nargs="?", help="Change name in openspec/changes/")
    parser.add_argument("--file", "-f", help="Path to test_tasks.md file")
    parser.add_argument("--json", action="store_true", help="Output errors as JSON list")
    return parser.parse_args()


def resolve_path(change_name: Optional[str], file_path: Optional[str]) -> Path:
    if file_path:
        p = Path(file_path)
    else:
        if not change_name:
            raise ValueError("Either change_name or --file must be provided")
        p = Path("openspec/changes") / change_name / "test_tasks.md"
    if not p.exists():
        raise FileNotFoundError(f"File not found: {p}")
    return p


def has_expectation_semantics(text: str) -> bool:
    return "期望" in text or "#期望:" in text


def validate(path: Path, content: str) -> Tuple[bool, List[Dict[str, str]]]:
    errors: List[Dict[str, str]] = []
    lines = content.splitlines()

    # line -> (case, desc)
    line_meta: Dict[int, Tuple[str, str]] = {}

    def add_error(
        error_code: str,
        error_msg: str,
        *,
        case: Optional[str] = None,
        desc: Optional[str] = None,
        line: Optional[int] = None,
    ):
        resolved_case = case
        resolved_desc = desc

        if line is not None and line in line_meta:
            meta_case, meta_desc = line_meta[line]
            if resolved_case is None:
                resolved_case = meta_case
            if resolved_desc is None:
                resolved_desc = meta_desc

        # chapter-level fallback from line if still unresolved
        if resolved_case is None and line is not None:
            # try locate current chapter by scanning backward to nearest chapter header
            chapter = None
            for i in range(min(line, len(lines)), 0, -1):
                m = CHAPTER_HEADER_RE.match(lines[i - 1].strip())
                if m:
                    chapter = m.group(1)
                    break
            if chapter is not None:
                resolved_case = chapter

        if resolved_case is None:
            resolved_case = "global"
        if resolved_desc is None:
            if line is not None and 1 <= line <= len(lines):
                resolved_desc = lines[line - 1].strip()
            else:
                resolved_desc = ""

        errors.append(
            {
                "case": resolved_case,
                "desc": resolved_desc,
                "error_code": error_code,
                "error_msg": error_msg,
            }
        )

    # 1) Chapter structure: exactly 1..4 in order.
    chapter_lines: List[Tuple[int, int]] = []
    for idx, line in enumerate(lines, 1):
        m = CHAPTER_HEADER_RE.match(line.strip())
        if m:
            chapter_lines.append((int(m.group(1)), idx))

    nums = [n for n, _ in chapter_lines]
    if nums != [1, 2, 3, 4]:
        add_error(
            "CHAPTER_ORDER_INVALID",
            f"Chapter headers must be exactly [1,2,3,4] in order; got {nums}",
            case="global",
            desc="chapter headers",
        )

    # 2) Parse task tree and structure constraints.
    current_chapter = 0
    tasks_by_chapter: Dict[int, List[Node]] = defaultdict(list)
    current_task: Optional[Node] = None
    current_subtask: Optional[Dict] = None

    for idx, raw in enumerate(lines, 1):
        line = raw.rstrip("\n")
        stripped = line.strip()

        if not stripped:
            continue

        if SUBCHAPTER_RE.match(stripped):
            add_error(
                "SUBCHAPTER_FORBIDDEN",
                f"sub-chapter headings are forbidden: {stripped}",
                line=idx,
            )

        chm = CHAPTER_HEADER_RE.match(stripped)
        if chm:
            current_chapter = int(chm.group(1))
            line_meta[idx] = (str(current_chapter), stripped)
            current_task = None
            current_subtask = None
            continue

        if current_chapter not in (1, 2, 3, 4):
            # allow document title before chapter 1
            if stripped.startswith("# "):
                line_meta[idx] = ("global", stripped)
                continue
            add_error(
                "CONTENT_OUTSIDE_CHAPTER",
                f"content outside Chapter 1..4 is not allowed: {stripped}",
                line=idx,
                case="global",
            )
            continue

        tm = TOP_TASK_RE.match(line)
        if tm:
            indent = len(tm.group(1))
            ch = int(tm.group(3))
            no = int(tm.group(4))
            desc = tm.group(5).strip()
            task_no = f"{ch}.{no}"
            line_meta[idx] = (task_no, desc)

            if indent != 0:
                add_error(
                    "TOP_LEVEL_INDENT_INVALID",
                    "top-level task must have 0-space indent",
                    line=idx,
                    case=task_no,
                    desc=desc,
                )

            node = Node(current_chapter, task_no, desc, idx)
            tasks_by_chapter[current_chapter].append(node)
            current_task = node
            current_subtask = None
            continue

        sm = SUBTASK_RE.match(line)
        if sm:
            if current_task is None:
                add_error(
                    "SUBTASK_WITHOUT_PARENT",
                    "subtask without parent top-level task",
                    line=idx,
                )
                continue

            ch = int(sm.group(3))
            t = int(sm.group(4))
            s = int(sm.group(5))
            desc = sm.group(6).strip()
            sub_no = f"{ch}.{t}.{s}"
            line_meta[idx] = (sub_no, desc)

            sub = {
                "chapter": ch,
                "task": t,
                "sub": s,
                "desc": desc,
                "line": idx,
                "children": [],
            }
            current_task.subtasks.append(sub)
            current_subtask = sub
            continue

        cm = CHILD_RE.match(line)
        if cm:
            if current_subtask is None:
                add_error(
                    "THIRD_LEVEL_WITHOUT_PARENT",
                    "third-level item without parent subtask",
                    line=idx,
                )
                continue

            child_ch = int(cm.group(3))
            child_t = int(cm.group(4))
            child_s = int(cm.group(5))
            child_n = int(cm.group(6))
            child_desc = cm.group(7).strip()
            child_no = f"{child_ch}.{child_t}.{child_s}.{child_n}"
            line_meta[idx] = (child_no, child_desc)

            current_subtask["children"].append(
                {
                    "chapter": child_ch,
                    "task": child_t,
                    "sub": child_s,
                    "n": child_n,
                    "desc": child_desc,
                    "line": idx,
                }
            )
            continue

        add_error(
            "CHAPTER_CONTENT_INVALID",
            f"invalid line in chapter content: {stripped}",
            line=idx,
        )

    # 3) Numbering and chapter type restrictions.
    for chapter in (1, 2, 3, 4):
        tasks = tasks_by_chapter.get(chapter, [])
        chapter3_case_names: Set[str] = set()

        expected_top = 1
        for t in tasks:
            ch, no = map(int, t.task_no.split("."))
            if ch != chapter:
                add_error(
                    "TOP_LEVEL_CHAPTER_MISMATCH",
                    f"top task chapter mismatch, expected {chapter}, got {ch}",
                    case=t.task_no,
                    desc=t.desc,
                    line=t.line_no,
                )
            if no != expected_top:
                add_error(
                    "TOP_LEVEL_NUMBER_NOT_CONTIGUOUS",
                    f"top task numbering must be contiguous, expected {chapter}.{expected_top}",
                    case=t.task_no,
                    desc=t.desc,
                    line=t.line_no,
                )
                expected_top = no
            expected_top += 1

            if chapter == 2 and not (STATE_TASK_RE.match(t.desc) or TRANS_TASK_RE.match(t.desc)):
                add_error(
                    "CHAPTER2_TOP_TYPE_INVALID",
                    "Chapter 2 top task must be 状态: or 切换:",
                    case=t.task_no,
                    desc=t.desc,
                    line=t.line_no,
                )
            elif chapter == 2:
                sm = STATE_TASK_RE.match(t.desc)
                tm = TRANS_TASK_RE.match(t.desc)
                if sm:
                    state_id = sm.group(1).strip()
                    if not STATE_ID_RE.match(state_id):
                        add_error(
                            "CHAPTER2_STATE_ID_INVALID",
                            "Chapter 2 状态: <state-id> must use stable id (letters/digits/._- only, no prose)",
                            case=t.task_no,
                            desc=t.desc,
                            line=t.line_no,
                        )
                elif tm:
                    src = tm.group(1).strip()
                    dst = tm.group(2).strip()
                    if not STATE_ID_RE.match(src) or not STATE_ID_RE.match(dst):
                        add_error(
                            "CHAPTER2_TRANSITION_ID_INVALID",
                            "Chapter 2 切换 ids must use stable id (letters/digits/._- only, no prose)",
                            case=t.task_no,
                            desc=t.desc,
                            line=t.line_no,
                        )
            elif chapter == 3 and not CASE_TASK_RE.match(t.desc):
                add_error(
                    "CHAPTER3_TOP_TYPE_INVALID",
                    "Chapter 3 top task must start with Case:",
                    case=t.task_no,
                    desc=t.desc,
                    line=t.line_no,
                )
            elif chapter == 3:
                cm = CASE_TASK_RE.match(t.desc)
                case_name = cm.group(1).strip() if cm else ""
                if len(case_name) > 64:
                    add_error(
                        "CHAPTER3_CASE_NAME_TOO_LONG",
                        "Chapter 3 Case name must be concise (<= 64 chars)",
                        case=t.task_no,
                        desc=t.desc,
                        line=t.line_no,
                    )
                if case_name in chapter3_case_names:
                    add_error(
                        "CHAPTER3_CASE_NAME_DUPLICATED",
                        "Chapter 3 Case name must be unique within Chapter 3",
                        case=t.task_no,
                        desc=t.desc,
                        line=t.line_no,
                    )
                chapter3_case_names.add(case_name)
            elif chapter == 4 and not BUG_TASK_RE.match(t.desc):
                add_error(
                    "CHAPTER4_TOP_TYPE_INVALID",
                    "Chapter 4 top task must match BUG-<number>: <description>",
                    case=t.task_no,
                    desc=t.desc,
                    line=t.line_no,
                )
            elif chapter == 4:
                bm = BUG_TASK_RE.match(t.desc)
                bug_desc = bm.group(2).strip() if bm else ""
                if ROOT_CAUSE_HINT_RE.search(bug_desc):
                    add_error(
                        "CHAPTER4_BUG_DESC_SHOULD_BE_OBSERVABLE",
                        "Bug description should be observable behavior, not root-cause speculation",
                        case=t.task_no,
                        desc=t.desc,
                        line=t.line_no,
                    )

            if not t.subtasks:
                add_error(
                    "TOP_LEVEL_SUBTASK_MISSING",
                    f"top task {t.task_no} must have at least one subtask",
                    case=t.task_no,
                    desc=t.desc,
                    line=t.line_no,
                )
                continue

            expected_sub = 1
            parent_top_no = int(t.task_no.split(".")[1])
            for s in t.subtasks:
                if s["chapter"] != chapter or s["task"] != parent_top_no:
                    add_error(
                        "SUBTASK_PREFIX_MISMATCH",
                        f"subtask prefix must match parent {t.task_no}.x",
                        case=f"{s['chapter']}.{s['task']}.{s['sub']}",
                        desc=s["desc"],
                        line=s["line"],
                    )
                if s["sub"] != expected_sub:
                    add_error(
                        "SUBTASK_NUMBER_NOT_CONTIGUOUS",
                        f"subtask numbering must be contiguous under {t.task_no}, expected .{expected_sub}",
                        case=f"{s['chapter']}.{s['task']}.{s['sub']}",
                        desc=s["desc"],
                        line=s["line"],
                    )
                    expected_sub = s["sub"]
                expected_sub += 1

                if chapter == 2 and GENERIC_PLACEHOLDER_RE.search(s["desc"]):
                    add_error(
                        "CHAPTER2_SUBTASK_PLACEHOLDER_FORBIDDEN",
                        "Chapter 2 subtask must be verifiable and cannot be placeholder text",
                        case=f"{s['chapter']}.{s['task']}.{s['sub']}",
                        desc=s["desc"],
                        line=s["line"],
                    )

                expected_child_n = 1
                for c in s["children"]:
                    if c["chapter"] != chapter or c["task"] != parent_top_no or c["sub"] != s["sub"]:
                        add_error(
                            "THIRD_LEVEL_PREFIX_MISMATCH",
                            f"third-level prefix must match parent {chapter}.{parent_top_no}.{s['sub']}.n",
                            case=f"{c['chapter']}.{c['task']}.{c['sub']}.{c['n']}",
                            desc=c["desc"],
                            line=c["line"],
                        )
                    if c["n"] != expected_child_n:
                        add_error(
                            "THIRD_LEVEL_NUMBER_NOT_CONTIGUOUS",
                            f"third-level numbering must be contiguous under {chapter}.{parent_top_no}.{s['sub']}, expected .{expected_child_n}",
                            case=f"{c['chapter']}.{c['task']}.{c['sub']}.{c['n']}",
                            desc=c["desc"],
                            line=c["line"],
                        )
                        expected_child_n = c["n"]
                    expected_child_n += 1

                    if chapter == 2 and GENERIC_PLACEHOLDER_RE.search(c["desc"]):
                        add_error(
                            "CHAPTER2_CHILD_PLACEHOLDER_FORBIDDEN",
                            "Chapter 2 third-level subtask must be verifiable and cannot be placeholder text",
                            case=f"{c['chapter']}.{c['task']}.{c['sub']}.{c['n']}",
                            desc=c["desc"],
                            line=c["line"],
                        )

    # 4) Top-level last-subtask expectation rule.
    for chapter in (1, 2, 3, 4):
        for t in tasks_by_chapter.get(chapter, []):
            if not t.subtasks:
                continue
            last = t.subtasks[-1]
            if has_expectation_semantics(last["desc"]):
                pass
            else:
                children = last["children"]
                if not children:
                    add_error(
                        "LAST_SUBTASK_EXPECTATION_MISSING",
                        f"last subtask of {t.task_no} must contain expectation semantics or all children with expectation semantics",
                        case=f"{last['chapter']}.{last['task']}.{last['sub']}",
                        desc=last["desc"],
                        line=last["line"],
                    )
                else:
                    for c in children:
                        if not has_expectation_semantics(c["desc"]):
                            add_error(
                                "LAST_SUBTASK_CHILD_EXPECTATION_MISSING",
                                f"child under last subtask of {t.task_no} must contain expectation semantics",
                                case=f"{c['chapter']}.{c['task']}.{c['sub']}.{c['n']}",
                                desc=c["desc"],
                                line=c["line"],
                            )

    # 5) Expectation marker rule.
    def check_expectation_line(text: str, line_no: int):
        if not has_expectation_semantics(text):
            return
        if not EXPECT_MARKER_RE.search(text):
            add_error(
                "EXPECTATION_MARKER_MISSING",
                "expectation semantics must use #期望: [...]",
                line=line_no,
            )

    for chapter in (1, 2, 3, 4):
        for t in tasks_by_chapter.get(chapter, []):
            for s in t.subtasks:
                check_expectation_line(s["desc"], s["line"])
                for c in s["children"]:
                    check_expectation_line(c["desc"], c["line"])

    # 6) Chapter 2 reference integrity to Chapter 3/4.
    states: Dict[str, Dict[str, str]] = {}
    transitions: Dict[str, Dict[str, str]] = {}

    for t in tasks_by_chapter.get(2, []):
        sm = STATE_TASK_RE.match(t.desc)
        if sm:
            states[sm.group(1).strip()] = {"task_no": t.task_no, "desc": t.desc}
            continue
        tm = TRANS_TASK_RE.match(t.desc)
        if tm:
            trans_id = f"{tm.group(1).strip()} -> {tm.group(2).strip()}"
            transitions[trans_id] = {"task_no": t.task_no, "desc": t.desc}

    refs_ch34: Set[str] = set()
    for chapter in (3, 4):
        for t in tasks_by_chapter.get(chapter, []):
            if chapter == 3:
                has_ch2_ref = False
            for s in t.subtasks:
                for text in [s["desc"]] + [c["desc"] for c in s["children"]]:
                    sm = STATE_REF_RE.match(text)
                    if sm:
                        refs_ch34.add(sm.group(1).strip())
                        if chapter == 3:
                            has_ch2_ref = True
                    tm = TRANS_REF_RE.match(text)
                    if tm:
                        refs_ch34.add(f"{tm.group(1).strip()} -> {tm.group(2).strip()}")
                        if chapter == 3:
                            has_ch2_ref = True
            if chapter == 3 and not has_ch2_ref:
                add_error(
                    "CHAPTER3_CASE_REFERENCE_MISSING",
                    "Chapter 3 case must explicitly reference Chapter 2 状态: or 切换:",
                    case=t.task_no,
                    desc=t.desc,
                    line=t.line_no,
                )
            if chapter == 4:
                bug_texts: List[str] = []
                for s in t.subtasks:
                    bug_texts.append(s["desc"])
                    for c in s["children"]:
                        bug_texts.append(c["desc"])
                if bug_texts:
                    has_step = any(EXPECT_MARKER_RE.search(x) is None for x in bug_texts)
                    has_before_assert = any(
                        ("修复前" in x) and (EXPECT_MARKER_RE.search(x) is not None)
                        for x in bug_texts
                    )
                    has_after_assert = any(
                        ("修复后" in x) and (EXPECT_MARKER_RE.search(x) is not None)
                        for x in bug_texts
                    )
                    if not has_step:
                        add_error(
                            "CHAPTER4_BUG_REPRO_STEP_MISSING",
                            "Chapter 4 bug task must include at least one 问题复现步骤 (without #期望)",
                            case=t.task_no,
                            desc=t.desc,
                            line=t.line_no,
                        )
                    if not has_before_assert:
                        add_error(
                            "CHAPTER4_BUG_BEFORE_ASSERT_MISSING",
                            "Chapter 4 bug task must include at least one 修复前断言 with #期望: [...]",
                            case=t.task_no,
                            desc=t.desc,
                            line=t.line_no,
                        )
                    if not has_after_assert:
                        add_error(
                            "CHAPTER4_BUG_AFTER_ASSERT_MISSING",
                            "Chapter 4 bug task must include at least one 修复后断言 with #期望: [...]",
                            case=t.task_no,
                            desc=t.desc,
                            line=t.line_no,
                        )

    all_items = set(states.keys()) | set(transitions.keys())
    if all_items:
        graph: Dict[str, List[str]] = defaultdict(list)
        for tr in transitions.keys():
            parts = tr.split(" -> ")
            if len(parts) == 2:
                graph[tr].append(parts[0])
                graph[tr].append(parts[1])

        reachable: Set[str] = set()
        queue = deque([x for x in refs_ch34 if x in all_items])
        visited = set(queue)
        while queue:
            cur = queue.popleft()
            reachable.add(cur)
            for item, refs in graph.items():
                if cur in refs and item not in visited:
                    visited.add(item)
                    queue.append(item)

        for item in sorted(all_items):
            if item not in reachable and item not in refs_ch34:
                if item in states:
                    add_error(
                        "CHAPTER2_STATE_ISOLATED",
                        f"Chapter 2 state `{item}` is isolated (no path to Chapter 3/4)",
                        case=states[item]["task_no"],
                        desc=states[item]["desc"],
                    )
                else:
                    add_error(
                        "CHAPTER2_TRANSITION_ISOLATED",
                        f"Chapter 2 transition `{item}` is isolated (no path to Chapter 3/4)",
                        case=transitions[item]["task_no"],
                        desc=transitions[item]["desc"],
                    )

    return len(errors) == 0, errors


def main():
    args = parse_args()
    try:
        path = resolve_path(args.change_name, args.file)
    except Exception as e:
        if args.json:
            print(
                json.dumps(
                    [
                        {
                            "case": "global",
                            "desc": "",
                            "error_code": "PATH_RESOLVE_ERROR",
                            "error_msg": str(e),
                        }
                    ],
                    ensure_ascii=False,
                )
            )
        else:
            print(f"Error: {e}")
        sys.exit(1)

    content = path.read_text(encoding="utf-8")
    ok, errors = validate(path, content)

    if args.json:
        print(json.dumps(errors, ensure_ascii=False))
        sys.exit(0 if ok else 1)

    print("\n=== Validation Result ===")
    if ok:
        print("✓ PASS - All validations passed")
        sys.exit(0)

    print("✗ FAIL - Validation errors found:")
    for e in errors:
        print(f"  [{e['error_code']}] case={e['case']} desc={e['desc']} :: {e['error_msg']}")
    sys.exit(1)


if __name__ == "__main__":
    main()
