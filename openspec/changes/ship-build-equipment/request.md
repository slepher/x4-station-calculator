# 需求说明：船只建造配装区

## 目标
在“船只建造”视图中实现可操作的“配装”区，支持按连接点逐项配装与按分组批量配装两种模式，并保证模式切换仅影响展示、不影响已配置数据。

## 已确认方案（审核重点）
1. **展示顺序与最小单元**
   - 配装区从上到下展示飞船全部 `slots`。
   - 每个 `slot` 下展示其 `groups`（连接组），并在每个 group 内分别提供主槽位（如炮塔）与从属护盾的选择区。
   - 最小可配单元是 `connection group`，同一个 group 内 `connection.count` 代表的同类连接点共享同一装备。

2. **候选装备规则（已修正）**
   - 候选来源为 `equipments.json` 全量装备，不再依赖 `ship.slots[].groups[].equipments`。
   - 过滤规则：
     - `equipment.type === slot.type`
     - `equipment.size === connection.size`
     - `equipment.noplayerblueprint !== true` 才参与候选。
     - `equipment.slotTags` 与 `connection.tags` 命中任意一条即可入选（OR 关系）。
     - 特殊标签：当 `connection.tags` 包含 `hittable` 或 `unhittable` 时，除命中该标签外，还必须命中至少一个**其他标签**才算匹配；`hittable` 与 `unhittable` 互斥，不可互相匹配。
   - 当 `connection.tags` 为空时，仅按 `type + size` 过滤。
   - 取消 shield 的 `integrated` 额外命中规则；shield 与其它类型一律按统一标签规则匹配。
   - 候选名称显示使用 `equipment.nameId` i18n 翻译，不直接使用原始 `name` 字段。

3. **标准/简化模式下的 group 规则（已修正）**
   - 标准模式：
     - 按 connection group 分别选择装备。
     - group 标签不显示 `ALL`，直接显示 `L`（单组）或 `M1/M2...`（同 size 多组）。
   - 简化模式：
     - 先按 `slot.size` 聚合，再按 `slot.tags` 分裂聚合组；同 size 且 tags 不同必须拆分为 `M1/M2...`。
     - 组内主槽位与从属护盾同时展示，并允许分别选择（一个标签内包含两块选择区）。
     - 批量选择写回该聚合组对应的全部 connection group。
   - 切换模式不清空、不改写已配装备，仅切换 UI 展示方式。

4. **切换可用性约束**
   - 若用户在同一 `slot.type` 下已分配多种不同装备，简化模式切换按钮置灰。
   - 当冲突消失（同类型恢复为单一装备）后，按钮恢复可用。

5. **护盾从属与聚合键（已修正）**
   - 护盾不是独立顶层槽位，必须从属于其父主槽位 group。
   - 护盾聚合必须基于父槽位语义，不允许把所有 shield 统一并入一个全局 shield 组。
   - 护盾聚合键按 `slot.size | slot.tags | shield.size | shield.tags`（同时受 `slot.type` 维度约束）进行。
   - 示例：若 `L` 组含 `1` 个护盾、`M` 组共含 `6` 个护盾，则简化模式应分别显示 `L` 下 `1`、`M` 下 `6`，不得都显示为 `7`。

6. **状态一致性**
   - 两种模式共享同一份底层配装状态（以 connection group 为键）。
   - 简化模式的批量操作最终写回同一状态表，确保与标准模式互通。

7. **展示细节（已修正）**
   - 左侧 `slotType` 切换按钮只显示当前船存在的类型（共 5 类中的子集），不存在则隐藏。
   - 配装区列表取消固定高度限制，允许按内容自然展开。
   - 每个装备区的计数显示真实 `selected/total`（如 `2/8`），不得固定为 `0/1`。
   - 配装候选界面统一为 Arsenal 单一风格，移除 Nebula/Hangar/Tactical 临时切换入口，并将该唯一视图名称标准化。
   - 候选卡片不展示图片占位，仅展示名称与元信息文本。

## 边界
### In Scope
- 配装区的 connection 级选择交互。
- 标准/简化模式切换与批量分配交互。
- 切换按钮灰态判定与提示。
- 与已有“选船”结果联动展示配装区。

### Out of Scope
- 配装后船体属性计算。
- 建造材料计算与价格联动。
- 自动推荐最优装备策略。

## 验收标准（DoD）
1. 选择飞船后，配装区按 `slots -> groups` 从上到下展示。
2. 标准模式可逐 connection group 选择装备，并在每个 group 内分别显示主槽位区与从属护盾区。
3. 简化模式可按聚合 group 一次性批量分配装备，且一个标签内同时包含主槽位与护盾两块选择区。
4. 候选装备严格按“全量 `equipments` + type + size + slotTags 任一命中”过滤。
5. `connection.tags` 为空时，候选结果按 `type + size` 过滤。
6. 模式切换不影响任何已配置装备。
7. 同一 `slot.type` 存在多种已分配装备时，简化模式切换按钮置灰。
8. 冲突解除后，简化模式切换按钮自动恢复可用。
9. 同 size 不同 tags 的 group 在简化模式下拆分为 `M1/M2...` 等独立标签，不得误合并。
10. 护盾按父槽位 `size|tags` 及自身 `shieldSize|shieldTags` 聚合，禁止跨父槽位错误合并。
11. 组内计数显示真实 `selected/total`，并与实际槽位数量一致。
12. 当 tags 含 `hittable/unhittable` 时，必须额外命中至少一个其它标签；`hittable` 与 `unhittable` 互不匹配。
13. shield 不再使用 `integrated` 特例命中规则。
14. 唯一候选视图名称标准化，且装备名称在标准/简化模式均为 i18n 结果。
15. `noplayerblueprint=true` 的装备不得出现在候选列表中。

## 未决项
无。
