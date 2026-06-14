# auto-sector-group-enchanted Specification

## Purpose

增强 Col 2 编辑输入态，使用户可以编辑下一次自动分组的输入：固定或取消固定 hub、手动添加 hub、在同一跳数行内编辑范围/候选/连接 pill，并在 Col 3 中基于所有命中范围的 group option 确认最终吸收或独立方案。

## ADDED Requirements

### Requirement: 全局「节点」Checkbox

SectorConfirmBar SHALL 新增「节点」checkbox，位于桥接和阈值之间。该 checkbox SHALL 控制算法是否生成新的 pure hub。

#### Scenario: 默认启用

- **前提** 用户进入编辑输入态
- **当** 页面渲染 SectorConfirmBar
- **那么** 「节点」checkbox SHALL 处于勾选状态
- **并且** 阈值和覆盖下拉菜单 SHALL 处于可用状态

#### Scenario: clean slate 不可禁用

- **前提** 当前计算没有可作为初始输入的 baseline 或 pinned group
- **当** 页面渲染 SectorConfirmBar
- **那么** 「节点」checkbox SHALL 处于 disabled 状态
- **并且** checkbox SHALL 保持勾选
- **并且** 用户 SHALL NOT 能取消节点生成

#### Scenario: 增量场景可禁用

- **前提** 当前存在 baseline 或 pinned group
- **当** 用户取消勾选「节点」checkbox
- **那么** 阈值下拉菜单 SHALL 进入 disabled 状态
- **并且** 覆盖下拉菜单 SHALL 进入 disabled 状态
- **并且** 点击 [计算] 时算法 SHALL NOT 生成新的 pure hub

### Requirement: Hub 添加菜单

编辑态 [添加] SHALL 打开 hub 选择菜单。该菜单用于添加 hub draft group，而不是向某个已有 group 添加 coverage。

#### Scenario: 打开 hub 选择菜单

- **前提** 处于编辑输入态
- **当** 用户点击 [添加]
- **那么** 系统 SHALL 弹出 hub 选择菜单
- **并且** 菜单 SHALL NOT 作为普通页面流元素显示
- **并且** 「定位地图」按钮 SHALL 通过 prop 控制隐藏

#### Scenario: 无搜索时列玩家星区

- **前提** hub 选择菜单已打开
- **并且** 搜索框为空
- **当** 页面渲染菜单列表
- **那么** 菜单 SHALL 只列出玩家星区

#### Scenario: 搜索时遍历全地图

- **前提** hub 选择菜单已打开
- **当** 用户输入搜索关键字
- **那么** 菜单 SHALL 搜索全地图 sectors
- **并且** 结果 MAY 包含无玩家空间站的 sector

#### Scenario: 已是 hub anchor 的星区不可重复添加

- **前提** hub 选择菜单已打开
- **当** 某个 sector 已是任意 group 的 anchor
- **那么** 该 sector SHALL NOT 显示 `+` 按钮
- **并且** 该 sector SHALL NOT 可重复添加为 hub

#### Scenario: 新增 hub draft

- **前提** hub 选择菜单已打开
- **当** 用户点击 sector S 的 `+`
- **那么** 系统 SHALL 创建一个以 S 为 anchor 的新 GroupDraftInfo
- **并且** 新 group 的 `isPinned` SHALL 为 `true`
- **并且** 新 group SHALL 可删除

### Requirement: 基线快照

系统 SHALL 以点击 [编辑] 前的当前显示状态作为基线。baseline SHALL 只用于视觉区分、baseline group 删除限制和 [取消] 恢复，不提供 coverage 恢复/历史保留语义。

#### Scenario: 进入编辑态建立基线

- **前提** 用户处于计算结果态
- **当** 用户点击 [编辑]
- **那么** 系统 SHALL 快照当前 groups、coverage、isPinned、jumpRange 和 anchor
- **并且** 所有当前 group SHALL 设为 `isPinned: true`、`baseline: true`
- **并且** 后续 baseline 判断 SHALL 基于该快照

#### Scenario: baseline 视觉区分

- **前提** pill 对应 sector 来自 baseline coverage
- **当** 页面渲染该 pill
- **那么** pill SHALL 使用更粗边框
- **并且** baseline SHALL NOT 改变该 pill 的按钮行为

### Requirement: 统一 Pill 行

编辑态 SHALL 取消覆盖/候选/连接三 tab。每个 group SHALL 按 jump row 混排范围、候选和连接 pill。

#### Scenario: 同 row 混排

- **前提** group A 在同一跳数下同时存在范围、候选和连接对象
- **当** 页面渲染 group A
- **那么** 这些 pill SHALL 出现在同一个 jump row
- **并且** 系统 SHALL NOT 按类型拆成不同 row
- **并且** 系统 SHALL NOT 显示三 tab 切换

#### Scenario: 类型颜色

- **前提** 页面渲染统一 pill row
- **那么** 范围星区 SHALL 使用金色
- **并且** 候选星区 SHALL 使用半金色
- **并且** 连接星区 SHALL 使用绿色

#### Scenario: 玩家站视觉

- **前提** pill 对应 sector 有玩家空间站
- **当** 页面渲染该 pill
- **那么** pill SHALL 使用实心点或 station icon 标识

#### Scenario: 非玩家站视觉

- **前提** pill 对应 sector 没有玩家空间站
- **当** 页面渲染该 pill
- **那么** pill SHALL 使用空心点或淡色 station icon 标识

#### Scenario: 定位星区站状态

- **前提** group 有 anchor sector
- **当** 页面渲染定位星区 pill
- **那么** pill SHALL 显示 `●`（有玩家站）或 `○`（无玩家站）

#### Scenario: 候选包含非玩家星区

- **前提** group A 的 jumpRange 内存在非玩家星区
- **当** 页面渲染 group A 的统一 pill 行
- **那么** 该非玩家星区 SHALL 显示为半金候选 pill
- **并且** SHALL 显示空心点 `○`
- **并且** 若无其他 group 占用，SHALL 显示 `+` 按钮

#### Scenario: 非 pin hub 只读

- **前提** group A 的 `isPinned` 为 false
- **当** 页面渲染 group A 的统一 pill 行
- **那么** 所有范围/候选/连接 pill SHALL NOT 显示 `×`、`+` 或 `→` 按钮
- **并且** 定位星区跳数 SHALL NOT 可编辑

### Requirement: 范围与候选按钮行为

范围和候选 SHALL 使用同一界面编辑，按钮语义由当前归属状态决定。

#### Scenario: 当前 group 范围移出

- **前提** sector S 是 group A 的 active coverage
- **当** 用户点击 S 的 `×`
- **那么** S SHALL 不再作为 group A active coverage
- **并且** 若 S 仍应在 group A 显示，S SHALL 显示为半金候选

#### Scenario: jumpRange 扩大仅新增层级

- **前提** group A 的 jumpRange 从 2 改为 3
- **并且** 距离 3 的星区中，S 为玩家星区且不在其他 group active coverage
- **当** jumpRange 更新
- **那么** S SHALL 自动加入 group A 的 active coverage
- **并且** 距离 1-2 已有的覆盖和候选 SHALL NOT 变动

#### Scenario: 普通候选加入

- **前提** sector S 是 group A 的 candidate
- **并且** S 不在其他 group 的 active coverage 中
- **当** 用户点击 S 的 `+`
- **那么** S SHALL 加入 group A active coverage

#### Scenario: 从其他 group 转入

- **前提** sector S 是 group B 的 active coverage
- **并且** S 在 group A 中显示为 candidate
- **当** 页面渲染 group A 中的 S
- **那么** S 的按钮 SHALL 显示 `→`
- **当** 用户点击 `→`
- **那么** S SHALL 转入 group A active coverage
- **并且** S SHALL 从 group B active coverage 移出

#### Scenario: candidate 可多 group 共存

- **前提** sector S 只是 group B 的 candidate
- **并且** S 在 group A 中也是 candidate
- **当** 页面渲染 group A 中的 S
- **那么** S 的按钮 SHALL 显示普通 `+`
- **并且** 点击 `+` SHALL NOT 从 group B candidate 中移除 S

### Requirement: JumpRange 联动采用 MapBinding 语义

修改 group jumpRange 时，范围/候选联动 SHALL 对齐当前 MapBinding 的覆盖半径语义。baseline SHALL NOT 改变 coverage 移出或候选恢复规则。

#### Scenario: jumpRange 增大

- **前提** 用户把 group A 的 jumpRange 从 oldRange 调大到 newRange
- **当** 新范围内存在符合条件的玩家星区 S
- **那么** S SHALL 自动加入 group A active coverage
- **并且** S SHALL 显示为金色范围 pill

#### Scenario: jumpRange 缩小移出超范围 coverage

- **前提** sector S 是 group A 的 active coverage
- **当** group A 的 jumpRange 缩小到不再覆盖 S
- **那么** S SHALL 从 group A active coverage 移出
- **并且** 若 S 不再符合显示条件，S SHALL 从 group A 的 row 中消失

#### Scenario: baseline 不提供 jumpRange 恢复保护

- **前提** sector S 是 group A 的 baseline coverage
- **当** group A 的 jumpRange 缩小到不再覆盖 S
- **那么** S SHALL 按普通 coverage 规则从 group A active coverage 移出
- **并且** baseline SHALL NOT 要求 S 继续显示为可恢复候选或历史项

### Requirement: 连接星区行为

hub anchor SHALL 统一作为绿色连接 pill 显示。连接只由 `connectedGroupIds` 表达。

#### Scenario: 未连接 hub 可连接

- **前提** group B 是 hub group
- **并且** group A 到 group B 的 anchor 距离不超过 5 跳
- **并且** group A 的 `connectedGroupIds` 不包含 group B
- **当** 页面渲染 group A
- **那么** group B SHALL 显示为绿色连接候选 pill
- **并且** 按钮 SHALL 为 `+`

#### Scenario: 点击连接

- **前提** group B 是 group A 的绿色连接候选 pill
- **当** 用户点击 `+`
- **那么** group B 的 id SHALL 加入 group A 的 `connectedGroupIds`

#### Scenario: 点击断开

- **前提** group A 的 `connectedGroupIds` 包含 group B
- **当** 用户点击 group B 连接 pill 的 `×`
- **那么** group B 的 id SHALL 从 group A 的 `connectedGroupIds` 移除

#### Scenario: 连接编辑只影响计算输入

- **当** 用户编辑连接 `+/×`
- **那么** 编辑 SHALL NOT 立即调用 `computeGroupGraph()` 重算 MST
- **并且** [计算] SHALL 直接使用编辑后的 `connectedGroupIds`
- **并且** 系统 SHALL NOT 使用 `excludedDefaultConnectedGroupIds` 或 default-off 字段表达连接编辑
- **并且** connection SHALL NOT 按 baseline 区分行为

### Requirement: excludedDefaultAssignmentSectorMacros 仅作用于玩家星区

`excludedDefaultAssignmentSectorMacros` SHALL 只排除玩家星区的默认 assignment，不影响非玩家星区 coverage 保留。

#### Scenario: 玩家星区排除默认

- **前提** sector S 有玩家空间站
- **并且** S 存在于 group A 的 `excludedDefaultAssignmentSectorMacros`
- **当** 系统生成 Col 3 card
- **那么** group A SHALL NOT 作为 S 的默认选中项
- **并且** group A MAY 作为 S 的手动 option

#### Scenario: 非玩家星区不进入 excluded default

- **前提** sector S 没有玩家空间站
- **当** 系统构建 group A 的计算输入
- **那么** S SHALL NOT 进入 `excludedDefaultAssignmentSectorMacros`
- **并且** 若 S 是 group A coverage，S SHALL 在计算输入中保留

### Requirement: Col 3 card SHALL 展示所有命中范围 option

Col 3 每个玩家星区 card 的 options SHALL 包含所有当前范围命中 group，而不是只包含算法最终归类的唯一 group。

#### Scenario: hub anchor 不生成普通 card

- **前提** sector S 是任意 group 的 hub anchor
- **当** 系统生成 Col 3 assignments
- **那么** 系统 SHALL NOT 为 S 生成普通 assignment card

#### Scenario: 当前范围多 group 命中

- **前提** sector S 同时处于 group A 和 group B 的当前 jumpRange 覆盖范围内
- **当** 系统生成 S 的 card
- **那么** group A SHALL 成为 S 的 option
- **并且** group B SHALL 成为 S 的 option
- **并且** standalone SHALL 作为最后 option

#### Scenario: 最小扩展层 option

- **前提** sector S 未被任何 group 当前范围命中
- **并且** group A 扩展到 4 跳可命中 S
- **并且** group B 扩展到 4 跳可命中 S
- **并且** group C 扩展到 5 跳可命中 S
- **当** 系统生成 S 的 card
- **那么** group A SHALL 成为 S 的 option
- **并且** group B SHALL 成为 S 的 option
- **并且** group C SHALL NOT 成为 S 的 option
- **并且** S SHALL 没有默认选中项

#### Scenario: standalone 不作为自动兜底默认

- **前提** sector S 没有任何可默认 group option
- **当** 系统生成 S 的 card
- **那么** standalone SHALL 作为最后 option
- **并且** standalone SHALL NOT 自动默认选中
- **并且** 用户 SHALL 手动确认吸收或独立

### Requirement: 非玩家星区 hub SHALL 继承现有 transit hub 逻辑

新增 hub 使用无玩家空间站的 sector 时，确认提交 SHALL 沿用现有 `BindingSectorGroup.tradeStation` 逻辑。

#### Scenario: 确认非玩家星区 hub

- **前提** 用户新增 hub，其 anchor sector 没有玩家空间站
- **当** 用户点击 [确定] 写入分组
- **那么** 系统 SHALL 调用现有 sector group 写入路径
- **并且** `bindSectorGroup` SHALL 确保该 group 拥有 `tradeStation`
- **并且** 系统 SHALL NOT 新增虚拟 stationPlan
- **并且** 系统 SHALL NOT 修改 save archive 原始记录

#### Scenario: Live 页面继承 transit hub

- **前提** binding group 拥有 `tradeStation`
- **当** 用户进入 Live Production / transit 页面
- **那么** Live 页面 SHALL 通过 `BindingSectorGroup.tradeStation` 构建 transit hub
- **并且** 新增非玩家星区 hub SHALL 可作为 transit hub 展示

### Requirement: SectorConfirmBar 保留 Checkbox

SectorConfirmBar SHALL 在桥接和覆盖字段内各自嵌入「保留」checkbox。勾选时提交对应数据给 [计算]，取消时完全由算法自动生成。

#### Scenario: 保留 checkbox 嵌入字段内

- **前提** 处于编辑输入态
- **当** 页面渲染 SectorConfirmBar
- **那么** 桥接保留 SHALL 嵌入桥接字段区域内
- **并且** 覆盖保留 SHALL 嵌入覆盖字段区域内
- **并且** SHALL NOT 作为字段外独立控件
- **并且** 结果态 SHALL NOT 显示节点与保留 checkbox

#### Scenario: 保留默认勾选

- **前提** 进入编辑输入态
- **当** 页面渲染 SectorConfirmBar
- **那么** 桥接保留 SHALL 默认勾选
- **并且** 覆盖保留 SHALL 默认勾选

#### Scenario: 保留取消后全自动生成

- **前提** 用户在编辑态取消保留 checkbox
- **当** 用户点击 [计算]
- **那么** 系统 SHALL NOT 提交编辑中的 coverage / bridge 数据
- **并且** 算法 SHALL 完全自动生成 coverage 和 bridge

#### Scenario: 三态总控 indeterminate

- **前提** 部分 group 保留勾选、部分取消
- **当** 页面渲染 SectorConfirmBar 保留 checkbox
- **那么** 保留 checkbox SHALL 显示 indeterminate 态

### Requirement: Per-group 保留 Checkbox

每个 group SHALL 在 pin 按钮左边显示 `[覆盖☑]` `[连接☑]` checkbox，标签为「覆盖」「连接」。

#### Scenario: per-group checkbox 位置

- **前提** 处于编辑输入态
- **当** 页面渲染 group
- **那么** `[覆盖☑] [连接☑]` SHALL 显示在 pin 按钮左边
- **并且** 标签文字 SHALL 为「覆盖」和「连接」

#### Scenario: 未 pin 时 checkbox disabled

- **前提** group 的 `isPinned` 为 false
- **当** 页面渲染该 group
- **那么** 覆盖 checkbox SHALL 处于 disabled 状态
- **并且** 连接 checkbox SHALL 处于 disabled 状态

#### Scenario: 保留 toggle 纯 UI 不触发重算

- **当** 用户切换覆盖 checkbox 或连接 checkbox
- **那么** 切换 SHALL NOT 触发数据重算
- **并且** SHALL NOT 修改 coverage 或 connectedGroupIds 数据
- **并且** SHALL 仅为 v-show 控制的 UI 状态

#### Scenario: 覆盖保留关闭时 pill 只读

- **前提** group 的覆盖 checkbox 关闭
- **当** 页面渲染该 group
- **那么** coverage pill SHALL 保持显示但无 `×` 按钮
- **并且** candidate pill SHALL 保持显示但无 `+` 或 `→` 按钮
- **并且** 视觉效果 SHALL 与 unpin（isPinned=false）相同

#### Scenario: 连接保留关闭时 connected pill 只读

- **前提** group 的连接 checkbox 关闭
- **当** 页面渲染该 group
- **那么** connected pill SHALL 保持显示但无 `+` 或 `×` 按钮
- **并且** connected pill SHALL 始终可见，不受保留状态影响

### Requirement: Candidate Pill 编辑态可见性

候选 pill SHALL 仅在编辑态显示。计算结果态/只读态 SHALL NOT 显示候选 pill。

#### Scenario: 计算结果态不显示候选

- **前提** 处于计算结果态（非编辑态）
- **当** 页面渲染 group
- **那么** 候选 pill SHALL NOT 显示
- **并且** SHALL NOT 渲染 `+` 或 `→` 候选按钮

### Requirement: 菜单新增 Hub 默认 Pinned

通过 SectorHubAddMenu 菜单添加的 hub SHALL 默认 `isPinned: true`。

#### Scenario: 菜单新增 hub 默认 pinned

- **前提** hub 选择菜单已打开
- **当** 用户点击 sector S 的 `+`
- **那么** 新 group 的 `isPinned` SHALL 为 `true`
- **并且** 新 group 的 `baseline` SHALL 为 `false`
- **并且** 新 group SHALL 可删除

## MODIFIED Requirements

### Requirement: 重新计算状态 SHALL 简化为双态

`recalcState: 'normal' | 'pin' | 'exclude'` SHALL 替换为 `isPinned: boolean`。per-group exclude SHALL 移除。

#### Scenario: 已持久化或 baseline group 默认 pinned

- **前提** group 来自进入编辑前的当前显示状态
- **当** 进入编辑输入态
- **那么** `isPinned` SHALL 为 `true`

#### Scenario: 新建 group 默认 not pinned

- **前提** group 由 bridge 方案或算法自动生成
- **当** 新建 GroupDraftInfo
- **那么** `isPinned` SHALL 为 `false`

#### Scenario: 不再存在 recalcState 引用

- **当** 编译项目
- **那么** 不存在对 `recalcState` 的引用
- **并且** 所有三态 UI 逻辑 SHALL 已替换为双态

### Requirement: Auto Group 算法 SHALL 支持 generateHubs 参数

`groupCleanSlate` 和 `groupIncremental` SHALL 支持 `generateHubs: boolean` 参数。

#### Scenario: generateHubs=false

- **前提** 「节点」checkbox 未勾选
- **并且** 当前不是 clean slate 禁用节点 checkbox 场景
- **当** 运行自动分组
- **那么** 系统 SHALL 跳过新 pure hub 创建
- **并且** 系统 SHALL 仅使用已有 pinned hub、手动新增 hub 和 active 默认输入重算
