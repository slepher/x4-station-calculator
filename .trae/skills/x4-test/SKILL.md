---
name: x4-test
description: "Orchestrate test workflow across x4-test-doc, x4-test-impl, x4-test-run, x4-bug, and x4-bug-fix. Trigger with /x4:test <change-name>."
metadata:
  version: "1.0"
---

# X4 Test Orchestrator

This skill is orchestration-only and coordinates test phases. It does not own detailed rules for doc format, test implementation mapping, or run-apply logic.

## Trigger

User invokes `/x4:test <change_name>`

## Purpose

Coordinate test-related workflow for a change by sequencing:

1. `x4-test-doc` (test docs)
2. `x4-test-impl` (test implementation)
3. `x4-test-run` (test execution + result apply)
4. `x4-bug` (bug registration when new product defects are found)
5. `x4-bug-fix` (product bug fix loop and re-verify)

## Parameters

- `<change_name>`: target change under `openspec/changes/`.

## Change Name Resolution (MANDATORY)

- Resolve to a single existing `openspec/changes/<change-name>` target before any action.
- If multiple/no matches, stop and ask user to choose.
- After resolution, print: `Resolved change: <change-name>`.

## Mandatory Requirements

### Chapter A: Agent-Only Mandatory

#### A.1 Orchestration Boundary (MANDATORY)

1. `x4-test` only orchestrates and routes work.
2. Do not duplicate detailed standards from phase skills.
3. Do not bypass required phase when user intent explicitly requires it.

#### A.2 Delegation Map (MANDATORY)

1. Test documentation changes -> delegate to `x4-test-doc`.
2. Test authoring/fixing -> delegate to `x4-test-impl`.
3. Test run and result apply -> delegate to `x4-test-run`.
4. New product bug registration -> delegate to `x4-bug`.
5. Product bug fixing workflow -> delegate to `x4-bug-fix`.

#### A.3 Sequencing (MANDATORY)

Default sequence:

1. Ensure docs are current (`x4-test-doc`) when requirements changed.
2. Ensure implementation coverage (`x4-test-impl`) when tests missing/stale.
3. Execute and apply run results (`x4-test-run`).
4. Failure branch handling:
   - `test_defect` -> route back to `x4-test-impl`, then rerun `x4-test-run`.
   - `product_bug`:
     - if no existing bug record -> run `x4-bug` first,
     - then run `x4-bug-fix`,
     - then rerun `x4-test-run` for bug-targeted verification.
5. Repeat branch loop until no unresolved blockers or user stops.

### Chapter B: Update Mandatory

#### B.1 Progress Reporting (MANDATORY)

- Report delegated phase status in order:
  - `x4-test-doc`
  - `x4-test-impl`
  - `x4-test-run`
  - `x4-bug` (when triggered)
  - `x4-bug-fix` (when triggered)
- Surface blockers with exact phase ownership.

#### B.2 Handoff Integrity (MANDATORY)

- Pass consistent change target to all delegated phases.
- Preserve run-result context when handing off into `x4-test-run`.
- Preserve failure classification context (`test_defect` / `product_bug`) for branch routing.
- Ensure product bug branch always maps to a bug id before entering `x4-bug-fix`.
- Do not alter per-phase output contracts.

## Output

- Delegation plan and executed phase order
- Per-phase summary (`x4-test-doc`, `x4-test-impl`, `x4-test-run`, `x4-bug`, `x4-bug-fix`)
- Final blockers and next step

## Example Usage

```
/x4:test storage-auto-fill
```
