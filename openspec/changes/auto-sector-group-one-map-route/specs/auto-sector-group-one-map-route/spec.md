# Auto Sector Group One Map Route Specification

## Purpose

本规格定义地图上 hub link route candidates 的预计算、全局单份 route cache、draft link 集合过滤、地图 overlay、路线染色和图层控制行为。该能力用于在 map binding-sector 编辑流程中直观看到当前 binding 的 sector group hub 间运输路径候选。

## ADDED Requirements

### Requirement: Live store SHALL maintain one global hub link route cache

系统 SHALL 在 live production store 中维护一份全局 hub link route cache；binding 与 draft 的 link 集合只决定哪些 route entries 被显示或消费。

#### Scenario: Missing binding routes are computed from persisted active binding

- **前提** 当前存在 active binding
- **并且** active binding 包含 sector groups 与 `connectedGroupIds`
- **当** live production store 初始化或 active binding 切换
- **那么** 系统 SHALL 基于 persisted `activeBinding.groups` 扫描当前 binding link keys
- **并且** 对全局 cache 中不存在的 link key 计算 hub link route 数据
- **并且** 每条 link route SHALL 使用两端 group 的 transit hub station 作为路径端点

#### Scenario: Draft links reuse global route cache

- **前提** binding-sector shared draft 已初始化
- **当** draft link 集合包含某个路径端点组合
- **那么** 系统 SHALL 从全局 route cache 读取该 link route
- **并且** 如果全局 cache 中不存在该端点路径 key，系统 SHALL 新计算并写入全局 cache

#### Scenario: Route cache key is based on endpoint sector and position

- **前提** 某条 hub link 两端 hub 分别位于 `sectorA + posA` 与 `sectorB + posB`
- **当** 系统生成全局 route cache key
- **那么** key SHALL 基于 `sectorA + posA + sectorB + posB`
- **并且** key SHALL NOT 只基于 group id
- **并且** A-B 与 B-A SHALL 规范化为同一 key

#### Scenario: Switching hub endpoint creates a new route key

- **前提** 全局 route cache 中已有某条 hub link 的路径数据
- **当** 用户切换该 link 任一端的 sector hub，导致 sector 或 position 变化
- **那么** 系统 SHALL 为新的 `sector + position` 端点组合生成新的 route key
- **并且** 旧 route entry SHALL 继续保留在全局 cache 中
- **并且** 如果当前 link 集合不再引用旧端点组合，旧 route SHALL NOT 显示

#### Scenario: Removing links does not delete cached routes

- **前提** binding-sector shared draft 已初始化
- **当** 用户删除某个 hub link
- **那么** 系统 SHALL 从当前 draft link 集合中移除该 link
- **并且** 系统 SHALL NOT 删除全局 route cache 中已存在的 route entry

#### Scenario: Link existence only controls visibility

- **前提** 全局 route cache 中存在某条 hub link route
- **当** 当前 binding 或 draft link 集合不包含该 link
- **那么** 地图 SHALL NOT 显示该 route
- **并且** transit hub SHALL NOT 将该 route 当作当前 link route 使用

#### Scenario: Route candidates use sector hub transport algorithm

- **前提** 系统为某条 hub link 预计算路径
- **当** 两端 hub station 坐标与 sector 可用
- **那么** 系统 SHALL 使用 `sector-hub-transport` route candidate 算法生成候选
- **并且** 候选 SHALL 保持 simple path、不重复 sector、gate jump 上限、gate/superhighway/highway/ring 与摘要口径一致

#### Scenario: Incomplete route candidates are excluded from map data

- **前提** route builder 为某条 hub link 返回候选
- **当** 某个候选包含 `problems`
- **那么** 该候选 SHALL NOT 进入地图 route overlay 数据
- **并且** 该问题 SHALL 继续可由 transit hub 运输栏的问题组表达

### Requirement: Transit hub Sector Group routes SHALL consume precomputed routes

transit hub 运输栏中 `Sector Group` link route SHALL 读取 live production store 预计算结果。

#### Scenario: Sector Group route uses store route candidates

- **前提** 用户处于 live transit hub 页面
- **并且** 当前 transit group 存在 linked sector group
- **当** presenter 组装 `Sector Group` route row
- **那么** presenter SHALL 从 live production store 读取该 link 的预计算 route candidates
- **并且** presenter SHALL NOT 为同一 hub link 重复调用 route builder 生成候选

#### Scenario: Station routes keep existing computation

- **前提** 用户处于 live transit hub 页面
- **当** presenter 组装 `Station` 分类到普通 station 的路径
- **那么** 系统 MAY 沿用现有 station route 计算方式
- **并且** 普通 station route 预计算不属于本变更要求

### Requirement: Map SHALL display hub link route overlay by filtering global cache

地图 SHALL 绘制 hub link route overlay，并在 binding-sector 页面用当前 draft link 集合过滤全局 route cache。普通地图模式 SHALL NOT 显示 persisted binding route overlay。

#### Scenario: Binding-sector page shows draft routes

- **前提** 地图处于 binding-sector 页面
- **并且** 当前 draft link 集合可用
- **当** 地图渲染 route overlay
- **那么** 系统 SHALL 显示 draft link 集合对应的 hub link route candidates
- **并且** 系统 SHALL 不显示 draft link 集合之外的 cached route

#### Scenario: Ordinary map hides persisted binding routes

- **前提** 地图不处于 binding-sector 页面
- **并且** 当前 active binding 存在 persisted hub links
- **当** 地图渲染 route overlay
- **那么** 系统 SHALL NOT 显示 persisted binding link 集合对应的 hub link route candidates

#### Scenario: Every valid candidate is drawn

- **前提** 某条 hub link 存在多条有效 route candidates
- **当** 地图渲染 hub link route overlay
- **那么** 系统 SHALL 绘制该 hub link 的全部有效候选星区路径
- **并且** 系统 SHALL NOT 只绘制最终最优路径
- **并且** 单个 candidate 在每个 sector 内部 SHALL 先聚合为进入点到离开点的一条 visual segment

### Requirement: Hub link routes SHALL render both endpoint group colors as a tight dual-track line

每条 hub link route SHALL 同时表达 link 两端 group 的 `color`。hub link 表达两个区域对象之间的无向连接，不是 source/target 流量，因此两端颜色 SHALL 平等显示。

#### Scenario: Route color uses both endpoint group colors

- **前提** hub link 两端 group 分别具有颜色 A 与颜色 B
- **当** 地图绘制该 link route
- **那么** route SHALL 同时使用颜色 A 与颜色 B
- **并且** SHALL NOT 只选择其中一端颜色
- **并且** SHALL NOT 生成 A 与 B 的混合中间色

#### Scenario: Dual-track route keeps solid tracks tightly connected

- **前提** hub link route 使用颜色 A 与颜色 B
- **当** 地图绘制该 route 的双轨 stroke
- **那么** 系统 SHALL 只绘制两条实色轨道
- **并且** 系统 SHALL NOT 绘制半透明 route 底层或外侧半透明边
- **并且** 视觉横截面 SHALL 呈现为 `实色 A | 实色 B`
- **并且** 两条实色轨道 SHALL 紧密连接，不保留可见空隙

#### Scenario: All candidates for the same link share endpoint color pair

- **前提** 某条 hub link 有多条有效 route candidates
- **当** 系统绘制这些候选
- **那么** 这些候选 SHALL 使用相同的两端 group color pair
- **并且** 系统 SHALL NOT 通过透明度降级表达候选优先级

#### Scenario: Missing endpoint group color uses fallback style

- **前提** link 任一端 group 没有 `color`
- **当** 地图绘制该 link route
- **那么** 系统 SHALL 为缺失颜色的一端使用稳定 fallback 样式绘制
- **并且** SHALL NOT 阻断其它 link route 绘制

### Requirement: Map hub link route overlay SHALL offset overlapping route lanes

地图 hub link route overlay SHALL 对重叠路线做稳定 lane 偏移，避免不同 hub link route 互相覆盖或压在地图原生连接线上。

#### Scenario: Different hub links sharing a base route segment use separate lanes

- **前提** 两条不同 hub link route 经过同一 gate、superhighway、ring-highway 或 sector-internal 基础通道
- **当** 地图渲染 route overlay
- **那么** 两条 route SHALL 使用不同 lane 绘制
- **并且** 后绘制 route SHALL NOT 完全覆盖先绘制 route

#### Scenario: Candidates from the same hub link share a lane on the same base segment

- **前提** 同一 hub link 的两条候选路线经过同一基础线路
- **当** 地图渲染 route overlay
- **那么** 两条候选在该基础线路上 SHALL 共用同一 lane
- **并且** 系统 SHALL NOT 仅因 candidate 不同而把同一 hub link 拆成多条并行 lane

#### Scenario: Same link candidates with the same sector entry and exit collapse

- **前提** 同一 hub link 的多条 candidate 在同一 sector 内具有相同进入点与离开点
- **当** 地图生成 route overlay rows
- **那么** 系统 SHALL 只生成一条该 sector 的可视 route row
- **并且** 原始 candidate 在该 sector 内部经过的中途 gate、highway 或 ring highway 不应生成额外 route row

#### Scenario: Different links with the same sector entry and exit remain visible

- **前提** 两条不同 hub link 在同一 sector 内具有相同进入点与离开点
- **当** 地图生成 route overlay rows
- **那么** 系统 SHALL 为两个 hub link 保留各自的可视 route row
- **并且** lane 分配 SHALL 将两条 route 分开显示

#### Scenario: Route lanes are offset from native map links

- **前提** 某条 hub link route 经过地图已有 gate、superhighway 或 ring-highway 连接
- **当** 地图渲染 route overlay
- **那么** route 主体 SHALL 相对原生连接偏移
- **并且** route SHALL NOT 完全压在原生连接线上

#### Scenario: Gate and native endpoint lanes collect at endpoints

- **前提** 某条 route segment 经过 gate、superhighway endpoint 或 sector 内部 A-B endpoint
- **当** 地图渲染该 segment
- **那么** route SHOULD 在 endpoint 处收束到真实连接点
- **并且** route MAY 从该 endpoint 重新展开到下一段 lane

#### Scenario: Sector-internal route segments render as direct endpoint channels

- **前提** 某条 candidate 在某个 sector 内部包含一个或多个 route builder segments
- **当** 地图渲染 route overlay
- **那么** 系统 SHALL 使用该 sector visit 的进入点到离开点直连通道绘制一条 visual segment
- **并且** 系统 SHALL NOT 绘制该 sector 内部的中途折线
- **并且** 系统 SHALL NOT 复用普通 highway spline 绘制该 route visual segment

#### Scenario: Ring highway gate-to-gate channels reserve the center lane

- **前提** 某个同 sector A-B 聚合通道的最终 gate-to-gate 端点与 `highwayRingChains` 中某个 hop 的 prev/next gate pair 重合
- **当** 地图渲染经过该 A-B 通道的 route overlay
- **那么** 该 A-B 通道 SHALL 视为原生 ring-highway 通道
- **并且** 系统 SHALL 将中线保留给原生环形高速
- **并且** 普通 sector-internal route 与 ring-highway route 在该通道中都 SHALL 使用偏移 lane
- **并且** route candidate 不必实际包含 ring highway segment 或 `highwayId`
- **并且** 如果最终 gate-to-gate 端点不重合，即使 route candidate 包含 ring highway segment 或 `highwayId`，也 SHALL NOT 触发 ring-highway 避让

#### Scenario: Non-ring highways do not reserve ring highway lanes

- **前提** 某个 sector 中存在 highway segment
- **并且** 该 highway segment 未命中 `highwayRingChains` 的 ring highway hop
- **当** 地图渲染 route overlay
- **那么** 该 segment SHALL 归入普通 sector-internal 通道
- **并且** 如果该通道只有一条 route，系统 MAY 使用中心线绘制

#### Scenario: Same link direct and ring alternatives collapse to one visible route

- **前提** 同一 hub link 在同一 sector 内部 A-B 通道同时存在普通直连候选与 ring-highway 候选
- **当** 地图生成 route overlay rows
- **那么** 系统 SHALL 只保留一条可视 route row
- **并且** 系统 SHALL 优先保留 ring-highway 的 lane 语义

### Requirement: Sector Group Links layer toggle SHALL NOT exist

地图图层控制 SHALL NOT 提供“星区组连接 / Sector Group Links”开关；hub link route overlay 仅由 binding-sector 界面状态激活。

#### Scenario: Ordinary map hides persisted routes

- **前提** 地图不处于 binding-sector 页面
- **当** 地图渲染 overlay
- **那么** hub link route overlay SHALL 不显示

#### Scenario: Map layer panel does not expose route toggle

- **前提** 用户打开地图图层控制
- **当** 系统渲染图层控制项
- **那么** 系统 SHALL NOT 显示“星区组连接 / Sector Group Links”开关

#### Scenario: Binding-sector shows draft routes

- **前提** 地图处于 binding-sector 页面
- **当** 地图渲染 overlay
- **那么** 系统 SHALL 显示当前 draft link 集合对应的 hub link route overlay

#### Scenario: Link add button does not focus sector

- **前提** 地图处于 binding-sector 或 auto sector group map 编辑界面
- **当** 用户点击 link 候选 pill 上的 `+` 按钮
- **那么** 系统 SHALL 只添加该 link
- **并且** SHALL NOT 因事件冒泡触发对应 sector focus

#### Scenario: Route overlay activation does not affect existing map structures

- **前提** hub link route overlay 激活或隐藏
- **当** 地图重新渲染
- **那么** 现有 gate、superhighway 与 highway ring gate 高亮 SHALL 不受 route overlay 激活条件影响
