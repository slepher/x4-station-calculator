# unified-test-repair 泳道清单（第 2 代）

- Lanes status: `ready`
- Plan: `plan-2.md`
- Execution: serial
- Merge concurrency: `1`

## Control worktree

- Name: `x4-station-calculator`
- Path: `/home/slepher/project/x4-station-calculator`
- Target branch: `develop`
- Target base: `1c9fab8809fd8e31f8679a2f27a7021cc3f46e02`

## Lane coding

- Worktree name: `coding`
- Worktree path: `/home/slepher/project/x4-station-calculator/.worktree/coding`
- Branch: `codex/unified-test-repair-g1-coding-final`
- Serial: `true`
- Owns: `task-coding-3`
- Purpose: active workflow/skill contract and agent gate

## Lane integrate

- Worktree name: `integrate`
- Worktree path: `/home/slepher/project/x4-station-calculator/.worktree/integrate`
- Branch: `codex/unified-test-repair-g1-integrate`
- Serial: `true`
- Owns: `task-test-3`, then `task-test-4`
- Purpose: canonical test migration and test-owned repair

## Lane full-test

- Worktree name: `full-test`
- Worktree path: `/home/slepher/project/x4-station-calculator/.worktree/full-test`
- Branch: `codex/unified-test-repair-g2-full-test`
- Serial: `true`
- State: `disabled`

## Phase task-coding-3

- Kind: `coding`
- Lane: `coding`
- Depends on: `none`
- Covers: `none`
- Base: `1c9fab8809fd8e31f8679a2f27a7021cc3f46e02`

## Phase task-test-3

- Kind: `test`
- Lane: `integrate`
- Depends on: `task-coding-3`
- Covers: `task-coding-3`
- Base: `1c9fab8809fd8e31f8679a2f27a7021cc3f46e02`

## Phase task-test-4

- Kind: `test`
- Lane: `integrate`
- Depends on: `task-test-3`
- Covers: `task-coding-3`
- Base: `1c9fab8809fd8e31f8679a2f27a7021cc3f46e02`

## Order

```text
task-coding-3 -> target -> task-test-3 -> target -> task-test-4 -> target
```

- `task-test-3` starts only after active routing no longer exposes old `x4-test-*`.
- `task-test-4` starts only after Unit/Vitest migration is accepted, so `tests/legacy/**` layout and package scripts are stable.
- Product defects found by test tasks return to a coding fix task; test workers do not repair `src/**`.
- Out-of-scope failures are routed to their owner and do not block the current task.

## Owned-path partition

| Task | Exclusive owned paths |
| --- | --- |
| `task-coding-3` | `.trae/skills/**`, `.trae/skills-legacy/**`, `.codex/multiagent.config.yaml`, `tests/e2e-skills/**`, relevant skill scripts, `docs/plan/unified-test-repair/test-skill.md` |
| `task-test-3` | `tests/unit/**`, `tests/unified-unit/**`, `tests/skills/**`, `tests/legacy/unit/**`, `tests/legacy/skills/x4-test/**`, `tests/test-setup.ts`, `vitest.config.ts`, Unit/skill scripts in `package.json` |
| `task-test-4` | `tests/e2e/**`, `tests/unified-e2e/**`, `tests/legacy/e2e/**`, `playwright.config.ts`, E2E scripts in `package.json`, `CLAUDE.md`, `sitemap.md` |

`package.json` 的同文件 ownership 串行移交：`task-test-3` 只改 Unit/skill scripts，`task-test-4` 基于已接受版本只改 E2E scripts。
