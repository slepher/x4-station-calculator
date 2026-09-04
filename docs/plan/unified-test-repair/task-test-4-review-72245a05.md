# task-test-4 auto-sector correction review — candidate 72245a05

Status:
`review_complete`

Candidate:

- Reviewed commit: `72245a0566d32c14e16c3270fa91ed99e14bc15c`
- Parent: `8433b772a1025a9e47ffa0804d1d271f892cf230`
- 审查开始与 focused run 结束后，`git rev-parse HEAD` 均精确返回 candidate；写报告前 `git status --short --untracked-files=all` 退出码为 `0` 且无输出。
- `git diff --name-status 8433b772 72245a0566d32c14e16c3270fa91ed99e14bc15c` 退出码为 `0`，仅包含：
  - `tests/e2e/auto-sector-group-one-binding/auto-sector-group-one-binding.spec.ts`
  - `tests/e2e/auto-sector-group-one-core/auto-sector-group-one-core.spec.ts`
- `git diff --check 8433b772 72245a0566d32c14e16c3270fa91ed99e14bc15c` 退出码为 `0`。
- 未修改产品、测试、fixture、workflow state、Git index、branch 或 commit；唯一写入为本报告。

Evidence:

- 已阅读上一轮 `docs/plan/unified-test-repair/task-test-4-review-1ae64253.md` 与本轮 contract `docs/plan/unified-test-repair/task-test-4.md`。上一轮 F1-F9 要求保留真实语义覆盖，而不是只消除失败。
- authoritative helper `tests/e2e/live/helpers/loadLiveBindingFixture.ts:34-59,88-158` 会读取 `tests/fixtures/save/*.json`，从真实 metadata 构建 archive list，并将每份 archive 写入 IndexedDB；没有必要手写 archive storage。
- `jq '{meta}' tests/fixtures/save/save.json` 与 `save_old.json` 均退出 `0`。metadata 分别为：
  - `save.json`: guid `B41B8D56-C58D-4F66-8EAA-6F85BC614214`，time `1345095.294`，filename `save_009`，parser `v15`。
  - `save_old.json`: guid `CB8837FE-98C1-42F8-9D6A-ED0ADC539111`，time `667632.933`，filename `save_008`，parser `v15`。
  Candidate 的 `transformSave` 只是把这两组值原样写回，未伪造新 metadata，也没有构造“同一 guid、两个 archive time”的 fixture。
- current binding contract：
  - `openspec/changes/auto-sector-group-one-binding/request.md:11-24,46-59` 定义唯一 shared draft、context 切换重建、Reset 从 saved binding + 当前参数重算并重建 virtual drafts。
  - 同文件 `:25-31,187-206,240-251` 定义 `[预览 | 编辑 | 生成]`、删除独立 Exit、retain 只在生成模式显示，并以 `sectorMacro` 作为持久化 group identity。
  - 同文件 `:144-156` 定义确认成功后 `hasChanges=false`、按钮置灰且不跳转。
  - `openspec/changes/auto-sector-group-one-binding/specs/auto-sector-group-binding-draft/spec.md:49-59,83-96,381-403,448-465,732-752` 给出 context、Reset、三态切换及 binding v2 identity 的 exact scenario。
  - `openspec/changes/auto-sector-group-one-core/specs/auto-sector-group-core/spec.md:560-585` 与 `auto-sector-group-trade-station/spec.md` 保留 confirm、候选与 station-plan 行为；其中 core 文档仍写“UUID 优先”，但较新的 binding v2 contract 明确 group 不再持久化 `id`，current type/implementation也只以 `sectorMacro` 为 identity。
- current implementation：
  - `src/store/useLiveProductionStore.ts:160-218,457-525,702-710` 以 `gameGuid:archiveTime` 初始化 shared/virtual draft，并在 archive 切换时重新初始化。
  - `src/components/empire/presenters/useAutoSectorGroupPresenter.ts:347-400` 的 Reset 确实从 saved binding 与当前参数重算，并调用 `setAutoGroupResultFromBindingReset()`。
  - 同文件 `:1237-1241,1335-1417` 执行 current confirm gate、写入 binding、应用 virtual drafts、保存并保持当前 workbench。
  - `src/store/useSaveBindingStore.ts:143-174,700-813` 保留四个新增字段，使用 `sectorMacro` 对齐 groups/connections/station plans。
  - `src/components/empire/sector-overview/AutoSectorBar.vue:54-71` 只渲染 `[查看 | 编辑 | 重算]`，没有独立 Exit；`SectorTradeStationCard.vue:79-118` 的 current candidate locator 是 `.candidate-item` / `.candidate-item--selected` / `.candidate-item--virtual`。
- 历史核对：`git show 2f0a7217` 及后续 `97e506d8`、`1100eee9`、`519b6601` 对应 current contract：确认后不跳转、删除旧 Exit、改用三态、binding v2 以 `sectorMacro` 为 identity。`tests/legacy/e2e/from-e2e/...` 仍保存旧 retain/Exit/UUID 原件；它们不是 current oracle。
- Focused command：
  - `npm exec playwright test -- tests/e2e/auto-sector-group-one-binding/auto-sector-group-one-binding.spec.ts tests/e2e/auto-sector-group-one-core/auto-sector-group-one-core.spec.ts --workers=1`
  - 退出码：`1`
  - 计数：`59 total / 56 passed / 3 failed / 0 skipped`
  - Playwright webServer build 成功，preview 成功监听 `http://127.0.0.1:23695/x4-station-calculator/`，Chromium 正常执行全部 59 项；本轮没有 `ERR_CONNECTION_REFUSED`、browser launch 或 preview 环境失败。

Findings:

## F1 — binding 2.3 仍未建立完整且可运行的双 archive context oracle

- Immutable evidence：`binding.spec.ts:245-248` 的 browser callback 直接引用未作为参数传入的 `GAME_ARCHIVE_TIME`。focused run 精确失败为 `ReferenceError: GAME_ARCHIVE_TIME is not defined`，栈指向 `:245`。
- 即使修正参数传递，`:281-294` 所称“同一 gameGuid 但不同 archive time”实际从 `SECOND_GAME_GUID:SECOND_ARCHIVE_TIME` 切回 `GAME_GUID:GAME_ARCHIVE_TIME`，同时改变 guid 与 time；两份 authoritative save 本来也是不同 guid，各只有一个 time。因此它没有覆盖 `G:T1 -> G:T2`。
- `:252-279` 用“选择第一个 palette color，然后要求第二 context color 不同”作为残留判断，没有先证明 mutation 相对原值确实改变，也没有以可区分的 draft identity/content 比较；颜色偶然相同会产生假失败。
- Owner：test owner。Allowed path：binding spec。最小修复：把 `{ guid, time }` 显式传入每个 `page.evaluate`；用 helper 的 `transformSave` 构造真实 `G1:T1`、`G2:T2` 和同 guid 的 `G1:T2` archive 记录；先证明未确认 mutation 生效，再分别断言切换后的 context key 与 exact draft witness 不残留。

## F2 — current Preview selector 只部分关闭；core 仍保留 stale retain/Exit 合同

- binding 3.2 已把 `/退出|Exit/` 改为 current `/查看|Preview/`，但 `binding.spec.ts:349-363` 没有在切换前修改任何 draft；“保留修改”只有 `autoGroupResult` 非空，产品若恢复旧 snapshot 仍会通过。
- core 2.1 focused failure：`core.spec.ts:296` 期待 preview/result card 有 3 个 `.retain-chk`，实际为 `0`。current request `:240` 明确 preview/edit 不显示 retain；页面快照显示 current 三态按钮和 pin 控件。
- core 2.2 focused failure：`core.spec.ts:311` 期待 edit mode retain 可见，实际元素不存在；该 case 后续 `:328-332` 仍查找已删除的 Exit。
- Owner：test owner。Allowed paths：两个目标 spec。最小修复：preview/edit 断言 retain 为 `0`，generate 断言 retain controls；core 与 binding 都通过 current Preview 按钮退出 edit，并在切换前制造、验证一个真实 draft mutation，切换后验证 exact mutation 保留。

## F3 — 两个 Reset case 仍是无效 oracle

- `binding.spec.ts:366-403` 与 `:645-675` 都只修改 group color，却在 Reset 后读取 `saveBindingStore.activeBinding.groups`。未确认颜色本来只写 shared draft，saved binding 在 Reset 前后都不应变化，因此即使 Reset 完全 no-op，`after.groups === savedState.groups` 仍通过。
- 两项都只比较 `virtualStationDrafts.length`，没有修改任何 virtual draft，也没有比较 name/groupId/sectorMacro/position/modules 等内容；不能证明 virtual drafts 被重建。
- 两项也没有比较 Reset 前后的 `liveStore.autoGroupResult`、assignment、trade station、retain 或实际颜色 restoration。focused 中两项通过不构成 contract evidence。
- Owner：test owner。Allowed path：binding spec。最小修复：合并重复 coverage；先对 shared group/assignment/color 和至少一个 virtual draft 字段做可观察 mutation并证明生效；Reset 后比较 `liveStore.autoGroupResult` 与从 saved binding + 当前参数得到的 exact postcondition，逐字段比较 virtual draft 重建结果，同时保留 active binding/archive 不变断言。

## F4 — candidate locator 已更新，但候选规则仍没有被测试

- `core.spec.ts:675-700` 使用 current `.candidate-item`，因此旧 `.option-radio` locator 问题已关闭，focused 4.1 也通过。
- 但 case 只证明第一张 card 有任意 candidate、第一项/最后一项可见；没有绑定明确 group identity，没有比较 exact candidate set/order、top 5、qualified 保留、manual/bridge 规则，也没有断言最后一项是 `.candidate-item--virtual`。删除候选过滤/排序逻辑后该 case仍可能通过。
- Owner：test owner。Allowed path：core spec。最小修复：使用现有 save 数据中可识别的 group/station code 建立 exact candidate precondition，逐条断言集合、顺序、数量上限和 virtual-only group；selected state 使用 `.candidate-item--selected`，virtual identity 使用 `.candidate-item--virtual`。

## F5 — confirm gate 与字段写入有进展，但 station-plan mapping 仍缺 mutation witness

- Candidate 新增 `resolveConfirmGate()`，通过 current allocation/trade-station UI 解决未决项，并无条件要求 `.confirm-btn` enabled。focused 5.1/5.2/5.3 均执行并通过，旧“disabled 时静默跳过主体”的缺陷在这些主体内已关闭。
- core 5.1 当前比较 exact sector list，符合较新的 binding v2 `sectorMacro` identity；上一轮“UUID 优先”要求应按 current contract 分类为 stale，不应要求产品恢复已删除的持久化 UUID。
- core 5.2 对 coverage、connections、jumpRange、trade station 做 before/after exact equality；binding 5.4 经 save + reload 精确验证 `appliedAutoGroupArchiveTime`、`prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold`，本轮均通过。
- 但 core 5.3 `:892-910` 在 confirm 前没有改变 sector→group 关系，也没有先证明某个 station plan 的旧 `groupId` 与 expected mapping 相反。当前 db fixture 经 v2 normalize 后，唯一带 `sectorMacro` 的 virtual plan已是正确 group；其他 save station plans多数没有 `sectorMacro`，又被 `if (plan.sectorMacro)` 跳过。因此移除产品重分配代码后该断言仍可能通过。
- Owner：test owner。Allowed path：core spec。最小修复：通过 current UI 改变一个含可识别 station plan 的 sector coverage/group 归属，先记录 old `groupId != expectedGroupId`，confirm 后无条件断言该 plan 精确重分配；不要用 `if (plan.sectorMacro)` 跳过目标 witness。

## F6 — 仍存在永不失败断言和 setup skip 分支

- 例：`core.spec.ts:287` 与 `:718` 用 `count() >= 0`，恒为真；binding `:532,589,592` 也存在同类零下界。
- candidate 修改的 core 4.1、5.1、5.2、5.3 仍以 `if (!(await enterAutoSectorGroup(page))) { test.skip(); return }` 包住主体。shared fixture/entry 若回归为空，这些 canonical cases会被记为 skip，而不是失败。
- Owner：test owner。Allowed paths：两个目标 spec。最小修复：对 required precondition 使用明确 `expect`/throw；把零下界改成由 fixture/contract确定的 exact 或正下界；只对 contract 明确允许缺席的可选 UI 使用条件分支。

## F1-F9 closure matrix

| 上轮项 | 本轮结论 | 依据 |
|---|---|---|
| F1 真实 context | 未关闭 | runtime ReferenceError；未覆盖同 guid 不同 time |
| F2 current Preview | 部分关闭 | binding selector正确，但无 mutation；core 仍有 stale Exit/retain |
| F3 reset source | 未关闭 | 只比较未被修改的 persisted binding |
| F4 duplicate reset | 未关闭 | 未修改/逐字段比较 virtual draft |
| F5 candidate locator/rules | 部分关闭 | locator正确，规则 oracle缺失 |
| F6 identity/confirm precondition | current contract 下关闭 identity 与 gate | sectorMacro 已取代 UUID；focused 5.1 实际执行通过 |
| F7 confirm write consistency | 关闭本轮指定字段 | focused 5.2 与 binding 5.4 通过且为 exact comparison/reload |
| F8 station-plan + no-navigation | 部分关闭 | no-navigation exact 且通过；station mapping 无反向 precondition |
| F9 environment | 本轮已取得有效 evidence | 全 59 项均由 Chromium执行，无 environment failure |

Classification:

| 剩余 focused failure | 分类 | 依据 | Product BUG |
|---|---|---|---|
| binding `2.3 context 切换重置 draft` | `test-owned` | `page.evaluate` 未传入 `GAME_ARCHIVE_TIME`，在任何产品 postcondition 前抛 `ReferenceError` | 否 |
| core `2.1 非编辑态 group card 展示` | `stale` | current contract规定 preview 不显示 retain；实际 UI 为 0，测试仍期待 3 | 否 |
| core `2.2 编辑态 group card 控件` | `stale` | current contract规定 edit 不显示 retain且无独立 Exit；实际 UI 与 current contract一致 | 否 |

- `product-owned: 0`
- `driver-environment: 0`
- `context-blocked: 0`
- 静态未闭合项 F2/F3/F4/F5/F6 均为 `test-owned` assertion/setup gap；它们没有形成 truthful UI precondition + exact opposite postcondition，因此不得创建 BUG。

Verdict:
`changes_required`

Candidate 改善了 helper 使用、current candidate selector、confirm gate、sectorMacro identity、字段精确写入和确认后不跳转，但没有关闭全部 F1-F9。三项 focused failure均属于测试；另有 Reset、候选规则和 station-plan mapping 的可通过但无证明力 oracle。当前没有 product bug 证据。

Changes:

1. Test owner 修复 binding 2.3 的 browser 参数传递，并建立 `G1:T1 -> G2:T2` 与真实 `G1:T1 -> G1:T2` 两类 context；使用已证明发生的 exact mutation witness。
2. Test owner 把 core 2.1/2.2 对齐 current `[预览 | 编辑 | 生成]`：preview/edit 无 retain、generate 有 retain、用 Preview 离开 edit；binding 3.2 同时加入真实 mutation 保留断言。
3. Test owner 将 binding 3.3/5.3 合并为一个真实 Reset oracle：修改 shared group 与 virtual draft，断言 live result/virtual content恢复自 saved binding，context 不变。
4. Test owner 为 core 4.1 建立 exact candidate set/order/top-5/virtual oracle；为 core 5.3 建立 confirm 前错误归属、confirm 后精确重分配的 witness。
5. Test owner 移除上述 scoped cases 的 `test.skip()` setup masking 和恒真 `>= 0` 断言。修正后仅重跑本报告的同一 focused 命令。

Caveats:

- 本 review 只覆盖 immutable candidate `72245a05` 及其两文件 delta，不宣称完整 E2E、其他 canonical files 或 `task-test-4` 完成。
- 用户提供的中断 evidence `35/59，32 passed、3 failed` 未被当作 pass；本报告使用本 reviewer 完整取得的 `56 passed / 3 failed / 59 total` 与退出码 `1`。
- 未运行 `npm run test:e2e` 全套；focused command 的 Playwright webServer 已执行 production build，但这不替代 task contract 的完整 blocking validation。
- `openspec/changes/auto-sector-group-one-core/specs/auto-sector-group-core/spec.md` 与其 E2E task 中的 UUID/旧 mode 文案落后于较新的 binding v2/current implementation；本 review 依据最新 binding contract、提交历史和当前类型/实现判定这些旧文案为 stale，不据此报告产品缺陷。
