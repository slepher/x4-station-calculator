## Why

NPC 报价已进入存档数据，但玩家目前无法按自己的空间站、目标商品和买卖方向比较候选空间站，也无法在同一页面查看可调用船只。原始报价还包含空间站自身、补给和建材仓库三类需求，简单平铺或按 ware 去重会给出错误交易结论。

## What Changes

- 在 live/save-binding 工作台侧栏新增“市场报价”，位置在“总览”和“蓝图配方”之间。
- 新页面采用左 3、中 5、右 4 的三列布局：条件、NPC 候选、玩家船只。
- 左侧从玩家已整理的 binding sector groups、stationPlans 和 tradeStation 选择玩家端空间站；不平铺原始 archive station。
- 先选择全局玩家买入/卖出方向，再通过现有多语言 ware 搜索添加带目标数量的商品药丸。
- 中间按 station 展示本地化 sector、名称/类型、code、faction 和 race，并将自身需求、补给需求、建材仓库需求作为同站子单。
- 提供数量、价格、满足目标数量后的价格、目标总金额，以及多商品主商品/综合排序。
- 提供 sector 分组开关；sector 按内部最高 station 排序。
- 右侧按 sector 展示可用或可收回玩家船只，并标注命中的玩家 sector groups。
- 不显示存档名称和快照时间，不执行交易或自动分配船只。
- 严格使用 `store -> presenter -> vue`，不新增其他中间层。

## Capabilities

### New Capabilities

- `npc-trade-ui`: 基于 active save binding 搜索、比较和分组 NPC 市场报价，并展示可用玩家船只。

### Modified Capabilities

- `production-ui`: live binding 侧栏新增市场报价固定入口和 workbench mode。

## Impact

- 导航与页面：live production workbench、sidebar presenter、production UI 类型及中英文文案。
- 领域逻辑：NPC 报价分类、目标数量、方向化排序、多商品综合评分与 sector 代表排序。
- Presenter：组装玩家空间站 selector、候选 station cards 和玩家 ship groups。
- 前置依赖：`npc-storage` 的完整报价/buildStorage contract，以及 `save-player-ships` 的玩家舰船和可用性数据。
- 不新增依赖，不修改交易执行系统。
