# 设计文档：产线性能分析重构 (Production Line Performance Analysis Refactor)

## 技术方案
采用 **三栏布局 (Left-Middle-Right)** 重构核心界面，将“产线性能分析”确立为独立的中间栏，作为视觉和逻辑的焦点。
引入 **分段控制器 (Segmented Control)** 交互模式，将原有的分散卡片（资源产出、经济分析）与新增的“体积分析”合并为一个高内聚的仪表盘组件。
前端状态管理需新增 `viewMode` ('quantity' | 'volume' | 'economy') 状态，用于控制中间栏的数据渲染策略，避免组件在切换视图时发生卸载和重建，确保用户体验流畅。

## 架构决策

### 决策：布局重构 (Layout Restructuring)
将页面布局从“左右堆叠”改为“左-中-右”三栏结构：
- **左栏 (输入端)**：模块规划列表 (保持不变)。
- **中栏 (流动端)**：产线性能分析 (本次重构重点)。
- **右栏 (状态端)**：后勤与基建 (劳动力/仓储/建设成本)。
**理由**：分离“控制(Input)”、“流动(Flow)”和“状态(State)”三个维度，符合数据流向直觉，彻底解决原右侧面板内容过多导致无限滚动的问题。

### 决策：统一分析视图 (Unified Analysis Lens)
不再使用独立的卡片堆叠，而是实现一个统一的 `ResourceDashboard` 组件，包含三个互斥的视图：
1.  **数量流视图 (Quantity Flow)**：展示传统的单位产出 (`/h`)，关注生产平衡。
2.  **体积流视图 (Volume Flow)**：新增维度，计算 `数量 * 单体体积`，关注空间压缩效率。
3.  **资金流视图 (Economy Flow)**：集成原有的经济分析，应用价格设置，关注利润与产值。
**理由**：这三个维度本质上共享同一套数据源（产物列表），只是观察透镜不同（物品 vs 体积 vs 价值）。将它们聚合在同一物理区域可以极大提高屏幕空间利用率，并减少用户的认知负荷。

### 决策：体积计算逻辑分离 (Volume Calculation Logic)
严格区分“体积流 (Flow)”与“存储容量 (Stock)”的计算逻辑：
- **性能视图 (中栏)**：计算 `吞吐量 (m³/h)` 和 `净变化量`。它代表产线的物理效率（例如：将庞大的矿石压缩为小巧的芯片）。
- **后勤视图 (右栏)**：基于缓冲时间计算 `静态存储需求`。
**理由**：清晰区分“流量”与“存量”。中间栏只关注每小时吞吐的变化，不负责计算需要多少个仓库，避免逻辑耦合，使架构更清晰。

## 数据流

1.  **输入 (Input)**：`ModuleList` (用户规划的模块列表)。
2.  **计算引擎 (Calculation Engine)**：生成 `ProductionStats` 对象，包含每种物品的 `netOutput` (净产出)。
3.  **视图转换层 (View Transformation)**：
    - **数量模式 (Quantity Mode)**：直接渲染 `netOutput` 数据。
    - **体积模式 (Volume Mode)**：
        - 映射 `itemId` 到 `wareStats` (获取 `volume` 体积和 `transportType` 运输类型)。
        - 计算 `deltaVolume = netOutput * volume`。
        - 按类型分组 (固体/液体/集装箱)。
        - 计算 `压缩比 (CompressionRatio)` (输入总体积 vs 输出总体积)。
    - **经济模式 (Economy Mode)**：
        - 应用 `priceSettings` (用户输入的价格滑块)。
        - 计算 `value = netOutput * price`。