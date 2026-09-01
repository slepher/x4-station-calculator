# Save Import Specification

## Purpose

定义 NPC 空间站及其所属建材仓库报价的无损导入、分类事实、唯一归属和 archive 兼容契约。

## ADDED Requirements

### Requirement: Complete NPC Trade Offer Import

系统 SHALL 从存档快照导入 NPC 报价，并保存订单身份、方向、价格、数量、目标数量和 flags。

#### Scenario: 导入 NPC 买单

**前提** NPC station 或已唯一关联的 buildstorage 中存在带 buyer 的 production trade
**当** parser 导入该 trade
**那么** 对应报价的 `side` MUST 为 `buy`
**并且** 报价 MUST 保存 `tradeId`、ware ID、price、amount、desired 和 flags

#### Scenario: 导入 NPC 卖单

**前提** NPC station 中存在带 seller 的 production trade
**当** parser 导入该 trade
**那么** 对应报价的 `side` MUST 为 `sell`
**并且** 报价 MUST 保存到空间站直属 `tradeOffers`

#### Scenario: 价格归一化

**前提** XML trade 的整数 `price` 为 `53900`
**当** parser 写入 archive
**那么** 对应报价的 `price` MUST 为 `539`

#### Scenario: 保留零数量与缺省差异

**前提** 报价包含 `amount="0"`
**当** parser 导入该报价
**那么** 系统 MUST 保留 `amount=0`
**并且** 系统 MUST NOT 将零解释为缺失字段

#### Scenario: 保留同站同商品多条报价

**前提** 同一 holder 对同一 ware 和 side 存在多条 trade
**当** parser 写入 archive
**那么** 系统 MUST 按存档顺序保留全部记录
**并且** 系统 MUST NOT 覆盖、求和或选择第一条/最后一条 fallback

### Requirement: Station Demand Classification Facts

系统 SHALL 保留足以区分空间站自身需求、空间站补给需求和建材仓库需求的 holder 层级与 flags。

#### Scenario: 空间站自身需求

**前提** 空间站直属 buy offer 的 flags 不包含 `supplies`
**当** 消费层分类该报价
**那么** 该报价 MUST 被识别为空间站自身需求

#### Scenario: 空间站补给需求

**前提** 空间站直属 buy offer 的 flags 包含 `supplies`
**当** 消费层分类该报价
**那么** 该报价 MUST 被识别为空间站补给需求
**并且** 同商品的空间站自身需求 MUST 可同时存在

#### Scenario: 建材仓库需求

**前提** buy offer 位于已关联的 `NpcStationEntry.buildStorage.tradeOffers`
**当** 消费层分类该报价
**那么** 该报价 MUST 被识别为所属空间站的建材仓库需求
**并且** buildstorage MUST NOT 被展示为独立 NPC 空间站

#### Scenario: 空间站出售单基数异常

**前提** 原始存档对同一空间站和 ware 出现多条直属 seller offer
**当** parser 导入这些报价
**那么** 系统 MUST 保留全部原始记录
**并且** 系统 MUST NOT 通过 map 覆盖伪造成单条报价

### Requirement: Unique NPC Build Storage Association

系统 SHALL 将 XML 中与 station 同级的 buildstorage 唯一关联到所属 NPC 空间站，并保证每站最多一个输出对象。

#### Scenario: listener 与 spawntime 唯一匹配

**前提** station listener 引用某 buildstorage component ID
**并且** station 与 buildstorage 的 spawntime 相同
**并且** 该匹配对 station 和 buildstorage 均唯一
**当** parser 完成跨组件关联
**那么** station 的 `buildStorage` MUST 保存该 buildstorage 的 component ID、code 和 tradeOffers

#### Scenario: 禁止按 XML 位置归属

**前提** buildstorage 与 station 位于同一 zone 或 XML 中相邻
**但是** listener 与 spawntime 两条件不同时成立
**当** parser 解析该 buildstorage
**那么** 系统 MUST NOT 将其附加到该 station

#### Scenario: 匹配不唯一

**前提** station 对 buildstorage 的两条件匹配结果不是唯一一条
**当** parser 生成 `NpcStationEntry`
**那么** 系统 MUST NOT 为该 station 设置猜测的 `buildStorage`
**并且** 系统 MUST NOT 使用同 sector、同 zone、第一条或最后一条 fallback

#### Scenario: WUX-704 真实归属

**前提** 输入包含 WUX-704、WDU-404、TQC-894 和 PRN-974 的已确认关系字段
**当** parser 建立 buildstorage 归属
**那么** WDU-404 MUST 归入 WUX-704
**并且** TQC-894 MUST 归入 OXQ-033
**并且** PRN-974 MUST 归入 OGE-538

#### Scenario: hidden 字段不决定有效性

**前提** buildstorage 包含 `hidden end="1"`
**当** parser 判断是否导入及关联其报价
**那么** 系统 MUST NOT 仅凭该字段排除 buildstorage

### Requirement: NPC Trade Offer Archive Compatibility

包含完整报价和 buildStorage 的 archive SHALL 使用新的 parser schema version。

#### Scenario: 旧 archive 需要重新导入

**前提** 已保存 archive 的 parser version 早于完整 NPC 报价 schema
**当** 系统加载该 archive
**那么** 系统 MUST 将其标记为 parser version 不匹配
**并且** 系统 MUST NOT 为缺失字段提供伪造 fallback

#### Scenario: 空集合保持紧凑

**前提** NPC station 没有直属报价或没有唯一关联的 buildstorage
**当** 系统序列化 archive
**那么** 系统 SHALL 省略对应可选字段
**并且** 系统 MUST NOT 输出空对象占位

### Requirement: NPC Offer Scope Boundary

系统 SHALL 保持 NPC 报价事实与 faction 分组、玩家成交资格相互独立。

#### Scenario: 排除非 NPC 分组

**前提** Xenon 或 Kha'ak station 包含 trade offer
**当** parser 完成 owner 分类
**那么** 该 station MUST 保持原 faction station 分组
**并且** 其报价 MUST NOT 出现在 `npc_stations` 中

#### Scenario: 声望资格由消费层判断

**前提** NPC offer 已被导入 archive
**当** 玩家关系或许可不足
**那么** parser MUST 仍保留该报价快照
**并且** 当前成交资格 MUST 由消费层使用既有关系与许可数据判断

### Requirement: Scoped NPC Trade XML Extraction

XML 剪裁 CLI SHALL 继续支持按 station code 输出包含直属 live offers 的小范围结果。

#### Scenario: 组合 XML 与 station 过滤参数

**前提** 用户传入 `--xml --class station --code <station-code>`
**当** CLI 剪裁存档
**那么** 输出 MUST 包含匹配 station 的属性、位置和直属 production trade offers
**并且** 输出 MUST NOT 包含其他 station code 的捕获结果

#### Scenario: 剪裁订单噪声节点

**前提** trade offer 下包含 source、reservation、event 或其他非订单字段
**当** CLI 生成剪裁结果
**那么** 输出 SHALL 保留 buyer/seller、ware、price、amount、desired 和 flags 属性
**并且** 输出 MUST NOT 因保留 offer 而保留无关完整状态
