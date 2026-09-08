# task-test-8.2 迁移记录

## 范围与分类

本轮仅修改三份 map spec、本映射和结果文档。普通 beforeEach 使用去除 `vsn` 的 `db.json`、reload、UI `language-select` 选择 `zh-CN`；业务状态全部由真实 UI 操作产生。未修改 src、fixture、helper，未 build、未运行 Unit、未执行 git 写入。baseline 共 32 项，25 passed / 7 failed；已修复 test-owned/stale locator、大小写、fill-layer、颜色、滚动与静态集合问题，旧 cluster02 transit witness 与 transit 断言属于 test-owned stale，已改为 review 固定 cluster29 映射。

## 32 项逐项映射

| old id | current behavior | UI action | static expected | new case |
|---|---|---|---|---|
| advanced 2.1 | 简单模式独立面板 | 点击 Simple tab | ore 初始未选中 | 保留 2.1 |
| advanced 2.2 | 高级模式独立面板 | 点击 Advanced tab | group、jump=2、transit checked | 保留 2.2 |
| advanced 2.3 | simple → advanced | 点击 Advanced | advanced 面板可见 | 保留 2.3 |
| advanced 2.4 | advanced → simple | 点击 Simple | simple 面板可见 | 保留 2.4 |
| advanced 2.5 | 首组原位展开 | 打开 advanced | expanded group 可见 | 保留 2.5 |
| advanced 2.6 | 候选选中态 | 选 ore、刷新 | 首 candidate selected | 保留 2.6 |
| advanced 3.1 | 两模式状态独立 | simple 选 ore/silicon，advanced 配两组，往返 | simple 资源和 advanced 两组分别保留 | 保留 3.1 |
| advanced 3.2 | 组间 AND 候选 | 两组分别选 ore/silicon，silicon 改 high 后刷新 | 首 candidate 当前固定 17 个 sector，score `5` | 保留 3.2 |
| advanced 3.3 | 单 sector 可覆盖多组 | 两组 lowest 资源，刷新并点击固定 sector chip | `cluster_01_sector001_macro` 有 group badge 1/2；pie 顺序 `#B36100`,`#00AFB3` | 保留 3.3 |
| advanced 3.4 | 日光是组内过滤条件 | 组内选 ore+sunlight，输入 `150` 后真实刷新，再输入 `999999` 刷新 | 固定 candidate resource IDs `[cluster_07_sector001_macro,cluster_24_sector001_macro,cluster_27_sector001_macro,cluster_49_sector001_macro]` 均来自静态 sunlight≥150 集合；candidate score 静态 `5`（ore rating，sunlight 不计分）；999999 后静态空并排除 witness | 保留 3.4 |
| advanced 3.5 | transit checkbox 约束 hub 池 | 真实切换 transit 后定位固定 resource set candidate 并分别刷新 | resource set 静态 15 IDs；transit=true hubs 精确 `[cluster_29_sector001_macro, cluster_29_sector002_macro]`，false 精确 `[cluster_29_sector002_macro]` | 保留 3.5 |
| advanced 3.6 | jump 约束候选范围 | jump `1`、`3` 分别刷新，输入 `9` | jump1 固定 7-sector 集合为 jump3 固定 32-sector 集合子集，且含新增 `cluster_740_sector001_macro`；clamp 为 `5` | 保留 3.6 |
| advanced 3.7 | candidate chip 单点 focus | 点击首、次 candidate chip | 次 candidate selected | 保留 3.7 |
| advanced 3.8 | 组内所有项联动 | 选 ore/silicon，所有项改 high，再单项 medium | 两项 high，all value 为 `__mixed__` | 保留 3.8 |
| advanced 3.9 | 只保留最大资源集合 | 选 ore、刷新 | 无严格子集且保留不可比较集合 | 保留 3.9 |
| advanced 3.10 | refresh 保持内部滚动 | 真实滚动 panel body、切换 transit、刷新 | refresh 后 `scrollTop > 100` | 保留 3.10 |
| advanced 3.11 | 右侧过滤区独立滚动 | 添加多个 group | 仅过滤区承担滚动 | 保留 3.11 |
| advanced 3.12 | 刷新后的空结果 | ore+sunlight，输入 `999999` 后点击 refresh | candidate list 静态为空，`.resource-empty` 为“没有满足条件的星区” | 保留 3.12 |
| advanced 3.13 | simple 多资源 AND | 选 ore+silicon | 当前固定 9 个 sector，首 score `10` | 保留 3.13 |
| advanced 3.14 | simple sunlight filter | 选 sunlight，输入 `999` | 空结果文案“没有满足条件的星区” | 保留 3.14 |
| advanced 3.15 | advanced candidate 切换 | 点击第二 candidate | 新 candidate selected | 保留 3.15 |
| advanced 3.16 | advanced 配置恢复 | 两组配置后往返 tab | group count 保持 2 | 保留 3.16 |
| advanced 3.17 | 原位编辑完成 | 修改 ore，点击 group action | expanded → summary，summary tag 可见 | 保留 3.17 |
| bugfix 4.1 | BUG-001 跨 cluster 候选 | advanced 选 ore+silicon、jump=2、transit checked、刷新 | 首 candidate 同时含 `cluster_01_sector001_macro` 与 `cluster_06_sector001_macro` | 保留 4.1 |
| resource-pie 2.1 | 资源面板打开 | maps 页面点击 resource tab | panel header 可见 | 保留 2.1 |
| resource-pie 2.2 | 资源面板关闭 | 点击 close | panel header 不可见 | 保留 2.2 |
| resource-pie 3.1 | 多资源 pie fill | 选 ore+silicon | 固定 sector 两 slice，首片 9.0 ore `#B36100` | 保留 3.1 |
| resource-pie 3.2 | 单资源 solid fill | 选 ore | 固定 sector fill-layer 为 `#B36100`，无 pie slice | 保留 3.2 |
| resource-pie 3.3 | sunlight 单独染色 | 选 sunlight | 固定 sector fill-layer 为当前 fallback `#fbbf24`，无 pie slice | 保留 3.3 |
| resource-pie 3.4 | 混合时排除 sunlight slice | 选 ore+silicon+sunlight | 正好 2 slice，均非 sunlight 色 | 保留 3.4 |
| resource-pie 3.5 | 关闭清理高亮但保留配置 | 选 ore+silicon，关闭再用 Maps resource tab 打开 | ore 保持 selected，固定 sector 两 slice | 保留 3.5 |
| resource-pie 3.6 | 关闭清理地图高亮 | 选 ore 后先断 solid `#B36100`，再关闭 | 关闭后 SVG 不存在 resource pie slice，sector fill 恢复静态默认 `#B3B300` | 保留 3.6 |

## 验证证据

- baseline：`/tmp/x4-test-repair-M8.2/baseline.log`，exit 1，32 collected，25 passed / 7 failed。
- focused review：`/tmp/x4-test-repair-M8.2/review-focused-2`，8 targeted，7 passed / 1 failed；当前核心修复项通过，3.13 首次运行的静态集合已校准。
- 最新 focused：`/tmp/x4-test-repair-M8.2/review-35-cluster29b` 的 3.5 通过；3.4、3.6、3.12 及 pie 已在最终完整单次通过。
- 完整单次：`/tmp/x4-test-repair-M8.2/final-last32`，32 collected，32 passed / 0 failed / 0 skipped；3.4、3.5、3.13 与 pie3.2 均通过。
- collection：`/tmp/x4-test-repair-M8.2/final-review-collection.log`，32 tests in 3 files。
- `git diff --check`：exit 0（五个 owned 文件）。

无 skip、fixme、only、条件放行、fallback 或从被测结果派生 expected；所有颜色和 sector id 均来自当前 9.0 数据与当前 SVG fill 协议。
