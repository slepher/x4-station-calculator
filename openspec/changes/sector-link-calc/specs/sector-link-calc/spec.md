# Sector Link Calc Specification

## Purpose
定义基于子网范围的空间站缺口展示与星区中转站增量需求计算行为，确保本地与外星区贡献按统一口径结算。

## ADDED Requirements

### Requirement: Sector-Component Scoped Gap View
系统 MUST 将空间站缺口开关的计算域限定为“当前空间站所属星区的 SectorNetworkComponent 子网”。

#### Scenario: 子网范围替代全帝国范围
- **前提** 当前空间站已分配星区，且其星区属于某连通子网
- **当** 用户开启缺口开关
- **那么** 系统 SHALL 仅计算该子网内数据
- **并且** SHALL 不再使用全帝国空间站集合作为缺口范围

#### Scenario: 未分配空间站缺口开关无效
- **前提** 当前空间站 `sectorId=null`
- **当** 用户开启缺口开关
- **那么** 系统 SHALL 不输出子网缺口结果

### Requirement: Merged Per-Ware Gap Details
系统 MUST 按产物归并缺口明细，并将本星区空间站条目与其他星区条目合并展示。

#### Scenario: 本星区按空间站输出
- **前提** 当前空间站所属星区存在多个空间站
- **当** 生成某产物缺口明细
- **那么** 系统 SHALL 输出本星区每个空间站的产出/需求条目

#### Scenario: 其他星区按星区输出
- **前提** 子网内存在其他星区
- **当** 生成某产物缺口明细
- **那么** 系统 SHALL 输出其他星区按星区聚合后的产出/需求条目

#### Scenario: A/B 合并而非分块
- **前提** 某产物同时存在本星区站点贡献与其他星区贡献
- **当** 明细渲染
- **那么** 系统 SHALL 在同一产物明细列表中同时展示两类条目

### Requirement: Transit Hub One-Hop External Contribution
系统 MUST 在中转站存储/运输计算中叠加外星区一跳边贡献。

#### Scenario: 输出方向计入外部输出
- **前提** 存在边流 `from=本星区` 且 `to=连接星区`
- **当** 计算中转站需求
- **那么** 系统 SHALL 将该流量作为外部输出贡献计入

#### Scenario: 输入方向计入外部输入
- **前提** 存在边流 `from=连接星区` 且 `to=本星区`
- **当** 计算中转站需求
- **那么** 系统 SHALL 将该流量作为外部输入贡献计入

#### Scenario: 外星区名目展示
- **前提** 生成中转站存储/运输明细
- **当** 渲染外部贡献条目
- **那么** 系统 SHALL 使用外星区名称作为条目名目

### Requirement: Unified Calculation Formula
系统 MUST 对本地空间站贡献与外星区贡献采用同一套存储/运输公式。

#### Scenario: 存储需求固定 12h
- **前提** 某产物存在产出或需求贡献
- **当** 计算存储需求
- **那么** 系统 SHALL 使用固定 `12h` 作为缓冲小时
- **并且** SHALL 按 `max(productionStorageVolume, consumptionStorageVolume)` 计算总存储需求

#### Scenario: 运输需求统一口径
- **前提** 某产物存在净流速
- **当** 计算运输需求
- **那么** 系统 SHALL 使用 `abs(netRate) * unitVolume` 作为运输需求

### Requirement: Container-Only Scope
系统 MUST 仅处理 `container` 产物。

#### Scenario: 非 container 产物忽略
- **前提** 产物 `transportType` 为 `solid` 或 `liquid`
- **当** 进行本次变更相关计算
- **那么** 系统 SHALL 忽略该产物

### Requirement: Default Link Distance
系统 MUST 在未配置距离时使用默认距离 `1`。

#### Scenario: 连接距离默认值
- **前提** 星区连接仅有拓扑关系，无显式距离
- **当** 纯函数构建物流输入
- **那么** 系统 SHALL 使用 `distance=1`

### Requirement: Cached Solver Execution
系统 MUST 将中转纯函数计算放在数据层缓存，不随中转页 tab 切换重复执行。

#### Scenario: 页面切换不重复求解
- **前提** 星区数据未变化
- **当** 用户在中转页切换数量/经济/仓储/运输 tab
- **那么** 系统 SHALL 复用已缓存求解结果
- **并且** SHALL 不重复触发纯函数求解

#### Scenario: 数据变更触发重算
- **前提** 空间站产物净值发生变化
- **当** 数据层状态更新
- **那么** 系统 SHALL 重新计算对应中转求解结果

### Requirement: Empty-Sector Fallback Scope
系统 MUST 在“无本地站但连接到有站星区”场景下提供可计算产物范围。

#### Scenario: 无本地站回退到连接星区
- **前提** 当前查看星区无本地空间站
- **并且** 当前星区连接到至少一个有空间站的星区
- **当** 构建纯函数输入产物集合
- **那么** 系统 SHALL 使用连接且有站星区的产物并集作为回退范围

### Requirement: Edge-Flow Key Safety
系统 MUST 正确处理含分隔符的 `linkId`，不得污染 `from/to`。

#### Scenario: linkId 含 `|`
- **前提** 边标识包含字符 `|`
- **当** 系统编码/解码链路流量 key
- **那么** 系统 SHALL 保证 `linkId/from/to` 字段可逆且不串位

### Requirement: Transit Label Semantics
系统 MUST 在中转仓储/运输明细中区分外部条目与本地站点条目文案。

#### Scenario: 外部条目文案与颜色
- **前提** 明细条目来自外星区（`external:*`）
- **当** 渲染仓储或运输明细
- **那么** 系统 SHALL 显示 `输入/输出`
- **并且** `输入` 为绿色，`输出` 为红色

#### Scenario: 本地条目保持原语义
- **前提** 明细条目来自本星区空间站
- **当** 渲染仓储或运输明细
- **那么** 系统 SHALL 继续显示 `产出/消耗`

### Requirement: Group Header Visibility Coupling
系统 MUST 使仓储/运输分组标题与分组内容同显同隐。

#### Scenario: 空数据仅显示空态
- **前提** 仓储或运输无有效条目
- **当** 渲染对应视图
- **那么** 系统 SHALL 仅显示空态
- **并且** SHALL 不单独显示分组标题

### Requirement: Transit Tab Visibility and Horizontal Scroll
系统 MUST 提供更合理的中转 tab 可见性与横向可达性。

#### Scenario: 中转 tab 显示条件
- **前提** 某星区无本地站
- **当** 该星区连接到有空间站的星区
- **那么** 系统 SHALL 显示该星区中转 tab

#### Scenario: tab 超宽滚动按钮
- **前提** tab 总宽度超过可视区域
- **当** 渲染 tab 栏
- **那么** 系统 SHALL 显示左右滚动按钮
- **并且** 点击后 SHALL 平滑横向滚动 tab 栏
