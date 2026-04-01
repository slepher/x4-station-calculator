# Ship Dlc Specification

## Purpose
定义舰船建造界面中舰船与装备的 DLC 标签展示、未激活 DLC 候选过滤、当前舰船失效后的页面收敛，以及未激活 DLC 装备在属性和 diff 计算中的排除语义。

## ADDED Requirements

### Requirement: Ship Candidate DLC Tag Display
系统 MUST 在舰船建造界面的舰船候选列表中显示舰船所属 DLC 标签。

#### Scenario: 舰船候选列表显示 DLC 标签
- **前提** 用户进入舰船选择界面，且舰船候选列表中存在任意舰船
- **并且** 某舰船的 `dlc_tag` 不为 `base`
- **当** 系统渲染舰船候选列表
- **那么** 系统 SHALL 在舰船名称右侧显示 DLC 标签
- **并且** 标签文本 SHALL 使用游戏 i18n 对 DLC `nameId` 的翻译结果

#### Scenario: base 舰船不显示 DLC 标签
- **前提** 某舰船的 `dlc_tag` 为 `base`
- **当** 系统渲染该舰船的 DLC 标签
- **那么** 系统 SHALL NOT 显示 DLC 标签

### Requirement: Equipment Candidate DLC Tag Display
系统 MUST 在舰船建造界面的装备候选列表中显示装备所属 DLC 标签。

#### Scenario: 装备候选列表显示 DLC 标签
- **前提** 用户打开装备 picker
- **并且** 某装备候选的 `dlc_tag` 不为 `base`
- **当** 系统渲染装备候选列表
- **那么** 系统 SHALL 在装备名称右侧显示 DLC 标签
- **并且** 标签文本 SHALL 使用游戏 i18n 对 DLC `nameId` 的翻译结果

#### Scenario: base 装备不显示 DLC 标签
- **前提** 某装备的 `dlc_tag` 为 `base`
- **当** 系统渲染该装备的 DLC 标签
- **那么** 系统 SHALL NOT 显示 DLC 标签

### Requirement: DLC Tag Visual Semantics
系统 MUST 用固定颜色语义表达舰船或装备所属 DLC 当前是否激活。

#### Scenario: 已激活 DLC 标签为绿色
- **前提** 某舰船或装备所属 DLC 处于激活状态
- **当** 系统渲染该 DLC 标签
- **那么** 系统 SHALL 使用绿色边框
- **并且** 系统 SHALL 使用绿色文字

#### Scenario: 未激活 DLC 标签为红色
- **前提** 某舰船或装备所属 DLC 未激活
- **当** 系统渲染该 DLC 标签
- **那么** 系统 SHALL 使用红色边框
- **并且** 系统 SHALL 使用红色文字

### Requirement: Ship Candidate Filtering For Inactive DLC Ships
系统 MUST 在启用 DLC 限制策略后，从舰船候选列表中移除未激活 DLC 舰船。

#### Scenario: 关闭策略时舰船候选仍显示未激活 DLC 舰船
- **前提** `enforceDlcActivation = false`
- **当** 用户查看舰船候选列表
- **那么** 系统 SHALL 继续显示未激活 DLC 舰船
- **并且** 系统 SHALL 仅通过标签颜色提示其激活状态

#### Scenario: 开启策略时舰船候选过滤未激活 DLC 舰船
- **前提** `enforceDlcActivation = true`
- **当** 用户查看舰船候选列表
- **那么** 系统 SHALL 不显示未激活 DLC 舰船

#### Scenario: 舰船候选过滤同步影响筛选计数与分页
- **前提** `enforceDlcActivation = true`
- **当** 系统基于候选舰船生成 race/type 计数或分页结果
- **那么** 系统 SHALL 基于过滤后的舰船集合计算这些结果

### Requirement: Equipment Candidate Filtering For Inactive DLC Equipment
系统 MUST 在启用 DLC 限制策略后，从装备候选列表中移除未激活 DLC 装备。

#### Scenario: 关闭策略时装备候选仍显示未激活 DLC 装备
- **前提** `enforceDlcActivation = false`
- **当** 用户打开装备 picker
- **那么** 系统 SHALL 继续显示未激活 DLC 装备
- **并且** 系统 SHALL 仅通过标签颜色提示其激活状态

#### Scenario: 开启策略时装备候选过滤未激活 DLC 装备
- **前提** `enforceDlcActivation = true`
- **当** 用户打开装备 picker
- **那么** 系统 SHALL 不显示未激活 DLC 装备

#### Scenario: 装备候选过滤同步影响 facet 与分页
- **前提** `enforceDlcActivation = true`
- **当** 系统基于装备候选生成 race / mk / tag facet 或分页结果
- **那么** 系统 SHALL 基于过滤后的装备集合计算这些结果

### Requirement: Built-In Blueprint Auto-Pick Always Excludes Inactive DLC Equipment
系统 MUST 在生成预设蓝图时，始终将未激活 DLC 装备排除在自动选装候选池之外。

#### Scenario: 关闭策略时手动 picker 仍可展示未激活 DLC 装备
- **前提** `enforceDlcActivation = false`
- **当** 用户打开装备 picker
- **那么** 系统 SHALL 继续显示未激活 DLC 装备

#### Scenario: 关闭策略时预设蓝图自动选装仍过滤未激活 DLC 装备
- **前提** `enforceDlcActivation = false`
- **并且** 某装备所属 DLC 未激活
- **当** 系统生成预设蓝图默认配装
- **那么** 系统 SHALL NOT 将该装备纳入自动选装候选池

#### Scenario: 开启策略时预设蓝图自动选装过滤未激活 DLC 装备
- **前提** `enforceDlcActivation = true`
- **并且** 某装备所属 DLC 未激活
- **当** 系统生成预设蓝图默认配装
- **那么** 系统 SHALL NOT 将该装备纳入自动选装候选池

### Requirement: Current Ship Must Fall Back When DLC Becomes Invalid
系统 MUST 在当前编辑舰船所属 DLC 未激活时，收敛回舰船选择界面。

#### Scenario: 当前舰船失效时返回 selector
- **前提** `enforceDlcActivation = true`
- **并且** 当前已选舰船所属 DLC 未激活
- **当** 系统刷新舰船建造页面状态
- **那么** 系统 SHALL 返回舰船选择界面
- **并且** 系统 SHALL 使该舰船不再作为当前可编辑目标

#### Scenario: 当前舰船失效时不强制清空蓝图存储
- **前提** `enforceDlcActivation = true`
- **并且** 当前已选舰船所属 DLC 未激活
- **当** 系统执行页面状态收敛
- **那么** 系统 SHALL NOT 因此强制删除对应蓝图数据

### Requirement: Inactive DLC Equipment Is Excluded From Ship Stats And Diff
系统 MUST 在启用 DLC 限制策略后，将蓝图中未激活 DLC 装备从舰船属性和 diff 计算链路中排除。

#### Scenario: 关闭策略时未激活 DLC 装备仍参与计算
- **前提** `enforceDlcActivation = false`
- **当** 系统计算舰船属性或装备 diff
- **那么** 系统 SHALL 继续将未激活 DLC 装备纳入计算输入

#### Scenario: 开启策略时未激活 DLC 装备不参与属性计算
- **前提** `enforceDlcActivation = true`
- **并且** 蓝图中某装备所属 DLC 未激活
- **当** 系统计算舰船属性结果
- **那么** 系统 SHALL NOT 将该装备纳入属性计算输入

#### Scenario: 开启策略时未激活 DLC 装备不参与 diff 计算
- **前提** `enforceDlcActivation = true`
- **并且** 蓝图中某装备所属 DLC 未激活
- **当** 系统计算装备 diff / comparison 结果
- **那么** 系统 SHALL NOT 将该装备纳入 diff / comparison 计算输入

#### Scenario: 开启策略时失效装备仍可保留在蓝图数据中
- **前提** `enforceDlcActivation = true`
- **并且** 蓝图中某装备所属 DLC 未激活
- **当** 系统刷新舰船建造页面状态
- **那么** 系统 SHALL 允许该装备配置继续保留在蓝图数据中
- **并且** 系统 SHALL 仅在候选过滤与计算链路中将其视为无效

### Requirement: Ship Build Page Consumes Centralized DLC State
系统 MUST 通过 `useGameDataStore` 统一消费 DLC 激活状态，而不是在舰船页面重复实现存储读取。

#### Scenario: 页面通过 store 判断舰船或装备 DLC 激活状态
- **前提** 舰船建造界面需要判断舰船或装备所属 DLC 是否激活
- **当** 页面读取 DLC 状态
- **那么** 系统 SHALL 通过 `useGameDataStore` 暴露的状态或 helper 完成判断

#### Scenario: 页面不直接读取 DLC setting 存储
- **前提** 舰船建造界面需要执行标签展示、候选过滤、当前舰船收敛或计算过滤
- **当** 页面获取 DLC 设置相关信息
- **那么** 系统 SHALL NOT 直接读取 `localStorage`
