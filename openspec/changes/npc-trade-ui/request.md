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
19. 搜索框获得焦点后，即使查询为空也向右弹出候选框；候选按 ware 的既有 `group` 分组，缺少 group 时归入 `others`。`others` 标题必须使用应用 UI locale 的 `common.others`，不得写入或读取 X4 游戏文本 locale。
20. 市场报价候选以当前游戏版本 `wares.json` 为唯一商品全集，只排除已经加入药丸的 ware；不得按当前 archive 是否存在实际报价、是否存在生产模块或商品运输类型缩减候选。
21. TEMP/内部商品应由游戏数据生成阶段从 `wares.json` 排除，市场报价 presenter 和 Vue 不维护 TEMP 名称、ID 或实际报价白名单。新增到 `wares.json` 的合法商品（包括 `condensate`）自动进入候选。
22. 点击搜索结果将商品加入已选对象药丸并关闭弹出框；同一 ware 不重复添加。
23. 每个药丸显示商品名、使用现有 `X4NumberInput` 的目标数量输入和移除操作。
24. 需要目标数量的筛选/综合指标仅在对应数量为正数时启用；缺少数量时禁用并指出对应 ware，不得用 0、1 或报价数量自动 fallback。

### 4.1 共用候选搜索控件

25. 搜索输入与分组候选弹出框拆为两个联动的 common Vue 控件：搜索控件负责 query、focus/blur、清空、Escape 和右侧锚点；弹出框负责 Teleport、分组及候选行渲染。
26. 两个 common 控件不得直接读取 store；商品、模块、DLC 标签和颜色等 UI 数据由各功能 presenter 组装。
27. 市场报价商品、BuildPlan 商品/模块和空间站模块选择复用这两个控件，保持各自既有筛选和选择语义。
28. BuildPlan 舰队继续由 `FleetGoalSearchBox` 负责，不纳入商品/模块候选弹出框。

### 5. NPC 候选身份

22. NPC 候选不得只显示 `XXX-111` 空间站代码。
23. 正常候选固定按 sector 分组；sector 标题显示本地化 sector、sector owner（仅非空时）和相对所选玩家站的跳数。sector owner 不代表 station owner；仅当 station owner 与 sector owner 不同时才在 station card 显示本地化 station owner。sector owner 为空时 MUST 显示 station owner。
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
30. 玩家买入的 station seller offer 来源文案显示“空间站出售”/“Station selling”，不得复用玩家卖出方向的“空间站自身需求”/“Station demand”。
31. parser 已过滤缺少 `amount` 或 `amount=0` 的买卖单，页面不显示这些无效报价。
32. 报价行只显示方向化来源、`amount` 和 `price`；archive 中可选的 `desired` 继续作为原始事实保留，但不进入市场报价展示结构。

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

### 9. 交易资格与候选分组

41. 中间候选固定按 sector 分组，不再提供“按 sector 分组”checkbox 或全局 station 平铺模式；sector 分组不是页面选项，也不进入薄 store。
42. faction 带 `notradeoffer` 时，视为不支持普通货币市场交易，在排序和展示分组前直接排除；奎塔航者等 barter faction 不进入正常候选或声望不足候选。
43. 其他普通货币交易 faction 使用当前 archive 的玩家内部声望值判断资格：`rawRelation > -0.01` 为可交易，`rawRelation <= -0.01` 为声望不足；`-9/-10` display 声望只用于展示，不用于资格比较。
44. 声望合格 station 位于主候选区并固定按 sector 分组；sector 的排序代表值取组内排名最高的 station，sector 内 station 继续使用同一 comparator。
45. 主候选 sector 标题显示 sector、非空的 sector owner 和跳数；station owner 仅在不同于 sector owner 时显示在 station card，sector owner 为空时 MUST 显示 station owner。同 sector 的精确直线距离仍属于 station 自身信息。
46. 声望不足 station 统一置于主候选区之后，按 station owner 分组并默认折叠；标题显示本地化 station owner 与由该 owner raw relation 转换的 display 声望，不能按 sector owner 分组或判断声望。
47. 展开声望不足 station owner 后，其 station 继续按 sector 分组；内部 sector 标题显示 sector、非空的 sector owner 和跳数，station card 不重复父级已显示的 station owner、sector 或跳数。
48. faction 与 sector 分组均沿用原 station comparator 的首次出现顺序和组内排序，不改写 station 或报价的业务分数。
49. 正常候选与已展开的声望不足 faction 均以完整 sector group 为分页单位，每页最多显示 10 个 sector，不得将同一 sector 的 station 拆到不同页。
50. Presenter MUST 先完成排序和 sector grouping，再只为当前页 sector 构造 station card DTO；不得先构造全部卡片再由 Vue 隐藏。
51. 声望不足 faction 折叠时只显示 faction 摘要，Presenter 不构造其 sector/station card DTO，Vue 也不挂载内部卡片；展开后才生成该 faction 当前页内容。
52. 正常候选页码、各 faction 页码和 faction 展开集合属于 presenter 临时 UI 状态，不进入薄 store；候选依赖变化时重置到第一页并关闭已展开 faction。

### 10. 玩家船只

45. 右列使用当前 binding archive 的玩家船只与可用性结果，只展示 `immediatelyAvailable` 和 `reclaimable` 中的 L `freighter` 与 M `transporter`。
46. 船只按当前 `sectorMacro` 分组，sector 标题使用本地化名称。
47. 若船只 sector 命中 active binding 中一个或多个 sector group 的 anchor sector 或 coverage sectors，标题同时显示所有命中的 group 名称。
48. 每条船显示本地化飞船名（如“苍鹭”）、本地化型号（如“运输船”）、尺寸（L/M）、可用性与静态货舱容量，不显示 component ID 或代码。
49. 仅当存档名称为非空且不是 `{数字,数字}` 本地化 token 时，额外显示为自定义名称；例如“驻_声望贸易_07”有效，`{30226,204}` 无效。
50. 每条船显示所有已选 ware 在空货舱下可能装载的最大数量：仅 transport 与船舱类型匹配且 `ware.volume > 0` 时为 `floor(cargoCapacity / ware.volume)`，否则为 0。
51. 最大可装数量只由静态货舱容量、ware transport 与 ware volume 决定；左侧 targetQty 和存档当前 `ship.cargo` 均不得参与。
52. 可用玩家船只保留现有 sector 分组，并与候选列表使用相同分页规则：每页最多显示 10 个完整 sector groups，不得拆分同一 sector 的船只。

### 11. 相对位置

52. 选择玩家空间站后，NPC station 与玩家船只均显示相对该站的位置，并显示现有 `X4NumberInput` 最大跳数过滤。
53. 最大跳数过滤同时作用于 NPC station 与玩家船只；同 sector 视为 0 跳，不同 sector 使用当前地图图动态计算，未知跳数在有限过滤下排除；不得受静态 reachability 缓存的 5 跳生成范围限制。
54. 目标对象与所选空间站位于同一 `sectorMacro` 时，使用两者存档坐标计算直线距离并显示距离。
55. `sectorMacro` 不同时显示动态计算的地图跳数；同一 cluster 的不同 sector 可以显示 `0 跳`，不得误判为同 sector 距离。
56. 缺少精确位置、地图节点或路径时显示未知，不从其他 archive、sector 或坐标 fallback。

### 12. 架构与状态

55. 新功能严格采用 `store -> presenter -> vue`。
56. 薄 `useNpcTradeStore` 只保存当前应用会话中的用户输入：方向、最大跳数、ware targets、主商品、排名方式、排序指标，以及归属于特定 binding 的 sector group/station 选择。
57. presenter 读取薄 store 及现有 save、binding、game data 与 active-view stores，校验 binding 归属和失效选择，并组装三列 UI 数据。
58. Vue 只消费 presenter 输出和转发事件，不直接访问任何 store，也不自行拼装报价、sector group 或 ship 分组。
59. 不新增 adapter、view model、facade 或其他中间层。
60. 薄 store 不写入 `localStorage`，不新增 `SaveBindingPlan` 或其他持久化 schema；刷新应用后允许恢复默认值。
61. 搜索文字、候选弹窗、候选页码、船只页码和声望不足 faction 展开状态保持组件/presenter 临时状态，不进入薄 store。
62. NPC 候选、船只候选、距离、页面状态和展示分组均为当前 archive、binding、地图数据与用户输入的派生结果，MUST NOT 固定保存在薄 store 中。
63. 仅切换工作台页面时保留用户输入；切换其他 binding 时保留通用条件与商品条件，但 MUST 清除原 binding 的 sector group/station 选择。
64. 同一 binding 上传或选择新 archive、修改 group/station/位置/coverage，或既有 station option 失效时，presenter MUST 使用当前数据重新派生候选，并清除不再有效的上下文选择。

## 边界

### In Scope

- live binding 侧栏入口和市场报价三列页面
- 玩家整理后的 sector group/station selector
- 单方向、多商品、目标数量药丸
- 市场报价基于全部 `wares.json` 商品的右侧分组候选框
- 商品/模块共用搜索框与分组弹出框，并接入市场报价、BuildPlan 商品/模块和空间站模块选择
- NPC station 身份、三类需求和单一 seller offer 展示
- 单商品、主商品、综合排序
- 固定 sector 分组、sector 代表排序，以及 sector/可选 sector owner/跳数标题和差异 station owner 展示
- 普通货币交易 station owner 的 raw relation 资格判断，以及声望不足 station 的底部 station-owner→sector 折叠分组
- 正常候选与声望不足候选的完整 sector 分页，以及折叠 faction 的卡片延迟构造和挂载
- `notradeoffer` faction 的候选硬排除
- 合格玩家运输船的本地化身份、容量、所选 ware 最大可装数量、sector 分组和 group 命中标签
- 可用玩家船只的完整 sector 分页
- 玩家空间站的 sector group/station 二级菜单与最大跳数过滤
- NPC station 与玩家船只相对所选玩家空间站的跳数/同 sector 距离
- 当前应用会话内的市场报价用户条件保留与 binding 归属校验
- 中英文 UI 文案
- `store -> presenter -> vue` 接入

### Out of Scope

- 显示存档名称或快照时间
- 自动交易、交易命令和船只分配
- 实际航线、预计时间和风险计算
- 许可证、折扣及其他非普通交易门槛的最终成交资格模拟
- barter 交易内容与奎塔航者等特殊交换机制展示
- 资金扣除、推算剩余货舱容量和码头兼容性
- NPC 空间站详情页报价展示
- 在市场报价 UI 内维护 TEMP 商品过滤规则或实际报价白名单
- 将 BuildPlan 舰队搜索合并进商品/模块分组弹出框
- 新的筛选条件持久化 schema
- 固定保存或持久化 NPC 候选、船只候选及其他派生展示结果
- 测试编写与执行

## 验收标准（DoD）

1. “市场报价”只出现在 live binding 侧栏且位于“总览”和“蓝图配方”之间。
2. 页面为 3/5/4 三列，分别显示条件、候选 station、玩家船只。
3. 空间站选择器按 binding group 展示与左侧导航一致的玩家空间站，并加入未绑定实际站的虚拟 tradeStation。
4. 页面不显示存档名称和快照时间。
5. 商品可按本地化名、英文名和 ware ID 搜索，并以唯一药丸保存目标数量。
6. 玩家买入与卖出使用互斥全局方向，不混合报价。
7. 正常候选固定按 sector 分组；sector 标题显示 sector、非空的 sector owner 和跳数。station owner 不等同于 sector owner，仅在两者不同时显示在 station card；sector owner 为空时必须显示 station owner。card 仍显示地图 tooltip 同源名称、code 和报价，不显示 race。
8. 玩家卖出时三类需求归属于同一 station，并按当前指标取最优子单参与排序。
9. 玩家买入时只使用 station seller offer，足量候选不会被不足量低总价候选压过。
10. 多商品支持主商品和综合排序，综合排序符合当前方向的数量/金额目标。
11. sector 分组始终启用且不提供 checkbox；sector 按内部最高 station 排名，内部排序保持一致。
12. 右列只展示可用/可收回的 L 货船与 M 运输船，显示本地化船名/型号、尺寸、有效自定义名称、容量、所有所选 ware 的最大可装数量、sector 及命中 group；最大数量与 targetQty/当前 cargo 无关。
13. NPC 与船在同 sector 时显示到所选玩家空间站的直线距离，不同 sector 时显示跳数，包含同 cluster 不同 sector 的 0 跳。
14. 玩家空间站使用 sector group/station 二级菜单；选站后最大跳数同时过滤 NPC 与船只。
15. Vue 不直接访问 store，且没有新增中间层。
16. `npm run build` 通过。
17. 聚焦市场报价商品搜索框时，即使查询为空也会在右侧显示当前 `wares.json` 中全部未选择商品，并按现有商品 group 分组；`others` 显示应用 locale 对应的“其他”或 `Others`。
18. 市场报价候选不受当前 archive 实际报价或生产模块限制；TEMP 商品由上游数据生成排除，合法新增 ware 自动出现。
19. 市场报价、BuildPlan 商品/模块和空间站模块选择复用共用搜索框与分组弹出框，BuildPlan 舰队搜索保持独立。
20. 离开市场报价再返回时，方向、跳数、商品目标、主商品、排名/排序和同 binding 的有效空间站选择保持不变；搜索文字、弹窗状态、候选/船只页码和折叠展开状态无需保留。
21. 切换 binding 时不沿用原 binding 的 group/station；同 binding 的 archive 或空间结构变化时，NPC 与船只候选使用当前数据重新派生，失效选择被清除。
22. 报价行只显示来源、数量和价格，不显示 archive 的 `desired`。
23. `notradeoffer` station owner 的 station 不进入任何候选分组；普通 station owner 中 `rawRelation <= -0.01` 的 station 统一位于列表底部，按 station owner 默认折叠，展开后继续按 sector 分组，标题显示该 station owner 的 display 声望；sector owner 不参与资格判断或折叠归组。
24. 正常候选与已展开的声望不足 faction 每页最多显示 10 个完整 sector；分页不得拆分 sector，且只为当前页构造和挂载 station cards。
25. 声望不足 faction 折叠时内部 sector/station cards 不得存在于展示 DTO 或 DOM；候选条件变化后页码回到第一页并关闭已展开 faction。
26. 可用玩家船只保留 sector 分组，每页最多显示 10 个完整 sector；船只集合变化后回到第一页。

## 未决项

无。
