# auto-sector-group-one-core E2E Test Tasks

## 1 自动分组与连接

- [✓] 1.1 Clean slate 分组：覆盖 pure hub 生成 groups、coverage、assignments
  - [✓] 1.1.1 在 Live Production 绑定一个无已有 binding 的 save guid，触发自动星区划分
  - [✓] 1.1.2 验证 Col 1 出现 SectorGroupList，包含 pure hub 生成的 group cards
  - [✓] 1.1.3 验证 group card 显示 anchor sector pill、jumpRange、coverage 星区数和 uncertain 数量
  - [✓] 1.1.4 验证 Col 3 出现 ordinary assignment cards（非 anchor 玩家 sector）
  - [✓] 1.1.5 验证 resolved assignment cards 已有默认选中，unresolved 标记为需要用户选择

- [✓] 1.2 Incremental 分组：覆盖已有 binding groups 作为 baseline input，新玩家 sector 进入 assignment
  - [✓] 1.2.1 绑定已有 binding 的 save guid，触发增量分析
  - [✓] 1.2.2 验证已有 groups 作为 baseline 保留展示
  - [✓] 1.2.3 验证新增玩家 sector 出现 ordinary assignment card
  - [✓] 1.2.4 验证 baseline groups 保留原 jumpRange

- [✓] 1.3 hub detection 结果：覆盖 container-only 容量、constructions 合并、hub score 对默认归属的影响
  - [✓] 1.3.1 验证 hub 容量仅统计 container cargo（不包含 solid/liquid）
  - [✓] 1.3.2 验证在建模块 constructions[] 容量被合并计入 hub 容量
  - [✓] 1.3.3 验证 hub score 公式 `cap / (1 + ln(1 + prod_lines))` 影响默认归属选择
  - [✓] 1.3.4 验证等距且 hub score 差距小于 30% 的 sector 成为 unresolved assignment

- [✓] 1.4 MST connections：覆盖 group anchor 之间按 bridgeSearchJumpRange 生成 connected groups
  - [✓] 1.4.1 验证距离小于等于 bridgeSearchJumpRange 的 group anchor pair 可生成 connection
  - [✓] 1.4.2 验证距离大于 bridgeSearchJumpRange 的 pair 不进入 connected
  - [✓] 1.4.3 验证 connections 双向写入 connectedGroupIds

- [✓] 1.5 Bridge plan：覆盖多 bridge plan gate ordinary assignments，单 bridge plan 自动采用
  - [✓] 1.5.1 构建存在多个连通分量的测试场景
  - [✓] 1.5.2 验证多 bridge plan 时 Col 3 只显示 bridge plan cards，不显示 ordinary assignment cards
  - [✓] 1.5.3 选择 bridge plan 后验证创建 bridge draft groups 并显示 ordinary assignment cards
  - [✓] 1.5.4 构建仅有一个 bridge plan 的场景，验证自动采用

## 2 编辑态与 Assignment

- [✓] 2.1 非编辑态 group card：覆盖 group、anchor、trade station、jump、pill rows、统计信息展示
  - [✓] 2.1.1 验证非编辑态 group card 显示 group 名称
  - [✓] 2.1.2 验证显示 anchor sector pill（sector 名）
  - [✓] 2.1.3 验证已选 trade station 的 pill（玩家站显示 station code 和容量，虚拟站显示虚拟交易站文案）
  - [✓] 2.1.4 验证以只读值显示 jumpRange
  - [✓] 2.1.5 验证显示统一 jump rows 中 coverage/connected pills、覆盖星区数、uncertain 数量
  - [✓] 2.1.6 验证不显示 retain checkbox、pin/unpin 按钮、删除按钮、pill action 按钮

- [✓] 2.2 编辑态 group card：覆盖 retain、pin/unpin、jumpRange、pill 操作、删除按钮规则
  - [✓] 2.2.1 点击[编辑]进入编辑态，验证显示 connection、coverage、trade station 三个 retain checkbox
  - [✓] 2.2.2 验证 pinned group 的 jumpRange 可编辑，unpinned group 的 jumpRange 只读且 retain checkbox 禁用
  - [✓] 2.2.3 验证显示 pin/unpin 按钮，切换后 isPinned 状态变化
  - [✓] 2.2.4 验证只有 isNew=true 且 baseline=false 的 hub 显示删除按钮
  - [✓] 2.2.5 验证 baseline group unpin 后保留展示但不显示删除按钮
  - [✓] 2.2.6 验证[退出]编辑态后切回 result 模式，保留当前 draft

- [✓] 2.3 coverage 操作：覆盖 coverage `×`、candidate `+`、transfer `→` 后 affected assignments 同步
  - [✓] 2.3.1 点击 coverage pill 的 `×`，验证该 sector 从 active coverage 移出
  - [✓] 2.3.2 验证移出后 sector 若仍满足候选条件，显示为 candidate pill
  - [✓] 2.3.3 验证移出后该 sector 的 assignment card 重新生成 options 和默认值
  - [✓] 2.3.4 点击 candidate pill 的 `+`，验证 sector 加入 active coverage
  - [✓] 2.3.5 验证 transfer `→` 操作将 sector 从原 group 移出并加入目标 group
  - [✓] 2.3.6 验证以上操作后 existing assignment cards 保持身份和排序

- [✓] 2.4 jumpRange 操作：覆盖 jumpRange 变化后 coverage/candidate 与 assignment 状态同步
  - [✓] 2.4.1 增大 jumpRange，验证新增 distance 范围内的 sector 进入 coverage
  - [✓] 2.4.2 验证增大 jumpRange 不抢占其他 group active coverage 中的 sector
  - [✓] 2.4.3 缩小 jumpRange，验证超出范围的 sector 从 coverage 移出
  - [✓] 2.4.4 修改 jumpRange 后验证受影响 assignment cards 同步更新
  - [✓] 2.4.5 验证修改 jumpRange 不增删 connectedGroupIds

- [✓] 2.5 assignment options：覆盖当前命中、扩展 options、baseline 重新吸收、standalone 末位规则
  - [✓] 2.5.1 验证当前 coverage 命中的所有 groups 都成为 option
  - [✓] 2.5.2 验证无当前命中时只显示最小扩展距离层 groups 作为 option
  - [✓] 2.5.3 验证扩展 option 不默认选中
  - [✓] 2.5.4 验证无命中且无扩展时，baseline group 可作为重新吸收 option
  - [✓] 2.5.5 验证 standalone 始终作为最后一个 option
  - [✓] 2.5.6 验证 standalone 不作为自动 fallback 默认值

- [✓] 2.6 assignment 稳定性：覆盖用户选择后 card 身份和排序不变化
  - [✓] 2.6.1 选择某个 option 后验证 card 仍保持在原来的 displayBucket
  - [✓] 2.6.2 选择 option 后验证 card 在列表中的相对顺序不变
  - [✓] 2.6.3 选择 option 后验证其他 assignment cards 不受影响

## 3 Hub 添加/删除

- [✓] 3.1 already-anchor 禁止：覆盖已是任意 group anchor 的 sector 不可重复添加
  - [✓] 3.1.1 打开 hub 添加菜单，验证已是 anchor 的 sector 不可添加
  - [✓] 3.1.2 验证该 sector 菜单中不显示添加操作入口

- [✓] 3.2 添加玩家 sector hub：覆盖从其他 group active coverage 移除，并不再生成 ordinary assignment card
  - [✓] 3.2.1 在编辑态添加有玩家站的 sector 作为新 hub
  - [✓] 3.2.2 验证该 sector 从其他 group active coverage 中移除
  - [✓] 3.2.3 验证该 sector 不再有 ordinary assignment card
  - [✓] 3.2.4 验证新 group 自动生成 trade station 候选和默认选择
  - [✓] 3.2.5 验证 manual hub 的 trade station 展示候选来自统一原始候选池，不使用 qualified-only 分叉

- [✓] 3.3 添加非玩家 sector hub：覆盖不创建虚拟 stationPlan，默认使用 virtual trade station
  - [✓] 3.3.1 在 hub 添加菜单输入搜索条件，选择无玩家站的 sector 作为 hub
  - [✓] 3.3.2 验证创建 hub draft group 但未创建虚拟 stationPlan
  - [✓] 3.3.3 验证 trade station 默认设置为虚拟交易站
  - [✓] 3.3.4 验证未修改 save archive 原始记录

- [✓] 3.4 删除新 hub：覆盖移除 group、connections、trade station 状态，并重建 affected assignments
  - [✓] 3.4.1 删除 isNew=true 且 baseline=false 的 hub draft
  - [✓] 3.4.2 验证该 group 从 draft 中移除
  - [✓] 3.4.3 验证指向该 group 的 connectedGroupIds 被移除
  - [✓] 3.4.4 验证 trade station draft 状态被移除
  - [✓] 3.4.5 验证原 anchor/coverage 涉及的玩家 sector 重新进入 assignment 生成流程

- [✓] 3.5 orphan 清理：覆盖 hub 删除后不残留 orphan assignment、connection、trade station card 或重复 standalone group
  - [✓] 3.5.1 删除 group 后验证无残余的 assignment card 指向已删除 group
  - [✓] 3.5.2 验证其他 groups 的 connectedGroupIds 不包含已删除 group 的 id
  - [✓] 3.5.3 验证无残余的 trade station card
  - [✓] 3.5.4 验证无重复 standalone group

## 4 Trade Station

- [✓] 4.1 候选列表：覆盖原始候选池、presenter 展示筛选、top 5 保留 pure qualified、零货舱规则、无玩家站 hub
  - [✓] 4.1.1 验证原始候选池来自 anchor sector 内玩家站，按 score 排序，保留 `isPureHub` / `qualified` 信息且不做 top 5 截断
  - [✓] 4.1.2 验证存在 `containerCap > 0` 候选时剔除 `containerCap = 0`
  - [✓] 4.1.3 验证所有玩家站 `containerCap = 0` 时原始候选池保留这些站
  - [✓] 4.1.4 验证 presenter 按当前 `containerThreshold` 和 top 5 原则生成展示候选，并在存在 pure qualified 候选时尽量保留最多 2 个
  - [✓] 4.1.5 验证无玩家站 hub 候选仅包含虚拟交易站

- [✓] 4.2 默认值：覆盖 pure hub、混合候选、全生产站候选、无玩家站 virtual station 默认值
  - [✓] 4.2.1 验证最高分是 pure hub 时自动选中
  - [✓] 4.2.2 验证混合候选且第一名不是 pure hub 时无默认值（需手动选择）
  - [✓] 4.2.3 验证全生产站且第一名 score > 第二名 × 1.3 时自动选中第一名
  - [✓] 4.2.4 验证全生产站且差距不足时无默认值
  - [✓] 4.2.5 验证无玩家站 hub 默认选中虚拟交易站

- [✓] 4.3 retain：覆盖 trade station retain 启用时优先使用 saved code
  - [✓] 4.3.1 启用 trade station retain 后点击[计算]，验证首选使用 savedTradeStationCode
  - [✓] 4.3.2 验证 retain 启用后用户仍可在 TradeStation tab 手动更改

- [✓] 4.4 confirm gate：覆盖 bridge、assignment、trade station 三类未解决项阻断提交
  - [✓] 4.4.1 验证存在 unresolved assignment 时确认按钮 disabled
  - [✓] 4.4.2 验证存在 pending bridge decision 时确认按钮 disabled
  - [✓] 4.4.3 验证存在 unresolved trade station 时确认按钮 disabled
  - [✓] 4.4.4 验证所有未决项解决后确认按钮 enabled

- [✓] 4.5 持久化：覆盖玩家站与虚拟交易站写入 `BindingSectorGroup.tradeStation`
  - [✓] 4.5.1 确认后验证玩家站 trade station 的 saveStationCode 写入
  - [✓] 4.5.2 确认后验证虚拟交易站 saveStationCode 为 undefined
  - [✓] 4.5.3 验证虚拟交易站 position 和 sectorMacro 写入正确

- [✓] 4.6 virtual trade station 位置：覆盖 position 可来自 map draft，`sectorMacro` 固定为 group hub sector
  - [✓] 4.6.1 验证 virtual trade station 的 sectorMacro 等于所属 group hub sectorMacro
  - [✓] 4.6.2 拖动 virtual trade station 后验证 position 更新但不修改 group sectorMacro
  - [✓] 4.6.3 验证拖动不修改 coverage 或 station plan

## 5 Confirm 写入

- [✓] 5.1 group 匹配：覆盖 UUID 优先、`sectorMacro` 兜底匹配已有 group
  - [✓] 5.1.1 确认后验证按 UUID 优先匹配已有 group（更新而非新建）
  - [✓] 5.1.2 验证 UUID 不匹配时按 sectorMacro 兜底匹配

- [✓] 5.2 group 写入：覆盖 groups、coverage、connections、jumpRange、trade station 一次性写入一致
  - [✓] 5.2.1 确认后验证 groups 写入并持久化
  - [✓] 5.2.2 验证 coverageSectorMacros 与 draft coverage 一致
  - [✓] 5.2.3 验证 connectedGroupIds 与 draft connections 一致
  - [✓] 5.2.4 验证 jumpRange 写入与 draft 一致
  - [✓] 5.2.5 验证 trade station 写入与 draft 一致
  - [✓] 5.2.6 验证废弃 group 被移除

- [✓] 5.3 station plan 归属：覆盖 confirm 后按最终 coverage 重分配 station plans
  - [✓] 5.3.1 确认后验证 stationPlans 按最终 sector→groupId 映射重分配
  - [✓] 5.3.2 验证 Col 3 切换为 EmpireWareFlowsDashboard

- [✓] 5.4 virtual station plans：覆盖无 `saveStationCode` virtual station plans 同步，未分组不写回
  - [✓] 5.4.1 确认后验证无 saveStationCode 的虚拟站按最终 group 归属同步
  - [✓] 5.4.2 验证仍未分组的 virtual station plans 不写回 binding

- [✓] 5.5 save station 隔离：覆盖带 `saveStationCode` 的 station plans 不被 virtual station 同步修改
  - [✓] 5.5.1 确认后验证带 saveStationCode 的 station plans 未被虚拟站同步修改

## 6 回归风险

- [✓] 6.1 防止 solid/liquid cargo 被计入 hub 容量
  - [✓] 6.1.1 测试含 solid/liquid cargo 模块的 station，验证 hub 容量只统计 container

- [✓] 6.2 防止单向 superhighway 被当作双向 MST 边
  - [✓] 6.2.1 使用含 lane_count=1 的单向 superhighway 的 sector 数据，验证不生成双向 MST 边

- [✓] 6.3 防止 standalone 作为自动 fallback 默认值
  - [✓] 6.3.1 验证无命中无扩展无 baseline 的场景下，standalone 不作为默认选中

- [✓] 6.4 防止 baseline group unpin 后被物理删除
  - [✓] 6.4.1 unpin baseline group 后验证保留展示且未被物理删除
  - [✓] 6.4.2 验证 unpin 后 [计算] 不以该 group 作为输入

- [✓] 6.5 防止 connection retain 关闭后仍作为 fixed edge 输入
  - [✓] 6.5.1 两边 connectionRetainEnabled=false 后点击[计算]，验证旧 link 不作为 fixed edge

- [✓] 6.6 防止 `__virtual__` 写入持久化 `saveStationCode`
  - [✓] 6.6.1 选择虚拟交易站并确认后，验证持久化数据中 saveStationCode 不为 __virtual__

- [✓] 6.7 防止旧 `hubStationCode` 或 fallback best station 覆盖用户选择
  - [✓] 6.7.1 用户手动选择 trade station 后确认，验证未被旧逻辑覆盖

- [✓] 6.8 防止 5 跳外 group 生成 absorb option 或 connected candidate
  - [✓] 6.8.1 构造 reachability 查不到的 group-sector 距离，验证 assignment 只保留 standalone 或其他 5 跳内候选
  - [✓] 6.8.2 构造 reachability 查不到的 group anchor pair，验证不显示 connected candidate 且不进入 MST 候选边

- [✓] 6.9 防止 auto-sector-group assignment 路径回退到运行时重复 BFS
  - [✓] 6.9.1 验证 presenter 从 game data store 读取 reachability 并传入领域函数
  - [✓] 6.9.2 验证 assignment、pill、MST 距离判断使用 reachability helper
