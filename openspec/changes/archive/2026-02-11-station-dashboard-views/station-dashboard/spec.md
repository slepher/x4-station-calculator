# Station Dashboard Specification

## Purpose
扩展空间站建设仪表盘（StationDashboard）的功能，支持“时间视图”和“工人视图”，使用户能够直观地了解空间站建设所需的时间成本和劳动力需求，并通过顶置统计条（Stats Bar）提供全局概览。

## MODIFIED Requirements

### Requirement: 顶置统计条 (Stats Bar)
系统 SHALL 在仪表盘顶部提供一个常驻的统计条，显示全站的核心指标。
- **显示内容**: 
    - 总价格 (Total Credits)
    - 总建造时间 (Total Build Time)
    - 工人效率 (Workforce Efficiency): 显示为百分比 `Math.min(1, 当前工人数量 / 总需求工人数量)`，上限为 100%。
- **交互**: 无论切换到哪个子视图，统计条内容保持不变且始终可见。

### Requirement: 视图模式切换与列表展示
系统 SHALL 允许用户在“材料”、“工人”和“时间”视图间切换，列表内容随视图动态变化。

#### Scenario: 材料视图 (Materials View)
- **前提**: 用户进入空间站建设仪表盘。
- **当**: 切换至“材料”视图模式时。
- **那么**: 列表展示模块建设所需的资源。
- **并且**: 
    - 汇总行 SHALL 可展开，显示全站所需材料清单明细。
    - 模块行 SHALL 可展开，显示该模块所需材料清单。
    - 展开明细行的字体 SHALL 比主行字体小。

#### Scenario: 工人视图 (Workers View)
- **前提**: 用户进入空间站建设仪表盘并切换至“工人”视图。
- **当**: 查看列表或调整设置时。
- **那么**: 系统 SHALL 在 Stats Bar 下方显示劳动力控制面板（包含实际人数调节、自动计算开关、PHQ 选项）。
- **并且**: 
    - 汇总行 SHALL 可展开，显示总居住容量和工人需求。
    - 如果 `playerHQNeeded` 大于 0，列表 SHALL 在明细中包含一个需求为 200 的 PHQ 条目。
    - 模块行 SHALL 可展开，显示单体 (Unit) 的容量或需求。
    - 所有工人数值 SHALL 显示绝对值，提供住房显示为绿色 (Emerald)，工人需求显示为红色 (Red)。
    - 展开明细行的字体 SHALL 比主行字体小。

#### Scenario: 建造时间视图 (Time View)
- **前提**: 用户进入空间站建设仪表盘并切换至“时间”视图。
- **当**: 查看建设时间时。
- **那么**: 列表展示模块及其汇总的建造时间。
- **并且**: 
    - 汇总行 SHALL 可展开，显示全站单体模块的建造时间分布（若适用）。
    - 模块行 SHALL 可展开，显示该模块的单体 (Unit) 建造时间。
    - 时间格式 SHALL 遵循 `HH:MM:SS` (HH > 24) 或 `XD HH:MM:SS` (D >= 2) 规则，颜色为红色。
    - 展开明细行的字体 SHALL 比主行字体小。

### Requirement: 数据计算与逻辑 (Data Calculation & Logic)
- **时间**: 汇总全站所有工业模块的 `buildTime`。
- **工人**: 汇总 `capacity` (提供) 和 `needed` (需求)。
- **效率**: 实际工人数由控制面板调节，效率上限 MUST 限制在 100%。
- **PHQ 逻辑**: 
    - `StationAnalysis` 接口 SHALL 增加 `playerHQNeeded` 字段。
    - 如果 `useHQ` 设置开启，`playerHQNeeded` MUST 为 200；否则为 0。
    - **汇总**: `totalNeeded` SHALL 包含 `playerHQNeeded` 的数值（即：`totalNeeded = sum(moduleNeeded) + playerHQNeeded`）。
    - 该字段仅在工人视图的列表明细中注入展示。
