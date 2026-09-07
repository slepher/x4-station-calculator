# unified-test-repair 上下文（第 4 代）

- Context status: `ready`
- Collector role: `context_collector`
- Evidence target: `da05d84514c90428fd4e51907df9b6424fa5ccff`
- Target branch: `develop`
- Control worktree: `/home/slepher/project/x4-station-calculator`
- Collected: `2026-09-05`（Asia/Shanghai）

## 当前 scope 与 ownership

本次 bounded collection 服务于 `unified-test-repair`，重点边界是 `task-test-4` 的 E2E 迁移、fixture/helper、locator/assertion、Playwright 配置与测试文档。其 owned paths 为：

- `tests/e2e/**`、`tests/unified-e2e/**`、`tests/legacy/e2e/**`
- `playwright.config.ts`、`package.json` 中 E2E scripts
- `CLAUDE.md`、`sitemap.md`

按 `lanes-2.md`，test worker 不拥有 `src/**`；产品缺陷应回到 coding/bug 边界。当前 target 分支为 `develop`，HEAD 与 evidence target 完全一致。写入本 artifact 前 `git status --short --untracked-files=all` 为空；写入后新增 dirty path 仅为本文件。

## 规范与历史证据

当前规范要求（由 target 中现存 OpenSpec 文件重新绑定）包括：

- binding 面板为 `[查看 | 编辑 | 重算]`；retain 仅在 `重算`，`查看/编辑` 不显示独立 `退出`；`重置` 恢复已保存 binding 初始口径。
- `useLiveProductionStore` 持有 shared draft 与 `virtualStationDrafts`；同一 `gameGuid:archiveTime` 不重复初始化，context 变化才重新初始化；重算保留 virtual drafts 并按新 groups 重算归属。
- Virtual Station 只处理无 `saveStationCode` 的 `BindingStationPlan`；拖动目标必须属于当前 draft group 的 anchor/coverage；多 group 命中拒绝；`groupId` 由当前 `sectorMacro` 实时派生；提交先应用 groups 再应用 drafts，未分组 draft 提交时移除；virtual trade station 另属 `tradeStation` 且 `sectorMacro` 固定为 hub。
- Map binding 从 shared draft 渲染；Live/Map panel 或模式切换不得自动运行分组算法；preview 与 drop 使用共享状态。

`docs/plan/unified-test-repair/context-3.md` 是历史事实种子，不是当前权威。因 target 相对其记录的提交只新增该历史 artifact、未修改相关产品/测试路径，以下未变更事实可绑定到 target；仍须把历史测试结果、review 判断和 bug 分类视为历史/待复核证据，而非 fresh result 或最终裁决。

## 失败分类：stale、test-owned、product、unknown

### Stale

- 旧测试要求 edit/preview 显示 retain 或独立 Exit，与当前三态规范冲突。
- 旧 core 断言以 UUID 作为 group identity；当前口径以 `sectorMacro` 与当前 group 映射为 authority。

### Test-owned

- binding `2.3` 未覆盖同一 GUID、不同 archive time 的 context switch；helper 已支持 `transformSave`。
- binding `3.3` 比较完整 UI-derived object，容易受本地化与 `undefined` representation 影响；应改为领域字段 oracle，并先真实修改 virtual draft 再验证 reset。
- binding `4.2–4.5` 多为只读、length 或存在性断言，尚未证明 draft 保留、重算归属、未分组删除与 confirm/apply。
- core `4.1` 从同一 `liveStore.autoGroupResult` 生成 expected candidate names，缺少独立 fixture oracle，未独立证明 threshold、top-5、pure-qualified 和 zero-container 规则。
- core `5.3` 后置 hardcode group mapping，未从 runtime groups 推导，属于 test-side mapping/witness 风险。
- map 的 existing-draft move 与部分 `7.4` 主要直接改 store 或比较数量，不等同于真实 pointer drag/drop witness。

### Product candidate（历史 reviewer 分类）

历史 focused review 记录 core `5.3` 的真实拖动在超过阈值后未出现 `.placement-preview--binding`，release 后 draft 仍留在原 sector；记录的事件链涉及 `AutoSectorGroupPanel`、`MapSavePanel`、`MapWorkbenchView`、`MapOverlayLayer` 与 `useLiveProductionStore`。规范期望合法 drop 更新 draft 的 `sectorMacro`、`position`、`groupId`。这是 reviewer-recorded product-bug candidate，不是本 collector 的最终语义裁决，test worker 不应修改这些 `src/**` 路径。

### Unknown

- target 上没有 fresh 完整 E2E 结果，因此完整 collection、pass/fail/skip 分布未知；当前 full E2E result is not claimed。
- focused core `5.3` 在修正 test-owned runtime mapping 后是否仍失败，未知。
- binding `3.3/4.x`、map `5.x` 的最终 migration 形态及是否删除弱 oracle，未知。
- 用户指定的 `docs/plan/unified-test-repair/bugs.md` 在已知历史检查中不存在；现有 bug 证据来自 `openspec/changes/auto-sector-group-one-virtual-station/bugs.md` 与 focused review。

## Fixture 与 assertion seams

| seam | 可观察事实 | 反向耦合/边界 |
| --- | --- | --- |
| Live fixture/archive | `loadLiveBindingFixture(page)` 读取 `tests/fixtures/save/*.json`，按 `meta.guid/meta.time` 构造 archive、写 IndexedDB、reload，并通过 UI 设置语言；支持 `transformSave` | archive/versioned storage、IndexedDB、reload 共享；helper 改动影响 binding/core/map 三个 spec |
| Context/reset | archive time、saved groups、参数、active context 可作领域 oracle；virtual draft 需先真实 mutation | 不应比较完整 representation；同 context idempotence 与 reset 来源共享 draft 生命周期 |
| Candidate list | candidate locators 可观察 player/virtual candidate | expected 不得从同源 `autoGroupResult` 生成；fixture 需区分 filtering/threshold/top-5/pure-qualified |
| Existing virtual drag | dragging class、目标 polygon、`.placement-preview--binding`、draft/persisted plan 字段形成完整 witness | source→relay→map preview→store drop 是跨组件 lifecycle，不能以 `page.evaluate` 替代真实 pointer 操作 |
| Trade station | 位置可拖动，`sectorMacro` 固定 hub，归属 `tradeStation` | 与 production virtual station 是不同分支，不得用 fallback group 覆盖 invariant |

## Coupling、boundaries 与 ownership facts

- binding/core/map 共享 save fixture、`autoGroupResult`、virtual draft 与 sector/group mapping；fixture/helper 变更需要串行 review。
- `MapWorkbenchView`、`MapSavePanel`、`AutoSectorGroupPanel`、`MapOverlayLayer` 与 `useLiveProductionStore` 形成共享事件和状态生命周期；这是真实产品候选问题边界，不是 test migration worker 的源码 ownership。
- test-owned 子边界包括 fixture/locator/helper、独立 expected、runtime mapping、真实 mutation witness；它们仍受 shared fixture 和 shared draft lifecycle 耦合。
- 需要修改 `src/**`、恢复 stale UI contract、改变 binding/virtual station 语义或用兼容层掩盖失败，均超出本 test-owned collection 边界。

## Validation、conflicts 与 unknowns

历史 task contract 的验证面包括 `npm run build`、`npm exec playwright test -- --list`、auto-sector focused E2E、`npm run test:e2e`、legacy 原件核对与 `git diff --check`。本次明确未运行 build、测试、Playwright、npm 或全量 E2E，因此不宣称任何 fresh full-suite 结果。

当前 target 绑定事实：

- `git rev-parse HEAD` = `da05d84514c90428fd4e51907df9b6424fa5ccff`
- `git branch --show-current` = `develop`
- target 相对父提交只新增 `docs/plan/unified-test-repair/context-3.md`
- 写入前工作树 clean；写入后唯一新增 path 为本文件

未发现与 immutable target 冲突的其他 dirty path。最小剩余问题是：target 上完整 E2E 的实际结果；修正 test-owned mapping/witness 后 core `5.3` 是否仍能复现；若复现，bug owner 是否确认产品责任与源码边界。

## Evidence index

| ID | 证据 | 用途 |
| --- | --- | --- |
| E1 | `git rev-parse HEAD`、`git branch --show-current`、`git status --short --untracked-files=all` | current target、branch、写入前后 dirty 状态 |
| E2 | `git show --name-status`、`git diff --stat TARGET^ TARGET` | 证明 target 仅新增 context-3，相关未变更事实可重新绑定 |
| E3 | `docs/plan/unified-test-repair/context-3.md` | historical factual seed；明确不是 authority |
| E4 | `docs/plan/unified-test-repair/plan-2.md`、`lanes-2.md`、`task-test-4.md` | scope、ownership、validation boundary |
| E5 | `package.json`、`playwright.config.ts` | E2E script、testDir、runner/build boundary（来自历史 context） |
| E6 | `tests/e2e/auto-sector-group-one-{binding,core,map}/*.spec.ts`、`tests/e2e/live/helpers/loadLiveBindingFixture.ts` | current test seams、fixture lifecycle、弱 oracle（来自历史 context） |
| E7 | `openspec/changes/auto-sector-group-one-{binding,core,virtual-station}/**` 与 `auto-sector-group-draft/**` | normative binding、candidate、virtual draft、preview/drop contract |
| E8 | `docs/plan/unified-test-repair/task-test-4-review-6a772220.md` | historical focused counts 与 failure classification |
| E9 | `openspec/changes/auto-sector-group-one-virtual-station/bugs.md` | reviewer-recorded product candidate；非最终裁决 |
| E10 | `test -e docs/plan/unified-test-repair/bugs.md` 的缺失结果 | 指定 bugs 输入缺口 |

## Searches

- `sed -n '1,260p' docs/plan/unified-test-repair/context-3.md`
- `git rev-parse HEAD`
- `git branch --show-current`
- `git status --short --untracked-files=all`
- `git show --no-patch --format='%H%n%ad%n%s' --date=iso-strict da05d84514c90428fd4e51907df9b6424fa5ccff`
- `git diff --stat da05d84514c90428fd4e51907df9b6424fa5ccff^ da05d84514c90428fd4e51907df9b6424fa5ccff`
- `git show --name-status --format='' da05d84514c90428fd4e51907df9b6424fa5ccff`

## Coverage limits

本次只读取角色协议、context-3 与有限 Git target/status/提交范围证据，未作 broad repository inspection；未执行 build、test、Playwright、npm、browser interaction 或 `--list`。因此不能提供 current full E2E result、运行时复现、性能结论或 fresh pass/fail counts。历史 context 中引用的源码、规范、测试和 review 事实均因 target 未改动相关路径而复用，并保留其历史/待复核属性。

## Changes

仅创建 `/home/slepher/project/x4-station-calculator/docs/plan/unified-test-repair/generation-4/context.md`。未修改产品代码、测试、配置、其他文档、Git index、branch 或 commit。

## Caveats

- `context-3.md` 是历史 factual seed，不是当前 authority；当前 authority binding 是 immutable target 与 target 中的规范文件。
- 当前 full E2E result is not claimed；历史 `58 total / 56 passed / 2 failed` 仅为 focused review evidence，不能投射为 target 全量结果。
- `core 5.3` 只保留 reviewer-recorded product candidate；进入 coding 前仍需 current reviewer 按真实 UI 前置条件、操作和 current contract 复核。
- 本文件是 bounded context packet，不是实现计划、产品缺陷裁决或测试通过声明。
