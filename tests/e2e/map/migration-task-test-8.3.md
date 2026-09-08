# task-test-8.3 迁移记录

普通场景使用 db fixture、reload、UI 中文；station 场景使用权威 loadLiveBindingFixture、Maps、`settings-button` 经 UI 建立 enforce=true/base-only，再点击 `save-time-poi(-active)` 下钻。产品修复集中在 gate 可见性与地址 inactive 展示；当前完整运行 20/20。

Baseline 20 collected，17 passed / 3 failed。gate 过滤和 inactive station 地址颜色经产品修复后通过；相关 Unit gate 6/6、地址4/4，当前 rebuilt dist 完整20/20。

| old id | current behavior | 真实 UI action | 静态 expected | new case |
|---|---|---|---|---|
| 2.1 | 地图 SVG 与 cluster | 首页等待 game data，点击 Sector Map | viewport、SVG、cluster 可见 | 保留 2.1 |
| 2.2 | DLC off 完整集合 | 设置关闭 enforce、取消 split、保存 | 21 cluster polygon、152 sector polygon、cluster_408 存在 | 保留 2.2 |
| 2.3 | DLC on base 集合 | 设置开启 enforce、仅 base、保存 | 12 cluster polygon、76 sector polygon、cluster_408/400 不存在 | 保留 2.3 |
| 2.4 | off→on 刷新 | 两次设置保存 | cluster_408 消失 | 保留 2.4 |
| 2.5 | on→off 显示 split | 关闭 enforce、取消 split、保存 | cluster_408 dash 6,4 | 保留 2.5 |
| 3.1 | off 显示全部 | 真实设置关闭 enforce | 152 sectors、cluster_01 无 dash、cluster_408 有 dash | 保留 3.1 |
| 3.2 | on 过滤未激活 | 真实设置仅 base | 76 sectors，cluster_408/cluster_400 为空 | 保留 3.2 |
| 3.3 | 过滤目标 gate 保持 | 读取固定 gate line | cluster_15...to408<->cluster_408...to015、#e5e7eb、无 dash；产品修复后通过 | 保留 3.3 |
| 3.4 | inactive station 地址颜色 | live fixture→Maps→设置 enforce/base-only→Save panel→save_009 的 `save-time-poi(-active)`→player station | UFM-908@cluster_401 所在 group header 为红色 `rgb(239, 68, 68)`；产品修复后通过 | 保留 3.4 |
| 3.5 | active station 地址颜色 | 同上 | CEM-776@cluster_01 地址非红色；当前通过 | 保留 3.5 |
| 3.6 | off ore 资源统计 | 关闭限制、打开资源、选 ore | candidate count 90 | 保留 3.6 |
| 3.7 | base ore 资源统计 | 仅 base、打开资源、选 ore | candidate count 53，排除 cluster_401 | 保留 3.7 |
| 3.8 | cluster 坐标稳定 | 记录 points，off→on | cluster_01 points 相同 | 保留 3.8 |
| 3.9 | 设置刷新 polygon | off→on→off | 固定 325→164→325 | 保留 3.9 |
| 3.10 | 多 sector 几何与 cluster 填满 | 读取 cluster_01 三个 sector polygon 实际点集，pairwise SAT 分离；读取 cluster_04 首 sector 与 cluster polygon | cluster_01 三对均正间距；sector/cluster bbox 非零且 cluster 包含 sector | 保留 3.10 |
| 3.11 | split dash 样式 | off、取消 split | cluster_408 dash 6,4 | 保留 3.11 |
| 3.12 | station faceted search | live fixture→Maps→设置 enforce/base-only→save_009 POI→player station→product category 输入 `energy cells`→点击 suggestion | 精确一个静态 product tag；结果含 CEM-776 且排除 UFM-908，不搜索 station code | 保留 3.12 |
| 3.13 | i18n 地图 | UI zh-CN→en | viewport 持续可见 | 保留 3.13 |
| 3.14 | Grand Exchange sector search | on 后输入 Grand Exchange I | 精确 cluster_01 sector001/002/003，排除 inactive | 保留 3.14 |
| 3.15 | 资源面板同步 | off 打开资源、选 ore，再 on | 152→90→53，排除 inactive | 保留 3.15 |

证据：baseline `/tmp/x4-test-repair-M8.3/review-before`；focused `/tmp/x4-test-repair-M8.3/header-final`、`/tmp/x4-test-repair-M8.3/geom-final2`；修复前完整运行 `/tmp/x4-test-repair-M8.3/final-current.log`；3.5 稳定重证 `/tmp/x4-test-repair-M8.3/35-rerun1.log`、`35-rerun2.log`；产品修复后当前完整运行 `/tmp/x4-test-repair-M8.3/address-final`，20/20，PORT 22784、current rebuilt dist preview-only、workers1、retries0、trace on。
