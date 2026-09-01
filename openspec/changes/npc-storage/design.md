# npc-storage 设计文档

## Context

生产导入链为 `saveParserRust.worker.ts → Rust/WASM parser → postProcessRustSaveArchive → SaveStore`。现有实现只在 component stack 中寻找最近的 `class="station"`，因此能捕获空间站直属报价，但无法捕获 sector/zone 下与 station 同级的 buildstorage 报价。

真实 `save_009.xml` 给出以下结论：

- 空间站直属 NPC 买单存在 80 组同站同商品多报价；这些组合均为同一 buyer，但普通需求与 `flags="supplies"` 补给需求并存。
- 空间站直属 seller offer 在该快照中没有同站同商品重复。
- `WUX-704` 的当前建材仓库是 `WDU-404`；同 zone 出现的 `TQC-894`、`PRN-974` 实际分别属于 `OXQ-033`、`OGE-538`。
- 全存档中，具备可匹配字段的 buildstorage 有 838 个按 listener 与相同 spawntime 唯一匹配 station，未发现一站多仓。

## Goals / Non-Goals

**Goals:**

- 无损保存需求分类和后续排序所需的报价事实。
- 捕获与 station 同级的 NPC buildstorage 报价。
- 以唯一、可验证的跨组件关系将 buildstorage 归入 station。
- 保证一个 station 的 archive 输出最多一个 buildStorage。

**Non-Goals:**

- 不实现市场报价 UI、排序、分组和综合评分。
- 不按成交资格过滤报价。
- 不从 zone/sector 距离或 XML 顺序猜测归属。
- 不把 buildstorage 作为独立 NPC station 输出。

## Decisions

### 1. 保存完整报价事实，不在 parser 中生成 UI 排序结构

`NpcTradeOffer` 扩展为：

```ts
interface NpcTradeOffer {
  tradeId: string
  ware: string
  side: 'buy' | 'sell'
  price: number
  amount: number
  desired: number
  flags: string[]
}
```

`flags` 使用拆分后的稳定 token 数组，避免每个消费者重复解析 `supplies|invertfactionrestriction`。空 flags 输出空数组；`desired` 按存档原值保存，不能用 `amount` fallback。

该结构只表达 archive 事实。空间站自身需求与补给需求由直属 buy offer 是否包含 `supplies` 判定；parser 不生成 UI 专用的排序分数或展示标签。

### 2. 在 station 下保存单一 buildStorage 对象

```ts
interface NpcBuildStorageEntry {
  componentId: string
  code: string
  tradeOffers?: NpcTradeOffer[]
}

interface NpcStationEntry {
  tradeOffers?: NpcTradeOffer[]
  buildStorage?: NpcBuildStorageEntry
}
```

空间站直属报价与建材仓库报价保持两个明确容器。这样来源由领域层级表达，不需要给每条报价重复添加 holder 类型，也不会把建材仓库伪装成独立空间站。

### 3. buildstorage 采用跨组件两条件唯一关联

解析过程中暂存：

- station：component ID、spawntime、listener component IDs
- buildstorage：component ID、code、spawntime、trade offers

universe 关闭或具备完整索引后，建立匹配：

```text
station.listeners contains buildstorage.componentId
AND station.spawntime == buildstorage.spawntime
```

只有结果唯一时才设置 `NpcStationEntry.buildStorage`。匹配为零或多于一条时不建立关系，且不得使用 XML 邻近、component ancestry、同 zone、同 sector、第一条或最后一条补位。

`hidden end="1"` 不进入归属或有效性条件；截图与对应报价证明该字段不能被简单解释为“当前不可交易”。

### 4. 报价分类与基数约束

对 station 直属报价：

- `side="buy"` 且 flags 不含 `supplies`：空间站自身需求。
- `side="buy"` 且 flags 含 `supplies`：空间站补给需求。
- `side="sell"`：空间站出售单。

对 buildStorage 报价：

- `side="buy"`：建材仓库需求。
- seller offer 不转为空间站出售单；若未来出现则保留在 buildStorage 原始报价中，交由消费层显式处理异常。

同站同商品 seller offer 的当前数据不重复，但 parser 仍使用数组保持无损；不得通过 map 覆盖来强造“只有一条”。

### 5. 价格、零值与资格边界保持不变

price 在 parser 边界除以 100。`amount=0` 保留。报价存在性不等同于玩家可成交性；声望、许可和 faction 静态信息继续由消费阶段处理。

### 6. Schema 升级与并行 change 协调

完整报价和 buildStorage 都改变 Rust archive schema，因此实现时将 `CURRENT_PARSER_VERSION` 提升到下一版本。若 `save-player-ships` 已先提升版本，本 change 基于合并后的当前版本只再提升一次，不回退或复用旧版本号。

旧 archive 必须重新导入；不得通过 `desired=amount`、`flags=[]` 或 `buildStorage=undefined` fallback 冒充新 contract。

## Risks / Trade-offs

- [部分历史 buildstorage 无法唯一匹配] → 不附加到任何 station，避免错误归属；不使用空间位置 fallback。
- [未来存档可能出现同站多仓或重复 seller] → 保留原始事实并使异常可检测，不静默覆盖。
- [需要跨组件暂存，不能在 station 关闭时立即完成] → 在 parser 内建立最小 ID 索引，universe 收尾时一次关联。
- [flags contract 扩大 archive] → 仅保存报价节点已有 token，不复制 source/event 等无关 XML。

## Migration Plan

1. 扩展 Rust/TypeScript archive model 和 parser 暂存 context。
2. 捕获 station listeners、station/buildstorage spawntime 与 buildstorage offers。
3. 在解析收尾阶段执行唯一关联并写入 `NpcStationEntry.buildStorage`。
4. 同步下一 parser schema version 并重新构建 WASM。
5. 通过生产构建确认 Rust/WASM 与 TypeScript contract 一致。

回滚时同时回滚 schema version、WASM 和 TypeScript contract；旧 archive 不做字段 fallback。
