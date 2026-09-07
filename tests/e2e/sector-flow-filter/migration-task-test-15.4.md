# M15.4 核查记录 — 未完成

按用户要求快速结束，尚未修改spec。原3项baseline 1pass/2fail exit1，详见 `docs/plan/unified-test-repair/direct-migration/results/M15.4.md`。

| 原用例 | 当前事实与待完成映射 |
|---|---|
| 小行星星区聚合 flows 应只显示三个 station 的 planned ware 作为 surplus | 旧条件分支断言未迁移；当前Transit含Energy与Quantum0。须按live-planning-modules的recommended planned子集规则核对effective planned来源，再写精确集合及priority0排除。 |
| 单个 station flows 显示原始数据（含 auto-industry surplus） | 原包含文本断言通过，但尚未强化为products/operations精确分组；MGO quantum是运营-258，不可用其文本存在冒充auto surplus。 |
| 小行星聚合 flows 详细快照（基准数据） | 原5个计划产物数值仍出现，旧运营-28.8不出现；须区别本地与one-hop外部combined流，确认0值分组规则后独立预期。 |

新发现的有效规范：live-planning-modules（recommended已纳入planned、priority2）、live-planning-flow（canonical）、one-flow-contribution（统一分组）、sector-link-calc（一跳贡献）。旧失败未分类为产品；不新增skip、不删旧验收、不以当前实现改写规范。后续任务未启动，当前无browser进程。
