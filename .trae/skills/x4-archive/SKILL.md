---
name: x4-archive
description: "Archive completed X4 changes. Use with /x4:archive after verification passes."
---

# X4 Archive

This skill owns `/x4:archive` sequencing.

Change name input (if provided) supports abbreviation token and must be resolved by `x4-user-workflow` "Change Name Resolution" rules.

## Workflow (MANDATORY)

1. Confirm verify phase is complete and passing.
2. Confirm archive prerequisites (e.g., test checklist completion).
3. Execute archive via `openspec-archive-change`.
4. Report archive result and promoted artifacts.

## Delegation

- `openspec-archive-change` for single-change archive.
- `openspec-bulk-archive-change` for batch archive when requested.

## Output

- Archive result
- Any residual follow-up actions
