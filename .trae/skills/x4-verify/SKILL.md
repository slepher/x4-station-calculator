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
4. Produce combined pass/fail report.

## Constraints

- Do not mark verification complete if any required test fails.
- Do not skip `x4-test-impl` or `x4-test` stages.

## Output

- Static verification summary
- Test execution summary
- Final verification status and remaining blockers
