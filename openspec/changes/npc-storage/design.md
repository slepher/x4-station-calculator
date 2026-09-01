## Context

生产存档导入使用 `saveParserRust.worker.ts → Rust/WASM parser → postProcessRustSaveArchive → SaveStore`。Rust archive 已按 owner 将 station 分为 `player_stations`、`npc_stations`、`xenon_stations` 和 `khaak_stations`，并已提取 `playerRelations` 与 `playerLicences`；当前 `NpcStationEntry` 尚未保存 station 的 `<trade><offers><production>`。

旧 TypeScript parser 不是生产导入入口，但它仍为 CLI 的 XML 流式剪裁提供结构判断。现有剪裁输出约 2.21 MiB；保留全部 station offers 后约 5.48 MiB，按单个 `ROK-388` station 过滤后为 11,180 bytes。

## Goals / Non-Goals

**Goals:**

- 在生产 Rust parser 中一次性捕获 NPC station 的买卖报价快照。
- 让 archive 的价格尺度与静态 ware 数据一致，并保留零值和重复记录。
- 复用现有 station owner 分组、关系数据和 archive 持久化链。
- 提供无需提交完整真实存档的小范围 XML 调查与测试数据来源。

**Non-Goals:**

- 不新增 UI、presenter 或规划算法。
- 不在 parser 中聚合同 ware 的买卖报价。
- 不重新实现声望、许可或 faction 分类。
- 不把旧 TypeScript parser 恢复为生产业务解析器。
- 不把包含玩家名称、GUID、资金等真实元数据的剪裁结果直接提交为 fixture。

## Decisions

### 1. 在 NPC station 上保存判别联合数组

Archive 新增最小结构 `tradeOffers?: Array<{ ware, side, price, amount }>`，其中 `side` 仅为 `buy | sell`。XML 的 `buyer` 表示 NPC 买入，`seller` 表示 NPC 卖出。

数组能无损保留同一 station、ware、side 的多条记录；在 parser 中转换成四列或 map 会引入覆盖规则，并把 UI/规划器的聚合责任错误地下沉到 store 数据源。`id`、`flags` 和 `desired` 暂不进入 archive，因为当前规划需求只消费方向、价格和当前数量。

备选方案是按 ware 保存 `{ buyPrice, buyAmount, sellPrice, sellAmount }`，但它无法定义重复报价的无损行为，因此不采用。

### 2. 只修改 Rust/WASM 业务解析链

在 Rust station component context 中暂存 offers；只捕获 station 直属路径下、同时具有 ware/price/amount 且具有 buyer 或 seller 的 production trade 节点。station 关闭并完成 owner 分类时，仅把暂存 offers 移入 `NpcStationEntry`。

Xenon/Kha'ak 原始 XML 即使存在 offer，也不会获得 NPC offer 字段。旧 TypeScript parser 只扩展 XML 剪裁的节点保留规则，不新增 archive 业务字段，继续满足既有 parser capability boundary。

### 3. 在 parser 边界归一化价格

存档报价使用百分之一货币单位，而静态 `X4Ware.price` 使用正常游戏货币单位。Rust parser 将合法整数 price 除以 100 后写入 archive；这样所有消费者只处理一种价格尺度，不需要重复转换。

非法或缺少必要属性的 trade 不生成部分对象。`amount=0` 是合法快照，必须保留。

### 4. 报价存在性与当前成交资格分离

`tradeOffers` 表达存档中可见的订单快照，不表达玩家当前是否满足声望或许可条件。需要成交资格时，消费逻辑复用 `playerRelations`、`playerLicences` 与 faction 静态数据；parser 不复制该业务判断，也不删除低声望 faction 的快照。

### 5. 剪裁 CLI 复用现有流式过滤器

`--xml` 与现有 `--class/--code` 参数组合使用。过滤器仅把 production offer 的 trade 节点标记为 relevant，现有 ancestor propagation 自动保留 `<trade><offers><production>` 路径；source、reservation、construction 和事件等节点继续被丢弃。

真实剪裁结果只用于核对字段和形成测试样例。Rust 回归测试使用匿名、极小的 inline XML，避免把真实玩家元数据或 11 KiB 样本纳入仓库。

### 6. Parser schema 升级而非 post-process 升级

NPC offers 是 Rust parser 输出 schema 的新增字段，因此 Rust archive version 与 TypeScript `CURRENT_PARSER_VERSION` 同步从 v9 提升到 v10。没有新增 post-process 派生行为，`CURRENT_POST_PROCESSOR_VERSION` 保持不变。

## Risks / Trade-offs

- [存档报价在游戏继续运行后会过期] → 将字段定义为导入时快照，规划结果显示重新导入触发条件。
- [重复报价的业务含义尚未完全确认] → parser 无损保留数组，推迟聚合规则到实际消费者。
- [保留所有 station offers 使默认剪裁从约 2.21 MiB 增至 5.48 MiB] → 调查和样例生成使用 station code 过滤，单站约 11 KiB。
- [price 除以 100 的约定可能被未来存档版本改变] → 用真实数量级样例和 Rust 单测固定当前版本契约，游戏版本升级时重新验证。
- [旧 archive 没有 tradeOffers] → parser version 升级使其显式失效，不用 fallback 伪装为空订单。

## Migration Plan

1. 先更新 Rust model/core/tests 与 TypeScript archive 类型。
2. 同步提升 parser version，并重新构建 `src/wasm/`。
3. 运行 Rust parser、save-import、archive versioning 和 XML 剪裁的定向测试。
4. 用单站剪裁结果核对 buyer/seller、价格尺度、零数量和 Xenon 排除。
5. 旧 v9 archive 保留在存储中但显示版本不匹配；用户重新导入原始存档生成 v10 数据。

回滚时恢复 v9 parser schema/version 和对应 WASM 产物；新增字段仅为附加数据，不需要迁移用户规划或 SaveBinding。
