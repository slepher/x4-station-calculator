# T009-A1 static inspection

- Contract revision: 1
- Repository: `/home/slepher/project/x4-station-calculator`
- Base: `8b5894bc85a7de3d608efa8db74357d942764519`
- Candidate: working tree base plus the two owned-spec locator changes
- Browser resource: `e2e-build-browser` held by T005; focused browser run deferred

## Expected branches

- `tests/fixtures/db.json` selects `empire-1` and `empire-1-station-1`, whose planned `hullparts` flow supplies the two available levels `[1, 2]`: labels `Primary`, `Secondary`; hours `12h`, `2h`; descriptions `Long`, `Short`.
- The same fixture produces consumption-only `ore`, whose available levels are `[0]`: label `No Demand`, hours `1h`, description `Res`. The label and description are separate cells.
- `FavoriteButton.vue` retains the left interactive favorite tooltip, right interactive lock tooltip, four-column priority layout, `label-cell` minimum width `80px`, `hours-cell` minimum width `70px`, and `nowrap` cells.

## Change decision

Existing expected text, row counts, and fixture values match these branches. The stale part was the generic `.tippy-box` locator in layout/side checks, which could select the wrong tooltip when multiple Tippy nodes exist. The specs now scope favorite checks to `.priority-tooltip-container` and lock checks to `.lock-tooltip-container`.

## Static checks

1. `npm exec playwright test -- tests/e2e/button-tooltip-integration.spec.ts tests/e2e/button-tooltip-side/button-tooltip-side.spec.ts --list --reporter=list` — exit 0; 8 tests in 2 files collected.
2. `git diff --check -- tests/e2e/button-tooltip-integration.spec.ts tests/e2e/button-tooltip-side/button-tooltip-side.spec.ts` — exit 0.

