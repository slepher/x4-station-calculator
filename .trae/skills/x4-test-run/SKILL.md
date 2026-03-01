---
name: x4-test-run
description: "Run change-scoped tests, apply result updates, and maintain run sedimentation docs. Trigger with /x4:test-run <change-name>."
metadata:
  version: "1.0"
---

# X4 Test Run

This skill executes test batches for a change and applies run-result updates.

## Trigger

User invokes `/x4:test-run <change_name>`

## Purpose

Run tests, classify failures, apply result updates to `test_tasks.md` via script, and maintain agent-side experience sedimentation in `ui_knowledge.md`.

## Parameters

- `<change_name>`: target change under `openspec/changes/`.

## Change Name Resolution (MANDATORY)

- Resolve to a single existing `openspec/changes/<change-name>` target before any action.
- If multiple/no matches, stop and ask user to choose.
- After resolution, print: `Resolved change: <change-name>`.

## Input

- `openspec/changes/<change-name>/test_tasks.md`
- `openspec/changes/<change-name>/ui_knowledge.md`
- `openspec/test_experience.md`
- Existing tests in `tests/unit/<change-name>/` and `tests/e2e/<change-name>/`

## Actions

1. Resolve change and load test artifacts.
2. Execute tests in ordered batches and classify failures.
3. Aggregate batch run outputs and invoke result-apply script.
4. Maintain experience sedimentation in `ui_knowledge.md` and global discoveries in `test_experience.md`.

## Mandatory Requirements

### Chapter A: Agent-Only Mandatory

#### A.1 Execution Rules (MANDATORY)

1. If source changed, run `npm run build` before Playwright.
2. Recommended run order:
   - state cases (`状态:`)
   - transition cases (`切换:`)
   - remaining scenario/bug cases
3. Classify failures:
   - `test_defect`
   - `product_bug`

Failure classification rules (MANDATORY):

1. Classify as `test_defect` when failures are caused by test implementation issues, including:
   - wrong/missing task-comment mapping or numbering usage in tests
   - incorrect assertions or expected values in test code
   - unstable wait/retry timing, setup/fixture/mock mistakes
   - selector/locator mismatch while product behavior is still correct
2. Classify as `product_bug` when failures are caused by product behavior defects, including:
   - documented expectation is correct but runtime behavior is wrong
   - failure is reproducible in product behavior and cannot be resolved by test-only fixes
   - source/business logic changes are required to make the case pass
3. Triage order:
   - first exclude `test_defect` with minimal test-side checks/fixes
   - if still failing, classify as `product_bug`
4. Uncertain cases:
   - mark as tentative `product_bug` and hand off to bug workflow for reproduction confirmation

#### A.2 Guardrails (MANDATORY)

- Do not infer missing run results.
- Do not mark unexecuted cases as pass/fail.
- Agent must not manually edit `test_tasks.md`; `test_tasks.md` updates are script-only.

#### A.3 Experience Sedimentation (MANDATORY)

1. Agent maintains `经验沉淀` in `ui_knowledge.md`.
2. Keep a dedicated chapter `# 测试运行` with task-tree style entries.
3. Keep only cases that failed at least once in history.
4. Sort case entries by case id ascending.
5. Case status reflects latest run:
   - latest pass -> `[✓]`
   - latest still fail -> `[✗]`
6. Not simple append: remove obsolete/wrong conclusions, keep accumulated valid conclusions, deduplicate.
7. Keep existing `ui_knowledge.md` anchor structure unchanged; `# 测试运行` is additive.
8. Global/non-case discoveries go to `test_experience.md`.

### Chapter B: Update Mandatory

#### B.1 Result-Apply Contract (MANDATORY)

1. Agent prepares script input only.
2. Result-apply script updates `test_tasks.md` only.
3. Script is apply/update, not verification judgment.
4. Apply per test run batch.

#### B.2 Script Input Contract (MANDATORY)

Each batch must provide:

1. success case set
2. failure case set
3. failure marker id per failed case (`x.x.x` or `x.x.x.n`)

Unmentioned cases remain unchanged.

#### B.3 Apply Rules (MANDATORY)

For failed case:

1. failed marker -> `[✗]`
2. same-level before failure -> `[✓]`
3. same-level after failure -> `[ ]`
4. parent chain of failed marker -> `[✗]`
5. applies to level-2 and level-3 failures

For passed case:

1. case top-level -> `[✓]`
2. all defined level-2 and level-3 items under case -> `[✓]`

#### B.4 Batch Order And Workflow (MANDATORY)

1. One test run may include multiple cases.
2. Apply once after that run batch completes.
3. Multiple batches apply serially in run order.
4. No concurrent/bulk unordered apply.

#### B.5 Error JSON Contract (MANDATORY)

On apply failure, script supports `--json` and returns:

```json
[{"case":"1"|"1.1"|"1.1.1"|"1.1.1.1"|"global","desc":"Desc","error_code":"CODE","error_msg":"Message"}]
```

## Output

- Batch test run summary (pass/fail/product-defect)
- `test_tasks.md` apply summary (script result)
- Experience sedimentation updates in `ui_knowledge.md`
- Global discoveries appended to `test_experience.md`
- Remaining blockers

## Example Usage

```
/x4:test-run storage-auto-fill
```
