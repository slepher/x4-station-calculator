---
name: x4-verify
description: "Run X4 verification through static checks, the canonical Unit suite, and the active E2E workflow. Trigger with /x4:verify."
---

# X4 Verify

This skill owns `/x4:verify` sequencing. Resolve an optional `change-name` with `x4-user-workflow` before running it.

## Workflow

1. Run static verification through `openspec-verify-change`.
2. Run the canonical Unit suite with `npm run test:unit`; it collects product tests only from `tests/unit/**`.
3. Run the active E2E documentation, implementation, and change-scoped verification through `x4-e2e-test`.
4. For E2E bug verification, use `x4:e2e-test-run`.
5. Report unresolved bugs from missing or failing current-run Unit/E2E evidence. `bugs.md` status is informational and cannot replace test evidence.

## Gate Rules

- Any required static, canonical Unit, or active E2E failure blocks final verification.
- Legacy tests under `tests/legacy/**` are preserved evidence and never gate verification.
- Skill self-tests use their own suite and do not block a product-test refactor that does not own those files.
- An existing failure outside the current task's owned paths is recorded with an owner and deferred; it does not make that task repair files it cannot own.
- Do not invoke or require legacy `x4-test-*`, `test_tasks.md`, or `verify_bug_sync.py`.

## Output Contract

```yaml
verify_status: pass|fail
unit_status: pass|fail
e2e_status: pass|fail
non_verified_bug_ids: []
blockers: []
deferred_findings: []
```

Include the exact commands run and concise results.
