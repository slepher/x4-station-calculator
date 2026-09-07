# unified-test-repair 泳道清单（第 4 代）

- Lanes status: `ready`
- Plan: `plan.md`
- Execution: `serial`
- Merge concurrency: `1`

## Control worktree

- Name: `x4-station-calculator`
- Path: `/home/slepher/project/x4-station-calculator`
- Target branch: `develop`
- Target base: `da05d84514c90428fd4e51907df9b6424fa5ccff`

## Lane coding

- Worktree name: `coding`
- Worktree path: `/home/slepher/project/x4-station-calculator/.worktree/coding`
- Branch: `codex/unified-test-repair-g4-coding`
- Serial: `true`
- Owns: `none`（仅在 fresh product reproduction 后由当前 generation amendment 分配 correction）
- Purpose: test-discovered、reviewer-confirmed product correction

## Lane integrate

- Worktree name: `integrate`
- Worktree path: `/home/slepher/project/x4-station-calculator/.worktree/integrate`
- Branch: `codex/unified-test-repair-g4-integrate`
- Serial: `true`
- Owns: `task-test-1`
- Purpose: canonical E2E migration、fixture/helper/assertion repair 与验证

## Lane full-test

- Worktree name: `full-test`
- Worktree path: `/home/slepher/project/x4-station-calculator/.worktree/full-test`
- Branch: `codex/unified-test-repair-g4-full-test`
- Serial: `true`
- State: `read-only, on-demand`
- Owns: `none`
- Purpose: 仅在 integrate 环境无法提供 full-suite evidence 时复验 target-visible candidate；不得写入、拥有 phase 或进入 merge route

## Phase task-test-1

- Kind: `test`
- Mode: `hard`
- Mode basis: binding/core/map 共享 Live archive fixture、shared draft、runtime group mapping 与 pointer drag/drop 生命周期，拆分会产生重叠 ownership 和反复重开。
- Execution strategy: `single-sup`
- Worker role: `sup_test_worker`
- Lane: `integrate`
- Depends on: `none`
- Covers: `none`
- Base: `da05d84514c90428fd4e51907df9b6424fa5ccff`

## Order

```text
target@da05d84514c90428fd4e51907df9b6424fa5ccff -> task-test-1@integrate -> reviewer -> target
```

Fresh reproduction 确认 genuine product bug 时，当前 generation 增补唯一 correction phase，完整顺序必须是：

```text
task-test-1 checkpoint -> task-test-1-fix-M@coding -> reviewer -> target -> integrate refresh -> task-test-1 rerun -> reviewer -> target
```

- 产品 correction 固定为 `coding -> target -> integrate -> target`；禁止 coding candidate 直合 integrate。
- correction contract 必须声明 `Returns to: task-test-1`；恢复前将实际 fix ID 写入父任务 `Depends on` 与 `Covers`。
- `full-test` 只读取 target-visible candidate；不拥有 acceptance、文件或 merge。
- 间歇性 pass 保留先前 failure，不改变 route，也不允许提前关闭。

## Owned-path partition

| Task | Exclusive owned paths |
| --- | --- |
| `task-test-1` | `tests/e2e/**`, `tests/unified-e2e/**`, `tests/legacy/e2e/**`, `playwright.config.ts`, E2E scripts in `package.json`, `CLAUDE.md`, `sitemap.md` |
| conditional `task-test-1-fix-M` | 由 fresh reproduction 后的独立 coding contract 显式列出最小 `src/**`；在该合同创建前为 `none` |
| `full-test` | `none` |

`task-test-1` 不拥有任何 `src/**`。同一文件内只允许修改 `package.json` 的 E2E scripts；其他 script ownership 不随本计划转移。

## Failure routing

- stale/test-owned failure 留在 `task-test-1`。
- product candidate 先停在 reproduction checkpoint；只有 current evidence 和 reviewer 分类成立才进入 coding correction。
- infeasible item 写入 `task-test-1-report-1.md`，只阻塞报告中列明的 dependent acceptance；其余验证继续。
- out-of-scope failure 记录精确 command、结果与 owner，由 `develop` target owner 管理 deferred closure。
