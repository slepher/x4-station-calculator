---
name: x4-ff
description: "Fast-forward orchestration for OpenSpec artifacts in X4 project. Trigger with /x4:ff to sequence required docs; test-doc must pass x4-test-doc-viewer gate."
---

# X4 Fast-Forward Orchestration

This skill is an orchestrator for `/x4:ff`.
It decides artifact order and progression speed.
Document writing rules and update rules are owned by `x4-doc`.

## Trigger

User invokes `/x4:ff <change_name>`

## Purpose

After discussion, quickly push documentation forward by generating required artifacts in order.

## Input

- Change name (kebab-case) or feature description
- Discussion conclusions (if `/x4:ff` follows `/x4:discuss`)

## Change Name Resolution (MANDATORY)

- Resolve `change-name` using `x4-user-workflow` rules before any action.
- If multiple matches, stop and ask the user to choose; list available active changes.
- If no match, auto-create `openspec/changes/<change-name>/` and proceed.
- After resolution, print: `Resolved change: <change-name>`.

## Ownership Boundary (MANDATORY)

- `x4-ff` owns:
  - sequencing
  - required-artifact checklist
  - dependency order and progress reporting
- `x4-doc` owns:
  - all document detail rules and update rules

Test documentation review ownership:
- `x4-test-doc` owns test-doc drafting/updating.
- `x4-test-doc-viewer` owns final test-doc review and pass/rewrite gate, and MUST run in dedicated isolated reviewer subagent.

Do not duplicate `x4-doc` writing standards in this skill.

## Workflow (MANDATORY)

1. Use the already-resolved `change-name` from the resolver.
2. If coming from `/x4:discuss`, ensure `openspec/changes/<change-name>/request.md` exists first.
3. Before generating downstream artifacts, validate `request.md` against `x4-doc` "request.md Positioning" standards.
   If not satisfied, revise `request.md` first.
4. Build required artifact list (minimum):
   - `request.md` (if missing)
   - `spec.md` (or delta spec)
   - `design.md` (if needed)
   - `tasks.md`
   - `test_tasks.md` (for functional changes)
   - `ui_knowledge.md` (when Web Integration tests exist)
   - `bugs.md` (if bug-tracking is part of current scope)
5. Execute artifact generation in dependency order by invoking `x4-doc`.
6. If current pass includes `test_tasks.md` or `ui_knowledge.md`, enforce review loop:
   - run `/x4:test-doc-viewer <change-name>` in a dedicated isolated reviewer subagent;
   - if `review_status=rewrite_required`, route back to `/x4:test-doc` rewrite, then rerun viewer;
   - continue loop until `review_status=pass`.
7. After each artifact/gate, report progress (`done/total`) and next artifact.
8. Stop only when all required artifacts are generated and required test-doc reviewer gate passes, or a blocker needs user input.

## Constraints

- Enforce zero-code policy: do not edit `src/**` or runtime test code in this phase.
- Keep this skill as orchestration-only; delegate all document content rules to `x4-doc`.
- If isolated reviewer subagent cannot be created, stop and report blocker; do not downgrade to in-thread review.

## Output

- Completed artifact list
- Test-doc review gate summary (`review_status`, rewrite loop count when applicable)
- Missing/blocker list (if any)
- Final status: ready for `/x4:apply` or next requested phase
