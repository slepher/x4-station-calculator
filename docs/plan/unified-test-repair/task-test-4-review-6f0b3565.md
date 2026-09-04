# task-test-4 review — candidate 6f0b3565

Status:
`review_complete`

Task:
`unified-test-repair` generation-2 `task-test-4` immutable candidate review。

Reviewed commit:
`6f0b35655c45da1399bf2a8b03416989eb0b1568`，single parent `30e1de6ba7b2c68f65d9614921d5949cd0c1e94b`。审查开始时控制 worktree `HEAD` 精确匹配 candidate 且 clean；candidate 仅修改 `tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts`（34 insertions / 9 deletions），未混入产品代码、fixture、配置或其他 task 路径。

Evidence:

- `git diff --check 6f0b3565^ 6f0b3565` exit `0`；focused run 后 `git status --short --branch` 仍无代码或 Git index 变化。
- `npm exec playwright test -- tests/e2e/logic-flow --list` exit `0`：Logic Flow collection 为 `115 tests in 8 files`；`playwright.config.ts` 的 `testDir` 为 `./tests/e2e`。同时确认 `tests/unified-e2e/` 不存在，legacy E2E 原件仍有 30 个文件。
- focused command：`npm exec playwright test -- tests/e2e/logic-flow/logic-flow-bug-regression.spec.ts --grep "isolated middle node|same ware can coexist|default hullparts auto node|Teladi hullparts replaces"`。Playwright 自动执行 fresh `npm run build`，Vite build 成功、Chromium 正常启动，结果 `4 passed (15.8s)`：
  - isolation/T0：`isolated middle node keeps isolation and stops upstream preview` passed；
  - Auto promotion：`default hullparts auto node promotes through a real drop` passed；
  - Replace：`Teladi hullparts replaces a default auto node` passed；
  - 双 lineage/SVG：`the same ware can coexist across two selected lineages` passed。
- 现行规范依据：`openspec/specs/logic-flow-operation/spec.md` 要求 Auto 投放后转正、isolation 分支停止上游/T0 预览、drag 状态和模块名/i18n/lock/cancel 行为；`openspec/specs/logical-flow-planner/spec.md` 要求 moduleId 物理隔离、不同 lineage 同 ware 并存及正确模块名。历史链 `c372dfef` / `6cdf704b`（lineage）与 `0096a89b` / `a3a108a8` / `e5e75eca`（operation/spec 合入）和现行文档一致；本轮 test delta 没有改写产品语义。
- 上一报告 commit `30e1de6b` 所载 3 个 blocking finding 均已关闭：
  1. Replace 从 fresh `weaponcomponents -> default auto hullparts` 直接切 Teladi；不再先把 auto 转为 manual。helper 在 release 前确认 active drag、目标 group identity、current `replace` status、`Replace` 标签与蓝色 hover；release 后确认数量仍为 1，且节点精确为 `source: manual`、`lineage: teladi`、`module_tel_prod_hullparts_01`。
  2. SVG 检查把两个 Hull Parts source 与 Weapon Components target 全部转换为所属 SVG 相对坐标，逐 source 校验 path 的精确起止点；同时先验证两节点的 default/Teladi moduleId、模块名与共同 target。
  3. isolation/T0 使用真实链：default Hull Parts 输入 `graphene + refinedmetals`，Refined Metals 输入 `ore`。UI 创建并隔离 Hull Parts 后，active drag Refined Metals 到 exact group，release 前确认 current `locked` hover、`ore` 正向 preview 可见且 isolated Hull Parts 独有的 `graphene` 分支不出现；release 后 Hull Parts 仍 isolated，Refined Metals 数量 `+1` 且新增 manual/default/moduleId 精确匹配。
- `x4-drag-test` guardrails：`tests/e2e/logic-flow/**` 所有 `page.mouse.move` 均带 `steps`；未发现 `dragTo`、native `dragstart/drop`/`DataTransfer`；`page.evaluate` 仅用于 fixture/localStorage setup、只读 UI/store 状态或 SVG 几何读取，没有模拟拖拽或写业务状态。shared helper遵循 pointer down → active drag → exact target hover/status → release → exact postcondition。
- 未受 candidate delta 影响的既有覆盖仍有效：5.1b 在 exact leave 后确认 `hoveredGroupId === null`，release 后完整 groups/nodes 不变；candidate lock toggle 通过 UI 创建 locked/unlocked groups；language case通过 UI 切换并检查候选区与节点文本；existing compact node、preview、新组 header/ghost 与双 lineage case均检查模块名。上一轮 fresh Chromium 证据已通过这些项，本轮未重复扩大运行范围。

Findings:

无 blocking finding。

- `test-owned`：上一轮 Replace setup、SVG 坐标系、isolation/T0 弱因果断言均已由本 candidate 在测试路径内修复并通过 focused closure。
- `stale`：旧 `.isolated` CSS、drag-flag-only 5.1、locked-leave 反向样式断言此前已删除/替换；本轮无新增 stale blocker。
- `driver/environment`：本轮为零；fresh build、preview 与 Chromium 均成功。Browserslist 数据陈旧及 chunk-size 信息只是 warning，不影响本次证据。
- `product bug`：本轮为零。四个场景均完成 truthful UI setup、真实 mouse drag、active 状态、exact target hover/current status、release 与 exact postcondition，观察结果与现行规范一致，没有“稳定相反”的产品行为。

Verdict:
`passed`

Changes:

接受 immutable candidate `6f0b3565` 对 `task-test-4` 上一轮 3 个 test-owned finding 的修复。最小下一步是由 dispatcher 恢复 `task-test-4` 后续 gate；无需修改 `src/**`、无需再改这四个 case、无需创建 BUG artifact。本次按要求未运行完整 suite。

Caveats:

- 未运行 `npm run test:e2e`，因此不声称完整产品 E2E suite 已通过；本 verdict 仅绑定 candidate、Logic Flow collection、四个 focused case及未受影响的上一轮定向证据。
- 以后若出现 browser launch、preview、driver、端口或 runner 失败，只能记录为 unavailable environment evidence，不能据此误报产品 BUG；只有 truthful UI setup + active drag + exact hover/leave + current status + exact postcondition 后仍稳定相反，才具备 product-bug 分类依据。
- 除本 reviewer artifact 外，未修改代码、测试、fixture、Git index、commit、branch或 workflow state。
