# task-test-4 auto-sector review — candidate 1ae64253

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` auto-sector focused review。范围仅为 `tests/e2e/auto-sector-group-one-binding/auto-sector-group-one-binding.spec.ts` 与 `tests/e2e/auto-sector-group-one-core/auto-sector-group-one-core.spec.ts`；未修改产品、测试、fixture、Git index、commit、branch 或 workflow state，唯一写入为本报告。

Reviewed commit:
`1ae642538ff928857ff574f2bf8b7f46bbbf4644`，single parent `2f620cd721a4b76b89d96c219330ef0e7a7114c8`。candidate 仅修改上述两个 owned test paths，共 `3 insertions / 59 deletions`；`git diff --check 2f620cd7 1ae64253` 通过。

Evidence:

- `1ae64253^..1ae64253` 在两个 `beforeEach` 中删除了 `migrateStorageKeys()`、二次 `page.reload()`、二次 ready wait、重复 live-production 点击和重复 UI language 设置。每个文件现在只 import 一次并在 `beforeEach` 调用一次 authoritative `loadLiveBindingFixture(page)`。
- core 的 `waitForAppReady()` 从 `500ms` 改为 `10000ms`；candidate 两文件中不存在 `waitForSelector(... timeout: 500)`。其余 `waitForTimeout(500)` 是交互等待，不是 app-readiness deadline。
- core 1.1 clean-slate 仍需有意清空 binding 并 reload；candidate 已把 raw `x4_save_bindings` 改为 `gameDataStore.getStorageKey('save_bindings')`。binding 5.4 的保存后 reload 同样属于被测持久化行为，不是 shared setup 的重复迁移。
- authoritative helper 已负责 current empire/logic-flow/ship/save-archive/save-binding keys、IndexedDB archive、active live view、reload、ready、live-production UI 和 UI language。candidate 不再在 helper 后覆写旧/v9 key。
- diff 没有删除或重命名任何 test declaration，也没有删除 `expect(...)` 行。删除的 59 行全部是重复 setup/helper 代码与注释；现有行为断言原样保留。
- Worker focused evidence：binding `21 passed / 4 failed`，失败为 `2.3 / 3.2 / 3.3 / 5.3`；core `22 passed / 12 failed`，其中 8 个为 `ERR_CONNECTION_REFUSED`，其余为 `4.1 / 5.1 / 5.2 / 5.3` selector/data failures。
- core 四个保留的 `error-context.md` 都显示 current live auto-sector UI 已渲染，候选列表存在，但顶部 `确定` 按钮因未决项处于 disabled；这不是产品 postcondition 相反的证据。
- `task-test-4-review-full-6f0b3565.md` 已把这两个文件的旧手工 key/reload 与 500ms readiness 归为 confirmed test-owned setup family。candidate 正确关闭了该 family；focused 由 `4/25 + 34/34` 失败改善为 binding 4 项、core 4 项有效 test failure，不能把余项按数量推为产品 BUG。
- 历史 `2f0a7217` 与 current binding contract规定确认后不跳转，workbench 保持 `auto-sector-group`；current shared bar 为 `[查看 | 编辑 | 重算]`，并明确移除独立「退出」按钮；Reset 必须从 saved binding + 当前参数重算，而不是恢复最近 calculation snapshot。

Findings:

## F1 — binding 2.3：test-owned fixture/context setup

- Immutable evidence：`1ae64253:...binding.spec.ts:226-262` 创建一个没有对应 archive list/IndexedDB 数据的假 GUID，直接写两个 store，再手工调用 `initAutoGroupDraft()`；但现有 `fixtures.md` 和 `context-switch-save.patch.json` 明确要求第二个有效 GUID/archive 前置。
- Contract basis：`G:T -> G2:T` 或 `G:T2` 的 draft 重新初始化仍是 current behavior，不是 stale；当前 case 没有建立真实第二 context。
- Minimum correction / owner：test owner，仅改 binding spec；通过唯一 `loadLiveBindingFixture(page, { transformSave })` 输入构造两个有效 archive context，使用 current binding/archive 切换入口，先制造可区分的未确认 draft，再分别断言 GUID 与 archive-time 切换后旧内容不残留。不要再手写 storage key/reload 或虚构无 archive 的 binding。
- Focused closure：2.3 在真实两个 context 下通过，且断言命中 context switch 后的新 draft identity/content。

## F2 — binding 3.2：test-owned stale selector，行为仍 current

- Immutable evidence：`:304-318` 查找已被 current three-mode bar 删除的 `/退出|Exit/`。
- Contract basis：current contract要求从「编辑」切到「查看」或「重算」时保留 shared draft，并明确 SHALL NOT 显示独立「退出」按钮。
- Minimum correction / owner：test owner，仅把交互改为 current `[查看|Preview]` mode button；切换前通过 UI 做一个可观察 draft 修改，切换后断言 mode 与该修改都保留。不得删除“切换不恢复 snapshot”的真实行为断言。
- Classification：`test-owned`；旧 selector stale，但目标行为没有退役。

## F3 — binding 3.3：stale reset oracle

- Immutable evidence：`:321-340` 没有实际修改 draft，却要求 reset 后 `autoGroupResult` byte-equal reset 前结果，并把它描述成恢复 `calculationBaseline`。
- Contract/history basis：current spec要求 Reset 丢弃未确认修改，从 saved binding groups + 当前参数重新运行 clean/incremental 计算并重建 virtual drafts；`e2e_test_tasks.md` 已把 3.3.2/3.3.3 标为未完成。
- Minimum correction / owner：test owner；先通过 UI 修改至少一个 group/assignment 与一个 virtual draft，保存 reset 前 mutation witness；点击 current reset 后断言 mutation 消失、结果来自 persisted binding、virtual drafts 被重建且 active binding/selected archive 不变。不要再以 reset 前 JSON equality 作为 oracle。
- Classification：`stale` assertion；没有产品 BUG 证据。

## F4 — binding 5.3：stale/vacuous duplicate reset oracle

- Immutable evidence：`:582-597` 注释称“修改 groups 和 virtual station drafts”，实际没有修改；随后再次断言 reset 前后 JSON equality。
- Contract basis：真实回归风险是 groups 与 virtual drafts 都从 saved binding 重建，不能由“什么都没改、前后相等”证明。
- Minimum correction / owner：test owner；最小方案是把 groups + virtual drafts 的双 mutation/reset exact postcondition并入修正后的 3.3，并保留一个非重复 current behavior case；若保留 5.3，则必须实际修改两类 draft并分别断言恢复来源。不能只删除覆盖或保留空跑断言。
- Classification：`stale` oracle / test coverage gap。

## F5 — core 4.1：test-owned stale locator/data model

- Immutable evidence：`:633-659` 在 `SectorTradeStationCard` 的 `.candidate-item` 内查找 `.option-radio`；current `SectorTradeStationCard.vue` 使用 `.candidate-item`、`.candidate-item--selected` 与 icon，`.option-radio` 属于 allocation list。页面快照已显示真实 trade-station candidate list。
- Contract basis：候选来源、排序、top-5、qualified/manual/bridge/virtual 规则仍是 current behavior；只有 locator/data setup过期。
- Minimum correction / owner：test owner；使用 current candidate selected state和明确 group identity，建立 auto/manual/bridge/no-player fixture preconditions，分别断言 exact candidate set/order、最多 5 项及 virtual-only。移除 `>= 0` 这类不可能失败的 oracle，但保留每条真实候选规则。
- Classification：`test-owned`；不是产品 BUG。

## F6 — core 5.1：test-owned unresolved-confirm precondition and vacuous postcondition

- Immutable evidence：`:790-813` 只有 confirm enabled 才执行主体；当前 failure snapshot显示 `确定` disabled。即使进入主体，也只检查旧 id 是 string，`afterGroups` 未参与任何匹配断言。
- Contract basis：UUID 优先、sectorMacro fallback 仍是 current write behavior，但测试没有先解决 assignment/trade-station gate，也没有比较写入结果。
- Minimum correction / owner：test owner；通过 current UI选择所有未决项并明确断言 `.confirm-btn` enabled；构造一个 UUID 命中和一个仅 sectorMacro 命中的可区分输入，确认后比较 persisted binding identity，删除 conditional skip。不得改产品 gate。
- Classification：`test-owned` data/setup + assertion gap。

## F7 — core 5.2：test-owned unresolved-confirm precondition and vacuous consistency checks

- Immutable evidence：`:816-847` 同样在 disabled 时跳过；`expect(binding?.groups?.every(...))` 没有 matcher，且 coverage/connections/jumpRange/trade station 没有与 pre-confirm draft 比较。
- Contract basis：一次性写入一致性仍是 current behavior。
- Minimum correction / owner：test owner；先用 UI解决 gate，确认前捕获 exact normalized draft，确认后从 persisted active binding/current storage读取，逐 group 比较 coverage、connections、jumpRange、trade station并验证删除项消失；主体必须无 conditional skip。
- Classification：`test-owned` data/setup + assertion gap。

## F8 — core 5.3：stale navigation assertion plus test-owned missing station-plan oracle

- Immutable evidence：`:850-866` 没有比较任何 station plan映射；确认后只期待 `empire-wareflow-dashboard`。current snapshot仍停在 disabled gate。
- Contract/history basis：station plans按最终 sector→groupId重分配仍是 current behavior；但 `2f0a7217` 和 current binding contract已改为确认后不跳转、workbench保持 `auto-sector-group`，因此 dashboard expectation已 stale。
- Minimum correction / owner：test owner；先通过 UI解决 gate并记录 expected sector→group mapping，确认后从 persisted binding精确断言 station plans重分配；把 dashboard expectation替换为 current“不跳转 + workbench保持 + 已保存 UI 状态/confirm disabled”断言。
- Classification：`stale` navigation assertion + `test-owned` data/assertion gap；没有产品 BUG 证据。

## F9 — core 8 × ERR_CONNECTION_REFUSED：environment

- Immutable evidence：worker明确报告 8 项为 web server拒绝连接；这些 case没有建立页面、交互或 postcondition。
- Minimum correction：不改两个 spec，不记 pass，也不记 product/test semantic failure；在稳定 preview/webServer 上仅重跑该 core focused file（必要时 `--workers=1`）收集有效结果。
- Classification：`environment`。

Verdict:
`changes_required`

Candidate 对原 full-review 指定的 setup/key/readiness correction是正确且最小的，也未删除真实行为断言；但 8 个有效 focused failure中仍有 test-owned fixture/selector/gate/断言缺口与 stale oracle，当前不能接受这两个 auto-sector files 为 canonical-complete。现有证据确认 `product bug: 0`；不得按失败数量升级 BUG。

Changes:

1. binding 最小批次：修 2.3 的真实双-context fixture；3.2 改 current「查看」交互；3.3/5.3 用实际 mutation + saved-binding reset oracle覆盖一次完整 reset行为。
2. core 最小批次：4.1 改 current candidate locator并给出 exact candidate oracle；5.1/5.2/5.3 先经 UI解决 confirm gate，再无条件验证 persisted identity/data/station-plan；删除 stale dashboard expectation，保留 current不跳转断言。
3. 只重跑两个 focused files；8 个 `ERR_CONNECTION_REFUSED` 在稳定 webServer下重取证。无需先扩展运行 full suite。

Caveats:

- 本 reviewer未重跑浏览器或完整 suite；runtime计数采用用户提供的 worker evidence，core页面状态采用现存四份 `error-context.md`。
- binding四项没有保留 assertion stack，因此报告不声称具体失败行；分类绑定于 immutable test body、现行 contract、fixture文档和历史，且只把已证明过期的 oracle标为 stale。
- 本 verdict不声称其他 21/22 passed case已完成质量审查；它们只证明 candidate setup迁移显著收窄了旧批量失败。
