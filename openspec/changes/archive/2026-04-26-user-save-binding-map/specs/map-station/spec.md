# Map Station Specification

## Purpose
调整地图 save binding 工作流，使地图面板以独立 binding store 为数据源，并把 Step 2/Step 3 从"逐个绑定 empire station"改为"星区覆盖自动派生 save station + 按需规划模块"。

## ADDED Requirements

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

## MODIFIED Requirements

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
