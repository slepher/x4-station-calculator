# 自动星区划分接入 Map — 任务列表

## 1. Presenter 抽取

- [x] 创建 `src/components/empire/presenters/useAutoSectorGroupPresenter.ts`
- [x] 将 `SectorOverviewPanel.vue` 中所有 `ref()` / `computed()` / 核心方法迁移到 presenter
- [x] 重构 `SectorOverviewPanel.vue`：移除直接 store import，改为通过 presenter 获取所有状态和方法

## 2. liveProductionStore 自动检查

- [x] 新增自动分组检查 flag 状态（含 gameGuid/reason）
- [x] 刷新/切换 binding/archive timing 切换后触发检查
- [x] presenter 监听 flag 并消费 + 清除

## 3. 子组件 view prop 适配

- [x] `SectorGroupList.vue` 新增 `view: 'map' | 'live'` prop + map 紧凑样式
- [x] `SectorGroupList.vue` map view 下 pill 点击 emit `focus-sector`
- [x] `SectorGroupList.vue` 集成 `vuedraggable`（`:draggable` prop 控制）
- [x] `SectorGroupCard.vue` 抽取 group card 为独立组件
- [x] `SectorGroupCard.vue` 完成态 station binding 图标按钮（旧 MapBindingSectorGroup 图标）
- [x] `SectorAllocationList.vue` 新增 `view` prop + map 紧凑 + `focus-sector` emit
- [x] `SectorConfirmBar.vue` 新增 `view` prop + map 紧凑 + `showConfirm`/`confirm` prop/emit

## 4. Map wrapper 创建

- [x] 创建 `AutoSectorGroupMapPanel.vue`（双分支：确认态 / 未确认态 tab）
- [x] Hub/分配方案 tab 切换，编辑态禁用分配方案 tab
- [x] 完成态不显示 tab/AllocationList，group 上显示 station binding 按钮
- [x] `focus-sector` 事件 relay 到 MapSavePanel → MapWorkbenchView
- [x] `HubAddMenu.vue` 创建为独立内联组件（使用 `useSectorNameFilter` 复刻原 MapBindSectorMenu 功能）
- [x] `onCalculate`：计算后若有存疑自动切到分配方案 tab
- [x] 确认态分支支持编辑（补全事件处理 + `:editable` 联动）

## 5. Map 面板替换

- [x] `MapSavePanel.vue` 替换 `MapBindingSectorGroup` → `AutoSectorGroupMapPanel`
- [x] 清理 `MapBindingPanel.vue`
- [x] `MapBindingSectorGroup.vue` 保留作为对照参考

## 6. Live overview 适配

- [x] 保持三列布局，live 编辑态仅分配区域显示遮罩
- [x] 确认态不显示 SectorAllocationList，资源面板无遮罩

## 7. 排序持久化

- [x] `groups` 数组顺序为排序权威，`order` 仅按 index 兼容写入

## 8. i18n

- [x] `auto_sector.hub_tab` / `allocation_tab` / `edit_overlay_hint` 中英文
- [x] `map.binding_search_results` 中英文

## 9. 类型清理

- [x] `X4MapSector.macro` 移除（数据中始终为 null），全部替换为 `s.id`

## 10. Bug 修复

- [x] `handleAddHubDraft`：添加 hub 时从其他 group coverage 中移除该 sector
- [x] 确认态 SectorConfirmBar/SectorGroupList 缺事件处理 → 补全
- [x] `handleEnterEdit` 不再改变 `autoGroupConfirmed`
- [x] vuedraggable `:force-fallback="true"` 恢复滚轮滚动
- [x] `X4MapSector.macro` 移除，全部替换为 `s.id`
- [x] HubAddMenu 全地图搜索：`s.id` 作为标识符，接入 `useSectorNameFilter`
- [x] HubAddMenu 双模式：`inline`（Map） / `overlay`（Live）
- [x] 删除 `SectorHubAddMenu.vue`，Live 改用 `HubAddMenu mode="overlay"`

## 11. Stat Bar 重构

- [x] SectorConfirmBar 两行布局，live/map 各异
- [x] 参数持久化到 `SaveBindingPlan`（`normalizeState` 同步更新）
- [x] 刷新初始化默认值：bridgeRetain=false, coverageRetain=true, node=有group则false
- [x] 进入编辑：全局 retain 同步到 card；取消/计算：card 任一 checked → 全局 checked
- [x] 编辑态不重置 retain 值
- [x] `editSnapshot` 补充 retain/node 字段
- [x] `handleQuickCalculate` 尊重 checkbox 当前值

## 11. 构建验证

- [x] `npm run build` 通过


## 未解决

- [ ] vuedraggable 完成态仍可拖拽（v-if/v-else 分支切换后 Sortable.js 事件残留）

