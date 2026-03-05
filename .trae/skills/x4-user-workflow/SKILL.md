---
name: x4-user-workflow
description: "Describe command-to-skill relationships for X4 workflow."
---

# X4 Workflow Command Map

This skill only defines command relationships and routing boundaries.
It does not arrange concrete execution work inside phase skills.

## Trigger

- `/x4:discuss`
- `/x4:new`
- `/x4:ff`
- `/x4:doc`
- `/x4:test-doc`
- `/x4:test-doc-viewer`
- `/x4:apply`
- `/x4:bug`
- `/x4:bug-fix`
- `/x4:test-impl`
- `/x4:test`
- `/x4:test-run`
- `/x4:verify`
- `/x4:archive`

Deprecated and out of active workflow scope:
- `/x4:pipe`
- `/x4:subdis`

## Scope Boundary (MANDATORY)

- `x4-user-workflow` owns:
  - command recognition
  - command routing
  - command-to-skill relationship definition
- Phase skills own all execution details:
  - document writing/updating details
  - implementation details
  - test writing/running details
  - verification/archive gate details

## Command Relations

- `/x4:discuss` -> `x4-discuss`
- `/x4:new` -> `x4-new`
- `/x4:ff` -> `x4-ff`
- `/x4:doc` -> `x4-doc`
- `/x4:test-doc` -> `x4-test-doc`
- `/x4:test-doc-viewer` -> `x4-test-doc-viewer`
- `/x4:apply` -> `x4-apply`
- `/x4:bug` -> `x4-bug`
- `/x4:bug-fix` -> `x4-bug-fix`
- `/x4:test-impl` -> `x4-test-impl`
- `/x4:test` -> `x4-test`
- `/x4:test-run` -> `x4-test-run`
- `/x4:verify` -> `x4-verify`
- `/x4:archive` -> `x4-archive`

## Shared Change Name Resolution Reference

For commands that accept `change-name`, phase skills should use the shared resolver policy:

1. exact match against `openspec/changes/<change-name>`
2. abbreviation match from hyphen-segment initials
3. full-name prefix match

Conflict handling:
- multiple matches: stop and ask user to choose
- no match:
  - `/x4:ff` may auto-create `openspec/changes/<change-name>/`
  - other commands should stop and ask user
- exclude `openspec/changes/archive/`

## Non-Responsibilities

`x4-user-workflow` must not define:
- phase execution sequence
- per-phase prerequisites
- reviewer gate loops
- implementation/test verification procedures

Those rules must stay in each delegated phase skill.

## Output

- selected command
- routed phase skill
- brief relation note when needed
