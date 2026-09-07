# unified-test-repair 当前失败汇总

- 日期：2026-09-05
- 当前 target：`develop`
- 当前 HEAD：`d590ede4`
- 范围：generation-5 合并候选后的未关闭问题
- 状态：未将任何失败改写为通过；失败只阻塞自身及依赖闭包

## 已合入但仍未关闭的迁移问题

| 任务 | 当前问题 | 归属 / 恢复条件 |
|---|---|---|
| task-test-1.1 | 新旧归档没有稳定证明同 GUID 下 newer invalid、older valid；初始项已经 active，点击没有证明选择事务；兼容性和站点恢复 witness 不完整。helper cross-consumer 有 2 项失败。 | 测试归属 task-test-1.1；cross-consumer 两项分别返回 task-test-2.1 与 task-test-3.1；修正独立初始状态、双向选择、兼容性和 archive-derived records 后重跑 focused、collection、build、diff 与 cross-consumer。 |
| task-test-5.1 | `v-show` 常驻节点错误使用 `toHaveCount(0)`；Energy Cells 仍作为合法拖拽输入；使用 `groups[0]`；期望状态由被测函数推导；helper 有 fallback。 | 测试归属 task-test-5.1；改用可见性、Sortable、store 和 groups/nodes 不变 oracle，改用合法产物和明确 group identity。Ore / Energy Cells 产品签名需在测试 oracle 修正后重跑。 |
| task-test-7.1 | 未证明默认空 empire 与 `activeStationId === null`；删除没有完成确认和 ID 消失验证；排序期望冲突；保存/reload 身份和 smart-save witness 不完整；存在旧 locator、弱断言和 fallback。 | 测试归属 task-test-7.1；修正状态、身份、删除、排序和持久化断言后重跑 27 项 focused、build 和 diff。 |
| task-test-8.1 | 旧 map locator、缺少当前 IndexedDB archive、条件式通过；Cluster ID 大小写错误；搜索 helper 覆盖输入；tooltip 断言自比较、元素范围和拖拽路径不稳定。 | 测试归属 task-test-8.1；恢复当前 fixture 和稳定锚点，逐场景保留独立 expected 后重跑完整 46 项集合。 |
| task-test-8.2 | 多数断言只证明存在 candidate/score/panel，未精确验证 resource、hub、set、score、jump、pie、focus；存在条件式通过、旧 locator、uppercase ID 和不可达 postcondition。 | 测试归属 task-test-8.2；补齐精确行为 oracle，稳定 runner 后重跑 focused、collection、build 和 diff。 |
| task-test-8.3 | 使用旧大写 Cluster ID、可空通过的 count 断言、弱 gate/resource/address/search/reload oracle 和旧 locator；map-DLC witness 未完成。 | 测试归属 task-test-8.3；确认当前 accepted map-DLC witness 后重跑 20 项 focused 并逐项重新分类。 |
| task-test-13.1 | fixture 缺少版本 key，当前运行时读取 `x4_logic_flow_plans_v9`；logic-flow 选择不确定；缺少 `graph === null`、`sccGroups === []` 等边界断言；迁移文档和执行证据不完整。 | 测试归属 task-test-13.1；通过 UI 或当前版本 fixture 确定性选择有效 logic-flow，补齐边界 oracle、migration mapping、list、build、diff。 |
| task-test-14.1 | 未通过 UI 选择有效 logic-flow；3.3 无法到达 build-material details switch；模块、材料、时间、重叠生产去重和 `totalCredits` 断言不精确。 | fixture/setup 或公开路由待确认；不得弱化 3.3；恢复可达路径后重跑 6 项 focused、collection、build、diff。 |

## 尚未完成的独立任务

| 任务 | 当前问题 | 分类 |
|---|---|---|
| task-test-10.1–10.5 | baseline、preview 端口和 runner 交接不完整；部分执行被中断或无法启动。 | `incomplete/unavailable handoff`，未建立产品失败或通过 |
| task-test-12.1 | 候选阶段曾删除约 361 行代码，已恢复；候选 focused、list、build、diff 未完成。 | `incomplete/unavailable handoff` |
| task-test-15.1–15.4 | runner 中断，部分场景未执行，无法形成完整失败分类。 | `incomplete/unavailable handoff` |
| task-test-16.1 | 仍使用不存在的 `9.0::beta` 和过期的 8.0 storage 预期。 | test-owned stale assumption |
| task-test-16.2 | 首个失败后中断，剩余场景没有完整证据。 | `incomplete/unavailable handoff` |

## 已确认的产品签名

task-test-5 的历史 focused witness 确认：

- Ore 真实 pointer 后进入 Sortable `sortable-chosen sortable-ghost`，违反 raw T0 禁止拖拽。
- Energy Cells 出现 `draggable=true` 和 quick-add button，并可启动真实拖放，违反 Energy Cells drag restriction 与 quick-add hidden。

对应产品修复已在当前 `develop`。修复后的产品状态仍需在 task-test-5.1 测试 oracle/setup 修正后重新验证；当前其他失败不能直接归为产品缺陷。

## 环境证据

已多次观察到 `ERR_CONNECTION_REFUSED`、preview/webServer 不可用和 Chromium 沙箱启动失败。此类结果只记录为 evidence unavailable，不计为测试通过，也不自动归类为产品失败。恢复条件是使用可启动的 preview/runner，按任务合同重新执行 focused、collection、build、`git diff --check`，并保留逐用例结果与 trace。

## 证据来源

- `task-test-1.1-review-1.md`、`task-test-1-report-1.md`
- `task-test-5.1-review-1.md`、`task-test-5-report-1.md`、`task-test-5-report-2.md`
- `task-test-7-report-1.md`
- `task-test-8-report-1.md`、`task-test-8.3-report-1.md`
- `task-test-13-report-1.md`、`task-test-14-report-1.md`
- `status.md`、`status-integrate.md`
