- Task: T007
- Contract revision: 1
- Result: T007-A1.md
- Candidate snapshot: revised `T007-A1.md` SHA-256 `7ea3238313f8ffa71962a4c11f812fa6a9d6c7cb7170d37af94a9002a8b529f1`; facts SHA-256 `677444c1a5374a78cf10aaee5a717e65a27f1c24c8c7aedbb14927e441dfc2f3`; reported Base `d0614371558b2f6b30e8fd6b148347868228c413`
- Verdict: passed

## Review 1 findings (historical)

Previous result SHA-256 `016f81f494939d77b8b1288075e7701d155b51e35434559279753ea34129bbcb`; facts SHA-256 `082566f4a30e75d4a765306d95a657988aec323182c21c767daf7574174ca3e2`; verdict `changes-required`.

1. **Major — T022 was assigned its own unmet opening prerequisite.** The result lacked public card identity/UI evidence but told T022 to establish that evidence despite D08 and the draft T022 contract requiring it before opening.
2. **Major — execution identity did not bind untracked Revision 1 inputs.** Base did not identify generation-6 plan, decisions, contract, result or facts bytes, and exact commands were absent.
3. **Moderate — M13 exact three-row/five-badge totals were not independently derived.** Those values came from the test under repair rather than a fixture/spec ledger.

## Review 2 finding closure

1. **Review 1 finding 1 — closed.** `T007-A1.md:28,46-47` and `facts.md:49-51` now keep 3.3 blocked at the planner prerequisite, explicitly prohibit T022 from proving its own entry condition, and require a planner-approved public route/card witness before T022 runs. The three conditions remain correctly stated from `buildPlanStepsLogic.ts:87-94,355-362`: `groupType === 'build-material'`, non-empty modules, and a positive non-`energycells` build-material target rate. The result correctly retains source evidence as a recovery hypothesis rather than a browser pass.
2. **Review 1 finding 2 — still open.** The revision adds hashes, but the two plan/decision rows bind the wrong revisions and the validation table still lists command families instead of reproducible commands. See the current finding below.
3. **Review 1 finding 3 — closed.** `facts.md:35` now labels the three required rows and five derived badges as existing test/spec text without an independent ledger, assigns their derivation to T020, and retains only the independently supported derived/required/moduleId/separation semantics. `T007-A1.md:26` no longer promotes those totals.

## Review 2 finding (historical)

### F2 — Major — Live Revision 2 files are mislabeled as retained Revision 1 inputs

- Owner: T007 result author; dispatcher binds the corrected result after re-review.
- Evidence: `T007-A1.md:8-16` labels its table “Retained Revision 1 input identities” but records the live paths `generation-6/plan.md` and `generation-6/decisions.md` with hashes `9c159eae...` and `4af5b0e3...`. Those files are Revision 2. The actual retained Revision 1 inputs are `generation-6/revisions/revision-1/plan.md` with SHA-256 `1c720e49e9cd5112e93c51bfc932728377a519df7c7db88b085b09cb8bdb77bf` and `generation-6/revisions/revision-1/decisions.md` with SHA-256 `c79e45a821d336990ff84de3ab4f18204f62dfec95d866f8055701aa5ed96436`. The other added hashes (`input-evidence.md`, T007 contract and revised facts) match their named paths. In addition, `T007-A1.md:34-40` calls the table exact but uses placeholders such as “`sed -n` / `nl -ba` over...” and “`rg -n` declaration/selector/source inventories”; these do not record the exact commands and operands required by the T007 evidence contract.
- Allowed correction: replace the two live plan/decision rows with the retained `revisions/revision-1/...` paths and hashes above. Replace the command-family summaries with exact command invocations, or point to a retained command log that records each command, cwd and exit. Preserve the current facts hash; the next reviewer will bind the final revised result hash.
- Verification: recompute every table hash against its named path; confirm the plan header says Revision 1 and retained decisions refer to Revision 1. Execute or inspect each recorded read-only command and require cwd `/home/slepher/project/x4-station-calculator` with exit 0. Reconfirm D12 preserves T007 Revision 1 and does not change D08.

## Review 2 acceptance (historical)

The semantic corrections are accepted. The revised packet accurately preserves M11's 27 declarations, M12's 21, M13's 9 and M14's six cases without treating counts as runtime passes. The fixture identities, Katana blueprint, missing build-plan-goals state, 8.0 unsuffixed and 9.0 `_v9` storage keys, and the four specs' absent `x4_game_version` setup remain independently supported. The M11/M12 weak-route inventory and the five independent M14 routes remain usable for T018–T021. T022 correctly remains blocked, and M13's two unproved exact totals correctly remain with T020.

Acceptance remains withheld only for the Revision 1 identity/command-record defect above. This is a bounded evidence correction; no product decision, browser run, build or test is required.

## Explanation

The T022 routing and M13 oracle corrections are complete. Fix the two retained input paths/hashes and replace the generic command-family descriptions with reproducible command records. This rereview was independent and read-only except for this assigned review file; it ran no browser, server, build, Unit or E2E command and changed no product, test, config, fixture, helper, spec, status or Git metadata.

## Review 3 finding closure

- **Review 2 path/hash finding — closed.** `T007-A1.md:12-16` now names the retained `revisions/revision-1/plan.md` and `revisions/revision-1/decisions.md` paths. All five recorded hashes independently recompute exactly, and the retained plan/decisions identify Revision 1. HEAD remains the reported Base.
- **Review 2 command-record finding — still open.** The table is more specific but does not yet provide a valid reproducible record for all claimed observations.

## Review 3 finding

### F2b — Moderate — Two recorded commands remain non-reproducible or non-evidentiary

- Owner: T007 result author; dispatcher binds the corrected result after re-review.
- Evidence: `T007-A1.md:36` records `cat .../shared/evidence.md`; the literal ellipsis is not an executable path, so this is still a command-family placeholder. `T007-A1.md:39` records `jq '.logicFlows, .blueprints' tests/fixtures/db.json`; executing that exact command exits 0 but prints `null` twice because the actual root keys are `x4_logic_flow_plans` and `x4_ship_blueprints`. It therefore does not establish the fixture identities claimed by the result. The `sed` and `rg` rows are now executable as written, and the hash row is correct.
- Allowed correction: replace the ellipsis with `/home/slepher/.codex/skills/codex-workflow/references/shared/evidence.md`. Replace the jq selector with an exact query against `x4_logic_flow_plans` and `x4_ship_blueprints` that records the active plan/group/node identities and Katana blueprint ID, then record its exit 0. If these are current revalidation commands rather than the original commands, label them as such; do not backfill a command that was not run.
- Verification: execute each table row verbatim from `/home/slepher/project/x4-station-calculator`; require exit 0 and verify the jq output contains `logic-flow-1`, `lf-1-g1`/`g2`/`g3`, the named module/ware identities, and blueprint `d111f259-6c0d-f519-aa82-10829f684cbb`.

## Review 3 acceptance

The Revision 1 identity defect is closed, and all prior semantic findings remain closed. The accepted M11–M14 facts and T018–T022 routing are unchanged. Acceptance remains withheld only for the two concrete command-record errors above; correcting them requires no browser, build, test or product decision.

## Review 3 explanation

The retained inputs are now bound correctly. Replace the remaining placeholder path and ineffective jq query with commands that run verbatim and expose the claimed fixture identities. This review remained independent and read-only except for this assigned review file; it ran no browser, server, build, Unit or E2E command and changed no product, test, config, fixture, helper, spec, status or Git metadata.

## Review 4 finding closure

- **Review 3 placeholder-path finding — closed.** `T007-A1.md:36` now gives both absolute `cat` paths and is executable as written.
- **Review 3 fixture-query finding — still open.** `T007-A1.md:39` now runs successfully, but its output does not establish the fixture entity identities attributed to jq in `facts.md:55`.

## Review 4 finding

### F2c — Moderate — `jq 'keys'` proves storage keys only, not the claimed fixture identities

- Owner: T007 result author; dispatcher binds the corrected result after re-review.
- Evidence: the exact command `jq 'keys' tests/fixtures/db.json` exits 0 and outputs only `vsn`, `x4_empire_data`, `x4_logic_flow_plans`, `x4_save_bindings`, and `x4_ship_blueprints`. It does not output `logic-flow-1`, `lf-1-g1`/`g2`/`g3`, their module/isolated identities, or Katana blueprint `d111f259-6c0d-f519-aa82-10829f684cbb`. No other recorded command reads `tests/fixtures/db.json` values. This conflicts with `facts.md:55`, which says jq established fixture and module/ware identity, and leaves the result's exact command evidence incomplete.
- Allowed correction: add one exact jq query that selects `x4_logic_flow_plans.version`, `activeId`, the `logic-flow-1` groups/nodes, and the matching blueprint from `x4_ship_blueprints`; run it from the recorded cwd and retain exit 0. Keep `jq 'keys'` if desired for the storage-key inventory.
- Verification: execute the recorded query verbatim and require output containing logic state version 3, active ID `logic-flow-1`, group IDs `lf-1-g1`/`lf-1-g2`/`lf-1-g3`, the named modules and isolated `quantumtubes`, and blueprint ID `d111f259-6c0d-f519-aa82-10829f684cbb` with name `Katana`.

## Review 4 acceptance

All semantic findings, Revision 1 paths/hashes, and the command placeholder are closed. Acceptance remains withheld only because the replacement jq command does not prove the identities the evidence packet attributes to it. This is a single bounded evidence-record correction; no browser, build, test or product decision is required.

## Review 4 explanation

The command now executes, but it verifies only top-level keys. Record the fixture-value query used to establish the plan/group/node/blueprint facts. This review remained independent and read-only except for this assigned review file; it ran no browser, server, build, Unit or E2E command and changed no product, test, config, fixture, helper, spec, status or Git metadata.

## Review 5 finding closure

- **Review 4 group/blueprint identity finding — partially closed.** The new exact `rg` command exits 0 and its output includes `lf-1-g1`, `lf-1-g2`, `lf-1-g3`, blueprint `d111f259-6c0d-f519-aa82-10829f684cbb`, and `Katana` from `tests/fixtures/db.json`.
- **Review 4 module/isolated identity finding — still open.** The query does not include or output the exact module IDs or isolated `quantumtubes` recorded in `facts.md:8`; the facts command summary also still names jq although the result no longer records a jq command.

## Review 5 finding

### F2d — Moderate — Fixture command coverage and facts command attribution still disagree

- Owner: T007 result author; dispatcher binds the corrected result after re-review.
- Evidence: `T007-A1.md:39` searches only the three group IDs and Katana ID/name. Its output does not establish `module_gen_prod_claytronics_01`, `module_gen_prod_hullparts_01`, isolated `quantumtubes`, `module_gen_prod_quantumtubes_01`, or the Argon food/medical modules claimed at `facts.md:8`. Meanwhile `facts.md:55` still says jq provided fixture and module/ware identity, but the revised result records no jq command.
- Allowed correction: add an exact command that outputs the `logic-flow-1` group/node structure from `tests/fixtures/db.json`, including all identities in `facts.md:8`, and update `facts.md:55` to name the command actually retained (`rg` or jq). A precise jq projection is sufficient; no browser or test is needed.
- Verification: run the command verbatim from the recorded cwd, require exit 0, and verify the output ties every named module/isolated ware to the correct group. Recompute the facts and result hashes for final review.

## Review 5 acceptance

All behavioral, routing, storage/version, Base, Revision 1 and other command-record findings remain closed. Acceptance is withheld only for this mismatch between the retained fixture command and the facts attributed to it.

## Review 5 explanation

The new command proves the group IDs and Katana identity. Extend the retained fixture observation to the group contents and make the facts summary name the same tool. This review remained independent and read-only except for this assigned review file; it ran no browser, server, build, Unit or E2E command and changed no product, test, config, fixture, helper, spec, status or Git metadata.

## Review 6 finding closure

- **Review 5 command attribution finding — closed.** `facts.md:55` now records the exact `rg` command rather than attributing the observation to jq, and the result binds the revised facts hash exactly.
- **Review 5 fixture membership finding — partially closed.** Executing the recorded command exits 0 and proves g1's claytronics/hullparts modules and isolated quantumtubes, g2's quantum-tube module, all three group IDs, and the Katana ID/name. It does not output g3's two modules.

## Review 6 finding

### F2e — Moderate — The recorded fixture query omits g3's food/medical module identities

- Owner: T007 result author; dispatcher binds the corrected result after re-review.
- Evidence: `facts.md:8` states that `lf-1-g3` contains Argon food-rations and medical-supplies modules. The exact regex recorded at `facts.md:55` includes `lf-1-g3` but omits `module_arg_prod_foodrations_01` and `module_arg_prod_medicalsupplies_01`; its output therefore shows the group ID without either member. This leaves one claimed fixture-membership observation outside the command that is described as proving module membership.
- Allowed correction: add those two module IDs to the recorded regex and run the revised command with exit 0. Update the result's facts hash.
- Verification: execute the command verbatim and require output from `tests/fixtures/db.json` containing `lf-1-g3`, `module_arg_prod_foodrations_01`, and `module_arg_prod_medicalsupplies_01`; recompute the facts and result hashes.

## Review 6 acceptance

All earlier findings remain closed. Acceptance is withheld only for the two omitted g3 module terms in the retained fixture command.

## Review 6 explanation

The evidence chain is otherwise complete. Add the two g3 module IDs to the exact fixture query and refresh the bound hashes. This review remained independent and read-only except for this assigned review file; it ran no browser, server, build, Unit or E2E command and changed no product, test, config, fixture, helper, spec, status or Git metadata.

## Review 7 finding closure

- **Review 6 g3 membership finding — closed.** `facts.md:55` now includes `module_arg_prod_foodrations_01` and `module_arg_prod_medicalsupplies_01` in the exact fixture query. The command executes verbatim from the recorded cwd with exit 0, and `tests/fixtures/db.json` output contains both modules under `lf-1-g3`. The result binds the revised facts SHA-256 `677444c1a5374a78cf10aaee5a717e65a27f1c24c8c7aedbb14927e441dfc2f3` exactly.

## Final acceptance

All findings are closed. The accepted result is bound to contract revision 1, Base `d0614371558b2f6b30e8fd6b148347868228c413`, the retained Revision 1 plan/decisions, the T007 contract, and the facts packet by matching hashes. The storage/version keys, fixture identities, M11/M12 declaration inventories, M13 semantic boundaries, five independent M14 routes, and 3.3 three-condition gate are supported by the retained static evidence.

T018–T021 may consume the accepted facts subject to their own draft-opening, T010, implementation, runtime and independent-review contracts. T022 correctly remains blocked pending a planner-approved public card identity/browser witness; this unresolved downstream scope does not invalidate the completed T007 investigation. M13's three-row/five-badge totals correctly remain pending independent T020 derivation. No browser, server, build, Unit or E2E pass is implied.

## Final explanation

The result now provides a coherent, reproducible static handoff and preserves every explicit limitation. This final review remained independent and read-only except for this assigned review file; it ran no browser, server, build, Unit or E2E command and changed no product, test, config, fixture, helper, spec, status or Git metadata.
