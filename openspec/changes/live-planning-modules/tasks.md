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
- [x] 保留现有 `effectiveAutoIndustryModules` / `effectiveAutoHabitationModules` / `effectiveAutoInfrastructureModules`
- [x] 新增 orphan 判定逻辑：输入集合为 `built + building`，只看模块本身消费关系
- [x] 新增 `orphanArchiveModuleIds: Set<string>`
- [x] 新增 `recommendedModules: SavedModule[]`
- [x] `recommendedModules` 的 `count` 使用差额 `archive_total - planned_count`
- [x] 为 planned 模块组装 `diffAnnotation`，仅在 `planned > archive_total` 时输出弱化 `+N`

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
- [x] archive 区继续作为纯参考区保留
- [x] archive 区继续沿用当前显示内容不变
- [x] orphan 不在 archive 区显示 icon 或额外标签

## 6. 修改 `StationPlanningItem`

- [x] 新增或接入 `diffAnnotation?: string`
- [x] 保留 `threshold?: number`
- [x] 模块名称后显示弱化 `+N`，仅用于 `planned > archive_total`
- [x] count 红色告警仅用于 `planned < archive_total`

## 7. 保留现有联动能力

- [x] 搜索框新模块默认数量继续使用 archive 总量
- [x] 自动模块区继续使用 `effectiveAuto*`
- [x] `calculateAutoFillModules` 参考模块优先级与配额逻辑保持不变

## 8. 构建验证

- [x] 完成代码修改后执行 `npm run build`
