# M3.1-GRAPH 迁移记录

本合同使用 `loadLiveBindingFixture` 载入当前后处理版本的 archive，再仅在本 spec 初始化阶段构造独立 archive、binding、maps 和 `sectorReachability`。archive 构造显式要求 A sector、其 `player_stations` 和固定模板 station `KXN-018` 存在；maps 构造逐个要求场景 macro 存在，缺失即抛错，不选择任意首项或合成空 sector。每个行为都通过 live-production 的“重算 → 重新计算”执行；玩家 sector 增量额外通过 Maps 保存列表的“绑定到此存档”UI 切换同 GUID 新旧 archive。预期固定为声明的 sector macro、边、距离、模块数量及公式，不从 `autoGroupResult` 生成 expected。

| 旧编号 | 当前独立事务与 oracle | 状态 |
|---|---|---|
| 1.1 | empty groups clean slate；A/B 固定 pure hub、T ordinary；A-T=1、B-T=2、A-B=3；断言两组、coverage、双向边和 T 默认归属 | passed |
| 1.2.3 | 同 GUID old archive 只有 A，later archive 新增 T；UI 绑定 later 后重算；断言玩家 sector `[A] → [A,T]` 且只新增 T ordinary assignment | passed |
| 1.3.3/1.3.4 | A/B 分属两个 sector、T 与二者等距 1；`constructions=[]`；20/10 container 为 50% 差并默认 A，20/16 为 20% 差并产生 `uncertain_tie`；score=`containerCap/(1+ln(1+prodLines))` | passed |
| 1.4 | A-B=1、B-C=2、A-C 不在五跳表；关闭新增节点后重算；精确 MST 为 A↔B↔C 且无 A-C | passed |
| 1.5 | 单候选 X 连接 A/B 时自动采用；双候选 X/Y 时生成两个 plan、隐藏 ordinary，pending 时禁用确认；UI 选择后建立一个 bridge draft 并恢复 ordinary | passed after product fix |
| 6.2 | 从固定 `maps.json` 证明 cluster-112 两端为 `lane_count=1`；两个端点均作为 baseline group 参与完整重算，精确断言双向均无连接 | passed |
| 6.4 | A/B baseline；UI unpin A 后卡片保留且三 retain disabled；archive 仅含 B，完整重算后 A 消失 | passed |
| 6.5 | baseline 固定旧边 A-B；静态自然距离 A-C=1、B-C=1、A-B=3；只关闭 A/B 两端 connection retain，重算后精确为 A↔C↔B | passed |
| 6.8 | A 到 T 的固定跨 cluster 链为 6 边；reachability 只保留 0..5 跳，T 无 absorb、无 MST/bridge plan且只有 standalone option | passed |
| 6.9 | 结构性运行时 BFS 合同，不能由 UI 结果证明 | Unit 6/6；相关 autoGroup Unit 86/86 |

6.9 已由 `tests/unit/current/auto-sector-group/autoGroupReachability.spec.ts` 覆盖 MST、assignment、coverage、bridge、presenter clean/incremental 与 live store 参数身份。poison `Proxy sectorGraph` 证明有 reachability 时不读取 graph；无表路径继续由既有 bridge Unit 覆盖。

没有 `if` 放行、skip、soft assertion或由输出派生 expected。产品修复后完整 9/9，证据位于 `/tmp/x4-test-repair-M3.1-GRAPH/product-fix/`。
