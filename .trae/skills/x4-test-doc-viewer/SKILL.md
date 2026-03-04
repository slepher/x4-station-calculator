---
name: x4-test-doc-viewer
description: "Review final test documentation draft for X4 and gate x4-test-doc completion. Must run in a dedicated isolated subagent. Trigger with /x4:test-doc-viewer <change-name>."
---

# X4 Test Documentation Reviewer

This skill is review-only. It audits the final `test_tasks.md` and `ui_knowledge.md` draft and returns pass/rewrite decision.

## Trigger

User invokes `/x4:test-doc-viewer <change_name>`

## Purpose

Provide a strict reviewer gate for test documentation quality.  
If review fails, return actionable rewrite items and hand back to `/x4:test-doc`.

## Execution Mode (MANDATORY)

`x4-test-doc-viewer` MUST run in a dedicated reviewer subagent to avoid context pollution.

1. Launch a dedicated reviewer subagent for each review round.
2. Do not inherit full parent thread context; pass minimal handoff payload only.
3. Recommended handoff payload:
   - resolved `change-name`
   - target file paths (`test_tasks.md`, `ui_knowledge.md`)
   - optional prior blocking issues id list (if this is a resubmission round)
4. If reviewer subagent cannot be started, stop with blocker; do not downgrade to in-thread review.

## Parameters

- `<change_name>`: target change folder under `openspec/changes/`.
- `<change_name>` accepts abbreviation token and must be resolved by `x4-user-workflow` "Change Name Resolution" rules.

## Change Name Resolution (MANDATORY)

- Resolve `change-name` using `x4-user-workflow` rules before any action.
- If multiple matches or no match, stop and ask the user to choose; list available active changes.
- Do not auto-create a change on resolution failure.
- After resolution, print: `Resolved change: <change-name>`.

## Input

- `openspec/changes/<change-name>/test_tasks.md`
- `openspec/changes/<change-name>/ui_knowledge.md`
- Fixture/context references required by the docs (when needed for audit).

## Actions

1. Confirm current execution is an isolated reviewer subagent session.
2. Run structure validator first:
   ```bash
   python3 skill-scripts/validate_test_tasks_refs.py <change-name> --json
   ```
3. Perform semantic review on `test_tasks.md` and cross-file sync check with `ui_knowledge.md`.
4. Output gate decision:
   - `review_status: pass`
   - or `review_status: rewrite_required` with blocking issue list.
5. On `rewrite_required`, explicitly hand back to `/x4:test-doc` and do not modify docs in this skill.

## Mandatory Review Checklist

### A. Blocking Rules

Any hit below MUST produce `review_status: rewrite_required`:

1. Non-deterministic task wording in executable steps/assertions (e.g., `任一`, `至少一个`, `随便`, `任意`).
2. Assertions targeting internal implementation state (e.g., `objTarget 生效`) instead of observable UI behavior.
3. Missing stable locator target for operation/assertion steps that require UI interaction.
4. Weak metric assertion without explicit stable metric key/value/format when metric diff is the target.
5. Ambiguous close/submit action path for popup/picker-like flows.
6. Cross-file inconsistency between `test_tasks.md` and `ui_knowledge.md` identifiers/naming.

### B. Ship-Build Focus Rules

For ship-build related Chapter 2/3 tasks, reviewer must verify:

1. Preconditions are fixed (fixture, language, ship, slot scope when applicable).
2. Picker preview assertions use visible diff signals (text/style/class) rather than internal field names.
3. Clear action is explicit (prefer explicit control like `picker-cancel` when defined in UI knowledge).

## Output Contract (MANDATORY)

Return a structured review result:

```yaml
review_status: pass|rewrite_required
execution_mode: isolated_subagent
blocking_issues:
  - id: TDRV-001
    severity: high|medium|low
    file: openspec/changes/<change-name>/test_tasks.md|openspec/changes/<change-name>/ui_knowledge.md
    task_id: "2.2.1" # optional when applicable
    rule: short-rule-name
    issue: short problem statement
    rewrite_requirement: specific rewrite instruction
summary: short overall review summary
handoff: x4-test-doc|none
```

Rules:

- `review_status=pass` => `blocking_issues` should be empty and `handoff=none`.
- `review_status=rewrite_required` => `blocking_issues` must be non-empty and `handoff=x4-test-doc`.
- `execution_mode` MUST always be `isolated_subagent` for valid review output.

## Constraints

- ENFORCE Zero-Code Policy: do not touch source code.
- This skill is reviewer-only: do not directly rewrite `test_tasks.md` / `ui_knowledge.md`.
- Do not alter checklist completion status.
- Reviewer subagent must not be reused for non-review phases (`x4-test-doc`, `x4-test-impl`, `x4-test-run`).

## Example Usage

```
/x4:test-doc-viewer storage-auto-fill
```
