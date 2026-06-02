# tasks.md — blueprint-view

## 实施任务

### 1. 类型定义

- [x] `src/types/x4.ts` 新增 `X4Blueprint`, `BlueprintTypeCategory`, `BlueprintClassCategory`, `BlueprintsData` 类型
- [x] `src/types/production-ui.ts` 中 `ProductionTabItem.type` union 增加 `'blueprint-recipe'`

### 2. Game Data 加载

- [x] `src/store/logic/useGameData.ts` 中 `GameDataFiles` 新增 `blueprints: BlueprintsData`
- [x] 在 `loadFolderGameData()` 中添加 `loadJsonFromBundle<BlueprintsData>(folderName, 'blueprints.json', loaders)`
- [x] `src/store/useGameDataStore.ts` 暴露 `blueprintsData` computed

### 3. Workbench 模式扩展

- [x] `src/store/useActiveViewStore.ts` 中 `ActiveViewState.activeEmpireWorkbench` 增加 `'blueprint-recipe'`
- [x] `src/store/useBlueprintProductionStore.ts` 新增 `selectBlueprintRecipe()` 方法
- [x] `resolveWorkbenchType()` 增加 `case 'blueprint-recipe'` 返回 `'blueprint-recipe'`
- [x] `session` computed 在 `blueprint-recipe` 时返回 `workbenchMode: 'blueprint-recipe'`

### 4. 侧边栏

- [x] `src/components/empire/presenters/useProductionSidebarPresenter.ts`:
  - 新增 `showBlueprintRecipe: boolean`（`!hasSectors`）
  - `SidebarPresenterStore` 接口新增 `selectBlueprintRecipe?: () => void`
  - `SidebarPresenterEmits` 新增 `selectBlueprintRecipe: () => void`
  - `emits` 实现 `selectBlueprintRecipe`
  - `props.activeTabId` 处理 `'blueprint-recipe'` 工作台模式
  - `SidebarPresenterProps` 新增 `showBlueprintRecipe: boolean`
- [x] `src/components/empire/ProductionSidebar.vue`:
  - Props 新增 `showBlueprintRecipe: boolean`
  - `fixedItems` 在 overview 之后、research 之前插入 `blueprint-recipe` 项
  - `getTabIcon` 处理 `'blueprint-recipe'` 返回新图标
  - `handleTabClick` 处理 `'blueprint-recipe'` 点击 → emit
  - `data-testid` 设为 `'sidebar-blueprint-recipe'`
  - Template 中 `isTabActive(item.id)` 的 UI 逻辑适配

### 5. Presenter 新建

- [x] 创建 `src/components/empire/presenters/useBlueprintRecipePresenter.ts`:
  - 接收 `gameDataStore`（读取 `blueprintsData`）
  - 构建 type → class 导航树
  - `selectedType` / `selectedClass` ref（UI 选中状态）
  - `searchQuery` ref
  - `filteredBlueprints` computed（按 selectedClass + searchQuery 过滤）
  - `navTree` computed（types/classes 分组结构）
  - 输出 props / emits

### 6. 蓝图配方页面组件

- [x] 创建 `src/components/empire/BlueprintRecipeWorkbench.vue`:
  - 左侧导航栏（PageNav）：type 分组可折叠，class 子项可点击
  - 右侧：搜索框 + 蓝图条目列表
  - 每条蓝图显示：本地化名称（i18n `nameId` + 回退 `name`）、id、class、price/licence/factions（有则显示）、missiononly/noplayerblueprint badge
  - 搜索为空时显示空状态
  - 无 ContextToolbar

### 7. 主视图集成

- [x] `src/components/empire/BlueprintProductionWorkbenchView.vue`:
  - 导入 `BlueprintRecipeWorkbench`
  - 导入并使用 `useBlueprintRecipePresenter`
  - 在 `BlueprintContextToolbar` 的 `v-if` 增加 `&& mode !== 'blueprint-recipe'`
  - 新增 `<BlueprintRecipeWorkbench v-if="mode === 'blueprint-recipe'" />`
  - 侧边栏事件增加 `@select-blueprint-recipe`

### 8. 图标与国际化

- [x] 创建 `src/components/icons/blueprint.svg`
- [x] `src/locales/zh-CN.json` 新增: `blueprint_recipe`, `search_blueprint`, `no_blueprint_found`, `mission_only`, `noplayerblueprint`
- [x] `src/locales/en.json` 新增对应英语键值

### 9. 构建验证

- [x] 执行 `npm run build` 确认编译通过
- [x] 修复构建中的 TypeScript 错误，迭代直到通过
