# 设计：空间站仪表盘空间视图与体积集成

## 1. UI 组件

### 1.1 统计栏 (更新)
在 `StationDashboard` 的标题栏下方，优化现有的统计条布局，改为 2 行 3 列的网格布局。
- **布局**: `grid grid-cols-3 gap-y-2 gap-x-4 bg-slate-800/60 p-3 rounded mb-4 border border-slate-700/50`
- **行**:
    - **行 1 (资源/规模)**:
        - **造价**: 标签 "总造价", 数值显示为 Cr (红色)。
        - **体积**: 标签 "总体积", 数值显示为 m³ (蓝色)。
        - **工人需求**: 标签 "工人需求", 数值显示为总需求人数 (绿色/祖母绿)。**[变更自 总需求/琥珀色]**
    - **行 2 (时间/物流/效率)**:
        - **时间**: 标签 "总时间", 数值使用自定义格式化 (红色)。
        - **船次**: 标签 "运输船次", 数值显示为 `Math.ceil(总体积 / 船只运量)` (蓝色)。**[变更自 船只数量]**
        - **效率**: 标签 "工人效率", 数值显示为百分比 (颜色编码)。

### 1.2 视图切换器 (重命名 & 新增)
更新 `view-mode-switcher` 的选项：
- **Materials** -> **成本视图** (Cost View)
- **Time** -> **时间视图** (Time View)
- **Workers** -> **工人视图** (Workers View)
- **[新增]** -> **空间视图** (Volume View)

### 1.3 运量控制 (仪表盘新增)
在空间视图模式下，于底部显示运输船运量控制面板。
- **滑块**: 用于调节 `transportShipCapacity`。
    - **范围**: 5,000 - 62,000
    - **步长**: 1,000
    - **默认**: 62,000 (Heron E)
- **样式**: 与现有的 `PriceSlider` 风格一致。

### 1.4 摘要区域 (Bug 修复)
- **标题**: 在空间视图下，Summary 标题应显示为 "建设总体积" (Total Build Volume)，而非 Cost。
- **样式**: 在空间视图下，Summary 及明细行的数值应使用蓝色 (`text-blue-400`)，单位为 `m³`。

## 2. 逻辑更新

### 2.1 空间站分析 (扩展)
在 `analyzeStation` 函数中扩展数据结构，增加体积计算。
- **Item 级别**: 增加 `volume` 字段 (count * unitVolume)。
- **Group 级别**: 增加 `volume` 字段 (sum of items' volume)。
- **Total 级别**: 增加 `totalVolume` 字段。

### 2.2 运输船次计算
- **逻辑**: 仅在前端计算，不存入 store 或 analysis 核心逻辑。
- **公式**: `Math.ceil(analysis.totalVolume / settings.transportShipCapacity)`。

## 3. 视觉风格

### 3.1 体积颜色
- **文本颜色**: `text-blue-400` (蓝色)。
- **单位**: `m³`。

### 3.2 排版
- **统计栏标签**: `text-[10px] uppercase text-slate-500 font-bold tracking-wider`。
- **统计栏数值**: `text-sm font-mono font-bold`。

## 4. 国际化 (i18n)
- **键**:
    - `ui.cost_view`: "成本视图" / "Cost View"
    - `ui.volume_view`: "空间视图" / "Volume View"
    - `ui.total_volume`: "总体积" / "Total Volume"
    - `ui.transport_trips`: "运输船次" / "Transport Trips" **[变更]**
    - `ui.transport_capacity`: "运输船运量" / "Transport Capacity"
    - `ui.total_build_volume`: "建设总体积" / "Total Build Volume" **[新增]**
    - `ui.workers_needed`: "工人需求" / "Workers Needed" **[复用/检查]**
