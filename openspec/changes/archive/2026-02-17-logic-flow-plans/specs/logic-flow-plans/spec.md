# Logic Flow Plans Specification

## Purpose
为逻辑组网功能提供完整的方案管理能力，包括方案的创建、保存、加载、删除，以及方案数据的持久化与重建。用户可以在不同的逻辑组网方案之间切换，与空间站设计方案的管理体验保持一致。

## Requirements

### Requirement: Plan Data Structure
The system SHALL 使用精简的数据结构保存逻辑组网方案。

#### Scenario: Saved Plan Structure
- **前提** 用户保存一个逻辑组网方案
- **那么** 系统 SHALL 仅保存 manual 和 isolated 节点数据
- **并且** auto 节点 SHALL 不被保存到方案数据中

#### Scenario: Saved Group Structure
- **前提** 保存产线组数据
- **那么** 每个产线组 SHALL 包含：id, name, category, subCategory, isLocked, lockedLineage, nodes
- **并且** name 为空时，UI SHALL 动态计算并显示默认名称

#### Scenario: Saved Settings Structure
- **前提** 保存方案数据
- **那么** 方案 SHALL 包含 settings 字段
- **并且** settings SHALL 包含 isDefaultLocked（候选区锁定按钮状态）

### Requirement: Plan Persistence
The system SHALL 将逻辑组网方案持久化到 localStorage。

#### Scenario: Storage Keys
- **前提** 系统初始化
- **那么** 方案列表（包含 settings 和 activeId）SHALL 存储在 `x4_logic_flow_plans` key 下
- **并且** 旧的 `x4_logic_flow_data` SHALL 被废弃

#### Scenario: Auto Load Active Plan
- **前提** 系统初始化
- **当** savedPlans.activeId 存在
- **那么** 系统 SHALL 自动加载该 ID 对应的方案

#### Scenario: Auto Save on Change
- **前提** 用户修改当前方案
- **那么** 系统 SHALL 自动更新 `lastSavedSnapshot` 用于脏检查

### Requirement: Create New Plan
The system SHALL 允许用户创建新的逻辑组网方案。

#### Scenario: New Plan with Dirty Check
- **前提** 当前方案有未保存的修改
- **当** 用户点击"新建"按钮
- **那么** 系统 SHALL 显示 SmartSaveDialog
- **并且** 用户可以选择保存当前方案或放弃修改

#### Scenario: New Plan without Dirty
- **前提** 当前方案无未保存的修改
- **当** 用户点击"新建"按钮
- **那么** 系统 SHALL 直接清空当前工作区

### Requirement: Save Plan
The system SHALL 允许用户保存当前逻辑组网方案。

#### Scenario: Save Existing Plan
- **前提** 当前方案已存在于方案列表中
- **当** 用户点击"保存"按钮
- **那么** 系统 SHALL 更新现有方案的数据

#### Scenario: Save New Plan
- **前提** 当前方案未保存过
- **当** 用户点击"保存"按钮
- **那么** 系统 SHALL 显示 SmartSaveDialog 让用户输入方案名称

#### Scenario: Save Empty Plan
- **前提** 当前方案中没有任何产线组
- **当** 用户点击"保存"或"另存为"
- **那么** 系统 SHALL 显示警告消息，不执行保存操作

### Requirement: Save As New Plan
The system SHALL 允许用户将当前方案另存为新方案。

#### Scenario: Save As Dialog
- **前提** 用户点击"另存为"按钮
- **那么** 系统 SHALL 显示 SmartSaveDialog
- **并且** 输入框 SHALL 预填当前方案名称（如果存在）加上 "副本" 后缀

### Requirement: Load Plan
The system SHALL 允许用户加载已保存的逻辑组网方案。

#### Scenario: Open Load Dialog
- **前提** 用户点击"加载"按钮
- **那么** 系统 SHALL 显示 LoadFlowPlanModal 对话框

#### Scenario: Load Plan with Dirty Check
- **前提** 当前方案有未保存的修改
- **当** 用户选择加载另一个方案
- **那么** 系统 SHALL 显示确认对话框

#### Scenario: Plan Reconstruction
- **前提** 用户加载一个方案
- **那么** 系统 SHALL 从保存的数据中恢复产线组
- **并且** 对于每个 manual 节点，系统 SHALL 通过 expandUpstream 重建 auto 节点
- **并且** isolated 节点 SHALL 保持隔离状态

### Requirement: Delete Plan
The system SHALL 允许用户删除已保存的逻辑组网方案。

#### Scenario: Delete Confirmation
- **前提** 用户在加载对话框中点击删除按钮
- **那么** 系统 SHALL 显示确认对话框
- **并且** 确认后 SHALL 从方案列表中移除该方案

### Requirement: Settings Persistence
The system SHALL 将设置作为方案的一部分持久化。

#### Scenario: Default Lock Setting Save
- **前提** 用户切换候选区的默认锁定状态
- **当** 用户保存方案
- **那么** 设置 SHALL 随方案一起保存到 `x4_logic_flow_plans`

#### Scenario: Default Lock Setting Load
- **前提** 用户加载一个方案
- **那么** 系统 SHALL 恢复该方案的 isDefaultLocked 设置
- **并且** 候选区锁定按钮状态 SHALL 正确反映该设置

### Requirement: Dirty State Detection
The system SHALL 检测当前方案是否有未保存的修改。

#### Scenario: Dirty State Computation
- **前提** 方案数据发生变化
- **那么** `isDirty` 计算属性 SHALL 比较当前状态与 `lastSavedSnapshot`
- **并且** 如果不一致，`isDirty` SHALL 为 true

#### Scenario: Clean State After Save
- **前提** 用户保存方案
- **那么** `lastSavedSnapshot` SHALL 更新为当前状态
- **并且** `isDirty` SHALL 变为 false
