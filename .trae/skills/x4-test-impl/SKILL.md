---
name: x4-test-impl
description: "Implement and supplement Unit/E2E test code for X4 Station Calculator. Trigger with /x4:test-impl <change-name>."
metadata:
  version: "1.6"
---

# X4 Test Implementation

This skill focuses on implementing test code and can run in parallel with code implementation.
It is not a mandatory gate before `/x4:test`.
It does not write pass/fail results.

## Input

- `change-name` (optional; supports abbreviation token such as `std`)
- Resolve by `x4-user-workflow` "Change Name Resolution" rules

## Positioning

1. `/x4:test-impl` is a parallel acceleration track for test authoring.
2. `/x4:test` may directly execute this skill's authoring logic inline when verification requires test creation/fixes.
3. Use this skill when the user wants dedicated test implementation work or parallel progress with code changes.
4. This skill is not a gating prerequisite for `/x4:test`.

## Steps (MANDATORY)

1. Resolve target change using `x4-user-workflow` change resolver.
2. Read:
   - `openspec/changes/<change-name>/test_tasks.md`
   - `openspec/changes/<change-name>/ui_knowledge.md` (for E2E)
   - `openspec/test_experience.md`
3. Inspect existing tests:
   - `tests/unit/<change-name>/*.spec.ts`
   - `tests/e2e/<change-name>/*.spec.ts`
4. Apply 1:1 mapping from `test_tasks.md` to test cases:
   - create missing files if needed
   - add missing test cases only
   - keep existing passing structure unchanged unless required
   - treat nested checklist items as required coverage targets for `/x4:test` gate
   - do not stop at top-level section coverage; map concrete sub-items (including A/B branch cases)
   - when state chapter exists, map both:
     - each state item -> one `状态：<id>` test case
     - each state-switch item -> one `切换：<from>-><to>` test case
   - enforce E2E chapter split mapping:
     - `#2` (启动/预置/初始状态/状态切换) -> state and transition tests
     - `#3` (业务测试内容) -> scenario tests
5. Ensure standards:
   - Unit: Vitest + Pinia setup patterns
   - E2E: use project `test-setup`, prefer locators from `ui_knowledge.md`
   - Drag-and-drop cases: follow `x4-drag-test` conventions
   - Assertion quality (MANDATORY):
     - Do not use low-information pass/fail flags such as `let success = false` as the primary assertion target.
     - Assert concrete observable state directly (e.g., final DOM order, item IDs, counts, positions).
     - For retry-based interactions (especially drag-and-drop), capture per-attempt diagnostics in assertion messages:
       - observed order snapshots (prefer stable ids like `data-*` ids)
       - position snapshots when relevant (e.g., x/y centers)
     - Avoid index-drift interactions during retries:
       - prefer stable identity locators (`data-station-id`, `data-testid`, etc.) over `nth()` when source/target can move.
6. Run syntax/type validation using:
   - `npx tsc -p tsconfig.test-check.json --noEmit`
7. If syntax/type errors are found, fix test code and rerun the same command until clean or explicit blocker.
8. Return implementation summary:
   - added/updated files
   - mapped items count (done/total)
   - remaining unmapped items (if any)
   - syntax validation status

## Verification Alignment (MANDATORY)

`x4-test-impl` output must be directly executable by `x4-test` without coverage-gate mismatch.

1. Coverage gate alignment:
   - For each unchecked checklist line in `test_tasks.md` that describes verifiable behavior, implement at least one corresponding test assertion.
   - If an item has branch wording such as A/B, both branches must have explicit tests or explicit assertions in one test.

2. E2E assertion quality alignment:
   - "可展示性校验" style items must assert both:
     - positive visibility/state assertions, and
     - explicit absence-of-error assertions (e.g., no parse/runtime error hint visible).
   - When a task explicitly calls out multiple plan loads (e.g., plan A and plan B), assertions must be repeated for each plan, not inferred.

3. Handoff quality:
   - Remaining unmapped list must reference exact checklist item IDs (e.g., `2.3`, `3.7`) so `x4:test` can deterministically decide whether to stop.
   - If no unmapped verifiable items remain, state this explicitly as: `coverage gate ready for /x4:test`.

## Guardrails

- Do not run `npm run build`.
- Do not run full test execution for verification pass/fail in this skill.
- Syntax/type validation for changed test files is required and allowed.
- Do not run `npx playwright test`.
- Do not write pass/fail markers to `test_tasks.md`.
- Do not treat this skill as verification completion.

## Standard State + Transition Authoring (MANDATORY)

When `test_tasks.md` defines reusable states, implement state and state-switch tests together.

1. Required helper functions:
   - `buildStateX(...)`: bring system to state `X` with documented UI flow.
   - `assertStateX(...)`: verify state `X` with stable observable probes.
   - `switchFromXToY(...)`: apply only the transition actions from `X` to `Y`.
2. Required test cases:
   - one dedicated `状态：<id>` case per state item.
   - one dedicated `切换：<from>-><to>` case per transition item.
   - transition coverage is minimal-required: implement only transitions referenced by scenario needs in `test_tasks.md`, not all possible state pairs.
3. Transition test contract:
   - `切换：` case must execute:
     - `buildState<from>` or equivalent preparation
     - `assertState<from>`
     - `switchFrom<from>To<to>`
     - `assertState<to>`
4. Scenario reuse rule:
   - scenario tests should reuse state/transition helpers.
   - avoid duplicated ad-hoc setup if corresponding helpers already exist.
5. Baseline rule:
   - baseline/empty states still need dedicated `状态：` cases.
   - no implicit pass-through from scenario success.
6. Implementation boundary:
   - `test_tasks.md`: checklist mapping (state/transition/scenario ids and references).
   - `ui_knowledge.md`: build/assert/switch semantics and probes.
   - if semantics are missing/ambiguous, report blocker instead of inventing behavior.
