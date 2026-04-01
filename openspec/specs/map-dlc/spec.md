# Map Dlc Specification

## Purpose
定义地图界面中星系、星区、星门与空间站的 DLC 过滤语义，包括地图渲染过滤、资源统计排除、空间站地址视觉提示等行为。

## ADDED Requirements

### Requirement: Map Cluster Rendering Filter
系统 MUST 在启用 DLC 限制策略后，从地图渲染中移除未激活 DLC 的星系。

#### Scenario: 关闭策略时地图显示全部星系
- **前提** `enforceDlcActivation = false`
- **当** 用户查看地图
- **那么** 系统 SHALL 显示所有星系（clusters）
- **并且** 系统 SHALL 显示所有星区（sectors）

#### Scenario: 开启策略时地图过滤未激活 DLC 星系
- **前提** `enforceDlcActivation = true`
- **并且** 某星系（cluster）的 `dlc_tag` 对应 DLC 未激活
- **当** 系统渲染地图 SVG
- **那么** 系统 SHALL NOT 渲染该星系
- **并且** 系统 SHALL NOT 渲染该星系下的任何星区

#### Scenario: 开启策略时仅显示激活 DLC 的星区
- **前提** `enforceDlcActivation = true`
- **当** `sectorsById` 计算属性计算可用星区
- **那么** 系统 SHALL 仅包含激活 DLC 星系下的星区

### Requirement: Resource Search Excludes Inactive DLC Sectors
系统 MUST 在启用 DLC 限制策略后，将未激活 DLC 的星区从资源搜索与统计中排除。

#### Scenario: 关闭策略时资源统计包含全部星区
- **前提** `enforceDlcActivation = false`
- **当** 用户在资源筛选面板查看统计
- **那么** 系统 SHALL 统计所有星区的资源

#### Scenario: 开启策略时资源统计过滤未激活 DLC 星区
- **前提** `enforceDlcActivation = true`
- **当** 用户在资源筛选面板查看统计
- **那么** 系统 SHALL 仅统计激活 DLC 星区的资源
- **并且** 系统 SHALL NOT 将未激活 DLC 星区计入搜索结果

### Requirement: Gates Remain Visible
系统 MUST 保持星门显示，即使其连接的目标星系因 DLC 未激活被过滤。

#### Scenario: 星门连接未激活 DLC 星系时仍显示
- **前提** `enforceDlcActivation = true`
- **并且** 某星门连接的目标星系属于未激活 DLC
- **当** 系统渲染星门
- **那么** 系统 SHALL 继续显示该星门
- **并且** 系统 SHALL NOT 因目标星系被过滤而隐藏星门

### Requirement: Station Address Red Indicator
系统 MUST 在空间站面板中，为位于未激活 DLC 星区的空间站地址显示红色视觉提示。

#### Scenario: 未激活 DLC 星区的空间站地址标红
- **前提** `enforceDlcActivation = true`
- **并且** 某空间站位于未激活 DLC 的星区
- **当** 系统渲染空间站面板中的地址/位置
- **那么** 系统 SHALL 使用红色文字显示该地址

#### Scenario: 激活 DLC 星区的空间站地址正常显示
- **前提** `enforceDlcActivation = true`
- **并且** 某空间站位于激活 DLC 的星区
- **当** 系统渲染空间站面板中的地址/位置
- **那么** 系统 SHALL 使用默认颜色显示该地址

#### Scenario: 关闭策略时所有地址正常显示
- **前提** `enforceDlcActivation = false`
- **当** 系统渲染空间站面板中的地址
- **那么** 系统 SHALL 对所有地址使用默认颜色

### Requirement: Map Consumes Centralized DLC State
系统 MUST 通过 `useGameDataStore` 统一消费 DLC 激活状态，而不是在地图组件中重复实现存储读取。

#### Scenario: 地图通过 store 判断 DLC 激活状态
- **前提** 地图界面需要判断星系或资源所属 DLC 是否激活
- **当** 组件读取 DLC 状态
- **那么** 系统 SHALL 通过 `useGameDataStore.isDlcActive()` 完成判断
- **并且** 系统 SHALL 通过 `useGameDataStore.filterActiveDlcItems()` 进行过滤

#### Scenario: 地图组件不直接读取 DLC setting 存储
- **前提** 地图界面需要执行渲染过滤或统计排除
- **当** 组件获取 DLC 设置相关信息
- **那么** 系统 SHALL NOT 直接读取 `localStorage`
