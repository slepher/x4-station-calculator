# ship-dlc 设计说明

## 设计目标
为舰船建造页面建立一套与 `dlc-setting`、`station-dlc-tag` 一致的 DLC 消费语义，覆盖舰船候选展示、装备候选展示、当前舰船有效性收敛，以及未激活 DLC 装备在属性和 diff 计算中的统一排除。
设计重点是复用 `useGameDataStore` 已有的 DLC 状态与 helper，而不是在舰船页面重新实现一套本地判断逻辑。

## 1. 整体结构

### 1.1 状态来源分层
- `useGameDataStore` 继续作为 DLC 激活状态中心。
- 舰船页只消费以下能力：
  - `activeDlcs`
  - `enforceDlcActivation`
  - `isDlcActive(dlcTag)`
  - `filterActiveDlcItems(items)`
  - `getDlcDisplayName(dlcTag)`
- 页面层、picker 层、stats 层都不直接读取 `localStorage`。

### 1.2 舰船候选分层
- 舰船候选列表继续以现有 ship selector 为入口。
- 过滤逻辑应落在候选提取函数层，而不是只在最终渲染时隐藏。
- 这样 race/type 计数、分页和当前待选项同步逻辑都能统一基于过滤后的候选集合计算。

### 1.3 装备候选分层
- 装备候选继续走现有 equipment picker 的候选提取与 facet 统计链路。
- DLC 过滤同样应前置到候选提取层。
- 这样 race/mk/tag facet 统计、分页与高亮逻辑都不会与最终渲染结果脱节。

### 1.4 失效项处理分层
- 舰船失效与装备失效采用不同收敛策略：
  - 当前舰船失效：当前编辑目标失效，页面返回 selector。
  - 已配置装备失效：保留蓝图数据，但不参与计算和 diff。
- 这样既能保证当前编辑上下文合法，也能避免用户历史配置直接丢失。

## 2. 舰船候选设计

### 2.1 标签展示
- 在舰船列表项名称右侧展示 DLC 标签。
- `base` 不显示标签。
- 标签文本通过 `getDlcDisplayName(dlcTag)` 获取，避免页面自行维护 DLC 名称映射。

### 2.2 候选过滤
- 当 `enforceDlcActivation = false` 时：
  - 舰船候选保持现状，不做剔除。
- 当 `enforceDlcActivation = true` 时：
  - 在 ship candidate 提取阶段过滤 `!isDlcActive(ship.dlc_tag)` 的舰船。
- 过滤结果需要同步影响：
  - 候选列表内容
  - raceCountMap
  - typeCountMap
  - 分页结果
  - 当前 pending ship 的有效性同步

### 2.3 当前舰船失效收敛
- 当 DLC 设置变化后，如果当前蓝图对应的 `shipId` 指向未激活 DLC 舰船：
  - 不能继续停留在 workspace/workbench 视图
  - 应回退到 selector 视图
- 数据层不强制删除该蓝图；只取消其“当前可编辑舰船”地位。
- 这样与空间站“保留历史配置但收紧当前可编辑上下文”的思路一致。

## 3. 装备候选设计

### 3.1 标签展示
- 在装备候选列表的装备名称右侧展示 DLC 标签。
- `base` 不显示标签。
- 标签配色语义与舰船/空间站一致：
  - 激活：绿色边框与绿色文字
  - 未激活：红色边框与红色文字

### 3.2 候选过滤
- 当 `enforceDlcActivation = false` 时：
  - 装备候选维持现状，只展示标签状态。
- 当 `enforceDlcActivation = true` 时：
  - 在 equipment candidate 提取阶段过滤未激活 DLC 装备。
- 过滤结果需要同步影响：
  - picker 候选项
  - race facet 统计
  - mk facet 统计
  - tag facet 统计
  - 分页数据

### 3.3 预设蓝图自动选装过滤
- 预设蓝图生成链路中的自动选装候选池，不复用“手动 picker 列表是否展示”的语义。
- 自动选装的目标是生成一个当前可用的默认蓝图，因此候选池应始终基于“当前已激活 DLC”过滤。
- 这条规则独立于 `enforceDlcActivation`：
  - 手动 picker 列表的可见性仍由 `enforceDlcActivation` 控制
  - 预设自动选装则始终不允许选中未激活 DLC 装备
- 需要覆盖预设生成时的全部默认装备分支，不能只覆盖主路径而遗漏特殊分支。

## 4. 未激活 DLC 装备禁算设计

### 4.1 目标语义
- 未激活 DLC 装备在蓝图中可以保留。
- 但在 `enforceDlcActivation = true` 时，这些装备视为“存在于历史配置中，但对当前舰船能力无效”。

### 4.2 属性计算排除
- 舰船属性统计链路在汇总已配置装备时，需要先按 DLC 有效性过滤。
- 过滤后再参与如下统计：
  - weapon burst / sustained
  - turret average
  - shield max / recharge
  - engine speed / boost / travel
  - thruster yaw / pitch / roll / strafe
- 关闭策略时，保持现有计算行为不变。

### 4.3 Diff / Comparison 排除
- 装备 diff / comparison 也必须遵循相同的 DLC 有效性规则。
- 若当前装备或候选装备所属 DLC 未激活，且策略开启：
  - 不将其纳入 diff 结果计算
  - 不将其作为有效统计基准参与差值展示
- 避免出现“候选项已过滤但 diff 仍引用失效装备”的状态撕裂。

## 5. 状态刷新与一致性

### 5.1 DLC 设置变化后的刷新
- 当 `activeDlcs` 或 `enforceDlcActivation` 变化时，舰船页需要重新收敛以下状态：
  - 当前舰船是否仍有效
  - 舰船候选列表
  - 装备候选列表
  - 舰船属性统计
  - diff / comparison 展示

### 5.2 单一语义来源
- 所有 DLC 相关判断都应通过 `useGameDataStore` helper 完成。
- 不允许在舰船 selector、equipment picker、stats panel、diff panel 分别复制一套 `dlc_tag === 'base'` 或 `activeDlcs.includes(...)` 的判断。

## 6. 风险与对策

- 风险：只在 UI 层隐藏候选项，导致 facet 数量与分页仍包含失效项目。
  - 对策：将 DLC 过滤前置到候选提取层。
- 风险：当前舰船失效后仍停留在 workspace，出现空引用或半失效状态。
  - 对策：在 DLC 状态变化时统一校验当前舰船有效性，并强制回退 selector。
- 风险：装备候选已过滤，但 stats 或 diff 仍然引用历史失效装备。
  - 对策：在 stats 与 diff 聚合入口统一按 DLC 有效性做前置过滤。
- 风险：页面分散实现 DLC 判断，后续行为漂移。
  - 对策：强制复用 `useGameDataStore` 暴露的统一 helper。
