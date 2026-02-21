---
name: x4-ff
description: "Fast-forward orchestration for OpenSpec artifacts in X4 project. Trigger with /x4:ff to sequence required docs; all document details are owned by x4-doc."
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

## Ownership Boundary (MANDATORY)

- `x4-ff` owns:
  - sequencing
  - required-artifact checklist
  - dependency order and progress reporting
- `x4-doc` owns:
  - all document detail rules and update rules

Do not duplicate `x4-doc` writing standards in this skill.

## Workflow (MANDATORY)

1. Resolve `change-name` using `x4-user-workflow` change resolver.
2. If coming from `/x4:discuss`, ensure `openspec/changes/<change-name>/request.md` exists first.
3. Build required artifact list (minimum):
   - `request.md` (if missing)
   - `spec.md` (or delta spec)
   - `design.md` (if needed)
   - `tasks.md`
   - `test_tasks.md` (for functional changes)
   - `ui_knowledge.md` (when Web Integration tests exist)
   - `bugs.md` (if bug-tracking is part of current scope)
4. Execute artifact generation in dependency order by invoking `x4-doc`.
5. After each artifact, report progress (`done/total`) and next artifact.
6. Stop only when all required artifacts are generated or a blocker needs user input.

## Constraints

- Enforce zero-code policy: do not edit `src/**` or runtime test code in this phase.
- Keep this skill as orchestration-only; delegate all document content rules to `x4-doc`.

## Output

- Completed artifact list
- Missing/blocker list (if any)
- Final status: ready for `/x4:apply` or next requested phase
