# unified-test-repair 上下文（第 3 代）

- Context status: `ready`
- Collector role: `context_collector`
- Evidence target: `dfc38e9cdc7f571d9dcb460ceac4f791837a0936`
- Target branch: `develop`
- Control worktree: `/home/slepher/project/x4-station-calculator`
- Collected: `2026-09-05`（Asia/Shanghai）

## 1. 当前 scope、ownership 与工作树

### 1.1 Target binding

- `git rev-parse HEAD`：`dfc38e9cdc7f571d9dcb460ceac4f791837a0936`。
- `git branch --show-current`：`develop`。
- `git status --short --untracked-files=all`：唯一 dirty path 是本 artifact `docs/plan/unified-test-repair/context-3.md`；没有其他已确认用户变更。
- `git log --oneline -20` 显示 target 后的直接历史为：`dfc38e9c`（本 review）、`5e788b3b`（记录 virtual station drag bug）、`6a772220`（加强 auto-sector regression evidence）、其父链上的测试/规范 review 提交。
- `git diff --name-status 6a7722200aa102b4534f654c9b982f8653cf5e51..dfc38e9cdc7f571d9dcb460ceac4f791837a0936` 只显示 `docs/plan/unified-test-repair/task-test-4-review-6a772220.md` 与 `openspec/changes/auto-sector-group-one-virtual-station/bugs.md`；target 未继续修改三个 auto-sector E2E 或直接产品源码。

### 1.2 task-test-4 边界

`docs/plan/unified-test-repair/task-test-4.md` 定义的目标是让 `tests/e2e/**` 成为唯一产品 Playwright suite，保留旧原件到 `tests/legacy/e2e/**`，并迁移 locator、fixture、Live helper 与 runner 入口。owned paths 是：

- `tests/e2e/**`、`tests/unified-e2e/**`、`tests/legacy/e2e/**`
- `playwright.config.ts`
- `package.json` 中 E2E scripts
- `CLAUDE.md`、`sitemap.md`

不得由该 test owner 修改 `src/**`。`lanes-2.md` 还规定产品缺陷回到 coding task；test worker 只修测试、fixture、helper、配置和文档 owned paths。

本次直接相关的 current E2E 是：

- `tests/e2e/auto-sector-group-one-binding/auto-sector-group-one-binding.spec.ts`
- `tests/e2e/auto-sector-group-one-core/auto-sector-group-one-core.spec.ts`
- `tests/e2e/auto-sector-group-one-map/auto-sector-group-one-map.spec.ts`
- `tests/e2e/live/helpers/loadLiveBindingFixture.ts`
- binding spec 的 `fixtures/context-switch-save.patch.json`、`fixtures/normalize-fields-db.patch.json`

当前 `package.json` 为 `test:e2e: playwright test tests/e2e`，`playwright.config.ts` 为 `testDir: './tests/e2e'`，`webServer` 执行 `npm run build && vite preview ... --strictPort`。本轮没有运行这些 gate。

## 2. 最新规范与历史证据

### 2.1 当前规范事实

- `openspec/changes/auto-sector-group-one-binding/specs/auto-sector-group-binding-mode/spec.md`：binding 面板为 `[查看 | 编辑 | 重算]`，retain 仅在 `重算`，`查看/编辑` 不显示独立 `[退出]`；`重置` 恢复已保存 binding 初始口径。
- `openspec/changes/auto-sector-group-one-binding/specs/auto-sector-group-binding-draft/spec.md`：`useLiveProductionStore` 持有唯一 shared draft 与 `virtualStationDrafts`；同一 `gameGuid:archiveTime` 不重复初始化；context 变化才重新初始化；重算保留 virtual drafts 并按新 groups 重算归属。
- `openspec/changes/auto-sector-group-one-virtual-station/request.md` 与 `specs/auto-sector-group-virtual-station/spec.md`：Virtual Station 只处理无 `saveStationCode` 的 `BindingStationPlan`；可跨 sector 拖动，但目标必须属于当前 draft group 的 anchor/coverage；多 group 命中拒绝；`groupId` 由当前 `sectorMacro` 实时派生；提交先应用 groups 再应用 drafts；未分组 draft 提交时移除；virtual trade station 另属 `tradeStation`，sectorMacro 固定为 hub。
- `openspec/changes/auto-sector-group-draft/specs/binding-preview/spec.md`：Map binding 从 shared draft 渲染；Live/Map panel 或模式切换不得自动运行分组算法；preview 与 drop 使用共享状态。
- `openspec/changes/auto-sector-group-one-map/e2e_test_tasks.md`：Virtual Station tab、existing draft move、无覆盖拒绝、overlay、virtual trade station position 与 no-fallback 回归均被列为 E2E 场景。
- `openspec/changes/auto-sector-group-one-binding/e2e_test_tasks.md`：2.3 要覆盖同一 `gameGuid` 不同 archive time；3.3 要覆盖 reset 后 `autoGroupResult` 与 `virtualStationDrafts`；4.x 要覆盖 draft 保留、重算归属、未分组和确认应用。
- `openspec/changes/auto-sector-group-one-core/e2e_test_tasks.md`：4.1 要独立覆盖 raw candidate、threshold、top-5、pure-qualified 与 zero-container 规则；5.3 要验证 confirm 后 station plan 按最终 sector→group 映射重分配。

### 2.2 历史证据的边界

`docs/plan/unified-test-repair/task-test-4-review-6a772220.md` 是最近的 focused review，且 target 后测试文件未再改变。它记录：binding `24 total / 23 passed / 1 failed`，core `34 total / 33 passed / 1 failed`，合计 `58 total / 56 passed / 2 failed / 0 skipped`；失败为 binding `3.3 重置` 与 core `5.3 station plan 归属重分配`。该 review 没有声称完整 E2E 或完整 build 已通过。

历史 review 已把旧 edit retain/独立 Exit、UUID-first 口径归为 stale；`6a772220` 已将 current 测试改为 `sectorMacro` 与三态 contract。历史 full-suite failure 数量不能直接投射到 target，因为 target 没有对应 fresh full-suite evidence。

`openspec/changes/auto-sector-group-one-virtual-station/bugs.md` 在 target 新增 `BUG-001`，记录 reviewer 认为 valid virtual station drag 已越过真实 threshold、命中合法 target，但没有 `.placement-preview--binding`，release 后 draft 仍留在 `cluster_100_sector001_macro`。这是 reviewer-recorded product-bug candidate；本 collector 不重新作最终语义裁决。

## 3. task-test-4 已知失败分类

### 3.1 明显过期（stale）

- 旧测试要求 preview/edit 显示 retain，或要求独立 `退出/Exit`；当前 mode spec 明确这些不属于非 `重算` 模式。
- 旧 core 文案/断言以 UUID 为 group identity；当前 binding-v2 以 `sectorMacro` 与当前 group 顺序/映射为 authority。
- 这些是历史失败分类，不应通过恢复旧 UI 语义解决；current `6a772220` 已对相关断言作迁移。

### 3.2 测试拥有（test-owned）

- binding `2.3` 当前只证明 `G1:T1 -> G2:T2`；缺少同 GUID 不同 time 的 `G1:T1 -> G1:T2`。helper 已支持 `transformSave`，但当前两份原始 save 是不同 GUID。
- binding `3.3` 的失败断言 `expect(afterReset.result).toEqual(savedState.result)` 比较完整 UI-derived object；review evidence 指出差异是本地化 group name 与 `undefined` representation 字段，而 saved groups、参数、context 语义通过。应改为领域字段 oracle，并加入 virtual draft mutation witness。
- binding `4.2–4.5` 多数没有真实修改 draft、制造未分组状态或执行 confirm/apply；存在只读、length 或数组存在性 oracle，不能证明保留、归属重算、提交删除规则。
- core `4.1` 的 `expected.candidateNames` 来自同一 `liveStore.autoGroupResult.sectorStationCandidates[...]`，是 presenter/store 一致性检查，不是独立 candidate algorithm oracle；需要 fixture 中可识别 station/code/order 的 exact expected，覆盖 top-5 与 pure-qualified 补位。
- core `5.3` 的后置 hardcode `groupId/sectorMacro = cluster_24_sector001_macro` 未先从当前 runtime groups 推导；即使 preview/drop 修复，测试本身仍可能因重算后的 anchor/coverage 映射而 stale。
- map spec 中 `5.3 existing draft 移动`、`7.4` 当前主要改写 store draft 或只比较数量，并非完整真实 pointer drag/drop witness；与 core `5.3` 的真实 drag case 不重复扩大为产品结论。

### 3.3 疑似产品 bug（保留 reviewer 分类，不由 collector 裁决）

core `5.3 station plan 归属重分配` 的 failure 具备以下已记录事实：

- source 是 fixture 中 id 为 `f36126e5-7798-ed14-3c03-938b961efa0b` 的 existing virtual draft，当前 persisted source 为 `cluster_100_sector001_macro`。
- Playwright 完成真实 `mousedown`、超过 4px 阈值，source 出现 `.virtual-row--dragging`；目标 `cluster_26_sector001_macro` polygon 可见且命中点可计算。
- `.placement-preview--binding` 在 5 秒内未出现；review 记录 release 后 draft 仍在原 sector。
- 直接实现链为：`AutoSectorGroupPanel.onVirtualStationMouseMove()` → `drag-station-start` → `MapSavePanel` emit relay → `MapWorkbenchView.onBindingDragStationStart()`；随后 `MapWorkbenchView.onMouseMove()` 应调用 `resolveBindingPreviewAtPointer()`，`stopDrag()` 应调用 `liveStore.moveVirtualStationDraft()`；`MapOverlayLayer` 以 `.placement-preview--binding` 渲染 binding preview。
- 规范期望是有效 anchor/coverage drop 更新 draft 的 `sectorMacro`、`position`、`groupId`。review 已把该断点记录为 product-owned / confirmed candidate，但 coding 前仍需由 reviewer/bug owner维护最终确认状态。

不得由 task-test-4 worker 修改上述 `src/components/map/**` 或 `src/store/useLiveProductionStore.ts`。

### 3.4 unknown

- `docs/plan/unified-test-repair/bugs.md` 是用户指定输入，但当前路径不存在；本 artifact 只能使用存在的 `openspec/.../bugs.md` 与指定 review 作为 bug evidence。
- target `dfc38e9...` 没有完整 `npm run test:e2e` fresh 结果，因此完整 collection、pass/fail/skip 与其他 feature failure 分布未知。
- `6a772220` focused 的 5.3 failure 在 test-owned runtime mapping 修正后是否仍稳定失败，尚未重新验证；当前只能保留 reviewer-recorded candidate。
- binding 3.3/4.x 和 map 5.x 的最终 migration 形态、是否删除重复弱 oracle，未在本 target 实施。
- 浏览器可用性、完整 build 与 `--list` 结果本轮未重新执行；历史 review 的环境错误已通过后续 Chromium run 排除，但不等于 target full gate 通过。

## 4. Fixture 与 assertion migration seams

| seam | 当前事实与可迁移内容 | 反向耦合 / 边界 |
| --- | --- | --- |
| Live fixture/archive | `loadLiveBindingFixture(page)` 读取 `tests/fixtures/save/*.json`，用 `meta.guid/meta.time` 构造 archive state，写 IndexedDB，reload，UI 设置 `zh-CN`；支持 `transformSave` | archive state、versioned storage key、IndexedDB 与 reload 共享；修改 helper 会影响 live 与三个 auto-sector spec，不应各 case 手写 archive state |
| context switch | binding spec 已显式读取 `selectedArchive.meta.time` 并传入 `page.evaluate` | 补同 GUID 不同 time 必须保留真实 mutation witness，不能只切换 selector 或直接改结果对象 |
| reset | saved binding groups、当前参数、active binding/archive context 是可独立比较的领域 seam | 不比较完整 `autoGroupResult` representation；virtual drafts 必须先真实改 `sectorMacro/groupId/position/name`，证明 mutation 后再验证 reset 来源 |
| candidate list | `.candidate-item*` locator 已可观察 player/virtual candidate | expected 不得从 `liveStore.autoGroupResult` 同源生成；fixture 需要能区分 filtering、threshold、top-5、pure-qualified replacement |
| existing virtual drag | `virtual-row--dragging`、目标 `.sector-hover-target[...] .sector-polygon`、`.placement-preview--binding`、draft/persisted plan 字段是完整 witness seam | 真实 event lifecycle 跨 panel/map/store；不应用 `page.evaluate` 直接替代 pointer drag，也不把 hardcoded target group 当作 runtime mapping |
| virtual station lifecycle | spec 要求 initialize/retain/recompute/ungrouped/confirm 的顺序与 shared store | 同 context idempotence、group recompute、confirm 删除未分组 plan 共享同一 draft 生命周期，不能只做 count/存在性断言 |
| virtual trade station | 仍是 group `tradeStation`，位置可拖动但 `sectorMacro` 固定 hub | 与 virtual production station 是不同数据分支；不可用 virtual station 的 `draftId` 或 fallback group 覆盖该 invariant |

## 5. 耦合与候选任务边界

- `task-test-4` 可独立拥有：canonical E2E 文件、legacy preservation、`loadLiveBindingFixture` 的测试适配、Playwright collection/scripts 与测试文档。
- binding/core/map 三个 auto-sector spec 共享同一 save fixture、`autoGroupResult`、virtual draft 与 sector/group mapping；任何 helper 或 fixture 改动都需要 serial review，不能按文件并行假定独立。
- `MapWorkbenchView`、`MapSavePanel`、`AutoSectorGroupPanel` 与 `useLiveProductionStore` 形成 shared lifecycle/event relay；这是产品 bug investigation seam，不是测试迁移 worker 的 source ownership。
- `core 5.3` 的测试修正可成为独立 test-owned 子边界：先修 expected mapping 与真实 witness，再由 reviewer 重跑；若 preview/drop 仍失败，移交 bug/coding boundary。
- `binding 3.3/4.x`、`core 4.1` 可作为测试-owned assertion/fixture 子边界，但它们依赖 shared fixture，宜在同一 serial integrate lane 之后统一 review。
- 任何需要修改 `src/**`、改变 binding/virtual station 语义、恢复 stale UI contract 或以兼容层掩盖失败的工作，都超出 `task-test-4`。

## 6. 验证面、冲突与 unknowns

task contract 的验证面为：

- `npm run build`
- `npm exec playwright test -- --list`
- auto-sector feature-scoped canonical E2E
- `npm run test:e2e`
- `tests/unified-e2e/` 不存在、legacy 原件数量可核对
- `git diff --check`

本次只读收集未运行命令；不得把历史 `58/56/2` focused evidence 写成 target 全量通过。当前 confirmed conflict 仅为指定 artifact 自身的 untracked path；没有发现其他 dirty path。不存在的 `docs/plan/unified-test-repair/bugs.md` 是输入缺口，不是工作树冲突。

最小后续 unknowns：

1. target 上完整 E2E 的真实 collection 与结果是什么？
2. test-owned runtime mapping 与 exact witness 修正后，core `5.3` 是否仍出现 preview/drop failure？
3. 若仍失败，bug owner 是否确认 event relay/preview/drop 为产品责任并给出明确 source ownership？
4. 同 GUID 不同 archive time、reset virtual draft、candidate independent oracle 是否已补齐并通过 reviewer？

## 7. 建议执行拓扑

以下是供 planner/reviewer 使用的 bounded 拓扑；不是本 collector 对产品语义的最终裁决：

```text
测试迁移与 legacy preservation
        ↓
canonical focused E2E：fixture / locator / helper / assertion migration
        ↓
reviewer 按 current OpenSpec + truthful setup + exact postcondition 分类
        ├─ 明显过期 / test-owned / driver-environment / unknown
        │       → 留在测试 review 与后续 context，不进入 coding
        └─ 只有 reviewer 明确确认 product bug
                → 建立 bug 输入并限定 src owned path
                → coding worker
                → reviewer 验证
                → target / integrate 按 lanes-2.md 串行推进
```

执行顺序建议为：先完成测试迁移与 fixture/assertion seams，再运行 focused；reviewer 分类失败；只有 truthful UI precondition、真实操作、可复现 failure、current contract 反例和明确源码边界同时成立时，才允许进入 coding。当前 `core 5.3` 不授权 test worker 修复。

## Evidence index

| ID | 证据 | 用途 |
| --- | --- | --- |
| E1 | `git rev-parse HEAD`、`git branch --show-current`、`git status --short --untracked-files=all`、`git log --oneline -20` | target、branch、dirty path、历史绑定 |
| E2 | `docs/plan/unified-test-repair/plan-2.md`、`lanes-2.md`、`task-test-4.md` | initiative 目标、task ownership、串行边界与 gate |
| E3 | `package.json`、`playwright.config.ts` | E2E script、`testDir`、fresh build runner |
| E4 | `tests/e2e/auto-sector-group-one-binding/auto-sector-group-one-binding.spec.ts`、`...core...spec.ts`、`...map...spec.ts` | 当前直接相关测试、弱 oracle 与 5.3 drag witness |
| E5 | `tests/e2e/live/helpers/loadLiveBindingFixture.ts:34-157` | save metadata、archive 构造、IndexedDB、reload、UI language、`transformSave` |
| E6 | `openspec/changes/auto-sector-group-one-binding/specs/*`、`e2e_test_tasks.md` | binding 三态、context/reset、virtual draft contract 与测试任务 |
| E7 | `openspec/changes/auto-sector-group-one-core/specs/*`、`e2e_test_tasks.md` | candidate/trade station/confirm 与 station-plan mapping contract |
| E8 | `openspec/changes/auto-sector-group-one-virtual-station/request.md`、`specs/auto-sector-group-virtual-station/spec.md`、`openspec/changes/auto-sector-group-draft/specs/binding-preview/spec.md` | Virtual Station、shared draft、preview/drop normative boundary |
| E9 | `docs/plan/unified-test-repair/task-test-4-review-6a772220.md:20-112` | latest focused counts、stale/test-owned/product candidate findings、limitations |
| E10 | `openspec/changes/auto-sector-group-one-virtual-station/bugs.md` | reviewer-recorded `BUG-001` candidate；不是 collector 新裁决 |
| E11 | `src/components/map/AutoSectorGroupPanel.vue:177-187,264-280,632-684`；`src/components/map/MapSavePanel.vue:272-280`；`src/components/map/MapWorkbenchView.vue:327-366,1254-1279,1734-1766,1867-1902,1940-1995,2191-2220`；`src/store/useLiveProductionStore.ts:244-305`；`src/components/map/layers/MapOverlayLayer.vue:85-105` | drag source、event relay、preview/drop、store update、overlay rendering seam |
| E12 | `test -e docs/plan/unified-test-repair/bugs.md` 返回非零 | 用户指定输入缺失 |

## Changes

只写入 `/home/slepher/project/x4-station-calculator/docs/plan/unified-test-repair/context-3.md`；未修改源代码、测试、配置、Git index、branch 或 commit。

## Caveats

- 本 artifact 是 bounded factual context，不替 reviewer 对 `core 5.3` 作最终产品语义裁决。
- 未运行 build、Playwright、`--list` 或全量 E2E；不宣称 `task-test-4` 完成。
- 用户要求的 `docs/plan/unified-test-repair/bugs.md` 缺失；相关 bug 事实仅引用现存 OpenSpec bug 与指定 review。
