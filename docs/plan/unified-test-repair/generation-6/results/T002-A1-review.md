- Task: T002
- Contract revision: 1
- Result: T002-A1.md
- Candidate snapshot: final revised `T002-A1.md` SHA-256 `9bc54820a74eb8ec1d97d6db21cf6e71c8c0a8d868b622611a8eb910c633b5f7`; Base `d0614371558b2f6b30e8fd6b148347868228c413`; contract revision 1 inputs retained by the recorded hashes and `generation-6/revisions/revision-1/`
- Verdict: passed

## Review 1 findings (historical)

Previous candidate SHA-256 `4cc59aaae2ffd04734dcc0b841ac985111e46d1a4ca6d145ad6e7910bd6ac9d5`; verdict `changes-required`.

1. **Major — latest historical outcomes are misclassified as unmet.** Owner: T002 evidence runner/result author. Evidence: `T002-A1.md:40,51` says M15.1 remains 37/46 and lists nine station failures, but `direct-migration/results/M15.1.md:7-12` records the later complete single run as 46/46, with the 37/46 run explicitly retained as pre-fix history at `:14-16`; generation-6 `plan.md:92` and the README `:50` also preserve 46/46. `T002-A1.md:51` likewise lists the M3.1 core product candidate as an explicit remaining gap although `direct-migration/results/M3.1.md:59-67` records the frozen original case and full core scope passing 1/1 and 15/15 after the fix; the supplementary scopes are separately recorded as complete. Allowed correction: amend the ledger and remaining list to preserve M15.1 46/46 and M3.1 core 15/15 as historical results, while retaining their earlier failures and the still-missing candidate/reviewer binding. Do not promote either to a current-generation pass. Verification: compare each corrected row against the latest section and the earlier-history section of the named result, then confirm the remaining list contains only unmet behavior or explicit identity/review gaps.

2. **Major — the required per-number supplemental mapping is absent.** Owner: T002 evidence runner/result author. Evidence: Acceptance 2–3 in `tasks/T002.md:19-20` requires original number → behavior → fixed input → UI action → independent expected → evidence, with M3.1-GRAPH/DRAFT/TRADE-DRAG and M3.2-UI mapped per number. `T002-A1.md:20-23` aggregates GRAPH as “9 numbered cases,” omits GRAPH IDs, omits the TRADE-DRAG original `4.6`, and collapses the M3.2-UI seven transactions without their IDs. The authoritative mappings are enumerated in `tests/e2e/auto-sector-group-one-core/migration-task-test-3.1-graph.md:5-18`, `migration-task-test-3.1-draft.md:5-14`, `migration-task-test-3.1-trade-drag.md:3-7`, and `tests/e2e/auto-sector-group-one-map/migration-task-test-3.2-ui.md:5-13`. Allowed correction: expand these four ledger entries by original ID, including `4.6` → reused M3.2 `6.1–6.5`, and keep E2E latest-single, Unit, collection, composite and audit claims visibly distinct. Verification: account once for every ID in those four mapping documents and trace every row to its fixed input, real UI action, independent expected and named result/test evidence.

3. **Major — the execution input/candidate identity is not reproducible.** Owner: T002 evidence runner/result author; planner only if a compared input changed. Evidence: `tasks/T002.md:23-25` requires rechecking relevant content at dispatch and recording input/candidate fingerprints. `T002-A1.md:4-5` records Base plus broad `git status` entries and “unchanged current working tree,” but the generation-6 directory is untracked, so Base does not bind `plan.md`, `decisions.md`, `input-evidence.md`, the task, or their execution-time bytes. The result records only a prior manifest verification and its validation list at `:59-64` hashes the manifest file without checking its entries. This review independently observed manifest check exit 0 and no diff from Base in the relevant tracked legacy sources, but that later observation cannot reconstruct the unretained execution-time untracked inputs. Allowed correction: retain hashes for every required untracked input and the result candidate, and record a current `sha256sum --quiet -c` command/cwd/exit; if any input changed, return to planner for a new precise snapshot rather than backfilling identity. Verification: recompute every recorded hash and require an exact match before rereview.

4. **Moderate — T003 is incorrectly named as T002's independent review.** Owner: T002 evidence runner/result author. Evidence: `T002-A1.md:22,49,71` routes this result to T003, while `tasks/T002.md:25` reserves `T002-A1-review.md` for another session. `tasks/T003.md:10-21,31` scopes T003 to M8.3/M9.1 and its own `T003-A1-review.md`. Allowed correction: replace the T003 references with this T002 independent-review handoff and keep T003 confined to its own contract. Verification: `rg 'T003' T002-A1.md` should find no claim that T003 reviews or accepts T002.

## Review 1 acceptance (historical)

The report does cover every top-level T002 allocation and correctly preserves several decisive boundaries: M2.1's missing automatic station-change witness; M7.2 Case5; the four M7.3 sector cases; the three M10.2 layouts; M6.2 at 32px; M8.1 at 46/46; M8.2 at 32/32; reuse of M3.2 `6.1–6.5` for TRADE-DRAG; and M15.4's closed oracle without re-adjudication. It also generally distinguishes historical runs from current-generation evidence and correctly reports that no browser, build, Unit or E2E validation was run.

Acceptance is withheld because the wrong M15.1/M3.1 remaining-state conclusions, missing per-number mappings, and unretained input identity affect the core inheritance ledger. A corrected result must retain the real earlier failures, current historical passes, and all still-unmet behavior without treating README audit wording as an independently bound verdict.

## Review 1 explanation (historical)

This review was independent of the T002 implementation. Read-only verification used the repository at HEAD `d0614371558b2f6b30e8fd6b148347868228c413`: the historical manifest check exited 0, and the relevant tracked README/tasks/results/mapping documents had no diff from that Base. No product, test, fixture, configuration, runtime status, Git metadata, server, build or test command was changed or run.

After the result author corrects all four findings and binds the revised report to exact inputs, rereview only the changed ledger rows, remaining list, routing text and identity block; the accepted mappings above can be reused.

## Review 2 finding closure

1. **Review 1 finding 1 — partially closed.** M15.1 now correctly distinguishes the post-fix historical 46/46 from the pre-fix 37/46, and M3.1 core correctly preserves post-fix 15/15 without claiming current-generation acceptance (`T002-A1.md:20,62,73`). A separate M3.1-DRAFT misclassification remains below.
2. **Review 1 finding 2 — structurally closed.** `T002-A1.md:21-45` enumerates the GRAPH, DRAFT, TRADE-DRAG and M3.2-UI IDs, including original TRADE-DRAG `4.6` → M3.2 `6.1–6.5`, with inputs, actions, expected behavior and evidence boundaries. One mapped action is semantically wrong and remains below.
3. **Review 1 finding 3 — closed.** The recorded hashes match the retained revision-1 plan and decisions snapshots, current `input-evidence.md`, T002 contract and README; the prior-result hash also matches the first reviewed candidate. This review recomputed the revised result hash above, observed `sha256sum --quiet -c` exit 0, and observed no Base diff in the relevant tracked legacy sources. The live plan/decisions are now revision 2, but D12 explicitly preserves T002's executed revision-1 result and the exact revision-1 files are retained.
4. **Review 1 finding 4 — closed.** `T002-A1.md:71,95` now routes T002 to `T002-A1-review.md` and confines T003 to M8.3/M9.1.

## Review 2 findings

1. **Major — M3.1-DRAFT's repaired behavior is still classified as unmet.** Owner: T002 evidence runner/result author. Evidence: `T002-A1.md:33` stops at the historical 5/6 product failure and `:73` lists baseline reabsorb as an explicit unmet behavior. The same authoritative result leads with post-fix 6/6 at `direct-migration/results/M3.1-DRAFT.md:1-3` and records the product fix, Unit 47/47, build, original failure 1/1, complete E2E 6/6 and independent source review at `:35-45`; revision-1 `plan.md:58` preserves that latest result. Allowed correction: keep the pre-fix 5/6 as negative history, add the later post-fix 6/6 boundary to the affected per-number row, remove baseline reabsorb from explicit unmet behavior, and leave only its candidate/reviewer identity gap. Verification: the revised row and remaining list must agree with both result phases and must not claim a current-generation runtime pass.
2. **Moderate — the M3.2-UI old 3.4 action is mapped incorrectly.** Owner: T002 evidence runner/result author. Evidence: `T002-A1.md:41` says “UI transparent/recompute,” but `tests/e2e/auto-sector-group-one-map/migration-task-test-3.2-ui.md:9` specifies an initially missing color, then UI color assignment and recompute, retaining edited `#f44e3b`. Transparent color is a different clear-color behavior. Allowed correction: replace the action with UI set-color → recompute and retain the initial dashed/no-fill plus edited-color expected. Verification: compare the revised row to mapping line 9 and `direct-migration/results/M3.2-UI.md:9-13`.
3. **Moderate — the revised A1 candidate is mislabeled A2.** Owner: T002 evidence runner/result author. Evidence: the file remains `T002-A1.md`, header `Attempt: 1`, but `:70,91` calls its final hash “A2.” Allowed correction: call it the revised/final A1 result; the reviewer already binds its current hash above. Verification: `rg 'A2' docs/plan/unified-test-repair/generation-6/results/T002-A1.md` returns no identity claim.

## Review 2 acceptance

The revised report closes the original M15.1/M3.1-core classification, per-number coverage, retained-input fingerprint, and T003-routing defects. Its historical/current, latest/composite/collection and independent-review boundaries otherwise remain usable, including the explicit M2.1, M7.2, M7.3 and M10.2 gaps and the preserved M6.2/M8.1/M8.2/M15.4 conclusions.

Acceptance remains withheld because M3.1-DRAFT is a required T002 inheritance row and is still reported with the wrong final state. The two narrower mapping/identity errors should be corrected in the same result revision. After correction, rereview only `T002-A1.md:33,41,70,73,91` and the resulting file hash; all closed findings and accepted rows can be reused.

## Review 2 explanation

This rereview remained independent and read-only. It ran no browser, server, build, Unit or E2E command and changed only this review file.

## Review 3 finding closure

Previous candidate SHA-256 `bd4eab0bd1b0ab2e5752fdf40b665c56334ff3bc377429d4bc964e421bfb3081`; verdict `changes-required`.

1. **Review 2 finding 1 — closed.** `T002-A1.md:33` now retains the pre-fix 5/6 as negative history and the later post-fix 6/6 as the latest historical result. `:73` removes baseline reabsorb from unmet behavior while retaining the candidate/reviewer identity limit and making no current-generation pass claim.
2. **Review 2 finding 2 — closed.** `T002-A1.md:41` now maps old 3.4 to an initially missing color, UI set-color, recompute, and retained edited `#f44e3b`, matching the authoritative mapping.
3. **Review 2 finding 3 — closed.** `T002-A1.md:70,91` uses prior-result/revised-final A1 wording; `rg 'A2' T002-A1.md` finds no identity claim.

## Review 3 acceptance

All Review 1 and Review 2 findings are closed on the final candidate. The ledger covers the assigned top-level mappings and required M3 supplemental IDs, preserves latest-single, historical/composite, collection and audit boundaries, retains explicit unmet behavior, and separates historical pass claims from current-generation evidence and independent acceptance.

Verdict `passed` accepts T002's bounded inheritance ledger at contract revision 1. It does not convert any historical command into a current run, close M2.1/M7.2/M7.3/M10.2 behavior gaps, supply absent historical candidate/reviewer identities, or replace dispatcher acceptance.

## Review 3 explanation

This final rereview was independent and limited to the three corrected locations plus the result hash. No browser, server, build, Unit or E2E command was run; only this review file was updated.
