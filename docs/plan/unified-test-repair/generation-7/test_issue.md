# Generation 7 E2E 测试问题汇总

## 审查结论

reviewer 对 T010 全量 E2E 的 9 项失败进行了只读核查，结论为 `changes-required`。

9 项均不是页面 `class` 或 `id` 写错。`.confirm-popup`、`preview-section`、`flow-plan-menu-item-logic-flow-1` 以及地图候选 locator 都能准确反映页面状态；失败来自测试时序、fixture/版本、持久化迁移、文案断言或 CSS transition 采样。

完整运行结果：824 项，815 passed，9 failed，0 skipped。Unit 全部通过。原始结果见 [T010-A1](results/T010-A1.md)，独立审查见 [T010-A1-review](results/T010-A1-review.md)。

## 失败明细

| 编号 | 测试 | 分类 | 现象与根因 | 责任/处理方向 |
|---|---|---|---|---|
| 1 | `auto-sector-group-one-core` confirm/reload | 测试时序 | `.confirm-popup` 已正确命中。第一次点击外层“确定”只打开二次确认，测试直接断言弹窗隐藏，未点击弹窗内部主按钮。 | 未授权范围。继续点击 `.confirm-popup` 内精确的“确定”按钮。见 [spec](../../../../tests/e2e/auto-sector-group-one-core/auto-sector-group-one-core.spec.ts:61) 和 [presenter](../../../../src/components/empire/presenters/useAutoSectorGroupPresenter.ts:1361)。 |
| 2 | `build-flow` reload persistence | 断言过严 | 实际只持久化正确的 `assignments`；测试额外要求可选字段 `archivedGroupIds: []` 必须存在。归一化逻辑会省略该空字段。 | T008。断言运行态归档数组和 assignments，不要求可选空字段出现在 JSON 中。 |
| 3 | `build-flow` archive persistence | 产品持久化问题 | 归档后内存状态为 `['lf-1-g1']`，Save/reload 后变成 `[]`。保存逻辑写入该字段，但迁移逻辑没有保留它。 | T008 不能修改 `src`。交 planner/product decision；不能仅修改测试 expected 掩盖数据丢失。见 [useLogicFlowStore.ts](../../../../src/store/useLogicFlowStore.ts:1128) 和 [stateMigrations.ts](../../../../src/store/logic/stateMigrations.ts:295)。 |
| 4 | `build-plan-compute` material steps | Fixture/版本 | `flow-plan-menu-item-logic-flow-1` 是有效 testid，但失败时页面运行版本为 9.0，菜单只有“无规划”。测试注入 8.0 fixture，却没有固定游戏版本，页面读取 9.0 storage key。 | T008。固定 `8.0/beta:false` fixture/版本后继续使用现有 testid；无需改 locator。 |
| 5 | `build-plan-goal` case 2.5 | 测试时序 | 删除 PLAN_2 后菜单仍打开；再次调用 `openPlanMenu()` 触发 toggle，将菜单关闭，随后才等待菜单可见。 | T008。让 helper 感知当前打开状态，或让删除 helper 明确建立菜单关闭后的状态。 |
| 6 | `build-plan-goal` case 3.3 | 测试时序 | 与 #5 相同。第一次删除后菜单保持打开，第二次删除流程再次调用 `openPlanMenu()`，反而将菜单关闭。 | T008。与 #5 共用同一个 helper 修正；testid 正确。 |
| 7 | `build-plan-goal` case 3.10 | 文案断言过期 | `preview-section` 正确命中。当前 locale 和组件显示 `Unplanned Line`，测试仍期待 `Unmatched`。 | T008。断言当前文案，最好限定到 unmatched group header。见 [locale](../../../../src/locales/en.json:68) 和 [component](../../../../src/components/empire/PreviewLinePlanSection.vue:96)。 |
| 8 | `logic-flow/ui-adjust` hover | CSS 断言/transition | “没有 + 按钮”相关 locator 和断言通过。失败的是颜色等值断言：期望 `rgba(255, 255, 255, 0.05)`，trace 采样到 `rgba(255, 255, 255, 0.008)`，属于 hover transition 中间值。 | 未授权范围。删除与用例目的无关的精确颜色断言；若必须测样式，应等待 transition 完成后断言最终状态。 |
| 9 | `map/advanced-resource-filter` simple mode | Fixture/版本 | 地图候选 locator 正确命中 9 个元素，但测试期待的是另一版本的候选 ID。测试未固定游戏版本，当前页面运行 9.0 数据。 | 未授权范围。先固定版本，再按该版本独立计算候选 expected；不能直接把本次 9.0 输出抄进断言。 |

## 归属与验收状态

- T008 负责 #2、#3、#4、#5、#6、#7。
- #1、#8、#9 不在本代 T008 写权限内，应由 planner 指定对应 owner。
- #3 是唯一已确认涉及实际数据持久化丢失的项目，需要产品/规划决定是否修复迁移逻辑。
- 其余项目不能通过更换 class/id 来解决；应修正测试动作、固定 fixture/版本或更新过期断言。
- 完成有界修正后，先运行对应 focused suite，再重新冻结候选并执行一次完整 canonical E2E。

