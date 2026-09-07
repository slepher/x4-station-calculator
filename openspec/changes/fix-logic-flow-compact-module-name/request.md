# 紧凑视图模块名修复

## 目标
修复本轮测试迁移复现的同 ware、不同模块节点显示同一名称问题，恢复已接受的模块身份规则。

## 已确认方案（审核重点）
- 真实节点按自身 moduleId 读取本地化模块名，不按 wareId 取组中首节点。
- 原料节点继续显示原料名称；预览节点保留有效 lineage 的模块选择语义。
- 名称展示组装由 presenter 持有，Vue 消费 presenter；不新增 store/presenter/vue 之外的层。

## 边界
- In Scope：紧凑节点名称、对应 focused Unit、本轮已有真实拖放 E2E 的复验。
- Out of Scope：组推导算法、节点身份或持久化结构、其他历史 Vue 直接 store 访问的整体重构。

## 验收标准（DoD）
1. 同组通用与 Teladi hullparts 节点分别显示自己的模块名称。
2. raw 与 preview 既有命名语义保持正确。
3. focused Unit 红绿证据、构建及原 M5.2 复现用例通过，其他不相关失败不计入本修复。

## 未决项
无；这是已有明确规范的回归修复，属于用户授权的真实产品问题处理范围。
