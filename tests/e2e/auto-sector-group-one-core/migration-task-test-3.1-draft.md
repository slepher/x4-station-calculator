# M3.1-DRAFT 归属编辑与持久化事务

状态：incomplete，5/6 事务通过，1 项冻结为 product candidate。仅使用 `loadLiveBindingFixture`；页面内 `evaluate` 只写入 versioned binding fixture 或读取结果，所有业务编辑均由真实 UI 完成。独立 expected 使用固定 `sectorMacro`、coverage、候选顺序和持久化前后不变量，不从被测 result 生成 expected。

## 原编号映射

| 原编号 | 当前事务 | 用户动作与独立 expected |
| --- | --- | --- |
| 2.1/2.3/2.4 | `transfer and assignment ordering...` | 固定 A fixture 统计 5 groups、5 assignments、5 cards，assignment sector 顺序与 option 数 `[2,4,2,5,2]`；先将 HUB jump 调至 5，再真实跨 group transfer `cluster_26_sector001_macro`（安提亚的不幸 I），验证 5 个 options 按 distance `[1,2,3,4,standalone]` 排序/default；随后 0→3 跳数只恢复固定水星 coverage，其他 group coverage/连接不被抢占。 |
| 2.5/2.6 | `standalone choice...` | 先固定为已应用 binding；以代码中的静态表逐项验证 5 个 assignment 的完整 options、default、selected 与 status，真实点击水星 standalone 后再次验证其他 4 项仍与同一静态表完全一致；card 名单/顺序固定；再次点击不创建第二个 `sectorMacro=cluster_106_sector001_macro` group。 |
| 2.5/2.6/5.2 | `recompute expands...` | 固定 persisted baseline 仅保留 HUB 与 `cluster_601_sector001_macro` 两组，记录 `cluster_740_sector001_macro→HUB`、baseline jump/distance 6；通过 UI 将 HUB jump 由 6 改为 2，使目标离开 current coverage，并静态验证没有任何 extension option、R6 选择清为 null。规范要求的 baseline absorb option 当前缺失，仅剩 standalone，因此该项保留真实失败；soft assertion 后继续真实重算，验证另一固定目标的最小扩展层 `uncertain_extend`、保存前 binding 不变与 baseline pill 保留。 |
| 3.2/5.2 | `manual player hub...` | UI 添加水星 hub；候选集合精确为 `MGO-010`，默认选中；删除 card 后确认并 reload，废弃 group 不残留，水星回到 assignment。 |
| 5.2 | `real connection edit...` | 真实点击阿尔忒弥斯与月之舟 connected pill 的 remove；保留与 baseline 不同的 connected ids，验证 draft 的 connected ids、jump=3、空 coverage、BHW-834 trade station，再确认→persisted→reload 完整一致。 |
| 6.3 | `clean slate exposes standalone-only...` | 固定 `cluster_106_sector001_macro` fixture 清空 groups 后 reload；该 assignment 精确只有一个 standalone option，`selectedOptionIndex=null`，不从实际 assignments 选择 witness。 |

## 运行与分类

早期 focused 中“jump=2 必须生成 coverage group”是 test-owned expected 错误，已改为规范要求的最小扩展 assignment。二审后又移除了从 `autoGroupResult` 动态复制的 2.6 expected，改为由固定 binding、距离矩阵和稳定 group 顺序确定的完整静态表；单项验证通过。

最终 baseline-only fixture 明确证明 persisted ownership、current jump 小于 baseline distance、当前只有两个远端 group，且目标没有任何 `extendsRange=true` option。UI 调低 jump 后，R6 的 `selectedSectorMacro=null`、`selectedOptionIndex=null` 已满足，但实际 options 只有 standalone，缺少 core 规范要求的 HUB baseline reabsorb option。该差异归 product candidate；未将实际输出改写为 expected。最终完整单次 `5 passed / 1 failed / 0 skipped`，失败仅为上述缺失 option；日志 `/tmp/x4-test-repair-M3.1-DRAFT/hard-final.log`，trace `/tmp/x4-test-repair-M3.1-DRAFT/hard-final/**/trace.zip`。collection 为 6 tests / 1 file，日志 `/tmp/x4-test-repair-M3.1-DRAFT/hard-collection.log`。

Fixture：当前 `tests/fixtures/db.json`/`save/*.json` 经 `loadLiveBindingFixture` 注入，A binding GUID `CB8837FE-98C1-42F8-9D6A-ED0ADC539111`，archive time `667632.933`。测试不改 shared helper、src 或基础 fixture。
