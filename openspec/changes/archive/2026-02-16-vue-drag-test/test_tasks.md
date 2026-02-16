# Test Tasks

## Unit Tests

### Store Logic
- [ ] **DragTestStore State Management**
  - **Goal**: 验证 Store 的基本状态管理功能。
  - **File**: `tests/unit/drag-test-store.spec.ts`
  - **Cases**:
    - [ ] 初始化时 Zone A 包含 3 个项目，Zone B 为空。
    - [ ] `moveItem` 正确更新项目的 zone 属性。
    - [ ] `resetState` 清空所有项目和事件记录。

### Event Recording
- [ ] **Event Recording System**
  - **Goal**: 验证事件记录系统正确记录所有拖拽事件。
  - **File**: `tests/unit/drag-test-store.spec.ts`
  - **Cases**:
    - [ ] `recordEvent` 正确添加事件到历史记录。
    - [ ] `getEventHistory` 返回按时间顺序排列的事件列表。
    - [ ] `clearEventHistory` 清空事件历史。

## Web Integration Tests (E2E)

### 1. Basic Drag and Drop Tests

#### 1.1 Method A: dispatchEvent (Recommended)
- [ ] **Scenario**: 使用 dispatchEvent 模拟原生拖拽事件。
  - **Goal**: 验证 dispatchEvent 方法能可靠触发 vuedraggable 事件。
  - **Steps**:
    1. 创建 DataTransfer 对象。
    2. 派发 dragstart 事件到源元素。
    3. 派发 dragover 事件到目标区域。
    4. 派发 drop 事件到目标区域。
    5. 派发 dragend 事件到源元素。
  - **Verify**:
    - [ ] 项目成功从 Zone A 移动到 Zone B。
    - [ ] Store 中的事件序列正确：`dragstart` → `dragenter` → `dragover` → `drop` → `dragend`。
    - [ ] Zone A 的项目数量减少 1。
    - [ ] Zone B 的项目数量增加 1。

#### 1.2 Method B: Playwright Mouse API
- [ ] **Scenario**: 使用 Playwright mouse API 模拟物理鼠标操作。
  - **Goal**: 验证 mouse API 是否能触发 vuedraggable 事件，并记录其局限性。
  - **Steps**:
    1. 定位源元素。
    2. 执行 `mouse.down()`。
    3. 执行 `mouse.move()` 到目标位置（带 steps 参数）。
    4. 执行 `mouse.up()`。
  - **Verify**:
    - [ ] 记录是否成功触发 `@add` 事件。
    - [ ] 如果失败，记录失败原因和可能的解决方案。

#### 1.3 Method C: Hybrid Approach
- [ ] **Scenario**: 混合使用 mouse API 和 dispatchEvent。
  - **Goal**: 验证混合方案是否能同时获得视觉反馈和事件触发。
  - **Steps**:
    1. 使用 mouse API 移动到目标位置。
    2. 在目标位置派发 dragover 和 drop 事件。
  - **Verify**:
    - [ ] 记录方案的可行性和稳定性。

### 2. Hover and Rollback Tests

#### 2.1 Hover Enter/Leave Detection
- [ ] **Scenario**: 悬停进入和离开检测。
  - **Goal**: 验证拖拽悬停状态的正确检测和回滚。
  - **Steps**:
    1. 开始拖拽项目。
    2. 移动到 Zone B 上方（不释放）。
    3. **Verify**: Zone B 显示悬停视觉反馈（蓝色边框）。
    4. 移动出 Zone B 区域。
    5. **Verify**: Zone B 恢复原始状态。
    6. 释放鼠标（在 Zone B 外部）。
    7. **Verify**: 项目仍在 Zone A 中。
  - **Verify**:
    - [ ] 事件序列：`dragstart` → `dragenter` → `dragleave` → `dragend`。
    - [ ] Store 状态未改变。

#### 2.2 Cancel Drag with Escape
- [ ] **Scenario**: 使用 Escape 键取消拖拽。
  - **Goal**: 验证 Escape 键取消拖拽的正确行为。
  - **Steps**:
    1. 开始拖拽项目。
    2. 移动到 Zone B 上方。
    3. 按下 Escape 键。
  - **Verify**:
    - [ ] 项目返回原始位置。
    - [ ] 所有悬停状态清除。
    - [ ] 事件序列：`dragstart` → `dragend`。

### 3. Drop Status Classification Tests

#### 3.1 Normal Status
- [ ] **Scenario**: 正常投放状态。
  - **Steps**:
    1. 拖拽 Zone A 中的项目到 Zone B。
  - **Verify**:
    - [ ] Zone B 显示蓝色边框（Normal 状态）。
    - [ ] 投放成功。

#### 3.2 Duplicated Status
- [ ] **Scenario**: 重复项目状态。
  - **Steps**:
    1. 移动项目 A 从 Zone A 到 Zone B。
    2. 再次拖拽相同项目 A 到 Zone B。
  - **Verify**:
    - [ ] Zone B 显示红色边框（Duplicated 状态）。
    - [ ] 投放被拒绝。
    - [ ] Store 状态未改变。

#### 3.3 Auto Node Promotion
- [ ] **Scenario**: Auto 节点转正。
  - **Steps**:
    1. 在 Zone B 中创建一个 Auto 状态的占位符项目。
    2. 拖拽相同项目到 Zone B。
  - **Verify**:
    - [ ] Header 显示 "Auto" 标签。
    - [ ] 进入 Grid 区域后标签变为 "Manual"。
    - [ ] 投放后项目状态从 Auto 变为 Manual。

#### 3.4 Isolated Node Connection
- [ ] **Scenario**: 隔离节点连接。
  - **Steps**:
    1. 在 Zone B 中创建一个 Isolated 状态的占位符项目。
    2. 拖拽相同项目到 Zone B。
  - **Verify**:
    - [ ] Header 显示 "Isolate" 标签。
    - [ ] 进入 Grid 区域后标签变为 "Connect"。
    - [ ] 投放后项目解除隔离状态。

#### 3.5 Locked Group with Matching Lineage
- [ ] **Scenario**: 锁定组匹配血统。
  - **Steps**:
    1. 将 Zone B 设置为锁定状态，血统为 "Terran"。
    2. 拖拽血统为 "Terran" 的项目到 Zone B。
  - **Verify**:
    - [ ] Zone B 显示琥珀色边框（Locked 状态）。
    - [ ] 投放成功。

#### 3.6 Locked Group with Rejected Lineage
- [ ] **Scenario**: 锁定组拒绝不匹配血统。
  - **Steps**:
    1. 将 Zone B 设置为锁定状态，血统为 "Terran"。
    2. 拖拽血统为 "Argon" 的项目到 Zone B。
  - **Verify**:
    - [ ] Zone B 显示红色边框和 🚫 标识（Rejected 状态）。
    - [ ] 投放被拒绝。

### 4. Event Sequence Verification Tests

#### 4.1 Successful Drop Sequence
- [ ] **Scenario**: 成功投放的事件序列。
  - **Steps**:
    1. 执行完整的拖拽投放操作。
  - **Verify**:
    - [ ] 事件序列：`dragstart` → `dragenter` → `dragover` → `drop` → `dragend`。

#### 4.2 Cancelled Drag Sequence
- [ ] **Scenario**: 取消拖拽的事件序列。
  - **Steps**:
    1. 开始拖拽。
    2. 按 Escape 取消。
  - **Verify**:
    - [ ] 事件序列：`dragstart` → `dragend`（无 drop 事件）。

#### 4.3 Hover and Leave Sequence
- [ ] **Scenario**: 悬停后离开的事件序列。
  - **Steps**:
    1. 开始拖拽。
    2. 进入 Zone B。
    3. 离开 Zone B。
    4. 在外部释放。
  - **Verify**:
    - [ ] 事件序列：`dragstart` → `dragenter` → `dragleave` → `dragend`。

### 5. Performance and Reliability Tests

#### 5.1 Rapid Drag Operations
- [ ] **Scenario**: 快速连续拖拽操作。
  - **Goal**: 验证系统在快速操作下的稳定性。
  - **Steps**:
    1. 快速执行 10 次拖拽操作。
  - **Verify**:
    - [ ] 所有操作正确完成。
    - [ ] 无事件丢失或重复。

#### 5.2 Cross-Browser Consistency
- [ ] **Scenario**: 跨浏览器一致性测试。
  - **Goal**: 验证拖拽行为在不同浏览器中的一致性。
  - **Browsers**: Chromium, Firefox, WebKit
  - **Verify**:
    - [ ] 记录各浏览器的测试结果。
    - [ ] 记录任何浏览器特定的行为差异。
