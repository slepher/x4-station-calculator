# M7.1 帝国与站点 CRUD / 导航 / 恢复迁移

## 当前范围与输入

- 合同：`docs/plan/unified-test-repair/direct-migration/tasks/M7.1.md`；当前基线 `d590ede41d41913ab18f5c5a18247bf956a4685a` 加已授权 ENV 配置修复。
- 规范只读：`empire-management`、`station-tabs`、`station-tab-bar`。当前 sidebar 规范覆盖旧水平 TabBar/无 Overview 的表现描述。实际 canonical runner 为 `tests/e2e`，规范中的 unified 目录仅作历史来源。
- 读取 `ProductionSidebar.vue` → `useProductionSidebarPresenter` → `useBlueprintProductionStore` → `useEmpireDataStore.reorderStationsInEmpire`；保存读取 `StationToolbar`、`useToolbarWorkflowController`、`SmartSaveDialog`、`saveEmpireAs`；模块读取 `StationModulePicker` 和 presenter。
- Fixture：复制 db.json、删除 vsn，显式指定 9.0 stable；仅 fixture 副本增加空的 `x4_empire_data_v9`。注入后 reload，通过 language-select 设 zh-CN，再通过 sidebar-add-station 创建一个站点。无 store 写入、localStorage.clear、业务状态伪造。
- 当前首次保存会显示命名对话框，另存为分配新帝国和站点 ID。因此持久化排序场景先完成 UI 首存，读取已保存身份，再拖拽和 UI 再保存；不把草稿 ID 当持久化 ID。

## 原用例到当前映射

保留两个文件全部 27 个用例，无 skip/fixme/only。下列原编号以历史文件内组和顺序定位，当前标题保持。

| 原组/编号 | 当前用例 | 用户动作 → 独立 expected |
| --- | --- | --- |
| Empire CRUD 1 | opens load modal from toolbar | 点击 toolbar-load-btn → dialog-backdrop 可见 |
| Empire CRUD 2 | default empire exists with one station | UI 创建一个站点 → 精确数量 1 |
| Empire CRUD 3 | new button creates fresh empire | 点击 New、明确等待 dirty 对话框并丢弃 → 精确 1 站点、身份不同于旧站点 |
| Empire CRUD 4 | load modal opens and shows saved empires | UI 保存并命名 Loadable Empire、新建、打开 load → 精确一项且名称可见；点击 load-empire-btn 恢复首存身份 |
| Station Tab Interactions 1 | 标签切换测试 | 点击原站点和新增站点 → 主工作区可见 |
| Station Tab Interactions 2 | 新建分站测试 | 点击添加 → 数量精确 +1、末项 active |
| Station Tab Interactions 3 | 分站菜单测试 | 右键、Delete → 菜单存在且删除确认可见，未直接写 store 删除 |
| Station Tab Interactions 4 | 工具栏内容切换测试 | 选择及添加站点 → 当前 context toolbar 可见 |
| Station Tab Interactions 5 | 工人运算开关测试 | 点击 workforce → active-green |
| Station Tab Interactions 6 | 星区矿物选择测试 | 点击资源入口和矿物 → popover 可见并可选择 |
| Station Tab Interactions 7 | 切换分站不串站 | 3 站点内切换 → 目标 active、前一站点失活 |
| Station Tab Interactions 8 | 分站数据隔离测试 | 两个不同站点间切换 → 活跃表现各自独立（此原用例只覆盖选中态隔离） |
| 标签拖拽重排 1 | 标签拖拽重排成功 | 初始 [first,Alpha,Beta]，拖 Beta 到 first 前 → [Beta,first,Alpha]；DOM/store 顺序一致、active ID 不变 |
| 标签拖拽重排 2 | 标签拖拽后第一个标签是空间站 | 实际拖 Beta 到首位 → 第一个站点精确为 Beta ID |
| 标签拖拽重排 3 | 保存并刷新后顺序保持 | 首存 Order Empire 后拖 Beta 到首位、Save、reload → 精确 [Beta,first,Alpha]，帝国 ID 保持 |
| 标签拖拽重排 4 | 取消拖拽不改变顺序 | 4 站点中第三项 drag active、横向离开列表释放 → DOM/store 完整 ID 顺序不变 |
| station-tab-drag W1 | 标签拖拽重排成功 | Beta 拖到 Alpha 前 → 精确 [first,Beta,Alpha]、名称 ['新建空间站','Beta','Alpha'] |
| station-tab-drag W2 | 空间站标签首位 | 创建 Alpha/Beta → 动态站点数 3、首项为初始站点；固定 Overview 独立存在 |
| station-tab-drag W3 | 保存并刷新后顺序保持 | Beta 添加能量电池产线、首存 Named Order Empire，Beta 拖到 Alpha 前并保存、reload → 精确 ID/名称顺序、帝国身份和 Beta 模块 [{id:'module_gen_prod_energycells_01',count:1}] |
| station-tab-drag W4 | 取消拖拽不改变顺序 | Beta 横向离开列表释放 → 完整名称和 ID 顺序保持 |
| 帝国数据持久化 1 | 保存的帝国数据在刷新后保留 | 改名 Persistent Station、UI Save 命名 Persistent Empire、reload → 精确单站 ID/名称、activeEmpire ID，点击后输入值正确 |
| Station Name Editing 1 | Default Name Display | 初始输入可见且名称非空 |
| Station Name Editing 2 | Edit Station Name | fill My New Station + Tab → 值精确匹配 |
| Station Name Editing 3 | Name Input Is Editable | 输入可见且 enabled |
| Station Name Editing 4 | Save Button Exists | toolbar-save-btn 可见 |
| Station Name Editing 5 | Station Name Persists | fill Persistent Station + Tab、再选站点 → 输入值保持 |
| Station Name Editing 6 | Default name is not empty | 初始名称非空 |

## 失败来源与修正证据

本轮 baseline：27 collected，21 passed / 6 failed / 0 skipped，exit 1，`/tmp/x4-migration-M7.1/baseline.log`。这是当前 fresh 证据，历史 3a047bab 的 21/27 仅作背景。

- 标签重排 / save-order：旧鼠标中心落点在垂直 sidebar 中并不等于插到目标前。改为目标顶部落点，并在 mouse.up 前断言 source 位于 target 之前；最终 expected 由预先捕获的实体 ID 明确排列，没有从 reorder 算法生成。
- 两项 cancel：旧路径纵向穿过其他站点，实际上已触发合法重排。当前横向离开列表，明确观察 sortable-chosen/ghost 后释放，精确比较全部 ID/名称。没有改为普通点击或条件通过。
- W3：旧 results-popover 已被 grouped-candidate-popover 替代；当前模块 ID 是 ware ID `module_gen_prod_energycells_01`，不是 macroId。模块数量断言限定到计划区，自动基础设施不会被计入一个手动模块的 oracle。
- Empire reload：旧测试点击 Save 后立即刷新，未提交首存名称。当前明确填写对话框、提交、读取指定版本 activeId 对应持久化计划，并在刷新后核对 ID/名称。
- 删除旧 fallback、条件 dialog、3 次盲目拖拽重试、水平 x-position 快照、非空替代精确数量的 oracle。只读 evaluate 用于 fixture 和结果读取。

中间纠错：candidate-1 完整 27 项，24 passed / 3 failed，exit 1：一次拖拽尚未处理到最终落点、错误只读路径 blueprintStore.stations、macro ID locator。candidate-2 focused 9 项，8 passed / 1 failed，exit 1：计划模块数量误计自动基础设施。均为 test-owned；没有形成产品缺陷结论。

## 当前执行证据

最终命令、exit、count、重复稳定验证与日志索引见 `docs/plan/unified-test-repair/direct-migration/results/M7.1.md`。构建与 Unit 使用 ENV 本轮验证结果，不重复 build；无 Rust 改动。

仅修改两个 owned spec、本迁移文档和合同结果。未修改 src、基础 fixture、shared helper、配置、历史报告，也未执行 git 写操作。结果交主 agent 审核，报告本身不替代验收。

### 稳定性恢复过程

candidate-3 单次 27/27 后，首轮 10 场景各 3 次出现 28/30，2 次 save-order 在释放前位置断言失败，未标关闭。与主 agent 确认后只尝试一次不同路径：先横向离开列表，在列表外移动到目标高度，再进入目标顶部，避免中途重排中间站点；保持真实 Mouse API 和全部精确 oracle。结果及最终验收状态见 M7.1 结果文件。

新路径 7 场景各 3 次：21/21 passed，0 failed/skip，exit 0，`/tmp/x4-migration-M7.1/stability-2.log`。旧路径 28/30 日志保留，未覆盖或删除。

最终新路径完整 owned：27/27 passed，0 failed/skip，exit 0，41.7 秒，`/tmp/x4-migration-M7.1/final.log`；collection 27、diff-check exit 0。待主 agent 验收。
