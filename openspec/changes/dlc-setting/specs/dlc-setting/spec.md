# Dlc Setting Specification

## Purpose
定义右上角 DLC setting 入口、版本分流存储规则、激活 DLC 选择行为，以及 `useGameDataStore` 中的激活 DLC 状态输出。

## ADDED Requirements

### Requirement: Settings Entry For DLC Activation
系统 MUST 在右上角提供独立的 setting 入口，用于管理当前游戏版本下的 DLC 激活状态。

#### Scenario: 右上角显示 setting 按钮
- **前提** 用户进入应用主界面
- **当** 系统渲染右上角工具区
- **那么** 系统 SHALL 显示独立的 setting 按钮
- **并且** 该按钮 SHALL 复用既有 setting SVG 按钮风格

#### Scenario: 点击按钮打开 setting modal
- **前提** setting 按钮可见
- **当** 用户点击 setting 按钮
- **那么** 系统 SHALL 打开独立的 setting modal

### Requirement: DLC Setup Indicator
系统 MUST 在当前版本尚未显式保存 `activeDlcs` 时显示 setting 红点提示。

#### Scenario: 缺少 `activeDlcs` 字段时显示红点
- **前提** 当前版本对应的 setting storage 中不存在 `activeDlcs` 字段
- **当** 系统渲染 setting 按钮
- **那么** 系统 SHALL 显示红点提示

#### Scenario: `activeDlcs` 字段存在时不显示红点
- **前提** 当前版本对应的 setting storage 中存在 `activeDlcs` 字段
- **当** 系统渲染 setting 按钮
- **那么** 系统 SHALL NOT 显示红点提示

### Requirement: Version-Aware Setting Storage
系统 MUST 使用与现有版本隔离行为一致的统一 storage key 规则保存 DLC setting。

#### Scenario: setting 复用统一 storage key 生成规则
- **前提** 系统需要读取或写入 DLC setting
- **当** 系统解析当前版本对应的 storage key
- **那么** 系统 SHALL 复用现有统一的版本分流 key 生成规则
- **并且** 系统 SHALL NOT 为 `x4-setting` 单独定义独立的 key 拼接规则

#### Scenario: 默认版本使用基础 key
- **前提** 当前游戏版本命中统一规则中的默认版本
- **当** 系统生成 setting storage key
- **那么** 系统 SHALL 使用基础 key

#### Scenario: `versions.json` 显式包含 setting storage key
- **前提** 系统维护版本配置
- **当** 系统声明各版本对应的 storage key
- **那么** 系统 SHALL 在 `versions.json` 中为 `setting` 显式提供 storage key

### Requirement: Version-Filtered DLC Candidates
系统 MUST 只向用户展示当前游戏版本可用的 DLC 候选项。

#### Scenario: 候选 DLC 按 dependencyVersion 过滤
- **前提** 当前游戏版本为某一具体版本
- **当** 系统构建 setting modal 的 DLC 候选列表
- **那么** 系统 SHALL 只包含 `dependencyVersion <= current game version` 的 DLC

#### Scenario: `base` 不进入候选列表
- **前提** 系统构建 DLC 候选列表
- **当** 用户打开 setting modal
- **那么** 系统 SHALL NOT 将 `base` 作为可选项显示

### Requirement: Default Active DLC Fallback
系统 MUST 在未显式保存 `activeDlcs` 时提供默认全激活 fallback。

#### Scenario: 未设置时默认激活全部可用 DLC
- **前提** 当前版本对应 setting 中不存在 `activeDlcs` 字段
- **当** 业务逻辑读取当前版本激活 DLC 列表
- **那么** 系统 SHALL 返回当前版本全部可用 DLC 作为激活列表

#### Scenario: 默认 fallback 不要求自动回写
- **前提** 当前版本对应 setting 中不存在 `activeDlcs` 字段
- **当** 系统以默认全激活方式运行
- **那么** 系统 SHALL NOT 强制自动写回 `activeDlcs`

### Requirement: DLC Selection Modal Behavior
系统 MUST 提供基于 checkbox 的 DLC 选择界面，并支持全选/全不选。

#### Scenario: modal 使用 checkbox 列表
- **前提** 用户打开 setting modal
- **当** 系统渲染 DLC 选择区域
- **那么** 系统 SHALL 使用 checkbox 列表展示候选 DLC
- **并且** 系统 SHALL 使用游戏数据 i18n 显示 DLC 名称

#### Scenario: modal 支持全选与全不选
- **前提** 用户打开 setting modal
- **当** 系统渲染 DLC 选择区域
- **那么** 系统 SHALL 提供全选操作
- **并且** 系统 SHALL 提供全不选操作

#### Scenario: modal 关闭不强制保存
- **前提** 用户已打开 setting modal
- **当** 用户点击遮罩或关闭按钮
- **那么** 系统 SHALL 关闭 modal
- **并且** 系统 SHALL NOT 强制保存未提交的选择

#### Scenario: modal 提供未激活 DLC 物品处理策略开关
- **前提** 用户打开 setting modal
- **当** 系统渲染 setting 内容
- **那么** 系统 SHALL 提供单个布尔开关用于控制未激活 DLC 物品处理策略
- **并且** 该开关默认 SHALL 为关闭
- **并且** 系统 SHALL 在该开关下显示一行简短说明文字

### Requirement: Inactive DLC Handling Strategy Setting
系统 MUST 通过单个布尔字段控制未激活 DLC 物品的后续处理策略。

#### Scenario: setting 中保存布尔字段
- **前提** 系统保存 DLC setting
- **当** 系统写入当前版本 setting storage
- **那么** 系统 SHALL 保存 `enforceDlcActivation: boolean`

#### Scenario: 关闭策略时不强制隐藏或禁算
- **前提** `enforceDlcActivation = false`
- **当** 后续页面消费 DLC setting
- **那么** 系统 SHALL 不要求对未激活 DLC 物品施加隐藏、置灰或禁算行为

#### Scenario: 开启策略时提供统一行为语义
- **前提** `enforceDlcActivation = true`
- **当** 后续页面消费 DLC setting
- **那么** 系统 SHALL 将“搜索列表隐藏未激活 DLC 物品”作为统一语义
- **并且** 系统 SHALL 将“已保存项置灰”作为统一语义
- **并且** 系统 SHALL 将“已保存项不参与计算”作为统一语义

#### Scenario: 页面级消费不要求在本次 change 一次性落地
- **前提** `enforceDlcActivation` 已接入 store
- **当** 系统完成本次 change
- **那么** 系统 SHALL NOT 被要求在所有页面中一次性实现完整消费逻辑
- **并且** 系统 SHALL 提供后续页面接入所需的统一状态与基础 helper

### Requirement: Store-Exposed DLC Activation State
系统 MUST 将当前版本下的 DLC 激活状态纳入 `useGameDataStore`，供后续业务消费。

#### Scenario: store 暴露当前版本可用 DLC 列表
- **前提** `useGameDataStore` 已完成当前版本数据加载
- **当** 业务读取 DLC 元数据
- **那么** 系统 SHALL 提供当前版本可用 DLC 列表

#### Scenario: store 暴露当前版本激活 DLC 列表
- **前提** `useGameDataStore` 已完成 setting 解析
- **当** 业务读取激活 DLC 状态
- **那么** 系统 SHALL 提供当前版本激活 DLC 列表

#### Scenario: store 暴露缺少 DLC 设置状态
- **前提** 当前版本对应 setting 中不存在 `activeDlcs`
- **当** 业务读取 setting 状态
- **那么** 系统 SHALL 提供“当前版本缺少 DLC 设置”的状态标识

#### Scenario: store 暴露未激活 DLC 处理策略状态与基础 helper
- **前提** `useGameDataStore` 已完成 setting 解析
- **当** 后续页面读取 DLC setting 相关状态
- **那么** 系统 SHALL 提供 `enforceDlcActivation` 或等价状态
- **并且** 系统 SHALL 提供基于 `dlc_tag` 的基础判断或过滤 helper
