---
name: x4-verify
description: "Run X4 verification workflow. Use with /x4:verify to execute static verification, test implementation sync, test execution, and final report."
---

# X4 Verify

This skill owns `/x4:verify` sequencing.

Change name input (if provided) supports abbreviation token and must be resolved by `x4-user-workflow` "Change Name Resolution" rules.

## Workflow (MANDATORY)

1. Run static verification via `openspec-verify-change`.
2. Ensure test implementation coverage via `x4-test-impl`.
3. Execute tests and result sync via `x4-test`.
4. Validate bug closure gate:
   - If `openspec/changes/<change-name>/bugs.md` exists, every tracked bug must be `Verified` or `Rejected`.
   - Any bug in `New`, `Confirmed`, or `Fixed` blocks verify pass.
5. Produce combined pass/fail report.

## Constraints

- Do not mark verification complete if any required test fails.
- Do not skip `x4-test-impl` or `x4-test` stages.
- Do not mark verification complete when bug closure gate fails.
- `bugs.md` is the only source of truth for bug status. Do not infer bug closure from test output alone.

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
- `bug_gate=pass` only when all bugs are `Verified` or `Rejected`, or `bugs.md` does not exist.
- `bug_gate=fail` when any bug is `New`, `Confirmed`, or `Fixed`.
- `non_verified_bug_ids` must list all blocking bug IDs when `bug_gate=fail`.

## Output

- Static verification summary
- Test execution summary
- Bug closure summary from `bugs.md` (if present)
- Gate output contract fields (`verify_status`, `bug_gate`, `non_verified_bug_ids`, `bug_gate_summary`)
- Final verification status and remaining blockers
