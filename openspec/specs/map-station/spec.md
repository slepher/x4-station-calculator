# map-station Specification

## Purpose
TBD - created by archiving change map-station. Update Purpose after archive.
## Requirements
### Requirement: Map Station Placement Entry
系统 MUST 在 map 页面提供空间站工作入口，并以左侧工作面板形式承载对象放置能力。

#### Scenario: 默认入口位置
- **前提** 用户位于 map 页面
- **当** 页面完成渲染
- **那么** 系统 SHALL 在左下角显示“空间站 + 图标”的入口按钮
- **并且** 按钮 SHALL 使用文字 + 图标形式
- **并且** 其地图覆盖层级 SHALL 与现有地图入口控件一致

#### Scenario: 点击入口展开工作面板
- **前提** 用户位于 map 页面
- **并且** 空间站面板当前未展开
- **当** 用户点击空间站入口按钮
- **那么** 系统 SHALL 切换为左侧工作面板 + 地图布局
- **并且** 左侧工作面板 SHALL 显示当前 empire 的可放置对象列表

#### Scenario: 左侧工作面板按 empire sector 分组
- **前提** 空间站面板已打开
- **当** 用户查看面板内容
- **那么** 系统 SHALL 按 `activeEmpire.sectors` 的当前排序显示分组
- **并且** 每个分组 SHALL 列出对应 `sector transit` 与其下属 `station`
- **并且** `station.sectorId` 为空的对象 SHALL 显示在“未分配”分组

#### Scenario: 空间站面板内搜索与清空
- **前提** 空间站面板已打开
- **当** 用户在面板搜索框输入关键词
- **那么** 系统 SHALL 仅过滤空间站面板中的对象列表
- **并且** SHALL NOT 影响地图右上角星区搜索框
- **当** 用户点击搜索框清空入口
- **那么** 系统 SHALL 清空面板搜索内容并恢复未过滤列表

#### Scenario: 面板滚动与列表文案精简
- **前提** 空间站面板已打开
- **当** 用户查看列表内容
- **那么** 系统 SHALL 使用整个面板主体共享的统一滚动容器
- **并且** SHALL NOT 为分组分别创建独立滚动区域
- **并且** 列表项 SHALL NOT 显示 `station`、`sector transit`、`未放置` 这类状态字样
- **并且** 列表拖拽入口 SHALL 以拖动手柄呈现，而不是“拖动到地图”文案
- **并且** 列表项左侧对象图标 SHALL 与星图 overlay 使用同源 SVG 与接近尺寸

#### Scenario: 关闭面板时隐藏空间站相关内容
- **前提** 用户当前处于空间站工作态
- **当** 用户关闭空间站面板
- **那么** 系统 SHALL 隐藏地图上的空间站相关 overlay、预览与拖拽辅助内容
- **并且** 基础星图 sector 渲染 SHALL 保持可见

### Requirement: Station And Sector Transit Placement Sources
系统 MUST 将当前 empire 的 `stations` 与 `sectors` 作为 map 放置对象源。

#### Scenario: 面板展示当前 empire 对象
- **前提** 当前存在 `activeEmpire`
- **当** 空间站面板渲染
- **那么** 系统 SHALL 展示当前 empire 的全部 `stations`
- **并且** 系统 SHALL 展示当前 empire 的全部 `sectors`

#### Scenario: Sector object acts as transit placement
- **前提** 面板中存在 empire `sector`
- **当** 用户查看该对象的地图用途
- **那么** 系统 SHALL 将其解释为“星区中转点”
- **并且** 其放置目标 SHALL 为任意地图 sector

### Requirement: Drag To Map Sector And Save Raw Position
系统 MUST 支持将 `station` 或 `sector transit` 拖入目标地图 sector，并以原始坐标保存落点。

#### Scenario: 拖拽预览与 overlay 使用类型图标
- **前提** 用户正在拖拽或查看已放置对象
- **当** 系统渲染拖拽 ghost、拖拽预览或地图 overlay
- **那么** 普通 `station` SHALL 使用 `factory.svg`
- **并且** `station.type === shipyard` SHALL 使用 `shipyard.svg`
- **并且** `sector transit` SHALL 使用 `tradestation.svg`

#### Scenario: 拖入 station 到地图星区
- **前提** 当前 empire 中存在某个 `station`
- **当** 用户将该 `station` 拖入任意目标地图 sector
- **那么** 系统 SHALL 为该 `station` 写入 `location`
- **并且** `location.cluster_id` SHALL 等于目标地图 sector 所属 cluster id
- **并且** `location.sector_id` SHALL 等于目标地图 sector id

#### Scenario: 拖入 sector transit 到地图星区
- **前提** 当前 empire 中存在某个 `sector`
- **当** 用户将该 `sector` 作为中转点拖入任意目标地图 sector
- **那么** 系统 SHALL 为该 `sector` 写入 `location`
- **并且** `location.sector_id` SHALL 指向被放入的目标地图 sector id

#### Scenario: 保存原始坐标
- **前提** 用户在目标地图 sector 内完成拖放
- **当** 系统计算落点
- **那么** `location.pos` SHALL 保存原始 `{x, z}` 坐标
- **并且** 系统 SHALL NOT 持久化归一化比例坐标

### Requirement: Placement Metadata Snapshot
系统 MUST 在写入 `location` 时同步快照目标地图 sector 的环境信息。

#### Scenario: 写入 sunlight 与 resources
- **前提** 用户已将对象放入目标地图 sector
- **当** 系统生成 `location`
- **那么** `location.sunlight` SHALL 等于目标地图 sector 的 sunlight
- **并且** `location.resources` SHALL 等于目标地图 sector 资源的 ware id 列表
- **并且** `location.resources` SHALL 仅保存字符串数组

### Requirement: Placement Update And Clear
系统 MUST 支持已放置对象的再次微调与清除位置。

#### Scenario: 已放置对象继续微调
- **前提** 某个 `station` 或 `sector transit` 已有 `location`
- **并且** 空间站面板当前处于打开状态
- **当** 用户继续拖动该对象
- **那么** 系统 SHALL 更新既有 `location`
- **并且** SHALL NOT 创建重复对象

#### Scenario: 面板内清除位置
- **前提** 某个对象当前已有 `location`
- **当** 用户在空间站面板执行清除位置/取消放置
- **那么** 系统 SHALL 移除该对象的 `location`
- **并且** 该对象 SHALL 恢复为未放置状态

#### Scenario: 点击已放置对象时 focus 到对象自身 overlay
- **前提** 某个 `station` 或 `sector transit` 当前已有 `location`
- **并且** 空间站面板已打开
- **当** 用户点击该对象在面板分组中的列表项
- **那么** 系统 SHALL focus 到该对象自身的地图 overlay 落点
- **并且** 系统 SHALL 高亮该对象自身 overlay
- **并且** SHALL NOT 额外高亮目标地图星区
- **并且** 已放置项 SHALL 以 tag 形式显示目标地图星区的本地化名称
- **并且** 清除位置操作 SHALL 以内嵌小图标形式出现在该 tag 内
- **并且** SHALL NOT 显示 `sector_id` 与坐标

### Requirement: Binding Entry in Save Homepage

系统 MUST 从存档首页打开或创建独立 save binding。

**变更说明**：扩展了原来的 Scenario，增加 time binding 图标和 dirty empire 保存确认流程。

#### Scenario: 用户点击 guid binding 图标
- **前提** 用户位于存档首页
- **当** 用户点击某个 `gameGuid` 的 binding 图标
- **那么** 系统 SHALL 打开或创建该 `gameGuid` 的唯一 binding
- **并且** SHALL 进入 binding group 编辑视图
- **并且** SHALL 将量化生产 active source 切换为该 `gameGuid` 对应的 `save-binding`

#### Scenario: 用户点击 time binding 图标
- **前提** 用户位于存档首页某个 time 条目
- **当** 用户点击该 time 的 binding 图标
- **那么** 系统 SHALL 打开同一 `gameGuid` 的 binding
- **并且** SHALL 将 `selectedArchiveTime` 设置为该 time
- **并且** SHALL 将量化生产 active source 切换为该 `gameGuid` 对应的 `save-binding`

#### Scenario: dirty empire 点击 binding 图标
- **前提** 用户位于存档首页
- **并且** 量化生产当前 active source 是 `empire`
- **并且** 当前 active empire 存在 dirty 改动
- **当** 用户点击某个 `gameGuid` 的 binding 图标
- **那么** 系统 SHALL 显示与 dirty empire 点击新建按钮相同语义的保存确认界面
- **当** 用户选择保存
- **那么** 系统 SHALL 先保存当前 empire，再打开或创建该 `gameGuid` 的 binding
- **并且** SHALL 将量化生产 active source 切换为该 `gameGuid` 对应的 `save-binding`
- **当** 用户选择放弃
- **那么** 系统 SHALL 放弃当前 empire 改动，再打开或创建该 `gameGuid` 的 binding
- **并且** SHALL 将量化生产 active source 切换为该 `gameGuid` 对应的 `save-binding`
- **当** 用户关闭或取消确认
- **那么** 系统 SHALL NOT 打开 binding
- **并且** SHALL NOT 切换量化生产 active source

### Requirement: Step 2 Sector Group Editing

系统 MUST 提供 Step 2 星区组编辑能力。

#### Scenario: 用户编辑 empire sector
- **前提** 用户已进入 Step 2
- **当** 用户展开某个 empire sector
- **那么** 系统 SHALL 允许编辑名称、定位星区、jumpRange、coverage 与连接星区

### Requirement: Step 3 Station Binding

系统 MUST 提供 Step 3 空间站绑定能力。

#### Scenario: 用户在 Step 3 绑定空间站
- **前提** 用户已进入某个 empire sector 的 Step 3
- **当** 用户通过 save station 的绑定入口选择候选 empire station
- **那么** 系统 SHALL 建立或更新对应 station binding

### Requirement: Save Parser Exposes Station Buildstorage Reference

系统 MUST 为 player station 和 buildstorage 保留各自顶层结果，并通过 code 建立引用。

#### Scenario: parser 解析存在 inprogress build 的 player station
- **前提** save 中某个 `component[@class="buildstorage"][@owner="player"]` 存在 `buildtasks/inprogress/build`
- **并且** `build/@component` 命中某个 `component[@class="station"]/@id`
- **当** 系统完成 save parser 提取
- **那么** 对应 `playerStation` SHALL 包含 `component_id`
- **并且** SHALL 包含 station 自己的 `cargo`
- **并且** SHALL 包含 station 自己的 `reservation`
- **并且** SHALL 通过 `buildstorage_code` 保存关联的 buildstorage code
- **并且** 对应 `buildstorage` SHALL 保留在同一 sector 的 `player_buildstorages` 中
- **并且** 对应 `buildstorage` SHALL 通过 `station_code` 保存关联的 station code

#### Scenario: parser 为 buildstorage 提供简洁结构
- **前提** save 中某个 player buildstorage 已命中 player station
- **当** 系统完成 save parser 提取
- **那么** `buildstorage` SHALL 包含：
  - `component_id`
  - `cargo`
  - `reservation`
  - `constructions`
  - `modules`
  - `equipments`
  - `progress`
- **并且** `component_id` 与 `constructions[].id` SHALL 去掉外层 `[]`
- **并且** `constructions[].equipments` SHALL 被保留
- **并且** `progress` SHALL 仅包含 `start`、`end`、`sequenceindex`
- **并且** 系统 SHALL 不解析 `buildtasks/queue/build`

#### Scenario: parser collections use snake_case code maps
- **当前提** 系统完成 save parser 提取
- **那么** `SectorData` 中按 `code` 唯一的实体集合 SHALL 使用 `snake_case`
- **并且** `player_stations` / `npc_stations` / `xenon_stations` / `khaak_stations` / `player_buildstorages` / `datavaults` / `erlking_vaults` / `abandoned_ships` SHALL 为 `Record<code, entry>`
- **并且** `modules` / `equipments` SHALL 为 `Record<ref, entry>`

#### Scenario: parser post enriches module and equipment ids
- **前提** Rust parser 已输出原始聚合 `modules` / `equipments`
- **当** 系统执行 `postProcessRustSaveArchive()`
- **那么** 所有 station 与 `player_buildstorage` 的 `modules[*]` SHALL 补充 `module_id`
- **并且** 所有 station 与 `player_buildstorage` 的 `equipments[*]` SHALL 补充 `equipment_id`
- **并且** `constructions[*].equipments[*]` SHALL 保持 parser 原样，不在 post 中 enrich

### Requirement: Binding State Separation

系统 MUST 将 binding 状态与首页 active 状态彻底分离。

#### Scenario: binding 仅影响图标显示
- **前提** 用户位于存档首页
- **当** binding 激活状态改变
- **那么** 系统 SHALL 只更新 binding 图标状态
- **并且** SHALL NOT 改变首页容器或 time 条目的 active 高亮

### Requirement: SavePanel Manages activeArchiveId

系统 MUST 由 savePanel 独占管理 `activeArchiveId`。

#### Scenario: 地图层不回写 activeArchiveId
- **前提** 用户在地图层操作
- **当** 地图层显示某份 archive
- **那么** 系统 SHALL 只接收"显示哪份 archive"的事件
- **并且** SHALL NOT 通过事件回写 `saveStore.activeArchiveId`

### Requirement: Step 2 Binding Group Editing

系统 MUST 在 Step 2 编辑 binding groups，而不是 empire sectors。

#### Scenario: 用户编辑 binding group
- **前提** 用户已进入 Step 2
- **当** 用户创建、重命名、排序或展开某个 group
- **那么** 系统 SHALL 读写独立 binding store 中的 groups
- **并且** SHALL NOT 读写 `activeEmpire.sectors`

#### Scenario: 用户通过定位星区菜单新建 binding group
- **前提** 用户已进入 Step 2
- **当** 用户点击新建星区
- **那么** 系统 SHALL 弹出与编辑 group 定位星区相同的 save sector 候选菜单
- **并且** SHALL 使用相同的候选禁用逻辑
- **当** 用户点击一个可用 save sector
- **那么** 系统 SHALL 展开新的 group draft
- **并且** SHALL 将该 save sector 设置为新 group 的 `sectorMacro`
- **并且** SHALL 将新 group 名称默认设置为该 save sector 的显示名称

### Requirement: Step 2 Candidate Sector Locking

系统 MUST 在 Step 2 区分"锁定可见"和"可加入"的候选星区。

#### Scenario: 候选星区被其他 group 占用
- **前提** 用户已进入 Step 2 某个 group 编辑态
- **并且** 某个 map sector 已被其他 group 用作定位星区或 coverage
- **当** 系统显示候选星区列表
- **那么** 系统 SHALL 在 candidate 列表中显示该 map sector
- **并且** SHALL 使用锁定样式展示
- **并且** SHALL NOT 显示 `+`
- **并且** SHALL NOT 允许该 map sector 加入当前 group 的 coverage

#### Scenario: 当前 group 自己的 coverage 不受影响
- **前提** 用户打开某个已有 coverage 的 group 编辑
- **当** 系统显示候选星区列表
- **那么** 当前 group 自己已有的 coverage SHALL 保留
- **并且** SHALL NOT 被跨组占用规则误伤

### Requirement: Step 3 Derived Station Planning

系统 MUST 在 Step 3 显示 coverage 派生的 save stations 与用户创建的 station plans。

#### Scenario: 用户进入某个 group 的 Step 3
- **前提** group 已设置 coverage
- **当** 用户进入 Step 3
- **那么** 系统 SHALL 按 coverage 自动列出当前 archive 中的 save stations
- **并且** SHALL 显示已有 `BindingStationPlan`（包括 save-station 和 virtual-station）
- **并且** SHALL 显示星区中转站（如有）
- **并且** SHALL NOT 要求用户逐个绑定现有 save station

#### Scenario: 用户导入 station blueprint 规划
- **前提** 用户在 Step 3 选择了 blueprint empire
- **当** 用户将某个 station blueprint 的规划导入到 save station plan
- **那么** 系统 SHALL 在 binding 中创建或更新 planned modules
- **并且** SHALL NOT 修改 blueprint empire station

#### Scenario: 用户创建星区中转站
- **前提** 用户在 Step 3
- **当** 用户创建星区中转站
- **那么** 系统 SHALL 在 `BindingSectorGroup.tradeStation` 创建 `TradeStationBinding`
- **并且** 该 station SHALL NOT 参与量化生产计算

### Requirement: Auto TradeStation Creation

系统 MUST 在 group 创建时自动创建默认 tradestation。

#### Scenario: group 创建时自动创建 tradestation
- **前提** 用户在 Step 2 创建新 group
- **当** 用户选择定位星区并确认创建
- **那么** 系统 SHALL 自动创建 `TradeStationBinding`
- **并且** position SHALL 设置为星区中心坐标
- **并且** sectorMacro SHALL 设置为该 group 的定位星区
- **并且** 该 tradestation SHALL 显示在地图上
- **并且** 用户 SHALL NOT 需要手动拖拽创建

#### Scenario: Step 3 不显示中转站占位
- **前提** 用户进入 Step 3
- **当** 系统显示空间站列表
- **那么** 系统 SHALL NOT 显示"自由空间站"区域的中转站占位
- **并且** SHALL 显示 group 的默认 tradestation

### Requirement: Save Station TradeStation Binding

系统 MUST 支持 save station 与 tradestation 的单向一对一绑定。

#### Scenario: save station 绑定到 tradestation
- **前提** 用户在 Step 3
- **并且** group 已有默认 tradestation
- **并且** tradestation 未被绑定
- **当** 用户将某个 save station 绑定到该 tradestation
- **那么** 系统 SHALL 设置 `BindingStationPlan.saveStationCode` 为 tradestation 的 code
- **并且** 该 save station SHALL 使用 tradestation 的位置

#### Scenario: 已绑定 tradestation 不可再绑定
- **前提** 用户在 Step 3
- **并且** 某个 tradestation 已被 save station A 绑定
- **当** 用户尝试将 save station B 绑定到同一 tradestation
- **那么** 系统 SHALL 显示该 tradestation 已被绑定状态
- **并且** SHALL 禁用绑定操作

#### Scenario: save station 解绑 tradestation
- **前提** 用户在 Step 3
- **并且** save station 已绑定到 tradestation
- **当** 用户解绑该 save station
- **那么** 系统 SHALL 清除 `BindingStationPlan.saveStationCode`
- **并且** SHALL 将位置重置到星区中心点
- **并且** 该 save station SHALL 变为 virtual station
- **并且** tradestation SHALL 保留在原位置
- **并且** tradestation SHALL 可被其他 save station 绑定

### Requirement: Step 3 Binding Menu UI

系统 MUST 提供一致的绑定菜单 UI。

#### Scenario: 绑定按钮文字显示绑定状态
- **前提** 用户在 Step 3 查看 save station 列表
- **当** save station 未绑定任何 station plan
- **那么** 按钮 SHALL 显示"绑定"
- **当** save station 已绑定到普通 empire station
- **那么** 按钮 SHALL 显示已绑定 station 的名称（无名称时 fallback 到"绑定"）
- **当** save station 已绑定到 tradestation
- **那么** 按钮 SHALL 显示"星区中转站"
- **当** save station 存在异常绑定（stationBinding 存在但 stationId 无法解析）
- **那么** 按钮 SHALL 显示红色"绑定异常"

#### Scenario: 绑定菜单仅用视觉表达状态
- **前提** 用户打开 Step 3 绑定菜单
- **当** 系统显示候选列表
- **那么** 菜单项 SHALL 仅通过背景色、置灰表达状态
- **并且** SHALL NOT 显示"已设置位置""虚拟中转站"等备注文字

#### Scenario: 绑定菜单 Y 轴对齐
- **前提** 用户打开 Step 3 绑定菜单
- **当** 系统定位菜单
- **那么** 菜单 SHALL Y 轴对齐对应 station-item
- **当** 向下空间不足时
- **那么** 菜单 SHALL 改为向上弹出
- **并且** 菜单底边 SHALL 与触发条目底边齐平

#### Scenario: 绑定菜单滚动条统一样式
- **前提** 用户打开 Step 3 绑定菜单
- **当** 菜单内容需要滚动
- **那么** 滚动条样式 SHALL 与 Step 2 绑定菜单统一

### Requirement: Drag Interaction on Map

系统 MUST 在模块搜索面板与 Step 3 导入之间共享排序规则。

#### Scenario: 搜索面板使用共享 comparator
- **前提** 用户打开模块搜索面板
- **当** 系统显示搜索结果
- **那么** 组排序 SHALL 使用共享 type/group 优先级
- **并且** 组内模块排序 SHALL 使用共享 tier/name 规则

#### Scenario: Step 3 导入使用共享 comparator
- **前提** 用户在 Step 3 导入规划模块
- **当** 系统显示模块列表
- **那么** 排序规则 SHALL 与搜索面板使用同一套 comparator
- **并且** SHALL NOT 通过拍平搜索面板结果复用排序

系统 MUST 提供一致的拖拽交互。

#### Scenario: 拖拽自由空间站到地图
- **前提** 用户在 Step 3
- **当** 用户拖拽自由空间站到地图覆盖范围内
- **那么** 系统 SHALL 创建无 `saveStationCode` 的 `BindingStationPlan`
- **并且** SHALL 设置 position 和 sectorMacro

注：星区中转站已在 group 创建时自动创建，不再需要手动拖拽创建 `TradeStationBinding`。

#### Scenario: 拖拽已放置的 station
- **前提** 地图上已存在 binding station 或 trade station
- **当** 用户拖拽该 station 到新位置
- **那么** 系统 SHALL 移动该 station 的位置
- **并且** SHALL NOT 创建新的 station plan

### Requirement: Binding Save Status UI

系统 MUST 在 binding UI 中表达独立保存状态。

#### Scenario: binding 出现未保存改动
- **前提** 用户在地图 binding 面板中修改了 group、station plan 或 trade station
- **当** 改动尚未保存
- **那么** 系统 SHALL 显示 binding dirty 状态
- **并且** SHALL 在 save panel 的 binding 分支标题栏右侧提供取消、保存、关闭操作
- **并且** SHALL NOT 在量化生产界面提供保存 binding 或放弃 binding 改动的入口

#### Scenario: 用户关闭 dirty binding 面板
- **前提** binding 存在未保存改动
- **当** 用户关闭面板或切换到另一个 binding
- **那么** 系统 SHALL 提供保存、放弃或继续编辑的选择

