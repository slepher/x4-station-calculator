# LiveStationToolbar 任务清单

## Phase 0: Store Getter 新增

### Task 0.1: 定义 ArchiveStationData 类型

- [ ] 在 `src/types/x4.ts` 或 `src/types/saveArchive.ts` 中定义 `ArchiveStationData` interface
- [ ] 包含 `code`, `name`, `sectorMacro`, `sector`（聚合星区数据）
- [ ] 包含 `modules`（已建模块）
- [ ] 包含 `building: { modules, cargo, reservation }`（在建信息）
- [ ] 包含 `cargo`, `reservation`（站点库存）

### Task 0.2: 实现 getBindingStation getter

- [ ] 在 `useLiveProductionStore.ts` 中添加 `getBindingStation()` 函数
- [ ] 解析 `activeStationId` 获取 planId 或 saveStationCode
- [ ] 从 `activeBinding.stationPlans` 中查找对应的 `BindingStationPlan`
- [ ] 返回找到的 plan 或 null

### Task 0.3: 实现 getArchiveStation getter

- [ ] 在 `useLiveProductionStore.ts` 中添加 `getArchiveStation()` 函数
- [ ] 解析 `activeStationId` 获取 saveStationCode（仅 derived 类型）
- [ ] 从 `playerStationRecords` 中查找 code 匹配的记录
- [ ] 获取对应的 `PlayerStationEntry` 和 `BuildStorageEntry`
- [ ] 计算差集 `building.modules = buildstorage.modules - station.modules`（按 module_id）
- [ ] 查询 map sector 获取 `sector.resources` 和 `sector.sunlight`
- [ ] 返回转化后的 `ArchiveStationData`

### Task 0.4: 导出 getter 到 return 语句

- [ ] 在 store return 语句中添加 `getBindingStation`
- [ ] 在 store return 语句中添加 `getArchiveStation`

## Phase 1: Props/Emits 变更

### Task 1.1: 定义新 Props 结构

- [ ] 在 LiveStationToolbar.vue 中定义新 props：
  - `stationCode: string`
  - `sectorResources: string[]`
  - `sectorSunlight: number`
  - `hasBindingStation: boolean`
  - `hasSaveStation: boolean`
- [ ] 保留必要 props：`station.name`, `settings`, `races`, `singleBerthThroughput`

### Task 1.2: 移除废弃 Props

- [ ] 移除 `station.type`, `station.count`
- [ ] 移除 `settings.transportMinutes` 相关
- [ ] 移除 `stationTypes`, `availableMinerals` props

### Task 1.3: 定义新 Emits

- [ ] 新增 `toggleMode` emit
- [ ] 保留规划模式 emits：`updateRacePreference`, `updateWorkforce`, `updateShowEmpireGaps`

### Task 1.4: 移除废弃 Emits

- [ ] 移除 `updateStationType`, `updateStationCount`
- [ ] 移除 `toggleMineral`, `updateSunlight`, `updateTransportMinutes`

## Phase 2: 模式切换逻辑

### Task 2.1: 实现模式状态

- [ ] 创建 `mode` ref（'live' | 'planning'）
- [ ] 实现 `initialMode` computed（根据 hasBindingStation/hasSaveStation）
- [ ] 实现 `canToggle` computed

### Task 2.2: 实现模式切换按钮

- [ ] 创建切换按钮 UI（实时 | 规划）
- [ ] 按钮禁用状态（`canToggle` 为 false 时灰色禁用）
- [ ] 点击事件触发 `toggleMode` emit

### Task 2.3: 初始化模式

- [ ] 组件 mounted 时设置 `mode.value = initialMode.value`

## Phase 3: UI 结构重构

### Task 3.1: 第一组 - 站点标识

- [ ] 名称输入框（可编辑）
- [ ] 编码字段（只读，灰色背景）
- [ ] 模式切换按钮

### Task 3.2: 第二组 - 环境信息

- [ ] 星区资源徽章 + popover（只读列表）
- [ ] 光伏效率数值（只读，count-pill 样式）
- [ ] 单位吞吐量数值（只读，count-pill 样式）

### Task 3.3: 第三组 - 规划控件

- [ ] 偏好种族下拉（v-if="mode === 'planning'"）
- [ ] 工人运算开关（v-if="mode === 'planning'"）
- [ ] 显示缺口开关（v-if="mode === 'planning'"）

### Task 3.4: 移除废弃 UI 元素

- [ ] 移除站点类型下拉
- [ ] 移除站点数量输入
- [ ] 移除运输时间输入
- [ ] 移除 liveData popover 相关 UI

## Phase 4: 父组件适配

### Task 4.1: 使用 Store Getter 获取数据

- [ ] 调用 `liveStore.getBindingStation()` 获取规划数据
- [ ] 调用 `liveStore.getArchiveStation()` 获取存档数据
- [ ] 计算 `hasBindingStation = bindingStation !== null`
- [ ] 计算 `hasSaveStation = archiveStation !== null`
- [ ] 提取 `stationCode = archiveStation?.code`

### Task 4.2: 查询 Sector 数据

- [ ] 从 `archiveStation.sectorMacro` 查询对应 map sector
- [ ] 使用 `gameData.sectorsMap[sectorMacro]` 获取 sector 数据
- [ ] 提取 `sectorResources = sector?.resources || []`
- [ ] 提取 `sectorSunlight = sector?.sunlight ?? 100`

### Task 4.3: 传递 Props 到 LiveStationToolbar

- [ ] 传递 `stationCode`
- [ ] 传递 `sectorResources`
- [ ] 传递 `sectorSunlight`
- [ ] 传递 `hasBindingStation`
- [ ] 传递 `hasSaveStation`

### Task 4.4: 处理 toggleMode 事件

- [ ] 接收 toggleMode emit
- [ ] 更新组件内部状态（或传递到 store，如果需要）

## Phase 5: 样式调整

### Task 5.1: 只读字段样式

- [ ] 编码字段：灰色背景，静态文本样式
- [ ] 星区资源 popover：无 checkbox，只读列表样式
- [ ] 光伏效率：count-pill 样式，静态数值

### Task 5.2: 切换按钮样式

- [ ] 正常状态：可点击，sky 色系
- [ ] 禁用状态：灰色，不可点击

## Phase 7: ArchiveModuleList 在建模块集成

### Task 7.1: 扩展 ArchiveModuleList props

- [ ] 新增 `buildingModules?: SavedModule[]` prop
- [ ] 保留原有 `modules: AggregatedStationModule[]` prop

### Task 7.2: 在建模块分组逻辑

- [ ] 将 `buildingModules` 按 module_id 映射到对应分组
- [ ] 使用 `gameData.modulesMap[moduleId].group` 获取分组信息
- [ ] 合并到已有分组数据中

### Task 7.3: 在建模块 UI 显示

- [ ] 在每个分组末尾添加在建模块区域
- [ ] 使用虚线 left-border 样式（参考 StationPlanningPanel 的 tier-auto）
- [ ] 样式：`border-l-2 border-dashed border-amber-600/40 pl-2`（使用 amber 区分在建状态）
- [ ] 使用 StationPlanningItem 组件渲染，设置 `readonly` 和 `noClick`

### Task 7.4: StationPlanningPanelWrapper 传递 buildingModules

- [ ] 调用 `liveStore.getArchiveStation()` 获取 `ArchiveStationData`
- [ ] 传递 `archiveStation.building.modules` 到 ArchiveModuleList
- [ ] 条件传递：仅在存档模式（activeTab === 'archive'）且有在建模块时传递

## Phase 8: 验证

### Task 8.1: TypeScript 编译

- [ ] 运行 `npx vue-tsc --noEmit` 无错误

### Task 8.2: 构建验证

- [ ] 运行 `npm run build` 成功