## Context

当前的 X4 空间站计算器主要处理线性或树状的生产关系计算。为了支持更复杂的分布式规划，“逻辑组网”需要引入一个拓扑图的概念，将生产模块视为节点，将资源流动视为边。

## Goals / Non-Goals

**Goals:**
- 提供一个直观的产业链拓扑展示。
- 支持基于 Tier 的自动布局逻辑。
- 支持锁定特定节点（非基础资源）以模拟外部供应。
- 实现候选区的二级分类过滤。

**Non-Goals:**
- 不在该视图下进行复杂的产量平衡计算（由量化视图负责）。
- 不支持节点的手动自由连线（由配方逻辑自动推导）。
- **当前阶段不支持跨组关联**（每个产线组内部闭环推导）。

## Decisions

- **UI 组件架构**:
  - `LogicalFlowPlanner.vue`: 主容器。
  - `FlowCandidateZone.vue`: 顶部候选区，包含二级导航（药丸标签）。
  - `FlowWorkspace.vue`: 画布区域，包含多个 `ProductionLineGroup.vue`。
  - `ProductionLineGroup.vue`: 产线组容器，负责组内 4 列布局和自动命名。
  - `FlowNode.vue`: 节点组件，支持产线模块和资源 Ware。
- **状态管理**:
  - 采用 **Multi-Store 架构**：
    - `useGameDataStore`: 静态数据中心，处理 JSON 加载与多语言 (i18n)。
    - `useLogicFlowStore`: 拓扑状态中心。管理 `groups: ProductionLineGroup[]`。
    - `useStationStore`: 量化计算中心。
- **候选区分类逻辑 (Candidate Zone)**:
  - **展示对象**: 始终显示为 **产物 (Ware)**。
  - **交互增强**:
    - **搜索**: 输入框右侧增加 `x` 清空按钮；搜索命中的卡片需视觉高亮。
    - **卡片 UI**: `+` 按钮移至卡片右侧边缘（类似删除按钮位置），纵向布局更紧凑。
  - **分类体系**:
    - **工业 (Industrial)**:
      - 二级分类 (`method`): Terran, Default, Teladi。
      - 过滤逻辑: 产物必须存在生产模块且该模块的 `method` 属性严格等于当前二级标签。
      - 操作上下文: 拖拽/添加操作将强制使用当前的 `method` 进行初始化和递归推导。
      - **Teladi 追溯增强**: 针对 Teladi 分类下的 Tier 3 级别产物，递归追溯逻辑必须包含所有相关的 Default + Teladi 模块产出的上游产物，确保产业链完整性。
    - **农业 (Agricultural)**:
      - 二级分类 (`race`): Argon, Boron, Paranid, Split, Teladi, Terran (来自产物 `consumption` 字段的 key，排除 default)。
      - 过滤逻辑: 产物必须存在生产模块且该模块的 `race` 属性严格等于当前二级标签。
      - 操作上下文: 拖拽/添加操作将强制使用当前的 `race` 进行初始化和递归推导。
  - **展示与过滤增强**:
    - **候选区布局**: 仿照规划区，候选区同样分为四列（Tier 0, 1, 2, 3）。每列独立滚动，方便跨层级选择。
    - **卡片紧凑化**: 候选区产物卡片高度进一步压缩至 **32px**。采用水平布局（图标 + 名称 + 操作按钮），取消纵向堆叠，以最大化单屏显示的产物数量。
    - **候选区排序**: 严格按照 Tier 0 -> Tier 3 顺序排列。在同一 Tier 内，已经在当前产线组中存在的产物（已规划）强制置顶排列。
    - **搜索逻辑**: 搜索时仅对结果进行视觉高亮（Highlight），不执行物理过滤，保持产业链条的完整可见性。
- **规划区节点逻辑 (Planning Zone & Node Lifecycle)**:
  - **节点来源 (`source`)**:
    - `manual`: 用户主动添加，具有管理持久性。
    - `auto`: 系统递归生成，随需求动态变化。
  - **删除逻辑 (`Remove`)**:
    - 仅对 `manual` 节点提供删除按钮。
    - **降级机制**: 若被删除节点仍被其他节点依赖，则该节点不移除，而是由 `manual` 降级为 `auto`。
    - **级联清理**: 当一个 `auto` 节点不再被任何生产链引用时，自动从组内移除。
  - **锁定逻辑 (`Locking`)**:
    - 锁定节点自动切换为 **产物模式 (Ware Mode)** 显示，无论其 Tier 等级，代表外部供应。
- **UI 布局与审美 (UI/UX Refinement)**:
    - **紧凑视图与智能投放 (Compact View & Smart Drop)**:
      - **4 列网格布局**: 在拖拽激活期间，规划区从垂直列表切换为 `grid-cols-4`。每个产线组卡片作为网格项平铺展示，提高投放目标的查找效率。
      - **5x2 视觉容量**: 在 4 列布局下，产线组卡片内部节点高度进一步压缩，通过内部布局优化支持单卡片内展示最多 10 个节点的产业链。
    - **高度压缩**: 大幅减少节点纵向占用空间（目标高度 32px 左右），使产业链在有限视野内更完整。
    - **拓扑连接视觉化 (Visual Connectivity)**: 
      - 在上下游节点（Tier 列）之间增加动态 SVG 连线或流向引导。
      - 连线应根据节点的生产依赖关系自动推导生成，清晰展示资源流动路径。
    - **去栅格化 (De-gridding)**:
      - 弱化或移除 Tier 0-3 之间生硬的背景列分隔线。
      - 营造一种连续的、画布式的流程体验，使产线组看起来更像一个有机的“流程图”而非死板的“表格”。
    - **严格层级排列**:
      - 横向: 严格按照 Tier 0, 1, 2, 3 分为四列左右排列。
      - 纵向: Tier 之内节点上下排列。
    - **自动命名**: `[一级分类] - [二级分类] - [最高 Tier 列中最靠上的产物名]`。
    - **排序优先级**: 同一 Tier 列内，已经在产线组中存在的产物（已规划）强制置顶排列。
    - **智能落位 (Smart Drop)**: 拖拽至产线组容器任意位置，系统依据产物 Tier 自动将其分发至 0-3 列。
- **核心算法**:
  - **拖拽状态同步**:
    - `useLogicFlowStore` 维护全局 `draggingWareId`。
    - 在 `CandidateZone` 的 `handleDragStart` 时同步，`handleDragEnd` 时清除。
  - **智能插入排序 (Tier-Based Insertion)**:
    - 算法：`index = nodes.findLastIndex(n => n.column >= targetTier) + 1`。
    - 逻辑：高 Tier 在前，低 Tier 在后。新节点插入到同 Tier 既有节点之后、低 Tier 节点之前。
  - **投放去重拦截**:
    - 校验逻辑：`isDuplicate = group.nodes.some(n => n.wareId === draggingWareId)`。
    - 交互：若为重复，禁止 `vuedraggable` 的 `@add` 事件触发，并提供视觉反馈。
  - `recursiveExpandUpstream`:
    - **匹配优先级**:
      1. 农业组根据 `race` 完美匹配。
      2. 工业组根据 `method` 匹配。
      3. 工业组根据 `method` 匹配不成功时, 匹配`default`降级回退 (如 Teladi 无特定模块时)。
  - **锁定 (Locking)**: 节点视觉幽灵化（半透明/虚线），逻辑上标记为 `isExternalSupply: true`，停止该分支的所有上游递归推演。

## Risks / Trade-offs

- **[Risk]** 产业链过深导致画布过宽。 -> **Mitigation** 支持横向滚动，并优化节点间距。
- **[Risk]** 能量电池的双重身份可能混淆。 -> **Mitigation** 在 UI 上通过分类明确意图，但在画布上统一为 Ware Node。
