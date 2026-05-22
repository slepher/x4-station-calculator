# save-binding-jump 设计文档

## 架构概览

本 change 的核心设计是将地图面板的 UI 状态（面板开关、绑定上下文、面板层级）从组件本地 ref 收归到 `useActiveViewStore`，使这些状态在视图切换时不丢失。在此基础上，在 `SaveList.vue` 中新增绑定按钮作为跳转入口。

```
SaveList.vue                              MapWorkbenchView.vue
───────────                               ─────────────────────
bindArchive(guid, time)                    读取 store 状态渲染面板
  │                                        isSavePanelOpen ← store
  ├─ createOrOpenBinding()                 isResourcePanelOpen ← store
  ├─ selectArchive()                       isBindingPanelOpen ← 派生 computed
  ├─ 设置 store: isSavePanelOpen=true      mapBindingGameGuid ← store
  │              mapSavePanelLayer=...      mapBindingStage ← store
  │              mapBindingGameGuid=...     drag* ← 派生 computed
  └─ setActiveView('maps')
                                           MapSavePanel.vue
                                           ─────────────────
                                           读取/写入 store 状态
                                           layer ← store.mapSavePanelLayer
                                           selectedBindingGameGuid ← store.mapBindingGameGuid
                                           selectedSectorGroupId ← store.mapSavePanelSectorGroupId
```

## 核心决策

### 1. 面板状态收归 useActiveViewStore 而非 useMapStore

- `useMapStore` 管理地图领域数据（sectors, resources, viewport geometry），是纯数据层
- `useActiveViewStore` 管理跨视图的导航/上下文状态，面板开关和绑定阶段属于此范畴
- 这些状态需要跨视图持久化，正是 `useActiveViewStore` 的职责

### 2. 派生 computed 替代冗余持久化字段

`isBindingPanelOpen` 和 `dragEnabledBindingSectorGroupId` 原本是独立的 `ref`，但它们严格由 `mapBindingStage` 和 `mapSavePanelSectorGroupId` 派生：

- `isBindingPanelOpen` ⇔ `mapBindingStage !== 'select-binding'`
- `mapDragBindingSectorGroupId` ⇔ `mapBindingStage === 'select-station' ? mapSavePanelSectorGroupId : null`

将它们作为派生 computed 而非持久化字段，避免了不一致风险和冗余写入。

### 3. MapSavePanel.selectedBindingGameGuid 与 bindingContextGameGuid 统一

`MapSavePanel.selectedBindingGameGuid` 在设置后通过 `context-change` emit 传给 `MapWorkbenchView.bindingContextGameGuid`，两者实质相同。收归后统一为 `mapBindingGameGuid`。

### 4. MapSavePanel.open watcher 调整

原逻辑：
```ts
watch(() => props.open, (open) => {
  if (open) { resetToList() }
  else { resetToList() }
})
```

每次 `open` 变为 `true` 都重置 layer 为 `'list'`，会覆盖从 live-production 跳转时预设的 `'binding-sector'` 层级。

调整后：
```ts
watch(() => props.open, (open, prev) => {
  if (open && !prev && !isBindingLayer.value) { resetToList() }
  if (!open) { resetToList() }
})
```

仅在 `open` 从 `false` → `true` 且当前层级不在 binding 阶段时才 resetToList，保护跳转预设。

### 5. SaveList 绑定按钮复用 MapSaveArchiveList 的 `shouldShowGroupBindActive` / `shouldShowTimeBindActive` 逻辑

`SaveList` 不重新实现判断逻辑，直接 import `MapSaveArchiveList` 中使用的判断函数（或将其提取为共享工具函数）。

## 数据流

### 跳转流程数据流

```
用户点击绑定按钮
  │
  ├─── saveBindingStore.createOrOpenBinding(guid, time)
  │     └─ 创建或打开 binding draft
  │
  ├─── saveStore.selectArchive(guid, time)
  │     └─ 选中对应存档
  │
  ├─── activeViewStore.isSavePanelOpen = true
  ├─── activeViewStore.mapSavePanelLayer = 'binding-sector'
  ├─── activeViewStore.mapBindingGameGuid = guid
  │     └─ 这些状态持久化到 localStorage
  │
  └─── activeViewStore.setActiveView('maps')
        └─ MainWorkbench 卸载 LiveProductionWorkbenchView
        └─ 挂载 MapWorkbenchView
              │
              ├─── 读取 store: isSavePanelOpen → true
              ├─── 读取 store: mapSavePanelLayer → 'binding-sector'
              ├─── 渲染 MapSavePanel :open="isSavePanelOpen"
              │     │
              │     ├─── layer get: store.mapSavePanelLayer → 'binding-sector'
              │     ├─── watch props.open: 首次挂载时 open=true, prev=undefined
              │     │   检查: 不在 binding 层? 实际上在。→ 不 reset
              │     ├─── 渲染 MapBindingSectorGroup
              │     └─── context-change emit: stage='select-sector'
              │           └─ onBindingContextChange 更新 mapBindingStage
              │
              └─── isBindingPanelOpen 派生为 true
                    └─ binding-sidebar-active CSS class
```

### 持久化

所有新增字段写入 `x4_station_active_view` localStorage key。`saveToStorage` / `loadFromStorage` 需做向后兼容处理：旧数据无 `mapSavePanelLayer` 等字段时使用默认值。

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/store/useActiveViewStore.ts` | 修改 | 新增 6 个字段 + 2 个派生 computed + persist 逻辑 |
| `src/components/save/SaveList.vue` | 修改 | 移除下载按钮，新增绑定按钮和 bindArchive 函数 |
| `src/components/map/MapSavePanel.vue` | 修改 | layer/selectedBindingGameGuid/selectedSectorGroupId → store, open watcher 调整 |
| `src/components/map/MapWorkbenchView.vue` | 修改 | 面板 ref/binding context ref → store computed, onBindingContextChange 简化 |
