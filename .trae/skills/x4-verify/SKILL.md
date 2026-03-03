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
2. Ensure test implementation coverage via `x4-test-impl`.
3. Execute tests through `x4-test` orchestration.
4. For bug-fix verification runs, test execution and result-apply entry MUST use `x4:test-run`.
5. Validate bug closure gate from `test_tasks.md` (Chapter 4) via:
   ```bash
   python3 skill-scripts/verify_bug_sync.py <change-name> --json
   ```
   - any returned issue blocks verify pass
   - bug status in `bugs.md` is informational and does not drive gate decisions
6. Produce combined pass/fail report.

## Constraints

- Do not mark verification complete if any required test fails.
- Do not skip `x4-test-impl` or `x4-test` stages.
- Do not bypass `x4:test-run` for bug-fix verification execution/result-apply.
- Do not mark verification complete when bug closure gate fails.
- `test_tasks.md` Chapter 4 is the source of truth for bug closure gate.

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
- `bug_gate=pass` only when `verify_bug_sync.py` returns no issues.
- `bug_gate=fail` when `verify_bug_sync.py` reports any issue.
- `non_verified_bug_ids` must list all blocking bug IDs/cases reported by `verify_bug_sync.py` when `bug_gate=fail`.

## Output

- Static verification summary
- Test execution summary
- Bug closure summary from `test_tasks.md` Chapter 4 + `verify_bug_sync.py` output
- Gate output contract fields (`verify_status`, `bug_gate`, `non_verified_bug_ids`, `bug_gate_summary`)
- Final verification status and remaining blockers
