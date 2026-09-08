# Generation 6 · T011-A2 定向 planner 决策

- Role: planner
- Requested baseline: generation-6 Revision 5
- Actual input plan revision: 6（已发布 T017 amendment，保留）
- Published plan revision: 7
- Affected contract: T011 Revision 2 → 7
- Status: amendment_published
- Planning disposition: UI能力缺失/不实施伪造事务；Unit 子交付可执行，原 1.3.5 未完成
- Returns to: dispatcher → T011 Unit → dispatcher 核对 → planner 处置 UI 缺口 → T025
- Runtime adoption/acceptance: 由 dispatcher 记录；本结果不代行

## 裁决与证据充分性

[T011-A1](T011-A1.md)、[A1 facts](../evidence/T011-A1/facts.md)、[T011-A2](T011-A2.md)及[A2 facts](../evidence/T011-A2/facts.md)足以支持按合同交回“UI能力缺失/不实施伪造事务”。这是一项基于当前候选的有界静态结论：已核实的公开路径不能形成合同要求的两个有效不同身份并保持固定工作台；不是声称已执行失败的 E2E，也不是对一切未来入口的不可达证明。

关键事实已直接核对：

| 路线 | 当前证据与含义 |
| --- | --- |
| 显式 sidebar station/transit | `ProductionSidebar.vue:241–276` → `useProductionSidebarPresenter.ts:223–240` → Live Vue 事件绑定；`useLiveProductionStore.ts:1925–1950` 先关闭固定模式再赋 identity。这是真实公开对照路径，但本轮没有运行其 UI 对照，不能冒充自动事件。 |
| 自动删除回退 | Live store `1903–1918` 只在删除的 ID 等于 activeStationId 时回退；`1977–1980` 进入 auto-sector-group 已清空 identity，故不能从这个初态得到 A→B。 |
| 归档切换/删除 | `702–745` 切换只重载 records/flow/draft；删除时无有效归档则清空 binding，有效归档则重新 activateBinding；`2079–2150` 校验身份只保留原值或清空，不建立两个不同有效身份。 |
| 其余 identity writer | `1847–1886` update plan、`2055–2075` save plan 的 ID 替换要求当前选中 ID 匹配，auto 入口清空后不满足。`1888–1901` 的 createStation 能写 ID，但 Live capabilities `2211–2213` 为 uniqueStation，sidebar presenter `214` 禁止创建，`2617` duplicateStation 返回 null。这些已核对路径没有新增合格 witness。 |
| transit 派生 | Live store `749–752` 将 activeStationId 转发到 activeBindingStation setter；`873–876` 经 `empireSourceView.ts:184–193` 派生 transit，只解析当前 `transit:<id>` 并验证 sectors 成员。sector 集合变化可令其为 null，不能在不换 tab identity 时由 sector A 自动变为 sector B。 |
| Unit 保护边界 | `useActiveViewStore.ts:112–123` 的 setter 在 auto-sector-group 固定模式保持 workbench；当前 `activeViewStore.spec.ts:14–24` 只有单次 station 写入与 workbench 持久化断言，尚无两个身份或 transit 派生证据。 |

本次对 A2 已列出的八项源码/Unit/旧 sibling spec 指纹进行有限复核，全部相同：`useActiveViewStore.ts`、`useLiveProductionStore.ts`、`useSaveStore.ts`、`ProductionSidebar.vue`、`useProductionSidebarPresenter.ts`、`LiveProductionWorkbenchView.vue`、现有 active-view Unit、旧 16 项 spec。输入指纹继续引用 A2 facts，不重建全仓 manifest。

## 最小 amendment

唯一新增 Owned path：`tests/unit/current/active-view/activeViewStore.spec.ts`。同一个 T011 implementation owner 承接，不新增任务或测试文件，不授予源码/helper/config/fixture 写权限。当前阶段仅可写这个 Unit；原 focus spec path 保留但禁止创建/编辑。

精确测试范围由 [T011 Revision 7](../tasks/T011.md) 冻结：

1. U1 扩展原用例：auto-sector-group 下 `station-01` → `station-02`，每步证明准确 identity、固定 workbench 和对应持久化值，保留原 persistence 断言。
2. U2 同一 setter 的 `transit:sector-a` → `transit:sector-b`，每步证明 identity/workbench；固定两个合法 sectors，调用真实 `computeActiveTransitSectorId`，expected 独立写为 `sector-a`、`sector-b`，另证未知 sector 返回 null。直接复用纯函数，不 mock，不由算法生成 expected，不声称运行 Live watcher/浏览器。
3. U3 独立 overview 初态写 `station-01`，workbench 变 station，证明非固定模式回退仍有效。这是 setter 对照，不能替代原显式 sidebar UI 对照。

后续 owner 在仓库根目录执行 `env -u VITEST_SUITE npm run test:unit -- tests/unit/current/active-view/activeViewStore.spec.ts` 及该文件 `git diff --check`。要求整份 Unit 文件通过、保留既有用例、U1/U2/U3 无 failed/skipped，记录实际计数、命令/cwd/exit、候选和日志。无需 browser/build 或 full E2E；若失败需要源码或其他路径，带精确证据返回 planner。

这是追加 Unit 层补证，不是批准用 Unit 替代原 E2E。原 1.3.5 的自动 station/transit UI 事务、前后身份、保持的工作台和显式点击对照仍未完成。A2 结果末尾把“Unit boundary 冻结后”也接到“先创建真实 focus spec”的恢复措辞由本 amendment 澄清：本次 Unit 恢复只运行上述 Unit 命令，不创建 E2E；A2 原文保留。

## 出版、影响与恢复路线

修改前 [plan/tasks/decisions/summary 及 T011 原文](../revisions/revision-6/)已先留存；其中 plan 为 Revision 6，T011 为 Revision 2。新 plan 与 T011 均发布 Revision 7，[tasks.md](../tasks.md)、[D17](../decisions.md)、[summary.md](../summary.md)同步。用户给出的 Revision 5 是请求基线，未覆盖已存在的 Revision 6 T017 变更。

dispatcher 在交接点停止受影响的旧 T011 合同写入，显式换发 Revision 7，落实该 Unit 文件单 writer 并分配下一空闲 attempt/result/evidence。替换旧 Inputs 中退休 T004 和预留 T010-A1，消费真实 T007-A1/review、T010-A5、A1/A2 与本决策。Unit 子交付无新增依赖，Resources 为 []。其他任务按原合同继续，T014 Revision 5、T017 Revision 6、T010 Revision 3 均不回退。

T025 保持 Revision 4：其既有 Depends on T011 及实际 revision/attempt 绑定已能消费本次修订，不新增反向依赖。Unit 子交付通过后由 dispatcher 核对，再把仍缺 UI witness 的 T011 交回 planner；不得以此标 T011 全体完成、退休，或解除 T025 最终运行前置。完整 canonical E2E/build/Unit/diff 的最终验收不变。

公开 UI 阶段仅在出现具体合格事件、有效 A/B 初态和 workbench 锚点后，由 planner 冻结新合同恢复。若需新增产品入口，或最终将 Unit 视为原 UI 验收的替代，dispatcher 应携带当前证据取得相应授权；本次没有作出该产品/验收选择。已授权的 Unit 补证不等待此决定，没有新事实也不重复派发 A1/A2 的调查。

## 保留成果与验证界限

A1/A2 结果及各自 evidence 全部原样保留，包括 focus spec 不存在、无伪造 E2E、没有 browser/Unit 运行，以及 A2 原全 change 映射检查 exit 1 的历史缺失/重复/注释问题。旧 M2.1 16 项继续保留，不用新增 Unit 遮盖该映射失败。A1 的 T010-A1 当时不存在属于历史事实，不再当作当前恢复前置。

[T010-A5](T010-A5.md) 的 Unit 180 files / 1024 tests 全过、collection 843 tests / 74 files、smoke 6/6 均限于其冻结候选；它们不证明本次拟增 Unit 或缺失的 1.3.5，collection/smoke 也不等于完整 E2E。

本轮完成角色匹配、定向源码/合同核对、既有八项指纹复核和规划静态校验；只出版上述规划及本结果，未修改源码/测试/配置/status/旧证据/Git metadata，未运行 Unit/E2E/build，未派生 agent 或记录接受。按 Stop That Shit 保持本次规划边界；依 planner 协议，纯测试合同不加载产品 implementation-simplicity 标准。
