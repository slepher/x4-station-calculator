# 需求说明：ship-status-diff

## 目标
在 Ship Build 配装过程中，当用户在候选列表中选中（高亮）某个模块时，实时预演“替换后”的整船属性差异。
预演结果不写入当前蓝图，仅作为 `PanelStatus`（当前实现为 `ShipBuildPanelStats`）的 `targetObject` 对比输入。

## 已确认方案（审核重点）
1. 触发时机
   - 触发源为候选模块高亮变化（`highlightedEquipmentId`），而非确认提交。
   - 取消高亮、关闭 picker、切换飞船时，预演目标自动清空。
2. 普通模式替换策略（connection）
   - 仅对当前选中槽位（当前 `connectionKey`）执行替换预演。
   - 仅更新预演蓝图，不改变 store 中正式 `blueprint`。
3. 简化模式替换策略（group）
   - 需按“数量”替换同类槽位的全部模块位。
   - 以当前目标槽位的聚合总数作为替换数量，在同类 `connectionKeys` 上按容量分摊。
   - 分摊后 count > 0 的连接使用候选模块；count = 0 的连接清空。
4. 数据通路
   - 由页面层基于“当前蓝图 + 预演替换规则”构造 `targetBlueprint`。
   - `ShipBuildPanelStats` 同时计算 current 与 target 两组指标，并向 `MetricsPanel` 传入 `objCurrent/objTarget`。
5. 业务一致性
   - shield key（4 段/5 段）解析规则与正式赋值路径保持一致。
   - 预演逻辑必须为纯计算，不得触发持久化、不得污染当前编辑态。

## 边界
### In Scope
- 新增/抽取预演蓝图构造能力（纯函数或 store 纯计算 API）。
- 在 `ShipBuildPanelStats` 接入 `targetBlueprint` 计算并展示差异。
- connection/group 两种模式下的替换规则（含“简化模式按数量替换”）。
- 同步更新对应测试文档（`test_tasks.md`、`ui_knowledge.md`）。

### Out of Scope
- 不改变确认提交后的正式装配逻辑。
- 不改动装备候选过滤规则（race/mk/tag）。
- 不扩展新的属性字段，仅复用现有 stats 计算字段。

## 验收标准（DoD）
1. 高亮候选模块后，Stats 面板出现 current vs target 对比；取消高亮后 target 消失。
2. 普通模式下，仅当前槽位参与预演替换，其他槽位保持不变。
3. 简化模式下，同类槽位按聚合数量完成替换预演，并正确反映到 stats 差异。
4. 预演全过程不修改正式 `blueprint`，仅确认动作才会提交真实变更。
5. 切换飞船/关闭 picker 后不会残留上一轮 targetObject。

## 未决项
无。
