# 地球化星区显示模式改造 — 设计文档

## 架构

```
LiveProductionWorkbenchView
  └─ useTerraformingPresenter
      ├── sectorPanel (新增 statScaleModels, currentStats, statDisplayNames, activeRebates)
      │     → TerraformingSectorPanel
      │         ├── list 模式: 星区列表 (选中星区高亮)
      │         └── item 模式: 星区详情 (title + objectives + stats + rebates)
      ├── taskList (移除 statScaleModels, currentStats, statDisplayNames, activeRebates)
      │     → TerraformingTaskList (移除 stats-card 区域, 始终显示)
      └── resourcePanel (不变)
            → TerraformingResourcePanel (始终显示)
```

三栏布局始终存在：`lg:col-span-3 | lg:col-span-5 | lg:col-span-4`。

## 组件改动

### 1. TerraformingSectorPanel.vue

**新增内部状态**：
- `displayMode: ref<'list' | 'item'>('list')` — 当前显示模式

**新增 Props**：
- `statScaleModels`, `currentStats`, `statDisplayNames`, `activeRebates`

**新增 Emit**：
- `displayModeChange(mode: 'list' | 'item')`

**交互逻辑**：
- `onMounted`: 若 `selectedClusterId` 非空 → `displayMode = 'item'`
- `handleClusterClick`: emit `selectCluster(id)` → `displayMode = 'item'` → emit `displayModeChange('item')`
- `handleBackClick`: `displayMode = 'list'` → emit `displayModeChange('list')`（不清理 selectedClusterId）
- `watch(selectedClusterId)`: 外部变化时同步 displayMode

**模板结构**：
```
list 模式:
  panel-header: "地球化星区"
  panel-content:
    cluster-item (click → item mode, 选中星区保持 .active)

item 模式:
  panel-header:
    <button (back SVG)>  ← 返回 list, 保留 selection
    <span> 星区名称
  panel-content:
    objectives section
    stats section (单列 grid-cols-1, 复用 TerraformingStatScale)
    rebates section
```

### 2. useTerraformingPresenter.ts

sectorPanel 新增: `statScaleModels`, `currentStats`, `statDisplayNames`, `activeRebates`
taskList 移除: `statScaleModels`, `conditionScaleModels`, `currentStats`, `statDisplayNames`, `activeRebates`

### 3. LiveProductionWorkbenchView.vue

- 新增 `terraformingSectorMode` ref，onMounted 中根据 store 状态初始化
- 传递新 props 给 SectorPanel，处理 `@display-mode-change`
- 三栏始终渲染（不通过 v-if 切换显隐）

### 4. TerraformingTaskList.vue

- 移除 `stats-card` 模板区域及对应 props、imports

## 按钮复用

```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 3h6v6" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M10 14L21 3" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
</svg>
```
