# Tasks: ship-build-equipment

## 1. 配装数据模型

- [x] 1.1 在船只建造视图建立 connection group 级别配装状态结构（单一事实源）。
- [x] 1.2 建立 `slots -> groups` 展示行与聚合行的派生数据结构。
- [x] 1.3 建立冲突判定逻辑（同 `slot.type` 多装备分配）。

## 2. 候选装备过滤

- [x] 2.1 接入 `equipments.json` 全量数据作为候选来源。
- [x] 2.2 实现 `type + size` 精确匹配过滤。
- [x] 2.3 实现 `slotTags` 全量包含（ALL）过滤（来源：`equipment.slotTags`）。
- [x] 2.4 实现 `connection.tags` 为空时的降级规则（仅 `type + size`）。
- [x] 2.5 候选装备名称改为基于 `nameId` 的 i18n 翻译。
- [x] 2.6 过滤 `noplayerblueprint=true` 的装备候选。

## 3. 配装区交互

- [x] 3.1 标准模式：支持按 connection group 单独选择装备。
- [x] 3.2 简化模式：支持按 group 聚合并批量分配装备。
- [x] 3.3 模式切换：仅切换展示，不改变已配状态。
- [x] 3.4 简化模式切换按钮：冲突时置灰，冲突解除后恢复。

## 4. UI 与可用性

- [x] 4.1 配装区按飞船 `slots` 原顺序从上到下展示。
- [x] 4.2 为切换按钮灰态提供可理解的提示文案。
- [x] 4.3 保持当前船只建造页面风格一致，避免破坏现有选船流程。
- [x] 4.4 左侧 `slotType` 按钮按飞船实际存在类型动态显示（不存在则隐藏）。
- [x] 4.5 group 标签不显示 `ALL`，使用 `L` 或 `M1/M2...` 等命名。
- [x] 4.6 同一 group 标签内同时展示主槽位区与从属护盾区。
- [x] 4.7 各区计数显示真实 `selected/total`，不使用固定 `0/1`。
- [x] 4.8 取消配装区固定高度限制，支持自然展开。
- [x] 4.9 候选区域采用标准配装组件固定实现，移除候选组件切换入口。
- [x] 4.10 候选卡片移除图片占位，改为纯文本信息展示。
- [x] 4.11 兼容性标签栏仅显示 6 标签：`standard`、`advanced`、`xenon`、`mining`、`missile`、`highpower`（隐藏其他标签）。
- [x] 4.12 白名单过滤后无标签时隐藏整条兼容性标签栏。
- [x] 4.13 兼容性标签文本改为 `slot_tags.json.nameId` 的 i18n 文本展示。
- [x] 4.14 页面兼容性标签渲染接入统一翻译入口（`UseX4I18n.ts`），移除直接显示 tag id。

## 6. 标签规则统一化（新增）

- [x] 6.1 移除 `hittable/unhittable` 标签特判，统一使用 ALL 匹配。
- [x] 6.2 移除 `integrated` 标签特判，统一使用 ALL 匹配。

## 7. Slot Tag 类型与翻译接入（新增）

- [x] 7.1 在 `x4.ts` 增加 `slot_tags.json` 对应类型定义并纳入数据约束。
- [x] 7.2 在 `UseX4I18n.ts` 增加 slot tag 翻译方法并用于兼容性标签渲染链路。

## 5. 聚合语义修正

- [x] 5.1 简化模式主槽位聚合改为 `slotType + size + tags`。
- [x] 5.2 同 size 不同 tags 的组拆分为独立聚合标签（如 `M1/M2`）。
- [x] 5.3 护盾聚合改为从属父槽位语义：`slot.size|slot.tags|shield.size|shield.tags`。
- [x] 5.4 禁止跨父槽位合并护盾，确保 `L` 与 `M` 统计互不污染。
