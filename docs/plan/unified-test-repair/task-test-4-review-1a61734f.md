Status:
changes_required

Task:
`unified-test-repair` generation-2 `task-test-4` correction review；范围仅 `tests/e2e/logic-flow/import-logic-flow.spec.ts` 的 10 条 fresh-build focused failure。

Reviewed commit:
`1a61734f542007e511c542e6edfdef0cf85262b9`（parent `edfa4dc54613db48cafef94ad3e29bb795791132`）

Evidence:

- candidate 是 immutable single-parent commit，且只修改 `tests/e2e/logic-flow/import-logic-flow.spec.ts`；`git diff --check edfa4dc5 1a61734f` 通过。
- candidate 已完成上一轮要求的 v3 `{ module }` / `{ isolated }`、canonical `module_gen_prod_*_01`、`blueprint-import-strategy-modal`、`moduleActions` dirty seam，并删除已识别的旧 store/API/几何/optional-return。当前 fresh-build focused 证据为 `34 tests: 24 passed / 10 failed`，无 page error。
- 失败快照显示 `2.0` 停在 Blueprint Recipe 子页，`2.1` 实际打开的是“导出数据”modal；它们没有到达测试声称的 overview / flow-load 上下文。candidate 在语言切换后立即大量使用 `{ force: true }`，且没有先断言顶层 view 与 workbench mode，不能据此认定入口或 LoadFlow 产品缺失。
- `ImportPlanModal.vue` 的 station import 分支先设置 `showWarningModal = true`，随后调用 `handleClose()`；后者同步把 `showWarningModal` 设回 `false`。dirty empire import 中 `SmartSaveDialog` 又依次 emit `submit-import` 与 `close`，`handleEmpireImportDialogClose()` 随后调用同一个 `handleClose()`。因此三条 warning failure 是确定性的产品生命周期错误，不是 Playwright 时序漂移。
- `useToolbarWorkflowController.ts` 的 blueprint-production import 先调用 `executeNew()`；当前 `executeNew()` 使用 `createEmpire('', newStationName)`，先创建一个默认站，再由 `executeEmpireImport()` 为每个非空规划区建站。OpenSpec 明确要求 empire 全量导入“每个非空规划区创建一站、空规划区跳过”，历史实现的 import reset 创建空帝国。因此单一非空组得到 2 站是产品回归，测试期望 1 合约成立。
- `2.20` 只证明 clean empire import 后 `import-view-modal` 仍存在。现行 OpenSpec只要求不弹 SmartSaveDialog并直接执行导入，没有规定执行后该 modal 必须在该 DOM 时点关闭；历史 `executeEmpireImport()` 同样不主动关闭选择 modal。该断言不构成产品 BUG。

Findings:

| # | focused failure | 归属 | 结论与最小 correction owner | focused closure |
|---:|---|---|---|---|
| 1 | `2.0 测试启动与数据预置` | test-owned / wrong page context | 快照停在 Blueprint Recipe；`ensureEmpireOverview()` 没有先确保 `blueprint-production`，并用 force click 后直接等待入口。Owner：task-test-4 test worker；仅改该 spec 的导航 helper。 | 正常点击 `top-view-btn-blueprint-production` 并断言 active，再点击 `sidebar-overview` 并断言 overview toolbar；随后分别验证 empire/station entry。 |
| 2 | `2.1 Logic-Flow 主界面数据可用性` | test-owned / forced-click timing and ambiguous action | 快照显示“导出数据”modal，不是 LoadFlow modal；失败未证明当前 load modal 缺失。Owner：test worker。 | 去掉 force，点击稳定 `toolbar-load-btn`；先断言 `top-view-btn-flow` active，再断言 heading `planning.load_flow_plan` 与两方案可见并完成两次加载。 |
| 3 | `2.5 保存并导入` | product-owned | import reset 先创建默认站，随后为一个非空组再建一站，故实际 2。Owner：最小 coding correction，`src/composables/useToolbarWorkflowController.ts`；import reset 应创建空 empire，不能改变普通 New 的默认站行为。 | 保存并导入 mixed plan 后恰有 1 个站，模块来自唯一非空组；saved baseline 已先保存，且无额外空站。 |
| 4 | `2.5 放弃并导入` | product-owned | 与 #3 同一根因。Owner 与允许路径同 #3。 | 放弃并导入后同样恰有 1 个站；旧 dirty 内容不残留。 |
| 5 | `2.7 空规划区 warning` | product-owned | warning 已由 mapping 生成，但 SmartSave submit 后的 close 回调调用 `handleClose()` 将其清除。Owner：最小 coding correction，`src/components/empire/ImportPlanModal.vue`。 | mixed empire import 后单个 warning modal 可见，包含 empty-group skipped；确认 warning 后流程可正常收口。 |
| 6 | `2.8 非-container isolated warning` | product-owned | station strategy handler 设置 warning 后立即 `handleClose()`，同步清掉 warning。Owner 与允许路径同 #5。 | overwrite 后 `ore` 不进入 `lockedWares`，且单个 warning modal 显示 non-container ignored。 |
| 7 | `2.17 导入逻辑无变化 warning` | product-owned | 最终 empire warning 路径与 #5 相同；前两段 canonical module 聚合已通过到达该断言。Owner 与允许路径同 #5。 | overwrite/new 模块结果保持 canonical ID，随后 empire mixed import 的 skipped warning 可见。 |
| 8 | `2.20 import-view-modal count 0` | test-owned / expectation not in contract | OpenSpec只约束“不弹 SmartSaveDialog + 直接执行”，不约束选择 modal 立即卸载；历史实现也保留 modal。Owner：test worker。禁止为此单独改产品关闭时序。 | 改为断言无 SmartSaveDialog及导入结果；测试继续导航前显式关闭 import modal。 |
| 9 | `3.3 ensureEmpireOverview` | test-owned / modal lifecycle contamination | 关闭 SmartSaveDialog 只关闭内层 dialog，外层 import modal 仍在；测试随后用 force click 操作被 overlay 覆盖的 Sidebar。Owner：test worker。 | 每个子场景结束显式关闭 `import-view-modal`，或拆成隔离 case；之后用正常 click 切 overview 并断言 context。 |
| 10 | `3.18 ensureEmpireOverview` | test-owned / modal lifecycle contamination | clean import 后外层 modal 按当前返回时序保留，后续 scenario 未清场即在其下导航。Owner：test worker。 | clean/dirty 两场景间显式关闭 modal或拆 case；两状态分别只断言 New/Import 的 SmartSave 判定一致。 |

归属汇总：`test-owned = 5`（#1、#2、#8、#9、#10），`product-owned = 5`（#3-#7），但产品项仅对应 2 个根因；`context-blocked = 0`。

Verdict:

`changes_required`。candidate 已关闭上一轮 fixture/API/strategy/dirty seam 主问题，但 focused suite 仍被 5 个测试上下文/时序问题和 2 个已确认产品根因阻塞。不得把 #1、#2、#8-#10 升级为产品 BUG，也不得把 #3-#7 改成迎合现状的测试期望。

Changes:

1. Coding correction A：仅修 blueprint-production 的 import reset，使其创建空 empire；保留普通 New 创建默认站、SmartSave 判定复用、导入后不自动保存。
2. Coding correction B：仅修 `ImportPlanModal` warning/close 生命周期，保证 warning 在导入完成后可观察；保留统一 strategy dialog、mapping 与 warning 内容。
3. Test correction：仅在 `tests/e2e/logic-flow/import-logic-flow.spec.ts` 修正 5 条 test-owned 场景；使用稳定 testid、正常 click、显式 view/context assertion 与 modal cleanup，不再靠 force click 穿透 overlay。
4. Focused closure：fresh build 运行该单文件，34/34 passed、无 page error；并单独确认两条 2.5 均为 1 站、三条 warning modal 可见、2.20 以“无 SmartSave + 导入结果”而非未约定的 modal count 收口。

Caveats:

- 按用户要求停止继续探索；本轮没有重跑 Playwright，也未扩展到全量 E2E。运行结果采用 assignment 提供的 fresh-build 精确证据及当前 `test-results/**/error-context.md`。
- `2.0` / `2.1` 的具体错击触发机制没有额外复现实验；已确认的是失败快照处于错误页面/modal，故只裁定 test-owned context/timing，不声称某个浏览器事件机制已被唯一证明。
