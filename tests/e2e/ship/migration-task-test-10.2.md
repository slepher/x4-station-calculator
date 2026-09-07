# M10.2 equipment / selector / preset direct migration

Scope: six contract specs, this record and results/M10.2.md. No source/helper/base fixture/git writes; no subdelegation or build. Parent authorized consolidating repeated pseudo-state assertions into real transactions, retaining every independent acceptance and full old-ID mapping. Original inventory: 93 tests in six files (`/tmp/x4-migration-M10.2/collection-baseline.log`, exit 0).

## Authority and fixtures

Read canonical equipment-panel and ship-status-diff; archived 2026-03-03 ship-build-equipment; 2026-03-05 ship-equipment-selector spec/request and build-ship-equipment-panel request; 2026-03-09 blueprint-preset request. Later selector rules explicitly remove conflict blocking and require real confirm-based assignment; later blueprint preset rule moves Load to Fit-title dropdown. Neither current code nor later preset document (which explicitly excludes layout changes) overrides the old accepted layout, race threshold, unique-candidate or canonical detail-field requirements. Those remain strict failures if absent.

All beforeEach paths read db.json excluding vsn, explicitly use 9.0 stable/v5 ship state, reload, set language through UI. Osaka preset cases additionally preserve the rest of each original db.json/x4-export.json fixture. No test uses store to choose/install/clear/drag; read-only blueprint snapshots observe UI changes. Existing console logging in comparison 3.15 retained verbatim. The original two plain Playwright selector imports stay plain; other four retain test-setup diagnostics.

Static 9.0 evidence: Odachi two medium advanced/unhittable shields; Argon Mk1 shield=5750 MJ, Mk2=7475 MJ, delta1725; compatible TER Mk3 maximum9720 MJ. Osaka engine connection capacity2 but one connection key; large turret first group main count1 and child shield count2. Nova's real small weapon groups have advanced/combat versus advanced/missile tags, replacing setMockTagPatch. Heron selection narrows to L/Teladi/freighter so the target is on the visible page. Osaka large Argon turret compatibility allows beam/dumbfire/guided/laser/plasma; missile-only=2, union standard+missile=5. Old Odachi combined 7 weapon/missile expectation is stale: current actual connection tags do not contain both combat and missile. This representative union witness preserves the filtering requirement without broadening compatibility.

## Exact purpose mapping

| Original file / IDs | Current transaction(s) / reason |
|---|---|
| ship-build-equipment 2.1,2.2,2.3,2.4,3.17 | Three real Odachi/Osaka/Heron selection and workspace cases |
| 2.5,2.6,2.7,2.8,3.2,3.4 | Connection/group installation transaction: install separate connections, mode switch preserves snapshot, group clear/fill, standard counts |
| 3.3 advanced E/S/W/T baseline | Five type-specific real summary/details cases in build-ship-equipment-panel cover each actual compatible candidate path |
| 2.9,3.18,3.19 | Mixed installed turret IDs → group allowed → unchanged snapshot → resolve mixed state, per later removal of conflict guard |
| 3.1,3.5,3.15,3.16 | Osaka parent turret and child shield separately installed/read/counts; large group aggregate main1/3, shield2/6 |
| 3.6,3.7,3.8,3.9,3.12 | Actual advanced/unhittable vs standard/hittable turret and shield candidates, NPC-only excluded; no tested-store candidate algorithm used as oracle |
| 3.10,3.11,3.13,3.21 | Translation/compatibility label, stable candidate name across modes, image placeholders absent |
| 2.10,3.14 | Natural Nova same-size distinct-tag group split replaces business mock patch |
| 3.20 | Empty whitelist for real thruster hides compatibility box; no synthetic store patch |
| ship-equipment-selector 2.1,2.2,2.3 | Actual Osaka UI, picker → group mapping, picker stays open; closing preserves group mode |
| 2.4,3.7,3.8 | Actual slot/range geometry, 8px track, slate unfilled color |
| 2.5,3.10 | Real Mouse API drag: before-release blueprint unchanged; release0 retains ID/count0; stats/material match clean control |
| 3.2 | Unique weapon partial1/2 → direct slot click must fill2/2, strict shortcut requirement |
| 3.3 | Explicit UI full2/2 control → direct click must clear0/2, separate failure path |
| 3.4 | Explicit empty picker confirm in group → standard0/1 |
| 3.9 | Engine group max2 must step2; catches connection-count vs capacity error |
| 3.5 | >3 real race chips must occupy two rows |
| 3.1,3.6 | Accepted expanded two-column and25.6px row geometry, strict conflict retained |
| bugfix-ship-equipment-selector 4.1 | Two genuinely different installed turret IDs; group mode allowed with snapshot unchanged (replaces constant assertion) |
| build-ship-equipment-panel 2.1–2.5,3.5–3.14 | Five type cases: real summary values, complete canonical detail key arrays; engine travel colon format strict |
| 2.6,3.16,3.20 | Empty current preview shows5750 MJ, blueprint unchanged until confirmation, exact installedID/count witness |
| 2.7,3.17,3.24 | Same shield shows5750 MJ without delta/colored comparison bar |
| 3.1,3.18 | Equipment above Stats, cancel hides details and restores materials |
| 3.2 | Full compatible maximum9720 MJ remains constant after race filter |
| 3.3,3.22 | Mk1→Mk2 +1725 MJ, positive class/bar, no preview mutation |
| 3.4,3.23 | Mk2→Mk1 -1725 MJ, negative class/bar |
| 3.15 | Empty candidate displays current values; after explicit clear both-empty hides details; original debug capture/log retained |
| 3.19,3.21 | Candidate Mk1→Mk2 changes fixed values; switch to engine replaces shield metric set |
| bugfix-build-ship-equipment-panel 4.1 | Strict Fit expansion >60% width plus material hiding |
| 4.2,4.3,4.4 | Installed engine→empty candidate retains current neutral metrics; explicit clear→empty hides details→new candidate displays details |
| 4.5 | Empty-current candidate has neutral non-comparison style (old boostDuration=0 assumption not used; static engine boostDuration is nonzero) |
| 4.6 | Asgard large8/medium3 group tabs separated |
| 4.7 | Real Osaka standard/missile union2→5 with fixed beam/dumbfire identities, replaces obsolete7 weapon+missile count |
| 4.8 | Confirm Katana after Odachi picker; picker closes, materials/standard mode restored |
| 4.9 | Tokyo medium group tabs5+5 |
| osaka-default-preset six low/mid/high × db/export | All six retained: real selector confirmation→Fit preset dropdown→blueprint engine/turret positive count and visible populated slots. Old modal card summary replaced by post-load configuration+UI witness, because accepted new menu has labels only |

## Evidence so far

Root `/tmp/x4-migration-M10.2/` retains all runs. Original representative baseline7:5 stale failures,2 pseudo passes; neither pseudo pass counts as acceptance. `baseline.log`, exit1. Preset migrated checks2/2 low passed (`preset-ui.log`); prior syntax error from a one-off string replacement is retained in `preset-check.log`, fixed before collection. Comparison focused13:11 pass,2 canonical product candidates (`panel-focused.log`). Selector focused9:3 pass,5 product candidates,1 test-owned innerText/textContent mismatch (`selector-focused.log`); mismatch corrected. Equipment focused10:6 pass,4 test-owned visible-page/group-tab/current-group assumptions (`equipment-focused.log`); corrected before full scope. Parent's consolidated fresh build (DLC, Blueprint compute, selector lifetime) completed before the six-file full run. Final count/classification is pending that run, not claimed here.

## Delivered current evidence

- Consolidated collection: **46 tests in six files**, exit0, `collection-final.log`; no skip/fixme/only. Reduction93→46 follows the explicit mapping above, not deletion of failing acceptance.
- Complete six-file fresh-dist run: `focused.log`, **37 passed / 9 failed / 0 skipped**, exit1. Eight product candidates remain. The ninth failure was test-owned child shield schema (`group.shield`, not an independent top-level group).
- Corrected child shield schema and strengthened negative candidate assertions to scan every real UI pager page. Targeted `correction.log`: **2 passed / 0 failed**, exit0. The other changed-page check previously passed; one previously failed case is now verified passing. **Combined latest evidence:38 satisfied /8 failed /0 unverified across46 cases**. This is explicitly composite, not a fictional38/8 single run.
- Owned `git diff --check` exit0 (`diff-check.log`). Debug capture/console.log preserved; source/helper/fixture paths untouched.
- Product failure routes were not retried after complete reproduction; recovery requires independent product triage/repair or authoritative resolution of accepted UI-spec conflicts, fresh dist, and focused rerun. Details and exact trace paths are in results/M10.2.md.


## Independent E2E verification after shared fresh build

Current browser evidence: /tmp/x4-migration-M10.2/fix-focused.log initially3passed/2failed; DETAILS turret+engine andFITstep passed, but two FIT setup helpers still waited for a picker after a unique-candidate click that now correctly installs directly. Parent authorized consumer setup migration: one real standard slotclick installs1/1, groupclick fills2/2, nextgroupclick clears0/2; no storewrites or weakened verdicts. Also migrated the same clear setup in selector3.4.

Complete six-spec46-case run /tmp/x4-migration-M10.2/fix-full.log **43passed/3failed/0skipped**, exit1. All five original FIT/DETAILS product failures nowpassed in thisfullrun, including independent partial/full/step and canonicalturret/enginefields+travelcharge summary. Count0realdrag/pre-releasepurity/material/stat exclusion andothercomparison cases also passed. Onlythree separatelypendinglayout requirements remainfailed; they donotcloseM10.2. fix-collection.log46exit0, fix-diff-check.logexit0. Existingfailure logs remain.

Command: PORT=22302 npm exec playwright test -- --config=/tmp/x4-test-migration-env/preview-only.config.ts tests/e2e/ship/ship-build-equipment.spec.ts tests/e2e/ship/ship-equipment-selector.spec.ts tests/e2e/ship/bugfix-ship-equipment-selector.spec.ts tests/e2e/ship/build-ship-equipment-panel.spec.ts tests/e2e/ship/bugfix-build-ship-equipment-panel.spec.ts tests/e2e/ship/osaka-default-preset.spec.ts --workers=1 --retries=0 --trace=on --output=/tmp/x4-migration-M10.2/fix-full

ScopedBUG-FIT andBUG-DETAILS requiredUnit/build/E2E verified. WholeM10.2 remainsincompletependinglayoutdecision.
