# task-test-4 review — candidate cb92fe76

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` reviewer；只读复核 immutable candidate `cb92fe76` 对 Logic Flow canonical E2E 的收缩。未修改产品、测试、fixture、配置、candidate 或 workflow 状态；唯一仓库写入是本报告。

Reviewed commit:
`cb92fe76f5bd8670f8c34fcb5f66342299c320a1`，single parent `51216608e3532cfa3792e3fa4559a0d872f30d9c`。

Evidence:

- 审查开始时 `HEAD` 为 candidate，`git status --short` 无输出。candidate 只修改 7 个 `tests/e2e/logic-flow/**` 路径，合计 `101 insertions / 1550 deletions`；无 `src/**`、OpenSpec、fixture、legacy 或配置变更。`git diff --check cb92fe76^ cb92fe76` exit `0`。
- `logic-flow-bug-regression.spec.ts` 从 parent 的 36 个 test declarations / 1369 行变为 5 个 declarations / 50 行，净少 31 个 canonical cases。candidate 未在 `tests/legacy/e2e/**` 新增任何文件，当前 tree 中也没有 `logic-flow-bug-regression` legacy 原件；worker 所述“36 个旧场景均未迁移 legacy”与 tree 一致。
- generation-2 合同要求旧测试不删除、先留在 `tests/legacy/**`，再从中识别 current browser behavior；`context-2.md` 只允许重复、过期或退役实现不进入 canonical，不允许仅以 Git 历史代替 legacy 原件。
- 历史提交不是随机测试噪声：`0096a89b` 同时新增该 regression E2E、Unit regression 和 Logic Flow 产品修正；`e5e75eca` 又同时扩充该文件、更新 `src/components/**` / `useLogicFlowStore.ts` 并落地主 OpenSpec；`8115a84e` 继续追加 28–36 场景并修改对应产品逻辑。历史 `logic-flow-operation/test_tasks.md` 还逐项记录了 Bug 4–8、锁定、模块名、隔离、i18n、默认锁定和取消拖拽的浏览器验收点。
- current normative evidence 仍明确要求：状态与优先级（`openspec/specs/logic-flow-operation/spec.md:8-56`）、Auto/Isolate/Locked 交互（`:21-43,125-139`）、模块名（`:190-219`）、隔离停止扩展和 T0 预览（`:221-251`）、语言切换/默认锁定/取消拖拽（`:253-282`）、不同体系同 ware 共存和锁定拦截（`logical-flow-planner/spec.md:160-224`）。因此不能把整份 regression 文件一概视为过期。
- 较新的 active `logic-flow-energycells` change 明确把 Energy Cells 改为可拖动生产模块，而 Ore 等 raw material 仍不可拖动（`openspec/changes/logic-flow-energycells/specs/logic-flow-energycells/spec.md:67-93`）。它覆盖主 spec 中“Energy Cells 禁止拖拽”的旧条款；candidate 的 `attemptWareDrag(page, 'ore')` 与用 Energy Cells 建组符合较新语义，不应据旧条款开产品 bug。
- `openspec/test_experience.md:73-85` 与 `x4-drag-test` 要求真实 Mouse API、每次 move 带 `steps`、`mouse.up()` 前验证 UI/store 可观察 hover phase。candidate 触及路径未引入 native drag dispatch 或 DOM 写入；新 helper 的 move 均带 `steps`。
- collection-only 命令 `npm exec playwright test -- --list tests/e2e/logic-flow` exit `0`，收集 `106 tests in 8 files`；5 个 replacement cases 被收集，legacy 未收集。按要求未运行 focused/full 浏览器 E2E，也未把任何旧失败当成产品 bug。

Findings:

## F1 — blocking：36 个旧场景没有迁入 legacy，直接违反原件保留合同

Classification: `test-owned preservation failure`。

candidate 删除了 parent 中 36 个具名 test declarations，却没有在 `tests/legacy/e2e/**` 留下原件。即使其中部分只应由 Unit 拥有、部分断言已经过期、部分已被新 case 合并，generation-2 的明确迁移顺序仍要求原件进入 legacy。immutable Git 历史不是合同指定的 legacy 目录，也不会满足“旧 E2E 原件全部位于 tests/legacy/e2e/**”的 completion gate。

Contract basis: `task-test-4.md` ordered work 1–3 / completion；`context-2.md` 迁移规则 1–4 与 active-agent “可迁移旧测试被删除而不是移入 legacy：reject”。Correction owner: `task-test-4` test coding worker。Allowed paths: `tests/legacy/e2e/**`，以及为 current contracts 补回最小覆盖所需的 `tests/e2e/logic-flow/**`。Preserve: parent 中 36 个场景的标题、步骤、断言和必要 helper 语义；legacy 继续不进入 Playwright gate。

Observable closure: candidate parent 的 36 个原场景可在一个 provenance-clear 的 legacy 文件中逐项核对；`playwright --list` 仍不收集 legacy。

## F2 — blocking：被删场景分类显示 23 个是 current browser contracts，5 个 replacement 不足以承接

以下分类逐项覆盖 parent 的全部 36 个场景。`canonical required` 表示行为仍有效，旧实现本身可以留 legacy，但必须有一个不可空跑、UI 可观察的 current case；`legacy duplicate/stale` 表示当前 canonical 不必保留独立 case。

| 分类 | 被删场景 | 判定与当前覆盖 |
| --- | --- | --- |
| canonical required | `1.1 隔离节点不应在候选区显示拖拽预览点` | 隔离节点不计为 planned、Isolate/Connect phase 仍是 current contract；replacement 名义承接但断言无效，见 F3。 |
| legacy duplicate/stale | `2.1 隔离标签应优先于锁定组血统标签显示` | 旧 body 只读 `isIsolated/lineage`，没有验证标签；状态事实与优先级已有 Unit owner，原件迁 legacy 即可。若保留 UI 意图，应并入统一 Isolate/Locked phase case。 |
| canonical required | `3.1 不同血统的同种产品应可共存` | `moduleId` 物理隔离是 active spec；现有 Unit 不替代浏览器跨分类拖入并显示两个模块。无等价 current E2E。 |
| legacy duplicate/stale | `3.2 拖拽不同血统产品应显示 available 状态` | 纯 `getWareGroupStatus()` 读取，已由 `tests/unit/logic-flow/logic-flow-bug-regression.spec.ts` 与 `logic-flow-lineage.spec.ts` 覆盖。 |
| canonical required | `4.1 拖拽到 Auto 节点应转正为 Manual` | active spec 明确要求 Auto→Manual 标签、drop 与实线结果；当前 5 cases 未覆盖。 |
| legacy duplicate/stale | `4.2 不同血统 Auto 节点应显示 replace 状态` | 旧 body 仅调用 store；Unit 已覆盖 `replace`。UI 的 Replace phase 应并入 5.1 的 canonical case。 |
| canonical required | `5.1 拖拽不同血统产品到 Auto 节点应替换血统` | active priority 包含 Replace，历史 Web task 要求 Replace 标签和 drop 后血统；当前 5 cases 未覆盖。 |
| legacy duplicate/stale | `7a.1 隔离时删除其他同 wareId 节点`、`7a.2 隔离后只保留一个 isolated 节点` | 两个旧 body 都直接写/读 store，Unit 7.1–7.3 已覆盖；原件迁 legacy。 |
| canonical required | `7b.1 多个同 wareId 节点都有连线` | 历史 bugfix 验收明确要求两条独立连线；现有 `interaction 4.3` 只断言任意连线数量大于 0，不能承接。旧断言本身也过弱，需适配为两条具体连线。 |
| canonical required | `8.1 隔离后拖拽不同血统产品应转化隔离节点` | current Isolate Connect contract；replacement 1.1 不 release 到目标，未验证解除隔离、moduleId/lineage 和上游扩展。 |
| legacy duplicate/stale | `Rejected > Duplicated`、`Duplicated > Isolated`、`Isolated > Auto`、`Auto > Replace`、`Replace > Available` | 五项是纯 store priority table，active Unit 9.1–9.5 已精确覆盖；浏览器只需每种可观察状态的代表 case。 |
| legacy duplicate/stale | `10.1 空规划组拖拽第一个节点`、`10.2 规划组只有一个隔离节点`、`10.3 Manual/Auto/Isolated 共存` | 旧 body 的核心断言均为 store shape，Unit 10.x 已覆盖；新建区与 Isolate/Auto browser paths由更强 case承接即可。 |
| canonical required | `11.1 锁定组拒绝不同血统`、`11.2 锁定组接受相同血统` | 两者均是 active drag-state contract。拒绝路径被 replacement/`incompatible 4.17` 部分覆盖；匹配血统允许投放没有 current E2E。 |
| canonical required | `12.1 重复拖拽显示 duplicated` | active spec 要求红边、Duplicate 标签和禁止投放；replacement 存在但静态上无法到达自身断言，见 F3。 |
| canonical required | `13.1 新产线区域创建新组` | replacement 以 new-zone hover 后断言一组和目标节点，属于有效等价覆盖。 |
| canonical required | `14.1 切换血统后拖拽使用新血统` | active lineage inheritance；`interaction 2.2` 只部分验证 Teladi 上游结果，没有断言被拖入节点 lineage。 |
| canonical required | `15.1 多个组之间拖拽正确切换` | generic create-two-groups / add-to-first cases不能证明多个可见目标间精确命中；无等价 current E2E。 |
| canonical required | `28 紧凑版已有/预览节点显示模块名称`、`29 新产线 Header 显示模块名称`、`30 拖拽幽灵元素显示模块名称` | 三项逐条存在于 active `Drag Display Module Name`。现有 drag-feedback 的宽松 ware-name regex 不能区分 module/ware；30 的旧 body 又只计算 store 名称，因此应保留原件到 legacy并新增最小真实 UI assertion。 |
| canonical required | `31 隔离节点不被上游扩展打破`、`32 紧凑 T0 预览排除隔离节点`、`33 隔离中间层时 T0 预览停止追踪` | 三项均有 active isolation/T0-preview 条款。旧 32/33 直接改 store，33 还在测试内重写递归算法，故旧实现留 legacy，但现行 UI 行为不能一起删除。 |
| canonical required | `34 语言切换时 ware 文本更新`、`35 候选区锁定开关影响新组` | active spec 逐条保留；当前 5 cases 无覆盖。35 还应同时覆盖关闭开关创建 unlocked group，避免默认 `isDefaultLocked=true` 掩盖前提。 |
| canonical required | `36 拖拽取消后不添加产品` | replacement 和 `logic-flow-new-feat` 都承接；可只留一个最强 canonical owner，原件仍迁 legacy。 |
| canonical required | `16.1 锁定拒绝时不增加 T0 预览/节点`、`16.2 未锁定组接受不同血统产品` | 16.1 被 replacement 部分承接，但 release 后没有断言组/T0 不变；16.2 无覆盖。当前 `clean` 默认 `isDefaultLocked=true`，不能把一个未显式解锁的组称为 unlocked。 |

分类计数：`23 canonical required`、`13 legacy duplicate/stale`、`0` 个可由 current OpenSpec 明确判为冲突的旧场景。较新 Energy Cells 变更与旧 T0 条款的冲突属于本轮其它 Logic Flow 测试语义，旧 EC 禁拖/no-plus 只能留 legacy；Ore/raw-material 禁拖仍保留 canonical。

## F3 — blocking：5 个 replacement 中两个不构成 bugfix coverage，一个仅部分覆盖

Classification: `test-owned helper/expectation defect`。

- `logic-flow-bug-regression.spec.ts:20-24` 的 duplicate case 调用普通 existing-target helper；helper `dragLogicFlow.ts:55-60` 对非-rejected existing target只接受 `border-(blue|amber)-500/50`。current product 的 duplicated 状态是 `border-red-500` + `duplicate-label`（`LogicFlowPlanningZone.vue:400-445`），所以正确产品行为会先让 helper 失败；case 自身也没有断言红边或 Duplicate 标签。`logic-flow-interaction.spec.ts` 的 duplicate case使用同一错误路径，因此没有备用有效 browser coverage。
- `logic-flow-bug-regression.spec.ts:9-17` 的 isolate case 查询 `.preview-node`，但 current product/source与其余 canonical tests均没有这个 class；紧凑预览节点是 `.compact-node`。`toHaveCount(0)` 因 locator 永远为空而可空跑。它也未断言 `isolated-label`、hover 后 `Connect`、release 后解除隔离或上游扩展，不能承接 1.1/8.1/31–33。
- `logic-flow-bug-regression.spec.ts:43-48` 的 locked rejection验证 red/rejected/no pulse，但 release 后没有验证组节点与 T0 资源不变；只能部分承接 11.1/16.1。
- new-zone 与 cancel replacements保留了 release 前 target/hover-off signal和 release 后 UI数量结果，语义可保留；cancel 与 `logic-flow-new-feat` 重复时只需一个 canonical owner。
- shared helper 把之前的 `hoveredGroupId != null` 改为 UI class属于正确方向，但 regex 与产品的 unlocked normal class `border-blue-500` 不一致（helper要求 `/50`），且 boolean `expectRejected` 无法表达 Duplicated/Auto/Isolate/Replace。所有依赖普通 existing-target path 的 current tests都可能被该错误前置阻断；这是 test-owned，不是产品 bug。

Contract basis: active drag state/priority specs、`x4-drag-test` interaction phase guardrail。Correction owner: `task-test-4` test coding worker。Allowed paths: `tests/e2e/logic-flow/helpers/dragLogicFlow.ts` 与受影响 focused specs。Preserve: real Mouse API、all moves with steps、pre-up observable status、post-up exact mutation/no-mutation；不得用 direct store/DOM 写入模拟行为。

Focused closure: collection 后只跑一个 Normal/unlocked、Duplicated、Auto、Isolate、Replace、Locked-match、Rejected、new-zone、cancel 的最小状态矩阵；每项 release 前断言对应 label/border，release 后断言具体节点/lineage/source/不变结果。

## F4 — blocking：其它缩减总体复用了 helper，但 plan 保存断言仍被弱化

Classification: `test-owned assertion preservation`。

- `logic-flow-drag-feedback`、`logic-flow-incompatible-drag`、`logic-flow-interaction` 的大部分删行是把重复 Mouse 序列换为共享 helper；`attemptWareDrag` 也保留了 raw-material 不出现 compact view 的结果。这类删除本身可接受，前提是修正 F3 的状态矩阵。
- `logic-flow-new-feat` cancel case移除了 store-internal `isDragging/hoveredGroupId` 断言，改为可观察 hover-off class并保留最终 group/manual count；active drag-state另有 `interaction 5.1` owner，因此这项不是独立阻塞。
- `logic-flow-plans` E2E-3/4/7/12/14 比 parent 更接近 current UI contract；但 E2E-3 点击“保存并新建”后只断言工作区为空，没有证明当前方案确实保存；E2E-5 在点击保存前 `weaponcomponents` 已可见、标题已是 `Existing Plan`，点击后重复断言这两个既有事实，无法证明 existing plan 数据被更新或持久化。它还删除了唯一的 saved-plan count检查。至少应通过 Load/reload 或保存列表内容证明新增节点进入同一 plan且未新建第二份。
- E2E-15 仍只验证初始自动名称，没有执行“加入更高 tier manual node后名称动态更新”的行为；这是前轮 finding 的未闭合项，不应因本轮大幅删测被掩盖。

Contract basis: `logic-flow-plans` Save Existing / Save New 和动态命名 current contracts；前轮 `fafb2acc` review 的 F3。Correction owner: `task-test-4` test coding worker。Allowed paths: `tests/e2e/logic-flow/logic-flow-plans.spec.ts` 与现有 helper。Preserve: UI save/load path，不用 store-only count或当前内存 DOM自证持久化。

Focused closure: E2E-3 证明保存分支产出具名 plan并进入新空工作区；E2E-5 reload/load 后仍有新增 `weaponcomponents`、标题不变且计划数不增加；E2E-15 加入更高 tier节点后标题按 current rule更新。

## F5 — failure ownership：没有可升级的产品 bug

本轮没有运行浏览器行为；collection 通过只能证明语法与收集，不证明行为。所有已确认问题都有直接的 test-owned 原因：未迁 legacy、current-contract coverage被删除、vacuous locator、错误状态 helper或保存 postcondition不足。current source仍包含对应 Duplicated/Isolate/Replace/Locked/New-zone 状态和 active OpenSpec 所述行为入口。不得仅因 parent 旧测试曾失败、或未来修正 helper后出现红灯，就直接开产品 bug。

只有在 truthful clean/seeded 或显式 locked/unlocked 前提、current locator、完整 Mouse hover phase和精确 active-contract断言都成立后，某最小 case仍稳定得到相反 UI/数据结果，才可带 exact focused command、前置状态和实际输出路由给 coding owner。

Verdict:
`changes_required`

未迁 legacy 本身已是 blocking contract violation；此外，23 个 current browser contracts中大量没有等价 canonical owner，现有 5 replacements又包含一个必然与正确 Duplicate UI冲突的 helper路径和一个永远为零的 `.preview-node` 断言。candidate 不能以 collection 通过或 Unit coverage替代这些浏览器行为。

Changes:

1. 将 `cb92fe76^` 的 36 场景原件迁入一个 provenance-clear 的 `tests/legacy/e2e/logic-flow/**` 文件；只做使引用可解析所需的路径调整，必要时连同其 helper snapshot保留。不要把 13 个 store-only/重复场景重新加入 canonical。
2. 在 canonical 只补 F2 的 23 个 current intents所需的最少强场景，按同一 active scenario合并重复项；优先闭合 lineage coexist/replace/connect、locked match+reject、module-name三处、isolation/T0 preview、language/default-lock、multi-target。
3. 修共享 drag helper的状态表达：至少能精确区分 Normal、Duplicated、Auto、Isolate、Replace、Locked-match和Rejected；修正 unlocked blue class，并让 duplicate/isolate replacements断言真实 label/preview与 release 后结果。
4. 强化 plan E2E-3/E2E-5/E2E-15 的不可空跑 postcondition。先 collection，再跑上述最小 Logic Flow focused matrix；完整 E2E留到这些静态缺口关闭后。

Caveats:

- 本轮按用户要求只做静态与 collection 检查；未运行 focused/full E2E，因此没有声称任何 candidate case runtime 通过或失败。
- 主 `logic-flow-operation` 对 Energy Cells 的旧限制与 active `logic-flow-energycells` change冲突；本报告按较新的 active change判定 EC 可拖、Ore/raw material不可拖，并把该冲突限定为测试语义分类，不推导产品缺陷。
- 23/13 是行为意图分类，不要求恢复 36 个 canonical declarations；最小修正可以合并同一 active contract，但 legacy 原件仍须完整保留。
