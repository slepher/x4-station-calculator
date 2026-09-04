Status:
changes_required

Task:
`unified-test-repair` generation-2 `task-test-4`，focused review of `tests/e2e/logic-flow/import-logic-flow.spec.ts`

Reviewed commit:
`e038e96f183f0b1828c5c5d6ab3da3eb4e8ac5d9`（parent `a97696fe49c1be4a767e94748fd528ec3d1366f8`）

Evidence:

- candidate 为 immutable、single-parent commit；`git diff --name-status e038e96f^ e038e96f` 仅有 `M tests/e2e/logic-flow/import-logic-flow.spec.ts`，`git diff --check` 通过，审查前后 candidate tree 与 HEAD tree 一致。
- `task-test-4.md`、`plan-2.md`、`context-2.md` 要求 canonical E2E 使用 `tests/e2e/**`，普通场景遵守 `db.json -> reload -> UI language`，按 current browser contract 迁移 locator/fixture；重复、过期或绑定退役实现的测试不得继续充当 canonical contract。
- candidate 的 setup 已正确引入 `tests/fixtures/db.json`、删除 `vsn`、reload、等待 `#debug-ready-marker`、通过 `language-select` 切换 `zh-CN`，并使用 `top-view-btn-flow`。它固定 8.0 后验证 `getStorageKey('logic_flow') === 'x4_logic_flow_plans'`；这与 `src/assets/versions.json` 及前序 `task-test-4-review-14a0a1ca.md` 已接受的 deterministic 8.0 fixture contract 一致。
- `CURRENT_FLOW_VERSION` 为 `3`，但 candidate 的 injected plans 仍写 runtime/legacy node：`{ wareId, moduleId, isIsolated, ... }`，且 module 使用 macro `prod_gen_hullparts_macro` / `prod_gen_microchips_macro`。权威 `db.json` 的 v3 node 是 `{ module: 'module_gen_prod_*_01' }` / `{ isolated: wareId }`。`migrateFlowStateToCurrent()` 仅在 version `<= 2` 时把 macro 归一为 current module id；candidate 标成 version 3 后跳过该步，最终导入无效 module id。fresh-build focused run 多次因此触发 `Cannot read properties of undefined (reading 'color_rgb')`。这是 fixture 声称 v3、内容却不是 v3 的测试错误，不是合法输入触发的产品缺陷。
- commit `7d6871af` 已删除 `useEmpireStore`；当前 test seam 是 `window.blueprintStore`。candidate 替换了多数调用，但 `3.19` 仍在两处读取 `window.empireStore`。commit `df7cecdc` 将 import/new/save 判定收口到 `useToolbarWorkflowController.shouldConfirmBeforeImport()`；`blueprintStore.shouldConfirmBeforeEmpireReset()` 已不是 current API。
- current `x4-import-move` OpenSpec 与 commit `24e50774` 要求“非空空间站 + logic-flow 导入”显示 `blueprint-import-strategy-modal` 及 cancel/overwrite/add/new 四按钮。candidate 多条 case 仍等待旧 `station-import-confirm-modal` / `station-import-confirm-*`。失败快照实际已显示 current 四按钮策略弹窗，因此不能据此认定产品回归。
- worker 报告为 `34 tests: 14 passed / 20 failed`。reviewer 在同一 candidate 上用 Playwright 自带 fresh build 复核得到 `15 passed / 19 failed`；多出的一条失败没有随 assignment 提供 title/signature。该 1 条漂移与 invalid-module page error、可选 locator/提前 return、并行时序一致，只能作为 test setup 不稳定证据，不能伪造具体 case，也不能升级产品 BUG。

Findings:

## F1 — blocking：version 3 fixture 只有版本号迁移，数据形状和实体 ID 未迁移

`buildInjectedPlansFromFixture()` 把 `version` 从 1 改成 3，却保留旧 runtime node 字段和 macro module id；测试体又把 active station 写成同类 macro id。由此产生的 `color_rgb` page error、策略分支偏移和导入后渲染异常都由测试输入违反 current persistence/entity contract 引起。Correction owner 为 task-test-4 test worker；允许路径仅 `tests/e2e/logic-flow/import-logic-flow.spec.ts`。不得给产品增加 macro fallback 或 undefined module 兼容分支。

## F2 — blocking：worker 只做了 store/modal 名称替换，未完成 current interaction contract 迁移

`blueprintStore`、`import-view-modal`、`top-view-btn-flow` 的替换方向正确，但仍残留退役方法、旧 station dialog、旧 copy、跨上下文绝对几何和含糊 SmartSave root。`db.json` 默认站点非空，故这些 station cases 按现行 OpenSpec本应进入 `blueprint-import-strategy-modal`；当前产品实际这样做了。

## F3 — 20 个失败逐条归属

| # | focused case | 分类 | 证据与结论 |
|---:|---|---|---|
| 1 | `2.1 Logic-Flow 主界面数据可用性` | test-owned / stale locator | 点击 `top-view-btn-flow` 成功，快照中 modal 与全部 injected plans 已出现；`getLoadFlowModal` 正则漏掉当前标题“加载逻辑组网方案”。产品行为已到达。 |
| 2 | `2.8 activeStationId-only 变化不进入待保存态` | test-owned / invalid fixture | 导入 v3-名义、legacy-macro 内容后触发 `color_rgb`；不是合法 current flow 数据下的产品失败。 |
| 3 | `2.3 空间站覆盖导入` | test-owned / stale modal + invalid ID | 测试把非空站点写成 macro id，却等待旧 `station-import-confirm-modal`；current contract 是四按钮 `blueprint-import-strategy-modal`。 |
| 4 | `2.4 空间站导入为新空间站` | test-owned / stale modal | `db.json` 当前站点非空；测试仍点旧 `station-import-confirm-new`，应走 current `blueprint-strategy-new`。 |
| 5 | `2.5 保存并导入` | test-owned / retired API | 直接调用不存在的 `blueprintStore.shouldConfirmBeforeEmpireReset()`；current 判定由 toolbar workflow controller 拥有。 |
| 6 | `2.5 放弃并导入` | test-owned / dirty precondition mismatch | 直接改 draft station 和无效 macro 未可靠建立 current dirty state；快照显示导入已执行并出现 warning，故测试等待的 SmartSave 按钮不存在。 |
| 7 | `2.7 空规划区跳过 + warning` | test-owned / optional setup | 搜索和“+”均为可选分支，未证明 dirty 前置，却无条件点击 `Discard and Import`；快照已出现正确 warning 汇总。 |
| 8 | `2.8 非-container isolated warning` | test-owned / stale modal + invalid fixture | 当前非空站点显示四按钮策略，测试等待旧 overwrite；injected node 也不是权威 v3 `{ isolated }` 形状。 |
| 9 | `2.9 不自动保存/手动保存` | test-owned / state ownership mismatch | 直接清 `activeStation.modules` 未同步 presenter 使用的 station state，分支仍按非空站点进入 current strategy modal；随后又断言 invalid macro 持久化。 |
| 10 | `2.10 导入入口对齐` | test-owned / over-constrained representation | active spec要求两个上下文各自最右/右对齐，不要求不同 toolbar 的绝对 `x/y/height` 在 1px 内相等；该跨上下文几何断言不是产品契约。 |
| 11 | `2.11 帝国导入“加载帝国”形态` | test-owned / stale copy | 快照显示 current `import-view-modal`、plan cards、统计和 direct import；测试仍要求旧文案“Import to Empire/导入到帝国”，OpenSpec要求形态而非该字符串。 |
| 12 | `2.14 二级区直接导入` | test-owned / stale modal | direct import 按钮工作，快照随后显示 current `blueprint-import-strategy-modal` 四按钮；失败仅因等待旧 dialog。 |
| 13 | `2.17 导入逻辑无变化回归` | test-owned / mixed retired flow | 首步即用旧 station confirm selectors；后续还混合 invalid module id 和旧 SmartSave 假设，未到达有效行为断言。 |
| 14 | `2.20 导入与新建判定一致` | test-owned / stale closure + weak setup | 无确认分支后要求 `import-view-modal` 立即消失，但 current logic-flow spec 未把该 DOM 时点定义为行为；后半段允许 locator 失败后直接 `return`，不能形成有效产品证据。 |
| 15 | `3.1 空间站覆盖导入` | test-owned / duplicate stale modal | 与 `2.3` 重复，仍使用 invalid macro 和旧 station dialog；current OpenSpec快照反证产品 modal 缺失。 |
| 16 | `3.2 空间站导入为新空间站` | test-owned / duplicate stale modal | 与 `2.4` 重复；非空 fixture 应点 `blueprint-strategy-new`，不是 `station-import-confirm-new`。 |
| 17 | `3.3 帝国 SmartSave 条件触发` | test-owned / ambiguous modal root | `getImportSmartSaveDialog()` 的 `.fixed.inset-0 + hasText` 可命中包含嵌套 dialog 的 outer import modal；`button.first()` 因而不是可靠 close。dirty 也由直接 draft 写入建立。 |
| 18 | `3.18 导入与新建判定一致` | test-owned / direct-state contract mismatch | `makeEmpireDirtyWithoutSave()` 直接改对象名称而不走 current UI/action seam；失败未证明 controller 对合法 dirty transition 判错。 |
| 19 | `3.19 Bug #3` | test-owned / incomplete store migration | `before` 用 `blueprintStore`，`afterNew` 与 `afterImport` 仍读已删除的 `window.empireStore`，异常发生在测试自身。 |
| 20 | worker-only extra failure（assignment 未提供 title/signature；reviewer 复核为 pass） | test-owned evidence instability，具体 case 未确认 | 不能凭 `14/20` 聚合数捏造失败名。全部 reviewer-pass case只使用同一不稳定 setup；在拿到 exact title 前不得归为产品 BUG。correction 后以 34/34 current-contract focused run关闭。 |

以上 20 项中：`test-owned = 20`，`product-owned = 0`，`context-blocked product decision = 0`。其中第 20 项只缺 exact identity，不影响“不存在已证实产品 BUG”的结论。

Verdict:

`changes_required`。candidate 关闭了最外层 `db.json + reload + UI language + 8.0 current key`、`blueprintStore` 主体替换、`import-view-modal` 和 `top-view-btn-flow` 入口问题，但没有把 fixture 本体和 34 个行为 case 迁移到 current v3/current UI contract。20 个 focused failure 均归 task-test-4 test worker；不需要 coding worker，不得创建产品 BUG。

Changes:

1. 保留已正确的 setup 顺序和 8.0/current-key assertion；把 injected plans 改成真实 v3 `SavedFlowPlansState`：manual node 用 `{ module: current canonical module id }`，isolated node 用 `{ isolated: wareId }`。station setup 同样只使用 `module_gen_prod_*_01` current id。
2. 非空站点导入统一改用 `blueprint-import-strategy-modal` 与 `blueprint-strategy-cancel/overwrite/add/new`；只在明确构造空站点且 current contract需要时使用 `station-import-confirm-*`。
3. 删除 `shouldConfirmBeforeEmpireReset()` 和剩余两处 `window.empireStore`；dirty/clean 前置通过 current UI 或当前公开 mutation/action seam建立，并在进入下一步前显式断言。
4. 将 load modal、SmartSave dialog、copy 与 alignment 断言改为 current stable anchors；禁止 optional locator + early return。合并或删除 canonical 中重复的 `2.x/3.x` 场景，历史原件继续留在 legacy。
5. focused closure：fresh build 下运行该单文件，34 条全部通过且无 page error；再进入 task-test-4 后续 gate。只需 test worker，禁止修改 `src/**` 来迎合错误 fixture。

Caveats:

- worker 的第 20 条失败没有逐例日志，reviewer 复核只得到 19 条；报告如实保留该证据边界，没有把它当作通过，也没有虚构产品归因。
- reviewer 复核发生在用户“无需额外测试”指示之前；收到该指示后未再运行测试。未执行 full E2E，本报告只裁定指定 focused candidate。
