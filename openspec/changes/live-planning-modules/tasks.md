# live-planning-modules 实施任务

## 1. 新增 locale 字符串

- [x] 在 `src/locales/zh-CN.json` 的 `planning` 块中新增 `tier_built: "已建模块区"` 和 `tier_building: "在建模块区"`
- [x] 在 `src/locales/en.json` 的 `planning` 块中新增 `tier_built: "Built Modules"` 和 `tier_building: "Building Modules"`

## 2. 修改 `useProductionPlanningPresenter`

- [x] 新增 `archiveTotalMap` computed：合并 `liveModules` 和 `liveBuildingModules` 为 `Record<string, number>`
- [x] 新增 `deductArchive(modules, totalMap)` 辅助函数：max(0, count - archiveTotal)，过滤 count=0
- [x] 新增 `effectiveAutoIndustryModules` computed = deductArchive(autoIndustry, archiveTotalMap)
- [x] 新增 `effectiveAutoHabitationModules` computed = deductArchive(autoHabitation, archiveTotalMap)
- [x] 新增 `effectiveAutoInfrastructureModules` computed = deductArchive(autoInfrastructure, archiveTotalMap)
- [x] 在 `PlanningPresenterProps` 接口中新增以上 computed 字段

## 3. 修改 `StationPlanningPanelWrapper`

- [x] planning/live 互斥开关**保持不变**
- [x] planning 分支的 `StationPlanningPanel` 组件：新增 `archiveModules`、`buildingModules`、`archiveTotalMap` 三个 prop 绑定
- [x] live 分支的 `ArchiveModuleList` 完全不变

## 4. 修改 `StationPlanningPanel`

- [x] 新增 props：`archiveModules`, `buildingModules`, `archiveTotalMap`
- [x] 新增"已建模块区" tier section：用 `v-if` 控制显隐，过滤未知模块，平铺渲染 `StationPlanningItem`（`readonly` + 非 `noClick`）
- [x] 新增"在建模块区" tier section：同理
- [x] 新增 `handleTransferArchiveModule(moduleId)`：实现"低于默认→提升，多于默认→不重复"逻辑
- [x] 修改 `handleAddModule(moduleId)`：新模块默认 count 从 `archiveTotalMap` 取，fallback 为 1
- [x] `StationPlanningItem`（planned 区）传入 `:threshold="archiveTotalMap[element.id]"`
- [x] 自动模块区使用 `effectiveAuto*`（presenter 传入）替代原始 `auto*`

## 5. 修改 `StationPlanningItem`

- [x] 新增 props：`threshold?: number`
- [x] 在 `!readonly` 分支中：若 `threshold !== undefined && item.count < threshold`，count 文字颜色改为红色（`text-red-400`）

## 6. 修改 `LiveProductionWorkbenchView`

- [x] `StationPlanningPanelWrapper` 绑定改用 presenter 的 `effectiveAuto*` 和 `archiveTotalMap`
- [x] planning 模式分支新增 `:archive-modules`、`:building-modules`、`:archive-total-map` 绑定
- [x] planning/live 互斥开关不改动

## 7. 构建验证

- [x] `npm run build` 通过，无编译错误
