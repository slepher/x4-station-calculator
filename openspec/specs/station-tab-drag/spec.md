# Station Tab Drag Specification

## Purpose
为多空间站标签栏增加可拖拽重排能力，使用户可以直接调整空间站管理顺序，并在刷新后保持一致。

## Requirements

### Requirement: Station Tab Drag Reorder
系统 SHALL 允许用户通过拖拽动态空间站标签调整 `stations` 的显示顺序。

#### Scenario: Drag station tab to reorder
- **前提** 帝国中至少存在两个空间站标签
- **当** 用户将某个空间站标签拖拽到另一个空间站标签之前或之后
- **那么** 系统 SHALL 按拖拽目标更新空间站标签顺序
- **并且** 内容区域与标签列表 SHALL 立即反映新顺序

### Requirement: Fixed Overview Tab Exclusion
系统 MUST 保持“帝国总览”标签固定在第一位，且该标签不参与拖拽排序。

#### Scenario: Attempt to drag around overview tab
- **前提** 标签栏包含“帝国总览”和多个空间站标签
- **当** 用户执行空间站标签拖拽
- **那么** “帝国总览”标签 MUST 始终位于第一个位置
- **并且** 系统 MUST 仅对空间站标签应用重排

### Requirement: Drag Feedback and Safe Cancel
系统 SHALL 在拖拽过程中提供可见反馈，并在无效或取消拖拽时保持原顺序。

#### Scenario: Cancel drag operation
- **前提** 用户已开始拖拽空间站标签
- **当** 用户在无效区域释放或取消本次拖拽
- **那么** 系统 SHALL 保持原有空间站顺序不变
- **并且** 当前激活空间站 SHALL 保持不变

### Requirement: Reorder Persistence
系统 SHALL 在用户保存后持久化重排结果，并在重新加载时恢复。

#### Scenario: Save and reload reordered tabs
- **前提** 用户已完成空间站标签重排
- **当** 用户执行保存并重新加载应用
- **那么** 系统 SHALL 恢复保存时的空间站标签顺序
- **并且** 顺序来源 SHALL 与 `stations` 数组顺序一致
