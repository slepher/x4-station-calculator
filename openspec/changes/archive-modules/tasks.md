# Archive Modules Display Tasks

## Implementation Tasks

- [x] 添加 Tab Label i18n Keys
  - 在 `src/locales/en.json` 中添加 `planning.tab_plan` 和 `planning.tab_archive`
  - 在 `src/locales/zh-CN.json` 中添加对应中文翻译

- [x] 创建 ArchiveModuleList.vue 组件
  - 创建 `src/components/empire/ArchiveModuleList.vue`
  - Props: `modules`, `modulesMap`, `moduleGroupsMap`
  - 实现按 group 分组显示
  - 使用 `localizedModulesMap` 和 `localizedModuleGroupsMap` 获取显示名称
  - 参照 StationModulePicker.vue 样式实现模块项渲染
  - 实现空状态显示

- [x] 创建 StationPlanningPanelWrapper.vue 组件
  - 创建 `src/components/empire/StationPlanningPanelWrapper.vue`
  - 实现 save station 判断逻辑（parseBindingStationId）
  - 从 liveStore 和 playerStationRecords 获取存档模块数据
  - 管理 tab 状态（activeTab ref）
  - 条件渲染 ViewTabUI + 双 tab 或直接渲染 StationPlanningPanel
  - 传递 props 到 StationPlanningPanel 和 ArchiveModuleList

- [x] 修改 LiveProductionWorkbenchView.vue
  - 导入 StationPlanningPanelWrapper
  - 替换左侧 col-span-3 区域的 StationPlanningPanel 为 StationPlanningPanelWrapper
  - 传递 activeStationId prop
  - 保持其他 props 不变（plannedModules, autoIndustryModules, enforceDlcActivation）

- [x] Build 验证
  - 运行 `npm run build` 验证无编译错误
  - 如有错误，修复后重新 build 直到通过