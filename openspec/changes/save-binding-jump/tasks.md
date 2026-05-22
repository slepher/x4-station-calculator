# save-binding-jump 实施任务

## Task 1: useActiveViewStore 新增地图面板状态字段

- [x] 在 `ActiveViewState` 接口中新增 6 个字段：`isResourcePanelOpen`、`isSavePanelOpen`、`mapBindingGameGuid`、`mapBindingStage`、`mapSavePanelLayer`、`mapSavePanelSectorGroupId`
- [x] 在 `DEFAULT_STATE` 中设置默认值
- [x] 在 `loadFromStorage` 中添加向后兼容逻辑（旧数据无这些字段时使用默认值）
- [x] 为 `isResourcePanelOpen` 和 `isSavePanelOpen` 创建 computed get/set
- [x] 为 `mapBindingGameGuid`、`mapBindingStage`、`mapSavePanelLayer`、`mapSavePanelSectorGroupId` 创建 computed get/set
- [x] 新增 2 个派生 computed：`isBindingPanelOpen`（`=> mapBindingStage !== 'select-binding'`）、`mapDragBindingSectorGroupId`（`=> mapBindingStage === 'select-station' ? mapSavePanelSectorGroupId : null`）
- [x] 在 store 的 return 中暴露所有新增字段和 computed

## Task 2: MapWorkbenchView 面板状态迁移

- [x] 移除本地 ref：`isResourcePanelOpen`、`isSavePanelOpen`、`isBindingPanelOpen`、`bindingContextGameGuid`、`bindingContextStage`、`dragEnabledBindingSectorGroupId`
- [x] 使用 `storeToRefs(activeViewStore)` 获取响应式 ref：`isResourcePanelOpen`、`isSavePanelOpen`、`isBindingPanelOpen`、`bindingContextGameGuid`、`bindingContextStage`、`dragEnabledBindingSectorGroupId`
- [x] `onBindingContextChange` 简化：只更新 `bindingContextStage` 和 `bindingContextGameGuid`，移除 `isBindingPanelOpen` 和 `dragEnabledBindingSectorGroupId` 的直接赋值
- [x] `onSavePanelClose` / `onResourcePanelOpen` / `onSavePanelOpen` 中 `isBindingPanelOpen.value = false` 改为 `bindingContextStage = 'select-binding'`

## Task 3: MapSavePanel 内部状态迁移

- [x] 使用 `storeToRefs(activeViewStore)` 获取响应式 ref：`layer`、`selectedBindingGameGuid`（→ `mapBindingGameGuid`）、`selectedSectorGroupId`（→ `mapSavePanelSectorGroupId`）
- [x] `context-change` emit 中读取均通过 store 响应式 ref
- [x] 调整 `watch(() => props.open)` 逻辑：仅在 `open` 从 `false` → `true` 且 `layer` 不在 binding 层级时调用 `resetToList()`
- [x] 保留 `selectedCategory` 为本地 ref（内部 POI 导航状态，非面板级状态）

## Task 4: SaveList 新增绑定按钮、移除下载按钮

- [x] 移除模板中的下载按钮（`download-btn`）
- [x] 移除 `downloadArchive` 函数
- [x] 移除 `.download-btn` 样式
- [x] import `useSaveBindingStore` 和 `useActiveViewStore`
- [x] 新增 `getBindingPlan`、`isGuidLevelBinding`、`isTimeLevelBinding`、`shouldShowBindActive` 判断函数
- [x] 移除 group header 中的存档数量显示（`archive-count`）
- [x] 在每个有效存档条目的 `save-actions` 区域新增绑定按钮
  - 仅当 `archive.isValid` 时渲染（`v-if="archive.isValid"`）
  - 使用 chain-link SVG 图标
  - active 高亮：`shouldShowBindActive(group, archive.meta.time)` 时添加 `bind-btn--active` 样式
  - `@click.stop` 调用 `bindArchive(group.guid, archive.meta.time)`
- [x] 新增 `bindArchive(guid, time)` 函数：执行跳转逻辑（createBinding → selectArchive → setStore → switchView）

## Task 5: 构建验证

- [x] 实现完成后执行 `npm run build`
- [x] 无 TypeScript 编译错误（唯一的 TS6133 是 `StationTabBar.vue` 的预存错误，与本次变更无关）
