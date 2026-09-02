# NPC Storage - Tasks

## 1. 已完成的直属空间站报价基础

- [x] 1.1 在 Rust model 与 `src/types/saveArchive.ts` 中新增 NPC station `tradeOffers` 的 ware、side、price、amount 基础 contract
- [x] 1.2 捕获空间站直属 production buyer/seller trade，完成 buyer→buy、seller→sell、price/100 和 amount 映射
- [x] 1.3 保留重复 station+ware+side 记录，不执行覆盖、求和或 fallback
- [x] 1.4 将基础报价 schema 纳入 archive parser version 与 WASM 产物
- [x] 1.5 扩展按 station code 的 XML 剪裁，使直属 production offers 可用于小范围调查

## 2. 扩展完整报价 contract

- [x] 2.1 扩展 Rust `NpcTradeOffer` 与 `src/types/saveArchive.ts`，新增 `tradeId`、`desired` 和 token 化 `flags`
- [x] 2.2 将 `amount` 保存为有效报价必填事实、`desired` 保存为可选事实，且不在 parser 中互相 fallback
- [x] 2.3 保持 station 直属报价数组顺序，使普通需求、`supplies` 需求和异常重复 seller 均可检测
- [x] 2.4 使用从 `save_009.xml` 裁剪的真实完整 buy、缺 `desired` buy、缺 `amount` supplies buy 与 seller fixture 覆盖 Rust/WASM parser
- [x] 2.5 将最终 Rust archive schema 提升到 v15，使仍含零数量报价的旧 v14 archive 强制重新导入
- [x] 2.6 在 Rust parser 边界过滤缺少 `amount` 或显式 `amount=0` 的 buyer 与 seller
- [x] 2.7 使用 `save_009.xml` 中真实零数量 buyer 与 seller 片段覆盖 Rust/WASM parser

## 3. 捕获同级 buildstorage

- [x] 3.1 在 Rust parser 的最小暂存 context 中捕获 station component ID、spawntime 与 listener IDs
- [x] 3.2 独立捕获 NPC buildstorage 的 component ID、code、spawntime 与 production offers，不依赖 `current_station_ctx_mut()`
- [x] 3.3 在解析收尾阶段按 `listener ID + 相同 spawntime` 建立唯一关联
- [x] 3.4 仅在唯一匹配时设置 `NpcStationEntry.buildStorage`，零匹配或多匹配不使用 ancestry、同 zone/sector 或顺序 fallback
- [x] 3.5 不使用 `hidden end="1"` 排除 buildstorage 或其报价

## 4. Archive 输出与兼容

- [x] 4.1 在 Rust/TypeScript model 中新增可选 `NpcBuildStorageEntry`，并保证每个 NPC station 最多输出一个对象
- [x] 4.2 保持 buildstorage 报价与 station 直属报价分容器存储，不把 buildstorage 写成独立 `npc_stations` 条目
- [x] 4.3 基于合并时的当前 parser version 提升下一 schema 版本，同步 worker、WASM 与 archive compatibility contract
- [x] 4.4 保持 Xenon/Kha'ak 分组和既有 player relation/licence 输出不变

## 5. 构建验证

- [x] 5.1 运行 `npm run build-rust` 更新 `src/wasm/`；仅在本 change 修改 `rust-parser/src/*.rs` 后执行
- [x] 5.2 运行 `npm run build`，修复本 change 引入的编译错误直至通过或形成明确 blocker
