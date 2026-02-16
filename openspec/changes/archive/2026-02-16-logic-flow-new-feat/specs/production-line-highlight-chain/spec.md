# Production Line Highlight Chain Specification

## Purpose
描述产线组上下游高亮链路追踪功能的交互逻辑与视觉需求，确保用户悬停节点时能够直观看到完整的依赖链路。

## Requirements

### Requirement: 上下游链路追踪 (Upstream/Downstream Chain Tracing)
系统 SHALL 在用户悬停节点时，自动追踪并高亮其上下游依赖链路。

#### Scenario: 上游追踪至 T0
- **前提**: 用户悬停一个 Tier 3 的产物节点
- **当** 系统计算上游依赖
- **那么** 系统 SHALL 递归追踪所有输入依赖
- **并且** 追踪 SHALL 持续直到 Tier 0 资源节点
- **并且** 能量电池 SHALL 被排除在追踪链路之外

#### Scenario: 下游追踪至 T3
- **前提**: 用户悬停一个 Tier 0 的资源节点
- **当** 系统计算下游消费者
- **那么** 系统 SHALL 找到所有消费该资源的节点
- **并且** 追踪 SHALL 持续直到 Tier 3 终端产物节点
- **并且** 能量电池 SHALL 被排除在追踪链路之外

#### Scenario: 中间层级双向追踪
- **前提**: 用户悬停一个 Tier 2 的中间产物节点
- **当** 系统计算依赖链路
- **那么** 系统 SHALL 同时追踪上游（至 T0）和下游（至 T3）
- **并且** 两个方向的追踪 SHALL 合并为一个高亮集合

### Requirement: 高亮容器样式 (Container Highlight Style)
系统 SHALL 对相关产线组容器应用高亮样式。

#### Scenario: 产线组容器高亮
- **前提**: 产线组包含被追踪到的节点
- **当** 用户悬停触发高亮
- **那么** 该产线组容器 SHALL 显示边框发光效果
- **并且** 背景色 SHALL 轻微变化以增强视觉反馈

#### Scenario: 非相关产线组淡化
- **前提**: 用户悬停某节点触发高亮
- **当** 存在不包含追踪节点的产线组
- **那么** 非相关产线组 SHALL 保持正常显示（不淡化）

### Requirement: 高亮连线样式 (Connection Highlight Style)
系统 SHALL 对相关 SVG 连线应用高亮样式。

#### Scenario: 连线高亮
- **前提**: SVG 连线连接两个被追踪到的节点
- **当** 用户悬停触发高亮
- **那么** 该连线 SHALL 提高透明度和颜色亮度
- **并且** 连线宽度 SHALL 适当增加

#### Scenario: 能量电池连线不参与高亮
- **前提**: 连线指向或来自能量电池节点
- **当** 用户悬停触发高亮
- **那么** 该连线 SHALL 不被高亮
- **并且** 保持默认的隐藏或淡化状态

### Requirement: 高亮状态管理 (Highlight State Management)
系统 SHALL 通过 Store 集中管理高亮状态。

#### Scenario: 悬停状态同步
- **前提**: 用户悬停某节点
- **当** 悬停事件触发
- **那么** `hoveredNodeId` SHALL 被设置
- **并且** `highlightedNodeIds` 和 `highlightedConnectionIds` SHALL 自动计算更新

#### Scenario: 离开节点清除高亮
- **前提**: 用户正在悬停某节点
- **当** 鼠标离开节点
- **那么** `hoveredNodeId` SHALL 被清除
- **并且** 所有高亮样式 SHALL 被移除

### Requirement: 跨组高亮 (Cross-Group Highlight)
系统 SHALL 支持跨产线组的高亮链路追踪。

#### Scenario: 跨组依赖高亮
- **前提**: 产线组 A 的产物是产线组 B 的输入
- **当** 用户悬停产线组 B 中的消费节点
- **那么** 产线组 A 中对应的供应节点 SHALL 被高亮
- **并且** 两个产线组容器 SHALL 同时显示高亮样式
