# 地球化星区显示模式改造

## 目标

将地球化星区面板 (`TerraformingSectorPanel`) 从手风琴展开模式改为 list | item 双模式显示。List 模式展示星区列表，Item 模式展示选中星区的详情（objectives + stats + rebates），提升导航清晰度和信息密度。

## 已确认方案（审核重点）

### 入口与导航

1. **默认进入 list 模式**：显示星区列表（当前 UI，去掉手风琴展开行为）。TaskList 和 ResourcePanel 始终显示（未选中星区时显示各自的占位空状态）。
2. **已有选中星区时默认进入 item 模式**：页面加载时若 `selectedClusterId` 非空，直接进入 item 模式。
3. **点击星区进入 item 模式**：触发 `selectCluster`，SectorPanel 切换为选中星区的详情视图。
4. **item 模式顶部标题栏**：左侧返回按钮（复用船只建造界面的"更换船只"SVG icon），点击返回 list 模式，保留 `selectedClusterId`（选中星区在 list 中保持高亮，TaskList/ResourcePanel 内容不变）。

### Item 模式内容

Item 模式展示顺序：
1. 星区名称（标题栏）
2. Objectives 列表（原手风琴展开的内容：step / action / text / status）
3. Stats 展示（从 TaskList 移动过来，复用 `TerraformingStatScale` 组件，单列显示）
4. Rebates 列表（从 TaskList 移动过来）

### 数据流

- Stats 和 Rebates 数据从 `useTerraformingPresenter` 的 `sectorPanel` 输出中提供（`statScaleModels`, `currentStats`, `statDisplayNames`, `activeRebates`）。
- TaskList 中移除全局 stats 卡片（`stats-card`）部分，任务节点的 stat-impact-list 保留不修改。
- 三栏布局始终存在，不随模式切换隐藏/显示。
- SectorPanel 内部通过 `displayMode` 控制 list/item 切换，通过 `displayModeChange` 事件通知父组件。

### 按钮复用

返回按钮的 SVG icon 直接复用 `ShipBuildPanelFit.vue` 中更换船只按钮的 SVG（`viewBox="0 0 24 24"` 的三个 path）。

## 边界

### In Scope

- `TerraformingSectorPanel.vue`：新增 list/item 双模式 UI
- `useTerraformingPresenter.ts`：sectorPanel 新增 stat/rebate props，taskList 移除
- `LiveProductionWorkbenchView.vue`：初始化 mode、传递新 props
- `TerraformingTaskList.vue`：移除 stats-card 区域及对应 props
- i18n 新增 `backToList`、`statsTitle`、`rebatesTitle` 键

### Out of Scope

- `TerraformingResourcePanel.vue`：不做修改
- TaskList 中任务节点的 stat 展示（`stat-impact-list`）：保留不修改
- 测试代码编写

## 验收标准（DoD）

1. 进入地球化页面，list 模式展示星区列表，TaskList/ResourcePanel 显示占位空状态
2. 点击星区后，SectorPanel 切换为 item 模式，显示星区名称 + objectives + stats + rebates
3. item 模式标题栏有返回按钮（更换船只 SVG），点击后回到 list 模式，选中星区保持高亮，另两栏内容不变
4. 再次点击另一星区，SectorPanel 切到 item 模式，TaskList/ResourcePanel 更新为新星区内容
5. 若有默认选中星区，页面加载后进入 item 模式
6. `npm run build` 无编译错误

## 未决项

无
