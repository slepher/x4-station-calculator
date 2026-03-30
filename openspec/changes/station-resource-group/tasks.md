# station-resource-group Tasks

## Implementation Tasks

### 1. Add loader component to MapResourceFilterAdvancedPanel.vue

- [x] 在"新增组"按钮右侧添加载入按钮组件
- [x] 实现按钮样式（amber 主题，类似 blueprint-trigger）
- [x] 添加下拉箭头图标
- [x] 实现按钮点击切换菜单显示/隐藏

### 2. Implement loader menu with fixed positioning

- [x] 创建下拉菜单容器
- [x] 实现 fixed 定位计算逻辑（参考 ShipBuildPanelFit）
- [x] 添加"星区"分组标题
- [x] 显示星区名称列表
- [x] 实现点击外部关闭菜单
- [x] 使用 Teleport 将菜单移到 body 外部

### 3. Integrate data sources for sector loading

- [x] 从 `useEmpireStore()` 获取 `sectors` 和 `activeEmpire`
- [x] 导入 `stationStateMap` 用于获取空间站资源
- [x] 实现星区载入列表的计算属性

### 4. Implement sector load functionality

- [x] 实现 `loadSectorStations(sectorId)` 函数
- [x] 获取星区下所有空间站
- [x] 对每个空间站获取 `rateGroups.resources`
- [x] 过滤掉没有资源需求的空间站
- [x] 清空当前组，创建新组
- [x] 更新按钮显示状态
- [x] 载入后自动刷新候选

### 5. Filter empty sectors from list

- [x] 实现星区过滤逻辑：检查星区下是否有空间站拥有资源需求
- [x] 过滤掉所有空间站都没有资源需求的星区
- [x] 更新载入列表的计算属性

### 6. Add loader state management

- [x] 添加 `loadedSectorId` ref
- [x] 添加 `menuOpen` ref
- [x] 添加 `menuStyle` ref
- [x] 实现当前载入状态的 computed
- [x] 关闭面板时同步关闭菜单

### 7. Style the loader menu

- [x] 添加 `.resource-group-loader-trigger` 样式
- [x] 添加 `.resource-group-loader-menu` 样式
- [x] 添加 `.loader-menu-group-title` 样式
- [x] 添加 `.loader-menu-item` 样式
- [x] 添加当前选中项高亮样式

### 8. Add logic flow plan loading support

- [x] 导入 `useLogicFlowStore` 获取存档列表
- [x] 实现 `getTier0ResourcesForGroup` 辅助函数（参照 `computeExpandUpstream`）
- [x] 实现 `loadableLogicFlowPlans` 计算属性
- [x] 实现 `loadLogicFlowPlan(planId)` 函数

### 9. Update loader menu UI for logic flow plans

- [x] 在下拉菜单中添加"逻辑组网"分组标题
- [x] 显示逻辑组网存档列表
- [x] 支持两种来源的载入状态显示

## Dependencies

- `useEmpireStore` - 获取星区和空间站数据
- `stationStateMap` - 获取空间站资源流数据
- `useLogicFlowStore` - 获取逻辑组网存档数据
- `computeExpandUpstream` - 展开算法获取 tier0 资源
- 参考 `ShipBuildPanelFit.vue` 的蓝图选择器实现