# unified-test-repair 上下文（第 5 代）

- Context status: `ready`
- Collector role: `context_collector`
- Evidence target: `da05d84514c90428fd4e51907df9b6424fa5ccff`
- Target branch: `develop`
- Control worktree: `/home/slepher/project/x4-station-calculator`
- Collection date: `2026-09-05`（Asia/Shanghai）

本 packet 只记录绑定到上述不可变 HEAD 的事实、规范、历史证据、推断、冲突和未知项。`ready` 表示 collection packet 已具备交接条件，不表示当前测试通过，也不表示 initiative 已完成。历史计划、报告和审查结果仅作为证据，不能替代当前目标上的重新验证。

## 目标绑定与工作树

目标提交在当前工作树中核对为 `da05d84514c90428fd4e51907df9b6424fa5ccff`，分支为 `develop`。该提交的提交说明是 `docs: collect unified test repair generation 3 context`，提交内容只增加 `docs/plan/unified-test-repair/context-3.md`。因此，本次 collection 的代码和测试基线仍是该提交所指向的仓库内容。

当前 dirty paths 为：

- `docs/plan/unified-test-repair/status-coding.md`（已修改）
- `docs/plan/unified-test-repair/status-integrate.md`（已修改）
- `docs/plan/unified-test-repair/status.md`（已修改）
- `docs/plan/unified-test-repair/.progress/01a07067-94bd-7d41-a104-9f769dbac00d.md`（本轮按用户指定写入）
- `docs/plan/unified-test-repair/generation-4/context.md`（已存在的未跟踪文件）
- `docs/plan/unified-test-repair/generation-4/lanes.md`（已存在的未跟踪文件）
- `docs/plan/unified-test-repair/generation-4/plan.md`（已存在的未跟踪文件）
- `docs/plan/unified-test-repair/generation-4/task-test-1.md`（已存在的未跟踪文件）

前三项是用户已有的治理状态变更，不能据此推断任务状态；generation-4 文件是已有工作成果，不能据此推断已接受或已执行。本次只新增本文件，并保留上述所有变更；没有发现本目标之外需要改写的产品代码、测试、配置或规范文件。

## 当前 scope 与 ownership inventory

当前可执行的 canonical 测试目录是 `tests/unit` 和 `tests/e2e`：

| 面 | 当前文件数 | 当前收集数 | 历史保留面 | 所有权/边界 |
|---|---:|---:|---:|---|
| Unit | 163 个 `*.spec.ts` | 927 个测试路径 | `tests/legacy/unit` 115 个文件 | Vitest；与 E2E 分离；不由本代 E2E 迁移 worker 修改 |
| E2E | 71 个 `*.spec.ts` | 980 个测试 | `tests/legacy/e2e` 26 个文件 | Playwright Chromium collection；本代候选面由 generation-4 task-test-1 收敛 |
| unified 目录 | 未发现 | — | — | `tests/unified-unit`、`tests/unified-e2e` 不存在；旧规范中的路径文字已过时 |

generation-4 工作计划和 task-test-1 将当前 bounded E2E 合同收敛为 `auto-sector-group-one-binding`、`auto-sector-group-one-core`、`auto-sector-group-one-map` 三个 feature 面，单一 serial task owner，允许修改 E2E tests/helpers/config/docs，不允许修改 `src/**`。该计划是当前工作交接证据，仍须与修改中的 status 文件和规范冲突一起由 planner/reviewer 处理。

当前相关测试资产和责任面如下：

- Auto Sector：三个 canonical E2E spec；共享 Live/save archive fixture；binding、core candidate/graph、map tab/virtual station drag 三类行为交叉使用同一个 draft 生命周期。
- Logic Flow：8 个 canonical E2E spec（import、regression、drag feedback、incompatible drag、interaction、new feature、plans、UI adjustment），共享 `dragLogicFlow.ts` 和 `setupLogicFlow.ts`。它们是独立的迁移边界，但 helper 或 seeded/clean setup 的修订会影响多个消费者。
- Live：贡献名、gap-button、archive select、flow map、overview、dashboard、toolbar、transit toolbar 等 8 个 E2E 面；凡涉及 Live Production、save binding 或 archive 联动，归 `loadLiveBindingFixture(page)` 这个共享入口管理。
- Map、Production、Ship、Build：当前各自有多组 canonical E2E；active OpenSpec 还列出 `build-flow`、`build-plan-compute`、`build-plan-goal`、`build-plan-preview` 的 `test_tasks.md`。这些可作为后续独立 feature contract，但不应无证据扩大本代 bounded task。
- Unit：当前 `tests/unit` 已是 runner 的默认 include，active build test tasks 的 Unit/E2E 分面应分别交给相应 owner；不要用 Unit collection 代替 E2E 行为验证。

## Normative evidence

### 当前 auto-sector 行为

较新的 `openspec/changes/auto-sector-group-one-binding/request.md`、binding mode/draft spec、virtual-station spec 和 binding-preview spec 共同给出以下当前行为基线：

- `useLiveProductionStore` 持有一个跨 panel/mode 共享的 draft；draft context 由 active binding/archive 等上下文确定。
- 预览、编辑、生成是三个状态；panel、Live/Map 和 mode 切换不自动计算；Generate 是显式动作。
- 编辑模式没有独立的旧式 Exit 语义；retain 控件只对 Generate 有意义。
- Reset 丢弃 draft，根据保存 groups 和当前参数重新计算；不能把旧的 `calculationBaseline` 当成 reset 源。
- 同一 context 的 mode 切换保留 draft；recompute 保留 draft 内容并重新计算 group；confirm 保存 groups 与相关字段并回到 display。
- 当前参数包括 jump range、node、threshold 等；`calcBaselinePillState` 只表达保存值差异。
- virtual station 只针对没有 `saveStationCode` 的计划；目标必须是当前 draft group 的 anchor/coverage，跨 group 拖放要拒绝；group identity 由当前 sector macro 派生。
- confirm 的顺序是先保存 groups，再处理 virtual draft；ungrouped 结果应被清理；trade station 使用独立的 tradeStation/固定 hub 语义。

### 当前可观察 UI 和拖放锚点

源代码中可复用的稳定锚点包括 `#debug-ready-marker`、`[data-testid="language-select"]`、`[data-testid="map-svg-canvas"]`、`#sidebar-overview`、`#sidebar-auto-sector-group`、`.candidate-item`、`.virtual-row`、`.sector-hover-target`、`.placement-preview--binding`。MapSectorLayer 的 sector target 和 Map overlay 的 preview 属于产品可观察状态；仅读取 store 状态不能代替 pointer/preview/release 行为证据。

### fixture/setup 规则

仓库指导要求一般 E2E beforeEach 注入 `tests/fixtures/db.json`（删除 `vsn`）、reload，再通过 UI selector 设置语言；不得 `localStorage.clear()`，因为它会清除语言设置。Live/save-binding/archive 场景必须使用 `tests/e2e/live/helpers/loadLiveBindingFixture.ts`，不能手写删除 `x4_save_archives`、`saveStore.importFromJson` 或直接回填 `playerStationRecords`。

当前 `tests/fixtures/db.json` 包含 `vsn`、`x4_empire_data`、`x4_logic_flow_plans`、`x4_save_bindings`、`x4_ship_blueprints`；save 明细位于 `tests/fixtures/save/*.json`。Logic Flow 专用 setup 会显式设置 game version `8.0`，并区分 `clean`（空 plans）和 `seeded`（已有 3 groups）状态。不同测试若自行设置动态 storage key、版本或 archive，必须说明其独立 fixture ownership，否则容易把环境缺失误判为产品失败。

### 当前 Logic Flow 可观察合同

`openspec/specs/logical-flow-planner/spec.md` 描述四列布局、动态 line groups、module name、energy cell/T0 位置、compact view drag、ghost/preview、T0 不锁定、auto/manual、lineage 和 module ID 区分等行为。迁移应通过卡片、分组、ghost、drop 结果和 UI 状态验证；`page.evaluate` 可读取最终领域结果，但不应成为建立业务状态、绕过 pointer 生命周期或复刻实现算法的主要方式。

## 规范冲突与当前裁决边界

存在以下不能在本 packet 内擅自裁决的冲突：

1. `auto-sector-group-one-core` 的旧 spec/e2e task 仍写 edit Exit、retain/Exit 以及 UUID-first group mapping；较新的 binding-v2/draft/virtual-station 规范和当前实现使用无 Exit、sectorMacro identity。规划与审查必须先确认接受的规范优先级，再迁移断言。
2. `openspec/specs/station-tabs/spec.md:94` 仍称 `tests/unified-unit`、`tests/unified-e2e` 为当前目录，而实际 Vitest/Playwright 配置和当前工作计划使用 `tests/unit`、`tests/e2e`，旧目录不存在。该条是规范文档冲突，不应通过创建空目录或改测试来掩盖。
3. active build `test_tasks.md` 中的勾选项属于任务文档记录，不能当成当前 HEAD 的测试通过证据；generation-4 status 文件和用户修改中的 status 文件也互相不一致。
4. `tests/test_experience.md` 中关于旧 `.overview-tab`、`.station-tab` 的经验是历史信息。当前 canonical E2E 静态扫描未找到这些 class，但 map spec 仍有 `退出|Exit` 文本 locator，说明 stale assumption 尚未全清。

本 packet 采用的事实优先顺序是：用户给定的 immutable target 与实际源码/runner 配置；较新的、语义一致的 accepted OpenSpec 文本；当前测试实现；旧 spec、历史计划和历史报告。无法判断某个 OpenSpec 是否已被正式接受时，保留为 conflict/unknown，交由 planner/reviewer 处理。

## 历史证据

- generation-1/context、history status 和 `task-test-1-report-1` 记录了旧 target 上的缺失 skill asset、旧 Unit/E2E 计数及不可解析状态；这些不是当前 target 的失败。
- generation-2/context、plan-2、lanes-2 记录了 canonical `tests/unit`/`tests/e2e` 与 legacy 保留、Unit/E2E 分离以及先 Unit 后 E2E 的迁移路线。它们说明依赖关系，不能证明当前工作树已接受。
- generation-3/context-3 把旧 target 上的 auto-sector focused run 作为历史 seed；其来源提交已包含在当前 target 中，但报告本身不等于当前重新执行。
- generation-4/context、plan、lanes、task-test-1 是当前交接所需的工作证据。它们定义 shared fixture → binding/context/reset → candidate oracle/runtime mapping → draft/recompute/confirm → real drag/drop → collection/docs 的顺序；其 untracked 状态和修改中的 status 文件意味着 acceptance 仍需复核。
- 历史 auto-sector candidate `6a772220` 的 focused 结果为 58 total、56 pass、2 fail：binding 3.3 的 full-result deep equality 被归为 test-owned；core 5.3 在真实 mousedown/drag 后没有 `.placement-preview--binding`，被保留为 product candidate，同时报告指出 hardcoded postcondition 也需要先修正。该结果没有在当前 target 上重跑。
- 另一历史 auto-sector candidate `72245a05` 报告了 binding 2.3 缺失 `GAME_ARCHIVE_TIME`、旧 retain/Exit、reset/virtual draft 弱断言、candidate 同源 oracle 和 core 5.3 无 mutation witness，主要归为 test-owned。
- 历史 Logic Flow 审查记录了 7/2、1/6、4 个 focused 结果组合：失败多发生在合法 hover/source/drop 之前，或因 connection refused；direct store writes、clean/seeded 计数、target index 0、可选取消分支及弱 isolation assertion 属于 test seam。没有由这些报告确认的产品 bug。
- 历史 full canonical E2E candidate `0bfd04c9` 为 1019 tests、321 passed、58 skipped、640 failed、78 files；失败集中在 auto-sector、logic-flow、map、production、ship 等共享 setup/selector/旧假设。它是失败分类的背景，不能与当前 980/71 collection 混用。
- 历史环境证据包含 Chromium sandbox `EPERM/SIGTRAP`、preview `ERR_CONNECTION_REFUSED`；这些属于 infeasible/environment evidence，不能转成产品结论。
- 历史 Unit review 曾记录 163 files/927 tests 的通过候选及一次产品/测试预期不一致；这些均是旧 target 的结果。本次只记录当前 Unit collection 数，不声明通过。

## 当前 fresh collection 与静态事实

本轮实际执行了只读 collection：

- `npm exec playwright test -- --list --reporter=list`：输出 `Total: 980 tests in 71 files`。Playwright 1.57.0，`playwright.config.ts`，Chromium，8 workers；配置的 webServer 会执行 build 后用 Vite preview。该命令只收集测试，没有执行测试，也没有通过/失败语义。
- `npm exec vitest list -- --config vitest.config.ts`：得到 927 个 `tests/` 测试路径；输出伴随 Browserslist stale-data warning。该命令只收集测试。
- 文件计数：`tests/unit` 163、`tests/e2e` 71、`tests/legacy/unit` 115、`tests/legacy/e2e` 26。
- canonical `tests/e2e` 没有 `localStorage.clear`，没有直接出现 `user_locale`，也没有旧 `.supply-tab`、`.overview-tab`、`StationTabBar`、`SectorStationTabBar` 文本命中；但仍有 map 的 `退出|Exit` locator。
- `test.skip`/`test.fixme`/`.skip(` 命中 8 个 E2E 文件：DLC tag、Logic Flow UI adjust、production import-export/module-management/station-dashboard/station-management/ware-flow、ship DLC。skip 有的受条件或浏览器状态控制，有的包住旧/未完成场景，不能当成覆盖。
- 多个 E2E spec 仍直接使用 `localStorage.setItem`、`sessionStorage`、cookie 或 `addInitScript` 做自有 setup。静态扫描证明这种模式存在，但未逐一证明每个用例都违反 fixture contract；应在迁移边界内按行为依赖逐项收敛。

## 候选 execution boundaries、耦合与依赖顺序

| 边界 | 可独立的迁移合同 | 共享耦合和依赖 | 当前判断 |
|---|---|---|---|
| Live fixture/archive | 统一注入 db、save archive、active binding、reload、语言和 live view | 影响 auto-sector binding/core/map 与全部 Live archive consumers；IndexedDB/localStorage 必须成对初始化 | 最先确认；只能由 `loadLiveBindingFixture` 归口 |
| Binding context/reset | 同一 binding/archive context 下的 display/edit/generate、retain/reset/confirm | 共享 liveStore draft、saved groups、current params；需先有准确 archive metadata 和领域 oracle | 独立 test seam，依赖 fixture |
| Candidate algorithm | raw candidates、threshold、top5、pure-qualified、zero-container、group mapping | 依赖 archive 数据、sector candidate 结果和独立 expected fixture；不能从被测 store 复制 expected | 可独立，先修 oracle |
| Draft/recompute/confirm | draft 保留、recompute 更新、confirm 保存 groups/fields/virtual plans | 与 binding、core、map 共用 draft；confirm 顺序和 ungrouped 清理相互影响 | 不能与前一项无序并行 |
| Map virtual station pointer lifecycle | source → valid sector hover → binding preview → release → draft move/creation；invalid/cross-group rejection | 依赖地图几何、coverage、当前 draft group、window mouse listeners 和 overlay | 真实产品候选与测试修正需分开；先建立合法 pointer witness |
| Logic Flow drag/helper | clean/seeded setup、source/target、hover phase、statuses、drop postconditions | helper 被 8 个 spec 共享；直接 store writes 和 target index 0 会污染多个用例 | 可独立于 auto-sector，但 helper 变更后全体重跑 |
| Logic Flow plans/UI | plan persistence、import/export、replace/isolated/UI timing | 共用 setup 和 compact view；历史用例混入实现细节/计算样式 | 独立 test-owned seam，后于 helper contract |
| 其他 Build/Map/Production/Ship/Live | 每个 feature 的 canonical 行为 contract | 共用 Playwright server、fixture、语言和可能的 localStorage key；runner collection 是全局验证面 | 可拆分为后续 task，当前不扩大 scope |
| Unit canonical suite | domain/store/presenter contracts under `tests/unit` | 独立 Vitest runner；与 E2E 的产品 failure ownership 不同 | 仅作为独立验证面；当前只确认 collection |

generation-4 记录的推荐依赖顺序是：共享 fixture/helper → binding context/reset → candidate 独立 oracle/runtime mapping → draft/recompute/confirm → real pointer drag/drop → canonical collection 和文档。若合法 pointer witness 后仍出现 preview/move 缺失，才沿 coding → target → integrate → target 路由提出产品候选；没有 fresh reproduction 时不得直接改 `src/**`。

## 失败分类与候选项

| 分类 | 证据/候选 | 处理含义 |
|---|---|---|
| stale assumption | core 旧 Exit/retain、UUID-first；map Exit locator；station-tabs 的 unified 目录；旧 `.overview-tab`/`.station-tab` 经验；部分 Logic Flow 旧视觉/T0 假设 | 测试或规范 owner 先对齐当前行为；不能作为产品失败 |
| test-owned | binding 2.3 未覆盖同 GUID 不同 archive time 且直接写 store；binding 3.3 对完整结果做 deep equality；binding 4.2–4.5 没有真实 mutation/confirm/ungrouped witness；core 4.1 从同一 `liveStore` 派生 candidate expected；core 5.3 hardcoded mapping；map 5.3/7.4 以 store/count 替代真实拖放；大量自定义 fixture；Logic Flow direct store setup、hover guard、seeded count、optional skip；UI adjust timing/style assertion；active build task tests unchecked/incomplete | 测试迁移合同应先修正 fixture、selector、独立 oracle 和可观察后置条件 |
| product candidate | 历史 core 5.3：真实 pointer 尝试后没有 `.placement-preview--binding` | 仅是候选；当前没有 target fresh browser reproduction，且 hardcoded postcondition/test setup 仍需先排除 |
| environment/infeasible | 历史 Chromium sandbox `EPERM/SIGTRAP`、preview `ERR_CONNECTION_REFUSED`；当前 Vitest list 的 Browserslist warning | 记录环境，不归因产品；需要可运行环境后复核 |
| unknown | 当前 full E2E 行为、5.3 在修正 test witness 后的结果、skip 场景的实际覆盖、active build task 的准确完成度、helper transform filename 顺序是否造成错配 | 保持未决；不能用历史报告或 collection 代替运行 |

## Fixture、helper 与 assertion seams

### Live/save seam

`tests/e2e/live/helpers/loadLiveBindingFixture.ts` 是权威入口。它读取基础 db、`tests/fixtures/save/*.json`、save parser version，以 `GAME_GUID` 等信息构造当前版本 archive，写 IndexedDB，设置 active binding/view，reload，并通过 UI 设置 `zh-CN`。它还提供 `transformSave(save, filename)` 扩展点。当前 `db.json` 的 `vsn` 要删除；save archive 的 metadata 必须保留 GUID、time、parser/version 关系。需要 context switch 的测试应明确区分同一 GUID 不同 archive time 和不同 GUID，不能用随机或未声明的 patch 代替。

### Binding/domain oracle seam

适合断言的领域字段是 `sectorMacro`、coverage、position、groupId、保存 groups、virtual draft 数量及 confirm 后持久化字段。应避免把完整 store/UI 序列化对象作为唯一 oracle，因为它可能包含 localized name、undefined 字段、缓存或实现细节。Reset 要在真实编辑后验证 draft 内容、saved state 和 recompute 结果的领域差异；只比较数组长度或两次相同读取不构成行为证明。

### Candidate seam

`.candidate-item` 是当前 UI 锚点。候选测试需要由固定 fixture 或独立手算 expected 给出 raw candidate、过滤阈值、top5、纯 qualified 与零容器期望；从 `liveStore.autoGroupResult` 同时产生 actual/expected 会把同一实现复制为 oracle，无法发现产品回归。

### Map pointer seam

有效 witness 应至少包含：可见 `.virtual-row` source；`mousedown` 后 `.virtual-row--dragging`；移动到对应 `.sector-hover-target` 的合法坐标；`MapWorkbenchView.resolveBindingPreviewAtPointer` 产生 `.placement-preview--binding`；释放后 draft 的 sector/position/group 发生精确变化。无效目标应证明 preview 不成立且 draft 不变；不能只检查 store status、元素数量或可选的 preview。地图的 coverage/sector geometry 和 active draft group 是此 seam 的共享输入。

产品事件链已核对为：`AutoSectorGroupPanel` virtual row 的 mousedown/mousemove/mouseup → `MapSavePanel` relay → `MapWorkbenchView` 的 pointer preview/resolve/release → `useLiveProductionStore.moveVirtualStationDraft` 或 trade station move → overlay preview。这个链路是 core/map 的真实耦合点；测试仍不能修改产品代码。

### Logic Flow seam

`dragLogicFlow.ts` 使用 Playwright Mouse API，支持 new/existing group 和 normal/duplicated/auto/isolated/replace/locked/rejected status，并读取 `isDragging`、hover class/status 和最终 store 结果。当前 helper 已比旧直接 pointer 路径完整，但调用方不都证明合法 hover phase；`logic-flow-bug-regression.spec.ts` 等仍有 direct store/business-state setup。`setupLogicFlow.ts` 的 `clean`/`seeded` contract 应由调用方显式选择，target index 与 plan identity 不能依赖空状态下的隐含 0。

### Common selector/assertion seam

优先使用 `data-testid` 和当前 stable IDs；语言必须通过 `language-select` UI 触发。`test.skip`、条件 skip、`if visible` 后才断言的 optional branch 会隐藏失败，应在迁移合同时明确 intended state。`page.evaluate` 适合读取最终领域结果或注入基础 fixture；直接调用 store action 形成行为前提、跳过 map/drag lifecycle 或复制 production algorithm 都是 test-owned risk。

## Validation commands and current evidence

已 fresh 执行且只改变 collection/输出的命令：

```text
git rev-parse HEAD
npm exec playwright test -- --list --reporter=list
npm exec vitest list -- --config vitest.config.ts
find tests/unit -type f -name '*.spec.ts' | wc -l
find tests/e2e -type f -name '*.spec.ts' | wc -l
find tests/legacy/unit -type f -name '*.spec.ts' | wc -l
find tests/legacy/e2e -type f -name '*.spec.ts' | wc -l
rg -l 'localStorage\.clear|user_locale|\.supply-tab|\.overview-tab|StationTabBar|SectorStationTabBar' tests/e2e
rg -l 'test\.skip|test\.fixme|\.skip\(' tests/e2e
```

当前结果是 HEAD 精确匹配，Playwright `980 tests in 71 files`，Vitest collection `927`，目录计数为 163/71 和 legacy 115/26；静态扫描结果如上。没有执行 `npm run test:unit`、`npm run test:e2e`、三个 auto-sector focused run、`npm run build` 或其他浏览器行为 run，所以没有本次 pass/fail 结论。

交接后适用的 validation order（命令本身未在本轮执行）是：

```text
npm exec playwright test -- --list --reporter=list
npm exec playwright test -- tests/e2e/auto-sector-group-one-binding/auto-sector-group-one-binding.spec.ts
npm exec playwright test -- tests/e2e/auto-sector-group-one-core/auto-sector-group-one-core.spec.ts
npm exec playwright test -- tests/e2e/auto-sector-group-one-map/auto-sector-group-one-map.spec.ts
npm run test:e2e
npm run test:unit
npm run build
git diff --check
```

focused run 必须先能在当前环境启动 preview/Chromium；失败若发生在 browser launch、connection 或 setup，应先按环境/test-owned 分类，不得记为产品断言失败。`npm run build` 会执行 production compatibility check、vue-tsc 和 Vite build；本代 context writer 没有运行它。

## Evidence index

| ID | 证据位置 | 用途/限制 |
|---|---|---|
| E1 | `git rev-parse HEAD`、`git show --format=fuller --stat da05d84514c90428fd4e51907df9b6424fa5ccff` | 目标、分支、目标提交内容 |
| E2 | `git status --short`、`git diff` | 实际 dirty paths；治理状态冲突，必须保留 |
| E3 | `docs/plan/unified-test-repair/generation-4/{context,plan,lanes,task-test-1}.md` | 当前 bounded contract 和依赖顺序；未跟踪工作证据，不是 acceptance |
| E4 | `context-1.md`、`context-2.md`、`context-3.md`、`history/generation-1/status.md` | generation-1..3 历史迁移背景 |
| E5 | `package.json`、`playwright.config.ts`、`vitest.config.ts`、`tests/test-setup.ts` | runner、server、include/exclude、错误收集行为 |
| E6 | fresh Playwright/Vitest list、目录计数、`rg` static scans | 当前 collection 和静态覆盖事实；不是测试通过 |
| E7 | `tests/e2e/live/helpers/loadLiveBindingFixture.ts`、`tests/fixtures/db.json`、`tests/fixtures/save/*.json`、binding patch fixtures | 共享 fixture/archive ownership |
| E8 | `tests/e2e/auto-sector-group-one-{binding,core,map}/*.spec.ts`、对应 active `e2e_test_tasks.md` | 当前 auto-sector tests、弱断言和 task surface |
| E9 | `tests/e2e/logic-flow/helpers/{dragLogicFlow,setupLogicFlow}.ts`、Logic Flow specs、`openspec/specs/logical-flow-planner/spec.md` | drag/setup seam 与可观察行为 |
| E10 | `src/components/map/{AutoSectorGroupPanel,MapSavePanel,MapOverlayLayer,MapWorkbenchView,MapBindingStation}.vue`、`src/store/logic/useLiveProductionStore.ts` | virtual station pointer→preview→draft event chain；仅用于分类，禁止本代修改 |
| E11 | `openspec/changes/auto-sector-group-one-binding/{request.md,e2e_test_tasks.md,specs/**}`、one-map/core active specs | 较新 binding/draft/virtual/map normative evidence |
| E12 | `openspec/changes/auto-sector-group-one-core/{request.md,e2e_test_tasks.md,specs/**}`、`openspec/specs/station-tabs/spec.md` | 与较新规范冲突的旧 Exit/UUID/目录文字 |
| E13 | active `build-flow/test.md`、`build-plan-*/test_tasks.md` | 后续 feature task inventory；未验证完成度 |
| E14 | `task-test-4-review-*.md`、`task-test-3-report-2.md`、`task-test-1-report-1.md` | 历史 pass/fail、环境失败和分类；不属于当前 target run |
| E15 | `openspec/test_experience.md`、当前组件 stable anchors、当前 skip scan | 历史 locator 经验与当前 selector/skip seams |
| E16 | `docs/plan/unified-test-repair/status*.md` | 用户 dirty governance state；与 generation-4 working plan 冲突，不作 acceptance 来源 |

## Coverage limits

- 本轮没有修改产品代码、测试、配置、OpenSpec、status 或历史 artifact；唯一任务 artifact 是本文件，另有用户明确授权的 progress snapshot。
- 没有执行当前 target 的任何 Unit/E2E test run，也没有当前浏览器复现；980/71 和 927 是 collection 数量。
- 没有逐行阅读 163 个 Unit spec 的全部 body；已完成目录/runner inventory，并按当前 bounded E2E、active task 和共享 helper 阅读相关实现。其他 feature 的完整迁移合同仍未知。
- 历史 `test-results`、历史 reports 和旧 candidate commit 的 pass/fail 都没有被提升为当前证据。
- OpenSpec 没有在所有相关文件中提供单一明确的 acceptance 标记；core-v2 与旧 core、station-tabs 路径文本存在冲突，需由 planner/reviewer 指定权威来源。
- 当前 full E2E 的真实失败分布、skip 场景是否可行、core 5.3 的产品候选是否重现、`loadLiveBindingFixture` 的 transform filename 顺序是否有影响，均未决。

## Changes and caveats

本次只写入 `docs/plan/unified-test-repair/generation-5/context.md`，并按用户指定维护 `.progress/01a07067-94bd-7d41-a104-9f769dbac00d.md`；没有 stage、commit、状态推进或其他文件修改。`Context status: ready` 只代表本 packet 完成。后续 worker 应先核对 E1/E2，按 shared fixture 到 pointer lifecycle 的依赖顺序执行，保留规范冲突和未知项，且在合法可观察行为被复现前不要把历史 core 5.3 候选升级为 product bug。
