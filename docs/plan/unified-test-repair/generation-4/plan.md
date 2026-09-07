# unified-test-repair 实施计划（第 4 代）

- Plan status: `ready`
- Context: `context.md`
- Supersedes: `../plan-2.md`
- Goal: `unified-test-repair`
- Initiative language: `Chinese（简体中文）`
- Execution note: 本计划只定义可执行合同，不启动 workflow、不创建 lane、不修改状态或 Git。

## Immutable target

- Control worktree: `/home/slepher/project/x4-station-calculator`
- Target branch: `develop`
- Target base: `da05d84514c90428fd4e51907df9b6424fa5ccff`
- Evidence target: `da05d84514c90428fd4e51907df9b6424fa5ccff`

所有 phase 都必须从各自声明的 `Base` 开始。target 可见性只通过 target 中介建立；产品修复的固定路由是 `coding -> target -> integrate -> target`，禁止 `coding -> integrate` 直合。

## Material outcome

把 target 上现有 E2E 任务、fixture、helper、locator 与 assertion 迁移到最新已接受规范和当前代码：先用真实用户路径复现，再把每项失败分类为 stale、test-owned、product 或 unknown；迁移 stale 测试并修复 test-owned 证据，产品缺陷交给有界 coding route，最终以可观察行为而非实现内部形状判断正确性。

## Current-generation decisions

1. 当前规范是 target 上已接受 OpenSpec 与 `context.md` 中重新绑定的行为；第 2 代计划、旧断言和历史 review 仅为证据，不是 authority。
2. binding、core、map 共用 Live archive fixture、shared draft、runtime group mapping 与真实 drag/drop 生命周期，不能形成稳定的独立写 ownership；因此只设一个串行 `single-sup` 父任务 `task-test-1`。
3. 已知 `core 5.3` 只是 product candidate。必须先修正 test-owned runtime mapping/witness，并在 target base 上以真实 pointer path 复现，才允许产品分类。
4. 间歇性通过不构成关闭：同一失败出现过后，单次重跑成功必须保留此前失败证据并继续 focused 与完整验证，直至满足对应 acceptance。
5. 无法执行或无法稳定验证的项目不得删除、跳过或改写为通过；按 `task-test-1-report-1.md` 合同保留 attempts、blocker、未满足 acceptance、recovery conditions，只阻塞明确依赖它的 closure。

## Scope

- 迁移 `tests/e2e/**`、`tests/unified-e2e/**`、`tests/legacy/e2e/**` 中当前 E2E 任务与历史原件，保持 canonical 与 legacy 边界。
- 更新 authoritative Live fixture/helper、独立 fixture oracle、locator、真实 mutation/drag witness 和领域 assertion。
- 只更新 `playwright.config.ts`、`package.json` 的 E2E scripts、`CLAUDE.md`、`sitemap.md` 中与本迁移直接相关的路径或命令。
- 覆盖 binding 三态、context switch/reset、candidate filtering、virtual draft 重算与提交、existing virtual drag/drop、trade-station invariant。

## Capability choices

| Capability | Choice | Current owner | Contract |
| --- | --- | --- | --- |
| Live archive/IndexedDB 初始化 | `reuse` | `loadLiveBindingFixture(page)` | 扩充既有 `transformSave` 输入，不新建平行 fixture loader |
| E2E canonical collection | `replace` | `playwright.config.ts` 与 E2E scripts | canonical 只收集 `tests/e2e/**`；legacy 仅保留历史 |
| Expected candidate/group oracle | `new` | fixture/test-owned data | 从输入 fixture 与规范常量独立得出，不读取 `autoGroupResult` 反推 expected |
| Virtual draft/drop witness | `extend` | 现有 binding/core/map specs | 使用真实 UI mutation 与 pointer path，不用 store 直改替代行为证据 |
| 产品缺陷修复 | `extend` | 现有产品生命周期 owner | 仅在 fresh reproduction 后创建有界 coding correction，不建第二条 drag/drop 或兼容路径 |

## Execution topology

当前只有 `task-test-1`，详见 `task-test-1.md` 与 `lanes.md`。它在 integrate lane 串行完成 discovery、reproduction、classification、migration、focused rerun 与 full E2E。`full-test` 仅是按需只读服务 lane，无 phase、无 owned paths、不得进入产品 merge route。

若 fresh evidence 证明 genuine product bug：暂停受影响 acceptance，由 planner 在本 generation 增补唯一 `task-test-1-fix-M.md` 与 lane route；coding worker 在 coding lane 修改显式授权的最小 `src/**`，独立 reviewer 接受后依次进入 `target -> integrate`，然后 `Returns to: task-test-1`。恢复前必须把该 fix ID 写入 `task-test-1` 的 `Depends on` 与 `Covers`，确保测试结论只基于 target 可见修复。

该 coding correction 的 `Implementation simplicity` 必须具体冻结：复用现有 shared draft 与 pointer/drop 主路径；在拥有 sector/group 映射语义的既有边界一次派生 `groupId`；保留 production virtual station 与 trade station 的不同 invariant；禁止新增平行 adapter、fallback 链、第二份状态或仅为旧测试保留的兼容行为；focused evidence 验证公开行为及异常/拒绝路径。测试合同本身不应用实现简洁性审查，只判断可观察正确性。

## Tasks

### task-test-1

- Outcome: 完成 current E2E 的复现、分类、迁移和验证，保留历史原件且不越过产品源码 ownership。
- Lane: `integrate`
- Execution strategy: `single-sup`
- Worker role: `sup_test_worker`
- Depends on: `none`
- Covers: `none`
- Base: `da05d84514c90428fd4e51907df9b6424fa5ccff`
- Contract: `task-test-1.md`

## Acceptance

- `A1`：每个迁移项都有 target-base reproduction 记录和 stale/test-owned/product/unknown 分类；历史结果不得冒充 fresh evidence。
- `A2`：binding `[查看 | 编辑 | 重算]`、retain/reset 与 archive context lifecycle 断言符合当前规范，并通过真实 UI mutation 验证 reset。
- `A3`：candidate threshold、top-5、pure-qualified、zero-container 及 group mapping 使用独立 fixture/runtime oracle，不从被测输出生成 expected。
- `A4`：virtual draft 保留、重算归属、未分组提交删除、confirm/apply 由领域字段和可观察 UI/持久化结果证明。
- `A5`：existing virtual station 使用真实 pointer drag/drop，完整证明 dragging、合法目标、preview、release 后位置/sector/group；trade station 始终固定 hub 且归 `tradeStation`。
- `A6`：canonical Playwright/E2E scripts 只收集 `tests/e2e/**`；`tests/unified-e2e/**` 不再存在，旧原件保留于 `tests/legacy/e2e/**` 且不要求通过。
- `A7`：focused suites、`npm run test:e2e`、`npm run build` 与 `git diff --check` 满足 `task-test-1.md` 的 blocking validation；没有用 skip、弱化 assertion、store 直改或一次间歇性 pass 伪造关闭。
- `A8`：任何 genuine product bug 均经 `coding -> target -> integrate -> target` 修复并回到父任务复验；test worker 未修改 `src/**`。

## Exclusions

- 不修改 `src/**`、产品语义、OpenSpec 或非 E2E scripts。
- 不恢复 stale Exit/retain/UUID identity 合同，不用 fallback 或 compatibility shim 迁就旧测试。
- 不新增测试框架、第二个 Live fixture loader、平行 draft/drop harness 或 speculative abstraction。
- 不要求 legacy tests 通过，不修复无关 Unit、skill 或外部环境失败。
- 本计划不创建状态/index、lane worktree、commit，不执行测试、build、npm 或浏览器。

## Validation

执行者按 `task-test-1.md` 运行 preflight、focused 和 full commands。初次失败、重跑结果、分类依据与修复后的结果必须同时保留。只有受影响 acceptance 的 blocking command 可阻止对应 closure；无关 failure 必须记录 owner 后继续其余可执行验证。

## Failure ownership and deferred closure

| Failure class | Immediate owner | Closure owner | Closure rule |
| --- | --- | --- | --- |
| stale/test-owned fixture、helper、locator、assertion、E2E config | `task-test-1` / `sup_test_worker` | `task-test-1` reviewer | 迁移后 focused 与 blocking validation 通过 |
| genuine product bug | 新增 `task-test-1-fix-M` / coding worker | `develop` target owner；随后 `task-test-1` reviewer 关闭测试 acceptance | source candidate 独立 review，通过固定 target-mediated route 后 fresh rerun |
| runner/browser/环境不可用 | 环境或 workflow owner | `develop` target owner | 保留 failure report；恢复条件满足后由有权限环境重跑精确 command |
| out-of-scope unrelated failure | 对应产品/测试 owner | `develop` target owner | 记录精确证据与依赖；不阻塞无依赖 acceptance |
| infeasible migration item | failure report 中命名的 owner | `develop` target owner | attempts、blocker、未满足 acceptance 与 recovery conditions 全部满足后才能关闭依赖项 |

## Handoff

`task-test-1` 候选经 test reviewer 接受后只能 `integrate -> target`。若存在未关闭 failure report，交接必须列出被阻塞 acceptance ID、明确 deferred closure owner 与 recovery command；其余无依赖 acceptance 可单独接受，但不得宣称整个 Goal 完成。
