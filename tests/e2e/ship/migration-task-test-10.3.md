# M10.3 blueprint hierarchy / persistence / item migration

Exclusive four specs plus this document/results. No source/helper/base fixture/git write. Original collection46 tests in4 files; representative baseline4/4 failed at removed filter/Load anchors (`/tmp/x4-migration-M10.3/baseline.log`, exit1).

## Authority and current preconditions

Read canonical import-export/title-as-plan-title/context-toolbar, archived ship-level-blueprint, ship-build-storage, ship-items and newer toolbar-action2one; previously accepted blueprint-preset and abandon-selected-ship apply to current Load dropdown and New preserving ship context. Current store/Toolbar SmartSave flow, Fit Load/Delete, ShipStoragePanel and static9.0 JSON were inspected. Runtime is current v5 under x4_ship_blueprints_v9 with explicit9.0 stable; no legacy store mutation APIs used.

Every beforeEach injects db.json excludingvsn, reloads, chooses language through UI. Default ship state is genuinely empty ships[], not merely null active IDs: initial migrated small batch proved current migration selects a saved fallback when nonempty ships remain. That shared precondition failure was stopped (three failed, one interrupted, twelve not run); those unexecuted tests are not claimed passed. Two explicitly named Load cases use predetermined saved Odachi/Osaka active IDs from db.json, preserving other-ship records to verify menu isolation. All other state follows actual selection/confirmation, equipment candidate, SmartSave, delete confirmation, range input, or tab UI.

Static fixtures: Odachi con_engine_01 capacity1; Osaka engine capacity2 with nested shield4; item capacities deployable250/countermeasure20/drone10/missile160. First deployable waypointmarker_01, second resourceprobe_01. Empty droneTags gives three legal drones (fighting/cargo/repair). Actual Argon large dumbfire turret has dumbfire/largedumbfire ammunitionTags, yielding8 real missile candidates. Quantity tests use keyboard range actions or Mouse API, not unsupported fill(range) or direct store writes.

## Purpose mapping

| Original file / IDs | Current real transaction |
|---|---|
| ship-level2.1,3.1 | Empty selector: mutations disabled; Load unavailable via absent toolbar control/hidden Fit trigger |
| ship-level2.2,3.3 | Real engine makes dirty → New dialog → discard → same ship, empty equipment |
| ship-level2.3,3.2 | Save As named blueprint, mutate shield, Save; correct v5/current ship active state; second clean Save leaves entire persisted payload unchanged |
| ship-level3.4 | Explicit saved Odachi fixture, menu excludes Katana/Osaka; load and Save As dialog reachable |
| bugfix-level4.1 | No ship means no reachable Load control or list; replaces caught forced-click and constant pseudo assertions |
| storage2.1,2.2,2.3 | Empty selector→Odachi→real Argon engine with fixed connection/name/count |
| storage2.4,2.5,3.1,3.2 | Save new named blueprint; Save As new ID, identical connections, both records persisted |
| storage3.3,3.3b,3.4 | Saved active blueprint reloads exact equipment/identity; change selector reflects M/Terran/corvette |
| storage3.5 | Native delete confirmation→saved row removed/current ID cleared→refresh excludes deleted name |
| storage3.6 | Explicit empty candidate removes group instead of null field; newer toolbar-action2one requires empty Save As warning/no persistence. Add shield, Save As and refresh verify removed engine absent and retained shield exact |
| storage2.6,3.7,3.8,3.9 | Dirty dot, view switch retains draft, New asks; cancel + Save clears dirty. Tab switch does not discard current draft; no obsolete forced prompt assumed |
| storage3.10 | Group turret install persists two underlying count1 connections through reload |
| storage3.11 | Confirm Katana clears draft equipment while saved Odachi retained |
| storage3.12 | Shield tab and candidate commit change visible name and exact shield ID; original Initial/After picked logs retained |
| storage3.15,3.16,3.17,3.18,3.19,3.22 | Accepted Fit dropdown replaces old modal cards. Saved Osaka restores localized ship, independent main/child slot rows and nested counts; refresh matches complete blueprint. Obsolete modal sorting/two-line cards not asserted on the new labels-only menu; canonical saved ordering covered below |
| storage3.20,3.21 | Equip types in reverse order, save and reload canonical engine/thruster/shield/weapon/turret order |
| items2.1,2.2,2.3 | Real E/R/S/W/T/C/U order and C→U transition; group/compatibility/slot wall hidden |
| items3.1,3.2 | Deployable30/250 and countermeasure20/20 independent updates; fixed item ID; dual versus single fill topology |
| items3.3 | Three matching drones, quantity6+4 reaches shared10 capacity with exact IDs |
| items3.4,3.5 | No weapon no missiles; actual turret commit produces8 matching missiles, quantity15/160 persisted in blueprint |
| items3.6,3.7 | Configure50, explicit named save and Save As; copied storage and UI survive refresh |
| items3.8 | With deployable30 assigned, actual second slider mouse drag to far right clamps220 and total250; slider stays enabled |

Original debug messages are preserved. Two old “Skipping…” console messages are diagnostic-only branches followed by unconditional required assertions; they cannot produce a pass when preconditions are absent. No skip/fixme/only or pseudo-state writes. Final focused/list/diff evidence will be appended when complete; historical checked cases are not implied to pass now.

## Delivered evidence

Full22-case run on parent-confirmed Core fresh dist: `focused.log`,17 passed/5 failed, exit1. Three failures were test-owned: reloaded normalization adds favorite:false; deleting the final blueprint correctly returns to selector on refresh; New dialog has an icon close button rather than a Cancel text button. All corrected and verified in `correction.log` (3 passed/1 product failed, exit1). The fourth correction case makes the drag input assertion soft solely to continue independent count/storage checks, not to pass.

Latest composite across22: **21 satisfied/1 product candidate failed/0 skipped**. This is not a21/1 single run. The later accepted toolbar-action2one spec/request §4 supersedes empty-ship always-dialog: empty Save As must warn and reject. empty-final.log verifies both rejection and nonempty save/reload after retaining a shield (1/1 exit0). Prior empty-correction.log retains a test-owned failure expecting an empty engine wrapper; serialization correctly omits the removed connection. Final collection22 exit0 (`collection-final.log`); owned diff-check exit0 (`diff-check.log`). Original logs retained. No repeated product route after this downstream evidence collection.

## Current settled evidence

After the parent product fix and fresh dist, the original 3.8 case uses real mouse down/move/up and an unconditional DOM-value assertion. It passes with DOM property `220`, visible total `250 / 250`, blueprint counts `30/220`, and an enabled slider. The complete four-spec run on PORT 22603 passes **22/22**, exit 0, with no skip or failure; traces are under `/tmp/x4-test-repair-M10.3/full/`. Collection lists 22 tests in 4 files and `git diff --check` exits 0. The former stale-value failure and traces remain historical artifacts.
