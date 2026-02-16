# Volume Compression Specification

## Purpose

为生产模块计算和显示体积压缩率，帮助玩家识别哪些模块能有效压缩资源体积，优化空间站存储和运输效率。

---

## Requirements

### Requirement: Volume Compression Rate Calculation

The system SHALL calculate and store volume compression rate for each production module during initialization.

**计算公式**：
- `压缩率 = 产出体积 / 消耗体积`
- 产出体积 = `Σ(module.outputs[wareId] * waresMap[wareId].volume)`
- 消耗体积 = `Σ(module.inputs[wareId] * waresMap[wareId].volume)`，忽略 `energycells`

**存储位置**：`useGameDataStore.volumeCompressionMap: Record<string, number>`

#### Scenario: Calculate compression rate for module with inputs and outputs
- **前提** 模块有输入和输出
- **当** 系统初始化时
- **那么** 该模块的压缩率 SHALL 被计算并存储

#### Scenario: Skip modules without inputs
- **前提** 模块没有输入（如太阳能发电站）
- **当** 系统初始化时
- **那么** 该模块 SHALL NOT 被包含在 `volumeCompressionMap` 中

#### Scenario: Ignore energycells in consumption calculation
- **前提** 模块的输入包含 `energycells`
- **当** 计算消耗体积时
- **那么** `energycells` 的体积 SHALL 被忽略

---

### Requirement: Volume Compression Rate Display

The system SHALL display volume compression rate in FlowNode component for eligible nodes.

**显示条件**：
1. 节点有 `moduleId`（是模块节点）
2. 节点不是 isolated 状态
3. 节点不是 T0 资源（column !== 0）
4. 模块有输入（`volumeCompressionMap[moduleId]` 存在）

**显示格式**：百分比数字 + 体积图标 SVG

#### Scenario: Display compression rate for eligible module node
- **前提** 节点是模块节点，非 isolated，非 T0，且有输入
- **当** FlowNode 渲染时
- **那么** 压缩率 SHALL 显示在底部 Subtitle 区域

#### Scenario: Hide compression rate for isolated node
- **前提** 节点是 isolated 状态
- **当** FlowNode 渲染时
- **那么** 压缩率 SHALL NOT 显示

#### Scenario: Hide compression rate for T0 resource node
- **前提** 节点是 T0 资源（column === 0）
- **当** FlowNode 渲染时
- **那么** 压缩率 SHALL NOT 显示

---

### Requirement: Volume Compression Rate Color Coding

The system SHALL apply color coding to volume compression rate based on its value.

**颜色规则**：
- `≤100%`：绿色（体积压缩效果好）
- `>100%`：红色（体积膨胀）

#### Scenario: Green color for compression rate ≤ 100%
- **前提** 压缩率 ≤ 100%
- **当** 显示压缩率时
- **那么** 文本颜色 SHALL 为绿色

#### Scenario: Red color for compression rate > 100%
- **前提** 压缩率 > 100%
- **当** 显示压缩率时
- **那么** 文本颜色 SHALL 为红色
