## Context

当前“船只建造”仅完成选船与摘要展示，配装区尚未具备可操作能力。本变更需要在不引入属性/材料计算的前提下，落地配装状态模型和两种展示模式。

## Decisions

1. **状态主键选择**
   - 以 connection group 为最小持久单元。
   - 使用稳定键（如 `shipId + slotType + groupName + index`）映射到已选装备。

2. **候选过滤来源与规则**
   - 候选从 `equipments.json` 全量计算，不依赖 `group.equipments`。
   - 过滤为三段：
     - `type` 精确匹配；
     - `size` 精确匹配；
     - `noplayerblueprint=true` 的装备直接排除；
     - `slotTags` 任意命中（OR），其中 `slotTags` 来自 `equipment.slotTags`；
     - 当 `connection.tags` 包含 `hittable` 或 `unhittable` 时，除命中该标签外，还必须命中至少一个其他标签；`hittable` 与 `unhittable` 互斥不匹配；
   - 若 connection tags 为空，仅保留 `type + size`。
   - 取消 shield 的 `integrated` 特例命中规则，按统一标签规则处理。
   - 候选名称统一使用 `equipment.nameId` 的 i18n 翻译，避免固定英文名称。

3. **双模式单状态**
   - 标准模式与简化模式共享同一底层状态，不引入第二份“简化模式专用状态”。
   - 简化模式是标准状态的聚合视图，批量操作回写同一状态表。

4. **冲突定义与切换保护**
   - 在同一 `slot.type` 下若出现多种已选装备，视为“简化切换冲突”。
   - 冲突时禁用简化模式切换，避免聚合语义歧义。

5. **标准模式 group 标签规则**
   - 不显示 `ALL` 标签。
   - group 标签按连接组显示：`L`（仅一个同 size 组）或 `M1/M2...`（同 size 多组）。
   - 同一标签内分两块：主槽位候选区 + 从属护盾候选区。

6. **简化模式聚合规则（修正）**
   - 主槽位聚合键：`slotType | slot.size | slot.tags`。
   - 同 `slotType + size` 但 `tags` 不同必须拆分聚合组，并以 `M1/M2...` 命名。
   - 护盾不是独立顶层聚合维度，必须跟随父主槽位组展示。

7. **护盾从属聚合规则（修正）**
   - 护盾聚合键：`slotType | slot.size | slot.tags | shield.size | shield.tags`。
   - 聚合输入必须来自当前主槽位聚合组选中的 connection keys 派生的 shield keys，不可跨组全量汇总。
   - 该规则用于避免 `L` 组误吞并 `M` 组护盾（例如 `L=1`、`M=6` 被错误显示为 `7`）。

8. **展示顺序与可见性策略**
   - 标准模式保持 `slots -> groups` 原始顺序。
   - 简化模式以“首次出现顺序”生成聚合组列表，避免跳序。
   - 左侧 `slotType` 切换按钮仅显示当前船存在的类型。
   - 配装区不设固定高度上限，按内容自然展开。
   - 候选样式仅保留 Arsenal，移除多候选风格切换状态与控件，并将唯一视图名称标准化。
   - 候选卡片采用纯文本信息，不保留无数据来源的图片占位。

9. **计数语义**
   - 每个装备区（主槽位、护盾）显示真实 `selected/total`。
   - `total` 来自该区实际 connection 总数；`selected` 来自状态表中已选择且非空的数量。

## Data Model

- `selectedByConnection: Record<ConnectionKey, EquipmentId | null>`
- `connectionRows: Array<{ connectionKey, slotType, groupName, size, tags, shield?, parentConnectionSize?, parentConnectionTags? }>`
- `groupRows: Array<{ groupKey, slotType, size, tags, connectionKeys[], totalCount, isShield, shieldSize?, shieldTags?, parentConnectionSize?, parentConnectionTags? }>`
- `mode: 'connection' | 'group'`

## Interaction Flow

1. 用户选船后生成 `connectionRows`。
2. 每行按过滤规则动态生成候选装备。
3. 标准模式选择：更新单个 `connectionKey`。
4. 简化模式选择：更新同 `groupKey` 下全部 `connectionKey`（主槽位与护盾分别执行）。
5. 切换 group 标签时，同步切换该标签下主槽位区与护盾区。
6. 每次更新后重算冲突状态，驱动切换按钮可用性。

## Non-Goals

- 不实现配装后属性数值计算。
- 不实现建造材料统计。
- 不实现自动推荐最佳装备。

## Risks

- tags 任意命中会放宽候选范围，可能导致候选过多，需预留搜索/排序扩展位。
- 部分装备 id 命名存在历史特例，展示层需支持兜底显示。
