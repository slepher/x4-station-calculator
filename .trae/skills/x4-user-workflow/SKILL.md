---
name: x4-user-workflow
description: "Orchestrate X4 Station Calculator workflow with OpenSpec. (Trigger: /x4:discuss, /x4:new, /x4:ff, /x4:doc, /x4:apply, /x4:bug, /x4:bug-fix, /x4:test-impl, /x4:test, /x4:verify, /x4:archive)"
---

# X4 Workflow Orchestrator

This skill defines the end-to-end workflow and routing for X4.
It is orchestration-only and must not duplicate implementation details from phase skills.

## Trigger

- `/x4:discuss`
- `/x4:new`
- `/x4:ff`
- `/x4:doc`
- `/x4:apply`
- `/x4:bug`
- `/x4:bug-fix`
- `/x4:test-impl`
- `/x4:test`
- `/x4:verify`
- `/x4:archive`

Deprecated and out of active workflow scope:
- `/x4:pipe`
- `/x4:subdis`

## Orchestration Boundary (MANDATORY)

- `x4-user-workflow` owns:
  - phase selection
  - command routing
  - high-level prerequisites between phases
  - handoff sequencing
- Phase skills own all detailed rules:
  - document writing/update rules
  - code implementation rules
  - test writing/execution rules
  - archive detail rules

Do not copy detailed standards into this file. Always delegate to phase skills.

## Cross-Skill Authority (MANDATORY)

- For `/x4:new` and `/x4:ff`, all document detail interpretation and update rules must be sourced from `x4-doc`.
- Keep openspec skill references in phase skills. X4 skills may orchestrate and wrap, but should not remove required openspec dependencies.

## Language Policy (MANDATORY)

- Responses and generated docs must follow the user's language inferred from conversation context by default.
- Do not fall back to English when the user has not provided new text input.
- Switch language only when the user explicitly requests a language change.
- Support explicit language tags in command text (e.g. `#zh`, `#en`); when present, tag selection overrides context language for that request.

## Change Name Resolution (MANDATORY)

All phase skills that accept `change-name` must use this same resolver.

Resolution order:
1. Exact match against `openspec/changes/<change-name>`.
2. Abbreviation match:
   - Build abbreviation from each hyphen-separated segment initial.
   - Example: `station-tab-drag -> std`.
   - Command `/x4:test-impl std` should resolve to `station-tab-drag` when unique.
3. Prefix match on full change name (e.g. `station-tab` -> `station-tab-drag` if unique).

Conflict handling:
- If multiple changes match, stop and ask user to choose from candidates.
- If no change matches, return available active change names.
- Exclude `openspec/changes/archive/` from candidate resolution.
- If user description conflicts with an explicit abbreviation token that resolves uniquely, use abbreviation resolution result as final target.

## Phase Map

1. `/x4:discuss`
   - Goal: clarify requirements and produce discussion conclusions.
   - Delegate to: `x4-discuss`.

2. `/x4:new`
   - Goal: create artifacts step-by-step with confirmations.
   - Delegate to: `x4-new`.
   - Note: document details are governed by `x4-doc`; base creation may rely on openspec skills.

3. `/x4:ff`
   - Goal: fast-forward artifact progression after discussion.
   - Delegate to: `x4-ff` (sequencing) + `x4-doc` (document content/update rules).
   - Note: keep openspec skill references through delegated phase skills.

4. `/x4:doc`
   - Goal: create/update OpenSpec planning artifacts for a change (`request/spec/design/tasks/test_tasks/ui_knowledge`) with consistency sync.
   - Delegate to: `x4-doc`.

5. `/x4:apply`
   - Goal: implement code changes for current change.
   - Delegate to: `x4-apply`.

6. `/x4:bug`
   - Goal: report bug and maintain bug/test artifacts for a change.
   - Delegate to: `x4-bug`.

7. `/x4:bug-fix`
   - Goal: run bug-fix workflow for reported bug.
   - Delegate to: `x4-bug-fix`.

8. `/x4:test-impl`
   - Goal: implement/supplement tests from `test_tasks.md`.
   - Delegate to: `x4-test-impl`.

9. `/x4:test`
   - Goal: execute change-scoped tests and sync test docs.
   - Delegate to: `x4-test`.

10. `/x4:verify`
   - Goal: run verification and testing workflow.
   - Delegate to: `x4-verify`.
   - Handoff contract to archive: must provide `verify_status`, `bug_gate`, `non_verified_bug_ids`, `bug_gate_summary`.

11. `/x4:archive`
   - Goal: archive completed change and promote specs.
   - Delegate to: `x4-archive`.
   - Gate dependency: consume `/x4:verify` handoff contract; archive is allowed only when `verify_status=pass` and `bug_gate=pass`.

## High-Level Prerequisites

- Planning phases (`/x4:discuss`, `/x4:new`, `/x4:ff`, `/x4:doc`) must not edit source code.
- `/x4:apply` should run after required planning artifacts are ready.
- `/x4:test-impl` and `/x4:test` are optional standalone phases for focused test iteration.
- `/x4:verify` should run after `/x4:apply` and includes verification-stage test implementation/execution sequencing.
- `/x4:archive` must consume `/x4:verify` gate output contract; missing gate fields are blockers.
- `/x4:archive` should run only after verify passes.

## Handoff Sequence (Default)

1. Discuss
2. New or FF
3. Doc updates (optional, any time during planning)
4. Apply
5. Bug report (`/x4:bug`)
6. Bug fix (`/x4:bug-fix`)
7. Verify
8. Archive

## Output

- Selected phase and delegated skill(s)
- Current workflow status and next recommended phase
