# 自动星区划分接入 Map 界面 (auto-sector-group-map)

## 目标

将 `auto-sector-group-merged` 的自动星区划分能力整合到 Map 界面，替换原有的 `MapBindingSectorGroup`（step 2），使用 tab 切换 Hub（群组管理）和分配方案视图，Vue 组件根据 map/live 上下文做样式适配，并保留地图上点击 pill 聚焦星区的功能。

## 已确认方案（审核重点）

### 1. 架构重构

| 步骤 | 内容 |
|------|------|
| Phase 1 | 从 `SectorOverviewPanel.vue` 抽取核心逻辑到 `useAutoSectorGroupPresenter.ts`，使其遵守 `store → presenter → vue` 三层规则 |
| Phase 2 | 保持 `SectorConfirmBar + SectorGroupList` 作为 Col 2 组合，`SectorAllocationList + AllocationConfirmBar` 作为 Col 3 组合，不新增 unit wrapper |
| Phase 3 | 创建 map 上层 wrapper 承载 Hub/分配方案 tab、360px 容器和地图事件 relay，并替换 `MapSavePanel.vue` 的 `binding-sector` 层 |
| Phase 4 | 清理无生产入口的遗留 `MapBindingPanel.vue`，避免继续维护两套 binding panel |

Presenter 先完成重构（确保 live 侧不受影响），然后再迁移到 map。Presenter 抽取的是 SectorOverviewPanel 中的字段级响应式状态、computed 派生、纯逻辑方法（runAutoGroup / enterEditMode / cancelEdit / runCalculation / addHubDraft / removeHubDraft / togglePin / updateJumpRange / coverage 操作 / connection 操作 / selectAssignment / selectBridge / confirmAndWrite），不包含 DOM 操作。

### 2. 入口与触发

自动计算触发检查移动到 `useLiveProductionStore` 层级：
- `liveProductionStore` 检查当前 binding 中所有有玩家资产的 sector 是否都已经归到 group
- 检查触发时机包括刷新、手动切换 binding、上传新存档或 archive timing 变化导致的 binding 切换
- 检查完成后设置“需要自动分组计算”的 flag，并记录触发原因（如 refresh / binding switch / archive timing switch）
- presenter 监听该 flag 并执行 auto group 计算；计算执行完成后由 presenter 清除 flag
- 已有 guid 绑定时运行增量分配（保留已有 group 作为 baseline/pinned 输入）

### 3. Tab 结构（Map Context）

在 Map binding 上层 wrapper 内部（非新增独立主 tab）渲染两个 tab：

| Tab | 内容 | 说明 |
|-----|------|------|
| **Hub** | `SectorConfirmBar(view='map')` + `SectorGroupList(view='map')` | Col 2 组合：编辑跳数/阈值/节点/覆盖/保留、添加枢纽、统一 pill 操作、拖拽排序 |
| **分配方案** | `SectorAllocationList(view='map')` + `AllocationConfirmBar` | Col 3 组合：每个玩家星区的归属选择（absorb/standalone），确认写入 |

Tab 切换不改变计算状态，只切换显示内容。Map 编辑态下禁止切换到分配方案 tab。完成态（即 live 界面不显示 `SectorAllocationList` 的状态）下，Map binding 界面也不显示 tab 和 `SectorAllocationList`。

### 4. Vue 组件上下文适配

所有从 `SectorOverviewPanel` 引用的子组件（`SectorConfirmBar`、`SectorGroupList`、`SectorAllocationList`、`SectorHubAddMenu`）新增 `view` prop：`'map' | 'live'`。`SectorConfirmBar` 已有 `mode: 'result' | 'edit'`，不得复用 `mode` 表达 map/live 视图。

**map 模式差异：**
- 紧凑样式适配 360px 侧边栏宽度
- pill 点击 emit `focus-sector`（sectorMacro），由 map 上层 wrapper relay 到 map 父组件
- `SectorConfirmBar` 隐藏 Col 1 的 SaveUploadPanel（map 侧独立管理存档选择）
- `SectorHubAddMenu` 在 map 下使用原始 `MapBindSectorMenu` 的 teleported popup 模式（锚定 trigger element），保留"定位地图"按钮

**live 模式差异：**
- 保持现有三列全宽布局
- 无 focus-sector emit
- SaveUploadPanel + SaveList 在 Col 1 显示
- edit 模式下 Col 3 保留 allocation 区域但显示遮罩禁用操作

### 5. Pill 点击聚焦星区

保留 `MapBindingSectorGroup` 中原有的 pill → 地图聚焦功能，事件链：

```
SectorGroupList pill @click
  → emit('focus-sector', sectorMacro)
  → Map binding wrapper relay
  → emit('focus-sector', sectorMacro)
  → MapSavePanel relay (已有逻辑)
  → MapWorkbenchView.onBindingFocusSector(sectorMacro)
  → mapStore.resolveSectorByMacro() + focusSector(sectorId)
```

`SectorAllocationList` 中的 assignment card sector 名也支持点击聚焦（map 模式下）。

### 6. Hub 弹出菜单

| Context | 组件 | 行为 |
|---------|------|------|
| `map` | `MapBindSectorMenu`（保留现有） | teleported popup，锚定 trigger element，有"定位地图"按钮；无搜索时列玩家星区，搜索时列全地图 sector |
| `live` | `SectorHubAddMenu`（保留现有） | fixed overlay modal，点击背景/Esc 关闭；无搜索时列玩家星区，搜索时列全地图 sector |

两者共享相同的过滤规则：已是任意 group anchor 的 sector 不显示添加按钮；新增 hub draft 默认 `isPinned=true`、`baseline=false`、`isNew=true`。

### 7. 拖拽排序

Hub tab 中的 group 列表使用 `vuedraggable` 支持拖拽排序（复用现有 `MapBindingSectorGroup` 中使用的 `vuedraggable`）。拖拽只改变 `groups` 数组顺序，不触发重新计算。排序权威状态是数组顺序；`order` 字段不参与排序语义，如保存时必须填充则仅按数组 index 机械写入以兼容旧 schema。

### 8. 确认写入

与 live 侧一致：
- 所有未决 assignment 解决后 [确定] 可用
- 一次性写入 `saveBindingStore`（`createAutoGroups`）
- 按最终 coverage 重建 `sector → groupId` 并重分配 `stationPlans`
- 确认后进入完成态，不自动切换到 station binding 阶段
- 完成态下 live 不显示 `SectorAllocationList`；Map binding 也不显示 tab 和 `SectorAllocationList`
- 完成态下在每个 group 上显示进入 station binding 的按钮，按钮图标保持原 `MapBindingSectorGroup` 的图标；不再提供旧的单 group 编辑按钮

## 边界

### In Scope

- `useAutoSectorGroupPresenter.ts` 抽取（SectorOverviewPanel 核心逻辑）
- Map binding wrapper 创建（map tab、完成态、360px 容器、事件 relay）
- `SectorGroupList`、`SectorAllocationList`、`SectorConfirmBar` 的 `view` prop 适配
- `liveProductionStore` 自动分组检查 flag 与 presenter 消费逻辑
- pill click → focus-sector 事件链（map context）
- Hub tab 拖拽排序
- MapSavePanel 中的 `binding-sector` 层替换
- 无生产入口的 `MapBindingPanel.vue` 清理
- `MapBindingSectorGroup.vue` 删除
- i18n 新 key（`auto_sector.hub_tab`、`auto_sector.allocation_tab` 中英文）

### Out of Scope

- 地图 canvas 上的星区组覆盖高亮
- MapBindingStation（step 3）的改造
- Terraforming / Research / Blueprint Recipe
- 非 auto-sector-group 相关的 MapBindingSectorGroup 功能迁移
- 已无生产入口的 `MapBindingPanel.vue` 行为兼容

## 验收标准（DoD）

1. `useAutoSectorGroupPresenter.ts` 抽取后 `SectorOverviewPanel.vue` 不再直接 import 业务 store（`useSaveBindingStore`、`useLiveProductionStore`）
2. Live Production overview 的自动分组功能与重构前行为一致
3. Map Save Panel 的 `binding-sector` 层使用新的 map binding wrapper 渲染，不再渲染 `MapBindingSectorGroup`
4. 无生产入口的 `MapBindingPanel.vue` 被清理，源码不再保留第二套 binding panel
5. Hub tab 中 group 列表支持拖拽排序
6. Hub tab 中 pill 点击正确触发地图聚焦（星区居中显示）
7. 分配方案 tab 中 sector 名点击正确触发地图聚焦
8. `view='map'` 时子组件使用紧凑样式，不溢出 360px 侧边栏
9. `view='live'` 时子组件保持现有三列布局
10. Hub 添加菜单在 map 下使用 MapBindSectorMenu 模式（teleported popup + 定位按钮）
11. `liveProductionStore` 在刷新、binding 切换、archive timing 切换后检查未归组玩家 sector，并通过 flag 驱动 presenter 执行自动分组；执行完成后 flag 被清除
12. 完成态下 live 与 map 都不显示 `SectorAllocationList`；Map 不显示 tab，并在 group 上显示进入 station binding 的按钮
13. edit 模式下 live 显示 allocation 遮罩；Map 禁止切换到分配方案 tab
14. 拖拽排序持久化以 `groups` 数组顺序为准，不以 `order` 作为排序权威
15. `npm run build` 通过

## 未决项

无
