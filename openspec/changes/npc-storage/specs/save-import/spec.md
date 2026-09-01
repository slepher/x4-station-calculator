## ADDED Requirements

### Requirement: NPC Station Trade Offer Import

系统 SHALL 从存档快照导入 NPC 空间站的 live trade offers，并在对应 `npc_stations` 条目中以 `tradeOffers` 数组保存 `ware`、`side`、`price` 和 `amount`。

#### Scenario: 导入 NPC 买单

- **WHEN** `npc_stations` 空间站的 production offers 中存在带 `buyer`、`ware`、`price` 和 `amount` 的 trade
- **THEN** 对应空间站的 `tradeOffers` SHALL 新增一项 `side="buy"`
- **AND** 该项 SHALL 保存原始 ware ID 和 amount

#### Scenario: 导入 NPC 卖单

- **WHEN** `npc_stations` 空间站的 production offers 中存在带 `seller`、`ware`、`price` 和 `amount` 的 trade
- **THEN** 对应空间站的 `tradeOffers` SHALL 新增一项 `side="sell"`
- **AND** 该项 SHALL 保存原始 ware ID 和 amount

#### Scenario: 报价价格与静态 ware 使用同一单位

- **WHEN** XML trade 的整数 `price` 为 `53900`
- **THEN** archive 中对应 trade offer 的 `price` SHALL 为 `539`
- **AND** 该数值尺度 SHALL 与静态 `X4Ware.price` 一致

#### Scenario: 保留零数量报价

- **WHEN** NPC 卖单包含 `amount="0"`
- **THEN** 系统 SHALL 保留该卖单及其零数量
- **AND** 系统 MUST NOT 把零数量解释为字段缺失

#### Scenario: 保留重复方向报价

- **WHEN** 同一空间站对同一 ware 和 side 存在多条 trade offer
- **THEN** 系统 SHALL 按存档顺序保留全部记录
- **AND** parser MUST NOT 按 ware 或 side 覆盖、求和或选择 fallback

#### Scenario: 排除非 NPC 分组的订单

- **WHEN** Xenon 或 Kha'ak 空间站在原始 XML 中包含 trade offer
- **THEN** 该空间站 SHALL 继续归入原有 faction station 分组
- **AND** 其报价 MUST NOT 出现在任何 `npc_stations[*].tradeOffers` 中

#### Scenario: 声望资格与订单快照分离

- **WHEN** 系统导入属于 `npc_stations` 的 live offer
- **THEN** parser SHALL 保留该报价快照，不根据当前声望删除报价
- **AND** 当前成交资格 SHALL 由既有 player relation、licence 与 faction 静态数据在消费阶段判断

### Requirement: NPC Trade Offer Archive Compatibility

包含 NPC trade offers 的 archive SHALL 使用新的 parser version，缺少该字段契约的旧 archive 不得被当作当前版本数据继续使用。

#### Scenario: 旧 archive 需要重新导入

- **WHEN** 已保存 archive 的 parser version 早于 NPC trade offer schema
- **THEN** 系统 SHALL 将该 archive 标记为 parser version 不匹配
- **AND** 用户重新导入原始存档后 SHALL 得到包含 `tradeOffers` 的新 archive

#### Scenario: 空订单不输出空数组

- **WHEN** 某个 NPC 空间站没有可提取的 production offer
- **THEN** 序列化 archive SHALL 省略 `tradeOffers`
- **AND** 系统 MUST NOT 输出空数组占位

### Requirement: Scoped NPC Trade XML Extraction

XML 剪裁 CLI SHALL 支持按 station code 生成包含 live trade offers 的小范围结果，避免把完整存档作为测试或调查输入。

#### Scenario: 组合 XML 与 station 过滤参数

- **WHEN** 用户同时传入 `--xml --class station --code <station-code>`
- **THEN** 输出 SHALL 包含匹配空间站的 station 属性、位置和 production trade offers
- **AND** 输出 MUST NOT 包含其他 station code 的捕获结果

#### Scenario: 剪裁订单噪声节点

- **WHEN** 目标 trade offer 下还包含 source、reservation、event 或其他非订单字段
- **THEN** 输出 SHALL 保留 buyer/seller、ware、price、amount、desired 和 flags 属性
- **AND** 输出 MUST NOT 因保留 offer 而保留无关的完整 station 内部状态

