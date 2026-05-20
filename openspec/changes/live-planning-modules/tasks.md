# live-planning-modules 实施任务

## 1. 更新 planning 文案

- [x] 在 locale 中新增或调整建议区相关文案
- [x] 明确“推荐模块种类数”与建议区标题的中英文文本

## 2. 修改 store 运行时 UI 状态

- [x] 新增 `recommendedModulesExpanded` 之类的不持久运行时状态
- [x] 状态落点明确放在 `useLiveProductionStore`
- [x] 默认值为 `false`
- [x] 状态在所有 station 之间共享
- [x] 确认该状态不写入持久化存储

## 3. 修改 `useProductionPlanningPresenter`

- [x] 保留现有 `archiveTotalMap`
- [x] 将 `effectiveAutoIndustryModules` / `effectiveAutoHabitationModules` / `effectiveAutoInfrastructureModules` 的显示语义改为“原始 auto 数量 + 名称后彩色 `+/-N`”
- [x] 新增 orphan 判定逻辑：输入集合为 `built + building`，只看模块本身消费关系
- [x] 新增 `orphanArchiveModuleIds: Set<string>`
- [x] 新增 `recommendedModules: SavedModule[]`
- [x] `recommendedModules` 的 `count` 使用差额 `archive_total - planned_count`
- [x] 为 planned 模块组装完整 `+/-N` `diffAnnotation`
- [x] 为 auto 模块组装 `diff = auto_count - archive_total` 与名称后 `diffAnnotation`
- [x] `+N` 使用绿色，`-N` 使用红色
- [x] 修复 planned 模块 diff 从 `+1` 回到 `0` 后标记未消失的 bug

## 4. 修改 `StationPlanningPanelWrapper`

- [x] planning/live 互斥开关保持不变
- [x] planning 分支向 `StationPlanningPanel` 传递 `recommendedModules`
- [x] planning 分支向 `StationPlanningPanel` 传递建议区展开状态
- [x] live 分支的 `ArchiveModuleList` 保持不变

## 5. 修改 `StationPlanningPanel`

- [x] 调整区块顺序为 `planned -> recommended -> auto -> <hr> -> archive`
- [x] 新增 `recommendedModules` 建议区
- [x] 建议区默认折叠，折叠态显示推荐模块种类数
- [x] 展开态渲染推荐模块列表，显示差额 count
- [x] `recommendedModules` 中的模块支持点击添加/提升到 `plannedModules`
- [x] auto 区主数字继续显示 auto 原始计算数量
- [x] auto 区在 `auto_count < archive_total` 时将 count 主数字显示为红色
- [x] auto 区模块名称后显示彩色 `+/-N`
- [x] 点击 auto 模块时，加入 planned 的数量改为 `max(auto_count, archive_total)`
- [x] archive 区继续作为纯参考区保留
- [x] archive 区继续沿用当前显示内容不变
- [x] orphan 不在 archive 区显示 icon 或额外标签

## 6. 修改 `StationPlanningItem`

- [x] 新增或接入 `diffAnnotation?: string`
- [x] 保留 `threshold?: number`
- [x] planned / auto 模块名称后统一显示彩色 `+/-N`
- [x] planned 的 `-N` 使用红色显示
- [x] planned 的 `+N` 使用绿色显示
- [x] count 红色告警仅用于 `planned < archive_total`
- [x] 当 diff 回到 0 时，移除旧的 `diffAnnotation`

## 7. 保留现有联动能力

- [x] 搜索框新模块默认数量继续使用 archive 总量
- [x] 自动模块区继续由 `effectiveAuto*` 供数，但其页面语义改为“原始 auto 数量 + 彩色 `+/-N` + 点击补到 max”
- [x] `calculateAutoFillModules` 参考模块优先级与配额逻辑保持不变

## 8. 扩展辅助模块 reference-aware priority

- [x] 为 habitation 模块选择器增加 `referenceModules` 参考池能力
- [x] habitation 候选比较明确使用 `workforce.capacity`
- [x] 为 storage 模块选择器增加 `referenceModules` 参考池能力
- [x] storage 候选比较明确使用 `cargo.capacity`
- [x] 为 pier 模块选择器增加 `referenceModules` 参考池能力
- [x] pier 候选比较明确使用 `dockingCount` / 泊位能力
- [x] 统一辅助模块的候选来源顺序：reference -> existing/planned -> db
- [x] 确认辅助模块只扩展候选优先级，不改变容量/工人/泊位缺口转 count 的现有换算逻辑

## 9. 构建验证

- [x] 完成代码修改后执行 `npm run build`

## 10. 两阶段最终求值重构

- [x] 明确 `autoIndustryModules` 的数量计算不依赖第二阶段最终 `actualWorkforce`
- [x] 将第一阶段缓存职责收敛为工业自动补全优先
- [x] 将 `autoHabitationModules` 挪到第二阶段统一计算
- [x] 在第二阶段基于 `planned + autoIndustry + autoHabitation` 重算最终 flow
- [x] 将 `autoInfrastructureModules` 固定为基于第二阶段最终 flow 计算
- [x] 统一 live 与 blueprint 的最终结果语义
- [x] 为两阶段最终求值补充针对 live / blueprint 的单测
- [x] 修正第二阶段内部顺序：先确定 canonical 生产模块基准，再计算 `autoHabitationModules`
- [x] 恢复缓存真源层的最终 canonical planning flow，避免 transit / sector / empire 聚合退回读取中间 flow
