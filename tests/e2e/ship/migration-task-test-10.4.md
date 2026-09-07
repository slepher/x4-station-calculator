# M10.4 migration — failed / incomplete

Owned four specs: ship-build-material, ship-build-stat, metric-panel-ui, bugfix-ship-status-diff; this doc and results/M10.4 only. No src/helper/base-fixture/git write. Keep original material console diagnostics (now attached to real nested slot/candidate/material rows; historical “wall sections” wording retained).

## Inputs / oracle

Canonical ship-build-material/stat/metric-panel-ui/status-diff read; current material presenter/analyzeShipBlueprintBuild, metric schema fixture/renderer, PanelStats and static8/9 JSON inspected. Newer abandon-selected-ship and blueprint-preset govern confirmed ship/Load dropdown. Every beforeEach db.json excludingvsn, reload, UI language. Material and preview use9stable cleanv5; stats explicitly use8stable and existing complete Odachi/Osaka fixtures, because independent36-field expected JSON describes8.0 Osaka95,000hull (9.0=104,000). No runtime expected generation or store business mutation. Only fixture setup and observational reads.

Material static9 ledger: Odachi production default energy2182/hull3174, terran computronic76/energy2182/microlattice698. Osaka default computronic295/energy8491/microlattice2717. ARG M engine default antimatter3/energy15/engineparts5, closedloop energy99/hull3. ARG M shield default energy21/fieldcoils5/shieldcomponents4, closedloop energy131/hull5. ARG L engine peritem antimatter147/energy25/engineparts67, count2. ARG L beam turret default advanced10/energy133/turret31; closedloop claytronics6/energy87/hull34. Lthruster provides default/terran/closedloop/xenon but non-Xenon ship excludes xenon. Mid price is rounded min/max mean, endpoint tests use keyboard Home/End. Fixed literal maps are independently transcribed from JSON, no production algorithm imports.

Nested M shields use hittable shield_arg_m_standard_02_mk1, not ship-shield _01 despite identical visible name/cost. Osaka first Lturret parent1→child2; Lengine parent2→child4. The old diagnostics now observe those exact independent UI paths, with unconditional candidate and material assertions.

## Original purpose mapping

| File / old IDs | Current real transaction |
|---|---|
| material2.1,2.2.1,2.3.1,3.1,3.8,3.9 | Odachi and Osaka separately: ship confirmation, exact production material rows/prices, independent ship cardx1, expand/collapse |
| material2.1.1,4.1.2,2.2.3–2.2.5,2.3.2,2.3.4–2.3.5 | Lthruster exact method union, excludesxenon, default→closedloop→terran actual per-method costs. Original4.1.2 despite generic title only tested Osaka; coverage retained |
| material2.2.2,2.3,2.5,3.4,3.7.1 | Odachi shield actual fallback todefault underterran; closedloop now has its own9.0 recipe and is tested as such; total verifies hullproduction + shield independently |
| material2.3.3,3.7.2 | Osaka ARG Lturret default cost unchanged underterran, supplied bythruster; closedloop uses turret ownrecipe but ship fallsbackdefault |
| material2.2,2.4,3.2,3.3,3.6,3.10 | Same Lengine IDcount2 rendersonecard with doubled exact material quantities, separate shipcard |
| material3.5 | UI slider min/max Cr and exact unchanged counts |
| material3.11 | UI equip/choosemethod/save/reload, exact mergedcosts and retainedmethod |
| material3.8 additional explicit requirement | Fixture hull100energycells + realengine: expect2182+100+15=2297, separate from production. Strict product candidate retained |
| material4.3.1,4.3.2 | Real turret/engine attachedshield, fixed compatiblehittablecandidate, exact2/4 shield quantities and costs, all originalconsole diagnostics retained |
| stat2.1,2.2,3.3,3.5,3.6 | Explicit8stable, real current-ship Load menu, full saved loadout IDs, all36 independent historical expected fields perOdachi/Osaka; soft perfield keeps other checks visible |
| stat3.1,3.2,3.4 | Exact18summary/36detail keys, togglesrepeatable, detailheight grows naturally |
| stat3.7–3.11 | Both ships hull/speed/crew visiblefilledbars; independent static8 hull/max ratios |
| stat3.12,3.13 | Real ChangeShip→S/XLclass activefilter and racecontrols |
| metric2.1,3.1,3.2 | Playground UI fixture, exact row/column order,3column schema and optionaltab absence |
| metric2.2–2.4,3.3–3.8 | Actual combat→travel→all and repeatedall, exact visiblekeysets |
| metric3.9,3.10 | Fixed current180/2600 andtarget205/3100; signed+25/−2 diff |
| metric3.11 | Exact6 raggedschema keys/holeordering, noTypeError/Unhandled, interactive maneuver tab |
| bugfixstatusdiff4.1 | ConfirmemptyOdachi→groupmode→actualturretcandidate positiveDPSdiff; readblueprint unchanged before/afterpreview andcancel |

## Evidence so far

Root /tmp/x4-migration-M10.4. baselinecollection62exit0. Representativebaseline6:1passmetric/5stale failures removedfilters/Load, exit1. Migrated metrics+diff5/5exit0. First stat run importattribute test-ownedcollectionerror; correctedimport then7cases5pass2fail (each ship onlyturretavg+boostrecharge differs). Material11cases7pass4fail: onehullproduct, three test-owned (textContent/innerText newline mismatch and 2 incompatible _01 childshield IDs). Test-owned corrections written; browser currently paused for parent sharedbuild, not yet claimedpassed. Additional exact doubledenginecost andbar ratio assertions await currentrun.

Unresolved stat: sourcePanelStats:130 divides averageDPS by6, contrary archivedship-build-stat/design.md average total/count and existing snapshots; boost_recharge renders100s vs acceptedrequest23/design475 1%/s. No newer normative replacement found in canonical/archive search. Hull sourceanalyzeShipBlueprintBuild never consumes blueprint.hull.materials; blueprintconfig remains100 but total2197 onlyproduction+engine, expected2297. No unchangedproductroute retry.

## Final full evidence

Parentfresh FIT/DETAILS/saveidentity dist: focused.log **20passed/3failed/0skipped**,23cases,exit1. Three test-owned material failures corrected andpassed; groupedengine exactdoubledcost andstatic hull/max ratios also passed. Onlyexplicit hull-material calculation andtwo fullstat snapshot cases fail; the latterboth exposeaverageDPS/6 andboostrecharge100s. Collection-final.log23exit0, diff-check.logexit0. Completefailed-run evidence, notcompositepass. Parentproductfix+freshdist+fullrerun required.
