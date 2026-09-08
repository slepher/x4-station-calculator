- Task: T012
- Contract revision: 2（Generation 6 plan revision 4）
- Result: T012-A2.md
- Candidate snapshot: `DragTestPage.vue` `f74f927f59d59e11687de4975200af8061dd534ca2805e58f5bbf6561e52cac1`; presenter `ec566b6e7a1db19a54e2f926ab491200b2a099af45341ef306b1a0bacc9f4a3d`; store `91c6694fe468111a0a830767f2a8f840526aad64de68b2a059d05d93a417db78`; Unit `e9e7e9054ed0810746deeaf9df0aaa16c2875f5182eaa48f4f58823d268e545c`; T013 spec `78313ec7a29821b4c31068c8fdc2c710419566718785afa0e145bf24b67c9f91`
- Initial verdict: changes-required
- Re-review attempt: T013-A6, consuming T013-A5 and the T017-A2 buildable candidate
- Re-review verdict: passed

## Findings

### F1 — high — T013 的 locked 两项仍没有事件断言

- Evidence: Revision 4 T013 acceptance 2 要求 locked Argon reject 与 Terran accept 都用真实 pointer 观察 hover、最终列表和事件；T012-A1-review F1 进一步冻结 Argon 应有 B `dragover` 且无 `drop`、Terran 应有 B `dragover` 后 `drop`。当前 `tests/e2e/vue-drag-test.spec.ts:127-147` 的两个 locked case 只通过 `hoverB()` 观察 hover，再断言最终列表；没有读取或断言这两次事务的事件。其 SHA-256 与 T013-A4 绑定的 `78313e...` 一致，因此 A4 没有消费包含该修正的新 spec。
- Affected paths: `tests/e2e/vue-drag-test.spec.ts`。
- Owner: T013。
- Allowed correction: 只在 T013 Owned spec 内为两个 locked case 加入事件断言；Argon 证明 B `dragover` 已发生且没有 `drop`，Terran 证明 B `dragover` 位于 `drop` 之前。保留现有真实 pointer、hover、最终列表和 add/drop 语义，不修改 T012 产品源码、共享 helper/config 或 compact spec。
- Verification: 独立核对新增 expected 与 archived `vue-drag-test` 事件顺序；随后纳入 F2 的 fresh-build 单次十项运行。仅重跑当前未补事件断言的八项，即使 8/8，也不能关闭本 finding。

### F2 — high — T013-A4 在浏览器前退出，十项真实 pointer 证据为 0/10

- Evidence: `T013-A4.md`、`evidence/T013-A4/run-summary.md` 和 permitted log 一致记录默认 webServer 的 `npm run build` 在 `vue-tsc -b` 因 `ShipBuildPanelEquipment.vue:19` 的 `getEquipmentSummary1`、`getEquipmentSummary2` 两个 TS6133 退出；Playwright exit 1、collected 0、passed 0，`.last-run.json` 为 `status: failed` 且 `failedTests: []`。没有启动浏览器、没有执行断言，也没有产生 trace。A4 命令还只指向八项 `vue-drag-test.spec.ts`，未把 compact 两项放入同一次运行。该结果是 unavailable/failed evidence，不是 T013 通过，也不能证明 A2 的 `dragover.capture` 在真实浏览器 pointer 下成立。
- Affected paths: T017-owned `src/components/ship-build/ShipBuildPanelEquipment.vue`；T013 evidence/result。T012 四个 Owned paths 当前没有由此导出的源码修正。
- Owner: T017 负责在其既有 Owned path/合同内闭合两个 TS6133 并交接可构建候选；dispatcher 负责串行化 `shared-dist-build`；T013 负责在 F1 闭合后重证。不是 T012、reviewer 或 T010 的产品修正项。
- Allowed correction: 不绕过 fresh build、不复用旧 dist、不把 0 collected 重标为 pass。T017 候选能够通过默认 build 后，T013 对冻结的 T012-A2 四个 hash 和修正后的 E2E hash 启动默认 build → preview，并在一个 Playwright invocation 中包含 `tests/e2e/compact-drag-view.spec.ts` 与 `tests/e2e/vue-drag-test.spec.ts`。
- Verification: 同一候选、同一 fresh-build 运行记录 10 collected/10 passed/0 failed/0 skipped/0 flaky/0 retried，并保留命令、cwd、exit、各输入 hash、日志和 locked 两项 trace；Argon/Terran trace/断言分别满足 F1。任一项未运行、未断言或构建未进入浏览器，verdict 仍为 changes-required。

## Acceptance

- A1 的产品 findings F1/F2 已由 A2 源码闭合。四个当前 Owned 文件的 SHA-256 与 retained candidate 完全一致；`DragTestPage.vue`、presenter、store 和 focused Unit 中已无候选直接调用 `removeChild`/`parentNode`。installed vuedraggable 自身的 DOM lifecycle 操作仍由依赖内部拥有，不是组件在 rejected add 后强删 DOM。
- 列表/事务 owner 没有转嫁给 Vue。store 的 `items` 仍是唯一 authoritative list；presenter 只转发；Vue 的两个 `modelValue` 是 store 派生投影且 setter 不写入，Vue 只渲染/协调 DOM。成功 add 仍只经 `presenter.moveItem` 提交一次；非 legacy `moveItem` 产品调用者仅为组件的 A/B 两个 add handler。没有新增 adapter、复制状态、timer、fallback 链或正式 Logic Flow 变更。
- `canMoveToZone` 同时绑定两个 vuedraggable。它在 locked lineage 对中把 Argon 的 store status `rejected` 映射为 `false`，把 Terran 的 `locked` 映射为 `true`；全局还按合同拒绝无效 target、缺失 item、same-zone 和 `duplicated`，并保留 normal/Auto/Isolate。这个 UI callback 只拥有 Sortable 的 pre-insert gate，业务分类仍由 store 的 `getDropStatus` 拥有。
- 两个 zone 均改为 `@dragover.capture`。installed SortableJS 默认 `dragoverBubble: false` 并在 nested handler 调用 `stopPropagation`；capture listener 因此能在其之前接收同一个 DOM event。Unit 的 nested Terran case 在 child 主动 stopPropagation 时仍记录 `dragover` 并允许 move，没有直接调用 store 伪造该事件。真实浏览器 pointer 结论仍受 F2 限制。
- Focused Unit 的 decisive red 记录 9 collected/5 passed/4 failed；green 记录 9/9、exit 0。九项由 normal、cancel、Auto、Isolate、locked Argon、rejected-add ownership、locked Terran nested capture、duplicate、Reset 构成，保留 exact lists/events、flags、唯一性、gate 返回值、hover/status 与 DOM count 等有效断言。新增 ownership case 能对旧 rejected-add `removeChild` 路径变红；它与 pre-insert gate case 合并证明组件不再强删 Vue-managed DOM，但不替代 F2 的真实 pointer 验证。
- Owned-path 边界满足所提供的候选：产品/Unit 内容只涉及合同列出的四个路径；result/evidence 使用合同另授的 attempt 路径；T013 spec、共享 helper/config、openspec、status、planner 与 Git 不在 A2 候选修改中。本 review 未使用 Git，也未修改任何源码、测试、配置、status 或 planner 文件。
- T012 合同明确不要求本任务自行运行 build/full Unit；这些未运行不是新的 A2 finding。T012 的独立产品接受仍必须消费 T013 真实 pointer 结果，因此 F1/F2 闭合前不得由 dispatcher 记录 T012 accepted 或宣称 M5.3 hover 已通过。

## Initial explanation

A2 选择了现有 vuedraggable `move` 边界，删除组件自己的 DOM 强删，并用 capture 保留 nested dragover；这是最小且 ownership 清晰的修正。静态源码和 9/9 focused Unit 足以接受该产品方向及组件级回归，没有发现需要退回 T012 的新代码缺陷。

当前阻塞只在必需的真实 pointer 证据：T013 spec 先补齐 locked 事件断言，T017 再提供可 fresh-build 的候选，最后 T013 单次执行 compact 2 项加 drag-demo 8 项。T013-A4 是构建失败后的 0/10，不是通过或部分通过。

## Re-review: T013-A6

### Finding closure

- F1 closed. T013-A5 changed the T013 spec to assert locked Argon B `dragover` and no `drop` at `tests/e2e/vue-drag-test.spec.ts:127-141`, and locked Terran B `dragover` before `drop` at `:143-155`. The current spec hash is `b93deed97a2e11c1afb5d36aca5d07e2671086f447ab2de029c4b20aab80e536`, matching `evidence/T013-A6/input-hashes.txt`; the current T012-A2 four-file hashes still match the retained candidate.
- F2 closed. `evidence/T013-A6/build-readiness.log` preserves the initial sandbox `EPERM` before readiness and records the permitted rerun of the same combined command: fresh build passed, preview became ready on port `23113`, and Chromium collected 10 tests. `run-summary.md` records exit 0, 10/10 passed, 0 failed/skipped/flaky/retried; `.last-run.json` is passed and ten trace archives are present. The prior A4 TS6133/build failure remains historical failed evidence and was not relabeled.

### Contract acceptance

- T012-A2 product acceptance remains valid: its candidate hashes are unchanged; direct component `removeChild`/`parentNode` removal is absent; the `move` gate rejects locked Argon while accepting matching locked Terran and retains capture-phase dragover semantics. The store remains the list/transaction owner.
- T012-A2 focused Unit acceptance remains valid: the retained decisive green is 9 collected/9 passed, including the added rejected-add ownership test and the nested Terran capture test with effective DOM/list/event assertions.
- T013-A6 supplies the previously missing real-pointer proof in one fresh-build combined invocation: compact `2/2` plus drag-demo `8/8`, for `10/10`, with locked Argon/Terran event assertions and traces. The exact compact/spec/setup/helper/config/fixture fingerprints match `input-hashes.txt` and were independently rehashed during this review.
- No new finding was identified. F1 and F2 are closed; T012-A2 product, Unit 9/9, and T013 fresh-build pointer 10/10 satisfy the reviewed contract.

### Re-review explanation

The prior `changes-required` verdict was limited to missing locked event assertions and unavailable browser evidence. T013-A5 closes the assertion gap, and T013-A6 closes the evidence gap with a successful fresh build and single 10/10 Chromium run. The current independent re-review verdict is `passed`; this does not record dispatcher acceptance or close unrelated generation-6 tasks.
