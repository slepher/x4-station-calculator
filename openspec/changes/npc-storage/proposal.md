## Why

当前 archive 只保存 NPC 空间站直属报价的 `ware/side/price/amount`，无法区分空间站自身需求与 `supplies` 补给需求，也会漏掉与 station 同级存放的建材仓库报价。真实存档证明，按 XML 邻近或同 zone 判断归属会把其他空间站的建材仓库错误挂到当前站点。

## What Changes

- 扩展 NPC trade offer，保留 `tradeId`、`desired` 与 `flags` 等分类和排序所需事实。
- 保留空间站自身需求、空间站补给需求以及同站同商品多条需求，不在 parser 中聚合。
- 在 parser 边界过滤缺少 `amount` 或明确标记 `amount="0"` 的买单和卖单。
- 新增 NPC station 的可选单一 `buildStorage`，包含其 component ID、code 与报价。
- 将 station 和 buildstorage 视为同级 component；通过 `station listener → buildstorage ID` 与相同 `spawntime` 唯一关联。
- 禁止使用 XML 邻近、组件栈、同 zone/sector 或第一条/最后一条 fallback 推断归属。
- NPC 卖单只取空间站直属 seller offer；预期同站同商品最多一条，异常数据仍无损保留。
- 提升 parser schema version 至 v15，使仍包含零数量报价的旧 archive 显式失效并重新导入。
- 保留既有声望/许可边界与小范围 XML 剪裁能力；不包含市场 UI。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `save-import`: 完整导入 NPC 空间站与所属建材仓库报价，提供需求分类所需字段和唯一归属关系。

## Impact

- Rust parser：`rust-parser/src/model.rs`、`rust-parser/src/core.rs` 及对应 parser checks。
- Archive 类型与版本：`src/types/saveArchive.ts`、`src/workers/saveParser.post.ts`、生成的 `src/wasm/`。
- 存档持久化：`SaveArchive` 中的 NPC station contract 新增完整报价字段和可选 `buildStorage`。
- 后续消费者可据此实现 `npc-trade-ui`；本 change 不修改 Vue、presenter 或市场排序。
