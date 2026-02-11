# Title as Plan Title Specification

## Purpose
实现方案标题的编辑、持久化以及与浏览器文档标题的同步，确保用户在新建、保存、加载方案时标题行为符合直觉。

## Requirements

### Requirement: Dynamic Document Title
The system SHALL 根据当前活动的方案名称更新浏览器文档标题。

#### Scenario: No Active Plan
- **前提** 当前未加载任何方案（或处于默认状态）
- **那么** 文档标题 SHALL 为 "Default Station Name" 的本地化文本。

#### Scenario: Active Plan Loaded
- **前提** 加载了名称为 "My Station" 的方案
- **那么** 文档标题 SHALL 为 "My Station"。

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

#### Scenario: Store Synchronization
- **前提** 用户更改标题为 "New Name"
- **那么** 内部 Store 的 `currentPlanName` SHALL 更新为 "New Name"。

### Requirement: Visual Stability
The system SHALL 确保标题在编辑态和非编辑态之间的切换平滑，无明显界面抖动。

#### Scenario: Font Consistency
- **前提** 标题处于任何状态
- **那么** 字体大小 SHALL 保持一致（推荐 text-2xl）。

#### Scenario: Height Consistency
- **前提** 标题状态切换
- **那么** 标题容器的高度 SHALL 保持不变，防止布局跳变。

### Requirement: Save Validation
The system SHALL 防止保存空方案。

#### Scenario: Empty Plan Save Attempt
- **前提** 方案中没有添加任何模块
- **当** 用户点击“保存”或“另存为”
- **那么** 系统 SHALL 显示警告消息，并且不打开保存对话框。

### Requirement: Smart Save Dialog
The system SHALL 根据当前状态智能预填保存标题。

#### Scenario: Save New Plan
- **前提** 这是一个未保存的新方案，且用户已修改标题为 "My Layout"
- **当** 用户点击保存
- **那么** 保存对话框的输入框 SHALL 预填 "My Layout"。
