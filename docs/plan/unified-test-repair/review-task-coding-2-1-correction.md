Status: completed

Task: `task-coding-2.1` correction review under parent `task-coding-2`

Reviewed commit: `6b25ad2da03e9336d4bf7e5895eb5736113ffad3`；prior candidate `f3625da701b726dfcfd60a3abca70306c466d989`；base target `7c622141914ae0e532833a98d0949d7a6decf475`。候选直接以 prior candidate 为唯一 parent，审查与验证前后 `/home/slepher/project/x4-station-calculator/.worktree/coding` 的 HEAD 均精确指向该完整 SHA，worktree 保持 clean。

Evidence:

- `git diff --name-status f3625da701b726dfcfd60a3abca70306c466d989..6b25ad2da03e9336d4bf7e5895eb5736113ffad3`：exit `0`；精确 correction delta 仅为 `M tests/test-setup.ts`，符合 allowed correction path，无 scope drift。
- prior candidate 在 `tests/test-setup.ts:5-6` 通过 `typeof globalThis.beforeEach === 'function'` 探测 ambient global 并注册 Pinia hook。corrected candidate 删除该探测，在 `process.env.VITEST === 'true'` 分支通过 `await import('vitest')` 取得 `beforeEach`，并以 `beforeEach(() => setActivePinia(createPinia()))` 保证每个 Vitest test 获得 fresh Pinia；相反分支才动态加载 `@playwright/test`。
- correction delta 未改动 Playwright `base.extend` 内部内容；原有 `pageerror`/console error 收集、日志写入及最终抛错语义完整保留。未新增 global mock、adapter、fallback、helper、依赖或中间表示。
- `npm exec tsc -- --noEmit --module ESNext --moduleResolution bundler --target ES2023 --types node,vitest/globals tests/test-setup.ts`：exit `0`；prior candidate 的两项 `globalThis.beforeEach` TS2339 已消失。
- `npm run test:unit -- --run tests/e2e-skills/unit/e2e-fixture-patch.spec.ts`：exit `0`；1 file、5 tests passed，证明 Vitest setup 可加载且 canonical fixture-patch focused unit 保持通过。
- `npm exec playwright test -- --list tests/unified-e2e/production/station-dashboard.spec.ts`：exit `0`；1 file、33 tests listed，证明非 Vitest 分支仍能加载 Playwright extended fixture 并完成 focused collection。
- `git diff --check f3625da701b726dfcfd60a3abca70306c466d989..6b25ad2da03e9336d4bf7e5895eb5736113ffad3` 与 `git diff --check 7c622141914ae0e532833a98d0949d7a6decf475..6b25ad2da03e9336d4bf7e5895eb5736113ffad3`：均 exit `0`。
- 最终 omission pass 复读 current bounded workflow：`vitest.config.ts` 仍以 `tests/test-setup.ts` 为 setup owner；仓库内 E2E callers 仍从该文件导入 `test`；runner 分支、生命周期、异常传播和导出边界线性且无重复 capability。未发现遗漏或新的 actionable simplicity finding。

Findings:

- 无 open finding。prior Finding 1 已关闭：生命周期 owner 由不明确的 `globalThis` capability probe 改为显式 Vitest environment branch；TS2339 消失，fresh Pinia 与 Playwright fixture/error collection invariants 均保持。

Verdict: passed

Changes: 本 reviewer 未修改 product/tests，未 stage/commit/merge；仅创建 `docs/plan/unified-test-repair/review-task-coding-2-1-correction.md`。

Caveats: Playwright 证据为 `--list` 的装载与收集检查，不代表浏览器场景已执行。prior review 已记录的 reorder/skill smoke transitional failures 仍按原 owner 与 closure gate deferred，本 correction review 未把它们声明为通过，也未重开与本 finding 无关的 accepted code。
