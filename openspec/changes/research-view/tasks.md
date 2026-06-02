# tasks.md — research-view

## 连线修正任务

- [x] 1. 更新 research-view 文档，记录“保留卡片风格、改为真实 SVG edge 连线、station_modules 稳定分行”的设计。
- [x] 2. 为 station_modules 布局新增聚焦单元测试，覆盖 8 条空间站模块主链边、福利链、venture 独立行。
- [x] 3. 抽出 research layout helper，让 station_modules 使用稳定分行并保留通用 DAG 布局作为其他分组默认路径。
- [x] 4. 将 ResearchWorkbench 的层间箭头替换为 SVG edge overlay 和左右端口，不改变卡片主体风格。
- [x] 5. 运行聚焦单测与构建验证。

## 实施任务

### 1. 数据层：加载 research.json

- `src/types/x4.ts`: 添加 `X4ResearchItem`, `X4ResearchData`, `X4ResearchUnlock`, `X4ResearchUnlockParams`
- `src/store/logic/useGameData.ts`: 添加 `X4ResearchData` 导入 + `research.json` 加载 + `GameDataFiles.research`
- `src/store/useGameDataStore.ts`: 添加 `researchData` ref + 赋值 + 暴露

### 2. Store + 类型：selectResearch + workbench 模式

- `src/store/useActiveViewStore.ts`: `activeEmpireWorkbench` 类型添加 `'research'`
- `src/store/useBlueprintProductionStore.ts`: 添加 `selectResearch()` + `resolveWorkbenchType()`
- `src/types/production-ui.ts`: `ProductionTabItem.type` 添加 `'research'`
- `src/types/production-workbench-contract.ts`: `workbenchMode` 和 `entityType` 添加 `'research'`

### 3. workbenchMode 类型传播

所有引用 `workbenchMode` 类型的地方添加 `'research'`：

- `src/components/empire/presenters/useProductionToolbarPresenter.ts`
- `src/components/empire/presenters/useProductionDashboardPresenter.ts`
- `src/components/empire/presenters/useProductionWareflowPresenter.ts`
- `src/components/empire/presenters/useProductionPlanningPresenter.ts`
- `src/components/empire/presenters/useProductionSidebarPresenter.ts` (SidebarPresenterStore)
- `src/components/empire/context_toolbar/BlueprintContextToolbar.vue`

### 4. Sidebar 菜单项

- `src/components/empire/presenters/useProductionSidebarPresenter.ts`:
  - Props: 添加 `showResearch: boolean`
  - Emits: 添加 `selectResearch: () => void`
  - Store 接口: 添加 `selectResearch?(): void`
  - activeTab: `workbenchMode === 'research'` → return `'research'`
  - 实现: `showResearch = !hasSectors`, `selectResearch: () => (store.selectResearch || (() => {}))()`
- `src/components/empire/ProductionSidebar.vue`:
  - Props: 添加 `showResearch: boolean`
  - Emits: 添加 `selectResearch: []`
  - fixedItems: showResearch 时在 overview 后 terraforming 前插入
  - handleTabClick: `tab.id === 'research'` → emit selectResearch

### 5. Workbench 入口

- `src/components/empire/BlueprintProductionWorkbenchView.vue`:
  - 导入 `ResearchWorkbench`
  - 添加 `:show-research` prop + `@select-research` emit
  - 条件渲染: `v-if="workbenchMode === 'research'"`
- `src/components/empire/LiveProductionWorkbenchView.vue`:
  - 添加 `:show-research` prop + `@select-research` emit（不渲染视图本身）

### 6. ResearchWorkbench.vue

单文件，全宽布局 + Teleport 弹出面板 + DAG 拓扑排列：

- Script: 内联所有逻辑
- `layoutGroups` computed: 对每组计算连通分量 → 拓扑分层
  - 无依赖的组 → flat row（CSS grid 平铺）
  - 有依赖的组 → `research-chain`（flex, 每层一个 `chain-layer` 纵列, 层间 `→` 箭头）
  - 超宽链 `overflow-x: auto` 横向滚动
- `makeLayers(row)`: 将 nodes 按 layer 字段归组为多层数组
- 节点卡片显示名称(i18n)、时间、资源种类、条件标签、前置依赖、备注
- 弹出面板: Teleport to="body"、overlay 背景、详情（基本信息/消耗/依赖/unlock/备注）
- DLC: `dlcs.find(ego_dlcTag)` → `t(dlc.nameId)`
- 消耗品名: `localizedWaresMap[wareId]` → `t(ware.nameId)`

### 7. App locale (i18n keys)

在 `src/locales/en.json` + `src/locales/zh-CN.json` 添加 46 个 key：

- `research.show_conditional`, `research.loading`, `research.resource_count`, `research.tag_conditional`, `research.deps_prefix`
- `research.note.mission_progress`
- `research.detail.basic`, `.research_time`, `.instant`, `.category`, `.cost`, `.dependencies`, `.unlock`, `.notes`
- `research.category.default`, `.conditional`, `.abandoned`, `.mission_progress`
- `research.unlock.embassy`, `.xen_equipment`, `.xenon_crisis_01`, `.xenon_crisis_02`, `.erlking`, `.condensate_sample`, `.interference_network`, `.tf_tech`, `.abandoned_ship`, `.abandoned_ship_nosector`
- `research.group.teleport`, `.station_modules`, `.ship_mods`, `.hq_base`, `.diplomacy`, `.xenon_crisis`, `.abandoned_ships`, `.pirate_dlc`, `.terran_dlc`, `.xen_equipment`

### 8. 构建验证

- 执行 `npm run build` 确认编译通过
