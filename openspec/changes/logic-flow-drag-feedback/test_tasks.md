# Test Tasks

## Unit Tests
- [x] **Store Logic**: 测试 `getSortedGroupT0Resources`。
  - [x] Case: 单个节点，返回其 T0 资源。
  - [x] Case: 两个节点 A(Si), B(Ore)。顺序 A, B -> [Si, Ore]。
  - [x] Case: 两个节点 A(Si), B(Ore)。顺序 B, A -> [Ore, Si]。
  - [x] Case: 重复资源。A(Si, Ore), B(Si)。顺序 A, B -> [Si, Ore]。
  - [x] Case: 复杂依赖。A(Advanced Electronics -> Microchip(Si) + Quantum Tube(Graphene(Methane), Superfluid(He)))。

### New Requirements (Lock & UI)
- [x] **LogicFlow Locked Logic**
  - **Goal**: 验证锁定节点在规划计算和递归扩展中的行为。
  - **File**: `tests/unit/logic-flow-locked.spec.ts`
  - **Status**: ✅ Passed
  - **Cases**:
    - [x] `isWareInAnyGroup` 应忽略锁定的节点（不视为已规划）。
    - [x] `expandUpstream` 遇到锁定节点应立即停止（不扩展上游）。
    - [x] `expandUpstream` 遇到锁定节点不应覆盖其状态。

- [x] **LogicFlow Candidate Zone UI**
  - **Goal**: 验证候选区 UI 逻辑变更。
  - **File**: `tests/unit/logic-flow-candidate.spec.ts`
  - **Status**: ✅ Passed
  - **Cases**:
    - [x] Tier 0 资源（矿物/气体）不应显示 "+" 按钮。
    - [x] Energy Cells 作为例外，应显示 "+" 按钮。
    - [x] Tier 1+ 资源应显示 "+" 按钮。
    - [x] 点击菜单项后应正确 dismiss 菜单（通过模拟交互验证）。

## Web Integration Tests (E2E)

### 4.1 Visual: New Line Ghosting (Phantom Preview)
- [x] **Scenario**: 拖拽一个 T2+ 模块到 "New Line" 区域。
  - [x] 验证 "Preview: [Ware Name]" 标题显示。
  - [x] 验证 Header 中显示正确的 T0 资源列表。
  - [x] 验证 Grid 中出现 Phantom Node，且位置正确（根据 Tier）。

### 4.2 Visual: Real-time T0 Resource Header Updates
- [x] **Scenario**: 拖拽模块悬停在现有组上。
  - [x] 验证 Header 资源列表实时更新。
  - [x] 验证新增加的资源（组内原先没有的）有脉冲动画或其他视觉提示。

### 4.5 End-to-End: Final State Verification
- [x] **Case A**: 拖拽到现有组。
  - [x] 验证模块成功添加到组内。
  - [x] 验证组数量保持不变。
- [x] **Case B**: 拖拽到 "New Line" 区域。
  - [x] 验证创建了新的组。
  - [x] 验证组数量增加。

### 4.6 T0 Ware Behavior: Non-draggable and No Preview
- [x] **Candidate Zone Display**:
  - [x] 验证 T0 产物（如 Ore）不显示资源预览列表。
  - [x] 验证 T1+ 产物（如 Silicon Wafers）显示文本形式的资源列表（i18n 短名）。
  - [x] 验证没有浮动的预览组件跟随鼠标。
- [x] **Interaction**:
  - [x] 验证 T0 产物不可拖拽（LogicFlow store `isDragging` 保持为 false）。

### 4.7 Visual: Dependency-Follow Sorting
- [x] **Scenario**: 依赖跟随排序。
  - [x] 创建两个产线：A (依赖 R1), B (依赖 R2)。
  - [x] 拖拽 A 到组 -> Header 显示 [R1]。
  - [x] 拖拽 B 到组（放在 A 后面） -> Header 显示 [R1, R2]。
  - [x] 拖拽 B 到组（放在 A 前面） -> Header 显示 [R2, R1]。

### 4.8 Interaction: Lock Protection (New)
- [x] **Scenario**: 拖拽时的锁定保护验证。
  - **Goal**: 验证拖拽新产线到包含锁定节点的组时，锁定节点受到保护且不被覆盖。
  - **Steps**:
    1. 创建一个新的生产线组，并添加 `Graphene` 节点。
    2. 点击 `Graphene` 节点上的锁定图标，使其进入 **Locked** 状态。
    3. 从候选区拖拽 `Hull Parts`（其配方包含 Graphene）到该组中。
    4. **Verify**: 
       - `Hull Parts` 节点成功添加。
       - 原有的 `Graphene` 节点保持 **Locked** 状态，未被重置为 Unlocked。
       - 系统未生成重复 of `Graphene` 节点。
       - 候选区中 `Graphene` 的状态点（绿色）应忽略该锁定节点（即不视为已规划）。

### 4.9 UI: Candidate Zone Improvements (New)
- [x] **Scenario**: 候选区按钮与菜单交互。
  - **Goal**: 验证候选区按钮显示逻辑及菜单交互的正确性。
  - **Steps**:
    1. **T0 Button Check**:
       - 鼠标悬停在 `Ore` 或 `Silicon` 上，**预期结果**: 不显示 "+" 快速添加按钮。
       - 鼠标悬停在 `Energy Cells` 上，**预期结果**: 显示 "+" 快速添加按钮。
    2. **Menu Dismissal**:
       - 悬停在任意可生产产品（如 `Hull Parts`）上，点击 "+" 按钮打开菜单。
       - 点击菜单项 "New Production Line"。
       - **Verify**: 菜单应立即关闭，且界面正确响应（创建新组）。

### 4.10 Interaction: No Accidental Planning (Bug Fix)
- [x] **Scenario**: 验证点击候选区产物卡片本身不再触发添加操作。
  - **Goal**: 确保用户点击查看时不会意外创建产线或使产物变绿。
  - **Steps**:
    1. 确保当前没有任何生产线组（清空状态）。
    2. 点击候选区中的 `Advanced Electronics` 卡片主体（避开 "+" 按钮）。
    3. **Verify**:
       - 没有任何新的生产线组被创建。
       - 该产物没有变绿（没有被标记为 Planned）。
    4. 点击 "+" 按钮，然后选择添加。
    5. **Verify**:
       - 成功创建新组。

### 4.11 Interaction: Drag to Unlock (Added)
- [x] **Scenario**: 拖拽解锁锁定节点。
  - **Goal**: 验证拖拽相同产物到锁定节点上可以触发解锁和上游生成。
  - **Steps**:
    1. 创建包含锁定 `Graphene` 的产线组。
    2. 拖拽 `Graphene` 悬停在 Header，**Verify**: 标签显示 `Locked`。
    3. 拖拽 `Graphene` 悬停在 Grid，**Verify**: 标签显示 `Unlock`。
    4. **Verify**: 在 Grid 区域显示 `Graphene` 的蓝色虚线停靠预览点。
    5. 投放，**Verify**: `Graphene` 变为非锁定状态，且生成了 `Methane` 产线。

### 4.13 Interaction: Node Permission Matrix & Transitions (New)
- [x] **Scenario: Manual Node Actions**
  - [x] 手动添加 `Advanced Electronics` 到一个新组。
  - [x] 它是组内唯一的节点（无下游依赖）。
  - [x] **Verify**: 节点仅显示 **🗑️ (Delete)** 按钮，不显示 **🔒 (Lock)** 按钮。
  - [x] 点击删除，**Verify**: 节点被彻底移除。
- [x] **Scenario: Auto Node Actions**
  - [x] 手动添加 `Advanced Electronics`。
  - [x] 观察其自动生成的依赖项 `Microchip`。
  - [x] **Verify**: `Microchip` 节点仅显示 **🔒 (Lock)** 按钮，不显示 **🗑️ (Delete)** 按钮。
- [x] **Scenario: Mixed Node (Manual -> Auto Downgrade)**
  - [x] 手动添加 `Microchip`。
  - [x] 手动添加 `Advanced Electronics`（它也依赖 `Microchip`）。
  - [x] 此时 `Microchip` 既是 Manual 又是被依赖项。
  - [x] **Verify**: `Microchip` 节点同时显示 **🗑️ (Delete)** 和 **🔒 (Lock)** 按钮。
  - [x] 点击删除，**Verify**: `Microchip` 节点未消失，但边框由实线变为虚线（转为 Auto 状态）。
- [x] **Scenario: Mixed Node (Manual -> Locked Auto)**
  - [x] 处于上述混合状态。
  - [x] 点击 `Microchip` 的锁定按钮。
  - [x] **Verify**: `Microchip` 的手动身份移除，且进入锁定状态（停止上游递归）。

### 4.14 Interaction: Auto Node Promotion (New)
- [x] **Scenario: Promote Auto to Manual**
  - **Goal**: 验证拖拽相同产物到 Auto 节点上可以将其提升为手动节点。
  - **Steps**:
    1. 手动添加 `Advanced Electronics`，生成自动依赖 `Microchip`。
    2. 拖拽 `Microchip` 悬停在 Header，**Verify**: 标签显示 `Auto`。
    3. 拖拽 `Microchip` 悬停在 Grid，**Verify**: 标签显示 `Manual`。
    4. **Verify**: 在 Grid 区域显示 `Microchip` 的蓝色虚线停靠预览点。
    5. 投放，**Verify**: `Microchip` 的 `source` 变为 `manual`。
    6. **Verify**: `Microchip` 节点边框变为实线，且同时显示删除和锁定按钮（Hybrid 状态）。

### 4.15 UI: Dynamic T0 Derivation (New)
- [x] **Scenario: Dynamic T0 Filtering**
  - **Goal**: 验证 T0 资源是否根据当前生产链动态生成。
  - **Steps**:
    1. **Base Case (Default Race)**:
       - 验证候选区显示 `Ore`, `Silicon`, `Helium` 等常规 T0。
       - 验证 **不显示** `Nividium` 和 `Raw Scrap`。
    2. **Terran Race Case**:
       - 切换二级分类为 `Terran`。
       - 验证候选区 **不显示** `Silicon`, `Ore`（除非有特定模块需求）。
       - 验证显示地球人专属资源（如 `Silicon Carbide` 的上游）。
    3. **Consistency Check**:
       - 切换回 `Default`。
       - 验证资源列表恢复正常。

### 4.12 Visual: Node Provenance (Added)
- [x] **Scenario**: 节点来源视觉区分。
  - **Goal**: 验证 Manual 和 Auto 节点在 UI 上的区分。
  - **Steps**:
    1. 手动添加 `Hull Parts`。
    2. 自动生成其依赖。
    3. **Verify**: `Hull Parts` 节点为实线边框。
    4. **Verify**: 自动生成的依赖节点为虚线边框。
    5. **Verify**: 节点不再包含 🌳 按钮。

