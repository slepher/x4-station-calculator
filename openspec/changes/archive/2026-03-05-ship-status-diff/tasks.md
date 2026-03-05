# Tasks: ship-status-diff

## 1. 预演通路与数据模型

- [x] 1.1 在 Ship Build 视图层新增预演状态（`targetBlueprint` 或等价对象）并建立生命周期重置逻辑。
- [x] 1.2 实现纯计算预演构造函数，输入当前蓝图与替换参数，输出蓝图副本。
- [x] 1.3 为预演路径补齐 shield key（4 段/5 段）兼容映射，确保与正式赋值规则一致。

## 2. 模式分支替换策略

- [x] 2.1 实现 connection 模式单槽位替换预演。
- [x] 2.2 实现 group 模式按数量替换同类槽位（容量分摊后逐 key 写入/清空）。
- [x] 2.3 在高亮为空、picker 关闭、切换飞船时清空预演结果，避免残留 target。

## 3. Stats 面板接入

- [x] 3.1 扩展 `ShipBuildPanelStats` 输入，支持接收 `targetBlueprint`（可空）。
- [x] 3.2 基于 current/target 双蓝图生成两组指标 map，并向 `MetricsPanel` 传递 `objCurrent/objTarget`。
- [x] 3.3 保持 summary/detail 过滤与已有布局行为不变。

## 4. 回归与构建

- [x] 4.1 自检“仅预演不提交”约束：高亮阶段不改动正式 `blueprint`。
- [x] 4.2 自检“确认提交后生效”约束：确认动作仍走正式赋值路径。
- [x] 4.3 执行 `npm run build` 并修复编译问题直至通过。
