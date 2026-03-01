---
name: x4-test
description: "Execute tests, triage failures, and sync documents. Mandatorily delegates all test authoring/fixing to x4-test-impl."
metadata:
  version: "5.3"
---

# X4 Test Execution Pipeline

This skill owns test execution, failure triage, and test result sync for a change.

## Trigger

User invokes `/x4:test <change_name>`

## Purpose

Run test pipeline for the target change, delegate test-code fixes to `x4-test-impl`, collect run outputs, and hand them to result-apply script for updating `test_tasks.md`.

## Parameters

- `<change_name>`: change folder in `openspec/changes/`.
- `<change_name>` accepts abbreviation token and must be resolved by `x4-user-workflow` rules.

## Change Name Resolution (MANDATORY)

- Resolve `change-name` using `x4-user-workflow` rules before any action.
- If multiple matches or no match, stop and ask the user to choose.
- Do not auto-create change on resolution failure.
- After resolution, print: `Resolved change: <change-name>`.

## Input

- `openspec/changes/<change-name>/test_tasks.md`
- `openspec/changes/<change-name>/ui_knowledge.md`
- Existing tests in `tests/unit/<change-name>/` and `tests/e2e/<change-name>/`
- Latest run results grouped by test run batch

## Actions

1. Resolve target change and load test inputs.
2. Run tests in ordered batches and classify failures.
3. Delegate test-code defects to `x4-test-impl` and re-run affected batches.
4. Collect batch run outputs and invoke result-apply script.
5. Sync `ui_knowledge.md` as agent-side experience sedimentation (`经验沉淀`).

## Mandatory Requirements

### Chapter A: Agent-Only Mandatory

#### A.1 Boundary And Delegation (MANDATORY)

1. Must enforce path boundary by delegating to `x4-test-impl` guard rules.
2. `x4-test` MUST NOT author/fix test code directly.
3. If tests are missing or failures are test-code defects, MUST delegate to `x4-test-impl`.

#### A.2 Execution Pipeline (MANDATORY)

1. If source changed, run `npm run build` before Playwright.
2. Recommended run order:
   - state cases (`状态:`)
   - transition cases (`切换:`)
   - remaining scenario/bug cases
3. Failure triage:
   - test defect -> delegate to `x4-test-impl`
   - product defect -> keep failing result and continue remaining runs

#### A.3 Guardrails (MANDATORY)

- Do not infer missing run results.
- Do not mark unexecuted cases as pass/fail.
- Agent must not manually edit `test_tasks.md`; any `test_tasks.md` mutation must be done by result-apply script.

#### A.4 Experience Sedimentation (MANDATORY)

`经验沉淀` is an agent responsibility, not a script capability:

1. Agent must consolidate historical and current run findings.
2. Agent must remove wrong/obsolete conclusions (for example, invalidated by code changes).
3. Agent must keep accumulated valid conclusions.
4. Agent must deduplicate semantically equivalent conclusions before passing input to script.
5. In `ui_knowledge.md`, maintain a dedicated chapter `# 测试运行` using a task-tree style similar to `test_tasks.md`.
6. Only keep cases that have failed at least once in history.
7. Sort case entries by case id in ascending order.
8. Update experience as child items under each case node.
9. Case status reflects latest run result:
   - latest result pass -> case checkbox `[✓]`
   - latest result still fail -> case checkbox `[✗]`
10. Keep existing maintenance for other `ui_knowledge.md` anchors/sections unchanged; `# 测试运行` is additive and must not break existing anchor structure.

Suggested format:

```markdown
# 测试运行

- [✗|✓] <case-id> <case-desc>
  - [ ] 失败标号: <x.x.x | x.x.x.n>
  - [ ] 运行现象: <key observation>
  - [ ] 经验沉淀: <validated conclusion summary>
```

### Chapter B: Update Mandatory

#### B.1 Result-Apply Script Contract (MANDATORY)

`x4-test` must use result-apply script behavior to apply run results.

1. Agent only collects/organizes run outputs and passes them to script input.
2. Script updates `test_tasks.md` only.
3. Script responsibility is apply/update, not verification judgment.
4. Updates are applied per test run batch.

#### B.2 Input Contract For Result Apply (MANDATORY)

Each update batch must provide:

1. success case set
2. failure case set
3. failure marker id for each failure case (`x.x.x` or `x.x.x.n`)

Unmentioned cases in a batch MUST remain unchanged.

#### B.3 Apply Rules (MANDATORY)

For a failed case:

1. failed marker item -> `[✗]`
2. same-level items before failure -> `[✓]`
3. same-level items after failure -> `[ ]`
4. parent chain of failure item -> `[✗]`
5. rules apply to both level-2 and level-3 failures

For a passed case:

1. top-level case item -> `[✓]`
2. all defined level-2 and level-3 items under that case -> `[✓]`

#### B.4 Batch Apply Order And Workflow (MANDATORY)

1. A single test run may include multiple cases.
2. Update must be applied once after that run batch completes.
3. Multiple run batches must be applied serially in run order.
4. No concurrent/bulk unordered updates.
5. Workflow:
   - run one test batch
   - aggregate batch result
   - apply result-apply script once for this batch
   - continue next batch and repeat

#### B.5 Result-Apply Error JSON Contract (MANDATORY)

When update application fails, script MUST support `--json` and output:

```json
[{"case":"1"|"1.1"|"1.1.1"|"1.1.1.1"|"global","desc":"Desc","error_code":"CODE","error_msg":"Message"}]
```

Rules:

1. `case` points to the failed target scope; use `global` when not attributable.
2. `desc` is the related task/case description when available.
3. `error_code` is stable and machine-checkable.
4. `error_msg` is human-readable failure detail.

## Constraints

- Keep ownership split: `x4-test` executes/tests/syncs, `x4-test-impl` authors/fixes test code.
- Only modify files relevant to current change unless user requests otherwise.

## Output

- Test run summary by batch (pass/fail/product-defect)
- Applied update summary from result-apply script (`test_tasks.md`)
- Agent-side experience sedimentation summary (obsolete removal + valid accumulation + dedup)
- Remaining blockers

## Example Usage

```
/x4:test storage-auto-fill
```
