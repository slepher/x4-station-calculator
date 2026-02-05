# Search UI Specification

## Purpose
改进模块搜索的用户界面，提升用户体验和交互效率。

## MODIFIED Requirements

### Requirement: Search Component Layout
The system SHALL将模块搜索组件从模块列表底部移动到顶部，作为列表的第一个元素显示。

#### Scenario: Initial Render
- **当** 用户打开模块列表时
- **然后** 搜索/添加按钮应位于所有模块层级（Tier 1/2/3）的上方

### Requirement: Module Addition Flow
The system SHALL在用户点击搜索结果时，直接添加模块到规划区，无需预览确认。

#### Scenario: Add Module
- **当** 用户在搜索结果中点击一个模块
- **然后** 系统应直接将模块添加到规划区
- **且** 无需额外的预览或确认步骤

### Requirement: Search Menu Behavior
The system SHALL在用户完成模块添加操作后，保持搜索菜单打开状态，支持连续添加。

#### Scenario: Single Add
- **当** 用户成功添加一个模块后
- **然后** 搜索弹出菜单应保持打开状态
- **且** 界面焦点保持在搜索界面，支持继续添加

## ADDED Requirements

### Requirement: Right-side Popup Effect  
The system SHALL实现搜索框从右侧弹出的效果。

#### Scenario: Search Box Popup
- **当** 用户点击搜索框时
- **然后** 搜索框应从右侧平滑弹出

### Requirement: Smart Animation Feedback
The system SHALL提供模块添加和数量更新的动画反馈。

#### Scenario: Module Addition Animation
- **当** 用户添加新模块时
- **然后** 新模块应有边框高亮动画

#### Scenario: Quantity Update Animation
- **当** 用户更新模块数量时
- **然后** 模块数量应有数字闪烁动画

## 技术实现

### 组件修改
- **StationModuleList.vue**: 布局结构调整，动画监听逻辑
- **StationModuleSelector.vue**: 搜索逻辑优化，菜单行为改进
- **StationModuleItem.vue**: 动画效果实现，样式优化

### 动画系统架构
- **事件驱动**: 直接在UI层处理动画，避免复杂的数据监听
- **智能对比**: 基于模块ID的精准动画触发
- **多重反馈**: 模块边框高亮 + 数字闪烁动画

## 验收标准

- ✅ 搜索框位于模块列表顶部
- ✅ 搜索框从右侧平滑弹出
- ✅ 点击搜索结果直接添加模块
- ✅ 点击后菜单保持打开状态
- ✅ 添加模块时有边框高亮动画
- ✅ 更新模块数量时有数字闪烁动画
- ✅ 支持快速连续操作，动画不冲突

## 测试验证
- 功能回归测试已完成
- 所有改动已通过人工测试流程验证