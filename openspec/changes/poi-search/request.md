# POI Search - Request

## 目标

为势力空间站POI列表页面（`MapSaveCoordList.vue`）增加多维度搜索过滤功能，支持按产品、模块、势力三个维度组合搜索，采用药丸tag形式展示已添加的搜索条件。

## 已确认方案（审核重点）

### UI结构

1. **位置**：`MapSaveCoordList.vue` 的搜索框区域
2. **组成**：
   - 输入框（主体）
   - 右侧下拉框（类别选择：产品/模块/势力）
   - 药丸tag区域（搜索框下方，已添加的搜索条件）

### 交互流程

1. 用户通过下拉框选择搜索类别（产品/模块/势力）
2. 在输入框输入内容
3. 弹出自动完成建议列表（只搜索当前选定类别）
4. 选择建议项后，生成药丸tag（如 `产品:能源电池`）
5. 药丸tag包含删除按钮，点击可移除

### 搜索逻辑

#### 分组与组合规则

- **组1（产品+模块）**：组内使用 OR
- **组2（势力）**：组内使用 OR
- **组间**：使用 AND

示例：`(产品:A OR 产品:B OR 模块:C OR 模块:D) AND (势力:E OR 势力:F)`

#### 匹配规则

- **产品**：匹配空间站任意 module 的 `outputs`（`module.outputs` 对象的 key 包含该 wareId）
- **模块**：匹配空间站任意 module 的 `ref` 或 `module_id`
- **势力**：匹配空间站的 `owner` 字段

#### 触发时机

- 添加/删除药丸tag时立即触发过滤
- 不需要手动点击搜索按钮

### 数据源

- **产品列表**：`waresMap` / `localizedWaresMap`（从 `useGameDataStore`）
- **模块列表**：`modulesMap` / `localizedModulesMap`，**只显示有输出的生产模块**（`type === 'production' && outputs 非空`）
- **势力列表**：`factions`（从 `useGameDataStore`）
- **空间站完整数据**：使用原始 `StationEntry` 数据（从 `SavePoiCategoryData.groups[].items`），不修改 `SavePoiOverlayItem` 接口

### 药丸样式

- 简单文本药丸 + 删除按钮
- 无需图标

### 持久化

- 不保存到 URL 参数
- 不保存到 localStorage
- 每次打开页面为空白状态

## 边界

### In Scope

- `MapSaveCoordList.vue` 搜索控件增强
- 新建搜索组件 `MapSavePoiSearchControl.vue`
- 自动完成逻辑（类别切换 + 输入过滤）
- 药丸tag状态管理
- 空间站列表过滤逻辑

### Out of Scope

- 其他POI类别（abandonedShip, datavault, erlkingVault）的搜索增强
- 修改 `SavePoiOverlayItem` 接口
- URL参数持久化
- localStorage持久化
- 测试代码编写

## 验收标准（DoD）

### 功能验收

1. 用户可选择"产品"类别，输入内容后只显示产品建议列表
2. 用户可选择"模块"类别，输入内容后只显示模块建议列表（仅生产模块）
3. 用户可选择"势力"类别，输入内容后只显示势力建议列表
4. 选择建议项后，药丸tag正确显示（格式：`类别:名称`）
5. 点击药丸tag删除按钮，tag被移除且列表重新过滤
6. 添加多个产品tag，空间站列表显示任意一个产品匹配的空间站（OR）
7. 添加多个模块tag，空间站列表显示任意一个模块匹配的空间站（OR）
8. 添加产品+模块tag，空间站列表显示任意一个产品或模块匹配的空间站（OR）
9. 添加势力tag，空间站列表显示该势力匹配的空间站
10. 同时添加产品tag和势力tag，空间站列表显示既匹配产品又匹配势力的空间站（AND）

### UI验收

1. 类别下拉框显示三个选项：产品、模块、势力
2. 输入框placeholder提示当前类别
3. 药丸tag区域位于搜索框下方
4. 药丸tag显示格式：`类别:名称`（如 `产品:能源电池`）
5. 每个药丸tag右侧有删除按钮（×）

### 性能验收

1. 搜索过滤响应时间 < 500ms（100个空间站以内）
2. 自动完成建议列表显示 < 300ms

## 未决项

无