#!/usr/bin/env python3
"""
Validate test implementation correspondence between test_tasks.md and spec files.

Modes:
- change (default): resolve from change name and project test dirs
- test: resolve from a single test_tasks file and same-directory prefixed sample specs

Usage:
    python3 skill-scripts/validate_test_case_refs.py <change-name>
    python3 skill-scripts/validate_test_case_refs.py --mode=test --file tests/skills/data/impls/test_tasks-01-foo.md

Exit codes:
    0 - pass
    1 - fail
"""

import argparse
import ast
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

CHAPTER_RE = re.compile(r"^##\s*(\d+)\.?\s+(.+)$")
TOP_RE = re.compile(r"^(\s*)-\s*\[([ ✓✗x])\]\s*(\d+\.\d+)\s+(.+)$")
L2_RE = re.compile(r"^(\s{2})-\s*\[([ ✓✗x])\]\s*(\d+\.\d+\.\d+)\s+(.+)$")
L3_RE = re.compile(r"^(\s{4})-\s*\[([ ✓✗x])\]\s*(\d+\.\d+\.\d+\.\d+)\s+(.+)$")

CASE_START_RE = re.compile(r"\b(?:it|test)\s*\(\s*(['\"])(.*?)\1")
COMMENT_ID_RE = re.compile(r"^\s*//\s*(\d+\.\d+\.\d+(?:\.\d+)?)\b")
EXPECT_RE = re.compile(r"#期望:\s*(\[[^\]]*\])")


@dataclass
class L3Task:
    id: str
    desc: str
    checked: bool


@dataclass
class L2Task:
    id: str
    desc: str
    checked: bool
    children: List[L3Task] = field(default_factory=list)


@dataclass
class TopTask:
    chapter: int
    id: str
    desc: str
    checked: bool
    l2: List[L2Task] = field(default_factory=list)


@dataclass
class CaseBlock:
    name: str
    id: str
    body: str


@dataclass
class CommentBlock:
    id: str
    start: int
    end: int
    text: str


@dataclass
class ValidationError:
    case: str
    desc: str
    error_code: str
    error_msg: str


@dataclass
class CommentEntry:
    id: str
    line_idx: int


def _scan_with_states(text: str, start: int = 0):
    i = start
    n = len(text)
    in_sq = False
    in_dq = False
    in_bq = False
    in_line_comment = False
    in_block_comment = False
    escaped = False
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
            yield i, ch, in_sq, in_dq, in_bq, in_line_comment, in_block_comment
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                yield i, ch, in_sq, in_dq, in_bq, in_line_comment, in_block_comment
                i += 1
                yield i, text[i], in_sq, in_dq, in_bq, in_line_comment, in_block_comment
                in_block_comment = False
                i += 1
                continue
            yield i, ch, in_sq, in_dq, in_bq, in_line_comment, in_block_comment
            i += 1
            continue

        if in_sq:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == "'":
                in_sq = False
            yield i, ch, in_sq, in_dq, in_bq, in_line_comment, in_block_comment
            i += 1
            continue

        if in_dq:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_dq = False
            yield i, ch, in_sq, in_dq, in_bq, in_line_comment, in_block_comment
            i += 1
            continue

        if in_bq:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == "`":
                in_bq = False
            yield i, ch, in_sq, in_dq, in_bq, in_line_comment, in_block_comment
            i += 1
            continue

        # normal state
        if ch == "/" and nxt == "/":
            in_line_comment = True
            yield i, ch, in_sq, in_dq, in_bq, in_line_comment, in_block_comment
            i += 1
            yield i, text[i], in_sq, in_dq, in_bq, in_line_comment, in_block_comment
            i += 1
            continue
        if ch == "/" and nxt == "*":
            in_block_comment = True
            yield i, ch, in_sq, in_dq, in_bq, in_line_comment, in_block_comment
            i += 1
            yield i, text[i], in_sq, in_dq, in_bq, in_line_comment, in_block_comment
            i += 1
            continue
        if ch == "'":
            in_sq = True
        elif ch == '"':
            in_dq = True
        elif ch == "`":
            in_bq = True

        yield i, ch, in_sq, in_dq, in_bq, in_line_comment, in_block_comment
        i += 1


def _find_call_bounds(text: str, call_start: int) -> Optional[Tuple[int, int]]:
    open_paren = text.find("(", call_start)
    if open_paren == -1:
        return None

    depth = 0
    for i, ch, in_sq, in_dq, in_bq, in_line_comment, in_block_comment in _scan_with_states(text, open_paren):
        if in_sq or in_dq or in_bq or in_line_comment or in_block_comment:
            continue
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return open_paren, i
    return None


def _split_top_level_args(text: str, open_paren: int, close_paren: int) -> List[Tuple[int, int]]:
    args: List[Tuple[int, int]] = []
    seg_start = open_paren + 1
    p_depth = 0
    b_depth = 0
    s_depth = 0

    for i, ch, in_sq, in_dq, in_bq, in_line_comment, in_block_comment in _scan_with_states(text, open_paren + 1):
        if i >= close_paren:
            break
        if in_sq or in_dq or in_bq or in_line_comment or in_block_comment:
            continue
        if ch == "(":
            p_depth += 1
        elif ch == ")":
            p_depth -= 1
        elif ch == "{":
            b_depth += 1
        elif ch == "}":
            b_depth -= 1
        elif ch == "[":
            s_depth += 1
        elif ch == "]":
            s_depth -= 1
        elif ch == "," and p_depth == 0 and b_depth == 0 and s_depth == 0:
            args.append((seg_start, i))
            seg_start = i + 1

    args.append((seg_start, close_paren))
    return args


def _trim_span(text: str, span: Tuple[int, int]) -> Optional[Tuple[int, int]]:
    start, end = span
    while start < end and text[start].isspace():
        start += 1
    while end > start and text[end - 1].isspace():
        end -= 1
    if start >= end:
        return None
    return start, end


def _find_callback_body_open(text: str, arg_span: Tuple[int, int]) -> Optional[int]:
    start, end = arg_span
    i = start
    while i < end - 1:
        ch = text[i]
        nxt = text[i + 1]
        # skip strings/comments quickly
        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            escaped = False
            while i < end:
                c = text[i]
                if escaped:
                    escaped = False
                elif c == "\\":
                    escaped = True
                elif c == quote:
                    i += 1
                    break
                i += 1
            continue
        if ch == "/" and nxt == "/":
            i += 2
            while i < end and text[i] != "\n":
                i += 1
            continue
        if ch == "/" and nxt == "*":
            i += 2
            while i < end - 1:
                if text[i] == "*" and text[i + 1] == "/":
                    i += 2
                    break
                i += 1
            continue

        if ch == "=" and nxt == ">":
            j = i + 2
            while j < end and text[j].isspace():
                j += 1
            if j < end and text[j] == "{":
                return j
        i += 1

    # function (...) { ... }
    fn_pos = text.find("function", start, end)
    if fn_pos != -1:
        brace = text.find("{", fn_pos, end)
        if brace != -1:
            return brace
    return None


def _find_matching_brace(text: str, open_brace: int) -> Optional[int]:
    depth = 0
    for i, ch, in_sq, in_dq, in_bq, in_line_comment, in_block_comment in _scan_with_states(text, open_brace):
        if in_sq or in_dq or in_bq or in_line_comment or in_block_comment:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate test case refs")
    parser.add_argument("change_name", nargs="?", help="change name")
    parser.add_argument("--change", help="alias of positional change name")
    parser.add_argument("--test-dir", default="tests", help="tests base dir")
    parser.add_argument("--mode", choices=["change", "test"], default="change")
    parser.add_argument("--file", help="path to test_tasks.md when --mode=test")
    parser.add_argument("--json", action="store_true", help="output structured errors as JSON array")
    parser.add_argument("--cases", help="comma-separated case IDs to validate (e.g., 1.1,1.2,2.1). When set, only validates these cases and skips checking for extra cases in test that are not in tasks.")
    return parser.parse_args()


def normalize_bool(ch: str) -> bool:
    return ch in ("✓", "x")


def parse_test_tasks(path: Path) -> List[TopTask]:
    content = path.read_text(encoding="utf-8")
    lines = content.splitlines()

    chapter = 0
    tasks: List[TopTask] = []
    current_top: Optional[TopTask] = None
    current_l2: Optional[L2Task] = None

    for raw in lines:
        s = raw.rstrip("\n")
        stripped = s.strip()
        if not stripped:
            continue

        hm = CHAPTER_RE.match(stripped)
        if hm:
            chapter = int(hm.group(1))
            current_top = None
            current_l2 = None
            continue

        tm = TOP_RE.match(s)
        if tm and len(tm.group(1)) == 0:
            top = TopTask(
                chapter=chapter,
                id=tm.group(3),
                desc=tm.group(4).strip(),
                checked=normalize_bool(tm.group(2)),
            )
            tasks.append(top)
            current_top = top
            current_l2 = None
            continue

        lm = L2_RE.match(s)
        if lm and current_top is not None:
            l2 = L2Task(
                id=lm.group(3),
                desc=lm.group(4).strip(),
                checked=normalize_bool(lm.group(2)),
            )
            current_top.l2.append(l2)
            current_l2 = l2
            continue

        cm = L3_RE.match(s)
        if cm and current_l2 is not None:
            l3 = L3Task(
                id=cm.group(3),
                desc=cm.group(4).strip(),
                checked=normalize_bool(cm.group(2)),
            )
            current_l2.children.append(l3)
            continue

    return tasks


def parse_case_blocks(spec_path: Path) -> Dict[str, CaseBlock]:
    if not spec_path.exists():
        return {}
    text = spec_path.read_text(encoding="utf-8")
    out: Dict[str, CaseBlock] = {}

    for m in CASE_START_RE.finditer(text):
        case_name = m.group(2)
        idm = re.match(r"\s*(\d+(?:\.\d+)+)\b", case_name)
        if not idm:
            continue
        case_id = idm.group(1)

        bounds = _find_call_bounds(text, m.start())
        if bounds is None:
            continue
        open_paren, close_paren = bounds

        arg_spans = _split_top_level_args(text, open_paren, close_paren)
        if not arg_spans:
            continue

        last_arg = _trim_span(text, arg_spans[-1])
        if last_arg is None:
            continue

        open_brace = _find_callback_body_open(text, last_arg)
        if open_brace is None:
            # fallback to legacy behavior for uncommon signatures
            open_brace = text.find("{", m.end(), close_paren + 1)
            if open_brace == -1:
                continue

        end = _find_matching_brace(text, open_brace)
        if end is None:
            continue

        body = text[open_brace + 1:end]
        out[case_id] = CaseBlock(name=case_name, id=case_id, body=body)

    return out


def parse_case_id_sequence(spec_path: Optional[Path]) -> List[Tuple[str, str]]:
    """Return ordered (case_id, case_name) list as they appear in file."""
    if spec_path is None or not spec_path.exists():
        return []
    text = spec_path.read_text(encoding="utf-8")
    out: List[Tuple[str, str]] = []
    for m in CASE_START_RE.finditer(text):
        case_name = m.group(2)
        idm = re.match(r"\s*(\d+(?:\.\d+)+)\b", case_name)
        if not idm:
            continue
        out.append((idm.group(1), case_name))
    return out


def parse_id_tuple(id_text: str) -> Tuple[int, ...]:
    return tuple(int(x) for x in id_text.split("."))


def check_case_order(spec_path: Optional[Path], errors: List[ValidationError]) -> None:
    seq = parse_case_id_sequence(spec_path)
    prev_id: Optional[str] = None
    for cid, cname in seq:
        if prev_id is not None and parse_id_tuple(cid) <= parse_id_tuple(prev_id):
            errors.append(ValidationError(
                case=cid,
                desc=cname,
                error_code="CASE_ORDER_INVALID",
                error_msg=f"case `{cid}` appears after `{prev_id}` but is not in increasing order",
            ))
        prev_id = cid


def parse_comment_entries(case_body: str) -> List[CommentEntry]:
    entries: List[CommentEntry] = []
    lines = case_body.splitlines()
    for idx, line in enumerate(lines):
        m = COMMENT_ID_RE.match(line)
        if m:
            entries.append(CommentEntry(id=m.group(1), line_idx=idx))
    return entries


def _is_upper_comment(cur_id: str, next_id: str) -> bool:
    cur_parts = cur_id.split(".")
    next_parts = next_id.split(".")
    if len(next_parts) >= len(cur_parts):
        return False
    return cur_parts[:len(next_parts)] == next_parts


def parse_comment_blocks(case_body: str) -> Dict[str, CommentBlock]:
    lines = case_body.splitlines()
    entries = parse_comment_entries(case_body)

    blocks: Dict[str, CommentBlock] = {}
    for i, entry in enumerate(entries):
        cid = entry.id
        start = entry.line_idx
        end = len(lines)
        cur_level = len(cid.split("."))

        for j in range(i + 1, len(entries)):
            nxt = entries[j]
            next_level = len(nxt.id.split("."))
            if next_level == cur_level or _is_upper_comment(cid, nxt.id):
                end = nxt.line_idx
                break

        text = "\n".join(lines[start + 1:end])
        blocks[cid] = CommentBlock(id=cid, start=start, end=end, text=text)
    return blocks


def parse_comment_id_sequence(case_body: str) -> List[str]:
    return [x.id for x in parse_comment_entries(case_body)]


def check_comment_order(case: CaseBlock, errors: List[ValidationError]) -> None:
    seq = parse_comment_id_sequence(case.body)
    prev_id: Optional[str] = None
    for cid in seq:
        if prev_id is not None and parse_id_tuple(cid) <= parse_id_tuple(prev_id):
            errors.append(ValidationError(
                case=cid,
                desc=case.name,
                error_code="COMMENT_ORDER_INVALID",
                error_msg=f"comment `{cid}` appears after `{prev_id}` but is not in increasing order",
            ))
        prev_id = cid


def has_actual_content(block_text: str) -> bool:
    for raw in block_text.splitlines():
        s = raw.strip()
        if not s:
            continue
        if s.startswith("//"):
            continue
        if re.match(r"^[{}();,]+$", s):
            continue
        return True
    return False


def extract_expect_values(desc: str) -> Optional[List[object]]:
    m = EXPECT_RE.search(desc)
    if not m:
        return None
    try:
        v = ast.literal_eval(m.group(1))
        if isinstance(v, list):
            return v
    except Exception:
        pass
    return []


def extract_assertion_lines(block_text: str) -> List[str]:
    lines: List[str] = []
    for raw in block_text.splitlines():
        s = raw.strip()
        if "expect(" in s:
            lines.append(s)
    return lines


def expected_value_matches(assertion_lines: List[str], value: object) -> bool:
    if not assertion_lines:
        return False
    joined = "\n".join(assertion_lines)
    if isinstance(value, str):
        return (f"'{value}'" in joined) or (f'"{value}"' in joined)
    if isinstance(value, bool):
        return ("true" if value else "false") in joined.lower()
    return str(value) in joined


def check_expectation_block(desc: str, block: CommentBlock, item_id: str, errors: List[ValidationError]):
    values = extract_expect_values(desc)
    if values is None:
        return
    assertion_lines = extract_assertion_lines(block.text)
    if not assertion_lines:
        errors.append(ValidationError(
            case=item_id,
            desc=desc,
            error_code="EXPECT_ASSERTION_MISSING",
            error_msg=f"{item_id} has #期望 but no assertion in corresponding block",
        ))
        return
    for v in values:
        if not expected_value_matches(assertion_lines, v):
            errors.append(ValidationError(
                case=item_id,
                desc=desc,
                error_code="EXPECT_VALUE_MISMATCH",
                error_msg=f"{item_id} expected value `{v}` not found in assertions",
            ))


def resolve_paths(args: argparse.Namespace) -> Tuple[Path, Dict[str, Path]]:
    change_name = args.change_name or args.change

    if args.mode == "test":
        if not args.file:
            raise ValueError("--file is required when --mode=test")
        task_path = Path(args.file)
        if not task_path.exists():
            raise FileNotFoundError(f"task file not found: {task_path}")
        m = re.match(r"^test_tasks-(\d{2}-[a-z0-9-]+)\.md$", task_path.name)
        if not m:
            raise ValueError(
                f"invalid task file name `{task_path.name}`, expected test_tasks-NN-<case-name>.md"
            )
        suffix = m.group(1)
        base = task_path.parent

        def pick(prefix: str) -> Optional[Path]:
            for ext in (".spec.ts", ".spec.test"):
                p = base / f"{prefix}-{suffix}{ext}"
                if p.exists():
                    return p
            return None

        files = {
            "unit": pick("test-unit"),
            "e2e": pick("test-e2e"),
            "bug": pick("test-bug"),
            "bugfix": pick("test-bug-fix"),
        }
        return task_path, files

    if not change_name:
        raise ValueError("change_name is required in change mode")

    task_path = Path("openspec/changes") / change_name / "test_tasks.md"
    if not task_path.exists():
        raise FileNotFoundError(f"task file not found: {task_path}")

    unit_dir = Path(args.test_dir) / "unit" / change_name
    e2e_dir = Path(args.test_dir) / "e2e" / change_name

    def pick_change(dir_path: Path, basename: str) -> Optional[Path]:
        for ext in (".spec.ts", ".spec.test"):
            p = dir_path / f"{basename}{ext}"
            if p.exists():
                return p
        return None

    files = {
        "unit": pick_change(unit_dir, change_name),
        "e2e": pick_change(e2e_dir, change_name),
        "bug": pick_change(e2e_dir, f"bug-{change_name}"),
        "bugfix": pick_change(e2e_dir, f"bugfix-{change_name}"),
    }
    return task_path, files


def check_top_case_mapping(tasks: List[TopTask], cases: Dict[str, Dict[str, CaseBlock]], errors: List[ValidationError]):
    for t in tasks:
        prefix = t.id
        if t.chapter == 1:
            if prefix not in cases["unit"]:
                errors.append(ValidationError(case=t.id, desc=t.desc, error_code="CASE_MISSING", error_msg=f"missing unit case for {prefix}"))
        elif t.chapter in (2, 3):
            if prefix not in cases["e2e"]:
                errors.append(ValidationError(case=t.id, desc=t.desc, error_code="CASE_MISSING", error_msg=f"missing e2e case for {prefix}"))
        elif t.chapter == 4:
            # bugfix is always required
            if prefix not in cases["bugfix"]:
                errors.append(ValidationError(case=t.id, desc=t.desc, error_code="CASE_MISSING", error_msg=f"missing bug-fix case for {prefix}"))

            has_checked_after = any(
                ("修复后" in l2.desc and l2.checked)
                or any(("修复后" in c.desc and c.checked) for c in l2.children)
                for l2 in t.l2
            )
            if (not has_checked_after) and (prefix not in cases["bug"]):
                errors.append(ValidationError(case=t.id, desc=t.desc, error_code="CASE_MISSING", error_msg=f"missing bug case for {prefix}"))


def check_reverse_mapping(tasks: List[TopTask], cases: Dict[str, Dict[str, CaseBlock]], errors: List[ValidationError]):
    """反向验证：检查顶层任务是否出现在 test/it 中，二三级任务是否出现在注释中"""

    # 收集所有顶层任务标号
    top_level_ids: Set[str] = set()  # x.x 格式
    all_l2_ids: Set[str] = set()     # x.x.x 格式
    all_l3_ids: Set[str] = set()     # x.x.x.n 格式

    for t in tasks:
        top_level_ids.add(t.id)
        for l2 in t.l2:
            all_l2_ids.add(l2.id)
            for l3 in l2.children:
                all_l3_ids.add(l3.id)

    # 收集 spec 文件中出现在 test/it 名称中的顶层编号
    case_ids_in_tests: Set[str] = set()
    for route_cases in cases.values():
        for cid, case_block in route_cases.items():
            case_ids_in_tests.add(cid)

    # 检查顶层任务是否出现在 test/it 中
    missing_top_cases = top_level_ids - case_ids_in_tests
    for missing_id in missing_top_cases:
        task = next((t for t in tasks if t.id == missing_id), None)
        task_desc = task.desc if task else missing_id
        errors.append(ValidationError(
            case=missing_id,
            desc=task_desc,
            error_code="CASE_POSITION_INVALID",
            error_msg=f"顶层任务 `{missing_id}` 未出现在任何 test/it 名称中，应写在 test/it 名称中，如: it('{missing_id} 描述', () => {{ ... }})",
        ))

    # 收集 spec 文件中出现在注释中的二三级编号
    l2_ids_in_comments: Set[str] = set()
    l3_ids_in_comments: Set[str] = set()

    for route_cases in cases.values():
        for case_block in route_cases.values():
            comment_ids = parse_comment_id_sequence(case_block.body)
            for comment_id in comment_ids:
                parts = comment_id.split(".")
                if len(parts) == 3:
                    l2_ids_in_comments.add(comment_id)
                elif len(parts) == 4:
                    l3_ids_in_comments.add(comment_id)

    # 检查二级任务是否出现在注释中
    missing_l2 = all_l2_ids - l2_ids_in_comments
    for missing_id in missing_l2:
        task = next((t for t in tasks for l2 in t.l2 if l2.id == missing_id), None)
        task_desc = task.desc if task else missing_id
        errors.append(ValidationError(
            case=missing_id,
            desc=task_desc,
            error_code="COMMENT_POSITION_INVALID",
            error_msg=f"二级任务 `{missing_id}` 未出现在任何注释中，应写在注释中，如: // {missing_id} 步骤描述",
        ))

    # 检查三级任务是否出现在注释中
    missing_l3 = all_l3_ids - l3_ids_in_comments
    for missing_id in missing_l3:
        task = next((t for t in tasks for l2 in t.l2 for l3 in l2.children if l3.id == missing_id), None)
        task_desc = task.desc if task else missing_id
        errors.append(ValidationError(
            case=missing_id,
            desc=task_desc,
            error_code="COMMENT_POSITION_INVALID",
            error_msg=f"三级任务 `{missing_id}` 未出现在任何注释中，应写在注释中，如: // {missing_id} 子步骤描述",
        ))


def check_case_comments_for_task(
    task: TopTask,
    case: CaseBlock,
    *,
    route: str,
    errors: List[ValidationError],
):
    comments = parse_comment_blocks(case.body)

    def should_require_item(desc: str) -> bool:
        if task.chapter != 4:
            return True
        if route == "bug":
            return "修复后" not in desc
        if route == "bugfix":
            return "修复前" not in desc
        return True

    # route control for chapter4 expectations
    def should_check_expect(desc: str) -> bool:
        if task.chapter != 4:
            return True
        if "修复前" in desc:
            return route == "bug"
        if "修复后" in desc:
            return route == "bugfix"
        return True

    for l2 in task.l2:
        if not should_require_item(l2.desc) and not l2.children:
            continue
        if l2.id not in comments:
            errors.append(ValidationError(case=l2.id, desc=l2.desc, error_code="COMMENT_MISSING", error_msg=f"missing comment {l2.id} in case {task.id}"))
            continue
        l2_block = comments[l2.id]

        # L2 block itself must have actual content, even when it has L3 children.
        if not has_actual_content(l2_block.text):
            errors.append(ValidationError(
                case=l2.id,
                desc=l2.desc,
                error_code="BLOCK_CONTENT_MISSING",
                error_msg=f"{l2.id} block has no actual content",
            ))

        if not l2.children:
            if should_check_expect(l2.desc):
                check_expectation_block(l2.desc, l2_block, l2.id, errors)
            continue

        # has level3 children: check each level3 block
        for c in l2.children:
            if not should_require_item(c.desc):
                continue
            if c.id not in comments:
                errors.append(ValidationError(case=c.id, desc=c.desc, error_code="COMMENT_MISSING", error_msg=f"missing comment {c.id} in case {task.id}"))
                continue
            c_block = comments[c.id]
            if not has_actual_content(c_block.text):
                errors.append(ValidationError(
                    case=c.id,
                    desc=c.desc,
                    error_code="BLOCK_CONTENT_MISSING",
                    error_msg=f"{c.id} block has no actual content",
                ))
            if should_check_expect(c.desc):
                check_expectation_block(c.desc, c_block, c.id, errors)


def ensure_opposite_route_not_matched(
    task: TopTask,
    case: CaseBlock,
    *,
    route: str,
    errors: List[ValidationError],
):
    if task.chapter != 4:
        return
    comments = parse_comment_blocks(case.body)
    for l2 in task.l2:
        targets = l2.children if l2.children else [l2]
        for item in targets:
            desc = item.desc
            vals = extract_expect_values(desc)
            if vals is None:
                continue
            if item.id not in comments:
                continue
            block = comments[item.id]
            assertion_lines = extract_assertion_lines(block.text)
            if not assertion_lines:
                continue

            if ("修复前" in desc and route == "bugfix") or ("修复后" in desc and route == "bug"):
                # opposite file should not carry this expectation mapping
                if all(expected_value_matches(assertion_lines, v) for v in vals):
                    errors.append(ValidationError(
                        case=item.id,
                        desc=item.desc,
                        error_code="CH4_ROUTE_CONFLICT",
                        error_msg=f"{item.id} expectation appears in wrong route `{route}`",
                    ))


def validate(task_path: Path, files: Dict[str, Optional[Path]], cases_filter: Optional[Set[str]] = None) -> Tuple[bool, List[ValidationError]]:
    tasks = parse_test_tasks(task_path)
    errors: List[ValidationError] = []

    # 如果指定了 cases_filter，只保留匹配的 case
    def filter_cases(case_blocks: Dict[str, CaseBlock]) -> Dict[str, CaseBlock]:
        if cases_filter is None:
            return case_blocks
        return {k: v for k, v in case_blocks.items() if k in cases_filter}

    cases = {
        "unit": filter_cases(parse_case_blocks(files["unit"]) if files.get("unit") else {}),
        "e2e": filter_cases(parse_case_blocks(files["e2e"]) if files.get("e2e") else {}),
        "bug": filter_cases(parse_case_blocks(files["bug"]) if files.get("bug") else {}),
        "bugfix": filter_cases(parse_case_blocks(files["bugfix"]) if files.get("bugfix") else {}),
    }

    # 当指定 cases_filter 时，只检查过滤后的 tasks
    tasks_to_check = [t for t in tasks if cases_filter is None or t.id in cases_filter]

    for key in ("unit", "e2e", "bug", "bugfix"):
        check_case_order(files.get(key), errors)

    check_top_case_mapping(tasks_to_check, cases, errors)

    # 反向验证：检查任务是否出现在正确的位置（始终执行）
    check_reverse_mapping(tasks_to_check, cases, errors)

    chapter1_ids = {t.id for t in tasks if t.chapter == 1}
    chapter23_ids = {t.id for t in tasks if t.chapter in (2, 3)}
    chapter4_ids = {t.id for t in tasks if t.chapter == 4}
    task_by_id = {t.id: t for t in tasks}

    route_allowed_top = {
        "unit": chapter1_ids,
        "e2e": chapter23_ids,
        "bug": chapter4_ids,
        "bugfix": chapter4_ids,
    }

    # 只有未指定 cases_filter 时才检查 test 中是否有 extra cases（不在 tasks 中）
    if cases_filter is None:
        for route in ("unit", "e2e", "bug", "bugfix"):
            for cid, case_block in cases[route].items():
                if cid not in route_allowed_top[route]:
                    errors.append(ValidationError(
                        case=cid,
                        desc=case_block.name,
                        error_code="EXTRA_CASE_UNMAPPED",
                        error_msg=f"extra case `{cid}` in {route} file has no mapping in test_tasks.md",
                    ))
                    continue

                task = task_by_id.get(cid)
                if task is None:
                    continue

                allowed_comment_ids = {l2.id for l2 in task.l2}
                for l2 in task.l2:
                    for c in l2.children:
                        allowed_comment_ids.add(c.id)

                for comment_id in parse_comment_id_sequence(case_block.body):
                    if comment_id not in allowed_comment_ids:
                        errors.append(ValidationError(
                            case=comment_id,
                            desc=case_block.name,
                            error_code="EXTRA_COMMENT_UNMAPPED",
                            error_msg=f"extra comment `{comment_id}` in case `{cid}` has no mapping in test_tasks.md",
                        ))

    # per chapter comment/block/assertion checks
    # 当指定 cases_filter 时，只检查过滤后的 tasks
    tasks_to_check = [t for t in tasks if cases_filter is None or t.id in cases_filter]

    for t in tasks_to_check:
        if t.chapter == 1 and t.id in cases["unit"]:
            check_comment_order(cases["unit"][t.id], errors)
            check_case_comments_for_task(t, cases["unit"][t.id], route="unit", errors=errors)
        elif t.chapter in (2, 3) and t.id in cases["e2e"]:
            check_comment_order(cases["e2e"][t.id], errors)
            check_case_comments_for_task(t, cases["e2e"][t.id], route="e2e", errors=errors)
        elif t.chapter == 4:
            if t.id in cases["bug"]:
                check_comment_order(cases["bug"][t.id], errors)
                check_case_comments_for_task(t, cases["bug"][t.id], route="bug", errors=errors)
                ensure_opposite_route_not_matched(
                    t,
                    cases["bug"][t.id],
                    route="bug",
                    errors=errors,
                )
            if t.id in cases["bugfix"]:
                check_comment_order(cases["bugfix"][t.id], errors)
                check_case_comments_for_task(t, cases["bugfix"][t.id], route="bugfix", errors=errors)
                ensure_opposite_route_not_matched(
                    t,
                    cases["bugfix"][t.id],
                    route="bugfix",
                    errors=errors,
                )

    return len(errors) == 0, errors


def main() -> None:
    args = parse_args()

    # 解析 cases_filter
    cases_filter: Optional[Set[str]] = None
    if args.cases:
        cases_filter = set(args.cases.split(","))
        print(f"Validating only cases: {', '.join(sorted(cases_filter))}")

    try:
        task_path, files = resolve_paths(args)
    except Exception as e:
        if args.json:
            print(json.dumps([{"case": "global", "desc": "", "error_code": "PATH_RESOLVE_ERROR", "error_msg": str(e)}], ensure_ascii=False))
        else:
            print(f"Error: {e}")
        sys.exit(1)

    ok, errs = validate(task_path, files, cases_filter)
    if args.json:
        payload = [{"case": e.case, "desc": e.desc, "error_code": e.error_code, "error_msg": e.error_msg} for e in errs]
        print(json.dumps(payload, ensure_ascii=False))
        sys.exit(0 if ok else 1)

    print("\n=== Validation Result ===")
    if ok:
        print("✓ PASS - All validations passed")
        sys.exit(0)

    print("✗ FAIL - Validation errors found:")
    for e in errs:
        print(f"  [{e.error_code}] case={e.case} desc={e.desc} :: {e.error_msg}")
    sys.exit(1)


if __name__ == "__main__":
    main()
