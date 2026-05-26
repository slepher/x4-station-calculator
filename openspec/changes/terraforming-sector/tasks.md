# Terraforming Sector Display — 实现任务

## 任务清单

### 1. 更新 Presenter 接口和输出

- [x] `TerraformingSectorPanelProps` 新增 `statScaleModels`, `currentStats`, `statDisplayNames`, `activeRebates` 字段
- [x] `sectorPanel` 输出新增对应 computed 值
- [x] `TerraformingTaskListProps` 移除 `statScaleModels`, `currentStats`, `statDisplayNames`, `activeRebates` 字段
- [x] `taskList` 输出移除对应字段

### 2. 改造 TerraformingSectorPanel.vue

- [x] 新增 Props: `statScaleModels`, `currentStats`, `statDisplayNames`, `activeRebates`
- [x] 新增 internal state: `displayMode: 'list' | 'item'`
- [x] 新增 emit: `displayModeChange(mode: 'list' | 'item')`
- [x] List 模式模板：星区列表（保持现有 cluster-item 样式，去除手风琴展开）
- [x] Item 模式模板：标题栏（返回按钮 + 星区名称）+ objectives + stats + rebates
- [x] 返回按钮使用更换船只 SVG icon
- [x] onMounted: 如果 selectedClusterId 非空，设置 displayMode = 'item'
- [x] 点击星区 → 切换 item 模式
- [x] 点击返回 → 切换 list 模式

### 3. 移除 TaskList 中的 stats 卡片

- [x] `TerraformingTaskList.vue` 移除 `stats-card` 模板区域
- [x] 移除不再使用的 props 声明
- [x] 移除不再使用的 imports (`TerraformingStatScaleModel`, `TerraformingStatScale`)

### 4. 适配 LiveProductionWorkbenchView.vue

- [x] 新增 `terraformingSectorMode` 状态
- [x] 传递新 props 给 `TerraformingSectorPanel`
- [x] TaskList 和 ResourcePanel 外层加 `v-if="terraformingSectorMode === 'item'"`
- [x] 处理 `@display-mode-change` 事件

### 5. 构建验证

- [x] `npm run build` 无编译错误
