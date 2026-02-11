# Station Dashboard Views Design

## 1. UI Components

### 1.1 Stats Bar (New)
在 `StationDashboard` 的标题栏下方，增加一个横向的统计条。
- **Layout**: `flex justify-around bg-slate-800/60 p-2 rounded mb-4 border border-slate-700/50`
- **Fields**:
    - **Total Price**: 标签 "Total Price", 使用 `formatLargeNum` 简化显示（如 175M Cr）。
    - **Total Build Time**: 标签 "Total Time", 数值使用自定义格式化。
    - **Total Needed**: 标签 "Total Needed", 显示总工人需求数量。
    - **Workforce Efficiency**: 标签 "Workers Efficiency", 数值显示为百分比 `Math.min(1, store.actualWorkforce / analysis.totalNeeded)`。
        - **Constraints**: 最大值为 100%。
        - **Colors**: >= 100% (Emerald), >= 50% (Amber), < 50% (Red)。

### 1.2 View Switcher
启用并保持现有的 `view-mode-switcher`。

### 1.4 Workforce Control (New in Dashboard)
在工人视图模式下，于明细列表下方显示劳动力控制面板（完全复刻 `StationWorkforce.vue`）。
- **Components**:
    - **Slider**: 用于手动调节 `manualWorkforce`。
    - **Auto Toggle**: 切换 `workforceAuto`。
    - **HQ Toggle**: 切换 `useHQ`。
- **Styling**: 继承 `StationWorkforce.vue` 的 UI 规范，仅在 Workers 模式显示。

### 1.5 PHQ Display via Analysis
在 `StationAnalysis` 中增加 `playerHQNeeded` 字段，并在工人视图列表中渲染。
- **Logic**: 在 `analyzeStation` 中根据 `store.settings.useHQ` 设置该字段（200 或 0）。
- **Aggregation**: `totalNeeded` 必须累加 `playerHQNeeded` 的值。
- **UI**: 
    - 在 `StationDashboard` 的工人视图模式下，如果 `playerHQNeeded > 0`，则在 **“劳动力平衡 (Workforce Balance)”** 汇总组中显示。
    - **Label**: 使用 i18n 键 `{20102,2011}` (游戏文本：总部/Headquarters)。
    - **Value**: 显示 `analysis.playerHQNeeded`。
    - **Summary Correction**: 汇总组中的“总需求”项显示为 `totalNeeded - playerHQNeeded`，以确保明细相加等于总值。

## 2. Visual Styles & Colors

### 2.1 Price Display
- **Stats Bar Price**: `text-red-400` (Red)。
- **Formatter**: `formatLargeNum`
    - `>= 1M`: `1.23M`
    - `>= 1K`: `12.3K`
    - `< 1K`: `123`

### 2.2 Worker View Colors
- **Capacity Row/Item**: `text-emerald-400` / `text-emerald-500/70`。
- **Needed Row/Item**: `text-red-400` / `text-red-500/70`。
- **Absolute Values**: 移除所有正负号前缀，使用 `Math.abs()`。

### 2.3 Time View Colors
- **Text Color**: `text-red-400` (Red)。

### 2.4 Construction Cost Colors
- **Header & Items**: `text-red-400` (Red)，代表支出。

## 3. Formatter Logic

### 3.1 Time Formatter
```typescript
function formatTime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 3600))
  const hours = Math.floor((seconds % (24 * 3600)) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  
  if (days >= 2) {
    return `${days}D ${timeStr}`
  }
  
  // 如果超过24小时但不到2天，HH会显示为 24-47
  const totalHours = Math.floor(seconds / 3600)
  const totalTimeStr = `${String(totalHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return totalTimeStr
}
```

## 4. Interaction Logic
- **Materials View**: `Summary Row` 和 `Module Rows` 均为可展开状态。
- **Workers View**: `Summary Row` 展开显示 Capacity vs Needed 细分；`Module Rows` 展开显示单体模块的 Capacity/Needed。
- **Time View**: `Summary Row` 和 `Module Rows` 均为可展开状态，展开显示单体模块的建造时间。
