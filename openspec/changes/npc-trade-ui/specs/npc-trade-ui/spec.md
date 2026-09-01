# NPC Trade UI Specification

## Purpose

定义 live save-binding 上下文中的市场报价三列页面、交易条件、NPC 候选排序、sector 分组和可用玩家船只展示行为。

## ADDED Requirements

### Requirement: Live Binding Market Context

系统 SHALL 只在 active save binding 和其当前 archive 上下文中提供市场报价数据。

#### Scenario: 使用 active binding 数据

**前提** 用户已打开一个 live save binding
**并且** 该 binding 的当前 archive 与 parser schema 均可用
**当** 用户进入市场报价页面
**那么** 系统 MUST 使用该 binding 的 groups、stationPlans、当前 NPC offers 和 player ships
**并且** 系统 MUST NOT 回退到其他 archive

#### Scenario: 数据上下文不可用

**前提** active binding 缺失、archive 不兼容或必要 schema 不可用
**当** 用户进入市场报价页面
**那么** 页面 MUST 显示明确不可用状态
**并且** 页面 MUST NOT 将缺失报价解释为零报价

#### Scenario: 隐藏存档元数据

**前提** 市场报价页面已加载
**当** 页面渲染条件与结果
**那么** 页面 MUST NOT 显示当前存档名称
**并且** 页面 MUST NOT 显示 archive 快照时间

### Requirement: Three Column Market Layout

系统 SHALL 使用左 3、中 5、右 4 的十二列响应式布局展示市场报价工作区。

#### Scenario: 宽屏三列布局

**前提** viewport 达到 `lg` breakpoint
**当** 市场报价工作区渲染
**那么** 条件列 MUST 占 3/12
**并且** NPC 候选列 MUST 占 5/12
**并且** 玩家船只列 MUST 占 4/12

#### Scenario: 窄屏纵向布局

**前提** viewport 小于 `lg` breakpoint
**当** 市场报价工作区渲染
**那么** 三列 MUST 按条件、候选、船只顺序纵向堆叠

### Requirement: Organized Player Station Selection

系统 SHALL 只从玩家已整理的 binding sector groups 和 stations 选择玩家端交易空间站。

#### Scenario: 按 sector group 展示 station

**前提** active binding 包含 groups、stationPlans 和可选 tradeStation
**当** presenter 构造玩家空间站选择器
**那么** 选择器 MUST 按 group order 展示 sector group
**并且** 每个 group 下 MUST 展示其 stationPlans 和已绑定 tradeStation
**并且** 选择器 MUST NOT 平铺 archive 原始 player_stations

#### Scenario: station 缺少 sector

**前提** 整理后的 station 无法解析到 sectorMacro
**当** 用户查看该 station entry
**那么** entry MUST 为不可选择状态并显示原因
**并且** 系统 MUST NOT 从其他 station 或 archive 字段 fallback sector

### Requirement: Direction First Ware Selection

系统 SHALL 先使用一个全局玩家交易方向，再添加一个或多个带目标数量的 ware。

#### Scenario: 玩家买入方向

**前提** 用户选择“玩家买入”
**当** 系统查询 NPC 报价
**那么** 系统 MUST 只消费 NPC station 直属 seller offers

#### Scenario: 玩家卖出方向

**前提** 用户选择“玩家卖出”
**当** 系统查询 NPC 报价
**那么** 系统 MUST 只消费 NPC buyer demands

#### Scenario: 多语言商品搜索

**前提** 用户在商品搜索框输入文本
**当** 系统生成搜索结果
**那么** 系统 MUST 复用既有 grouped ware search
**并且** 搜索 MUST 匹配当前语言名称、英文原名和 ware ID

#### Scenario: 点击结果添加药丸

**前提** 某 ware 尚未被选择
**当** 用户点击该搜索结果
**那么** 页面 MUST 添加一个唯一 ware 药丸
**并且** 药丸 MUST 提供目标数量和移除操作

#### Scenario: 数量指标缺少目标数量

**前提** 某 ware 的目标数量不是正数
**当** 用户选择依赖目标数量的排序
**那么** 页面 MUST 提示该 ware 需要目标数量
**并且** 系统 MUST NOT 自动使用 0、1 或 offer amount fallback

### Requirement: Complete NPC Station Identity

系统 SHALL 为每个 NPC 候选显示足以定位和识别空间站的上下文，不得只显示 station code。

#### Scenario: 展示候选身份

**前提** NPC station 存在匹配报价
**当** presenter 生成 station card
**那么** card MUST 显示本地化 sector、可解析的本地化 station 名称或类型、station code、本地化 faction 和派生 race

#### Scenario: race 无法推导

**前提** station owner faction 没有显式 race 映射
**当** presenter 生成 station card
**那么** race MUST 显示未知状态
**并且** 系统 MUST NOT 根据 station code 或外观猜测 race

### Requirement: Station Offer Hierarchy

系统 SHALL 在 station 内按来源展示玩家卖出需求，并仅使用 station 直属卖单满足玩家买入。

#### Scenario: 展示三类 NPC 需求

**前提** 同一 station/ware 同时存在普通直属 buy、`supplies` buy 和 buildStorage buy
**当** 页面处于玩家卖出方向
**那么** station card MUST 分别显示空间站自身、空间站补给和建材仓库需求
**并且** 三条需求 MUST 保持各自 price、amount 和 desired

#### Scenario: 建材仓库归入空间站

**前提** station 具有唯一关联的 buildStorage
**当** 页面生成候选列表或 sector 分组
**那么** buildStorage MUST 作为该 station 的子需求显示
**并且** buildStorage MUST NOT 成为独立 station 或 sector candidate

#### Scenario: 玩家买入使用 station seller

**前提** 页面处于玩家买入方向
**当** 系统读取某 station/ware 报价
**那么** 系统 MUST 使用 station 直属 seller offer
**并且** 系统 MUST NOT 将 buildStorage buy 或 supplies buy 当作卖单

#### Scenario: 零数量报价

**前提** 匹配 offer 的 amount 为 0
**当** 页面显示该 offer
**那么** 页面 MUST 显示数量 0
**并且** 页面 MUST NOT 显示“数据缺失”替代该数值

### Requirement: Direction Aware Single Ware Sorting

系统 SHALL 按交易方向和选定指标稳定排序 station，并在玩家卖出时从需求子单中选出代表值。

#### Scenario: 玩家卖出按数量或价格

**前提** 同一 station/ware 有多个需求子单
**当** 排序指标为数量或价格
**那么** station 代表数量 MUST 为子单最高 amount
**并且** station 代表价格 MUST 为子单最高 price

#### Scenario: 玩家卖出按满足数量后的价格

**前提** ware 具有正 targetQty
**当** 排序指标为满足目标数量后的价格
**那么** 系统 MUST 仅比较 `amount >= targetQty` 的需求子单
**并且** station 代表价格 MUST 为合格子单最高 price
**并且** 无合格子单的 station MUST 位于足量 station 之后

#### Scenario: 玩家卖出按目标总收入

**前提** ware 具有正 targetQty
**当** 排序指标为目标总收入
**那么** 每个需求子单的收入 MUST 为 `min(amount, targetQty) × price`
**并且** station 代表收入 MUST 取子单最高值并从高到低排序

#### Scenario: 玩家买入按价格

**前提** 页面处于玩家买入方向
**当** 排序指标为价格
**那么** station seller offers MUST 按 price 从低到高排序

#### Scenario: 玩家买入按目标总成本

**前提** ware 具有正 targetQty
**当** 排序指标为目标总成本
**那么** 足量 seller offer MUST 排在不足量 offer 之前
**并且** 足量 offer MUST 按 `targetQty × price` 从低到高排序

### Requirement: Multiple Ware Ranking

系统 SHALL 为多 ware 查询提供主商品排序和方向化综合排序。

#### Scenario: 主商品排序

**前提** 用户选择多个 ware 并指定一个主商品
**当** 使用主商品排序
**那么** station MUST 按主商品的当前单商品 comparator 排序
**并且** 缺失主商品报价的 station MUST 位于存在报价的 station 之后

#### Scenario: 玩家卖出综合排序

**前提** 页面处于玩家卖出方向且选择多个 ware
**当** 使用综合排序
**那么** station MUST 依次按完全满足商品数、平均满足比例、可卖总数量和预计总收入从高到低比较

#### Scenario: 玩家买入综合排序

**前提** 页面处于玩家买入方向且选择多个 ware
**当** 使用综合排序
**那么** station MUST 依次按完全满足商品数、平均满足比例和可买总数量从高到低比较
**并且** 前述指标相同时 MUST 按预计总成本从低到高比较

#### Scenario: 某商品缺失报价

**前提** station 缺少一个已选 ware 的匹配 offer
**当** 系统计算综合排名
**那么** 该 ware 的满足比例和可成交数量 MUST 为 0
**并且** 系统 MUST NOT 使用其他 ware 的 offer fallback

### Requirement: Sector Grouped Candidate Ranking

系统 SHALL 允许在全局 station 列表与 sector 分组列表之间切换，并以 sector 内最高 station 排序 sector。

#### Scenario: 关闭 sector 分组

**前提** sector 分组开关关闭
**当** 页面显示候选
**那么** 页面 MUST 按当前 comparator 显示全局 station 列表

#### Scenario: 开启 sector 分组

**前提** sector 分组开关开启
**当** 页面显示候选
**那么** 每个 sector 的排名 MUST 取该 sector 内最高 station 的排名
**并且** sector 内 station MUST 使用同一 comparator
**并且** 分组 MUST NOT 改写 station 的业务分数

### Requirement: Available Player Ships By Sector

系统 SHALL 在右列按 sector 展示可立即调用或可收回的玩家船只，并显示命中的玩家 sector groups。

#### Scenario: 过滤可展示船只

**前提** archive player ships 已完成可用性分类
**当** presenter 生成船只列表
**那么** 列表 MUST 只包含 `immediatelyAvailable` 和 `reclaimable`
**并且** `unavailable` 与 `unknown` MUST NOT 被伪装为可用

#### Scenario: sector 命中多个 group

**前提** 某 ship sector 同时命中多个 binding group 的 anchor 或 coverage
**当** presenter 生成 sector header
**那么** header MUST 显示本地化 sector 名
**并且** header MUST 显示所有命中的 group 名称

#### Scenario: 不推导剩余货舱容量

**前提** 当前 archive 没有可靠的 remaining cargo capacity contract
**当** 页面显示船只
**那么** 页面 MUST NOT 声称船只可装载某个目标数量
**并且** 页面 MUST NOT 按推测容量过滤船只

### Requirement: Store Presenter Vue Boundary

市场报价功能 SHALL 严格采用 `store -> presenter -> vue` 三层结构。

#### Scenario: 领域计算归属

**前提** 系统需要分类报价、计算目标数量或 station 排名
**当** 实现市场报价逻辑
**那么** 可复用领域计算 MUST 位于 store/logic
**并且** store MUST NOT 输出某个 Vue 组件专用结构

#### Scenario: UI 数据组装归属

**前提** 页面需要 station cards、sector groups 或 ship groups
**当** 系统组装展示数据
**那么** 组装 MUST 位于 presenter
**并且** Vue MUST 只消费 presenter props 和 emits
**并且** Vue MUST NOT 直接访问 store 或新增中间层
