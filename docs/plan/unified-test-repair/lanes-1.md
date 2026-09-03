# unified-test-repair 泳道清单（第 1 代草案）

- Lanes status: `draft`
- Plan: `plan-1.md`
- Concurrency: `lanes`
- Merge policy: `merge-ready FIFO`
- Merge concurrency: `1`

## Control worktree

- Name: `x4-station-calculator`
- Path: `/home/slepher/project/x4-station-calculator`
- Target branch: `develop`
- Target base: `b62034868643b9d2a9af48ab0f634b067e80880d`

## Lane coding

- Worktree name: `coding`
- Worktree path: `/home/slepher/project/x4-station-calculator/.worktree/coding`
- Branch: `codex/unified-test-repair-g1-coding`
- Serial: `true`

## Lane integrate

- Worktree name: `integrate`
- Worktree path: `/home/slepher/project/x4-station-calculator/.worktree/integrate`
- Branch: `codex/unified-test-repair-g1-integrate`
- Serial: `true`

## Lane full-test

- Worktree name: `full-test`
- Worktree path: `/home/slepher/project/x4-station-calculator/.worktree/full-test`
- Branch: `codex/unified-test-repair-g1-full-test`
- Serial: `true`
- State: `disabled`

## Defaults

- Default coding lane: `coding`
- Default integration lane: `integrate`
- Route: `coding -> target -> integrate -> target`
- Test visibility gate: covered coding candidate 必须先 merge 到 `develop`，integrate lane 再从该 target HEAD 刷新，测试任务才可开始。
- Product correction route: test finding -> `task-test-N-fix-M` in coding -> target -> integrate refresh/rerun -> target。
- Full testing: `disabled`；light profile 使用 task-scoped self-validation，不启动常驻 full-test service。

## Phase task-coding-1

- Kind: `coding`
- Mode: `normal`
- Mode basis: Sidebar 组件、presenter/store 调用链与相邻规范文档可拆成两个串行、无重叠 owned-path subtask。
- Execution strategy: `split-def`
- Worker role: `def_coding_worker`
- Subtasks: `task-coding-1.1`, `task-coding-1.2`
- Lane: `coding`
- Depends on: `none`
- Covers: `none`
- Base: `b62034868643b9d2a9af48ab0f634b067e80880d`

## Phase task-coding-2

- Kind: `coding`
- Mode: `normal`
- Mode basis: unit 与 E2E 装配路径分离，可由两个串行 default subtasks 修复并各自验证。
- Execution strategy: `split-def`
- Worker role: `def_coding_worker`
- Subtasks: `task-coding-2.1`, `task-coding-2.2`
- Lane: `coding`
- Depends on: `task-coding-1`
- Covers: `none`
- Base: `7c622141914ae0e532833a98d0949d7a6decf475`

## Phase task-test-1

- Kind: `test`
- Mode: `hard`
- Mode basis: 108 个 unified 与 85 个 legacy unit spec 的分类、迁移、去重和 mock 修正共享同一收集/fixture 不变量，单一高能力 owner 更安全。
- Execution strategy: `single-sup`
- Worker role: `sup_coding_worker`
- Lane: `integrate`
- Depends on: `none`
- Covers: `task-coding-1, task-coding-2`
- Base: `b62034868643b9d2a9af48ab0f634b067e80880d`

## Phase task-test-2

- Kind: `test`
- Mode: `hard`
- Mode basis: 60 个 unified 与 18 个 legacy E2E spec 必须在一个稳定 Sidebar/fixture/fresh-build candidate 上统一裁剪和重写 locator。
- Execution strategy: `single-sup`
- Worker role: `sup_coding_worker`
- Lane: `integrate`
- Depends on: `task-test-1`
- Covers: `task-coding-1, task-coding-2`
- Base: `b62034868643b9d2a9af48ab0f634b067e80880d`

## FIFO 与 fix 路由

1. `task-coding-1` 是初始 ready task；其两项 subtask 串行 checkpoint/review 后形成 candidate。
2. `task-coding-2` 只从已接受的 coding-1 target HEAD 开始；任何 coding review finding 进入 coding priority-fix FIFO。
3. 两个 coding parent 都合入 target 后，integrate 从 target HEAD 刷新，再启动 `task-test-1`。
4. `task-test-2` 从已接受的 test-1 integrate checkpoint 开始；两者都不得直接修 product。
5. 任一 test product finding 回 coding lane，修复先到 target，再刷新 integrate 并重跑受影响测试；禁止 coding -> integrate 直合。
6. 只有 test-2 的完整 immutable candidate 通过 review/self-validation，test-owned changes 才能 integrate -> target。
