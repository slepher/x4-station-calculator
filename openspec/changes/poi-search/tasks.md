# POI Search - Tasks

## 实现任务

### Task 1: 创建搜索过滤逻辑函数 [x]

**文件**: `src/components/map/savePoiSearchFilter.ts`

**内容**:
1. 定义 `SearchTag` 接口（category, id, label）
2. 定义 `SearchState` 接口（productModuleTags, factionTags）
3. 实现 `matchStationByProduct(station, wareId)`：检查 `modules[].outputs` 是否包含 wareId
4. 实现 `matchStationByModule(station, moduleId)`：检查 `modules[].ref` 或 `module_id` 是否匹配
5. 实现 `matchStationByFaction(station, factionId)`：检查 `owner` 是否匹配
6. 实现 `filterStationBySearchState(station, searchState)`：
   - 组1匹配：`productModuleTags.length === 0 || 任意tag匹配`
   - 组2匹配：`factionTags.length === 0 || 任意tag匹配`
   - 返回：`组1匹配 && 组2匹配`

**验收**: 函数可正确判断单个空间站是否匹配搜索条件

---

### Task 2: 创建搜索控件组件 [x]

**文件**: `src/components/map/MapSavePoiSearchControl.vue`

**内容**:
1. 定义 props：`archive` (SaveArchive), `category` (SavePoiCategory)
2. 定义 emits：`search-change` (SearchState)
3. 定义状态：
   - `selectedCategory`: 'product' | 'module' | 'faction'
   - `searchInput`: string
   - `searchState`: SearchState
   - `suggestions`: array
   - `showSuggestions`: boolean
4. 实现类别切换逻辑：
   - 切换类别时清空输入框
   - 不影响已添加的tag
5. 实现自动完成逻辑：
   - 监听 `searchInput` 变化（debounce 300ms）
   - 根据选定类别搜索对应数据源
   - 产品：搜索 `localizedWaresMap`
   - 模块：搜索 `localizedModulesMap`（过滤生产模块）
   - 势力：搜索 `factions`
   - 最多返回10条结果
6. 实现选择建议项逻辑：
   - 选择后添加到 `searchState`（根据类别添加到对应数组）
   - 清空输入框
   - 触发 `search-change` emit
7. 实现药丸tag显示：
   - 分组显示（组1 / 组2）
   - 格式：`类别:名称`
   - 每个tag右侧有删除按钮
8. 实现删除tag逻辑：
   - 点击删除按钮移除tag
   - 触发 `search-change` emit

**验收**: 
- 类别下拉框显示三个选项
- 输入内容后显示建议列表
- 选择建议后生成药丸tag
- 删除按钮可移除tag

---

### Task 3: 集成搜索控件到POI列表 [x]

**文件**: `src/components/map/MapSaveCoordList.vue`

**内容**:
1. 引入 `MapSavePoiSearchControl` 组件
2. 引入 `savePoiSearchFilter` 函数
3. 定义 `searchState` ref
4. 在模板中添加搜索控件（位于现有搜索框下方）
5. 监听 `search-change` emit，更新 `searchState`
6. 修改 `poiGroups` computed：
   - 从 `group.items` 获取原始 `StationEntry` 数据
   - 保留现有 `createOverlayItem` 调用（生成显示用的 `SavePoiOverlayItem`）
7. 新增 `filteredPoiGroups` computed：
   - 如果 `searchState` 为空，返回 `poiGroups`
   - 如果有搜索条件，遍历每个 group 的 items（原始 StationEntry）
   - 应用 `filterStationBySearchState` 过滤
   - 只保留匹配的空间站
8. 替换现有 `filteredGroups` 使用 `filteredPoiGroups`

**验收**:
- 搜索控件显示在列表上方
- 添加搜索条件后列表正确过滤
- 无搜索条件时显示全部

---

### Task 4: 实现自动完成数据源访问 [x]

**文件**: `src/components/map/MapSavePoiSearchControl.vue`

**内容**:
1. 从 `useGameDataStore` 获取：
   - `localizedWaresMap`
   - `localizedModulesMap`
   - `factions`
2. 预计算生产模块列表：
   - 在组件初始化时过滤 `localizedModulesMap`
   - 条件：`m.type === 'production' && Object.keys(m.outputs).length > 0`
   - 存储为 `productionModulesList`
3. 实现建议搜索函数：
   - `searchProducts(query)`：搜索 `localizedWaresMap`
   - `searchModules(query)`：搜索 `productionModulesList`
   - `searchFactions(query)`：搜索 `factions`
   - 搜索逻辑：匹配 `localeName` / `name`，忽略大小写
   - 返回格式：`{ id, label, category }`

**验收**:
- 产品类别只显示产品建议
- 模块类别只显示生产模块建议
- 势力类别只显示势力建议

---

### Task 5: 样式实现 [x]

**文件**: `src/components/map/MapSavePoiSearchControl.vue`

**内容**:
1. 搜索控件容器样式：
   - 宽度与现有搜索框一致
   - margin-bottom: 12px
2. 输入框+下拉框组合样式：
   - flex布局，输入框为主体
   - 下拉框宽度：80px
   - 统一边框样式（amber-300/30）
3. 建议列表样式：
   - 绝对定位，位于输入框下方
   - 最大高度：240px，超出滚动
   - 每项高度：36px，hover背景变化
4. 药丸tag区域样式：
   - flex-wrap布局
   - gap: 8px
   - margin-top: 8px
5. 药丸tag样式：
   - padding: 4px 8px
   - border-radius: 4px
   - bg: black/45, border: amber-300/15
   - hover: border亮度增加
   - 删除按钮：右侧 ×，opacity: 0.6, hover: opacity: 1

**验收**:
- 搜索控件与现有UI风格一致
- 药丸tag样式简洁清晰

---

### Task 6: 构建验证 [x]

**操作**:
1. 运行 `npm run build`
2. 检查编译是否通过
3. 如有错误，修复代码并重新构建
4. 直到构建成功

**验收**: 构建无错误，无 TypeScript 类型错误

---

## 任务依赖顺序

1. Task 1 → Task 4（搜索过滤函数依赖数据源）
2. Task 2（搜索控件组件）
3. Task 3（集成到列表）
4. Task 5（样式）
5. Task 6（构建验证）

建议执行顺序：Task 1 → Task 4 → Task 2 → Task 3 → Task 5 → Task 6