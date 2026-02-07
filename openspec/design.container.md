# 设计文档：独立仓储管理卡片 (Standalone Storage Management Card)

## 技术方案
在右侧面板新增 `StorageManagementCard` 组件，位于“劳动力管理”下方。
组件内部采用 **分层列表 (Tiered List)** 结构：虽然整体是一个连续的列表，但逻辑上按“集装箱 > 固体 > 液体”的顺序排列。
引入 **智能列表项 (Smart List Item)** 渲染逻辑：每种货物不仅显示名称，还计算并展示其“规划持仓量 (Target Quantity)”和“占用体积 (Occupied Volume)”。

## 架构决策

### 决策：整体列表与微弱分隔 (Unified List with Subtle Dividers)
放弃完全独立的三个卡片块，改为在一个卡片内渲染一个长列表。
- **排序策略**：强制将所有 `transportType === 'container'` 的货物排在最前，其次是 `solid`，最后是 `liquid`。
- **视觉分隔**：在不同类型的货物组之间插入一条 `<Divider variant="subtle" />`（例如透明度较低的虚线或细实线），既起到区分作用，又不破坏列表的整体感。
- **头部汇总**：在每组货物的顶部（或分隔线旁）保留该类型的总容量进度条，作为该组的“小标题”。

### 决策：单品详细计算 (Per-Ware Calculation)
不仅计算总容量，还必须为列表中的每一行货物计算具体的规划数据：
- **规划数量 (Target Qty)**：`|净产出/消耗速率| * 缓冲时间`。
- **占用空间 (Occupied Vol)**：`规划数量 * 单品体积`。
**理由**：用户不仅需要知道“仓库满没满”，还需要知道“到底是哪种东西把仓库塞满了”。

### 决策：视觉降噪 (Visual De-emphasis)
- **集装箱组**：使用标准亮度的文字和图标。
- **固体/液体组**：作为次要信息，其货物列表的文字颜色可稍微调暗（如 `text-secondary`），仅在鼠标悬停时高亮，以体现“排在后面”的次要地位。

## 数据流

1.  **数据预处理 (Preprocessing)**：
    - 输入：`ProductionStats` (产出流) 和 `ModuleList` (现有容量)。
    - 步骤 1：遍历所有产物，计算每个产物的 `targetQty` 和 `occupiedVolume`。
    - 步骤 2：将产物按 `transportType` 分组为三个数组：`containers`, `solids`, `liquids`。
    - 步骤 3：对每组内的货物按 `occupiedVolume` 降序排列（占用空间最大的排前面）。

2.  **容量聚合 (Aggregation)**：
    - 对每个数组计算 `totalOccupied`。
    - 从 `ModuleList` 获取对应的 `totalCapacity`。

3.  **渲染 (Rendering)**：
    - **Section 1: Container**
        - 渲染：`Total Progress Bar` (集装箱总负载)。
        - 循环渲染：`ListItem` (微芯片: 2500个 | 5000 m³)。
    - **Divider**: *Subtle Line*
    - **Section 2: Solid**
        - 渲染：`Total Progress Bar` (固体总负载)。
        - 循环渲染：`ListItem` (硅: 3000个 | 30k m³)。
    - **Divider**: *Subtle Line*
    - **Section 3: Liquid**
        - ... (同上)

## 交互设计细节
- **自动规划**：保留底部的控制栏。勾选后，如果某组的 `totalOccupied > totalCapacity`，自动在左侧模块列表添加对应存储模块。
- **空值隐藏**：如果某组（如液体）没有任何货物，则整组（包括进度条和分隔线）自动隐藏，不占用垂直空间。