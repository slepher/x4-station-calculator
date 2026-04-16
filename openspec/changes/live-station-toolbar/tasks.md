# LiveStationToolbar 任务清单

## Phase 0: Store Getter 新增

### Task 0.1: 定义 ArchiveStationData 类型

- [x] 在 `src/types/saveArchive.ts` 中定义 `ArchiveStationData` interface
- [x] 包含 `code`, `name`, `sectorMacro`, `sector`（聚合星区数据）
- [x] 包含 `position?: { x, y, z }`（空间站坐标）
- [x] 包含 `modules`（已建模块）
- [x] 包含 `building: { modules, cargo, reservation }`（在建信息）
- [x] 包含 `cargo`, `reservation`（站点库存）

### Task 0.1b: 定义 ArchiveStationSectorData 类型

- [x] 在 `src/types/saveArchive.ts` 中更新 `ArchiveStationSectorData` interface
- [x] 新增 `nameId?: string` 字段（用于 i18n）

### Task 0.1c: 定义 ArchiveStationPosition 类型

- [x] 在 `src/types/saveArchive.ts` 中定义 `ArchiveStationPosition` interface
- [x] 包含 `x: number`, `y: number`, `z: number`

### Task 0.2: 实现 getBindingStation getter

- [x] 在 `useLiveProductionStore.ts` 中添加 `getBindingStation()` 函数
- [x] 解析 `activeStationId` 获取 planId 或 saveStationCode
- [x] 从 `activeBinding.stationPlans` 中查找对应的 `BindingStationPlan`
- [x] 返回找到的 plan 或 null

### Task 0.3: 实现 getArchiveStation getter

- [x] 在 `useLiveProductionStore.ts` 中添加 `getArchiveStation()` 函数
- [x] 解析 `activeStationId` 获取 saveStationCode（仅 derived 类型）
- [x] 对于 plan 类型，通过 `plan.saveStationCode` 查找存档数据
- [x] 从 `playerStationRecords` 中查找 code 匹配的记录
- [x] 获取对应的 `PlayerStationEntry` 和 `BuildStorageEntry`
- [x] 计算差集 `building.modules = buildstorage.modules - station.modules`（按 module_id）
- [x] 查询 map sector 获取 `sector.resources` 和 `sector.sunlight`
- [x] 提取 `sector.nameId` 用于 i18n
- [x] 提取 `station.relative_position` 作为 `position`
- [x] 返回转化后的 `ArchiveStationData`

### Task 0.4: 导出 getter 到 return 语句

- [x] 在 store return 语句中添加 `getBindingStation`
- [x] 在 store return 语句中添加 `getArchiveStation`

## Phase 1: Props/Emits 变更

### Task 1.1: 定义新 Props 结构

- [x] 在 LiveStationToolbar.vue 中定义新 props：
  - `stationCode: string`
  - `sectorName: string`
  - `sectorNameId?: string`
  - `stationPosition?: ArchiveStationPosition`
  - `sectorResources: string[]`
  - `sectorSunlight: number`
  - `hasBindingStation: boolean`
  - `hasSaveStation: boolean`
- [x] 保留必要 props：`station.name`, `settings`, `races`, `singleBerthThroughput`

### Task 1.2: 移除废弃 Props

- [x] 移除 `station.type`, `station.count`
- [x] 移除 `settings.transportMinutes` 相关
- [x] 移除 `stationTypes`, `availableMinerals` props

### Task 1.3: 定义新 Emits

- [x] 新增 `toggleMode` emit
- [x] 保留规划模式 emits：`updateRacePreference`, `updateWorkforce`, `updateShowEmpireGaps`

### Task 1.4: 移除废弃 Emits

- [x] 移除 `updateStationType`, `updateStationCount`
- [x] 移除 `toggleMineral`, `updateSunlight`, `updateTransportMinutes`

## Phase 2: 模式切换逻辑

### Task 2.1: 实现模式状态

- [x] 创建 `mode` ref（'live' | 'planning'）
- [x] 实现 `initialMode` computed（根据 hasBindingStation/hasSaveStation）
- [x] 实现 `canToggle` computed

### Task 2.2: 实现模式切换按钮

- [x] 创建切换按钮 UI（toggle-chip 样式）
- [x] 只显示当前模式（实时 📡 或规划 📝）
- [x] 按钮禁用状态（`canToggle` 为 false 时 cursor-default，不显示禁止图标）
- [x] 点击事件触发 `toggleMode` emit
- [x] 实时模式：sky 色系 border
- [x] 规划模式：amber 色系 border

### Task 2.3: 初始化模式

- [x] 组件 mounted 时设置 `mode.value = initialMode.value`

## Phase 3: UI 结构重构

### Task 3.1: 第一组 - 站点标识

- [x] 名称输入框（可编辑）
- [x] 编码字段（只读，灰色背景）
- [x] 模式切换按钮

### Task 3.2: 第二组 - 环境信息

- [x] 星区字段：显示星区名称，支持 i18n
- [x] 星区 popover：点击弹出坐标 `(x, y, z)`
- [x] 星区资源徽章 + popover（只读列表）
- [x] 光伏效率数值（百分比，原始值 × 100）
- [x] 单位吞吐量数值（只读，count-pill 样式）

### Task 3.3: 第三组 - 规划控件

- [x] 偏好种族下拉（v-if="mode === 'planning'"）
- [x] 工人运算开关（v-if="mode === 'planning'"）
- [x] 显示缺口开关（v-if="mode === 'planning'"）

### Task 3.4: 移除废弃 UI 元素

- [x] 移除站点类型下拉
- [x] 移除站点数量输入
- [x] 移除运输时间输入
- [x] 移除 liveData popover 相关 UI

## Phase 4: 父组件适配

### Task 4.1: 使用 Store Getter 获取数据

- [x] 调用 `liveStore.getBindingStation()` 获取规划数据
- [x] 调用 `liveStore.getArchiveStation()` 获取存档数据
- [x] 计算 `hasBindingStation = bindingStation !== null`
- [x] 计算 `hasSaveStation = archiveStation !== null`
- [x] 提取 `stationCode = archiveStation?.code`

### Task 4.2: 查询 Sector 数据

- [x] 从 `archiveStation.sector` 直接获取聚合数据
- [x] 提取 `sectorName = sector?.name || ''`
- [x] 提取 `sectorNameId = sector?.nameId`
- [x] 提取 `sectorResources = sector?.resources || []`
- [x] 提取 `sectorSunlight = Math.round(sector?.sunlight * 100)`

### Task 4.2b: 提取 Position 数据

- [x] 从 `archiveStation.position` 直接获取坐标
- [x] 提取 `stationPosition = archiveStation?.position`

### Task 4.3: 传递 Props 到 LiveStationToolbar

- [x] 传递 `stationName`
- [x] 传递 `stationCode`
- [x] 传递 `sectorName`
- [x] 传递 `sectorNameId`
- [x] 传递 `stationPosition`
- [x] 传递 `sectorResources`
- [x] 传递 `sectorSunlight`
- [x] 传递 `hasBindingStation`
- [x] 传递 `hasSaveStation`

### Task 4.4: 处理 toggleMode 事件

- [x] 接收 toggleMode emit
- [x] 当前为空函数（模式仅影响 toolbar UI）

## Phase 5: 样式调整

### Task 5.1: 只读字段样式

- [x] 编码字段：灰色背景，静态文本样式
- [x] 星区字段：点击弹出 popover，展示坐标
- [x] 星区资源 popover：无 checkbox，只读列表样式
- [x] 光伏效率：百分比格式（原始值 × 100），count-pill 样式

### Task 5.2: 切换按钮样式

- [x] 使用 toggle-chip 样式
- [x] 正常状态：可点击，实时 sky 色系，规划 amber 色系
- [x] 禁用状态：cursor-default，不显示禁止图标

### Task 5.3: 星区字段样式

- [x] 显示星区名称，支持 i18n（通过 nameId）
- [x] 点击弹出 popover，展示坐标 `(x, y, z)`
- [x] 无坐标数据时显示 "无坐标数据"

## Phase 6: i18n 翻译

### Task 6.1: 添加英文翻译

- [x] 在 `src/locales/en.json` 中添加：
  - `toolbar.sector`: "Sector"
  - `toolbar.position`: "Position"
  - `toolbar.no_position`: "No position data"

### Task 6.2: 添加中文翻译

- [x] 在 `src/locales/zh-CN.json` 中添加：
  - `toolbar.sector`: "星区"
  - `toolbar.position`: "坐标"
  - `toolbar.no_position`: "无坐标数据"

### Task 7.1: 扩展 ArchiveModuleList props

- [x] 新增 `buildingModules?: SavedModule[]` prop
- [x] 保留原有 `modules: AggregatedStationModule[]` prop

### Task 7.2: 在建模块分组逻辑

- [x] 将 `buildingModules` 按 module_id 映射到对应分组
- [x] 使用 `gameData.modulesMap[moduleId].group` 获取分组信息
- [x] 合并到已有分组数据中

### Task 7.3: 在建模块 UI 显示

- [x] 在每个分组末尾添加在建模块区域
- [x] 使用虚线 left-border 样式（参考 StationPlanningPanel 的 tier-auto）
- [x] 样式：`border-l-2 border-dashed border-amber-600/40 pl-2`（使用 amber 区分在建状态）
- [x] 使用 StationPlanningItem 组件渲染，设置 `readonly` 和 `noClick`

### Task 7.4: StationPlanningPanelWrapper 传递 buildingModules

- [x] 调用 `liveStore.getArchiveStation()` 获取 `ArchiveStationData`
- [x] 传递 `archiveStation.building.modules` 到 ArchiveModuleList
- [x] 条件传递：通过 computed 自动处理

## Phase 8: 验证

### Task 8.1: TypeScript 编译

- [x] 运行 `npx vue-tsc --noEmit` 无错误

### Task 8.2: 构建验证

- [x] 运行 `npm run build` 成功

### Task 8.3: E2E 测试

- [x] 创建 `tests/e2e/live-station-toolbar/mode-toggle.spec.ts`
- [x] 测试站点 "地球人": bindingStation + saveStation -> 规划模式，可切换
- [x] 测试站点 "新建空间站": bindingStation + 无 saveStation -> 规划模式，不可切换
- [x] 测试存档站点 "PPW-916": 无 bindingStation + saveStation -> 实时模式，可切换
- [x] 测试模式切换: 点击切换按钮可切换模式
- [x] 所有测试通过

## Phase 9: bindingStation 数据显示修复

### Task 9.1: 修复 `toProductionStation` sunlight 获取

- [x] 在 `productionSourceAdapter.ts` 添加 `SectorSunlightMap` 类型
- [x] `toProductionStation` 函数添加 `sectorsMap` 参数
- [x] 从 `sectorsMap[plan.sectorMacro]?.area?.sunlight` 获取 sunlight（0-1 范围）
- [x] 设置 `settings.sunlight = Math.round(sunlight * 100)`（转为百分比）

### Task 9.2: 修复 `deriveBindingStationsFromRecords`

- [x] 函数添加 `sectorsMap` 参数
- [x] 传递 `sectorsMap` 给 `toProductionStation` 调用

### Task 9.3: 修复 `empireSourceView.ts`

- [x] `EmpireSourceViewDeps` 添加 `sectorsMap?: Ref<Record<string, X4MapSector>>`
- [x] `derivedBindingStations` computed 传递 `sectorsMap?.value` 给派生函数

### Task 9.4: 修复 `useLiveProductionStore.ts`

- [x] `createEmpireSourceView` 传递 `sectorsMap: computed(() => gameData.maps.sectors)`
- [x] `activeStation` computed 传递 `gameData.maps.sectors` 给 `toProductionStation`

### Task 9.5: 修复 `LiveProductionWorkbenchView.vue` bindingStation 数据源

- [x] 添加 `bindingSectorData` computed：从 `bindingStation.sectorMacro` 查询 `gameData.maps.sectors`
- [x] 返回 `{ name, nameId, sunlight, resources }` 聚合数据
- [x] `sectorSunlight` computed：优先 `archiveStation`，其次 `bindingSectorData`
- [x] `sectorName` computed：优先 `archiveStation`，其次 `bindingSectorData`
- [x] `sectorNameId` computed：优先 `archiveStation`，其次 `bindingSectorData`
- [x] `stationPosition` computed：优先 `archiveStation`，其次 `bindingStation.position`
- [x] `sectorResources` computed：优先 `archiveStation`（检查 `.length`），其次 `bindingSectorData`

## Phase 10: 坐标与资源 UI 改进

### Task 10.1: 坐标显示格式改进

- [x] `LiveStationToolbar.vue` 添加 `formatKm` 函数：整数取整，浮点取1位小数
- [x] `positionKm` computed：转换为 `{ x, y, z }` km 格式
- [x] popover 模板改为 X/Y/Z 分行显示
- [x] 添加 `.position-row` 样式：`flex items-center justify-between px-2 py-1.5 gap-2`
- [x] 显示单位 `km`

### Task 10.2: 资源 popover 改进

- [x] 移除 `.popover-content` 的 `max-h-48` 高度限制
- [x] 添加 `.popover-content.resources-list` 样式：`max-h-none overflow-visible`
- [x] 资源名称 i18n：添加 `getResourceName` 函数，从 `waresMap[wareId]` 获取 ware 对象再调用 `translateWare`

### Task 10.3: E2E 测试更新

- [x] Test 3.10 新增：验证 bindingStation 的星区名称（小行星带）、sunlight（13%）、资源（7种）、坐标格式
- [x] Test 3.6 更新：验证新坐标格式（X: -39.5, Y: 0, Z: 8.8 km）

## Phase 11: Toolbar Presenter 统一化（Station + Transit）

### Task 11.1: Contract 扩展 - 新增通用 context 方法

- [x] `ProductionWorkbenchContract.ts` 新增 6 个方法：
  - `getToolbarStationCode(): string`
  - `getToolbarSectorName(): string`
  - `getToolbarSectorNameId(): string | undefined`
  - `getToolbarStationPosition(): { x, y, z } | undefined`
  - `getToolbarSectorResources(): string[]`
  - `getToolbarSectorSunlight(): number`
- [x] 方法内部根据 `getWorkbenchMode()` 自动返回 station 或 transit 对应数据

### Task 11.2: Presenter 扩展 - 新增 props

- [x] `useProductionToolbarPresenter.ts` 新增 6 个 props：
  - `stationCode: ComputedRef<string>`
  - `sectorName: ComputedRef<string>`
  - `sectorNameId: ComputedRef<string | undefined>`
  - `stationPosition: ComputedRef<{ x, y, z } | undefined>`
  - `sectorResources: ComputedRef<string[]>`
  - `sectorSunlight: ComputedRef<number>`

### Task 11.3: LiveStore 实现 - context 方法实现

- [x] `useLiveProductionStore.ts` 实现 6 个 toolbar 方法
- [x] 根据 `workbench.getWorkbenchMode()` 判断：
  - `mode === 'station'` → 返回 `stationContext` 数据
  - `mode === 'transit'` → 返回 `transitHubContext` 数据

### Task 11.4: BlueprintStore 实现 - 同步扩展

- [x] `useBlueprintProductionStore.ts` 同步实现 6 个 toolbar 方法
- [x] Station 模式返回空/sector 数据（无 transit）

### Task 11.5: View 适配 - 统一使用 toolbarPresenter

- [x] `LiveProductionWorkbenchView.vue` TransitToolbar 使用 toolbarPresenter props
- [x] `LiveProductionWorkbenchView.vue` StationToolbar 使用 toolbarPresenter props
- [x] 移除 View 层重复 computed（stationCode, sectorName 等）
- [x] 保留 hasBindingStation/hasSaveStation/mode/canToggle（store 特有）

### Task 11.6: TransitToolbar 对齐 StationToolbar

- [x] `LiveTransitToolbar.vue` 结构对齐：
  - Section 1: transit 名称 + trade station 代码 + 模式切换按钮
  - Sep 1
  - Section 2: 星区名称 + popover + 星区资源 + popover + 光伏效率 + 单泊位吞吐量
  - Sep 2（仅 planning mode）
  - 种族偏好（仅 planning mode）
- [x] 移除导入按钮
- [x] 样式对齐：toggle-chip + emoji（📝/📡）+ 颜色
- [x] 颜色规则：visualMode 决定颜色（planning=amber, live=sky）

### Task 11.7: transitHubContext 扩展 - 新增扇区字段

- [x] `useLiveProductionStore.ts` transitHubContext 新增字段：
  - `sectorName: string`
  - `sectorNameId: string | undefined`
  - `sectorResources: string[]`
  - `sectorSunlight: number`
  - `position: { x, y, z } | undefined`
- [x] 从 archive station 的 `stationEntry.position` 获取坐标

### Task 11.8: 修复 sectorMacro 获取

- [x] transitHubContext 使用 `group.sectorMacro` 获取扇区数据（而非 sectorId）
- [x] 从 `gameData.maps.sectors[sectorMacro]` 查询扇区信息
- [x] 正确计算 sunlight: `Math.round((sectorData.area?.sunlight ?? 1) * 100)`
- [x] 正确获取 resources: `(sectorData.resources || []).map(r => r.ware)`

### Task 11.9: E2E 测试 - 扇区信息验证

- [x] `live-flow-map.spec.ts` 新增测试：transit hub 扇区信息显示正确
- [x] 验证日照效率：阿尔忒弥斯的朦胧显示 141%（而非默认 100%）
- [x] 验证资源数量：大于 0
- [x] 验证星区 popover：显示正确名称
- [x] 修复 locator 使用正确 i18n 文本：`光伏效率` / `星区资源` / `星区`

### Task 11.10: 构建验证

- [x] `npm run build` 成功
- [x] TypeScript 无错误