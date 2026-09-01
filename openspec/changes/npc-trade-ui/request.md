# NPC Trade UI

## 目标

在存档绑定的帝国工作台中新增“市场报价”页面，让玩家以一个已整理的玩家空间站为交易上下文，按玩家买入或卖出方向选择多个商品和目标数量，比较 NPC 空间站报价，并同时查看当前可调用的玩家船只。

页面采用与现有空间站工作台一致的三列比例：左侧条件、中间候选空间站、右侧可用船只。结果重点回答“在哪里、向谁、以什么价格和数量交易”，不执行自动交易。

## 已确认方案（审核重点）

### 1. 页面入口与数据上下文

1. 菜单名称为“市场报价”，位于存档绑定工作台侧栏的“总览”和“蓝图配方”之间。
2. 页面只在 live/save-binding 上下文中出现；蓝图帝国模式不显示该入口。
3. 数据严格使用 active binding 的 `gameGuid + selectedArchiveTime` 所指 archive、NPC station offers 和 player ships；`selectedArchiveTime=null` 时使用该 binding 最新有效 archive。
4. 页面不显示当前存档名称，也不显示快照时间。
5. 无 active binding、archive 不兼容或必要 schema 未就绪时显示明确不可用状态，不回退到其他 archive。

### 2. 三列布局

6. 页面复用现有 `grid-cols-12` 与 `lg:col-span-3/5/4` 布局比例。
7. 左列为交易方向、玩家空间站、商品及目标数量条件。
8. 中列为 NPC 候选空间站和报价。
9. 右列为当前可用或可收回的玩家船只。
10. 小于 `lg` 时按左、中、右顺序纵向堆叠。

### 3. 玩家空间站选择

11. 玩家空间站选择器使用 active binding 的 sector groups，以及左侧导航已归入各 group 的玩家空间站集合。
12. 选择器使用两个依次联动的菜单：一级选择 sector group，二级显示左侧同 group 的玩家空间站，并加入该 group 未绑定实际站的虚拟 `tradeStation`（若存在）。
13. `stationPlan.groupId` 与 binding group 的稳定关联键统一使用 `group.sectorMacro`；不得将 auto-group 临时 `group.id` 写入持久化 binding。
14. archive `player_stations` 只能按 binding group anchor/coverage 归组后显示，不得跨 group 平铺。
15. 一个 station entry 必须能解析到 sector 才可选择；缺失 sector 时禁用并说明原因，不使用其他字段 fallback。
16. 被选空间站作为本次交易的玩家端上下文；NPC 候选仍来自当前 archive 的已解析 NPC station offers。
17. 二级菜单使用 `<sector>-<station>` 格式显示本地化星区名和空间站名称。“选择空间站”占位项仅在尚未选择空间站时出现。

### 4. 买卖方向与商品药丸

16. 页面先选择一个全局玩家方向：
   - “玩家买入”：消费 NPC seller offers。
   - “玩家卖出”：消费 NPC buyer demands。
17. 单次查询不允许混合两个方向；方向切换后所有已选商品按新方向重新计算。
18. 商品搜索复用 `generateFilteredWaresGrouped` 的现有多语言规则，匹配当前语言名称、英文原名、ware ID 和现有商品分组。
19. 点击搜索结果将商品加入已选对象药丸；同一 ware 不重复添加。
20. 每个药丸显示商品名、使用现有 `X4NumberInput` 的目标数量输入和移除操作。
21. 需要目标数量的筛选/综合指标仅在对应数量为正数时启用；缺少数量时禁用并指出对应 ware，不得用 0、1 或报价数量自动 fallback。

### 5. NPC 候选身份

22. NPC 候选不得只显示 `XXX-111` 空间站代码。
23. 每个候选至少显示：本地化 sector、与地图空间站 tooltip 完全同源的本地化空间站名称、station code 和本地化 faction。
24. 空间站名称必须直接复用地图 tooltip 的 station label 语义，不另建名称 fallback 链。
25. 页面不显示 race，也不维护仅供本页使用的 faction→race 映射。

### 6. 报价层级

26. 玩家卖出时，同一 NPC station/ware 下的需求分为：
   - 空间站自身需求；
   - 空间站补给需求；
   - 归属于该站的建材仓库需求。
27. 建材仓库只作为所属 station 的子需求展示，不成为独立候选空间站或独立 sector 分组项。
28. 一个 station 最多显示一个 buildStorage。
29. 玩家买入时只使用 station 直属 seller offer；当前业务预期同站同商品最多一条。
30. parser 已过滤缺少 `amount` 或 `amount=0` 的买卖单，页面不显示这些无效报价。

### 7. 单商品和需求子单排序

31. 每条报价定义 `fillableQty = min(amount, targetQty)`；无有效 targetQty 时，数量门槛类指标不可用。
32. 玩家卖出时，station 的代表值从该 ware 的三个需求子单中按当前指标取最优：
   - 数量：取最高 `amount`；
   - 价格：取最高 `price`；
   - 满足目标数量后的价格：仅在 `amount >= targetQty` 的子单中取最高价格；不足量 station 进入末尾不足量组；
   - 目标总收入：取最高 `fillableQty × price`。
33. 玩家买入时，数量按高到低，价格按低到高；满足目标数量后的价格先要求 `amount >= targetQty` 再按低价排序。
34. 玩家买入的目标总成本先保证满足目标数量，再按 `targetQty × price` 从低到高；不足量候选不得因总价较低排到足量候选之前。
35. 排序必须使用明确 comparator 和稳定次序，不使用 sequential fallback 掩盖缺失报价。

### 8. 多商品排序

36. 多商品时提供“主商品排序”和“综合排序”。
37. 主商品排序由玩家从已选药丸中指定一个 ware，按该 ware 的当前方向和排序指标比较；缺失主商品报价的 station 排在末尾。
38. 玩家卖出的综合排序依次比较：完全满足商品数、平均满足比例、可卖总数量、预计总收入，均从高到低。
39. 玩家买入的综合排序依次比较：完全满足商品数、平均满足比例、可买总数量（高到低）、预计总成本（低到高）。
40. 某 ware 缺失报价时，其满足比例和可成交数量为 0，不从其他 ware 借用报价 fallback。

### 9. Sector 分组

41. 中间候选提供“按 sector 分组”开关。
42. 关闭时显示全局 station 排序列表。
43. 开启时，sector 的排序代表值取该 sector 内排名最高的 station；sector 内 station 继续使用同一 comparator。
44. sector 分组只改变展示层级，不改变 station 或报价的业务分数。

### 10. 玩家船只

45. 右列使用当前 binding archive 的玩家船只与可用性结果，只展示 `immediatelyAvailable` 和 `reclaimable` 中的 L `freighter` 与 M `transporter`。
46. 船只按当前 `sectorMacro` 分组，sector 标题使用本地化名称。
47. 若船只 sector 命中 active binding 中一个或多个 sector group 的 anchor sector 或 coverage sectors，标题同时显示所有命中的 group 名称。
48. 每条船显示本地化飞船名（如“苍鹭”）、本地化型号（如“运输船”）、尺寸（L/M）、可用性与静态货舱容量，不显示 component ID 或代码。
49. 仅当存档名称为非空且不是 `{数字,数字}` 本地化 token 时，额外显示为自定义名称；例如“驻_声望贸易_07”有效，`{30226,204}` 无效。
50. 每条船显示所有已选 ware 在空货舱下可能装载的最大数量：仅 transport 与船舱类型匹配且 `ware.volume > 0` 时为 `floor(cargoCapacity / ware.volume)`，否则为 0。
51. 最大可装数量只由静态货舱容量、ware transport 与 ware volume 决定；左侧 targetQty 和存档当前 `ship.cargo` 均不得参与。

### 11. 相对位置

52. 选择玩家空间站后，NPC station 与玩家船只均显示相对该站的位置，并显示现有 `X4NumberInput` 最大跳数过滤。
53. 最大跳数过滤同时作用于 NPC station 与玩家船只；同 sector 视为 0 跳，不同 sector 使用当前地图图动态计算，未知跳数在有限过滤下排除；不得受静态 reachability 缓存的 5 跳生成范围限制。
54. 目标对象与所选空间站位于同一 `sectorMacro` 时，使用两者存档坐标计算直线距离并显示距离。
55. `sectorMacro` 不同时显示动态计算的地图跳数；同一 cluster 的不同 sector 可以显示 `0 跳`，不得误判为同 sector 距离。
56. 缺少精确位置、地图节点或路径时显示未知，不从其他 archive、sector 或坐标 fallback。

### 12. 架构与状态

55. 新功能严格采用 `store -> presenter -> vue`。
56. store/logic 负责报价分类、数量计算、station comparator 和综合评分等可复用领域逻辑。
57. presenter 读取现有 save、binding、game data 与 active-view stores，持有页面级筛选状态，并组装三列 UI 数据。
58. Vue 只消费 presenter 输出和转发事件，不直接访问任何 store，也不自行拼装报价、sector group 或 ship 分组。
59. 不新增 adapter、view model、facade 或其他中间层。
60. 筛选状态只保留在当前页面会话中，不新增 SaveBindingPlan 持久化字段；binding 或 station options 变化时清除失效的玩家空间站选择。

## 边界

### In Scope

- live binding 侧栏入口和市场报价三列页面
- 玩家整理后的 sector group/station selector
- 单方向、多商品、目标数量药丸
- NPC station 身份、三类需求和单一 seller offer 展示
- 单商品、主商品、综合排序
- sector 分组开关与 sector 代表排序
- 合格玩家运输船的本地化身份、容量、所选 ware 最大可装数量、sector 分组和 group 命中标签
- 玩家空间站的 sector group/station 二级菜单与最大跳数过滤
- NPC station 与玩家船只相对所选玩家空间站的跳数/同 sector 距离
- 中英文 UI 文案
- `store -> presenter -> vue` 接入

### Out of Scope

- 显示存档名称或快照时间
- 自动交易、交易命令和船只分配
- 实际航线、预计时间和风险计算
- 声望/许可导致的最终成交资格模拟
- 资金扣除、推算剩余货舱容量和码头兼容性
- NPC 空间站详情页报价展示
- 新的筛选条件持久化 schema
- 测试编写与执行

## 验收标准（DoD）

1. “市场报价”只出现在 live binding 侧栏且位于“总览”和“蓝图配方”之间。
2. 页面为 3/5/4 三列，分别显示条件、候选 station、玩家船只。
3. 空间站选择器按 binding group 展示与左侧导航一致的玩家空间站，并加入未绑定实际站的虚拟 tradeStation。
4. 页面不显示存档名称和快照时间。
5. 商品可按本地化名、英文名和 ware ID 搜索，并以唯一药丸保存目标数量。
6. 玩家买入与卖出使用互斥全局方向，不混合报价。
7. 候选 station 显示 sector、与地图 tooltip 同源的名称、code 和 faction，不显示 race。
8. 玩家卖出时三类需求归属于同一 station，并按当前指标取最优子单参与排序。
9. 玩家买入时只使用 station seller offer，足量候选不会被不足量低总价候选压过。
10. 多商品支持主商品和综合排序，综合排序符合当前方向的数量/金额目标。
11. 开启 sector 分组后，sector 按内部最高 station 排名，内部排序保持一致。
12. 右列只展示可用/可收回的 L 货船与 M 运输船，显示本地化船名/型号、尺寸、有效自定义名称、容量、所有所选 ware 的最大可装数量、sector 及命中 group；最大数量与 targetQty/当前 cargo 无关。
13. NPC 与船在同 sector 时显示到所选玩家空间站的直线距离，不同 sector 时显示跳数，包含同 cluster 不同 sector 的 0 跳。
14. 玩家空间站使用 sector group/station 二级菜单；选站后最大跳数同时过滤 NPC 与船只。
15. Vue 不直接访问 store，且没有新增中间层。
16. `npm run build` 通过。

## 未决项

无。
