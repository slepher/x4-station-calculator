# Coding Task Contract

- Task: `task-coding-2`
- Bundle generation: `1`
- Phase artifact: `task-coding-2.md`
- Plan: `plan-1.md`
- Lane manifest: `lanes-1.md`
- Context: `context-1.md`
- Evidence target: `task-coding-1` accepted merge `7c622141914ae0e532833a98d0949d7a6decf475` on target branch `develop`
- Task kind: `coding`
- Mode: `normal`
- Mode basis: Vitest 与 Playwright 装配路径可拆为两个无重叠、串行 default subtasks。
- Execution strategy: `split-def`
- Worker role: `def_coding_worker`
- Lane: `coding`
- Worktree: `/home/slepher/project/x4-station-calculator/.worktree/coding`
- Branch: `codex/unified-test-repair-g1-coding`
- Base: `7c622141914ae0e532833a98d0949d7a6decf475`
- Depends on: `task-coding-1`
- Covers: `none`

## Bounded goal

修复测试入口和共享数据装配，使 canonical unit/E2E 始终针对当前源码、当前版本 storage key 与统一 fixture 运行。该阶段只修 harness/helper，不修改任何测试场景或产品行为。

## Normative objectives

- Vitest 默认运行 unified + skill verification，不再默认采集 legacy `tests/unit/**`。
- Playwright 默认运行 unified E2E，不再默认采集 legacy `tests/e2e/**`，并且每次正式 run 使用与当前源码一致的 fresh `dist`。
- fixture 由当前 `versions.json`/产品 storage key 规则生成或注入，不硬编码 8.0/v2 key，不使用 fallback 链。
- `beforeEach` 保持 fixture -> reload -> UI 设置语言；禁止 `localStorage.clear()`。
- Live helper 是唯一 archive/binding 装配 owner，负责 localStorage、save.json、IndexedDB、reload、视图切换和 UI 语言。
- 404、preview 失败、browser launch failure 与业务 assertion failure 使用不同 evidence 分类。

## Owned paths

只允许写：

- `vitest.config.ts`
- `playwright.config.ts`
- `package.json`（仅在复用现有脚本无法表达 canonical 入口时）
- `tests/test-setup.ts`
- `tests/fixtures/`
- `tests/seeds/`
- `tests/unified-e2e/live/helpers/loadLiveBindingFixture.ts`
- `AGENTS.md`、`CLAUDE.md`（仅同步 canonical helper/目录规则）

不得写任何 `*.spec.ts`、产品源码、OpenSpec/guide 或 workflow artifacts。

## Implementation simplicity

- Standard: `audit-implementation-simplicity`
- Task-specific requirements: 复用现有 Vitest/Playwright/Vite 和 Live helper；不新增 runner、fixture framework、selector abstraction、版本 adapter、第二份 DB fixture 或额外依赖；fresh build 用现有 npm/Vite 命令表达；按一个当前 storage key 写入，不使用 sequential fallback。
- Required evidence: config include/exclude resolution、fresh-build trace、fixture key 来源、Live helper 单一 owner/caller audit、owned diff、focused commands/exits。

## Subtask task-coding-2.1

- Worker role: `def_coding_worker`
- Lane: `coding`
- Depends on sibling subtasks: `none`
- Owned paths: `vitest.config.ts`, `tests/test-setup.ts`, `tests/fixtures/`, `tests/seeds/`。
- Observable objective: canonical unit collection 不采集 legacy spec，fixture/setup 与当前版本/API 对齐。

### Required work

1. 收敛 Vitest include，保留 unified 与 skill verification，移除 legacy unit 默认采集。
2. 对齐 shared setup 的 Pinia/i18n 环境，避免每个 spec 重造不一致的全局 mock。
3. 校验 db/save fixtures 与当前 storage key、shape 和 seed 生成规则；最小修正公共数据，不在 fixture 内复制产品算法。
4. 运行 collection/focused smoke，确认不会因配置隐藏 unified 文件。

### Focused self-run

```bash
npm run test:unit -- --run tests/unified-unit/production/reorder-stations.spec.ts
npm run test:unit -- --run tests/skills/unit tests/e2e-skills/unit
git diff --check
```

## Subtask task-coding-2.2

- Worker role: `def_coding_worker`
- Lane: `coding`
- Depends on sibling subtasks: `task-coding-2.1` reviewed checkpoint
- Owned paths: `playwright.config.ts`, optional `package.json`, Live helper, optional `AGENTS.md`/`CLAUDE.md` rule sync。
- Observable objective: canonical E2E 每次使用 current build，Live fixture helper 完成唯一正确装配，legacy E2E 不被默认采集。

### Required work

1. 移除“仅 dist 不存在才 build”的陈旧产物路径；使用现有脚本确保 run 对应当前 HEAD。
2. 让 Playwright 明确采集 `tests/unified-e2e`，排除 legacy 与 unit/skill-unit 路径，保留 worktree 独立端口。
3. 修正 Live helper 的当前版本 storage key、IndexedDB archive、reload、live view 与 UI 语言步骤；禁止手写 records 回填。
4. 同步仓库规则中的 helper 路径，仅修改确实不一致的行。

### Focused self-run

```bash
npm run build
npm exec playwright test -- --list tests/unified-e2e
npm exec playwright test -- tests/unified-e2e/live --workers=1
git diff --check
```

若 Chromium sandbox 不可用，前两项仍须完成；第三项返回 exact launch command/environment/output，状态为 unavailable 而非 passed。

## Blocking self-validation

- Commands: canonical Vitest focused collection; skill-unit smoke; `npm run build`; canonical Playwright list; Live focused E2E when browser is available; config/key/helper audits; `git diff --check`

## Deferred downstream validation

- Commands: 完整 unified unit 与完整 fresh-build unified E2E。
- Owner: `task-test-2`
- Expected transitional failures: test specs 尚未迁移旧 import/mock/locator，故完整套件在 test tasks 前仍可能失败；browser sandbox unavailable 不计通过。
- Closure gate: test tasks 必须在接受的 coding-2 target revision 上运行；任何 harness 产品缺陷按 coding correction route 修复后重跑。

## Observable completion

- 默认 runner 只执行 canonical + 明确保留的 skill tests。
- fixture/helper 对齐当前版本，Live 场景只有一个装配 owner。
- Playwright 不再静默复用陈旧 `dist`，失败分类可区分构建/服务器/浏览器/业务断言。

## Stop conditions

需要新增依赖/runner、改变产品 storage schema、修改 spec 来补 harness、引入 fallback 链，或无法在 owned paths 内确定当前 key/fixture shape。

## Handoff

返回 exact base/candidate、changed paths、config collection list、fresh-build/key/helper trace、命令/exit、browser environment evidence 与 deferred failures。不得 stage/commit/merge 或修改测试场景。
