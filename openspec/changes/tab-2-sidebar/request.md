# 请求：水平 Tab Bar 重构为左侧可折叠 Sidebar

## 目标

将 blueprint-production 和 live-production 两个视图中的水平滚动 tab bar 统一重构为左侧可折叠 sidebar 导航，以支持日益增长的功能入口（概览、地球化、科技树、星区、Transit、空间站），并为未来扩展留出空间。

## 已确认方案（审核重点）

### 入口与组件

- 两个 production 视图（blueprint-production 和 live-production）均使用同一个共享 sidebar 组件。
- Sidebar 提供树形垂直导航，替代当前的 `StationTabBar.vue`（blueprint）和 `SectorStationTabBar.vue`（live）。
- 现有 `useProductionTabbarPresenter.ts` 重构为 `useProductionSidebarPresenter.ts`，数据模型（tab 列表构建逻辑）保持不变。

### Sidebar 结构

- **固定区**（顶部，始终可见，不可折叠）：概览 tab。（live 模式下追加：地球化、科技树。）
- **动态区**（下方，可折叠树形）：星区 → Transit + Station。（blueprint 模式下无星区分组，station 以平铺列表展示。）

### 折叠行为

- Sidebar 默认展开。
- 折叠/展开按钮位于 sidebar 顶部（概览上方）。
- 折叠后 sidebar 缩小为一条竖线/handle 区域，内容区自动扩展为全宽。

### workbenchMode 映射

- 概览 → `overview`
- 地球化 → `terraforming`
- 科技树 → `tech-tree`（新增，本 change 仅创建空壳路由和占位组件，不实现科技树内容）
- Transit → `transit`
- Station → `station`

### 内容区兼容性

- `workbenchMode` 逻辑和现有内容区渲染（overview / station / transit / terraforming）保持不变。
- blueprint 的 `overview`（BuildPlanConstraintsPanel + BuildPlanPanel + EmpireWareFlowsDashboard）和 `station`（StationPlanningPanel + StationWareFlowsDashboard + StationDashboard）保持不变。
- live 的四种模式完整保留，包括 terraforming 三栏布局。

### Context Toolbar 适配

- 现有 context toolbar 按 workbenchMode 渲染的逻辑不变。
- Sidebar 展开/折叠状态不影响 toolbar 的内容。
- 新增 `tech-tree` 模式时，toolbar 可承载对应的 context toolbar（本 change 可先复用 overview toolbar 或留空）。

### 科技树占位

- 本 change 仅在 sidebar 中添加科技树入口，并在 `workbenchMode` 中新增 `'tech-tree'`。
- 科技树页面内容（组件、store、presenter）不在本 change 范围内。

## 边界

### In Scope

- 新建 `LiveProductionSidebar.vue` 共享组件
- 重构 `useProductionTabbarPresenter.ts` 为 sidebar presenter
- 移除 `StationTabBar.vue` 和 `SectorStationTabBar.vue`
- 修改 `BlueprintProductionWorkbenchView.vue` 和 `LiveProductionWorkbenchView.vue` 以使用 sidebar
- `workbenchMode` 新增 `'tech-tree'` 空壳
- 折叠/展开交互及动画
- sidebar 的右键菜单保留（station tab 右键）

### Out of Scope

- 科技树页面内容（组件、store、presenter）
- terraforming 三栏布局的适配（保持不变）
- sidebar 拖拽调整宽度
- 移动端适配

## 验收标准（DoD）

1. blueprint-production 和 live-production 均显示左侧 sidebar，包含对应 tab 项。
2. Sidebar 项点击后，右侧内容区切换为对应 workbenchMode 内容，行为与当前 tab bar 一致。
3. Sidebar 顶部折叠按钮可正常收起/展开，折叠后内容区占满全宽。
4. 折叠状态下 sidebar 缩小为竖条/handle，保留展开入口。
5. 选中 tab 在 sidebar 中高亮，与内容区同步。
6. Station tab 右键菜单（重命名、删除等）在 sidebar 中可用。
7. blueprint 的 sidebar 不显示地球化、科技树、Transit、星区分组。
8. live 的 sidebar 显示地球化、科技树入口，点击后 content 区切换到对应模式（科技树为占位）。
9. 键盘/屏幕阅读器可访问（基本 a11y）。
10. `npm run build` 无编译错误。
11. 现有功能不受影响（station 规划、ware flow、dashboard、terraforming）。

## 未决项

- 科技树图标（暂用占位 icon）
- 折叠/展开是否需要过渡动画的缓动细节（实现时确认）
