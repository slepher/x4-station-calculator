## ADDED Requirements

### Requirement: Auto 节点“转正”操作
自动生成的虚线节点必须提供一个快速添加按钮，允许用户将其转换为手动管理节点。

#### Scenario: 点击添加按钮转正
- **WHEN** 用户点击虚线节点上的 ➕ 按钮
- **THEN** 该节点的状态应当从 `auto` 变更为 `manual`
- **AND** 连线应当从虚线变为实线

### Requirement: 术语重构 (Isolate/Connect)
原有的节点锁定/解锁（外部供应切换）功能必须更名为“隔离 (Isolate)”和“连接 (Connect)”。

#### Scenario: 隔离操作 UI 表现
- **WHEN** 节点处于连接状态（虚线/默认）
- **THEN** 点击操作按钮应当执行“隔离”动作
- **AND** 节点边框和连线应当变为实线，且不再受上游产线影响

### Requirement: 快速添加菜单状态感知
“添加到规划组”的弹出菜单中，每个组名后必须显示该组的当前状态（如 `Locked`, `Duplicated`）。

#### Scenario: 冲突组不可点击
- **WHEN** 渲染快速添加菜单
- **THEN** 状态为 `Locked`（产物不匹配）或 `Duplicated` 的组项应当显示为灰色
- **AND** 点击这些项不应当执行任何操作
