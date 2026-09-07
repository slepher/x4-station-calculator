---
name: x4-discuss
description: "Discussion-phase skill for X4. Use with /x4:discuss to clarify requirements and produce implementation-ready conclusions."
---

# X4 Discuss

涉及拖拽（含 shadow、占位与 hover 稳定性）时，在方案设计、实现、测试或排障前读取 [x4-drag](../x4-drag/SKILL.md)，并将该要求带入子任务派发说明。按其场景配方选择实现和验证方式；本阶段的文件与执行权限保持不变。

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
