# T008-A3 static checks

- Candidate HEAD: `8b5894bc85a7de3d608efa8db74357d942764519`
- Contract revision: 1
- Working directory: `/home/slepher/project/x4-station-calculator`

## Collection

Command:

```bash
npm exec playwright test -- --list tests/e2e/build-flow/build-flow.spec.ts tests/e2e/build-plan-goal/build-plan-goal.spec.ts tests/e2e/build-plan-preview/build-plan-preview.spec.ts tests/e2e/build-plan-compute/build-plan-compute.spec.ts
```

Exit status: 0.

Result: 43 tests collected in exactly four files:

- build-flow: 6
- build-plan-goal: 21
- build-plan-preview: 9
- build-plan-compute: 7

This was list-only collection. It did not start the configured web server, build, preview, or a browser.

## Diff check

Command:

```bash
git diff --check -- tests/e2e/build-flow/build-flow.spec.ts tests/e2e/build-plan-goal/build-plan-goal.spec.ts tests/e2e/build-plan-preview/build-plan-preview.spec.ts tests/e2e/build-plan-compute/build-plan-compute.spec.ts
```

Exit status: 0. No output.

Scoped diff stat: four files changed, 234 insertions, 695 deletions.

## Static stale-oracle scan

The four owned specs contain no `__pinia`, stale `data-testid="allocation-section"`, `test.skip`, `test.fixme`, `test.fail`, `isVisible()` branching, conditional awaited assertions, partial-object matchers, inequality count assertions, or fixed sleeps. The only `allocation-section` match is the current CSS class `.allocation-section-title` used to identify a public preview section.

## Runtime boundary

No A3 browser/build run was performed. A3 is ready for the dispatcher-controlled exact focused rerun on `PORT=23208`.
