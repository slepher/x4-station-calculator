---
name: x4-new
description: "Create a new X4 change step-by-step. Use with /x4:new as orchestration; document details are owned by x4-doc."
---

# X4 New

This skill owns `/x4:new` orchestration.
It can rely on `openspec-new-change`, while X4 phase rules are defined here.

## Purpose

Create a new change iteratively with confirmation points.

## Workflow (MANDATORY)

1. Resolve `change-name` and source context using `x4-user-workflow` change resolver.
2. If coming from discuss, ensure conclusions are available as `request.md` source.
3. Run step-by-step artifact creation flow.
4. Keep progress visible and pause for user confirmation when needed.

## Delegation

- Use `openspec-new-change` for base creation process.
- Use `x4-doc` for all document detail rules.

## Output

- Created change scaffold and artifacts.
- Current step status and next step.
