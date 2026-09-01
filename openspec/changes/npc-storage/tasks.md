## 1. Archive 数据模型

- [x] 1.1 在 Rust model 与 `src/types/saveArchive.ts` 中新增最小 `NpcTradeOffer`/`tradeOffers` 类型，字段限定为 ware、side、price、amount，并通过 Rust 编译与 TypeScript 构建确认两端 JSON 契约一致
- [x] 1.2 为 NPC station 无订单时省略 `tradeOffers`，并用序列化单测确认不会输出空数组

## 2. Rust/WASM 订单导入

- [x] 2.1 在 Rust station component context 中捕获 production buyer/seller trade，并通过 parser 单测确认 buyer→buy、seller→sell、price/100 和 amount 映射正确
- [x] 2.2 在 station owner 分类完成时只向 `NpcStationEntry` 写入 offers，并通过含普通 NPC、Xenon、Kha'ak 的单测确认 faction 分组订单不会泄漏到 `npc_stations`
- [x] 2.3 保留零数量和重复 station+ware+side 记录，并通过单测确认不执行 truthy 过滤、覆盖、求和或 fallback
- [x] 2.4 使用现有 `playerRelations`/`playerLicences` 输出，不在 parser 中新增声望过滤，并通过测试确认低声望 NPC 的报价快照仍可导入

## 3. Parser 版本与 WASM 产物

- [x] 3.1 将 Rust archive parser version 与 TypeScript `CURRENT_PARSER_VERSION` 从 v9 同步提升到 v10，并通过 archive versioning 测试确认旧 v9 archive 被判定为不匹配
- [x] 3.2 运行 `npm run build-rust` 更新 `src/wasm/`，并通过 Rust WASM save parser 定向测试确认浏览器生产入口返回 `tradeOffers`

## 4. 小范围 XML 剪裁

- [x] 4.1 扩展现有 XML relevance 规则，仅保留 production offer trade 属性及必要祖先，并通过 `extract-save-xml.spec.ts` 确认 source/reservation/construction 等噪声仍被删除
- [x] 4.2 允许 `--xml` 与 `--class station --code ...` 组合，并通过双 station 测试确认只输出指定 code
- [x] 4.3 对 `save_009.xml` 执行单站剪裁，确认 `ROK-388` 结果包含 buyer/seller 与零卖量、大小保持在小型样本范围，并确保含真实玩家元数据的输出不加入仓库

## 5. 集成验证

- [x] 5.1 运行 Rust parser 全部单测，确认既有 station、cargo、reservation、relation 与 licence 行为无回归
- [x] 5.2 运行 save-import、save-store-versioning、extract-save-xml 定向 Vitest，确认 archive 持久化与剪裁契约通过
- [x] 5.3 运行 `npm run build`、`git diff --check` 与 `npx openspec validate npc-storage --strict`，确认生产构建、格式和 OpenSpec 契约全部通过
