# UI Knowledge: ship-build-equipment

## 页面区域与交互实体

- 上游入口：`ship-build` 视图内已选船状态。
- 配装区主体：建议新增独立容器 testid，例如 `ship-build-fit-panel`。
- 模式切换控件：建议 `ship-build-fit-mode-toggle`。
- 左侧 `slotType` 切换：建议 `ship-build-slot-type-tab-*`（仅渲染当前船存在类型）。
- group 标签：建议 `ship-build-group-tab-*`（不使用 `ALL`，显示 `L` 或 `M1/M2...`）。
- 标准模式行：建议 `ship-build-connection-row-*`（行内含主槽位区 + 护盾区）。
- 简化模式行：建议 `ship-build-group-row-*`（标签内含主槽位区 + 护盾区）。
- 候选下拉：建议 `ship-build-equipment-select-*`。
- 切换禁用提示：建议 `ship-build-fit-mode-disabled-reason`。

## 状态语义（供自动化与调试）

- `mode=connection`：按 connection group 展示与赋值。
- `mode=group`：按 group 聚合展示与批量赋值。
- 候选视图：固定为 Arsenal 单一实现，不存在候选视图切换状态。
- 候选视图名称：使用标准化后的唯一名称。
- `selectedByConnection`：单一真实状态源。
- `hasTypeConflict=true`：同一 `slot.type` 存在多装备分配，简化切换应禁用。

## 聚合语义（关键）

- 主槽位聚合键：`slotType | size | tags`。
- 同 `slotType + size` 但 `tags` 不同必须拆分为不同聚合标签（如 `M1/M2`）。
- 护盾从属于父主槽位，不是独立顶层分组。
- 护盾聚合键：`slotType | slot.size | slot.tags | shield.size | shield.tags`。
- 护盾聚合输入范围：仅来自当前主槽位标签对应的 connection keys 派生 shield keys，不可跨标签全量收集。

## 候选过滤语义

- 数据源：`equipments.json` 全量。
- 必选约束：`type`、`size` 精确匹配。
- 排除规则：`noplayerblueprint=true` 的装备不参与候选。
- 标签规则：`equipment.slotTags` 与 `connection.tags` 任意一条命中即可。
- 特殊标签：当 `connection.tags` 含 `hittable/unhittable` 时，除命中该标签外还需命中至少一个其他标签；`hittable` 与 `unhittable` 互斥不匹配。
- 例外：`connection.tags` 为空时，不做标签约束。
- shield 不再使用 `integrated` 特例命中规则。
- 名称规则：候选装备名称通过 `equipment.nameId` i18n 翻译生成。

## Web 断言建议

- 模式切换前后断言：
  - 列表形态变化（connection 行 <-> group 行）。
  - 同一 connection 的已配装备值不变。
- 标签断言：
  - 标准模式校验 `L`/`M1...` 标签命名。
  - 简化模式校验同 size 不同 tags 拆分标签。
- 护盾从属断言：
  - 在同一标签内同时可见主槽位区与护盾区。
  - `L`/`M` 标签的护盾计数互不污染（例如 `1` vs `6`）。
- 冲突灰态断言：
  - 在构造冲突后断言 toggle disabled。
  - 断言禁用提示文案可见。
- 候选过滤断言：
  - 读取候选项并验证 type/size/slotTags 规则。
  - 验证 `noplayerblueprint=true` 的装备被排除。
  - `hittable/unhittable` 需额外标签命中，互斥不匹配。
  - shield 无 `integrated` 特例。
- 计数断言：
  - 各区显示真实 `selected/total`，不得固定 `0/1`。
- 卡片结构断言：
  - 候选卡片不含图片占位，仅包含名称与元信息文本。

## 与 test_tasks 对齐说明

- `test_tasks.md` 的状态项与切换项使用本文件的模式语义。
- `test_tasks.md` 的聚合与计数场景基于本文件“聚合语义（关键）”章节实现。
- 本次变更未涉及 `tests/fixtures/ware_fixtures.yaml` 与 `module_fixtures.yaml` 的产品/模块映射要求。
