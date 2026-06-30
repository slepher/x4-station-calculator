# auto-sector-group-one-binding-mode Design

## 架构

本 change 只调整 auto-sector-group binding 面板的 UI 状态模型和 presenter 编排，不改变核心分组算法。

```text
live store
  owns shared draft/result
  owns calculation parameters
  owns hub pin/retain/jumpRange state

presenter
  owns UI mode orchestration
  owns ignore-current-nodes overlay
  maps generate card actions to draft transforms / calculation

Vue
  renders preview/edit/generate modes
  renders generate settings card
```

## 模式状态

外显模式统一为：

```ts
type AutoSectorPanelMode = 'preview' | 'edit' | 'generate'
```

映射原则：

- `preview`：对应原 result 展示语义。
- `edit`：对应当前直接编辑 draft 结构的语义。
- `generate`：显示生成设置 card，并允许编辑下一次生成所需的当前 draft 参数。

`generate` 模式直接编辑当前 draft，不再引入“空 / 当前 / 存档”独立 view。存档恢复通过 `[重置]` 完成；空基础通过“忽略当前节点”overlay 在提交时产生。

三态模式切换渲染在 hub stat bar 中，替换原先的单独 `[编辑]` 按钮。`edit` 模式不再渲染额外 `[退出]` 按钮，离开编辑通过三态切换完成。

页面顶部操作区只保留页面级操作与状态，例如 `[地图]`、`[重置]`、`[确定]` 和未解决提示。历史遗留 `[返回]` 按钮不再渲染；`[地图]` 只在 live columns 布局显示，Map/tabs 布局不显示重复的地图入口。

## 生成设置 card

生成设置 card 是 `generate` 模式唯一生成入口，包含两行：

```text
连接 4跳   节点 ✓   覆盖 2跳   交易站 5Mm³
保留连接 ◩   保留覆盖 ✓   保留交易站 ✓        [忽略当前节点 icon] [生成方案]
```

第一行控件读写现有生成参数：

- `bridgeSearchJumpRange`
- `nodeEnabled`
- `prefJumpRange`
- `prefThreshold`

第二行左侧的 retain checkbox 是 hub retain 的聚合/批量入口，不是独立全局真值：

- checked：所有可编辑 hub 对应 retain 均为 true。
- unchecked：所有可编辑 hub 对应 retain 均为 false。
- mixed：hub 之间存在不一致。

第二行右侧：

- “忽略当前节点”是 transient overlay。
- `[生成方案]` 调用现有显式计算路径，但按钮文案与模式切换后行为更新。

该 card 渲染在 hub stat bar 正下方；Live columns 和 Map hub tab 使用相同位置语义，只允许紧凑程度不同。Map compact 布局下，“忽略当前节点”图标按钮和 `[生成方案]` 按钮使用一致高度，避免动作区视觉错位。

## 忽略当前节点 overlay

新增 presenter-local 状态：

```ts
const ignoreCurrentNodes = ref(false)
```

生命周期：

- 进入 `generate` 模式时默认为 `false`。
- 用户点击图标时 toggle。
- 切出 `generate` 模式时清除。
- `[生成方案]` 成功后清除。
- 不写入 live store shared draft，不持久化。

显示与提交：

- `ignoreCurrentNodes=false`：hub card 按自身 `isPinned` 显示并提交。
- `ignoreCurrentNodes=true`：hub card 在 `generate` 模式下显示为 unpin，单卡 pin/unpin 控件禁用，提交时 base input 为空。

该 overlay 不应修改 assignment 列的持久选择真值；Assignment / Trade Station 列可以基于当前 draft 刷新，但 overlay 本身只影响生成模式显示和生成提交输入。

## Retain 显示与半透明

retain checkbox 只在 `generate` 模式渲染。

card retain 仍是 hub draft 状态：

- `connectionRetainEnabled`
- `coverageRetainEnabled`
- `tradeStationRetainEnabled`

unpin 状态下 retain checkbox disabled。由于“忽略当前节点”激活时所有 hub 显示为 unpin，因此 retain 自然走同一 disabled 规则。

半透明显示用于表达“数据存在但本次生成不携带”：

- coverage retain unchecked：coverage/range pill 半透明。
- trade station retain unchecked：selected trade station / station display 半透明。
- connection retain unchecked：connection pill 是否半透明需要同时看连接双方。

connection 判断使用双方状态，避免单侧 card 误导：

```text
both retain on -> connection carried
both retain off -> connection dimmed / not carried
one retain off + other unpinned -> connection dimmed / not carried
```

## Pin / Unpin

card pin/unpin 不限制在 `generate` 模式显示；既有非生成模式展示可以保留。

在 `generate` 模式：

- 单卡 pin/unpin 直接写当前 draft hub 的 `isPinned`。
- `ignoreCurrentNodes=true` 时，单卡 pin/unpin 禁用，视觉显示由 overlay 覆盖为 unpin。

bridge 新产生的 hub 默认 `isPinned=false`。这是 bridge hub 的通用默认行为，不应只放在 reset 路径中。

## JumpRange

`generate` 模式允许编辑 hub jumpRange。该编辑直接作用于当前 draft，并实时更新 coverage/range 数据，保持 card 展示和提交输入一致。

约束：

- jumpRange 扩大或缩小时更新该 hub 的范围星区。
- 不自动吸收 assignment。
- 不自动切换 assignment 选择。
- 与编辑模式的“不默认吸收”语义保持一致。

## 生成与保存

`[生成方案]`：

1. 读取当前 draft 和生成设置 card 参数。
2. 若 `ignoreCurrentNodes=true`，提交空 base input。
3. 若 `ignoreCurrentNodes=false`，按当前 draft 中 pinned hub 作为 base input。
4. 运行生成逻辑并更新 current shared draft/result。
5. 成功后切换到 `preview` 模式并清除 overlay。
6. 不自动保存。

`[确定]`：

- 只保存当前 draft。
- 不运行生成。

`[重置]`：

- 恢复已保存 binding 初始数据口径。
- 不属于生成设置 card。

## 兼容现有面板

Live columns 与 Map tabs 可复用同一 presenter 状态与生成设置 card。布局差异只影响 card 摆放，不改变行为语义。
