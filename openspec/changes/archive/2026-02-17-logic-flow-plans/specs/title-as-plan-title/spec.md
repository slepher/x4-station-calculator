# Title as Plan Title Specification (Delta)

## MODIFIED Requirements

### Requirement: Dynamic Document Title
The system SHALL 根据当前活动的方案名称更新浏览器文档标题。

#### Scenario: No Active Plan
- **前提** 当前未加载任何方案（或处于默认状态）
- **当** 当前视图为生产视图
- **那么** 文档标题 SHALL 为 "Default Station Name" 的本地化文本。

#### Scenario: No Active Plan - Logic Flow
- **前提** 当前未加载任何方案（或处于默认状态）
- **当** 当前视图为逻辑组网视图
- **那么** 文档标题 SHALL 为 "Default Flow Name" 的本地化文本。

#### Scenario: Active Plan Loaded
- **前提** 加载了名称为 "My Station" 的方案
- **当** 当前视图为生产视图
- **那么** 文档标题 SHALL 为 "My Station"。

#### Scenario: Active Plan Loaded - Logic Flow
- **前提** 加载了名称为 "My Flow" 的逻辑组网方案
- **当** 当前视图为逻辑组网视图
- **那么** 文档标题 SHALL 为 "My Flow"。

### Requirement: Toolbar Title Editing
The system SHALL 允许用户在工具栏直接编辑方案标题。

#### Scenario: Edit Interaction
- **前提** 用户点击工具栏上的方案标题
- **那么** 标题 SHALL 变为输入框，且自动获得焦点。
- **并且** 输入框右侧 SHALL 显示一个确认（打勾）按钮。

#### Scenario: Confirm Edit
- **前提** 用户正在编辑标题
- **当** 用户按下回车键 OR 点击确认按钮
- **那么** 标题更改 SHALL 被保存，且输入框关闭。

#### Scenario: Cancel Edit (Blur)
- **前提** 用户正在编辑标题
- **当** 输入框失去焦点（且未点击确认按钮）
- **那么** 编辑操作 SHALL 被取消，标题回退到编辑前的值。

#### Scenario: Empty Title Reversion (On Confirm)
- **前提** 用户将标题清空并确认
- **那么** 标题 SHALL 回退到上一个有效值（如果之前是默认值，则保持默认值）。

#### Scenario: Store Synchronization - Production
- **前提** 当前视图为生产视图
- **当** 用户更改标题为 "New Name"
- **那么** `stationStore.currentPlanName` SHALL 更新为 "New Name"。

#### Scenario: Store Synchronization - Logic Flow
- **前提** 当前视图为逻辑组网视图
- **当** 用户更改标题为 "New Flow Name"
- **那么** `logicFlowStore.currentPlanName` SHALL 更新为 "New Flow Name"。

### Requirement: Visual Stability
The system SHALL 确保标题在编辑态和非编辑态之间的切换平滑，无明显界面抖动。

#### Scenario: Font Consistency
- **前提** 标题处于任何状态
- **那么** 字体大小 SHALL 保持一致（推荐 text-2xl）。

#### Scenario: Height Consistency
- **前提** 标题状态切换
- **那么** 标题容器的高度 SHALL 保持不变，防止布局跳变。

### Requirement: Theme Color Switching
The system SHALL 根据当前视图动态切换标题栏的主题色。

#### Scenario: Production View Theme
- **前提** 当前视图为生产视图
- **那么** 标题文字 SHALL 使用 `text-sky-400` 颜色
- **并且** 保存按钮 SHALL 使用 `bg-blue-600` 颜色
- **并且** 新建按钮 SHALL 使用 `bg-cyan-500` 颜色
- **并且** 加载按钮 SHALL 使用 `bg-cyan-500` 颜色

#### Scenario: Logic Flow View Theme
- **前提** 当前视图为逻辑组网视图
- **那么** 标题文字 SHALL 使用 `text-purple-400` 颜色
- **并且** 保存按钮 SHALL 使用 `bg-purple-600` 颜色
- **并且** 新建按钮 SHALL 使用 `bg-fuchsia-500` 颜色
- **并且** 加载按钮 SHALL 使用 `bg-fuchsia-500` 颜色

### Requirement: Save Validation
The system SHALL 防止保存空方案。

#### Scenario: Empty Plan Save Attempt - Production
- **前提** 当前视图为生产视图
- **当** 方案中没有添加任何模块
- **当** 用户点击"保存"或"另存为"
- **那么** 系统 SHALL 显示警告消息，并且不打开保存对话框。

#### Scenario: Empty Plan Save Attempt - Logic Flow
- **前提** 当前视图为逻辑组网视图
- **当** 方案中没有添加任何产线组
- **当** 用户点击"保存"或"另存为"
- **那么** 系统 SHALL 显示警告消息，并且不打开保存对话框。

### Requirement: Smart Save Dialog
The system SHALL 根据当前状态智能预填保存标题。

#### Scenario: Save New Plan
- **前提** 这是一个未保存的新方案，且用户已修改标题为 "My Layout"
- **当** 用户点击保存
- **那么** 保存对话框的输入框 SHALL 预填 "My Layout"。

#### Scenario: Save New Logic Flow Plan
- **前提** 当前视图为逻辑组网视图
- **当** 这是一个未保存的新方案
- **那么** 保存对话框的输入框 SHALL 预填默认逻辑组网名称。

### Requirement: Action Button Behavior Switching
The system SHALL 根据当前视图切换功能按钮的行为。

#### Scenario: New Button - Production
- **前提** 当前视图为生产视图
- **当** 用户点击"新建"按钮
- **那么** 系统 SHALL 调用 `stationStore.clearAll()` 或显示 SmartSaveDialog。

#### Scenario: New Button - Logic Flow
- **前提** 当前视图为逻辑组网视图
- **当** 用户点击"新建"按钮
- **那么** 系统 SHALL 调用 `logicFlowStore.clearAll()` 或显示 SmartSaveDialog。

#### Scenario: Save Button - Production
- **前提** 当前视图为生产视图
- **当** 用户点击"保存"按钮
- **那么** 系统 SHALL 调用 `stationStore.saveCurrentPlan()`。

#### Scenario: Save Button - Logic Flow
- **前提** 当前视图为逻辑组网视图
- **当** 用户点击"保存"按钮
- **那么** 系统 SHALL 调用 `logicFlowStore.saveCurrentPlan()`。

#### Scenario: Load Button - Production
- **前提** 当前视图为生产视图
- **当** 用户点击"加载"按钮
- **那么** 系统 SHALL 显示 LoadPlanModal。

#### Scenario: Load Button - Logic Flow
- **前提** 当前视图为逻辑组网视图
- **当** 用户点击"加载"按钮
- **那么** 系统 SHALL 显示 LoadFlowPlanModal。
