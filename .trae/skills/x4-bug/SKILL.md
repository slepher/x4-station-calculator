---
name: x4-bug
description: "Report and track bugs for X4 project. Invoke /x4:bug to record issues and sync bug artifacts (no source-code fix in this skill)."
---

# X4 Bug Reporting

This skill is report-only for `/x4:bug`.
It records bug artifacts and prepares reproduction tasks.

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
  - add or refresh reproduction tasks in `test_tasks.md`
  - sync `ui_knowledge.md` when reproduction is Web Integration
- `/x4:bug` MUST NOT:
  - implement source-code fixes in `src/**`
  - run bug-fix verification as if code has changed

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

1. Add reproduction item to `test_tasks.md`
2. Link the task to the bug via `**Related Test**`
3. Include `**Bug现状**` to describe current broken behavior

### Step 3: Sync UI Knowledge (Web Integration only)

If the reproduction task is Web Integration, update `ui_knowledge.md` with locator/flow additions.
Follow `x4-doc` sync conventions for `test_tasks.md` and `ui_knowledge.md` consistency.

### Step 4: Handoff to Fix Phase

- Stop after report artifacts are updated.
- If user requests fix, route to `/x4:bug-fix`.

## Unrelated Bug Handling

If a reported bug is unrelated to any existing change:

1. Stop and ask whether to create a new change: `fix-<bug-name>`.
2. Only create the new change after user confirmation.
3. If confirmed, create initial bug artifacts under that change (`bugs.md`, `test_tasks.md`, `ui_knowledge.md` if needed).
4. Continue using standard workflow.

## Constraints

- Keep all edits scoped to current change documentation.
- Do not run fix verification loops in this skill.
