# task-test-4 auto-sector correction review — candidate 6a772220

Status:
`review_complete`

Candidate:

- Reviewed commit: `6a7722200aa102b4534f654c9b982f8653cf5e51`
- Parent: `aca7d6d4ff24b6256ebde529159097901ec1ba03`
- Worktree: `/home/slepher/project/x4-station-calculator`
- 审查开始及 focused run 期间 `git rev-parse HEAD` 均精确返回 candidate；写报告前最后一次 `git status --short --untracked-files=all` 退出码 `0`、无输出。
- `git diff --name-only aca7d6d4..6a772220` 退出码 `0`，candidate delta 仅包含：
  - `tests/e2e/auto-sector-group-one-binding/auto-sector-group-one-binding.spec.ts`
  - `tests/e2e/auto-sector-group-one-core/auto-sector-group-one-core.spec.ts`
- 未修改代码、fixture、workflow state、Git index、branch 或 commit；唯一仓库写入为本报告。build、runner config 与 Playwright output 均定向到 `/tmp`。

Evidence:

- 已阅读 `task-test-4-review-72245a05.md`、`task-test-4-review-1ae64253.md`、`task-test-4.md`，current binding/core/virtual-station request/spec，authoritative `loadLiveBindingFixture.ts`，两份 save fixture metadata，目标 tests、legacy 原件、相关实现和 `2f0a7217` 及后续三态/binding-v2 历史。
- authoritative fixture metadata：
  - `save_old.json`: `CB8837FE-98C1-42F8-9D6A-ED0ADC539111:667632.933`
  - `save.json`: `B41B8D56-C58D-4F66-8EAA-6F85BC614214:1345095.294`
  `loadLiveBindingFixture()` 从 `meta.guid/meta.time` 构造 archive state 并将每份真实 save 写入 IndexedDB。
- Fresh build：`./node_modules/.bin/vite build --outDir /tmp/task-test-4-review-6a772220-dist`，退出码 `0`；Vite `7.3.6`，`896 modules transformed`，production bundle 成功。该命令未运行 `vue-tsc`，不替代 task contract 的完整 `npm run build`。
- Server：sandbox 内执行 `./node_modules/.bin/vite preview --outDir /tmp/task-test-4-review-6a772220-dist --port 23696 --host 127.0.0.1 --strictPort`，退出码 `1`，exact error 为 `listen EPERM: operation not permitted 127.0.0.1:23696`；按环境权限重启后成功监听 `http://127.0.0.1:23696/x4-station-calculator/`。取证结束以 Ctrl-C 停止，进程退出码 `1` 属人工终止。
- 临时 runner 首次启动命令因 `/tmp` config 无法解析 `@playwright/test`，退出码 `1`、未收集测试；修正临时 config 的绝对依赖路径后 Chromium 正常启动。该错误归 `driver-environment`，未改测试规避。
- Binding focused：
  - 命令：`npm exec playwright test -- tests/e2e/auto-sector-group-one-binding/auto-sector-group-one-binding.spec.ts --workers=1 --config=/tmp/task-test-4-review-playwright.config.ts`
  - 退出码：`1`
  - exact count：`24 total / 23 passed / 1 failed / 0 skipped`
  - 唯一失败：`3.3 重置`，`expect(afterReset.result).toEqual(savedState.result)`；差异包含 reset 后本地化 group names 与新增 `undefined` representation fields。
- Core focused：
  - 命令：`npm exec playwright test -- tests/e2e/auto-sector-group-one-core/auto-sector-group-one-core.spec.ts --workers=1 --config=/tmp/task-test-4-review-playwright.config.ts`
  - 退出码：`1`
  - exact count：`34 total / 33 passed / 1 failed / 0 skipped`
  - 唯一失败：`5.3 station plan 归属重分配`，`.placement-preview--binding` 等待 `5000ms` 后不存在；Chromium 已完成真实 source mousedown、超过 4px drag threshold、source `virtual-row--dragging`、可见目标 sector polygon 与目标 hit-point 计算。
- 合计有效 focused evidence：`58 total / 56 passed / 2 failed / 0 skipped`；两个 browser run 均由 Chromium 完整执行，无 `ERR_CONNECTION_REFUSED`、browser launch failure 或中途退出。

Findings:

## F1 — binding 2.3 关闭 G1:T1 → G2:T2，但删掉了同 GUID 不同 time 覆盖

- Candidate 正确读取 `saveStore.selectedArchive.meta.time`，每个 `page.evaluate` 都显式传入 `{ gameGuid/archiveTime }` 或 `{ guid/time }`，并使用两份真实 fixture metadata。它先证明 color mutation 生效，再切换 `G1:T1 -> G2:T2` 并验证旧 mutation 不残留；fresh focused 通过。
- Candidate 删除了原 2.3.3，同一 GUID 不同 archive time 的 `G1:T1 -> G1:T2` 不再存在。两份原始 fixture 本身是不同 GUID，当前 case 没有通过 `transformSave` 构造第二个同-GUID archive。
- 结论：G1:T1 → G2:T2 已覆盖；同 GUID 不同 time 未覆盖。Owner 为 test owner，仅允许 binding spec；用 helper `transformSave` 基于真实 save 构造同 GUID、不同真实 time 的第二 archive，并保留 exact mutation witness。

## F2 — current Preview/edit/retain/Exit 对齐已关闭

- Core 2.1/2.2 现在精确断言 preview/edit 的 `.retain-chk` 为 `0`、不存在独立 `/退出|Exit/`，并用 current `/查看|Preview/` 返回 result；两项 fresh focused 均通过。
- Binding 3.2 在 UI 中真实修改 color，先证明 mutation 与原值不同，再点击 current Preview，断言 `calculationMode='result'` 且 exact edited color 保留；fresh focused 通过。
- 这符合更新后的 binding 三态 contract：retain 只在 generate/recalculate 显示。旧 core spec/request 中“edit 显示 retain”和独立 Exit 文案已被较新的 binding mode contract/历史取代，分类为 `stale`，不是产品 bug。

## F3 — binding Reset 仍是 test-owned representation oracle，且 virtual draft reset 没有 witness

- 3.3 已新增真实 color mutation，但 reset 后要求整个 `autoGroupResult` 与 reset 前对象 byte/deep equal。Current contract要求从 saved binding + 当前参数重新计算，不保证本地化 display name、缺省 `undefined` 字段等 representation 与旧对象逐字节相同。Fresh failure正是这些非领域差异；saved groups、参数和 context 比较通过，不能据此报产品 bug。
- 3.3 没有修改 virtual station draft，也没有在 reset 后逐字段比较 virtual draft。4.2 注释称修改 draft，实际只读取并来回切页；4.3 只比较 length；4.4 没有制造未分组状态；4.5 没有执行 confirm/apply。它们可在对应生命周期失效时继续通过。
- 未发现不存在 selector 或 invalid button 导致这批失败；主要问题是 stale/full-object oracle 与永不失败的静态存在性/length oracle。3.2/3.3/4.x 未通过 `page.evaluate` 直接注入产品状态，但大量只读 store 断言没有建立 UI mutation witness。
- Owner 为 test owner，仅允许 binding spec：以 `sectorMacro`、coverage/connections/color/assignment/trade-station 等领域字段比较 reset 来源；先修改一个 virtual draft 的 `sectorMacro/groupId/position/name` 并证明生效，再断言 reset 从 saved binding 重建。不要比较整份 UI-derived result。

## F4 — core 4.1 locator/数量有所加强，但候选算法 oracle 仍与产品输出同源

- 4.1 使用 current `.candidate-item*` selectors，逐 card 比较名称、player item 数量/顺序、virtual item、selected state，并建立 virtual-only card；fresh focused 通过。
- `expected.candidateNames` 直接来自同一 `liveStore.autoGroupResult.sectorStationCandidates[group.sectorMacro].slice(0,5)`。这可验证 Vue/presenter 与 store 输出一致，却不能独立证明 raw candidate filtering、threshold、pure-qualified replacement 或 top-5 算法正确；fixture也未建立会区分这些规则的 exact expected set。
- Owner 为 test owner，仅允许 core spec：从 authoritative save fixture 中选定可识别 sector/station codes，写死或独立计算最小 exact expected order/set，并包含会区分 top-5 pure-qualified规则的 witness。

## F5 — core 5.1/5.2 已对齐 binding v2 sectorMacro contract

- `confirmAutoSector()` 通过真实 assignment/trade-station UI 解决 gate，并无条件要求 confirm enabled；5.1/5.2 fresh focused 均通过。
- 5.1 exact 比较 draft/persisted `sectorMacro` 顺序且验证唯一性；5.2 exact 比较 coverage、connections、jumpRange、trade station。该行为符合 newer binding-v2 identity。
- 测试注释中的“UUID/sectorMacro 映射”以及旧 core 文档的 UUID-first 口径为 `stale`；current persisted group 不含独立 `id`，不得要求产品恢复 UUID。

## F6 — core 5.3 已形成 product-owned drag-preview defect evidence，但其后置 group oracle仍需 test owner修正

- Source 是 fixture 中唯一 id `f36126e5-7798-ed14-3c03-938b961efa0b` 的既有 virtual draft；测试精确证明 persisted source 为 `cluster_100_sector001_macro`。UI source 唯一且进入 `virtual-row--dragging`，说明真实 mousedown/mousemove 已跨过产品 4px drag gate。
- 目标 `cluster_26_sector001_macro` polygon 可见；authoritative binding fixture将其置于 `cluster_24_sector001_macro` coverage，而 fresh failure snapshot又显示它作为当前 draft 的可见 `Atiya's Misfortune I` group。无论当前重算后是 coverage 还是 anchor，它都属于当前 draft 的有效 anchor/coverage 范围；`getAllGroupCoverageEntries()` 应将其纳入允许落点。
- Current implementation在 active virtual drag + binding panel + valid target 下应由 `MapWorkbenchView.onMouseMove()` 生成 binding preview，再由 `stopDrag()` 调用 `liveStore.moveVirtualStationDraft()`。Fresh Chromium 中 preview 完全不存在，且先前无-preview run在 release 后 draft仍留在 cluster 100；这是 truthful UI precondition 下与“既有 virtual station 可拖到有效 sector并更新 sectorMacro/position/groupId”contract相反的产品行为。
- Classification：当前 preview/drop断点为 `product-owned`。Reviewer建议下一阶段建立 bug artifact，产品 owner调查 `AutoSectorGroupPanel` window mousemove emit → `MapSavePanel` relay → `MapWorkbenchView.activeBindingDragPreview/resolveBindingPreviewAtPointer` 链；本 task-test coding worker不得未经下一阶段授权修改产品。
- 同时，candidate hardcode postcondition `groupId/sectorMacro='cluster_24_sector001_macro'` 没有先读取当前 runtime sector→group mapping；若重算使 cluster 26成为 anchor，该期望会 stale。Product defect修复后，test owner应从当前 exact group coverage建立 expected group并断言 `old != expected`，再确认 persisted plan。

Classification:

| 项目 | 分类 | Product BUG |
|---|---|---|
| binding 2.3 缺同 GUID 不同 time | `test-owned` coverage gap | 否 |
| core 旧 edit retain / Exit 口径 | `stale`，candidate已按 current contract修正 | 否 |
| binding 3.3 full-result reset failure | `test-owned` oracle | 否 |
| binding 4.2–4.5 virtual lifecycle空 oracle | `test-owned` coverage gap | 否 |
| core 4.1 同源 candidate oracle | `test-owned` coverage gap | 否 |
| core 5.1 注释/旧 UUID-first 文案 | `stale`，runtime oracle已按 binding v2 | 否 |
| core 5.3 valid virtual drag无 preview/drop | `product-owned` | 是，建议下一阶段 bug artifact |
| sandbox preview `EPERM`、临时 config module resolution | `driver-environment`，已取得后续有效 browser evidence | 否 |
| 决定性上下文缺口 | `context-blocked: 0` | 否 |

Verdict:
`changes_required`

Candidate 修正了 current Preview/edit/retain/Exit、真实 G1:T1→G2:T2、confirm gate、binding-v2字段映射，并把 core 5.3推进到真实拖放链；但仍缺同 GUID 不同 time、Reset/virtual draft exact witness和独立 candidate规则 oracle。Fresh run另确认一个 product-owned virtual-station drag preview/drop defect，需先走下一阶段 bug 路由，不能由当前 test correction worker直接改产品。

Changes:

1. Test owner：binding 2.3 补真实 `G1:T1 -> G1:T2`；保留显式 evaluate 参数、`selectedArchive.meta.time` 与已证明生效的 mutation witness。
2. Test owner：重写 binding 3.3/4.x 的最小 Reset + virtual draft oracle，比较领域字段而非整份 UI-derived result；删除无 mutation、只比较 length/存在性的重复 case。
3. Test owner：core 4.1 用 fixture 中可识别的 exact station set/order覆盖 raw filtering、top-5与 pure-qualified补位，不从被测 product output生成 expected。
4. 下一阶段 product/bug owner：先记录 core 5.3 的 drag-preview/drop product bug，再调查并修复真实 event relay/preview/drop链；当前 coding worker不得改产品。
5. Product defect关闭后 test owner：让 core 5.3 从 current runtime groups推导目标 `sectorMacro -> groupId`，先证明旧归属相反，再验证 release后的 shared draft与confirm后的 persisted plan。

Caveats:

- 本 review仅覆盖 immutable candidate `6a772220` 的两个 auto-sector spec及其直接规范/实现上下文；不声称 `task-test-4`、全套 E2E、完整 build或 initiative 已完成。
- 当前 candidate共收集 `58` 个 focused cases；上一候选的 `59` 不应沿用，因为本 delta移除了重复 binding reset case。
- 未运行 `npm run test:e2e`、`npm run build`、Playwright全量或其他 feature spec；遵照用户指令未扩展运行范围。
- 临时 runner title 的 source location受 `/tmp` config转换影响而显示偏移；failure stack精确落在工作树 binding `:394` 与 core `:903`，分类以 immutable工作树源码与stack为准。
