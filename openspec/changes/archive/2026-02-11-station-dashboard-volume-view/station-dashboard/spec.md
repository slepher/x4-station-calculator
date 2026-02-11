# Station Dashboard Specification

## Purpose
描述空间站建设仪表盘（StationDashboard）的交互逻辑与功能需求，旨在提供一个与资源流仪表盘风格一致的建设信息展示界面。

## ADDED Requirements

### Requirement: 统计栏布局重设计
统计栏（Stats Bar）SHALL 采用 2行 x 3列 的网格布局，以展示更多的统计维度。
- **行 1**: 总造价 (Red), 总体积 (Blue), 工人需求 (Green).
- **行 2**: 总时间 (Red), 运输船次 (Blue), 工人效率 (Efficiency).

#### Scenario: 查看统计栏
- **前提** 用户已添加至少一个建设模块
- **当** 用户查看仪表盘顶部时
- **那么** 应看到 2x3 的统计网格
- **并且** "总体积" 显示为蓝色，单位为 m³
- **并且** "工人需求" 显示为绿色

### Requirement: 空间视图模式
系统 SHALL 提供 "空间视图" (Volume View) 模式，用于展示模块的体积占用情况。
- 在此模式下，列表和摘要区域的数值 SHALL 显示体积 (m³)。
- 所有体积相关的数值 SHALL 使用蓝色文本 (`text-blue-400`)。

#### Scenario: 切换到空间视图
- **前提** 当前处于 "成本视图"
- **当** 用户点击视图切换器中的 "空间视图"
- **那么** 列表中的数值应变为体积 (m³)
- **并且** 摘要标题应变为 "建设总体积" (Total Build Volume)

### Requirement: 运输船运量控制
在空间视图模式下，底部 SHALL 显示 "运输船运量" (Transport Capacity) 滑块。
- **范围**: 5,000 - 62,000 m³
- **默认值**: 62,000 m³
- **步长**: 1,000 m³

#### Scenario: 调整运输船运量
- **前提** 当前处于 "空间视图"
- **当** 用户拖动运输船运量滑块时
- **那么** 统计栏中的 "运输船次" (Transport Trips) 应实时更新
- **计算公式**: `ceil(总体积 / 运量)`

## RENAMED Requirements

- FROM: ### Requirement: 视图模式切换
- TO:   ### Requirement: 视图模式切换 (更新)

## MODIFIED Requirements

### Requirement: 视图模式切换 (更新)
系统 SHALL 提供一个视图模式切换器，允许用户在不同的统计维度间切换。
- **成本视图**: (原 "材料视图") 显示建设所需的物料清单与费用。
- **空间视图**: (新增) 显示建设所需的体积与运输需求。
- **时间视图**: 预留入口，当前状态为禁用。
- **工人视图**: 预留入口，当前状态为禁用。
