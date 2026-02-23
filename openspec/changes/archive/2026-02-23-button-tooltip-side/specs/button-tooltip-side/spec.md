# Button Tooltip Side Specification

## Purpose

为 StationWareFlow 界面中的收藏按钮与锁定按钮设置明确的 tooltip 弹出方向，避免与相邻 UI 重叠，提升悬停提示的可读性与稳定性。

## ADDED Requirements

### Requirement: Favorite Tooltip Placement

当用户悬停在收藏按钮（FavoriteButton）上时，tooltip **MUST** 向左侧弹出。

#### Scenario: Hover Favorite Button

**前提**：StationWareFlow 页面已渲染收藏按钮。
**当**：用户将鼠标悬停在收藏按钮上。
**那么**：tooltip 向左侧弹出。
**并且**：tooltip 内容与样式保持不变。

### Requirement: Lock Tooltip Placement

当用户悬停在锁定按钮（LockButton）上时，tooltip **MUST** 向右侧弹出。

#### Scenario: Hover Lock Button

**前提**：StationWareFlow 页面已渲染锁定按钮。
**当**：用户将鼠标悬停在锁定按钮上。
**那么**：tooltip 向右侧弹出。
**并且**：tooltip 内容与样式保持不变。

### Requirement: No Behavior Regression

变更 tooltip 弹出方向时，按钮点击与禁用行为 **MUST** 保持原有一致。

#### Scenario: Button Interaction Unchanged

**前提**：收藏/锁定按钮具备可点击与禁用态。
**当**：用户执行点击、切换状态或触发禁用态操作。
**那么**：行为与变更前保持一致。
