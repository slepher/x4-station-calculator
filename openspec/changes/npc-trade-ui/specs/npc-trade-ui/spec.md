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

#### Scenario: 地图预览不改变 binding archive

**前提** 用户在地图预览了其他 archive，且预览没有改变 binding 的 `selectedArchiveTime`
**当** 用户进入市场报价页面
**那么** 系统 MUST 仍使用 `gameGuid + selectedArchiveTime` 精确解析当前 binding archive
**并且** `selectedArchiveTime=null` 时 MUST 使用该 binding 最新有效 archive
**并且** 系统 MUST NOT 使用仍留在全局预览状态中的其他 archive

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

**前提** active binding 包含 groups，且左侧导航已按 binding scope 生成玩家空间站
**当** presenter 构造玩家空间站选择器
**那么** 一级菜单 MUST 按 group order 展示 sector group
**并且** 二级菜单 MUST 展示左侧归入当前一级 group 的玩家空间站
**并且** 二级菜单 MUST 加入当前 group 未绑定实际站的虚拟 tradeStation
**并且** 选择器 MUST NOT 跨 group 平铺 archive 原始 player_stations

#### Scenario: 二级菜单标签与占位

**前提** 用户已选择 sector group
**当** 用户展开玩家空间站二级菜单
**那么** 每个 option MUST 使用 `<sector>-<station>` 格式显示本地化星区名和空间站名称
**并且** 用户选中空间站后，“选择空间站”占位 MUST NOT 继续作为 option 显示

#### Scenario: 使用稳定 group 关联键

**前提** virtual station draft 被写入 save binding
**当** 系统设置 `stationPlan.groupId`
**那么** groupId MUST 使用 binding group 的稳定 `sectorMacro`
**并且** 系统 MUST NOT 保存 auto-group 临时 `group.id`

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

#### Scenario: 空查询展示全部未选商品

**前提** 市场报价商品搜索框获得焦点
**并且** 搜索文本为空
**当** 系统生成候选
**那么** 系统 MUST 从当前游戏版本 `wares.json` 对应的本地化 ware map 读取全部商品
**并且** 系统 MUST 只排除已经加入目标药丸的 ware
**并且** 候选 MUST 按 ware 的现有 group 分组
**并且** group 为空的合法 ware MUST 归入 `others`
**并且** `others` 标题 MUST 使用应用 UI locale 的 `common.others`
**并且** 系统 MUST NOT 从 X4 游戏文本 locale 或 `module_groups.json` 读取该标题

#### Scenario: 商品候选不依赖报价或生产能力

**前提** 某 ware 存在于当前游戏版本 `wares.json`
**并且** 当前 archive 没有该 ware 的 NPC 报价，或该 ware 没有 production module
**当** 市场报价生成商品候选
**那么** 该 ware MUST 仍可进入候选
**并且** presenter MUST NOT 使用实际报价集合或生产模块集合缩减候选

#### Scenario: TEMP 商品由数据生成阶段排除

**前提** 游戏数据生成阶段已将 TEMP/内部 ware 排除出 `wares.json`
**当** 市场报价生成商品候选
**那么** 被排除的 ware MUST NOT 出现在候选中
**并且** 市场报价 presenter 与 Vue MUST NOT 维护 TEMP ID、名称模式或报价白名单

#### Scenario: 候选框向右弹出

**前提** 商品搜索框具有一个或多个候选
**当** 搜索框获得焦点
**那么** 分组候选框 MUST 锚定条件 panel 并向右弹出
**并且** 候选框 MUST 通过 Teleport 避免被左列裁剪

#### Scenario: 点击结果添加药丸

**前提** 某 ware 尚未被选择
**当** 用户点击该搜索结果
**那么** 页面 MUST 添加一个唯一 ware 药丸
**并且** 药丸 MUST 使用现有 `X4NumberInput` 提供目标数量
**并且** 药丸 MUST 提供移除操作
**并且** 候选框 MUST 在选择完成后关闭

#### Scenario: 数量指标缺少目标数量

**前提** 某 ware 的目标数量不是正数
**当** 用户选择依赖目标数量的排序
**那么** 对应排序选项 MUST 被禁用
**并且** 页面 MUST 指出缺少正目标数量的 ware
**并且** 系统 MUST NOT 自动使用 0、1 或 offer amount fallback

### Requirement: Reusable Grouped Candidate Controls

系统 SHALL 使用两个无 store 依赖的联动 common 控件承载商品和模块的搜索输入与右侧分组候选框。

#### Scenario: 搜索框与弹出框职责分离

**前提** 某功能需要搜索并选择分组候选
**当** Vue 组合共用控件
**那么** 搜索框 MUST 负责 query、focus/blur、清空、Escape 和右侧锚点定位
**并且** 弹出框 MUST 负责 Teleport、分组标题、候选行、颜色和可选 DLC 标签
**并且** 两个控件 MUST NOT 直接读取 store

#### Scenario: Presenter 组装候选展示数据

**前提** 市场报价、BuildPlan 或空间站模块选择需要渲染候选
**当** 系统生成 common 控件的 groups/items
**那么** 对应 presenter MUST 组装标签、颜色、DLC 状态和候选 ID
**并且** Vue MUST 只消费 presenter 输出并转发选择事件

#### Scenario: 复用商品与模块候选交互

**前提** 用户使用市场报价商品、BuildPlan 商品/模块或空间站模块选择
**当** 用户聚焦相应搜索框
**那么** 这些入口 MUST 复用同一搜索框和分组弹出框控件
**并且** 每个入口 MUST 保持自身既有候选过滤与选择后的领域动作

#### Scenario: 舰队搜索保持独立

**前提** BuildPlan 类别切换为舰队
**当** 用户搜索舰船与蓝图
**那么** 系统 MUST 继续使用 `FleetGoalSearchBox`
**并且** 系统 MUST NOT 将舰队候选强制转换为商品/模块分组 DTO

### Requirement: Complete NPC Station Identity

系统 SHALL 为每个 NPC 候选显示足以定位和识别空间站的上下文，不得只显示 station code。

#### Scenario: 展示候选身份

**前提** NPC station 存在匹配报价
**当** presenter 生成 station card
**那么** card MUST 显示本地化 sector、与地图 station tooltip 同源的本地化 station 名称、station code 和本地化 faction
**并且** card MUST NOT 显示 race

#### Scenario: 复用地图 station label

**前提** station 具有 factory profile、station tag 或其他地图 tooltip 已支持的身份
**当** presenter 生成 station card
**那么** station 名称 MUST 复用地图 tooltip 的 station label helper
**并且** 系统 MUST NOT 在市场报价 presenter 内建立另一套名称 fallback 链

### Requirement: Station Offer Hierarchy

系统 SHALL 在 station 内按来源展示玩家卖出需求，并仅使用 station 直属卖单满足玩家买入。

#### Scenario: 展示三类 NPC 需求

**前提** 同一 station/ware 同时存在普通直属 buy、`supplies` buy 和 buildStorage buy
**当** 页面处于玩家卖出方向
**那么** station card MUST 分别显示空间站自身、空间站补给和建材仓库需求
**并且** 三条需求 MUST 保持各自 price、amount 与原始可选 desired
**并且** 排序和展示 MUST NOT 使用 desired fallback amount

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

#### Scenario: 零数量报价已过滤

**前提** 原始存档 offer 缺少 `amount` 或 `amount` 为 0
**当** 页面读取 parser archive
**那么** 页面 MUST NOT 显示该买单或卖单

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

系统 SHALL 在右列按 sector 展示符合用途和尺寸约束、可立即调用或可收回的玩家运输船，并显示其身份、容量、所选 ware 最大可装数量和命中的玩家 sector groups。

#### Scenario: 过滤可展示船只

**前提** archive player ships 已完成可用性分类
**当** presenter 生成船只列表
**那么** 列表 MUST 只包含 `immediatelyAvailable` 和 `reclaimable`
**并且** `unavailable` 与 `unknown` MUST NOT 被伪装为可用

#### Scenario: 按用途和尺寸过滤船只

**前提** 当前 archive 包含多种玩家船只
**当** presenter 生成船只列表
**那么** 列表 MUST 只包含 class 为 L 的 `freighter`
**并且** 列表 MUST 只包含 class 为 M 的 `transporter`
**并且** 其他用途或尺寸的船只 MUST NOT 显示

#### Scenario: sector 命中多个 group

**前提** 某 ship sector 同时命中多个 binding group 的 anchor 或 coverage
**当** presenter 生成 sector header
**那么** header MUST 显示本地化 sector 名
**并且** header MUST 显示所有命中的 group 名称

#### Scenario: 展示飞船身份

**前提** 船只 macro 可关联游戏静态飞船数据
**当** 页面显示船只
**那么** 页面 MUST 显示本地化飞船名、本地化型号、L/M 尺寸和可用性
**并且** 页面 MUST NOT 显示 component ID 或船只代码

#### Scenario: 展示有效自定义名称

**前提** 存档船只存在 `name`
**当** 页面判断是否额外显示自定义名称
**那么** 非空且不匹配 `{数字,数字}` 的名称 MUST 显示
**并且** `{30226,204}` 这类未解析本地化 token MUST NOT 作为自定义名称显示

#### Scenario: 展示容量与最大可装数量

**前提** 页面已选择一个或多个目标 ware
**当** 页面显示船只
**那么** 页面 MUST 显示静态飞船货舱容量
**并且** 页面 MUST 逐一显示所有所选 ware 在空货舱下的最大可装数量
**并且** transport 匹配且 `ware.volume > 0` 时数量 MUST 为 `floor(cargoCapacity / ware.volume)`
**并且** transport 不匹配或 volume 无效时数量 MUST 为 0
**并且** 左侧 targetQty 与存档当前 cargo MUST NOT 影响该数量

### Requirement: Relative Position To Selected Player Station

系统 SHALL 在选择玩家空间站后为 NPC station 与玩家船只显示相对位置。

#### Scenario: 按最大跳数过滤

**前提** 用户已选择玩家空间站
**当** 用户通过现有 `X4NumberInput` 设置最大跳数
**那么** NPC station 与玩家船只 MUST 同时只保留跳数小于等于该值的对象
**并且** 同 sector MUST 按 0 跳参与过滤
**并且** 不同 sector MUST 使用当前地图图动态计算
**并且** 计算 MUST NOT 受静态 reachability 缓存的 5 跳生成范围限制
**并且** 跳数未知的对象 MUST 被排除

#### Scenario: 同 sector 显示距离

**前提** 目标 NPC station 或玩家船只与所选玩家空间站具有相同 `sectorMacro`
**并且** 两端均具有有效存档坐标
**当** 页面显示目标对象
**那么** 页面 MUST 显示两端三维坐标的直线距离
**并且** 页面 MUST NOT 显示 0 跳替代距离

#### Scenario: 解析已绑定实际站坐标

**前提** 所选 station entry 具有 `saveStationCode` 但 binding 中未保存 position
**当** 系统需要计算相对位置
**那么** presenter MUST 从当前 binding archive 的对应玩家 station 精确解析 position

#### Scenario: 虚拟站使用星区中心

**前提** 所选 station entry 是虚拟站且具有有效 `sectorMacro`
**当** 系统需要计算相对位置
**那么** presenter MUST 使用地图数据中该 sector 的 zone bounding center
**并且** presenter MUST NOT 将 `(0,0,0)` 作为星区中心 fallback
**并且** sector 无法解析时 MUST 保持 position unknown

#### Scenario: 不同 sector 显示跳数

**前提** 目标对象与所选玩家空间站的 `sectorMacro` 不同
**当** 当前地图图存在两 sector 之间的路径
**那么** 页面 MUST 显示跳数
**并且** 同一 cluster 的不同 sector MAY 显示 0 跳

#### Scenario: 相对位置数据缺失

**前提** 同 sector 坐标缺失，或不同 sector 的地图节点/路径缺失
**当** 页面显示目标对象
**那么** 页面 MUST 显示距离未知
**并且** 系统 MUST NOT 从其他 archive、sector 或坐标 fallback

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
