## ADDED Requirements

### Requirement: 统一资源仪表盘组件
系统必须将 `ResourceList` 和 `StationProfit` 组件合并为统一的 `StationResourceDashboard` 组件，支持三种分析视图模式切换。

#### Scenario: 组件合并
- **WHEN** 系统加载产线性能分析页面
- **THEN** 中间栏显示统一的 `StationResourceDashboard` 组件
- **AND** 右侧不再显示独立的 `StationProfit` 组件

#### Scenario: 视图模式切换
- **WHEN** 用户点击分段控制器中的"数量"选项
- **THEN** 仪表盘显示物品的单位产出数据（/h）

#### Scenario: 经济分析集成
- **WHEN** 用户切换到"经济"视图
- **THEN** 仪表盘显示基于价格设置的经济分析数据

#### Scenario: 视图切换流畅性
- **WHEN** 用户在不同视图模式间切换
- **THEN** 中间栏内容平滑过渡，避免组件卸载和重建

### Requirement: 体积分析功能
系统必须在统一仪表盘中新增体积分析维度，计算物品的体积吞吐量。

#### Scenario: 体积计算
- **WHEN** 系统接收到产线性能数据
- **THEN** 计算每种物品的 deltaVolume = netOutput * volume

#### Scenario: 体积视图显示
- **WHEN** 用户切换到"体积"视图
- **THEN** 仪表盘显示每个物品的体积吞吐量（m³/h）和净变化量

#### Scenario: 类型分组显示
- **WHEN** 在体积视图下
- **THEN** 按运输类型（固体/液体/集装箱）进行分组显示

### Requirement: 压缩比计算
系统必须计算产线的体积压缩比，显示输入总体积与输出总体积的比例。

#### Scenario: 压缩比显示
- **WHEN** 在体积视图下
- **THEN** 显示产线的总体积压缩比