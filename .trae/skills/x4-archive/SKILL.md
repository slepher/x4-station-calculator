---
name: x4-archive
description: "Archive completed X4 changes. Use with /x4:archive after verification passes."
---

# X4 Archive

This skill owns `/x4:archive` sequencing.

Change name input (if provided) supports abbreviation token and must be resolved by `x4-user-workflow` "Change Name Resolution" rules.

## Workflow (MANDATORY)

1. Confirm `/x4:verify` is complete and `verify_status=pass`.
2. Read and enforce verify gate output contract:
   - require `bug_gate=pass`
   - if `bug_gate=fail`, stop archive and report `non_verified_bug_ids` + `bug_gate_summary`
3. Confirm archive prerequisites that are not bug-status interpretation (e.g., checklist completion).
4. Execute archive via `openspec-archive-change`.
5. Report archive result and promoted artifacts.

## Gate Consumption Rule (MANDATORY)

- `/x4:archive` is not allowed to reinterpret bug status directly from `bugs.md`.
- Bug closure decision authority belongs to `/x4:verify` gate output.
- If verify gate output is missing required fields, treat as blocker and ask for rerun of `/x4:verify`.

## Delegation

- `openspec-archive-change` for single-change archive.
- `openspec-bulk-archive-change` for batch archive when requested.

## Output

- Archive result
- Gate check result used by archive (`verify_status`, `bug_gate`)
- Any residual follow-up actions
