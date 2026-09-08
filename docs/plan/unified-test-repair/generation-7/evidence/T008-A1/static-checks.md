# T008-A1 static checks

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
- build-plan-preview: 8
- build-plan-compute: 8

No Playwright collection error was emitted. This was list-only collection; it did not start the configured web server, build, preview, or browser tests.

## Diff check

Command:

```bash
git diff --check -- tests/e2e/build-flow/build-flow.spec.ts tests/e2e/build-plan-goal/build-plan-goal.spec.ts tests/e2e/build-plan-preview/build-plan-preview.spec.ts tests/e2e/build-plan-compute/build-plan-compute.spec.ts
```

Exit status: 0. No output.

Scoped diff stat: four files changed, 191 insertions, 590 deletions.

## Runtime boundary

The required focused Playwright command was not run. T005 still held the exclusive `e2e-build-browser` resource, and the dispatcher explicitly requested no browser startup until reassignment.
