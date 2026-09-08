# M6.1 逻辑方案保存、切换与导入迁移

当前候选基线为工作树 fresh `dist`，两份 spec 共 45 cases。baseline exit 1：41 pass / 4 fail / 0 skip。

## 旧行为到当前覆盖

| 旧编号/行为 | 当前用户事务与独立 expected | 当前覆盖 |
| --- | --- | --- |
| E2E-1 视图主题 | 点击 Flow Tab；Flow tab 为 `bg-purple-600`，标题显示当前逻辑方案名 | `logic-flow-plans.spec.ts` E2E-1 |
| E2E-2/E2E-3 新建 | clean 画布点击新建；dirty 画布真实拖入 Hull Parts、保存名称后再新建；规划区清空且方案仍出现在加载列表 | E2E-2/E2E-3 |
| E2E-4/E2E-5 保存/另存 | 真实拖入产线、保存/另存名称、再次修改、刷新后从加载弹窗载入；产线节点保留 Hull Parts 与 Weapon Components | E2E-4/E2E-5 |
| E2E-7 加载与重建 | seeded fixture 仅作初始数据；用户点击新建、加载方案；3 个组、方案名和 Hull Parts 节点可见 | E2E-7 |
| E2E-9/E2E-11 标题/视图隔离 | 点击标题输入并回车；真实切换 Production/Flow Tab；方案名称和组数量保持 | E2E-9/E2E-11 |
| E2E-12 空保存 | clean 画布点击保存；StatusMonitor 显示“无法保存空方案”，没有保存弹窗 | E2E-12 |
| E2E-14/E2E-15 新组/动态名 | 真实拖放创建新组；Hull Parts 后加入 Weapon Components；新组入口和组名更新 | E2E-14/E2E-15 |
| 2.0 | fixture 注入 flow 方案；UI 验证 Station/Empire 入口 | import 2.0 |
| 2.1 | UI 加载 `ilf_valid_single_group`、`ilf_mixed_groups`；固定 group ID/manual module oracle | import 2.1 |
| 2.2 | UI 打开 Station 导入、下拉选择 mixed；非空 group 可见、空 group 隐藏 | import 2.2 |
| 状态基线 | fixture station；UI 站点 tab、行输入、工具栏 Save 建立 clean baseline | 状态：帝国已保存基线态 |
| 状态 dirty | UI 在 Hull Parts 行的 number input 改为 13，blur 后点击工具栏 Save 建立 clean baseline；再由 candidate picker 点击 Hull Parts 产生 dirty，点击 New 出现 SmartSave | 状态：帝国待保存更改态 |
| 状态 clean→dirty | clean 后通过 candidate picker 搜索并点击 `module_gen_prod_hullparts_01`，产生 dirty | 切换：帝国已保存基线态->帝国待保存更改态 |
| 状态 dirty→clean | UI dirty 后 Save，再 New；确认无 SmartSave | 切换：帝国待保存更改态->帝国已保存基线态 |
| 2.7 | UI 切换 overview/station；activeStationId-only 变化后 New 无确认 | import 2.7 |
| 2.8 | UI 切换 overview/station 后直接导入；activeStationId-only 不触发确认 | import 2.8 |
| 2.3 | UI 站点入口、选择 group、Overwrite；固定 modules 为单个 Hull Parts ×1 | import 2.3 |
| 2.4 | UI 选择 New Station；station count +1、activeId 改变 | import 2.4 |
| 2.5 save | UI dirty Empire 入口、Save and Import；导入后单个非空规划区 | import 2.5 save |
| 2.5 discard | UI dirty Empire 入口、Discard and Import；导入后单个非空规划区 | import 2.5 discard |
| 2.6 | UI 空方案 direct import disabled、modal 保持 | import 2.6 |
| 2.7 | UI dirty、Discard and Import；warning modal 显示空规划区跳过 | import 2.7 |
| 2.8 | UI non-container isolated 导入；lockedWares 不含 ore，warning 可见 | import 2.8 |
| 2.9 | UI 移除所有 planned module、工具栏 Save；导入后 reload 不持久化，Save 后 reload 固定 Hull Parts ×1 | import 2.9 |
| 2.10 | UI Station/Empire 入口真实位置；入口右边界贴近 context toolbar 右端 | import 2.10 |
| 2.11 | UI Empire 导入 modal；无删除按钮、加载帝国语义 | import 2.11 |
| 2.12 | UI Station 下拉和二级 card；无二级 select | import 2.12 |
| 2.13 | UI mixed 下拉；非空 group 可见、空 group 隐藏 | import 2.13 |
| 2.14 | UI group direct import；strategy modal 可见 | import 2.14 |
| 2.15 | UI empty plan；empty hint、无 group/direct button | import 2.15 |
| 2.16 | UI mixed group；无 search/pagination/sort 控件 | import 2.16 |
| 2.17 | UI overwrite/new-station/Empire import；固定 modules、count、warning oracle | import 2.17 |
| 2.18 | UI 三组三模块 preview；Empire 与 Station 两处均断言 `+1 more` | import 2.18 |
| 2.19 | UI Empire/Station modal；continue button 不存在、direct button 存在 | import 2.19 |
| 2.20 | UI clean New/Import 与 dirty New/Import 逐条确认行为 | import 2.20 |
| 3.1 | UI Station Overwrite；固定 Hull Parts ×1 | import 3.1 |
| 3.2 | UI Station New；count +1、activeId 改变 | import 3.2 |
| 3.3 | UI dirty/clean Empire；SmartSave 出现/不出现 | import 3.3 |
| 3.4 | UI 空方案 direct import disabled | import 3.4 |
| 3.18 | UI clean/dirty New 与 Empire import；Discard 后 warning | import 3.18 |
| 3.19 | UI New/Empire import；saved empire list count 不增加 | import 3.19 |

## baseline 分类

四个失败均为 test-owned stale selectors：标题 class 属于标题文本而非主题；SmartSave/Load modal 使用统一 `dialog-backdrop`；空保存消息由 StatusMonitor 的 `.text-xs.font-mono` 呈现。没有产品失败、环境失败或规范冲突证据。

fixture 仅用于初始化 db 与 flow 候选；业务 dirty/clean/save/overwrite/clear 状态均由上述 UI 事务产生。page.evaluate 只读取结果或注入 fixture；未删除 case、未新增 skip/fixme/only、未改产品源码、shared helper 或 build。

## 验证

- baseline：`PORT=22661 ... logic-flow-plans.spec.ts import-logic-flow.spec.ts ... --trace=on`，exit 1，45 collected，41 pass / 4 fail / 0 skip；日志 `/tmp/x4-test-repair-M6.1/baseline/`。
- focused：`PORT=22661 ... logic-flow-plans.spec.ts ... --trace=on`，exit 0，11/11 pass；日志 `/tmp/x4-test-repair-M6.1/plans/`。
- focused UI migration：状态/覆盖/清空事务与精确 oracle 通过；中间失败 trace 保留在 `/tmp/x4-test-repair-M6.1/ui-focused/`、`ui-focused2/`、`ui-focused3/`，最终修复后的单次全量证据见 `/tmp/x4-test-repair-M6.1/final4/`。
