# M5.1 拖放反馈迁移

本轮基线为 `d590ede41d41913ab18f5c5a18247bf956a4685a` 加 ENV 共享配置；工作目录 `/home/slepher/project/x4-station-calculator`。旧 integrate 分支、旧候选通过叙述不作为当前验收。产品 T0 修复已在当前基线，本轮未改 src。

## 旧编号到当前验收

| 编号 | 当前行为与真实用户动作 | 独立 expected / 新用例 |
| --- | --- | --- |
| 4.1 | 从 clean 画布拖 hullparts 到新建区，保持悬停再释放 | 模块名称为 Hull Part Production；header 精确为 methane、ore；一个可见 phantom；释放后一个组、default/manual/module_gen_prod_hullparts_01；同编号用例 |
| 4.2 | siliconwafers 建组；依该 manual ware 找唯一 groupId；microchips、hullparts 逐次悬停并投放 | locked 琥珀反馈；原 header 仅 silicon；新增 pulse 精确 methane、ore；两个投放产物均为各自固定 module_gen_prod_*_01、default/manual；同编号用例 |
| 4.5 | scanningarrays 建组；microchips 投放到该 groupId；再次拖 scanningarrays 到新建区 | scanningarrays 输入为 refinedmetals/siliconwafers，microchips 为新加入 locked 状态；现有组 microchips 为固定模块/manual；新建后两个不同 groupId 且保留原组，各组 scanningarrays 为固定模块/manual；同编号用例 |
| 4.6 | 分别真实按下、移动、释放 Ore 与 Energy Cells；合法 siliconwafers 拖放；已有组中重复两项禁止操作 | 两张禁拖卡均 draggable=false、无 +；按住及释放均无 Sortable chosen/ghost/drag、compact hidden、store drag 状态全 idle、完整 groups/nodes 不变；普通卡初始 draggable=true、有 + 和资源预览，真实成功建组；同编号扩展用例 |
| 4.7 两方向 | refinedmetals/siliconwafers 按不同顺序建同组；拖已手动存在的合法产物到该组显示紧凑视图 | duplicate 红框和标签；header 精确为 ore→silicon 或 silicon→ore；释放完整 groups/nodes 不变；保留两个独立同编号用例 |
| 4.16 | UI 关闭候选锁，siliconwafers 建组；UI 选择农业/Teladi；spaceweed 拖入该 groupId | normal 蓝框；仍一个组；spaceweed 恰为一个 module_tel_prod_spaceweed_01、teladi/manual 节点；同编号用例 |
| 4.17 | UI 开启候选锁，siliconwafers 建组；同样农业/Teladi 拖 spaceweed | rejected 红框、禁止标签、零 phantom；释放完整 groups/nodes 快照不变，spaceweed 节点为零；同编号用例 |

fixture 沿用 `setupLogicFlow(page, 'clean')`：db.json 副本排除 vsn；明确 8.0 与 x4_logic_flow_plans；reload 后通过 language-select 设中文，再点击 Logic Flow。seeded 入口保持兼容，未改 fixture 原件。

## 失败分类与修正

- 本轮 baseline：8 collected，3 passed / 5 failed / 0 skipped，exit 1。4.6 把 v-show 隐藏节点错误认成应不存在，是 test-owned；4.7 两方向和 4.16/4.17 用禁止拖拽的 Energy Cells 触发操作，是 stale，不是新的产品缺陷。
- 第一次迁移 candidate：5 passed / 3 failed / 0 skipped，exit 1。4.5 手写的 auto 预期不正确：静态 8.0 modules.json 显示 scanningarrays 并不依赖 microchips，应为 locked 新增。4.7 两方向被 helper 的原生 draggable=true 前置阻断：Sortable 在释放时重置该属性，源码 node_modules/sortablejs/Sortable.js 的 _disableDraggable 与本轮 trace 的 is-draggable-tier/data-draggable=true 证明此为 test-owned 生命周期预期错误。改以候选可拖样式与实际 chosen/store/compact 激活证明，普通初次拖放仍验原生属性。
- corrected focused：8 passed / 0 failed / 0 skipped，exit 0。稳定复验与 bounded consumers 的最终结果见本轮 results/M5.1.md。

## helper 边界

`dragWareToTarget` 保留原参数和 numeric target 兼容。groupId 先解析到确切现有组；不存在立即报错。owned spec 只用 groupId；`getGroupIdForWare` 要求唯一 manual ware 所属组，多个候选会报错。

helper 不再调用 getWareGroupStatus/findModuleForWare 来生成 expected，不使用 fallback。提供 expectedStatus 时验证对应 UI；未提供时仅执行真实鼠标与通用生命周期，业务断言由调用 spec 承担。模块/血统预期在 owned spec 使用固定游戏数据常量。rejected/duplicate 的完整 groups 快照只作为不变性 oracle。返回 sourceBox/targetBox/targetLocator，未有消费者读取旧 effectiveLineage 字段。

所有 helper 调用点已扫描：compact-drag-view、interaction、bug-regression、new-feat、plans、ui-adjust，以及两个 owned spec；startWareDrag/attemptWareDrag 消费者为 interaction。其他消费者的旧 Energy Cells 操作、groups[0] 与缺独立业务断言仍由后续合同处理，本轮不宣称全体消费者迁移完成。

## 可复现命令与日志

以下各浏览器命令使用 `PORT=22251`、正常 `chromiumSandbox: true` ENV preview 配置，按精确命令经 sandbox escalation 执行；未绕过 Chromium sandbox。

```bash
PORT=22251 npm exec playwright test -- --config=/tmp/x4-test-migration-env/preview-only.config.ts tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts --project=chromium --workers=1 --retries=0 --trace=on --output=/tmp/x4-migration-M5.1/focused
PORT=22251 npm exec playwright test -- --config=/tmp/x4-test-migration-env/preview-only.config.ts tests/e2e/logic-flow/logic-flow-drag-feedback.spec.ts tests/e2e/logic-flow/logic-flow-incompatible-drag.spec.ts --list --reporter=list
```

`/tmp/x4-migration-M5.1/{baseline,candidate,focused}.log` 与同名结果目录保留全部对应 trace.zip/error-context。collection.log：exit 0，8 tests / 2 files。本轮仅测试变更，复用 ENV 验证构建；未运行 build-rust。
