# M15.1 toolbar transaction migration

本轮合同：docs/plan/unified-test-repair/direct-migration/tasks/M15.1.md。仅 owned spec/本文档/results 修改，src/helper/config/base fixture 冻结。旧 46 个用例标题和顺序保留；无 skip/fixme/only。

## 前置与独立判定

- 普通 fixture：db.json 排除 vsn，生产/导入显式 8.0，船只显式 9.0 空蓝图列表，reload，UI language-select。Logic Flow 消费 M5.1 setupLogicFlow(clean) 和真实鼠标 dragWareToTarget。
- station 新对象通过 UI NEW 建立一个空站；非新对象先 UI SAVE 命名；dirty 由添加 Energy Cells 产生（已保存再修改为 count=2）。新、dirty 均读 store 精确断言，不写 store 模拟。保留基础帝国列表，暴露单空列表看不到的保存激活身份问题。
- Logic Flow clean 新方案无 group；通过真实拖放 Hull Parts 建立 dirty，保存后再拖 Quantum Tubes 产生已有对象 dirty。独立 manual 根集合是 hullparts / quantumtubes，非被测上游算法返回值。
- ship 通过 UI 选择大太刀，安装明确 Argon M Mk1 引擎；已有对象先 UI 保存，再装 Argon M Mk1 护盾产生 dirty。连接组 equipment_id/count 是独立预期。
- clean-new Logic Flow 和 ship 是真实可达空对象。原测试的伪造 activeId/plan state 不构成非空 clean-new；依据归档 toolbar-action2one spec 的空方案拦截优先规则，SAVE/SAVE_AS 验证 warning、无弹窗、无保存；未将其错误标作未保存非空 SaveAs。station 有站无模块是规范明确的非空特例，仍需 SaveAs。
- 保存验证 name/新旧 ID、旧记录不变、列表数量、dirty 清零、内容守恒、完整 localStorage 与 store 一致、reload 恢复相同 activeId/content。默认 NEW 验证 discard affordance、真实丢弃后全空、旧记录不变、无成功 toast。通知通过真实 UI close 隔离，动作成功消息严格计数。
- 导入 dirty 由 UI 添加 Energy Cells 建立；保存分支旧帝国落盘模块必须匹配修改前截取内容，放弃分支完整旧列表不变。导入结果 3 站 E1-S1/E1-S2/E1-S3 与显式 planned module 列表；弹窗及两个动作都消失。取消则完整业务状态不变。

## 规范依据

context-toolbar、title-as-plan-title、import-export 与 openspec/changes/archive/2026-03-09-toolbar-action2one/specs/toolbar-action2one/spec.md（统一 empty guard / 无 copy 后缀 / 未保存 SAVE→SAVE_AS / toast / 导入 SAVE→RESET→IMPORT）。新 binding/draft 规则下导入结果为当前规划草稿，旧帝国的 save/discard 持久化独立验证；不额外伪造导入后自动保存新帝国。

## 逐项映射

| 原编号与新用例（标题相同） | 当前用户动作与独立 expected |
|---|---|
| 2.1 状态: import-view-modal-open-on-empire | 总览 UI 导入入口→plan list 可见。 |
| 2.2 状态: empire-import-smartsave-open | 真实 UI dirty→选择 logic-flow-1→SmartSave 两动作可见、无名称输入，导入 modal 保持。 |
| 2.3 切换: empire-import-smartsave-open -> empire-import-finished-after-save | 保存并导入：旧帝国修改落盘；3 站显式模块；关闭 modal/SmartSave/两个动作；success=1。 |
| 2.4 切换: empire-import-smartsave-open -> empire-import-finished-after-discard | 放弃并导入：旧帝国列表完整不变；3 站显式模块；关闭 modal/SmartSave/两个动作；success=0。 |
| 3.1 Case: station-NEW-dirty-new | station，new / dirty真实 UI 前置；NEW：SmartSave + 丢弃并新建；清空当前内容与 activeId，旧列表不变，无 success。 |
| 3.2 Case: station-NEW-dirty-non-new | station，non-new / dirty真实 UI 前置；NEW：SmartSave + 丢弃并新建；清空当前内容与 activeId，旧列表不变，无 success。 |
| 3.3 Case: station-NEW-non-dirty-new | station，new / non-dirty真实 UI 前置；NEW：直接新建；清空当前内容与 activeId，旧列表不变，无 success。 |
| 3.4 Case: station-NEW-non-dirty-non-new | station，non-new / non-dirty真实 UI 前置；NEW：直接新建；清空当前内容与 activeId，旧列表不变，无 success。 |
| 3.15 Case: logicFlow-NEW-non-dirty-new | logicFlow，new / non-dirty真实 UI 前置；NEW：直接新建；清空当前内容与 activeId，旧列表不变，无 success。 |
| 3.16 Case: logicFlow-NEW-non-dirty-non-new | logicFlow，non-new / non-dirty真实 UI 前置；NEW：直接新建；清空当前内容与 activeId，旧列表不变，无 success。 |
| 3.27 Case: ship-build-NEW-non-dirty-new | ship-build，new / non-dirty真实 UI 前置；NEW：直接新建；清空当前内容与 activeId，旧列表不变，无 success。 |
| 3.28 Case: ship-build-NEW-non-dirty-non-new | ship-build，non-new / non-dirty真实 UI 前置；NEW：直接新建；清空当前内容与 activeId，旧列表不变，无 success。 |
| 3.25 Case: ship-build-NEW-dirty-new | ship-build，new / dirty真实 UI 前置；NEW：SmartSave + 丢弃并新建；清空当前内容与 activeId，旧列表不变，无 success。 |
| 3.26 Case: ship-build-NEW-dirty-non-new | ship-build，non-new / dirty真实 UI 前置；NEW：SmartSave + 丢弃并新建；清空当前内容与 activeId，旧列表不变，无 success。 |
| 3.29 Case: ship-build-SAVE-dirty-new | ship-build，new / dirty真实 UI 前置；SAVE：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |
| 3.30 Case: ship-build-SAVE-dirty-non-new | ship-build，non-new / dirty真实 UI 前置；SAVE：原 ID 覆盖修改，success=1，持久化与刷新恢复身份/内容。 |
| 3.31 Case: ship-build-SAVE-non-dirty-new | ship-build，new / non-dirty真实 UI 前置；SAVE：空保存 warning，无弹窗/写入/success。 |
| 3.32 Case: ship-build-SAVE-non-dirty-non-new | ship-build，non-new / non-dirty真实 UI 前置；SAVE：无写入，无 success，刷新恢复身份/内容。 |
| 3.33 Case: ship-build-SAVE_AS-dirty-new | ship-build，new / dirty真实 UI 前置；SAVE_AS：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |
| 3.34 Case: ship-build-SAVE_AS-dirty-non-new | ship-build，non-new / dirty真实 UI 前置；SAVE_AS：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |
| 3.35 Case: ship-build-SAVE_AS-non-dirty-new | ship-build，new / non-dirty真实 UI 前置；SAVE_AS：空保存 warning，无弹窗/写入/success。 |
| 3.36 Case: ship-build-SAVE_AS-non-dirty-non-new | ship-build，non-new / non-dirty真实 UI 前置；SAVE_AS：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |
| 3.37 Case: import-open-empire-entry | 真实 UI dirty→选择 logic-flow-1→SmartSave 两动作可见、无名称输入，导入 modal 保持。 |
| 3.38 Case: import-save-path-close-modal | 保存并导入：旧帝国修改落盘；3 站显式模块；关闭 modal/SmartSave/两个动作；success=1。 |
| 3.39 Case: import-discard-path-close-modal | 放弃并导入：旧帝国列表完整不变；3 站显式模块；关闭 modal/SmartSave/两个动作；success=0。 |
| 3.40 Case: import-open-and-close-without-submit | 打开导入后取消：modal 消失，完整业务状态未改变。 |
| 3.41 Case: import-save-path-hide-actions | 保存并导入：旧帝国修改落盘；3 站显式模块；关闭 modal/SmartSave/两个动作；success=1。 |
| 3.42 Case: import-discard-path-hide-actions | 放弃并导入：旧帝国列表完整不变；3 站显式模块；关闭 modal/SmartSave/两个动作；success=0。 |
| 3.5 Case: station-SAVE-dirty-new | station，new / dirty真实 UI 前置；SAVE：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |
| 3.6 Case: station-SAVE-dirty-non-new | station，non-new / dirty真实 UI 前置；SAVE：原 ID 覆盖修改，success=1，持久化与刷新恢复身份/内容。 |
| 3.7 Case: station-SAVE-non-dirty-new | station，new / non-dirty真实 UI 前置；SAVE：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |
| 3.8 Case: station-SAVE-non-dirty-non-new | station，non-new / non-dirty真实 UI 前置；SAVE：无写入，无 success，刷新恢复身份/内容。 |
| 3.9 Case: station-SAVE_AS-dirty-new | station，new / dirty真实 UI 前置；SAVE_AS：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |
| 3.10 Case: station-SAVE_AS-dirty-non-new | station，non-new / dirty真实 UI 前置；SAVE_AS：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |
| 3.11 Case: station-SAVE_AS-non-dirty-new | station，new / non-dirty真实 UI 前置；SAVE_AS：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |
| 3.12 Case: station-SAVE_AS-non-dirty-non-new | station，non-new / non-dirty真实 UI 前置；SAVE_AS：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |
| 3.13 Case: logicFlow-NEW-dirty-new | logicFlow，new / dirty真实 UI 前置；NEW：SmartSave + 丢弃并新建；清空当前内容与 activeId，旧列表不变，无 success。 |
| 3.14 Case: logicFlow-NEW-dirty-non-new | logicFlow，non-new / dirty真实 UI 前置；NEW：SmartSave + 丢弃并新建；清空当前内容与 activeId，旧列表不变，无 success。 |
| 3.17 Case: logicFlow-SAVE-dirty-new | logicFlow，new / dirty真实 UI 前置；SAVE：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |
| 3.18 Case: logicFlow-SAVE-dirty-non-new | logicFlow，non-new / dirty真实 UI 前置；SAVE：原 ID 覆盖修改，success=1，持久化与刷新恢复身份/内容。 |
| 3.19 Case: logicFlow-SAVE-non-dirty-new | logicFlow，new / non-dirty真实 UI 前置；SAVE：空保存 warning，无弹窗/写入/success。 |
| 3.20 Case: logicFlow-SAVE-non-dirty-non-new | logicFlow，non-new / non-dirty真实 UI 前置；SAVE：无写入，无 success，刷新恢复身份/内容。 |
| 3.21 Case: logicFlow-SAVE_AS-dirty-new | logicFlow，new / dirty真实 UI 前置；SAVE_AS：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |
| 3.22 Case: logicFlow-SAVE_AS-dirty-non-new | logicFlow，non-new / dirty真实 UI 前置；SAVE_AS：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |
| 3.23 Case: logicFlow-SAVE_AS-non-dirty-new | logicFlow，new / non-dirty真实 UI 前置；SAVE_AS：空保存 warning，无弹窗/写入/success。 |
| 3.24 Case: logicFlow-SAVE_AS-non-dirty-non-new | logicFlow，non-new / non-dirty真实 UI 前置；SAVE_AS：输入名称另存为新 ID，旧对象完整保留，success=1，持久化与刷新恢复身份/内容。 |

## 当前结果

见 docs/plan/unified-test-repair/direct-migration/results/M15.1.md。只有当前执行证据可作为验收；产品身份恢复失败保留，不按 collection 或旧 pass 关闭。
