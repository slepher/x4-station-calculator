# M3.2-UI 补充迁移

本轮只补现有 13 项未覆盖的有效验收，不重复 13 项或 M3.1-TRADE-DRAG 的真实拖放。

| 编号 | 当前证据 |
|---|---|
| 1.3.3 | 新文件 `1.3.3 layer来回保留完整draft，trade focus命中sector`：binding → default map → Live → binding 前后完整 groups deep-equal；颜色静态 expected `#f44e3b`；仅补测缺失的 trade focus。 |
| 2.1.3 / 2.3.3 | 新文件 `2.1.3/2.3.3 非空connected与compact/candidate focus`、`2.3.3 compact group card五类computed style相对Live保持合同` 与 `2.1.3 allocation candidate fixture先验非空，再聚焦assignment sector`：connected 为 `cluster_24_sector001_macro`，candidate 为“水星”→`cluster_106_sector001_macro`，各自点击自身 sector locator；fixture 先断言 connected/candidate/allocation 身份非空；Map/Live 同一 group card 比较五类 computed styles。 |
| 旧 3.4 | 新文件 `旧3.4与3.1.3/3.4.2 初始无色无fill且重算保留edited color`：初始 `color` 缺失时 dashed chip 和无 fill；UI 设色后走重算/重新计算，颜色按 sectorMacro 保留。 |
| 3.1.3 / 3.4.2 | 同上，使用 fixture 明确删除所有 group color，独立断言初始无色表现。 |
| 4.3.3 | 新文件 `4.3.3 row结构不包含group-title或group-name元素`：保留 sector 文本，独立断言 row 内不存在 group-title/group-name 元素。 |
| 5.1.3 | 新文件 `5.1.3 蓝图真实拖放复制完整settings`：真实 source→start→target preview→drop，独立读取 blueprint settings 并全字段比较。 |
| 6.1–6.5 | 直接引用既有 `6.1/6.2/6.3/6.4/6.5 virtual trade overlay真实拖动与跨hub拒绝` 及 M3.1-TRADE-DRAG release/persist witness；不重复真实拖放。 |

新文件使用真实 UI click 与地图 bbox 变化；蓝图事务逐段使用真实 mouse 输入，未合成事件或直接写业务状态。
