---
name: x4-bug
description: "Report and track bugs for X4 project. Invoke /x4:bug to record issues and sync bug artifacts (no source-code fix in this skill)."
---

# X4 Bug Reporting

This skill is report-only for `/x4:bug`.
It records bug artifacts and owns bug tracking state.

Status note:
- `bugs.md` status is informational metadata for human readability.
- Execution/closure decisions are driven by `test_tasks.md` and test results, not by bug status text.

## Input

- `change-name` (optional; supports abbreviation token such as `std`)
- Resolve by `x4-user-workflow` "Change Name Resolution" rules
- `bug-description` (optional free text)

## Change Name Resolution (MANDATORY)

- Resolve `change-name` using `x4-user-workflow` rules before any action.
- If multiple matches or no match, stop and ask the user to choose; list available active changes.
- Do not auto-create a change on resolution failure.
- After resolution, print: `Resolved change: <change-name>`.

## Trigger

- `/x4:bug [change-name] [bug-description]`
- A bug is discovered during development or testing
- User reports a bug
- Test fails and needs bug tracking

## Scope Boundary (MANDATORY)

- `/x4:bug` MUST:
  - record or update bug entries in `bugs.md`
  - maintain bug id and test linkage metadata
- `/x4:bug` MUST NOT:
  - directly edit `test_tasks.md` / `ui_knowledge.md`
  - redefine test documentation formats
  - implement source-code fixes in `src/**`
  - run bug-fix verification as if code has changed

Documentation ownership rule:
- If reproduction tasks or UI test knowledge must be added/updated, delegate to `/x4:test-doc`.
- `x4-test-doc` remains the authority for `test_tasks.md` / `ui_knowledge.md`.

## Target Resolution Priority (MANDATORY)

When target descriptions are ambiguous or conflicting:
- First apply `x4-user-workflow` change resolver.
- If an explicit abbreviation token resolves uniquely, that resolved change is the final target.
- If user prose describes a different change than the resolved abbreviation result, abbreviation result takes precedence.

## Bug Tracking File (`bugs.md`)

### Location

`openspec/changes/<change-name>/bugs.md`

### Content Format

```markdown
## Bug: [Bug Name]
- **ID**: BUG-001
- **Description**: [Detailed description]
- **Steps to Reproduce**: [Step-by-step instructions]
- **Expected Behavior**: [What should happen]
- **Actual Behavior**: [What actually happens]
- **Status**: [New | Confirmed | Fixed | Verified | Rejected]
- **Related Test**: [Link to test_tasks.md item]
```

## Workflow (MANDATORY)

### Step 1: Record Bug

1. Add or update bug entry in `bugs.md`
2. Assign a unique ID (BUG-001, BUG-002, etc.)
3. Set status to `New` unless already in a later state

### Step 2: Generate Reproduction Task

1. Request/update reproduction task via `/x4:test-doc` (do not edit directly in this skill)
2. Link bug entry to target test id in `bugs.md` via `**Related Test**`
3. Keep bug-side reproduction description in `bugs.md` only

### Step 3: Sync UI Knowledge (Web Integration only)

If the reproduction task is Web Integration, delegate `ui_knowledge.md` updates to `/x4:test-doc`.

### Step 4: Handoff to Fix Phase

- Stop after report artifacts are updated.
- If user requests fix, route to `/x4:bug-fix`.

## Unrelated Bug Handling

If a reported bug is unrelated to any existing change:

1. Stop and ask whether to create a new change: `fix-<bug-name>`.
2. Only create the new change after user confirmation.
3. If confirmed, create initial bug artifact `bugs.md` under that change.
4. If test docs are needed, delegate to `/x4:test-doc`.
5. Continue using standard workflow.

## Constraints

- Keep all edits scoped to current change documentation.
- Keep `bugs.md` as bug catalog/reference; avoid using its status as execution gate.
- Do not run fix verification loops in this skill.
