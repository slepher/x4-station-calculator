# Save Binding Jump Specification

## Purpose

定义从 Live Production 总览存档列表直接跳转到地图绑定界面的入口行为，以及地图面板状态在 `useActiveViewStore` 中的统一管理规范。

## ADDED Requirements

### Requirement: SaveList Bind Button

Live Production 总览界面的存档列表 MUST 为每个有效存档提供"绑定"按钮，点击后直接跳转到地图绑定界面。

#### Scenario: 绑定按钮显示条件

**前提** 用户位于 Live Production 总览界面
**当** `SaveList` 渲染存档条目
**那么** 仅当 `archive.isValid` 为 `true` 时渲染绑定按钮
**并且** 无效存档（`isValid` 为 `false`）的条目 MUST NOT 渲染绑定按钮

#### Scenario: 绑定按钮视觉表现

**前提** `SaveList` 渲染了绑定按钮
**当** 用户未 hover 该存档条目
**那么** 绑定按钮 MUST 采用 `opacity-0` 隐藏，hover 时过渡为 `opacity-100`
**并且** 当该 `(guid, time)` 已存在 binding 时，按钮 MUST 显示 `--active` 高亮态
**并且** 显示条件与 `MapSaveArchiveList.vue` 的 `shouldShowGroupBindActive` / `shouldShowTimeBindActive` 保持一致

#### Scenario: 点击绑定按钮执行跳转

**前提** 用户位于 Live Production 总览界面
**并且** 某个存档条目存在绑定按钮
**当** 用户点击绑定按钮
**那么** 系统 MUST 依次执行：
1. 调用 `saveBindingStore.createOrOpenBinding(guid, time)` 创建或打开 binding
2. 若 `time` 为 `null`（group-level bind），调用 `saveStore.selectArchiveGroup(guid)`；否则调用 `saveStore.selectArchive(guid, time)`
3. 设置 `activeViewStore.isSavePanelOpen = true`
4. 设置 `activeViewStore.mapSavePanelLayer = 'binding-sector'`
5. 设置 `activeViewStore.mapBindingGameGuid = guid`
6. 调用 `activeViewStore.setActiveView('maps')` 切换到地图界面
**并且** 地图界面 MUST 自动显示 binding sector 面板

### Requirement: Download Button Removal

Live Production 总览界面的存档列表 MUST NOT 包含下载 JSON 按钮。

#### Scenario: SaveList 无下载按钮

**前提** `SaveList.vue` 组件被渲染
**当** 系统渲染存档条目
**那么** 每个存档条目的 `save-actions` 区域 MUST NOT 包含 `download-btn`
**并且** `downloadArchive` 函数 MUST 从组件中移除
**并且** `.download-btn` 样式 MUST 从 `<style scoped>` 中移除

### Requirement: Map Panel State Centralization

地图界面的面板开关、绑定上下文和面板层级状态 MUST 由 `useActiveViewStore` 统一管理，不随视图切换而丢失。

#### Scenario: 面板状态在视图切换中持久化

**前提** 用户在地图界面打开了存档面板并进入 binding sector
**当** 用户切换到其他视图（如 live-production、blueprint-production）后再切换回地图
**那么** 存档面板 MUST 保持打开状态
**并且** 面板层级 MUST 保持在离开时的位置

#### Scenario: 从 live-production 跳转到地图绑定界面

**前提** 用户从 Live Production 总览点击绑定按钮
**当** 视图切换到地图界面
**那么** 存档面板 MUST 自动打开
**并且** 面板 MUST 处于 `binding-sector` 层级
**并且** selected binding GUID MUST 为跳转时设置的 `mapBindingGameGuid`

### Requirement: Map Panel State Fields

`useActiveViewStore` MUST 新增以下持久化字段用于管理地图面板状态。

#### Scenario: 新增字段定义

**前提** `useActiveViewStore` 被初始化
**当** 系统加载 `ActiveViewState`
**那么** 以下字段 MUST 存在：

| 字段 | 类型 | 默认值 |
|------|------|--------|
| `isResourcePanelOpen` | `boolean` | `false` |
| `isSavePanelOpen` | `boolean` | `false` |
| `mapBindingGameGuid` | `string \| null` | `null` |
| `mapBindingStage` | `'select-binding' \| 'select-sector' \| 'select-station'` | `'select-binding'` |
| `mapSavePanelLayer` | `'list' \| 'category' \| 'coord' \| 'binding-sector' \| 'binding-station'` | `'list'` |
| `mapSavePanelSectorGroupId` | `string \| null` | `null` |

**并且** 这些字段 MUST 参与 `saveToStorage` / `loadFromStorage` 持久化循环

#### Scenario: 派生 computed 定义

**前提** `useActiveViewStore` 已加载状态
**当** 系统需要判断 binding panel 是否打开
**那么** `isBindingPanelOpen` MUST 派生为 `mapBindingStage !== 'select-binding'`
**并且** `mapDragBindingSectorGroupId` MUST 派生为 `mapBindingStage === 'select-station' ? mapSavePanelSectorGroupId : null`

### Requirement: MapSavePanel State Migration

`MapSavePanel.vue` 的本地状态 MUST 迁移到 `useActiveViewStore`。

#### Scenario: layer 状态迁移

**前提** `MapSavePanel` 需要读写 `layer`
**当** 组件访问或修改面板层级
**那么** `layer` MUST 替换为 `activeViewStore.mapSavePanelLayer` 的 computed get/set
**并且** 对 `layer.value` 的赋值 MUST 改为对 `layer.value` 的赋值（通过 computed setter 写入 store）

#### Scenario: selectedBindingGameGuid 统一

**前提** `MapSavePanel` 需要设置当前绑定的 gameGuid
**当** `proceedToBinding` 执行 `selectedBindingGameGuid.value = payload.guid`
**那么** `selectedBindingGameGuid` MUST 替换为 `activeViewStore.mapBindingGameGuid` 的 computed get/set
**并且** `context-change` emit 中的 `gameGuid` MUST 改为直接读取 `mapBindingGameGuid`

#### Scenario: selectedSectorGroupId 迁移

**前提** `MapSavePanel` 需要设置选中的 sectorGroupId
**当** `onSelectBindingGroup` 执行 `selectedSectorGroupId.value = sectorGroupId`
**那么** `selectedSectorGroupId` MUST 替换为 `activeViewStore.mapSavePanelSectorGroupId` 的 computed get/set

#### Scenario: open watcher 适配

**前提** 用户从 live-production 跳转到地图，`isSavePanelOpen` 已在 store 中设为 `true`
**并且** `mapSavePanelLayer` 已设为 `'binding-sector'`
**当** `MapSavePanel` 挂载并执行 `watch(() => props.open)`
**那么** 回调 MUST 仅在 `open` 从 `false` → `true` 且 `mapSavePanelLayer` 不在 binding 层级（`'binding-sector'` / `'binding-station'`）时调用 `resetToList()`
**并且** MUST NOT 覆盖跳转时预设的 binding sector 层级

### Requirement: MapWorkbenchView State Migration

`MapWorkbenchView.vue` 的面板相关本地 ref MUST 替换为 `useActiveViewStore` 的 computed 或派生 computed。

#### Scenario: 面板开关迁移

**前提** `MapWorkbenchView` 需要读写面板开关状态
**当** 组件访问 `isResourcePanelOpen`、`isSavePanelOpen`、`isBindingPanelOpen`
**那么** `isResourcePanelOpen` 和 `isSavePanelOpen` MUST 替换为 `activeViewStore` 的 computed get/set
**并且** `isBindingPanelOpen` MUST 替换为 `activeViewStore.isBindingPanelOpen`（派生 computed）

#### Scenario: 绑定上下文状态迁移

**前提** `MapWorkbenchView` 需要读写绑定上下文
**当** 组件访问 `bindingContextGameGuid`、`bindingContextStage`、`dragEnabledBindingSectorGroupId`
**那么** `bindingContextGameGuid` MUST 替换为 `activeViewStore.mapBindingGameGuid` 的 computed get/set
**并且** `bindingContextStage` MUST 替换为 `activeViewStore.mapBindingStage` 的 computed get/set
**并且** `dragEnabledBindingSectorGroupId` MUST 替换为 `activeViewStore.mapDragBindingSectorGroupId`（派生 computed）

#### Scenario: onBindingContextChange 简化

**前提** `MapWorkbenchView` 处理 `context-change` 事件
**当** `onBindingContextChange` 被调用
**那么** 函数 MUST 只更新 `mapBindingGameGuid` 和 `mapBindingStage`
**并且** MUST NOT 单独更新 `isBindingPanelOpen`（由派生 computed 自动计算）
**并且** MUST NOT 单独更新 `dragEnabledBindingSectorGroupId`（由派生 computed 自动计算）

