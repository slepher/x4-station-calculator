# NPC Trade UI

## 目标

在存档绑定的帝国工作台中新增“市场报价”页面，让玩家以一个已整理的玩家空间站为交易上下文，按玩家买入或卖出方向选择多个商品和目标数量，比较 NPC 空间站报价，并同时查看当前可调用的玩家船只。

页面采用与现有空间站工作台一致的三列比例：左侧条件、中间候选空间站、右侧可用船只。结果重点回答“在哪里、向谁、以什么价格和数量交易”，不执行自动交易。

## 已确认方案（审核重点）

### 1. 页面入口与数据上下文

1. 菜单名称为“市场报价”，位于存档绑定工作台侧栏的“总览”和“蓝图配方”之间。
2. 页面只在 live/save-binding 上下文中出现；蓝图帝国模式不显示该入口。
3. 数据使用 active binding 当前选择的 archive、NPC station offers 和 player ships。
4. 页面不显示当前存档名称，也不显示快照时间。
5. 无 active binding、archive 不兼容或必要 schema 未就绪时显示明确不可用状态，不回退到其他 archive。

### 2. 三列布局

6. 页面复用现有 `grid-cols-12` 与 `lg:col-span-3/5/4` 布局比例。
7. 左列为交易方向、玩家空间站、商品及目标数量条件。
8. 中列为 NPC 候选空间站和报价。
9. 右列为当前可用或可收回的玩家船只。
10. 小于 `lg` 时按左、中、右顺序纵向堆叠。

### 3. 玩家空间站选择

11. 玩家空间站选择器只使用 active `SaveBindingPlan.groups` 与 `stationPlans` 中玩家已经整理的数据。
12. 选择层级为 sector group → station plan，并包含 group 已绑定的 `tradeStation`（若存在）。
13. 不直接平铺 archive 中的原始 `player_stations`，也不显示未纳入玩家整理结构的空间站。
14. 一个 station entry 必须能解析到 sector 才可选择；缺失 sector 时禁用并说明原因，不使用其他字段 fallback。
15. 被选空间站作为本次交易的玩家端上下文；NPC 候选仍来自当前 archive 的已解析 NPC station offers。

### 4. 买卖方向与商品药丸

16. 页面先选择一个全局玩家方向：
   - “玩家买入”：消费 NPC seller offers。
   - “玩家卖出”：消费 NPC buyer demands。
17. 单次查询不允许混合两个方向；方向切换后所有已选商品按新方向重新计算。
18. 商品搜索复用 `generateFilteredWaresGrouped` 的现有多语言规则，匹配当前语言名称、英文原名、ware ID 和现有商品分组。
19. 点击搜索结果将商品加入已选对象药丸；同一 ware 不重复添加。
20. 每个药丸显示商品名、目标数量输入和移除操作。
21. 需要目标数量的筛选/综合指标仅在对应数量为正数时启用；不得用 0、1 或报价数量自动 fallback。

### 5. NPC 候选身份

22. NPC 候选不得只显示 `XXX-111` 空间站代码。
23. 每个候选至少显示：本地化 sector、可解析的本地化空间站类型/名称、station code、本地化 faction 和推导 race。
24. faction 与 race 分开显示；race 是显式映射的派生信息，不能把 faction 名直接当 race。
25. 无法推导 race 时显示未知，不根据 station code 或外观猜测。

### 6. 报价层级

26. 玩家卖出时，同一 NPC station/ware 下的需求分为：
   - 空间站自身需求；
   - 空间站补给需求；
   - 归属于该站的建材仓库需求。
27. 建材仓库只作为所属 station 的子需求展示，不成为独立候选空间站或独立 sector 分组项。
28. 一个 station 最多显示一个 buildStorage。
29. 玩家买入时只使用 station 直属 seller offer；当前业务预期同站同商品最多一条。
30. `amount=0` 显示为零数量报价，不解释为缺失数据。

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

45. 右列使用 `selectedArchivePlayerShips` 的可用性结果，只展示 `immediatelyAvailable` 和 `reclaimable`。
46. 船只按当前 `sectorMacro` 分组，sector 标题使用本地化名称。
47. 若船只 sector 命中 active binding 中一个或多个 sector group 的 anchor sector 或 coverage sectors，标题同时显示所有命中的 group 名称。
48. 每条船至少显示玩家命名/代码、船级与可用性；未分配/未知状态不得伪装为可用。
49. 当前 archive 没有可靠的剩余货舱容量 contract，因此本 change 不显示“可装载目标商品数量”或据此过滤船只。

### 11. 架构与状态

50. 新功能严格采用 `store -> presenter -> vue`。
51. store/logic 负责报价分类、数量计算、station comparator 和综合评分等可复用领域逻辑。
52. presenter 读取现有 save、binding、game data 与 active-view stores，持有页面级筛选状态，并组装三列 UI 数据。
53. Vue 只消费 presenter 输出和转发事件，不直接访问任何 store，也不自行拼装报价、sector group 或 ship 分组。
54. 不新增 adapter、view model、facade 或其他中间层。
55. 筛选状态只保留在当前页面会话中，不新增 SaveBindingPlan 持久化字段。

## 边界

### In Scope

- live binding 侧栏入口和市场报价三列页面
- 玩家整理后的 sector group/station selector
- 单方向、多商品、目标数量药丸
- NPC station 身份、三类需求和单一 seller offer 展示
- 单商品、主商品、综合排序
- sector 分组开关与 sector 代表排序
- 可用/可收回玩家船只的 sector 分组和 group 命中标签
- 中英文 UI 文案
- `store -> presenter -> vue` 接入

### Out of Scope

- 显示存档名称或快照时间
- 自动交易、交易命令和船只分配
- 实际航线、跳数、预计时间和风险计算
- 声望/许可导致的最终成交资格模拟
- 资金扣除、剩余货舱容量和码头兼容性
- NPC 空间站详情页报价展示
- 新的筛选条件持久化 schema
- 测试编写与执行

## 验收标准（DoD）

1. “市场报价”只出现在 live binding 侧栏且位于“总览”和“蓝图配方”之间。
2. 页面为 3/5/4 三列，分别显示条件、候选 station、玩家船只。
3. 空间站选择器只使用玩家已整理的 binding groups/stationPlans/tradeStation。
4. 页面不显示存档名称和快照时间。
5. 商品可按本地化名、英文名和 ware ID 搜索，并以唯一药丸保存目标数量。
6. 玩家买入与卖出使用互斥全局方向，不混合报价。
7. 候选 station 同时显示 sector、名称/类型、code、faction 和 race，不只显示代码。
8. 玩家卖出时三类需求归属于同一 station，并按当前指标取最优子单参与排序。
9. 玩家买入时只使用 station seller offer，足量候选不会被不足量低总价候选压过。
10. 多商品支持主商品和综合排序，综合排序符合当前方向的数量/金额目标。
11. 开启 sector 分组后，sector 按内部最高 station 排名，内部排序保持一致。
12. 右列只展示可用/可收回船只，并显示 sector 及所有命中的 sector group。
13. Vue 不直接访问 store，且没有新增中间层。
14. `npm run build` 通过。

## 未决项

无。
