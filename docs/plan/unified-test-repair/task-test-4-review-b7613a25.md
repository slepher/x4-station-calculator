# generation-2 task-test-4 F2 review

Status:
`review_complete`

Task:
`task-test-4` generation-2 `task-test-4` reviewer；复核 immutable candidate `b7613a25` 对 full-review F2（Logic Flow 八文件 setup）的修正。未修改产品、测试、fixture、配置、workflow 状态、git index 或 candidate；唯一写入是本报告。

Reviewed commit:
`b7613a2527144cae438c9b6abf1266a5fe364843`

Evidence:

- candidate direct parent 为 `be8670de04134a087638d814a64a2f7da9fa0382`；审查开始时 `HEAD` 即 candidate，`git status --short` 无输出。
- `git diff-tree --no-commit-id --name-status -r b7613a25` 只修改约定的八个测试文件；`git diff --check b7613a25^ b7613a25` exit `0`。没有 `src/**`、fixture、配置或 legacy 变更。
- candidate 的实质改动均在 imports / `beforeEach`：改用 `tests/test-setup.ts`，移除 raw `x4_station_active_view='flow'` 与 obsolete `stationStore.activeView`，加入 `db.json -> reload -> UI language -> top-view-btn-flow -> flow-layout/candidate-zone`。行为测试体及其既有断言没有被 candidate 改写或弱化。
- 现有 focused 产物为 `107 tests / 107 failed / 0 passed`；`test-results/.last-run.json` 精确包含 107 个 failed IDs，八文件只读 `--list` 也精确收集 107 tests。未重新运行完整 E2E。
- `test-results/*/error-context.md` 恰有 107 份，107 份 SHA-256 全部相同：`41136f68d5334a7c764516041664266773e5247878260c6a13f5bd6daf0809f9`。每份快照都显示：顶部“逻辑组网”按钮 active、语言为简体中文、版本为 `9.0`、候选区完整可见、标题仍为“我的逻辑组网”、规划区仅有“拖拽至此处创建新产线”，没有任何测试体创建的产线组。
- candidate 在九个 `beforeEach` 均新增 `expect(page.locator('.flow-layout')).toBeVisible()`（`logic-flow-bug-regression.spec.ts` 有两个 describe-level setup）。当前产品同时在 `src/components/MainWorkbench.vue:50` 和 `src/components/logic-flow/LogicFlowWorkbenchView.vue:8` 渲染 `.flow-layout`；因此该 locator 在 Logic Flow 页面匹配两个元素，不满足 Playwright strict locator 要求。候选确实到达 Logic Flow，但在下一条 `.candidate-zone` 断言和任何测试体之前即被新的歧义 root 断言阻断。107 份完全相同的初始快照与此唯一共同路径一致。
- fixture 仍未实际生效。`tests/fixtures/db.json` 只有无后缀 `x4_logic_flow_plans`，且 `activeId='logic-flow-1'`；`src/assets/versions.json` 默认 `9.0`，其 Logic Flow key 是 `x4_logic_flow_plans_v9`；`src/store/useLogicFlowStore.ts:1351-1353` 只读取 `gameData.getStorageKey('logic_flow')`。快照中的 `9.0`、默认标题“我的逻辑组网”和空规划区共同证明 candidate 注入的是未被当前版本读取的 key，而不是 fixture 中的 `Logic Flow 1` / 三个 groups。
- full reviewer 已要求 F2 使用 canonical fixture/reload/UI-language 并先收敛当前视图；`task-test-4.md:26-30,35-40` 要求完成 locator/fixture 迁移和 focused/full gate；`context-2.md:32-36` 明确重复、过期、绑定退役实现的测试不能留在 canonical。
- 当前 OpenSpec 仍保留 Logic Flow 的拖拽、血统、方案、标题、高亮和 UI 行为；相关权威包括 `openspec/specs/logical-flow-planner/spec.md`、`logic-flow-operation/spec.md`、`logic-flow-plans/spec.md`、`logic-flow-ui-adjust/spec.md`、`simplify-flow/spec.md` 以及对应 archived delta specs。当前失败没有执行到这些行为断言。
- Git 历史解释了旧 locator：八文件来自 2 月 Logic Flow 用例，经 `e613b976` / `5e530b63` 目录迁移；`d73b9c85` 后视图入口改为当前 top switch；当前两个 `.flow-layout` 分别可追溯到 `8819b5cd`，并非 candidate 可假设唯一的测试锚点。
- 按项目 `x4-drag-test` 标准复核拖拽 helper：应使用 Playwright Mouse API、移动带 `steps`、hover 断言在 `mouse.up()` 前，且不得用 native drag events。八文件没有 native drag event，但共有 129 个 `page.mouse.move`，其中 92 个没有 `steps`；这属于候选尚未处理的旧 helper 风险。

Findings:

## F2.1 — blocking：candidate 新增的歧义 `.flow-layout` root 断言使 107/107 全部停在 shared setup

Classification: **测试依赖旧/不稳定 selector；test-owned**。

按文件归并：

| 文件 | 失败 | 当前共同签名 |
| --- | ---: | --- |
| `tests/e2e/compact-drag-view.spec.ts` | 3/3 | 点击 `top-view-btn-flow` 后，对匹配两处的 `.flow-layout` 做 strict visibility assertion |
| `tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts` | 36/36 | 同上；文件内该 setup 还重复两次 |
| `tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts` | 5/5 | 同上 |
| `tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts` | 2/2 | 同上 |
| `tests/e2e/logic-flow/logic-flow-interaction.spec.ts` | 15/15 | 同上 |
| `tests/e2e/logic-flow/logic-flow-new-feat.spec.ts` | 21/21 | 同上；动画禁用也位于失败断言之后，未执行 |
| `tests/e2e/logic-flow/logic-flow-plans.spec.ts` | 11/11 | 同上 |
| `tests/e2e/logic-flow/ui-adjust.spec.ts` | 14/14 | 同上 |

Contract basis: F2 closure 要求八文件不再停在 shared `beforeEach`，并进入 current Logic Flow root；到达视图本身不等于 setup closure。

Correction owner / allowed paths: `task-test-4` coding worker，仅上述八文件及一个复用的普通 Logic Flow E2E helper（若新增，仍限 `tests/e2e/**`）。不要给产品增加兼容 class，也不要用 `.first()` 隐藏 root 歧义；以 stable `top-view-btn-flow` 的 active 状态和唯一 `.candidate-zone`（或既有唯一稳定锚点）确认视图。

Preserved invariants: 继续通过 UI 切换语言和视图；继续使用 `tests/test-setup.ts` 捕获页面异常；不改产品行为断言。

Focused closure: 八文件 focused run 中 shared setup failure 为 0，且至少一个测试体可观察状态出现在失败/通过产物中，而不是 107 份相同初始页面。

New bug artifact: **no**。

## F2.2 — blocking：fixture/version/key 与各文件预期初态仍未收敛

Classification: **fixture/version/key + 旧初态依赖；test-owned**。

candidate 将同一段 12 行 setup 复制到八文件九处，但默认 9.0 不读取 fixture 的 8.0 key。这既没有建立 fixture active plan，也让多数拖拽用例偶然依赖“fixture 被忽略后为空”的状态：

- `compact-drag-view` 的三个测试体会自行 `clearAllGroups()` 并创建组，适合显式 clean baseline。
- `logic-flow-drag-feedback`、`logic-flow-incompatible-drag`、`logic-flow-interaction`、`logic-flow-new-feat` 多数场景直接第一次拖拽并假定空规划区；若 fixture 正确加载，它们会从三个既有 group 开始。
- `logic-flow-plans` 同时包含“新空方案”和“加载已保存方案”场景，不能让所有 case 隐式共享同一 seed/empty 偶然状态。
- `logic-flow-bug-regression` 第一 describe 多数 helper 自建状态，第二 describe 已显式 clear；应继续让每个 case 的前提可见、确定。
- `ui-adjust` 除 plan-independent 候选区断言外，涉及 group 的场景应显式建立所需 group。

Correction owner / minimum scope: 复用一个普通 Logic Flow setup helper，明确选择其一：在 reload 前 pin fixture 的 8.0 版本，或把 fixture key 映射到当前 `getStorageKey()`；随后由调用方明确请求 seeded plan 或 clean plan。不要新建第二套 fixture framework，不要依赖错误 key 达成空状态，也不要修改 `src/**`。

Focused closure: reload 后断言版本与所选 key 一致；seeded 模式可见 `Logic Flow 1` / fixture groups，clean 模式显式清空后为 0 groups；九处复制 setup 收敛为一个 helper 调用。

New bug artifact: **no**。

## F2.3 — blocking after setup：五文件仍使用已失效 ware selector，拖拽 helper 也未符合当前测试规范

Classification: **旧 selector/helper；test-owned**。这不是 107 个当前首失败点，但修掉 F2.1 后会立即成为下一层确定性 blocker。

- 当前 `LogicFlowCandidateZone.vue:192-196` 把 `data-ware-id` / `data-tier` 放在 `.ware-card-wrapper`；内部元素是 `.ware-card-bg`、`.ware-card-content`，没有 `.ware-card[data-ware-id]`。
- canonical 中仍有 48 处 `.ware-card[data-ware-id=...]`：`logic-flow-bug-regression` 22、`logic-flow-drag-feedback` 9、`logic-flow-incompatible-drag` 3、`logic-flow-interaction` 8、`logic-flow-new-feat` 6。`logic-flow-plans` 和 `ui-adjust` 已使用当前 `.ware-card-wrapper`。
- `logic-flow-plans.spec.ts:46-52,218-224` 仍使用已退役 `.view-mode-btn` 且在找不到时静默跳过切换；当前公开入口是 `top-view-btn-*`。
- setup 固定为 `zh-CN` 后，`logic-flow-bug-regression` 仍有 10 处只找 `Industrial`，另有只找 `Default` / `New Production Line`；`compact-drag-view.spec.ts:86` 只断言 `DROP TO CREATE`；`logic-flow-drag-feedback.spec.ts:82,86` 只找 `Preview:`。当前快照和 locale 明确显示“工业链”“拖拽至此处创建新产线”“预览”。
- 129 个 Mouse API move 中 92 个缺少 `steps`；尤其每个共享拖拽 helper 的起拖小位移均无 `steps`。按 `x4-drag-test`，这会使 Sortable.js 起拖信号不稳定，不能把后续 compact-view 缺失归为产品行为。

Correction owner / minimum scope: 在上述五文件把 source locator 迁到 `.ware-card-wrapper[data-ware-id]`，删除 retired view helper，优先使用现有 `top-view-btn-*` / `language-select` test-id，文本断言使用中英正则；把重复拖拽序列收敛为最少的 current Mouse helper，并为移动提供 `steps`。保留 hover-before-release 与 drop 后 UI/store 结果断言。

Focused closure: 静态检查上述 48 个失效 ware selectors 和 `.view-mode-btn` 为 0；中文 setup 下无 English-only locator；每个保留的拖拽 helper 符合 `x4-drag-test` phase sequence，并逐文件 focused 执行。

New bug artifact: **no**。

## F2.4 — blocking：canonical 仍含明确过期、重复或可空跑断言

Classification: **测试本身过期/重复/弱断言；test-owned**。candidate 没有新弱化这些测试体，但也没有完成 task-test-4 要求的逐项迁移。

- 明确过期：`compact-drag-view.spec.ts:55-86` 要求 compact view 为纵向 `flex/column`，而 active `logic-flow-ui-adjust` spec 明确要求 `grid-cols-4`，当前 `LogicFlowPlanningZone.vue:382` 也为 `grid grid-cols-4`。该历史纵向布局 case 应保留到 legacy，不应修改产品迎合它。
- 明确重复候选：`compact-drag-view` 的“起拖显示 compact / drop 到 existing group”与 `logic-flow-interaction` 3.1/4.2、`logic-flow-drag-feedback` 4.5 覆盖相同主路径；`logic-flow-interaction` 5.2 与 `logic-flow-bug-regression` 13.1 都验证新组 drop。按 `context-2.md` 应保留最小 current-contract case，原件留 legacy。
- 明确弱/可空跑：`logic-flow-plans.spec.ts:96,186` 的 `groupCount >= 0` 永真；`:178-186` 在 modal 不存在时仍通过；`:194-206` 在 input 不存在时无断言；`:218-228` 在旧 production button 不存在时实际没有切换。`logic-flow-new-feat.spec.ts:301-310,353-365,534-551` 在目标节点/连线不存在时无断言。`logic-flow-bug-regression.spec.ts:1201-1202` 不能证明语言改变，`:1249-1251` 用 `expect(true).toBe(true)` 跳过锁定行为。`ui-adjust.spec.ts:55,106-107` 只验证 CSS 值非空，未验证 active spec 的 `2:3:3:4` 与 `pl-4 pr-8`；`:231` 接受任意 `0/0.5/1`，没有验证 hover 后 opacity 为 0。
- `logic-flow-new-feat` 的 `Setup: Check hullparts node count` 是诊断型 case；在已有新组/drop/manual-node 回归覆盖下应证明其独立契约价值，否则归并而非作为单独 canonical behavior。

Correction owner / minimum scope: 只在八文件内删除 canonical 重复或把原件移至既有 `tests/legacy/e2e/**` 保留；将保留 case 对齐 active OpenSpec，去掉 optional/no-op 分支和永真断言。不要通过放宽 count、条件跳过或 store-only assertion 获取绿灯。

Focused closure: 每个保留测试都有不可空跑的 UI 可观察断言；过期 vertical compact case 不再被 canonical 收集；重复场景有清晰唯一 owner；断言精确对应 active spec。

New bug artifact: **no**。

## F2.5 — focused current-contract product bug classification

Classification: **none confirmed**。

107 个失败全部被 F2.1 的 shared setup 阻断；F2.2-F2.4 又给出后续确定的 test-owned blockers。没有一个现有失败在 fixture/version、初态、selector 和拖拽 phase 收敛后执行并明确违反 active OpenSpec，因此不能仅凭 107 个红灯创建产品 bug artifact。只有修正后某个 focused case 以稳定 UI 锚点复现 active spec 的相反可观察结果，才可附 exact scenario 和输出路由到 coding owner。

Verdict:
`changes_required`

F2 只完成了“从 Blueprint 到达 Logic Flow”这一层；`107/107 failed` 且全部停在 candidate 新增的 shared setup selector，fixture 也未进入当前版本 key。按用户给定判定规则和 task-test-4 focused gate，candidate `b7613a25` 不能通过。

Changes:

1. 修正/移除九处歧义 `.flow-layout` 断言，并将普通 Logic Flow setup 收敛为一个 version-aware helper。
2. 为各文件显式选择 seeded 或 clean 初态，不再依赖 9.0 忽略 8.0 fixture key。
3. 修复 48 个旧 ware selectors、retired view helper、English-only locator 与不完整 Mouse steps。
4. 将 vertical compact 等过期/重复 case 从 canonical 归档或归并，强化列出的可空跑断言。
5. 先逐文件 focused run；仅在八文件通过后再进入 task-test-4 后续完整 E2E gate。当前不创建产品 bug artifact。

Caveats:

- 按要求未重新运行完整 E2E，也未运行这 107 个测试体；本轮只执行了八文件 `--list` collection 和只读仓库/现有产物检查。
- 当前目录没有 Playwright HTML/JSON assertion report，`error-context.md` 不包含错误 stack；F2.1 的 strict-locator 结论来自 candidate 的唯一共同 setup 行、当前两处 `.flow-layout` DOM 定义、107 份完全相同且已进入 Logic Flow 的快照。修正 worker 的 focused 输出应保留首个 exact assertion stack 作为 closure evidence。
- F2.3-F2.4 是修复 shared setup 后必需处理的静态迁移项，不宣称它们已经作为本次 107 个首失败签名执行到。
