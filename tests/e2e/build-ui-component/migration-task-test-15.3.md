# M15.3 迁移映射

规范 `openspec/specs/build-ui-component/spec.md`：views配置顺序、v-model单一激活、sky样式、Dashboard标题/内容/footer联动和稳定testid。保留6项原标题、顺序与describe。

前置：普通db.json去vsn，显式9.0空帝国列表，reload/UI language；Sidebar创建真实站点，再用grouped-candidate添加1个Energy Cell模块。移除准备函数第二次goto导致未选站的旧入口，不写业务store。

| 原编号→同名当前用例 | UI动作与独立expected |
|---|---|
| 2.1 默认视图 | 默认materials，4个tab顺序materials/volume/time/workers，唯一sky active；建设成本标题、能量模块Cr值、价格footer。 |
| 2.2 materials→volume | 真实点击volume；材料体积标题、能量模块18,172m³、运输容量slider footer。 |
| 2.3 volume→time | 连续真实点击；建造用时标题、能量模块00:12:36、footer不存在。 |
| 2.4 time→workers | 连续真实点击；劳动力标题、能量模块需求90、workforce-control-panel显示且simulation-controls不存在。 |
| 3.1 四视图联动 | 全链标题/内容/footer及唯一active；成本slider End提高模块成本；volume slider Home使界面和真实settings均5000，模块材料体积不变；继续time/workers。 |
| 3.2 稳定锚点 | 逐个data-testid点击四视图并回materials；每次完整唯一激活、顺序、标题、内容与footer断言。 |

独立9.0静态数据：Energy建材260电子黏土×24m³ +951船体部件×12m³ +520能量电池×1m³=18,172m³，buildTime756秒，工人需求90。不调用analyzeStation推导expected；当前store仅只读settings witness。删除原expected常量自比较，保留并增强有效行为，无skip/fixme/only/条件通过。

基线3.1在dashboard不存在处失败（过期fixture/导航前置）。迁移后6/6、collection6、diff0，详见direct-migration/results/M15.3.md。
