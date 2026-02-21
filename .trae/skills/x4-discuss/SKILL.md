---
name: x4-discuss
description: "Discussion-phase skill for X4. Use with /x4:discuss to clarify requirements and produce implementation-ready conclusions."
---

# X4 Discuss

This skill owns `/x4:discuss` behavior.
It may rely on `openspec-explore` for analysis, but discussion outputs are standardized here.

## Purpose

- Clarify requirements, scope, constraints, and acceptance criteria.
- Produce conclusions that are directly usable by `/x4:new` or `/x4:ff`.

## Workflow (MANDATORY)

1. Clarify target change/problem and expected outcome.
2. Identify assumptions, risks, and unresolved decisions.
3. Provide a concise implementation-oriented plan.
4. If discussion is complete, prepare `request.md`-ready conclusions.

## Output Contract

- Problem statement
- Accepted scope / out-of-scope
- Acceptance criteria
- Technical constraints
- Pending decisions (if any)

## Constraints

- No source code changes.
- No document file edits unless user explicitly requests `/x4:doc`.
