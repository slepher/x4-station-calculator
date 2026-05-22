# save-binding-jump 需求

## 目标

为 Live Production 总览界面的存档列表新增"绑定"按钮，点击后跳转到地图界面并自动打开绑定流程（效果等同于在地图界面存档栏点击绑定按钮）。同时移除存档列表中的"下载 JSON"按钮。

## 已确认方案（审核重点）

### 入口：SaveList 绑定按钮

- 在 `SaveList.vue` 中为每个存档条目新增绑定按钮，同时在 group header（玩家名右侧）新增 GUID 级别的绑定按钮。
- 绑定按钮的视觉表现：非激活态 `text-amber-200/35`，hover `text-amber-50`，激活态 `text-amber-100`，与 `MapSaveArchiveList.vue` 的琥珀色系一致。
- 绑定按钮仅对有效存档（`archive.isValid` 为 `true`）渲染；GUID 级别按钮始终显示。
- 移除 `SaveList.vue` 中的下载按钮（模板 `download-btn`、函数 `downloadArchive`、样式 `.download-btn`）。
- 移除 group header 中的存档数量显示（`archive-count`），为绑定按钮腾出空间。
- GUID 级别绑定按钮与存档级别绑定按钮垂直对齐：使用不可见的占位按钮（`invisible pointer-events-none`）填充 remove-btn 位置，确保两侧宽度一致。

### SaveList 删除确认弹窗

- 删除存档时弹出确认 modal，不再使用 `window.confirm()` 或 `alert()`。
- Modal 样式参照 `StationTabBar.vue` 的删除确认模式：遮罩层 `modal-backdrop` + 卡片 `modal-card`。
- 新增 i18n key `save_import.confirm_remove`（中: "确定要删除存档 {filename} 吗？此操作不可撤销。" / 英: "Are you sure you want to delete archive \"{filename}\"? This action cannot be undone."）。

### SaveList 绑定分组视觉容器

- 绑定状态下的 group 使用 `archive-group--bound` 类，参照 `MapSaveArchiveList` 的 group container 风格。
- 普通 group：`border-slate-700/40` 细边框 + `bg-transparent`
- 绑定 group：`border-blue-400/30 bg-blue-500/5` 蓝色边框和底色，包含整个 header + 所有存档条目
- save-item 补充 `border-slate-700/30` 卡片式边框，hover 提亮

### 跳转流程

点击绑定按钮时执行以下步骤：

1. 调用 `saveBindingStore.createOrOpenBinding(guid, time)` 创建或打开 binding。
2. 通过 `saveStore.selectArchiveGroup(guid)` 或 `saveStore.selectArchive(guid, time)` 选中存档。
3. 设置地图面板状态：`isSavePanelOpen = true`，`mapSavePanelLayer = 'binding-sector'`，`mapBindingGameGuid = guid`。
4. 调用 `activeViewStore.setActiveView('maps')` 切换到地图视图。

### 地图面板状态收归 useActiveViewStore

将 `MapWorkbenchView` 和 `MapSavePanel` 中的面板相关本地 ref 收归 `useActiveViewStore` 统一管理，使面板状态在视图切换时持久化。

**新增持久化字段（写入 `ActiveViewState` 并持久化到 `localStorage`）：**

| 字段 | 类型 | 默认值 | 来源组件 |
|------|------|--------|---------|
| `isResourcePanelOpen` | `boolean` | `false` | `MapWorkbenchView` L153 |
| `isSavePanelOpen` | `boolean` | `false` | `MapWorkbenchView` L154 |
| `mapBindingGameGuid` | `string \| null` | `null` | 合并自 `MapWorkbenchView.bindingContextGameGuid` (L181) 和 `MapSavePanel.selectedBindingGameGuid` (L41) |
| `mapBindingStage` | `'select-binding' \| 'select-sector' \| 'select-station'` | `'select-binding'` | `MapWorkbenchView.bindingContextStage` (L182) |
| `mapSavePanelLayer` | `'list' \| 'category' \| 'coord' \| 'binding-sector' \| 'binding-station'` | `'list'` | `MapSavePanel.layer` (L39) |
| `mapSavePanelSectorGroupId` | `string \| null` | `null` | `MapSavePanel.selectedSectorGroupId` (L42) |

**派生 computed（不持久化）：**

| 名称 | 推导方式 | 替代的 ref |
|------|---------|-----------|
| `isBindingPanelOpen` | `mapBindingStage !== 'select-binding'` | `MapWorkbenchView.isBindingPanelOpen` (L155) |
| `mapDragBindingSectorGroupId` | `mapBindingStage === 'select-station' ? mapSavePanelSectorGroupId : null` | `MapWorkbenchView.dragEnabledBindingSectorGroupId` (L183) |

### MapSavePanel 适配

- `layer`、`selectedSectorGroupId` 改为 `activeViewStore` 的 computed get/set。
- `selectedBindingGameGuid` 替换为 `mapBindingGameGuid`（与 `MapWorkbenchView.bindingContextGameGuid` 统一）。
- `watch(() => props.open)` 调整为：仅在 `open` 从 `false` → `true` 且 `mapSavePanelLayer` 不在 binding 层级（`binding-sector` / `binding-station`）时调用 `resetToList()`，避免覆盖跳转时预设的 binding sector 层级。

### MapWorkbenchView 适配

- `isResourcePanelOpen`、`isSavePanelOpen`、`isBindingPanelOpen`、`bindingContextGameGuid`、`bindingContextStage`、`dragEnabledBindingSectorGroupId` 替换为 `activeViewStore` 的 computed get/set（或派生 computed）。
- `onBindingContextChange` 移除 `isBindingPanelOpen` 赋值（由派生 computed 自动计算）。
- `onSavePanelClose` / `onResourcePanelOpen` / `onSavePanelOpen` 中 `isBindingPanelOpen` 重置改为重置 `mapBindingStage` 为 `select-binding`。

## 边界

### In Scope

- `SaveList.vue`：移除下载按钮和存档计数、新增 GUID 级别和时间级别绑定按钮、删除确认弹窗、绑定分组视觉容器
- `useActiveViewStore`：新增 6 个持久化字段 + 2 个派生 computed、导出 `BindingStage`/`MapSavePanelLayer` 类型
- `MapSavePanel.vue`：`layer`/`selectedBindingGameGuid`/`selectedSectorGroupId` 迁移到 `storeToRefs(activeViewStore)`，调整 `open` watcher 逻辑
- `MapWorkbenchView.vue`：面板 ref 和 binding context ref 替换为 `storeToRefs(activeViewStore)`
- `src/locales/en.json, zh-CN.json`：新增 `save_import.confirm_remove`

### Out of Scope

- 地图视图中已存在的绑定流程和拖拽功能
- `SaveList.vue` 用于其他页面的场景（确认当前仅用于 Live Production 总览）
- `useSaveStore.exportToJson` 函数删除（仅移除 UI 按钮，后端函数保留）

## 验收标准（DoD）

1. `SaveList.vue` 中不再有下载按钮和存档计数。
2. `SaveList.vue` 中每个有效存档条目有绑定按钮，GUID 级别 group header 也有绑定按钮，点击后成功跳转到地图界面并自动打开 binding sector 面板。
3. 删除存档时有确认弹窗，取消则不做删除。
4. 绑定状态下的 group 有蓝色边框和底色视觉容器。
5. 地图界面的面板状态（存档面板开关、绑定阶段、sector 分组）在 live-production ↔ maps 之间切换时不丢失。
6. `MapSavePanel` 各层级导航功能不受影响。
7. `MapWorkbenchView` 中各面板打开/关闭/切换行为不受影响。
8. `useActiveViewStore` 新增状态正确持久化到 `localStorage`（`x4_station_active_view` key）。
9. 无 TypeScript 编译错误。
10. 构建通过（`npm run build`）。

## 未决项

无
