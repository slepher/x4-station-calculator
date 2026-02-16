# Logic Flow Drag Feedback Design

## Architecture

### 1. State Management (Pinia)
`useLogicFlowStore` 将扩展以下状态和逻辑：
- `isHoveringNewZone`: 布尔值，标识当前是否悬停在“新建产线”区域。
- `hoveredGroupT0Resources`: 计算属性，根据 `hoveredGroupId` 和 `draggingWareId` 实时计算当前悬停组的 T0 资源需求，并应用 **Dependency-Follow Sorting**。

### 2. Resource Calculation Logic
更新 `calculateRequiredT0Wares` 或新增 `getSortedGroupResources`：
- **输入**: `nodes[]` (排序后的产线节点列表)。
- **逻辑**: 
  1. 遍历节点列表。
  2. 对每个节点，递归计算其 T0 需求。
  3. 将需求按节点顺序展平（flatMap）。
  4. 对展平后的资源列表进行去重，保留首次出现的顺序。
- **输出**: `string[]` (有序的资源 ID 列表)。

### 3. UI Components

#### `LogicFlowPlanningZone.vue` (Compact View)
- **Header Resource Icons**:
  - 在每个产线组标题右侧展示 T0 资源列表。
  - 使用 `v-for` 渲染排序后的资源 ID。
  - 显示为 i18n 短名（如 `Si`, `Ore`）。
- **Drag Feedback Logic**:
  - 新增 `dragFeedbackStatus` 计算属性：
    - 如果 `draggingWareId` 已存在于组内且 `isLocked`:
      - 若悬停在 Header: 返回 `locked`。
      - 若悬停在 Grid: 返回 `unlock`。
    - 如果 `draggingWareId` 已存在于组内且其 `source === 'auto'`:
      - 若悬停在 Header: 返回 `auto`。
      - 若悬停在 Grid: 返回 `manual`。
    - 否则保持现有的 `duplicated` 或 `add` 逻辑。
- **Phantom Node Implementation**:
  - 修改 `nodesWithPreview` 逻辑：即使 `draggingWareId` 已存在于组内（但处于 `locked` 或 `source === 'auto'` 状态），当悬停在 Grid 时，也应生成一个 `isPreview: true` 的临时节点，以指示其在网格中的位置。
- **Sorting Implementation**:
  - 获取组内节点 -> 排序（按 Grid 顺序） -> 调用 Store 的排序计算函数。

#### `LogicFlowCandidateZone.vue`
- **Static Resource Display**:
  - 在 `.ware-card` 内部，产物名称下方新增 `div.resource-list`。
  - 遍历该产物的 T0 输入资源，显示为逗号分隔的短名字符串。
  - 样式：`text-xs text-gray-400`。
- **Removal**:
  - 移除 `<DraggingResourcePreview />` 组件及其引用。

#### `LogicFlowNode.vue`
- **Visual Distinction**:
  - 根据 `node.source` 绑定不同的 CSS Class：
    - `node.source === 'manual'`: `.is-manual` (实线边框)。
    - `node.source === 'auto'`: `.is-auto` (虚线边框，`.opacity-80`)。
  - 在 Auto 节点上可选展示一个小标识图标。
- **Dynamic Action Buttons**:
  - 按钮显示逻辑重构：
    - **删除按钮 (🗑️)**: 只有当 `node.source === 'manual'` 时才显示。
    - **锁定按钮 (🔒)**: 只有当节点被其他节点依赖时（作为上游）才显示。
  - 操作逻辑：
    - `handleDelete`: 
      - 如果节点被依赖：调用 `store.downgradeNode(nodeId)` (将 `source` 改为 `auto`)。
      - 如果不被依赖：调用 `store.removeNode(nodeId)` (彻底移除)。
    - `handleToggleLock`:
      - 如果 `source === 'manual'` 且被依赖：调用 `store.convertToLockedAuto(nodeId)` (先删后锁)。
      - 否则：调用 `store.toggleLock(nodeId)`。

### 4. Lock Logic & Permissions Implementation
- **Store Update (`isWareInAnyGroup`)**:
  - 修改遍历逻辑，增加 `!node.isLocked` 过滤条件。只有非锁定节点才算作“已规划”。
- **Store Update (`expandUpstream`)**:
  - 在递归检查现有节点时，如果找到 `existingNode` 且 `existingNode.isLocked` 为真，则直接 `return`（视为满足需求，停止扩展），且不执行属性更新。
- **Dependency Detection**:
  - 新增 `isNodeDepended(groupId, wareId)` 方法：遍历组内所有节点的 `inputs`，检查是否有其他节点的输入包含该 `wareId`。
- **Node Identity Transformation**:
  - `downgradeNode(groupId, nodeId)`: 仅将节点的 `source` 从 `manual` 改为 `auto`。
  - `convertToLockedAuto(groupId, nodeId)`: 将 `source` 改为 `auto` 并设置 `isLocked = true`。
- **Store Update (`handleDropOnGroup`)**:
  - 新增逻辑：如果 `draggingWareId` 对应组内的一个 `locked` 节点，且当前处于 `unlock` 悬停状态：
    - 执行 `unlockNode(groupId, wareId)`。
    - 紧接着执行 `expandUpstream(groupId, wareId)`。
  - 新增逻辑：如果 `draggingWareId` 对应组内的一个 `auto` 节点，且当前处于 `manual` 悬停状态：
    - 执行 `promoteNode(groupId, wareId)` (将 `source` 从 `auto` 变为 `manual`)。

### 5. Candidate Zone Interaction
 - **Derived Filtering (Store Level)**:
   - 候选区不再使用 `allowedGroups` 和 `w.tier === 0` 进行硬编码过滤。
   - `useGameDataStore` 中的 `precomputeCandidateWares` 负责生成每个分类的“闭环产业链集”。
   - 推导逻辑：从该分类的所有模块 `outputs` 出发，通过 `findModuleForWare` 递归回溯所有 `inputs`，直到 T0。
   - 结果：不属于产业链的物品（如 Nividium）会自动消失，不同种族的 T0 需求会自动差异化。
 - **Button Visibility**:
  - 在 `v-if` 条件中增加 `ware.tier > 0 || ware.id === 'energycells'` 判断。
- **Menu Dismiss**:
  - 在 `addProductionLine` 动作触发后，手动设置 `activeMenuWareId.value = null`。

## Logic Flow

1. **Candidate Zone Rendering**:
   - 组件加载时，对每个 candidate ware 计算 T0 资源并显示。

2. **Planning Zone Rendering**:
   - **Normal State**: 获取组内节点 -> 排序 -> 计算 T0 资源 -> 显示。
   - **Dragging State (Hover)**: 
     - 将 `draggingWare` 视为一个临时节点，根据其 Tier 插入到组内节点列表的正确位置。
     - 重新执行排序和资源计算逻辑。
     - 渲染更新后的资源列表。

## Performance
- 资源计算逻辑应进行缓存（Memoization），特别是对于候选区这种静态列表，避免重复计算。
