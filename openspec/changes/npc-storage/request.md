# NPC Storage

## 目标

扩展 NPC 报价存档契约，使系统能够无歧义地区分空间站自身需求、空间站补给需求和所属建材仓库需求，并保留后续市场排序所需的订单身份、数量与标记。

同时修正建材仓库归属认知：`station` 与 `buildstorage` 是 XML 中的同级 component，不能按 XML 邻近、组件栈或所在 zone 归属；系统必须通过存档中的稳定交叉引用唯一关联。

## 已确认方案（审核重点）

### 1. 报价原始事实

1. 每条有效报价保存 `tradeId`、`ware`、`side`、`price`、`amount` 和 `flags`；`desired` 按 XML 是否存在保存为可选原始事实。
2. XML `buyer` 映射为 `side="buy"`，表示 NPC 收购；XML `seller` 映射为 `side="sell"`，表示 NPC 出售。
3. 存档整数价格在 parser 边界除以 100，与静态 ware 价格使用同一单位。
4. 缺少 `amount` 或明确包含 `amount=0` 的 buyer 与 seller 均不进入 archive。
5. parser 保留原始报价数组，不按 ware 覆盖、求和或选择第一条/最后一条 fallback。
6. seller 或普通 buy 缺少 `desired` 不得导致整条报价被丢弃；parser 不使用 `desired` 补充 `amount`。

### 2. 空间站需求分类

6. 空间站直属买单且 `flags` 不含 `supplies` 时，属于“空间站自身需求”。
7. 空间站直属买单且 `flags` 含 `supplies` 时，属于“空间站补给需求”。
8. 同站同商品的上述两类需求可以同时存在，不视为需要去重的重复数据。
9. 建材仓库买单属于“建材仓库需求”，并归入其所属 NPC 空间站。
10. NPC 出售单只来自空间站直属 seller offer；同站同商品预期最多一条。若未来存档违反该约束，parser 仍须保留事实，不得静默覆盖。

### 3. 建材仓库归属

11. `buildstorage` 不是 `station` 的 XML 子节点；两者位于 sector/zone 下各自的 connection 中。
12. 唯一归属规则为：空间站 listener 引用建材仓库 component ID，并且双方 `spawntime` 相同。
13. 一个 NPC 空间站最多输出一个 `buildStorage`。
14. 只有唯一匹配时才建立关系；零匹配或多匹配不得使用 XML 邻近、同 zone、同 sector、第一条或最后一条作为 fallback。
15. `hidden end="1"` 不作为排除建材仓库或报价的依据。
16. 已核实样例：`WDU-404 → WUX-704`、`TQC-894 → OXQ-033`、`PRN-974 → OGE-538`。

### 4. Archive 结构

17. `NpcStationEntry.tradeOffers` 保存空间站直属报价。
18. `NpcStationEntry.buildStorage` 为可选单对象，保存建材仓库的 component ID、code 和报价数组。
19. 建材仓库继承所属空间站的 sector、阵营与种族上下文，不作为独立 NPC 空间站候选。
20. 新 contract 必须提升 parser schema version；旧 archive 必须重新导入，不允许 fallback 为“无建材仓库/无分类字段”。

### 5. 资格与范围

21. 报价快照与玩家成交资格分离；parser 不根据声望或许可删除报价。
22. Xenon、Kha'ak 等现有独立 station 分组不进入 `npc_stations` 报价集合。
23. 本 change 只提供 archive 事实与归属关系，不实现市场报价 UI、排序或舰船匹配。

## 边界

### In Scope

- 扩展 NPC trade offer archive 字段
- 分类空间站自身需求与补给需求所需的 `flags`
- 导入并唯一关联 NPC 建材仓库报价
- 过滤缺少数量或零数量的买卖单，保留重复需求和非零异常卖单事实
- 更新 parser schema version 与 archive 类型
- 保留既有小范围 XML 剪裁能力

### Out of Scope

- 市场报价页面、presenter 和排序
- 玩家舰船解析与可用性判断
- 声望、许可和实际成交判断
- 自动交易、路线规划和船只分配
- 用 XML 邻近或空间位置猜测建材仓库归属

## 验收标准（DoD）

1. 空间站直属报价包含完整订单身份、`desired` 与 `flags`。
2. 普通买单和 `supplies` 买单可被稳定区分并同时保留。
3. `WDU-404` 唯一归入 `WUX-704`，不会误归入同 zone 的其他 buildstorage。
4. `TQC-894` 和 `PRN-974` 分别归入 `OXQ-033` 和 `OGE-538`，不会归入 WUX-704。
5. 任一 NPC 空间站输出的 `buildStorage` 基数为 0 或 1。
6. 建材仓库报价不会因其与 station 同级而被现有 component stack 逻辑漏掉。
7. 缺少数量或零数量的买卖单不会进入 archive，同站同商品的非零多条需求仍无损保留。
8. 旧 archive 因 parser schema 不匹配而要求重新导入。
9. 生产构建通过，且未引入市场 UI。

## 未决项

无。
