# Map Station Specification

## Purpose
在地图工作台中加入带地图参考的 `SaveBinding` 工作流，并直接替换原地图上的 empire station 弹出放置界面，使用户可以按“两段式”流程完成 save 星区筛选、已有 station 绑定、导入新 station，以及空闲 empire station 的直接放置。

## ADDED Requirements

### Requirement: Save Binding Context in Map Workbench
系统 MUST 在地图工作台中提供 `SaveBindingPlan` 视角选择。

#### Scenario: 切换 save binding 视角
- **前提** 当前 empire 存在多个 `SaveBindingPlan`
- **当** 用户在地图工作台中切换当前 binding
- **那么** 系统 SHALL 切换到对应的 `gameGuid` 视角
- **并且** 地图候选、coverage 与失效提示 SHALL 一并刷新

#### Scenario: 切换 archive time
- **前提** 当前 `SaveBindingPlan` 对应的 `gameGuid` 存在多个 archive time
- **当** 用户切换当前 `selectedArchiveTime`
- **那么** 系统 SHALL 保持 binding 关系不变
- **并且** 系统 SHALL 仅刷新当前 time 下的候选与失效状态

### Requirement: Two-Stage Binding Flow
系统 MUST 在地图工作台中采用“两段式” binding 流程。

#### Scenario: 第一段显示 save 星区列表
- **前提** 用户已进入某个 `SaveBindingPlan` 视角
- **当** 绑定界面打开
- **那么** 系统 SHALL 列出“存档用户所在空间站所属的所有星区”

#### Scenario: 第二段显示 N 跳过滤结果
- **前提** 用户在第一段中选中了某个 save 星区
- **当** 用户进入第二段并设置跳数
- **那么** 系统 SHALL 展示该星区 `N` 跳以内的星区与空间站列表
- **并且** 地图 SHALL 自动缩放/平移到可显示全部过滤星区的最大范围

### Requirement: Filtered Sector Range Preview
系统 MUST 在地图上展示当前 save 星区的 `N` 跳过滤范围。

#### Scenario: 跳数变化刷新地图范围
- **前提** 用户已进入第二段
- **当** 用户修改跳数
- **那么** 系统 SHALL 重新计算过滤星区
- **并且** 地图 SHALL 更新为可容纳全部过滤星区的范围

### Requirement: Existing-Station Binding and Direct Import
系统 MUST 同时支持“绑定到已有 empire station”与“导入为新 station”两条路径。

#### Scenario: 绑定到已有 station
- **前提** 用户在 `bind-station` 模式中已选中某个已有 empire station
- **并且** 地图上选中了 coverage 内的 save 玩家空间站
- **当** 用户在 inspector 中确认绑定
- **那么** 系统 SHALL 为该已有 empire station 建立 `StationSaveBinding`

#### Scenario: 导入为新 station
- **前提** 用户在 `bind-station` 模式中选中了 coverage 内的 save 玩家空间站
- **当** 用户在 inspector 中点击“导入为新 station”
- **那么** 系统 SHALL 创建新的 empire station
- **并且** 系统 SHALL 为该新 station 建立 `StationSaveBinding`

### Requirement: Idle Empire Station Drag Placement
系统 MUST 支持将空闲 empire station 直接拖拽到地图上。

#### Scenario: 拖拽空闲 station 到地图
- **前提** 用户已进入第二段并选中了目标帝国星区
- **并且** 底部空闲 empire station 列表中存在未绑定 station
- **当** 用户将某个空闲 station 拖拽到地图
- **那么** 系统 SHALL 以小空间站尺寸显示该 station
- **并且** 系统 SHALL 将 `position: { x, y, z }` 写入 binding 数据
- **并且** 系统 SHALL NOT 将该位置写入 `EmpirePlan`

### Requirement: Binding Position Fallback
系统 MUST 为 binding 保存 station 位置，使绑定失效后坐标仍可单独生效。

#### Scenario: 绑定失效后仍保留坐标
- **前提** 某 station 已存在 binding 位置
- **并且** 当前 `selectedArchiveTime` 下找不到对应 save 站
- **当** 地图工作台渲染该 station
- **那么** 系统 SHALL 继续使用 binding 中的 `position`
- **并且** 同时显示“当前 time 下失效”的提示

### Requirement: Current-Time Invalidity Explanation
系统 MUST 在地图工作台中解释“当前 time 下失效”，而不是直接清空 UI 结果。

#### Scenario: 当前 time 下绑定失效
- **前提** 某 hub binding 或 station binding 在当前 `selectedArchiveTime` 下找不到对应 save 对象
- **当** 地图工作台渲染当前 binding 结果
- **那么** 系统 SHALL 显示“当前 time 下失效”的提示
- **并且** 系统 SHALL 保留原 binding 关系与相关上下文入口
