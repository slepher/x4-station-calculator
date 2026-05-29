# 任务：Tab Bar 重构为 Sidebar

## 1. 新增 Sidebar 组件

- [x] 1.1 新建 `src/components/empire/ProductionSidebar.vue`
  - 实现树形导航渲染（固定区 + 动态区）
  - 折叠按钮置于组件顶部
- [x] 1.2 实现 sidebar 折叠交互（展开 240px / 折叠 6px handle）
- [x] 1.3 实现默认选中态高亮样式（`bg-slate-800` + 左侧色条）
- [x] 1.4 实现固定区和动态区之间的分隔线
- [x] 1.5 实现星区展开/折叠箭头
- [x] 1.6 实现 station tab 右键菜单（depends on contextMenuMode）

## 2. 重构 Presenter

- [x] 2.1 新建 `useProductionSidebarPresenter.ts`（基于 tabbar presenter，新增 hasSectors/showTerraforming/showTechTree/selectTechTree）
- [x] 2.2 更新两个 view 文件的 import：`useProductionTabbarPresenter` → `useProductionSidebarPresenter`

## 3. 新增 workbenchMode

- [x] 3.1 `production-workbench-contract.ts`: workbenchMode 新增 `'tech-tree'`
- [x] 3.2 `useLiveProductionStore.ts`: 新增 `isTechTreeMode` computed、`selectTechTree()`、workbenchMode 联合

## 4. 科技树占位组件

- [x] 4.1 新建 `TechTreePlaceholder.vue`
- [x] 4.2 新增 i18n key `techTree.placeholder`（zh-CN + en）

## 5. 集成到 BlueprintProductionWorkbenchView

- [x] 5.1 布局改为横向（sidebar + 内容区）
- [x] 5.2 用 `ProductionSidebar` 替换 `StationTabBar`
- [x] 5.3 内容区包裹在 `production-content` flex 容器中

## 6. 集成到 LiveProductionWorkbenchView

- [x] 6.1 布局改为横向（sidebar + 内容区）
- [x] 6.2 用 `ProductionSidebar` 替换 `SectorStationTabBar`
- [x] 6.3 内容区包裹在 `production-content` flex 容器中
- [x] 6.4 按 `workbenchMode === 'tech-tree'` 渲染 `TechTreePlaceholder`
- [x] 6.5 保留现有 4 种 workbenchMode 的内容渲染逻辑

## 7. 清理

- [x] 7.1 删除 `StationTabBar.vue`
- [x] 7.2 删除 `SectorStationTabBar.vue`
- [x] 7.3 删除 `useProductionTabbarPresenter.ts`，更新 `check-production-compat.mjs` 引用
- [x] 7.4 更新类型文件（production-ui.ts, production-workbench-contract.ts, useActiveViewStore.ts）添加 `'tech-tree'`
- [x] 7.5 更新 toolbar/planning/dashboard/wareflow presenter 的 workbenchMode 类型
- [x] 7.6 更新 `BlueprintContextToolbar.vue` 的 workbenchMode prop 类型

## 8. 构建验证

- [x] 8.1 `npm run build` 通过，无编译错误
