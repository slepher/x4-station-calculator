---
name: x4-bug
description: "Report and track bugs for X4 project. Invoke /x4:bug to record issues and sync bug artifacts (no source-code fix in this skill)."
---

# X4 Bug Reporting

This skill is report-only for `/x4:bug`.
It records bug artifacts and owns bug tracking state.

Status note:
- `bugs.md` status is informational metadata for human readability.
- Execution/closure decisions are driven by current-run evidence from the owning Unit task and/or `e2e_test_tasks.md`, not by bug status text.

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
  - directly edit `tasks.md`, `e2e_test_tasks.md`, or `knowledge.md`
  - redefine test documentation formats
  - implement source-code fixes in `src/**`
  - run bug-fix verification as if code has changed

Single-phase execution rule:
- `/x4:bug` is report-only and single-phase.
- In one `/x4:bug` invocation, do not continue into `/x4:bug-fix` behavior (root-cause implementation, source edits, fix verification).
- If user asks to "继续修复" in the same message, finish report artifacts first, then stop and instruct next command: `/x4:bug-fix`.

Documentation ownership rule:
- Unit-reproducible bugs are handed to `/x4:doc` so implementation and focused Unit coverage stay together in `tasks.md`.
- Browser-only reproduction or UI test knowledge is handed to `/x4:e2e-test-doc` and `/x4:e2e-test-doc-details`.

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
- **Related Verification**: [Link to tasks.md Unit item or e2e_test_tasks.md item]
```

## Workflow (MANDATORY)

### Step 1: Record Bug

1. Add or update bug entry in `bugs.md`
2. Assign a unique ID (BUG-001, BUG-002, etc.)
3. Set status to `New` unless already in a later state

### Step 2: Route Reproduction Ownership

1. For a Unit boundary, request/update the owning implementation task via `/x4:doc`.
2. For a browser boundary, request/update E2E artifacts via `/x4:e2e-test-doc` and `/x4:e2e-test-doc-details`.
3. Link the bug entry through `**Related Verification**`.
4. Keep bug-side reproduction description in `bugs.md` only.

### Step 3: Sync UI Knowledge (Web Integration only)

If the reproduction requires browser knowledge, delegate `knowledge.md` updates to `/x4:e2e-test-doc-details`.

### Step 4: Handoff to Fix Phase

- Stop after report artifacts are updated.
- If user requests fix, route to `/x4:bug-fix`.

### Step 5: Compliance Gate (MANDATORY)

Track the files written by the current invocation and list them before responding. Do not use the whole dirty tree as the invocation delta.

Pass condition:
- Delta files are limited to bug-report artifacts for current change (for example: `openspec/changes/<change-name>/bugs.md`).

Fail condition:
- Any delta change appears in `src/**`, `tests/**`, or non-target change docs during `/x4:bug`.
- On failure: output `BLOCKED: scope violation`, list offending files, and stop without claiming bug fixed.

## Unrelated Bug Handling

If a reported bug is unrelated to any existing change:

1. Stop and ask whether to create a new change: `fix-<bug-name>`.
2. Only create the new change after user confirmation.
3. If confirmed, create initial bug artifact `bugs.md` under that change.
4. Route Unit task updates to `/x4:doc`; route browser test docs to the `x4-e2e-test-*` chain.
5. Continue using standard workflow.

## Constraints

- Keep all edits scoped to current change documentation.
- Keep `bugs.md` as bug catalog/reference; avoid using its status as execution gate.
- Do not run fix verification loops in this skill.
- Do not include language implying fix completion such as "已修复" in `/x4:bug` output.
- If `Related Verification` is unknown after report step, mark it as `PENDING (/x4:doc or /x4:e2e-test-doc)`.

## Output (MANDATORY)

- Must print `Resolved change: <change-name>`.
- Must list updated bug IDs and their status.
- Must include `Related Verification` linkage result per bug:
  - linked test id; or
  - `PENDING (/x4:doc or /x4:e2e-test-doc)` when not yet linked.
- Must include next-step routing:
  - `/x4:doc` for implementation + Unit linkage, or `x4-e2e-test-*` for browser-only linkage
  - `/x4:bug-fix` for implementation phase
