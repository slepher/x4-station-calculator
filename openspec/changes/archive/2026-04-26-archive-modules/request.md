# archive-modules Change Request

## 目标

在 Live 界面的 StationPlanningPanel 外层包裹一个 Vue 组件，当空间站对应一个 save station 时，将其分为两个 tab：一个显示用户规划的模块（StationPlanningPanel），一个显示存档中该空间站的实际模块列表。

## 已确认方案（审核重点）

### 1. 入口与触发条件

- **触发位置**：`LiveProductionWorkbenchView.vue` 中左侧列（col-span-3）的 `StationPlanningPanel` 外层
- **判断条件**：
  - 通过 `parseBindingStationId(activeStation.id)` 解析 stationId
  - 若解析结果为 `{ kind: 'derived', gameGuid, saveStationCode }`，则该 station 对应 save station
  - 或通过 `BindingStationPlan.saveStationCode` 有值来判断
  - **同时需要验证**：`playerStationRecords` 中确实存在该 saveStationCode 的记录且有 modules 数据

### 2. 数据获取流程

1. 从 `liveStore.activeStation` 获取当前选中的 station
2. 解析 stationId 或通过 `saveBindingStore.getStationPlan()` 获取 `saveStationCode`
3. 用 `saveStationCode` 在 `playerStationRecords` 中查找匹配的 `PlayerStationRecord`
4. 从 `PlayerStationEntry.modules` (类型: `CodeMap<AggregatedStationModule>`) 获取实际模块列表

### 3. 模块数据结构

`AggregatedStationModule` 字段：
- `ref`: 模块的 macro ref
- `amount`: 数量
- `module_id`: 游戏数据模块 ID（通过 `modulesByMacroId` 映射填充）
- `type`: 模块类型（通过 `modulesByMacroId` 映射填充）
- `group`: 分组 ID（通过 `modulesByMacroId` 映射填充）

### 4. 分组显示

- 按 `group` 字段分组显示模块
- 分组顺序：参照 `StationModulePicker.vue` 的分组排序逻辑（`compareModuleGroupsByPickerOrder`）
- 组内模块排序：参照 picker 的模块排序逻辑

### 5. i18n 方案

**参照搜索框弹出列表（`StationModulePicker.vue`）的 i18n 方案：**

- **分组名称**：通过 `localizedModuleGroupsMap[group].localeName` 显示
- **模块名称**：通过 `localizedModulesMap[module_id].localeName` 显示
- **显示逻辑**：
  - EN 模式：直接显示原始 name
  - 非 EN 模式：显示翻译后的 localeName

### 6. Tab UI 组件

- **使用**：`ViewTabUI.vue`（和资源视图相同的 tab 切换组件）
- **两个 tab**：
  - `plan`: 规划（显示 StationPlanningPanel）
  - `archive`: 存档（显示存档模块列表）
- **Tab label i18n**：
  - zh-CN: `规划` / `存档`
  - en: `Plan` / `Archive`

### 7. 显示格式

存档模块列表每组显示：
- 分组标题（group header）
- 模块项：颜色指示器 + 模块名称 + 数量

### 8. 默认 tab

- 默认选中 `plan` tab（显示 StationPlanningPanel）
- 用户可切换到 `archive` tab 查看

## 边界

### In Scope

- 创建外层包装组件（如 `StationPlanningPanelWrapper.vue` 或直接在 LiveProductionWorkbenchView.vue 内实现）
- Tab 切换逻辑
- 存档模块列表展示（按分组）
- i18n 支持（分组名称、模块名称、tab labels）
- 判断是否为 save station 的逻辑

### Out of Scope

- 模块数量编辑功能
- 从存档模块导入到规划模块
- 存档模块与规划模块的对比/差异显示
- 其他 station type（如虚拟空间站、transit hub）的处理

## 验收标准（DoD）

1. 当 station 对应 save station 时，左侧面板显示两个 tab（规划/存档）
2. 当 station 不对应 save station 时，左侧面板仅显示 StationPlanningPanel（无 tab）
3. 规划 tab 内显示原有 StationPlanningPanel 功能正常
4. 存档 tab 内显示存档模块列表，按 group 分组
5. 分组名称和模块名称正确翻译（EN/zh-CN）
6. Tab labels 正确翻译
7. Tab 切换正常工作，状态保持（切换后不丢失状态）
8. 无 save station modules 数据时，存档 tab 显示空状态提示

## 未决项

无