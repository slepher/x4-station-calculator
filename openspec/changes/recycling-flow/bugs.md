# Recycling Flow Bugs

## BUG-001: 8.0 Generic Processor 生成数据仍为空

- 发现阶段：`/x4:apply` 全版本数据重生成后检查
- 现象：9.0 Generic/Kha'ak Processor 产率正确，8.0 `module_gen_proc_scrapworks` 的 `cycleTime` 仍为 0 且 outputs/inputs 为空。
- 预期：8.0 Generic Processor 生成 `cycleTime: 60`、`scrapmetal: 9000/h`、`rawscrap: 9000/h`、`energycells: 90000/h`。
- 根因：8.0 将 processingmodule 产品批量放在 `defaults/final.xml` 的 class dataset（`<product>`），macro 无显式 products；9.0 macro 才含 `<products><ware>`。
- 修复：按 class default 继承语义读取 processing products；macro 有显式 products 时使用 macro，否则使用 processingmodule dataset。processing recipe 仍不允许 default fallback。
- 状态：已修复；最终验证留待 `/x4:verify`。

## BUG-002: Recycling 候选区缺少 Tier 0/1

- 发现阶段：用户验收 Logic Flow recycling 子类型
- 现象：候选区只有 Recycler 的 Tier 2 outputs，Tier 0 与 Tier 1 均为空。
- 预期：显示 Recycler 的完整上游链；Tier 1 Scrap Metal 可添加对应 Processor，Tier 0 输入只展示。
- 根因：候选集合只收集 `method="recycling"` outputs，且 recycling 组的所有手动节点都强制使用 Recycler 选择器。
- 修复：从 Recycler inputs 按普通生产者规则递归收集候选；仅当目标 Ware 确有 recycling producer 时使用 Recycler 选择器。
- 状态：已修复；定向单测通过，最终验证留待 `/x4:verify`。

## BUG-003: 自动工业区不显示 Scrap Processor

- 发现阶段：用户验收生产界面
- 现象：资源明细已计算 Scrap Processor，但自动工业区仅显示 Energy Cell 模块。
- 预期：自动工业区显示自动补全生成的 Scrap Processor。
- 根因：production planning presenter 仅放行 `type="production"`，过滤了 `type="processingmodule"`。
- 修复：自动工业展示同时接受非 recycling 的 production 与 processingmodule。
- 状态：已修复；定向单测通过，最终验证留待 `/x4:verify`。
