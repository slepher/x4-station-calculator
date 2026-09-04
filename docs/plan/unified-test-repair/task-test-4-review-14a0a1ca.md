# task-test-4 review — candidate 14a0a1ca (F2 round 2)

Status: complete

Task: `unified-test-repair` generation-2 `task-test-4`, F2 second-round review

Reviewed commit: `14a0a1ca7b20be6d3332a58a445bb46edb0c2462` (parent `054994741ab824dde5e89eeeca04416704cbf8f7`)

## Evidence

- The candidate is bounded to nine test files: one new helper plus the eight focused Logic Flow specs. It changes no product source, fixture, OpenSpec, config, legacy file, or git state. `git diff --check 14a0a1ca^ 14a0a1ca` is clean.
- A collection-only check lists 105 tests. The supplied focused result is 41 passed / 64 failed; the recorded failed IDs divide as follows:

  | File | Failed / collected |
  | --- | ---: |
  | `compact-drag-view.spec.ts` | 1 / 2 |
  | `logic-flow-bug-regression.spec.ts` | 18 / 36 |
  | `logic-flow-drag-feedback.spec.ts` | 5 / 5 |
  | `logic-flow-incompatible-drag.spec.ts` | 2 / 2 |
  | `logic-flow-interaction.spec.ts` | 11 / 15 |
  | `logic-flow-new-feat.spec.ts` | 17 / 20 |
  | `logic-flow-plans.spec.ts` | 7 / 11 |
  | `ui-adjust.spec.ts` | 3 / 14 |

- The 64 retained failure snapshots all reach the 8.0 Chinese Logic Flow page. Their dominant repeated states are an empty planning area, or an existing group still containing zero nodes after a supposed drop. This is materially different from F2 round 1's 107/107 initialization failure and proves that initialization is no longer the common blocker.
- The helper follows the repository's required ordering: load `tests/fixtures/db.json` without `vsn`, reload, select language through `data-testid="language-select"`, navigate through `top-view-btn-flow`, then assert the candidate zone. It explicitly asserts `{ version: '8.0', key: 'x4_logic_flow_plans' }` at [setupLogicFlow.ts](../../../tests/e2e/logic-flow/helpers/setupLogicFlow.ts#L25). `versions.json` maps the 8.0 Logic Flow store to that key, and the candidate contains no product changes; this setup does not alter product behavior.
- All eight files nevertheless request `setupLogicFlow(page, 'clean')`. The helper implements that state only with `clearAllGroups()` at [setupLogicFlow.ts](../../../tests/e2e/logic-flow/helpers/setupLogicFlow.ts#L33). That store operation clears groups and active group only at [useLogicFlowStore.ts](../../../src/store/useLogicFlowStore.ts#L850), while `clearAll()` also clears `currentPlanName`, `savedPlans.activeId`, settings, and the last-saved snapshot at [useLogicFlowStore.ts](../../../src/store/useLogicFlowStore.ts#L1337). Failure screenshots therefore correctly show zero groups under the still-active fixture title `Logic Flow 1`: the current `clean` contract is internally inconsistent.
- Candidate drag sequences now use Playwright's Mouse API and every inspected `mouse.move` has `steps`. They do not, however, assert the target hover/drop signal before `mouse.up()`. For example, [logic-flow-plans.spec.ts](../../../tests/e2e/logic-flow/logic-flow-plans.spec.ts#L22) moves to the last compact group, waits a fixed 200 ms, and releases. This does not satisfy the project `x4-drag-test` contract's required pre-release hover assertion and matches the repeated “drop produced no group/node” evidence.
- Current UI classes are `plan-title-text`, `plan-title-input`, `ware-card-add-btn`, `context-menu-item`, and `language-select` ([LogicFlowCandidateZone.vue](../../../src/components/logic-flow/LogicFlowCandidateZone.vue#L55)). Candidate tests still use retired selectors including `.station-toolbar h1, .toolbar-title`, `.quick-add-btn`, `.language-selector` / `language-selector`, plus an English-only `:has-text("Preview:")` query. These are direct test-migration defects.
- Current `logic-flow-ui-adjust` OpenSpec requires `2fr 3fr 3fr 4fr`, compact `grid-cols-4`, and T0 fade to final opacity 0 ([spec.md](../../../openspec/specs/logic-flow-ui-adjust/spec.md#L18), [spec.md](../../../openspec/specs/logic-flow-ui-adjust/spec.md#L22), [spec.md](../../../openspec/specs/logic-flow-ui-adjust/spec.md#L77)). Product classes implement the two grids at [LogicFlowCandidateZone.vue](../../../src/components/logic-flow/LogicFlowCandidateZone.vue#L524) and [ProductionLineGroup.vue](../../../src/components/logic-flow/ProductionLineGroup.vue#L343). The resource preview uses a 300 ms opacity transition at [LogicFlowCandidateZone.vue](../../../src/components/logic-flow/LogicFlowCandidateZone.vue#L639).
- The deleted vertical compact-layout case remains byte-preserved in [tests/legacy/e2e/from-e2e/compact-drag-view.spec.ts](../../../tests/legacy/e2e/from-e2e/compact-drag-view.spec.ts#L57). Its `display:flex` / `flex-direction:column` premise conflicts with the current `grid-cols-4` OpenSpec, so removing it from canonical is compliant with `context-2` and does not violate original-behavior preservation.
- The candidate also removes the diagnostic `Setup: Check hullparts node count` case from `logic-flow-new-feat.spec.ts`. It is not an independent user behavior, but unlike the vertical case no legacy copy was found. The preservation rule therefore requires either retaining its original text under `tests/legacy/e2e/**` or documenting that it was only disposable diagnostic scaffolding already represented by immutable history; it should not return to the canonical suite.
- Energy Cells must not be judged by the older “all T0 is raw/non-draggable” expectation. Commit `e7d3d05d` and [logic-flow-energycells/spec.md](../../../openspec/changes/logic-flow-energycells/specs/logic-flow-energycells/spec.md#L67) explicitly make Energy Cells draggable and keep actual raw materials non-draggable. Candidate tests using Energy Cells as the draggable seed are aligned with that newer contract.

## Findings

### F1 — Blocking: drop helpers still release without proving a valid hover target

Classification: `selector/helper/expectation migration`.

The broadest failure cluster spans compact drag, drag feedback, incompatible drag, interaction, new-feature, plan creation, and one UI-adjust production-grid case. The common first action is a locally duplicated mouse helper. Adding `steps` fixed one requirement, but these helpers still select `.compact-group` by position, sleep, and call `mouse.up()` without observing `isHoveringNewZone`, `hoveredGroupId`, a preview node, or the appropriate hover/rejected UI. Thirty-plus equivalent empty-state snapshots and the compact existing-group snapshot with zero nodes are evidence that the test has not established its drop precondition; they are not evidence of a product defect.

Correction owner and allowed paths: task-test coding worker, limited to the eight focused specs and `tests/e2e/logic-flow/helpers/**`. Reuse one small Mouse-API helper that (1) triggers drag, (2) targets a semantic new/existing group, (3) asserts the expected hover/drop status before release, and (4) waits on the expected store/UI postcondition rather than a fixed sleep. Preserve real pointer behavior; do not use native-event dispatch or direct store mutation to simulate the drop.

Focused closure: one successful new-group drop, one successful existing-group drop, one rejected incompatible hover, and one move-away/cancel case must pass first. Then rerun only the eight-file scope.

### F2 — Blocking: `clean` means “empty groups inside a seeded active plan,” and plan scenarios need explicit state modes

Classification: `seeded vs clean fixture/setup`.

The version/key mapping and repository-required fixture/reload/language sequence are valid. The state split is not. `clean` leaves the fixture's active plan identity, saved-plan list, lock settings, and snapshot while deleting only its groups. This contaminates save-count, overwrite/load, dirty-state, title, and default-lock expectations. It also explains screenshots headed `Logic Flow 1` despite tests believing they started fresh.

Not every file should switch wholesale to `seeded`. Most drag/interaction/UI cases need a truly clean workspace and should construct only their exact group precondition. Plan tests are mixed: existing-plan/load/persistence cases should use a stable seeded state and address a known plan; new/save-as/title cases need a genuinely clean current workspace and must compare against an explicit saved-plan baseline. Generic seeded state is unsuitable for drag feedback because its three locked/unrelated groups introduce hidden lineage assumptions.

Correction owner and allowed paths: task-test coding worker, limited to `setupLogicFlow.ts` and per-test mode selection in the eight specs. Define and assert the whole public precondition for each mode (current plan identity, group count/IDs, lock setting, and saved-plan baseline as relevant). Do not change product normalization or production behavior.

Focused closure: add short setup assertions for one clean and one seeded caller, then run `logic-flow-plans.spec.ts` plus the four drag smoke cases from F1.

### F3 — Blocking: known retired selectors and one broken view-navigation helper remain

Classification: `selector/helper/expectation migration`.

Representative defects are:

- plan E2E-1/E2E-9 query removed toolbar/title classes instead of `.plan-title-text` / `.plan-title-input`;
- bug-regression quick-add/menu cases query `.quick-add-btn` rather than `.ware-card-add-btn` (the context-menu class itself remains current);
- bug-regression i18n case queries `language-selector`, while both setup and current UI use `language-select`;
- drag-feedback queries an English-only `Preview:` compact group after setup explicitly selects Chinese;
- `switchToLogicFlowView()` in the plan file merely asserts that Logic Flow is already active. E2E-11 calls it after navigating to Blueprint, so it cannot switch back.

These failures have direct current-DOM explanations and must not become bug artifacts. Replace them with current `data-testid` or stable component classes, make text selectors bilingual only when the assertion is intentionally localized, and make the navigation helper actually click when its contract says “switch.” Preserve the OpenSpec behavior assertions (localized content, title editing, quick-add/menu action, and view data isolation).

Focused closure: run the affected plan E2E-1/9/11, i18n case 34, and quick-add/menu cases before the full eight-file scope.

### F4 — Blocking: UI-adjust failures assert representation/timing rather than the documented end state

Classification: `selector/helper/expectation migration`, with one failure downstream of F1.

- `getComputedStyle(...).gridTemplateColumns` normally reports resolved pixel tracks, not the authored `fr` tokens. Expecting it to contain the literal string `2fr 3fr 3fr 4fr` can fail while the exact OpenSpec class is present. Assert the class token, or compare resolved ratios with tolerance.
- The production-group grid test first needs the drag fix: its snapshot contains no created group. Once a group exists, target the specific production node grid instead of the first generic `.grid` descendant.
- T0 opacity is documented as final opacity 0, and product CSS uses a 300 ms transition. An exact computed-style read after a fixed 200 ms samples an allowed intermediate animation value. Use Playwright's retrying CSS assertion for the final state, or disable transitions before interaction as already done in `logic-flow-new-feat.spec.ts`.

The current source and OpenSpec agree. No product bug is established by these three failures.

Focused closure: rerun only the three `ui-adjust.spec.ts` failures after correcting the observations; retain the exact contractual end states.

### F5 — Non-blocking classification work: stale/duplicate canonical cases should not be repaired as distinct contracts

Classification: `过期/重复测试`.

- Do not restore the vertical compact case to canonical. Its legacy original is preserved and its layout assertion is obsolete.
- The two surviving `compact-drag-view` behaviors overlap the canonical interaction/drag-feedback coverage (compact toggling and existing-group drop). Select one canonical owner for each behavior; retain the old file under legacy rather than paying to stabilize duplicate scenarios.
- Likewise, new-zone creation/drop and several T0/drag-state scenarios are repeated across interaction, new-feature, and bug-regression files. Before repairing each red case, map it to one current OpenSpec scenario. Keep a single strongest browser assertion; leave stale/duplicate originals in legacy/history.
- Preserve the removed diagnostic setup case according to the original-test rule, but do not promote it back into canonical behavioral coverage.

This cleanup must remain test-only and should follow, not mask, the representative F1 drag repair.

### F6 — No current evidence supports a Logic Flow product bug artifact

Classification: `no confirmed current-OpenSpec bug`.

The failing i18n, plan, opacity, grid, drag, and incompatible-feedback cases all still have unresolved setup, selector, target-handshake, timing, or stale-exact-class explanations. In particular, exact unlocked-group utility classes such as `opacity-20 grayscale pointer-events-none border-transparent` are historical representation assertions; the durable contract is whether the target is unavailable/rejected and whether a drop mutates state. The locked rejection contract is the red/rejected feedback and blocked drop, not preservation of every old Tailwind token.

Do not create or recommend a bug artifact from this run. A bug becomes eligible only after a test has an explicit clean/seeded precondition, current selector, observed hover/drop state, and a current OpenSpec contradiction that reproduces independently. If that happens, record the smallest such scenario and its present contract; do not infer it from aggregate failure count.

## Verdict

`changes_required`

Candidate `14a0a1ca` is a real improvement: it removes the global initialization blocker, fixes the 8.0 storage-key mismatch, reaches Logic Flow, removes major retired selectors, and adds stepped pointer motion. It cannot pass task-test-4 with 64/105 focused failures, and the remaining evidence is still predominantly test-owned. F2 should remain assigned to test migration; no product-code or bug-artifact work is justified yet.

## Changes

Minimum next-round coding scope, in order:

1. Make `setupLogicFlow` expose truthful `clean` and `seeded` postconditions; choose the mode per scenario, especially inside the mixed plan suite.
2. Add/reuse one signal-aware Logic Flow Mouse drag helper and migrate only the representative new-group, existing-group, rejected, and cancel paths first. Require a hover/status assertion before `mouse.up()` and a state/UI postcondition after it.
3. Replace the enumerated retired title, quick-add, language, preview, and navigation selectors/helpers. Do not broadly rewrite passing tests.
4. Correct the three UI-adjust observations (authored grid class/resolved ratio, precise production grid target, retrying final opacity).
5. Run those focused smoke cases, then the eight-file 105-test scope. Only after the representative paths pass should remaining reds be classified individually.
6. De-duplicate canonical cases against current OpenSpec and preserve any removed original that lacks a legacy copy. Do not restore the obsolete vertical layout case.

Allowed scope remains `tests/e2e/compact-drag-view.spec.ts`, `tests/e2e/logic-flow/**`, and, only for preservation of an otherwise deleted original, `tests/legacy/e2e/**`. No `src/**`, fixture, OpenSpec, config, candidate, or bug-artifact change is supported by this review.

## Caveats

- Per instruction, the full E2E suite was not rerun. Review evidence uses the supplied 105-test focused result, retained Playwright failure artifacts, a collection-only check, static source/spec/history inspection, and `git diff --check`.
- Main and change OpenSpecs contain historical overlap around T0/Energy Cells. For the reviewed behavior, the later explicit Energy Cells change and its implementation history are the applicable evidence: Energy Cells are draggable; actual raw materials are not.
- Passing the eight-file scope is necessary but not sufficient for task-test-4's final repository-wide gates. Full `test:e2e`, canonical/legacy count checks, and the remaining task gates belong after F2 focused convergence.
