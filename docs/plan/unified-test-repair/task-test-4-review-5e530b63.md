# task-test-4 reviewer report

- Status: `review_complete`
- Task: `task-test-4`
- Role: generation-2 independent parent reviewer
- Reviewed commit: `5e530b63cc39c487f45cd272e71cb7f9f7bb0e0b`
- Expected parent: `291c0b4f6b087735653a0dc8e06a33bc886b85a2`
- Verdict: `changes_required`
- Coding worker correction required: `yes`，仅限本任务 owned paths；现有证据指向 test-owned migration failure，不授权修改 `src/**`。

## Evidence

1. Immutable identity and scope
   - `git rev-list --parents -n 1 5e530b63` 确认 candidate 的唯一父提交为 `291c0b4f`。
   - `git diff --name-status 291c0b4f 5e530b63` 的全部变更均位于合同 owned paths；未发现越界修改。
   - 审查期间控制仓库 target 后续前移不改变本报告的审查对象；所有树级结论均以 `5e530b63^{tree}` 为准。

2. Directory migration and preservation
   - `git ls-tree -r --name-only 5e530b63 tests/unified-e2e` 无输出：`tests/unified-e2e/**` 已消失。
   - 父提交 `tests/e2e/**` 有 18 个 spec、2 个 fixture；candidate 的 `tests/legacy/e2e/from-e2e/**` 同样有 18 个 spec、2 个 fixture，逐路径无缺失。16 个文件 blob 完全一致；4 个 spec 仅有空白格式差异，`git diff -w` 无差异，测试语义完整保留。
   - 父提交 `tests/unified-e2e/**` 的 61 个文件（60 个 spec + 1 个 Live helper）全部以相同 blob 出现在 candidate `tests/e2e/**`。
   - candidate canonical 共 78 个 spec，即 60 个 unified spec + 18 个旧 E2E spec；旧 E2E 的真实行为没有因目录迁移丢失。

3. Imports, collection, build, and formatting
   - 三个原 `tests/e2e/auto-sector-group-one-*` spec 的 Live helper import 已改为 `../live/helpers/loadLiveBindingFixture`；迁移后的 helper 到 `tests/fixtures/db.json` 的相对路径有效。
   - `npm run build`：exit 0。
   - `npm exec playwright test -- --list`：exit 0，收集 `1019 tests in 78 files`。
   - `npm exec playwright test -- --list tests/e2e/live`：exit 0，收集 `43 tests in 8 files`。
   - `playwright.config.ts` 的 `testDir` 为 `./tests/e2e`；legacy、unit 和 skill tests 未进入 Playwright collection。
   - `git diff --check 291c0b4f 5e530b63`：exit 0。

4. Runtime evidence
   - Worker evidence：Live scope `43 tests` 全部失败，主要签名为已退役 `.supply-tab` / `.overview-tab` locator，另有一个 strict locator failure；完整 E2E 未完成，不能视为通过。
   - Reviewer 最小复核：`npm exec playwright test -- tests/e2e/live/live-station-dashboard.spec.ts -g "live dashboard renders" --workers=1`，fresh build 成功后 exit 1；`tests/e2e/live/live-station-dashboard.spec.ts:15` 因 `.supply-tab` element not found 失败。该签名与 worker evidence 一致。

## Findings

### F1 — Blocking: canonical E2E still targets retired TabBar locators

- Immutable evidence: candidate 在 15 个 canonical spec 中仍有 99 处 `.supply-tab`、`.station-tab` 或 `.overview-tab` 引用。例如：
  - `tests/e2e/live/live-station-dashboard.spec.ts:14-20`
  - `tests/e2e/live/live-archive-valid-select.spec.ts:42-49`
  - `tests/e2e/live/live-transit-toolbar.spec.ts:21-27,49-53`
  - `tests/e2e/production/station-management.spec.ts:112`
  - `tests/e2e/toolbar-action2one/toolbar-action2one.spec.ts:46-53`
- Contract basis: ordered work 3-4 要求把 legacy 独有行为适配进 canonical，并继续采用 Sidebar stable test-id；blocking validation 要求 feature-scoped 和完整 canonical E2E 通过。
- Failure ownership: test-owned。产品当前公开稳定锚点为 `sidebar-overview`、`sidebar-sector` + `data-sector-id`、`sidebar-station` + `data-station-id`；复核失败是旧 locator 未迁移，不是已确认的产品缺陷。
- Correction owner / allowed paths: coding worker，只修改 `tests/e2e/**`（如确有必要可同步本合同允许的测试文档路径），不得为旧 selector 修改 `src/**` 或加兼容 DOM。
- Preserved invariants: 保留 78 个 canonical spec 所覆盖的用户可观察行为；`tests/legacy/e2e/**` 原件不改；实体身份继续使用 `data-station-id` / `data-sector-id`，不把翻译文本编码进 test-id。
- Focused validation: 先跑 `tests/e2e/live/**`，再按受影响的 production/map/logic-flow scope 运行；closure 要求旧三类 locator 在 canonical 中清零，Live 43 tests 通过且无未解释 strict failure。

### F2 — Blocking: canonical setup violates fixture/reload/UI-language and unique Live-helper rules

- Immutable evidence:
  - 13 个 canonical spec 使用 `localStorage.clear()`；例如 `tests/e2e/sector-flow-filter/sector-flow-filter.spec.ts:7-18`、`tests/e2e/production/station-management.spec.ts:94-104`、`tests/e2e/toolbar-action2one/toolbar-action2one.spec.ts:4-15`。
  - 3 个 canonical spec 直接写 `user_locale` cookie；例如 `tests/e2e/dlc-settings/dlc-settings.spec.ts:30-50`，没有通过 UI selector 触发语言更新。
  - `tests/e2e/sector-flow-filter/sector-flow-filter.spec.ts:36-74` 手写 `saveArchiveToDB`、`saveStore.importFromJson(...)` 和 `liveStore.playerStationRecords` 回填，绕过唯一 `loadLiveBindingFixture(page)`。
- Contract basis: ordered work 4 和仓库 E2E rules 明确要求普通用例 `db fixture -> reload -> UI language`，禁止 `localStorage.clear()`；Live/save-binding 行为必须使用唯一 helper。
- Correction owner / allowed paths: coding worker，仅 `tests/e2e/**`；复用现有 `tests/e2e/live/helpers/loadLiveBindingFixture.ts` 和现有 db fixture，不新增第二套 helper/fixture framework。
- Preserved invariants: 保留测试原断言和场景意图；不删除用例来获得绿灯；legacy 原件保持不变。
- Focused validation: 对修正文件逐 scope 执行 Playwright；静态 closure 为 canonical 中无 `localStorage.clear()`、无直接 `user_locale` 写入、无 helper 外的 archive/records 手工回填。

### F3 — Blocking: E2E npm script flags are not reliably forwarded

- Immutable evidence: `package.json:13,16-17` 使用 `npm exec playwright test ... --ui/--debug`，但没有 npm-exec 的 `--` 参数边界。复核 `npm run test:e2e -- --list` 输出 `npm warn Unknown cli config "--list"`，并实际开始运行 1019 个测试而不是仅列举；因此附加参数及 `--ui` / `--debug` 路由不可靠。
- Contract basis: owned E2E scripts 必须路由正确。
- Correction owner / allowed paths: coding worker，仅 `package.json` 的 E2E scripts。最小修正可直接使用 npm script 已提供的本地 binary（`playwright test ...`），或使用正确的 npm-exec 参数边界。
- Preserved invariants: `npm run test:e2e` 仍只收集 `tests/e2e/**`，并继续由 `playwright.config.ts` 的 webServer 执行 fresh build。
- Focused validation: `npm run test:e2e -- --list` 必须只列举 1019 tests、不启动浏览器执行；UI/debug 命令应把对应 flag 传给 Playwright。

## Verdict

`changes_required`

目录收敛、原件保存、imports、fresh build、Playwright direct collection 和 owned-path scope 均通过静态/最小复核；但 canonical Live 43/43 failure 未闭合，旧 Sidebar locator 与 fixture/helper 规则仍有大面积明确违约，完整 E2E 也没有通过证据，因此 candidate 不能接受。

## Changes required

1. 在 `tests/e2e/**` 把所有旧 TabBar selector 迁到稳定 Sidebar anchors，并修复 strict locator。
2. 将 canonical setup 统一为 fixture -> reload -> UI language；所有 Live/save-binding 场景复用唯一 Live helper。
3. 修正 `package.json` E2E scripts 的 Playwright 参数转发。
4. 复跑 build、direct list、Live 43、受影响 feature scopes、完整 `npm run test:e2e` 和 `git diff --check`；完整 E2E 未通过前不得声称 gate 通过。

## Caveats

- 按用户指示未继续运行完整 E2E；其状态明确记录为未完成、非通过。
- 本报告未修改 candidate、未提交/merge、未改 workflow status，也未创建 generation-3 planner。
