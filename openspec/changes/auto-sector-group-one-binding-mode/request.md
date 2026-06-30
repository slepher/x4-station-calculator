# auto-sector-group-one-binding-mode Request

## 目标

重构 auto-sector-group binding 面板的模式与 status bar，使用户能明确区分预览、编辑与生成方案三个工作状态。该 change 聚焦 UI 行为、生成参数入口、retain/pin/unpin 展示与提交语义，不改变核心分组算法。

## 已确认方案（审核重点）

### 三态模式

- 面板 SHALL 使用 `[预览 | 编辑 | 生成]` 作为外显主模式。
- 三态按钮 SHALL 替换原 hub stat bar 中的单独 `[编辑]` 按钮；页面顶部操作区不承载三态模式切换。
- `编辑` 模式 SHALL NOT 再显示单独 `[退出]` 按钮；离开编辑由三态按钮切换到 `预览` 或 `生成` 完成。
- `预览` 用于查看当前 shared draft/result。
- `编辑` 用于直接编辑当前 shared draft 的结构。
- `生成` 用于编辑当前 draft 中下一次生成方案所需的参数，并执行生成。
- 切出 `生成` 模式 SHALL 清除“忽略当前节点”overlay。
- 点击 `生成方案` 成功后 SHALL 自动切回 `预览` 模式，展示新生成的当前 draft/result；不会自动保存。
- 生成失败或被 gate 阻止时 SHALL 保持在 `生成` 模式。

### 生成设置 card

- 原 status bar 中直接展示的计算参数 SHALL 移入 `生成` 模式专属的生成设置 card。
- 生成设置 card SHALL 位于 hub stat bar 下方，作为 hub 区域的生成动作区，而不是页面顶部操作区。
- Live columns 和 Map hub tab 中的生成设置 card SHALL 保持相同信息结构；Map compact 布局中“忽略当前节点”图标按钮和 `[生成方案]` 按钮 SHALL 高度一致。
- 原 `[计算]` / `[快速计算]` 外显入口 SHALL 取消，新的动作按钮 SHALL 命名为 `[生成方案]`，且只显示在生成设置 card 内。
- 生成设置 card 第一行 SHALL 显示全局生成参数：
  - 连接跳数 `bridgeSearchJumpRange`
  - 是否生成新节点 `nodeEnabled`
  - 覆盖跳数 `prefJumpRange`
  - 交易站阈值 `prefThreshold`
- 生成设置 card 第二行 SHALL 左侧显示三个 retain 聚合/批量 checkbox：
  - 保留连接
  - 保留覆盖
  - 保留交易站
- 生成设置 card 第二行 SHALL 右侧显示：
  - “忽略当前节点”图标按钮
  - `[生成方案]` 按钮
- 三个 retain checkbox 只存在于 `生成` 模式；`预览` 与 `编辑` 模式不显示 retain checkbox。
- 生成设置 card 中的 retain checkbox 是所有 hub card retain 状态的聚合/批量入口；真实 retain 状态仍属于各 hub card。
- retain 聚合 SHALL 支持 checked / unchecked / mixed 三态显示。

### 重置与存档恢复

- `[重置]` 按钮 SHALL 保留在页面操作区，而不是生成设置 card。
- `[重置]` 语义 SHALL 是丢弃当前 shared draft 的未保存变更，并恢复到已保存 binding 的初始数据口径。
- 取消此前“空 / 当前 / 存档”生成基础三态；空基础由“忽略当前节点”overlay 表达，存档恢复由 `[重置]` 表达。
- bridge 产生的 hub 默认 `unpin` 是通用默认值变更，不是 `[重置]` 的专属补丁。

### 忽略当前节点 overlay

- `生成` 模式的生成设置 card SHALL 提供“忽略当前节点”图标按钮，并通过 tooltip 解释语义。
- tooltip 建议语义：`忽略当前节点：本次生成不使用当前 Hub 作为基础。`
- 该按钮 SHALL 只在 `生成` 模式显示和生效。
- 点击后进入 overlay 激活态；再次点击还原。
- overlay SHALL NOT 覆写任何 hub 自身的 pin/unpin 状态。
- overlay 激活时，`生成` 模式下所有 hub card 的 pin/unpin 显示 SHALL 被覆盖为 unpin。
- overlay 激活时，card 上的单个 pin/unpin 控件 SHALL 禁用。
- overlay 激活时，由于 hub 显示为 unpin，retain checkbox SHALL 按现有 unpin 禁用逻辑禁用。
- overlay 激活时，点击 `[生成方案]` SHALL 提交空 base input。
- overlay 未激活时，点击 `[生成方案]` SHALL 按当前 draft 的 hub pin/unpin 状态提交 base input。
- overlay SHALL 在进入 `生成` 模式时默认为关闭；切出 `生成` 模式或生成成功后清除；不得持久化。

### Hub card 与 retain

- card pin/unpin 并非只在 `生成` 模式显示；现有非生成模式 pin/unpin 展示仍可保留。
- `生成` 模式下 card pin/unpin SHALL 直接编辑当前 draft 的 hub pin 状态，除非“忽略当前节点”overlay 激活。
- card retain checkbox 只在 `生成` 模式显示。
- unpin 状态下 card retain checkbox SHALL 禁用。
- retain unchecked 时，对应 card 数据仍显示，但 SHALL 半透明展示，表示该类数据不会携带进本次生成输入：
  - 覆盖 retain unchecked：范围星区半透明。
  - 交易站 retain unchecked：空间站/交易站半透明。
  - 连接 retain unchecked：连接关系按双方状态判断后半透明。
- link/connection 的携带与半透明显示 SHALL 考虑双方 hub 状态；至少满足以下约束：
  - 双方 retain 均允许携带时，连接正常显示并可提交。
  - 双方 unchecked 时，连接不携带并半透明。
  - 一方 unchecked 且另一方 unpin 时，连接不携带并半透明。

### 跳数与实时刷新

- `生成` 模式下 hub card jumpRange 可编辑。
- jumpRange 修改 SHALL 实时改写当前 draft 中该 hub 的范围星区，保持数据一致。
- jumpRange 修改 SHALL NOT 默认吸收 assignment，也不得自动改变 assignment 选择；该约束与编辑模式一致。
- `生成` 模式下 pin/unpin、retain、jumpRange 等变更后，Assignment 与 Trade Station 列可以实时刷新，不必延迟到点击 `[生成方案]`。

### 保存与确认

- `[确定]` 仍只保存当前 shared draft，不运行生成。
- `[生成方案]` 只生成新的当前 draft/result，不自动保存。
- 生成成功后用户仍需点击 `[确定]` 才会写入 binding。

### 页面操作区

- 页面顶部操作区 SHALL 移除历史遗留 `[返回]` 按钮。
- 页面顶部操作区 SHALL 在 live columns 布局显示 `[地图]` 入口。
- 页面顶部操作区 SHALL 在 Map/tabs 布局隐藏 `[地图]` 入口，避免当前已处于地图模式时显示重复动作。

## 边界

### In Scope

- Auto-sector-group binding 面板外显模式从 result/edit/计算入口调整为 `[预览 | 编辑 | 生成]`。
- 生成设置 card 的参数、retain 聚合、忽略当前节点、生成方案按钮行为。
- retain checkbox 的显示模式、聚合、局部 card 展示与半透明规则。
- 生成模式下 pin/unpin、jumpRange 对当前 draft 与实时刷新行为的定义。
- `[重置]` 恢复到已保存 binding 初始数据口径。
- bridge 产生 hub 默认 unpin 的行为口径。

### Out of Scope

- 核心 hub grouping、MST、bridge、assignment option 算法重写。
- Trade station 候选评分规则重写。
- Map 染色、hub color 分配规则重写。
- 新增测试代码或运行测试。

## 验收标准（DoD）

- 面板清晰展示 `[预览 | 编辑 | 生成]` 三态，且三态切换符合已确认语义。
- `生成` 模式显示生成设置 card；`预览` 与 `编辑` 模式不显示 retain checkbox。
- `[生成方案]` 只在生成设置 card 中出现，生成成功后切回 `预览` 且不自动保存。
- `[重置]` 保留并恢复到已保存 binding 初始数据口径。
- “忽略当前节点”仅在 `生成` 模式生效，不覆写 hub pin/unpin，激活时提交空 base input。
- retain unchecked 时对应 card 数据半透明；unpin 状态下 retain 禁用。
- `生成` 模式下 jumpRange 修改实时更新范围星区，但不默认吸收、不自动改变 assignment 选择。
- Assignment / Trade Station 列可随生成模式参数变更实时刷新。
- bridge 产生的 hub 默认 unpin。

## 未决项

无。
