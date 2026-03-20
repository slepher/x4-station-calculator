# dlc-setting 设计说明

## 设计目标
为应用增加一套按游戏版本隔离的 DLC setting 机制，先覆盖“激活 DLC 列表”与“未激活 DLC 物品处理策略”的配置读取、编辑、保存与 store 暴露。
设计重点是复用现有版本隔离规则，而不是让 `x4-setting` 走一套独立的存储分流逻辑。

## 1. 整体结构

### 1.1 UI 分层
- 在右上角工具区增加独立的 setting 按钮。
- 按钮复用现有 `SettingsButton.vue` 的图标与红点表现。
- 按钮只负责打开/关闭 modal，不直接承担 storage 读写。

### 1.2 Modal 分层
- 新增独立的 `DlcSettingsModal` 或等价组件。
- modal 负责：
  - 读取 store 提供的当前版本可用 DLC 列表
  - 读取 store 提供的当前版本激活 DLC 列表
  - 读取 store 提供的 `enforceDlcActivation`
  - 提供 checkbox 列表
  - 将 DLC 名称通过游戏数据 `nameId` 做 i18n 解析后显示
  - 提供“全选 / 全不选”
  - 提供单个布尔开关
  - 在布尔开关下提供一行简短说明文字
  - 提供保存与关闭
- modal 不自己拼 storage key，不直接重复实现版本隔离规则。

### 1.3 Store 分层
- `useGameDataStore` 继续作为游戏数据与当前版本上下文中心。
- DLC setting 也挂接在 `useGameDataStore`，便于后续业务统一读取。
- store 负责：
  - 解析当前版本 setting storage
  - 提供当前版本可用 DLC 列表
  - 提供当前版本激活 DLC 列表
  - 提供 `enforceDlcActivation`
  - 提供“是否缺少 DLC 设置”状态
  - 提供基础 DLC 激活判断/helper
  - 处理保存

## 2. 存储设计

### 2.1 key 生成策略
- `x4-setting` 必须复用现有统一的版本分流逻辑。
- 推荐做法是扩展现有 `getStorageKey()` 或同级统一函数，使其支持 `setting`。
- `versions.json` 中也需要显式增加 `setting` 的 storage key，保持配置与代码入口一致。
- 这样 `setting` 的默认版本行为、beta/stable 区分方式、后续版本扩展方式都与现有模块一致。

### 2.2 setting 数据结构
- 当前 setting 仅需要最小结构：

```ts
type X4SettingStorage = {
  activeDlcs?: string[]
  enforceDlcActivation?: boolean
}
```

- `activeDlcs` 使用可选字段而不是强制字段。
- 缺少字段时，既能支撑红点提示，也能支撑默认 fallback。
- `enforceDlcActivation` 为单个布尔字段，默认视为 `false`。

### 2.3 未设置与已设置的区分
- `activeDlcs` 字段缺失：
  - 表示当前版本尚未显式完成 DLC 设定
  - setting 按钮显示红点
  - 运行时默认激活全部当前版本可用 DLC
- `activeDlcs` 字段存在：
  - 视为当前版本已完成设定
  - 不显示红点
  - 即使值为空数组，也按用户显式选择处理

## 3. DLC 候选构建设计

### 3.1 数据来源
- DLC 元数据直接来自当前版本已加载的 `dlcs.json`。
- `useGameDataStore` 已持有 `dlcs` 原始数据，可直接作为候选输入。

### 3.2 版本过滤
- 需从 `dlcs` 中筛出“当前版本可用 DLC”。
- 过滤规则：
  - `dependencyVersion <= current game version`
- 因此未来新增更高依赖版本的 DLC 时，旧版本界面不会出现无效选项。

### 3.3 候选边界
- `base` 不纳入候选列表。
- 本次只处理 DLC 项本身，不引入额外的“基础内容”伪选项。

## 4. 运行时状态设计

### 4.1 Store 输出
- `allDlcs` 或等价原始 DLC 元数据
- `availableDlcs`
- `activeDlcs`
- `enforceDlcActivation`
- `needsDlcSetup`
- 基础 helper，例如：
  - `isDlcActive(dlcTag)`
  - `filterActiveDlcItems(items)`

### 4.2 默认激活策略
- 当缺少 `activeDlcs` 字段时：
  - `activeDlcs` 运行时计算结果直接回退为 `availableDlcs.map(dlc => dlc.id)`
- 该 fallback 只用于业务消费，不自动持久化。

### 4.3 未激活 DLC 处理策略
- `enforceDlcActivation = false` 时：
  - 本次只暴露状态，不强制页面做隐藏/禁算
- `enforceDlcActivation = true` 时：
  - 后续页面应采用统一语义：
    - 搜索列表隐藏未激活 DLC 物品
    - 已保存项置灰
    - 已保存项不参与计算
- 上述逐页消费逻辑不要求在本次 change 中全部落地，但 store 必须先提供统一状态与 helper。

### 4.4 保存策略
- 用户在 modal 中点击保存后：
  - 将当前选择结果写入当前版本对应的 setting storage
  - 将 `enforceDlcActivation` 写入当前版本对应的 setting storage
  - 刷新 store 内的 `activeDlcs`
  - 刷新 store 内的 `enforceDlcActivation`
  - 将 `needsDlcSetup` 置为 false
- 点击关闭或遮罩关闭时：
  - 不写入 storage
  - 不改变持久化状态

## 5. UI 反馈设计

### 5.1 红点提示
- 红点提示只绑定 `needsDlcSetup`。
- 红点不表示“当前未全选 DLC”，而是表示“当前版本从未显式完成保存”。

### 5.2 选择交互
- modal 使用 checkbox 列表逐项选择 DLC。
- 顶部增加“全选 / 全不选”动作，减少手工点击成本。
- 列表中的 DLC 名称通过游戏数据 `nameId` 做 i18n 解析后显示。
- 初始选中值来自：
  - 已保存的 `activeDlcs`
  - 或缺失字段时的默认全激活 fallback
- `enforceDlcActivation` 使用单个布尔开关，初始值来自已保存字段，缺失时回退为 `false`。
- 布尔开关下显示简短说明文字，仅解释对搜索列表和已保存项的影响，不暴露实现细节。

## 6. 风险与对策

- 风险：`x4-setting` 单独实现 key 规则，导致与现有版本隔离行为漂移。
  - 对策：强制复用统一 storage key 生成入口。
- 风险：未设置与空数组语义混淆，导致红点状态错误。
  - 对策：严格以“字段是否存在”判断红点，而不是看数组是否为空。
- 风险：未来 DLC 元数据版本向前兼容不足。
  - 对策：候选列表统一基于 `dependencyVersion <= current game version` 过滤。
- 风险：后续业务再次直接访问 localStorage。
  - 对策：所有消费方统一从 `useGameDataStore` 读取激活 DLC 状态。
- 风险：未激活 DLC 处理策略在各页面实现时语义漂移。
  - 对策：先在 store 中固化统一布尔状态与基础 helper，再由各页面按统一语义接入。
