# Station Dlc Tag Specification

## Purpose
定义空间站规划界面中模块 DLC 标签展示、未激活 DLC 模块的搜索过滤行为，以及开启限制策略后的模块禁用态与计算过滤语义。

## ADDED Requirements

### Requirement: Station Module DLC Tag Display
系统 MUST 在空间站规划界面的模块展示区域中显示模块所属 DLC 标签。

#### Scenario: 已添加模块列表显示 DLC 标签
- **前提** 用户进入空间站规划界面，且模块列表中存在任意模块
- **并且** 某模块的 `dlc_tag` 不为 `base`
- **当** 系统渲染已添加模块列表
- **那么** 系统 SHALL 在每个模块名称右侧显示 DLC 标签
- **并且** 标签文本 SHALL 使用游戏 i18n 对 DLC `nameId` 的翻译结果

#### Scenario: 搜索结果显示 DLC 标签
- **前提** 用户打开模块搜索结果弹层
- **并且** 某候选模块的 `dlc_tag` 不为 `base`
- **当** 系统渲染候选模块
- **那么** 系统 SHALL 在每个候选模块名称右侧显示 DLC 标签
- **并且** 标签文本 SHALL 使用游戏 i18n 对 DLC `nameId` 的翻译结果

#### Scenario: base 模块不显示 DLC 标签
- **前提** 某模块的 `dlc_tag` 为 `base`
- **当** 系统渲染该模块的 DLC 标签
- **那么** 系统 SHALL NOT 显示 DLC 标签

### Requirement: DLC Tag Visual Semantics
系统 MUST 用固定颜色语义表达模块所属 DLC 当前是否激活。

#### Scenario: 已激活 DLC 标签为绿色
- **前提** 某模块所属 DLC 处于激活状态
- **当** 系统渲染该模块的 DLC 标签
- **那么** 系统 SHALL 使用绿色边框
- **并且** 系统 SHALL 使用绿色文字

#### Scenario: 未激活 DLC 标签为红色
- **前提** 某模块所属 DLC 未激活
- **当** 系统渲染该模块的 DLC 标签
- **那么** 系统 SHALL 使用红色边框
- **并且** 系统 SHALL 使用红色文字

### Requirement: Search Result Filtering For Inactive DLC Modules
系统 MUST 在启用 DLC 限制策略后，从空间站模块搜索结果中移除未激活 DLC 模块。

#### Scenario: 关闭策略时搜索结果仍显示未激活模块
- **前提** `enforceDlcActivation = false`
- **当** 用户搜索空间站模块
- **那么** 系统 SHALL 继续显示未激活 DLC 模块搜索结果
- **并且** 系统 SHALL 仅通过标签颜色提示其激活状态

#### Scenario: 开启策略时搜索结果过滤未激活模块
- **前提** `enforceDlcActivation = true`
- **当** 用户搜索空间站模块
- **那么** 系统 SHALL 不显示未激活 DLC 模块搜索结果

#### Scenario: DLC 过滤后空分组不显示
- **前提** `enforceDlcActivation = true`
- **并且** 某个搜索分组中的模块在 DLC 过滤后为空
- **当** 系统渲染搜索结果分组
- **那么** 系统 SHALL NOT 显示该分组

### Requirement: Existing Inactive Modules Stay Visible But Restricted
系统 MUST 在已添加模块列表中保留未激活 DLC 模块可见，同时限制其编辑能力。

#### Scenario: 未激活模块继续显示
- **前提** 某已添加模块所属 DLC 未激活
- **当** 系统渲染已添加模块列表
- **那么** 系统 SHALL 继续显示该模块项

#### Scenario: 未激活模块置暗并禁用数量编辑
- **前提** `enforceDlcActivation = true`
- **并且** 某已添加模块所属 DLC 未激活
- **当** 系统渲染该模块项
- **那么** 系统 SHALL 将该模块项置暗
- **并且** 系统 SHALL 禁用数量修改

#### Scenario: 未激活模块仍允许删除
- **前提** `enforceDlcActivation = true`
- **并且** 某已添加模块所属 DLC 未激活
- **当** 用户查看该模块项操作区
- **那么** 系统 SHALL 保留删除操作可用

### Requirement: Inactive DLC Modules Are Excluded From Station Calculations
系统 MUST 在启用 DLC 限制策略后，将未激活 DLC 模块从空间站计算链路中排除。

#### Scenario: 关闭策略时未激活模块仍参与计算
- **前提** `enforceDlcActivation = false`
- **当** 系统执行空间站分析计算
- **那么** 系统 SHALL 继续将未激活 DLC 模块纳入计算输入

#### Scenario: 开启策略时未激活模块不参与计算
- **前提** `enforceDlcActivation = true`
- **并且** 某模块所属 DLC 未激活
- **当** 系统执行空间站分析计算
- **那么** 系统 SHALL NOT 将该模块纳入计算输入

#### Scenario: 计算过滤覆盖全部模块分析结果
- **前提** `enforceDlcActivation = true`
- **当** 系统基于模块列表生成空间站分析结果
- **那么** 系统 SHALL 对未激活 DLC 模块统一执行过滤
- **并且** 该过滤 SHALL 同时影响产出、消耗、建造成本、工人、仓储/体积与 ware flow 等模块分析结果

#### Scenario: DLC 设置变化后自动工业区重新计算
- **前提** 用户修改了 `activeDlcs` 或 `enforceDlcActivation`
- **当** 系统刷新空间站分析状态
- **那么** 系统 SHALL 重新计算自动工业区
- **并且** 系统 SHALL 使自动工业区结果与当前 DLC 激活状态保持一致

### Requirement: Station Page Consumes Centralized DLC State
系统 MUST 通过 `useGameDataStore` 统一消费 DLC 激活状态，而不是在页面层重复实现存储读取。

#### Scenario: 页面通过 store 判断 DLC 激活状态
- **前提** 空间站界面需要判断模块所属 DLC 是否激活
- **当** 页面读取 DLC 状态
- **那么** 系统 SHALL 通过 `useGameDataStore` 暴露的状态或 helper 完成判断

#### Scenario: 页面不直接读取 DLC setting 存储
- **前提** 空间站界面需要执行标签展示、搜索过滤或计算过滤
- **当** 页面获取 DLC 设置相关信息
- **那么** 系统 SHALL NOT 直接读取 `localStorage`
