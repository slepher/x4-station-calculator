# 自动星区划分接入 Map — 任务列表

## 1. Presenter 抽取

- [x] 创建 `src/components/empire/presenters/useAutoSectorGroupPresenter.ts`
- [x] 将 `SectorOverviewPanel.vue` 中的所有 `ref()` 声明迁移到 presenter
- [x] 将 `SectorOverviewPanel.vue` 中的所有 `computed()` 派生迁移到 presenter
- [x] 将 `runAutoGroup()` 及其调用链迁移到 presenter（含 `buildStoreGroups`、`getPlayerSectorMacrosFromArchive`、`hasUngroupedPlayerSectors`）
- [x] 将 `enterEditMode()`、`cancelEdit()`、`runCalculationFromEditInput()` 迁移到 presenter
- [x] 将 `confirmAndWrite()` 迁移到 presenter
- [x] 将 add/remove/toggle group、coverage/connection 修改方法迁移到 presenter
- [x] 将 `selectAssignmentOption()`、`selectBridgePlan()` 迁移到 presenter
- [x] 将 `getSectorDisplayName()`、`setAutoGroupResult()`、`cloneAutoGroupResult()` 迁移到 presenter
- [x] presenter 监听 `liveProductionStore` 的自动分组检查 flag，匹配当前 binding 时执行 `runAutoGroup()`
- [x] presenter 在自动分组执行完成后调用 store API 清除自动分组检查 flag
- [x] 重构 `SectorOverviewPanel.vue`：移除直接 store import，改为通过 presenter 获取所有状态和方法
- [x] 确认 `SectorOverviewPanel.vue` 不再直接 import `useSaveBindingStore`、`useLiveProductionStore`

## 2. liveProductionStore 自动检查

- [x] `useLiveProductionStore.ts` 新增自动分组检查 flag 状态（含 gameGuid/reason）
- [x] `useLiveProductionStore.ts` 新增检查当前 binding 玩家 sector 是否全部归组的方法
- [x] 刷新恢复 active binding / selected archive 后触发自动分组检查
- [x] 手动切换 active binding 后触发自动分组检查
- [x] 上传新存档或 archive timing 切换导致 selected archive 变化后触发自动分组检查
- [x] `useLiveProductionStore.ts` 新增清除自动分组检查 flag 的方法

## 3. 子组件 view prop 适配

- [ ] `SectorGroupList.vue` 新增 `view: 'map' | 'live'` prop，默认 `'live'`
- [ ] `SectorGroupList.vue` map view 下：紧凑样式（pill 高度 22px，gap 4px，padding 8px）
- [ ] `SectorGroupList.vue` map view 下：pill 点击 emit `focus-sector`（携带 sectorMacro）
- [x] `SectorGroupList.vue` map view 下：集成 `vuedraggable` 包裹 group cards
- [ ] `SectorGroupList.vue` 支持完成态 group 进入 station binding 按钮，按钮图标保持旧 `MapBindingSectorGroup` 图标
- [ ] `SectorGroupList.vue` 不再提供旧的单 group 编辑按钮
- [ ] `SectorAllocationList.vue` 新增 `view: 'map' | 'live'` prop，默认 `'live'`
- [ ] `SectorAllocationList.vue` map view 下：card 自适应侧边栏宽度
- [ ] `SectorAllocationList.vue` map view 下：sector 名点击 emit `focus-sector`
- [ ] `SectorConfirmBar.vue` 新增 `view: 'map' | 'live'` prop，默认 `'live'`，保留现有 `mode: 'result' | 'edit'`
- [ ] `SectorConfirmBar.vue` map view 下：紧凑排列控件，隐藏冗余标签

## 4. Map wrapper 创建

- [ ] 创建 `src/components/map/AutoSectorGroupMapPanel.vue`
- [ ] 实现 `gameGuid` prop 和 `select-group`/`focus-sector`/`fit-sectors` emits
- [ ] 实现 map 上下文 tab 切换（Hub / 分配方案），默认显示 Hub tab
- [ ] Hub tab 渲染 `SectorConfirmBar(view='map')` + `SectorGroupList(view='map')`
- [ ] 分配方案 tab 渲染 `SectorAllocationList(view='map')` + `AllocationConfirmBar`
- [ ] map 编辑态禁用分配方案 tab，禁止切换到 `SectorAllocationList`
- [ ] map 完成态不显示 tab，不显示 `SectorAllocationList`
- [ ] map 完成态在 group 上显示进入 station binding 按钮并 emit `select-group`
- [ ] map 上下文下 `focus-sector` 事件 relay：接收子组件 emit → 向上 emit 到 Map Panel
- [ ] Hub 添加菜单根据 view 选择组件：map → `MapBindSectorMenu`，live → `SectorHubAddMenu`
- [ ] `MapBindSectorMenu` 集成：接收 add-hub sectorMacro → presenter.addHubDraft()

## 5. Map 面板替换

- [ ] `MapSavePanel.vue`：移除 `import MapBindingSectorGroup`，替换为 `import AutoSectorGroupMapPanel`
- [ ] `MapSavePanel.vue` binding-sector 层模板替换为 `<AutoSectorGroupMapPanel :game-guid="selectedBindingGameGuid" @select-group="onSelectBindingGroup" @focus-sector="..." @fit-sectors="..." />`
- [ ] 确保 `focus-sector`/`fit-sectors` 事件在 `MapSavePanel` → `MapWorkbenchView` 链路中正确 relay
- [ ] 确保 `MapSavePanel` 保持原有 binding context-change emission
- [ ] 清理无生产入口的 `src/components/map/MapBindingPanel.vue`
- [ ] 删除 `src/components/map/MapBindingSectorGroup.vue`

## 6. Live overview 适配

- [x] `SectorOverviewPanel.vue` 保持三列布局：Col 1 存档、Col 2 `SectorConfirmBar + SectorGroupList`、Col 3 allocation 或完成态内容
- [x] live edit 模式下 Col 3 allocation 区域显示遮罩并禁用操作
- [x] live 完成态不显示 `SectorAllocationList`
- [x] 确保 live 侧自动分组功能不受影响

## 7. 排序持久化

- [x] 拖拽排序只更新 presenter 中 `groups` 数组顺序
- [x] `confirmAndWrite()` / `createAutoGroups()` 按 drafts 数组顺序保存 group
- [x] 不以 `order` 字段作为排序权威；如保存时必须写 `order`，仅按数组 index 写入兼容值

## 8. i18n

- [ ] `zh-CN.json` 新增 `auto_sector.hub_tab`: "枢纽"、`auto_sector.allocation_tab`: "分配方案"、`auto_sector.edit_overlay_hint`: "编辑输入中，分配面板暂不可操作"
- [ ] `en.json` 新增 `auto_sector.hub_tab`: "Hub"、`auto_sector.allocation_tab`: "Allocation"、`auto_sector.edit_overlay_hint`: "Editing in progress, allocation panel is temporarily unavailable"
- [ ] 删除或停止引用 `MapBindingSectorGroup` 独有的 i18n key（如有）

## 9. 构建验证

- [x] `npm run build` 通过
