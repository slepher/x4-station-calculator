---
name: x4-verify
description: "Run X4 verification workflow. Use with /x4:verify to execute static verification, test implementation sync, test execution, and final report."
---

# X4 Verify

This skill owns `/x4:verify` sequencing.

Change name input (if provided) supports abbreviation token and must be resolved by `x4-user-workflow` "Change Name Resolution" rules.

## Change Name Resolution (MANDATORY)

- Resolve `change-name` using `x4-user-workflow` rules before any action.
- If multiple matches or no match, stop and ask the user to choose; list available active changes.
- Do not auto-create a change on resolution failure.
- After resolution, print: `Resolved change: <change-name>`.

## Workflow (MANDATORY)

1. Run static verification via `openspec-verify-change`.
2. Confirm each behavior-changing implementation task has focused Unit
   evidence in `tests/unit/**`.
3. Execute the canonical Unit suite.
4. Execute active E2E only through `x4-e2e-test-*` when the change has browser
   behavior; otherwise do not require E2E evidence.
5. Consume only canonical Unit and active E2E evidence. Legacy `tests/skills/**`
   and `.trae/skills-legacy/**` never block verify.
6. Produce combined pass/fail report.

## Constraints

- Do not mark verification complete if required canonical Unit or selected
  active E2E evidence fails or is missing.
- Do not invoke legacy `x4-test-*` routes.
- A failure outside the owned validation path is recorded and routed to its
  owner; it is not made a blocker for this task.

## Gate Output Contract (MANDATORY)

`/x4:verify` must return a structured gate result for downstream `/x4:archive`:

```yaml
verify_status: pass|fail
bug_gate: pass|fail
non_verified_bug_ids:
  - BUG-xxx
bug_gate_summary: string
```

Rules:
- `bug_gate=pass` only when all selected canonical Unit/active E2E bug
  evidence passes.
- `bug_gate=fail` when selected canonical bug evidence is missing or fails.
- `non_verified_bug_ids` must list all blocking canonical bug cases when
  `bug_gate=fail`.

## Output

- Static verification summary
- Test execution summary
- Bug closure summary from canonical Unit and active E2E evidence
- Gate output contract fields (`verify_status`, `bug_gate`, `non_verified_bug_ids`, `bug_gate_summary`)
- Final verification status and remaining blockers
