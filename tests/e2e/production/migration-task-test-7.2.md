# M7.2 模块管理与设置迁移

状态：incomplete；保留 AutoSupply 独立仓储规范冲突，不能以其他用例通过关闭本任务。

## 输入与边界

- 合同：`docs/plan/unified-test-repair/direct-migration/tasks/M7.2.md`。
- 基线：`d590ede41d41913ab18f5c5a18247bf956a4685a` 加 ENV 当前配置修复；预览复用 ENV 已构建 dist，不重复 build 或 Unit，不运行 build-rust。
- 只读规范：module-list-ui、storage-auto-fill、empire-management；设置补充 dual-buffer-calculation、wareflow-refactory 与 live-planning-station。
- 数量按钮的当前六项与 archived `2026-02-06-modules-list-ui-options/design.md` 一致：1/5、1/3、1/2、2x、3x、5x；该详细设计覆盖 module-list-ui 中旧的选项列举。工具栏位置采用当前 station-tabs 已确认表现。
- 读取链路：StationModulePicker → useStationModulePickerPresenter；StationPlanningPanel / useProductionPlanningPresenter → Blueprint moduleActions → StationDerivedMap；StationWareFlowsDashboard / StationAllocationRow → useProductionWareflowPresenter → settingActions / productionWareRuleActions；productionStationShared → calculateInfrastructureModules；UI 保存使用 SmartSaveDialog / toolbar workflow。
- 仅修改两个 owned spec、本迁移记录和结果文件；M7.1 文件冻结只读。无 src、基础 fixture、shared helper、配置、规范或 git 写入。

## 前置与独立 oracle

每个可执行用例均复制 db.json 并删除 vsn；fixture 副本显式加入 9.0 stable 与空 `x4_empire_data_v9`。逐 key 注入后 reload，通过 language-select 设 zh-CN，再真实点击 sidebar-add-station。业务输入全部来自 UI，不写 store、不注入 input/drop 事件、不调用被测算法产生 expected。

模块搜索按当前 ware ID 和 grouped-candidate-item 锚点；计划模块定位与自动区分离。缓冲滑块通过 focus、Home、ArrowRight 键完成真实 change 提交；不使用 range.fill 或 evaluate 造事件。首次保存明确填写命名对话框，持久化按 version 9 key 的 activeId 定位帝国，再校验唯一站点，绝不从 list[0] 猜目标。

独立数值来自静态 9.0 游戏数据：通用能量电池模块每小时 10,500 单位、每单位 1m³；Argon/Terran L 集装仓储容量 1,000,000m³。默认无工人加成、100% 日照，无资源消耗。因此 1 模块 × 12h 为 126,000m³；10 模块 × 12h 为 1,260,000m³（2 仓储）；24h 为 2,520,000m³（3 仓储）。添加 1/2 个手动 L 仓储后自动缺口分别为 1/0。这些 expected 不从 calculateInfrastructureModules 或 store 计算结果推导。

## 原编号 → 当前行为映射

全部 25 项保留；原 Case 3/4 的 skip 已恢复执行，Case 5 原 skip 保留且明确未完成。没有新增 skip/fixme/only 或条件通过。

| 原编号 / 当前标题 | 用户动作 | 独立 expected / 新用例位置 |
| --- | --- | --- |
| Storage Case 1 Basic Storage Auto-Fill | 添加通用 energycells 模块 | 手动模块 1、自动 Argon L container 1；module-management 同标题 |
| Storage Case 2 Race Preference Change | 添加模块、race 选 terran、Save、reload | Argon L 1 → Terran L 1，race 和仓储身份恢复；同标题 |
| Storage Case 3 Incremental Fill | energy 数量改 10，添加手动 Argon L 1，再改 2 | 自动 container 2 → 1 → 0、手动模块行 2；恢复原 skip |
| Storage Case 4 Buffer Response | energy 数量 10，primary buffer 改 24、Save、reload | 自动 container 2 → 3，保存设置 24、刷新仍 3；恢复原 skip |
| Storage Case 5 AutoSupply Storage | 原 Hull + Refined 动作没有 internalSupply 前置 | **未完成**；该动作不能证明独立 AutoSupply 仓储，原 skip 保留，未冒充通过 |
| Scale 1 应该显示正确的按钮选项 | 查看计划区 | 精确六个按钮文本 |
| Scale 2 按钮应该右对齐 | 查看按钮及标题几何位置 | 按钮组右边距 13px（12px padding + border），与标签不重叠 |
| Scale 3 按钮hover效果应该正确 | 真实 hover | 默认 slate 背景/文字 → amber 背景/amber-50 文字 |
| Scale 4 按钮高度应该为18px | 查看样式 | 精确 18px |
| Scale 5 按钮点击应该调整模块数量 | 添加 energy/storage、手工数量 3/2、2x、1/2、Save/reload、删除 storage、Save/reload | 数量 6/4 → 3/2，持久化精确两项；删除后精确只剩 energy count 3 |
| Scale 6 规划区高度应该与工业区保持一致 | 添加 Hull 形成自动工业区 | 两区 header 均 32px |
| Scale 7 按钮样式应该与资源产出概览标签保持一致 | 查看按钮样式 | 精确 8px、700、uppercase |
| StationSettings 1.1 主副产物缓冲时间字段存在 | energy 添加后进入 volume | 精确 3 slider：resource 1、primary 12、secondary 2 |
| WarePriority Initialization 1.2 默认值为空对象 | 创建 energy 规划 | 持久输入 priority {}，界面 energy 默认 level 2 |
| WarePriority Persistence 1.3 saveLayout | energy star click、Save | level 1，storage 精确 {energycells:1} |
| WarePriority Persistence 1.4 loadLayout | priority 修改、Save、New、Load | 新旧站点 ID 不同；Load 恢复保存 ID、level 1 和 priority map |
| WarePriority Persistence 2.2 持久化测试 | priority 修改、Save、reload、再切换 | level 1 / map 恢复，再点击 level 2 |
| FavoriteButton 1.1 三态图标 | 加 Hull，查看 ore/energy；energy click | ore 空心 level0、energy 实心 level2 → 半星 level1 |
| FavoriteButton 1.2 状态切换 | energy 两次 click | 精确 level 2 → 1 → 2 |
| FavoriteButton 1.3 不同视图可用性 | quantity click、volume click、economy | 同一 energy star 各视图恰好 1 个、level 1 → 2 跨视图一致 |
| Priority Logic 2.1 规划区产物 | 添加 Hull、点击 Hull / 自动 Graphene | planned Hull 2 → 1；auto Graphene 0 → 1 → 0 |
| Buffer 5.1 主产物滑块 | primary 设 8、Save/reload | 范围 0..24、推荐 energy 84,000、设置恢复 8 |
| Buffer 5.2 副产物滑块 | energy 降 level1、secondary 设4、Save/reload | 范围 0..24、推荐 42,000、设置4及priority1恢复 |
| Buffer 5.3 i18n 标签 | zh-CN → en UI语言切换 | 两语言精确三个标签文本 |
| Buffer 5.4 体积计算 | primary 12 → 20 → 0 | 推荐 126,000 → 210,000 → 0 |

## 基线与迁移纠错

最小当前 baseline 选取三个不同旧前置的代表：Storage Case1、Scale 按钮选项、StationSettings 1.1。3 collected / 3 failed / 0 passed / 0 skipped，exit 1；完整 baseline collection 为25项，静态原有3处skip。没有执行或宣称完整25项 baseline failure count。

共同失败为缺少 db/version/建站点前置，页面停在概览；settings 还存在 result-item、view-mode-btn 等旧入口。旧测试大量条件 if-count/if-visible、非空或任意状态断言、fallback、evaluate 人工事件已从执行场景移除；新增完整数量、删除、设置 Save/Load/reload 核验。

candidate-1 完整运行：23 passed / 1 failed / 1 既有 skip，exit1。唯一失败是新增对齐 oracle 错把“右对齐”限制成“整个按钮组必须位于标题中线右侧”，而精确右边距已通过；纠正为右边距加不覆盖标题，未弱化右对齐本身。

最终命令、count、exit 与 trace 路径见 `docs/plan/unified-test-repair/direct-migration/results/M7.2.md`。

## Case5 规范冲突及恢复条件

storage-auto-fill/spec.md:16 要求 internalSupply 开启、AutoSupply 生成，并将独立仓储追加到 autoSupply 而非主 autoStorage。当前链路 `productionStationShared.deriveFinalSupportState` 把核心流量送入统一 `autoInfrastructureModules`；`internalSupply` 仅在类型/default 等保留，未找到当前 UI 或相应计算入口。较新 wareflow-refactory/spec.md:87-110 与 live-planning-station/spec.md 明确统一 autoInfrastructure 输出，但没有找到显式废弃独立 AutoSupply 要求的条款。

主 agent 已指示保留该原用例未完成：不恢复旧 AutoSupply 产品层、不用当前聚合仓储冒充独立仓储、不新增用户问题。原 Case5 的 Hull+Refined 和 solid storage 检查无法证明被要求的独立归属，不能移除 skip 后把这个不同语义的动作标通过。

恢复需要权威规范明确独立 AutoSupply 是否仍有效；若有效，需产品提供可达的真实 UI 前置与独立归属，再运行相应验收；若被明确替代，按该来源迁移对应行为。本任务持续 incomplete，仅阻塞 M7.2 与依赖其完整验收的父项，不阻塞其他独立子项。

中间 final 运行：23 passed / 1 failed / 1 既有 skip，exit1。右对齐右边距已通过，标签右边与按钮左边恰好相邻，需使用允许相等的“不重叠”边界；修正后进行最终 final-2 全量 owned 运行，日志保留。没有改产品或降低右对齐要求。

最终 final-2：25 collected，24 passed / 0 failed / 1保留skip，exit0，43.0秒；collection25/diff-check exit0。唯一未完成项为Case5，不标整个M7.2通过。
