# dlc-setting 需求说明

## 目标
为应用右上角新增一个独立的 setting 入口，用于管理“当前游戏版本下激活的 DLC 列表”。
本次 change 需要把 DLC 激活状态接入 `useGameDataStore`，供后续数据过滤与业务逻辑消费。

## 已确认方案（审核重点）

### 1. 入口与交互
- 在右上角新增一个 setting 按钮。
- 按钮复用现有 [SettingsButton.vue] 风格与 SVG 图标表现。
- 点击按钮后弹出独立的 setting modal。
- modal 关闭行为与现有版本弹窗保持常见一致：
  - 点击遮罩可关闭
  - 点击关闭按钮可关闭
  - 关闭时不强制保存

### 2. setting 存储与版本分流
- setting 使用 `localStorage` 的 `x4-setting` 项。
- 版本分流行为必须与现有版本区分逻辑保持一致。
- `versions.json` 需要像其他模块一样显式为 `setting` 提供 storage key。
- 代码侧必须复用现有统一的 storage key 生成函数或同级统一入口，不能单独发明一套 key 拼接规则。
- `setting` 应纳入与其他版本隔离数据相同的 key 生成体系，并与 `versions.json` 中显式给出的 `setting` key 对齐。
- 其中 `8.0` 作为默认版本时，应自然落到基础 key，不额外人为定义一套特殊规则。

### 3. 当前 setting 结构
- 当前 setting 包含两个业务字段：
  - `activeDlcs: string[]`
  - `enforceDlcActivation: boolean`
- `enforceDlcActivation` 是单个布尔开关，默认不激活。
- 当该字段为 `true` 时，表示启用“未激活 DLC 物品处理策略”。

### 4. 红点提示语义
- 如果当前版本对应 setting 中不存在 `activeDlcs` 字段，则 setting 按钮显示一个小红点。
- 红点只表示“当前版本未显式完成 DLC 设置”。
- `activeDlcs` 为空数组不视为未设置，只要字段存在就不显示红点。

### 5. 默认值与候选 DLC 范围
- 如果当前版本 setting 中不存在 `activeDlcs` 字段，则运行时默认激活“当前版本可用的全部 DLC”。
- 默认值只作为运行时 fallback，不要求自动回写 localStorage。
- DLC 候选来源于当前版本的 `dlcs.json`。
- 候选列表不包含 `base`。
- 候选列表必须根据当前 `gameVersion` 过滤，只显示 `dependencyVersion <= current game version` 的 DLC。
- 例如未来若出现 `dependencyVersion = 9.0` 的 DLC，则在 `8.0` 下不显示。

### 6. modal 内部交互
- modal 提供两类设置项：
  - DLC 选择
  - “未激活 DLC 物品处理策略”开关
- 选择控件使用 checkbox 列表。
- 列表上方提供“全选 / 全不选”快捷操作。
- DLC 名称基于游戏数据中的 `nameId` 通过 i18n 显示，而不是直接显示原始英文名。
- `enforceDlcActivation` 使用单个布尔开关，默认关闭。
- `enforceDlcActivation` 选项下显示一行简短说明文字，用于向用户解释开启后的实际效果。

### 7. 未激活 DLC 物品处理策略
- `enforceDlcActivation = false` 时，不对未激活 DLC 物品施加额外隐藏/禁算行为。
- `enforceDlcActivation = true` 时，后续页面应按统一语义消费该状态：
  - 搜索列表中不出现未激活 DLC 物品
  - 已保存数据在 UI 上置灰
  - 已保存数据不参与计算
- 上述逐页行为不要求在本次 change 中一次性全部实现，但 `useGameDataStore` 需要提供统一状态与基础 helper，供后续页面接入。

### 8. store 接入
- `useGameDataStore` 需要持有当前版本下的 DLC 激活状态。
- `useGameDataStore` 至少需要提供：
  - 全量 DLC 元数据
  - 当前版本可用 DLC 列表
  - 当前版本激活 DLC 列表
  - 当前版本是否缺少 DLC 设置的状态
- `useGameDataStore` 还需要提供与 `enforceDlcActivation` 相关的基础能力，例如：
  - 当前是否启用未激活 DLC 物品处理策略
  - 基于 `dlc_tag` 判断实体是否处于激活状态
  - 基础过滤 helper，供后续页面复用
- 后续其他模块只消费 `useGameDataStore` 暴露的状态，不直接读取 `localStorage`。

## 边界

### In Scope
- 新增右上角 setting 按钮。
- 新增 setting modal。
- 新增 DLC 多选与全选/全不选交互。
- 新增 `enforceDlcActivation` 开关。
- 将 `x4-setting` 接入统一的版本隔离 storage key 规则。
- 将当前版本下的 `activeDlcs` 接入 `useGameDataStore`。
- 将 `enforceDlcActivation` 接入 `useGameDataStore`。
- 在未设置时显示红点，并提供默认全激活 fallback。
- 提供后续页面可复用的基础 DLC 激活判断/helper。

### Out of Scope
- 本轮不在所有页面一次性实现“搜索隐藏 / 已保存置灰 / 不参与计算”的完整消费逻辑。
- 本轮不把 setting 合并进现有版本切换弹窗。
- 本轮不新增除 DLC 选择外的其他设置项。
- 本轮不改动 `dlcs.json` 结构本身。

## 验收标准（DoD）
- 右上角存在新的 setting 按钮，样式与既有 SVG 设置按钮一致。
- 当前版本对应 setting 中缺少 `activeDlcs` 字段时，按钮显示红点。
- 打开 modal 后，用户可以看到当前版本可用 DLC 的 checkbox 列表。
- modal 中存在“全选 / 全不选”操作。
- modal 中显示的 DLC 名称基于游戏数据 i18n。
- modal 中存在“未激活 DLC 物品处理策略”的布尔开关，且默认关闭。
- modal 中该布尔开关下存在简短说明文字。
- modal 中显示的 DLC 列表已按 `dependencyVersion <= current game version` 过滤。
- `base` 不出现在 DLC 候选列表中。
- 保存后，当前版本对应的 `activeDlcs` 会写入统一版本分流规则下的 setting storage。
- 保存后，当前版本对应的 `enforceDlcActivation` 会写入统一版本分流规则下的 setting storage。
- 未保存过 `activeDlcs` 时，`useGameDataStore` 运行时默认返回当前版本全部可用 DLC 作为激活列表。
- `useGameDataStore` 能向后续业务逻辑提供当前版本激活 DLC 列表、`enforceDlcActivation` 状态以及基础过滤/helper。

## 未决项
无。
