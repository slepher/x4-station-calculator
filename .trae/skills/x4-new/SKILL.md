---
name: x4-new
description: "Create a new X4 change step-by-step. Use with /x4:new as orchestration; document details are owned by x4-doc."
---

# X4 New

This skill owns `/x4:new` orchestration.
It can rely on `openspec-new-change`, while X4 phase rules are defined here.

## Purpose

Create a new change iteratively with confirmation points.

## Input

- `change-name` (optional; supports abbreviation token such as `std`)
- Resolve by `x4-user-workflow` "Change Name Resolution" rules

## Change Name Resolution (MANDATORY)

- Resolve `change-name` using `x4-user-workflow` rules before any action.
- If multiple matches or no match, stop and ask the user to choose; list available active changes.
- Do not auto-create a change on resolution failure.
- After resolution, print: `Resolved change: <change-name>`.

## Workflow (MANDATORY)

1. Use the already-resolved `change-name` and source context from the resolver.
2. If coming from discuss, ensure conclusions are available as `request.md` source.
3. Validate `request.md` quality using `x4-doc` "request.md Positioning" standards before downstream generation.
   If not satisfied, revise `request.md` first.
4. Run step-by-step artifact creation flow.
5. Keep progress visible and pause for user confirmation when needed.

## Delegation

- Use `openspec-new-change` for base creation process.
- Use `x4-doc` for all document detail rules.

## Output

- Created change scaffold and artifacts.
- Current step status and next step.
