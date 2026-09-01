## Why

存档驱动规划器目前只能看到 NPC 空间站及其类型，无法读取存档快照中的实时买卖报价和可交易数量，因此不能判断玩家可以向哪些 NPC 出售盈余或采购缺口。原始 `save_009.xml` 接近 1 GiB，也需要可重复的小范围剪裁方式来验证订单导入。

## What Changes

- 在 Rust/WASM 生产解析链中提取 NPC 空间站的 live trade offers，包括 ware、买卖方向、价格和数量。
- 将 XML 的 `buyer` 映射为 NPC 买单，将 `seller` 映射为 NPC 卖单，并把存档整数价格除以 100 后与静态 ware 价格保持同一单位。
- 订单以数组保留，不在 parser 中按 ware 聚合或覆盖重复项；数量为 0 的报价仍然保留。
- 仅把订单附加到现有 `npc_stations` 条目；Xenon、Kha'ak 等独立分组即使原始 XML 含报价，也不进入 NPC 订单集合。
- 复用现有 `playerRelations`、`playerLicences` 与 faction 静态数据；本 change 不新增声望解析，也不在 parser 中判断当前成交资格。
- 扩展 XML 剪裁 CLI，使 `--xml` 可与 `--class station --code ...` 组合，并保留目标站点的 live offers，以生成小型验证样本。
- 提升 parser version，使缺少 NPC 订单字段的旧 archive 失效并重新导入。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `save-import`: 增加 NPC 空间站 live trade offer 的 Rust/WASM 导入契约，以及面向小型验证样本的 XML 剪裁行为。

## Impact

- Rust parser：`rust-parser/src/model.rs`、`rust-parser/src/core.rs`、`rust-parser/src/tests.rs`。
- Archive 类型与版本：`src/types/saveArchive.ts`、`src/workers/saveParser.post.ts`、生成的 `src/wasm/`。
- 剪裁工具与测试：`src/workers/saveParser.worker.ts`、`scripts/extract_save.tsx`、`tests/unit/save-import/extract-save-xml.spec.ts`。
- 持久化的 `SaveArchive` JSON 将新增 NPC station orders 字段；不新增依赖，不包含 UI 改动。
