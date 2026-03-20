# ship-dlc 需求说明

## 目标
为舰船建造页面增加 DLC 标签与 DLC 过滤能力。
本次 change 需要让舰船和装备都能明确呈现所属 DLC，并在启用“限制未激活 DLC 物品”后，对舰船候选、装备候选以及属性/对比计算统一施加未激活 DLC 过滤语义。

## 已确认方案（审核重点）

### 1. 作用范围
- 本次 change 只处理舰船建造页面。
- 目标区域包括：
  - 舰船选择界面中的舰船候选列表
  - 装备 picker 中的装备候选列表
  - 舰船当前编辑目标有效性收敛
  - 舰船属性统计与装备 diff / comparison 计算
- 不扩展到空间站规划页、资源页或其他业务页面。

### 2. 舰船 DLC 标签展示
- 每个舰船候选项都需要在舰船名称右侧显示 DLC 标签。
- 标签使用与现有空间站页面一致的 `tag` 形态，而不是额外说明文本或图标。
- 标签文本使用游戏数据中的 DLC `nameId`，通过游戏 i18n 系统解析，而不是使用应用侧自定义映射。
- `base` 不显示标签。

### 3. 装备 DLC 标签展示
- 每个装备候选项都需要在装备名称右侧显示 DLC 标签。
- 标签样式与舰船标签保持一致。
- 标签文本同样通过游戏 i18n 解析 DLC `nameId`。
- `base` 不显示标签。

### 4. 标签样式语义
- 已激活 DLC 标签：
  - 绿色边框
  - 绿色文字
- 未激活 DLC 标签：
  - 红色边框
  - 红色文字
- 标签颜色只表达当前 DLC 激活状态，不额外承载“可编辑/不可编辑”或“是否参与计算”的语义。

### 5. 舰船候选过滤行为
- 当 `enforceDlcActivation = false` 时：
  - 舰船候选列表继续显示全部舰船
  - 仅通过标签提示舰船所属 DLC 是否激活
- 当 `enforceDlcActivation = true` 时：
  - 舰船候选列表中过滤掉未激活 DLC 舰船
  - 舰船筛选计数、分页与候选数量都基于过滤后的结果

### 6. 装备候选过滤行为
- 当 `enforceDlcActivation = false` 时：
  - 装备候选列表继续显示全部可匹配装备
  - 仅通过标签提示装备所属 DLC 是否激活
- 当 `enforceDlcActivation = true` 时：
  - 装备候选列表中过滤掉未激活 DLC 装备
  - race / mk / tag facet 统计与分页都基于过滤后的结果

### 6.1 预设蓝图自动选装过滤行为
- 预设蓝图生成时，系统内部用于自动挑选默认装备的候选池，与手动装备 picker 列表不是同一个场景。
- 无论 `enforceDlcActivation` 是否为 `true`，预设蓝图自动选装时都需要过滤未激活 DLC 装备。
- 也就是说：
  - 手动 picker 列表在 `enforceDlcActivation = false` 时可以继续展示未激活 DLC 装备
  - 但预设蓝图不应在任何情况下自动填入未激活 DLC 装备

### 7. 当前舰船失效后的页面收敛
- 当 `enforceDlcActivation = true` 且当前已选舰船所属 DLC 未激活时：
  - 系统不继续停留在舰船配装工作台
  - 系统自动返回舰船选择界面
  - 当前舰船不再作为可编辑目标
- 已保存蓝图数据可以继续保留在存储中，不要求因为 DLC 失效而立即清空。

### 8. 未激活 DLC 装备的保留与禁算语义
- 当 `enforceDlcActivation = true` 且蓝图中已配置的某个装备所属 DLC 未激活时：
  - 该装备配置可以继续保留在蓝图数据中，避免用户历史配置直接丢失
  - 但该装备不参与舰船属性计算
  - 该装备不参与装备 diff / comparison 计算
- 本次不要求因为装备失效而自动删除蓝图中的该装备项。

### 9. DLC 状态来源
- 舰船建造页面不直接读取 `localStorage`。
- 页面统一消费 `useGameDataStore` 已提供的 DLC 状态与 helper，包括：
  - 当前激活 DLC 列表
  - `enforceDlcActivation`
  - 基于 `dlc_tag` 的激活判断
  - 基础过滤 helper
- 舰船页的标签展示、候选过滤、当前舰船有效性判断、属性禁算与 diff 禁算，必须与 `dlc-setting` change 中定义的统一 DLC 语义保持一致。

## 边界

### In Scope
- 为舰船候选列表增加 DLC 标签。
- 为装备候选列表增加 DLC 标签。
- 在 `enforceDlcActivation = true` 时过滤未激活 DLC 的舰船候选。
- 在 `enforceDlcActivation = true` 时过滤未激活 DLC 的装备候选。
- 在任意 `enforceDlcActivation` 状态下，预设蓝图自动选装时过滤未激活 DLC 装备。
- 在当前舰船失效时自动回退到舰船选择界面。
- 在 `enforceDlcActivation = true` 时将未激活 DLC 装备从舰船属性计算中排除。
- 在 `enforceDlcActivation = true` 时将未激活 DLC 装备从 diff / comparison 中排除。

### Out of Scope
- 修改 DLC setting modal 本身的交互或存储结构。
- 修改数据处理链路中的 `dlc_tag` 生成逻辑。
- 为导弹、无人机、消耗品单独新增 DLC 页面逻辑。
- 因 DLC 失效而自动删除蓝图中的舰船或装备数据。
- 编写测试代码或运行测试。

## 验收标准（DoD）
- 舰船候选列表中的每个非 `base` 舰船名称右侧都显示 DLC 本地化标签。
- 装备候选列表中的每个非 `base` 装备名称右侧都显示 DLC 本地化标签。
- DLC 标签文案使用游戏 i18n 的 `nameId` 翻译结果。
- 已激活 DLC 标签显示为绿色边框与绿色文字。
- 未激活 DLC 标签显示为红色边框与红色文字。
- `base` 不显示 DLC 标签。
- 当 `enforceDlcActivation = false` 时，舰船候选列表仍显示未激活 DLC 舰船。
- 当 `enforceDlcActivation = true` 时，舰船候选列表不显示未激活 DLC 舰船。
- 当 `enforceDlcActivation = false` 时，装备候选列表仍显示未激活 DLC 装备。
- 当 `enforceDlcActivation = true` 时，装备候选列表不显示未激活 DLC 装备。
- 无论 `enforceDlcActivation` 是否为 `true`，预设蓝图自动选装结果都不包含未激活 DLC 装备。
- 当 `enforceDlcActivation = true` 且当前已选舰船所属 DLC 未激活时，页面自动返回舰船选择界面。
- 当 `enforceDlcActivation = true` 时，蓝图中未激活 DLC 装备不参与舰船属性统计结果。
- 当 `enforceDlcActivation = true` 时，蓝图中未激活 DLC 装备不参与装备 diff / comparison 结果。
- 舰船页面的 DLC 判断统一来自 `useGameDataStore` 暴露的状态与 helper，而不是直接读取存储。

## 未决项
无。
