# Auto Sector Group Core Cache Specification

## Purpose

定义 auto-sector-group 使用离线生成的 5 跳星区可达缓存的行为。缓存来自游戏数据生成阶段，运行时只查表，避免 assignment 和 pill 视图重复计算距离，同时保持现有页面显示和操作逻辑不变。

## ADDED Requirements

### Requirement: Generate Sector Reachability Cache

系统 MUST 提供 `scripts/` 下的 TypeScript 脚本，用于按游戏版本生成全图 5 跳星区可达缓存。

#### Scenario: Generate cache for a specific version

- **前提** 项目存在版本 `8.0` 对应的数据目录
- **当** 用户运行 `vite-node scripts/generate_sector_reachability.ts --version 8.0`
- **那么** 系统 SHALL 读取该版本的 `maps.json`
- **并且** SHALL 生成 `src/assets/x4_game_data/<folderName>/data/sector_reachability.json`
- **并且** 输出文件 SHALL 包含该版本地图中所有 sector macro 作为 source key

#### Scenario: Missing version argument

- **前提** 用户未提供 `--version`
- **当** 用户运行 reachability 生成脚本
- **那么** 系统 SHALL 打印 usage
- **并且** SHALL 以失败状态退出
- **并且** SHALL NOT 写入 `sector_reachability.json`

#### Scenario: Cache stores only five jumps

- **前提** 地图中 source sector `A` 到 target sector `B` 的最短距离为 6 跳
- **当** 系统生成 `sector_reachability.json`
- **那么** `sector_reachability.json` SHALL NOT 在 `A` 的 target map 中包含 `B`

#### Scenario: Non-player sectors are included

- **前提** 地图中存在没有玩家空间站的 sector `T`
- **当** 系统生成 `sector_reachability.json`
- **那么** `T` SHALL 作为 source key 存在
- **并且** `T` 的 5 跳内 target SHALL 可用于手动添加非玩家 hub 后的距离查表

#### Scenario: Single-direction superhighway is excluded

- **前提** `maps.json` 中存在 `sector_links.render.lane_count === 1` 的单向 superhighway
- **当** 系统生成 reachability 缓存
- **那么** 该 link SHALL NOT 被当作双向可达边
- **并且** 缓存中的距离 SHALL 与 auto-sector-group 的有效双向图语义一致

### Requirement: Load Reachability With Game Data

系统 MUST 将 `sector_reachability.json` 作为版本化 game data 加载。

#### Scenario: Game data load includes reachability

- **前提** 当前版本数据目录包含 `sector_reachability.json`
- **当** game data store 加载该版本数据
- **那么** store SHALL 暴露该版本的 sector reachability 数据
- **并且** auto-sector-group 计算 SHALL 能通过该数据查询 source 到 target 的跳数

#### Scenario: Missing reachability file fails explicitly

- **前提** 当前版本数据目录缺少 `sector_reachability.json`
- **当** game data store 加载该版本数据
- **那么** 系统 SHALL 报告缺失数据文件
- **并且** SHALL NOT 静默回退到旧的运行时 BFS 生成 assignment 距离

### Requirement: Use Cache For Assignment Options

系统 MUST 使用 reachability 缓存生成普通 assignment options。

#### Scenario: Current range hit uses cached distance

- **前提** group `G` 的 hub sector 到玩家 sector `S` 的缓存距离为 2
- **并且** `G.jumpRange` 为 2
- **当** 系统生成 `S` 的 assignment options
- **那么** `G` SHALL 作为当前覆盖命中的 absorb option 出现

#### Scenario: Extension option within five jumps

- **前提** group `G` 的 hub sector 到玩家 sector `S` 的缓存距离为 5
- **并且** `G.jumpRange` 小于 5
- **当** 系统生成 `S` 的 assignment options
- **那么** `G` SHALL 作为扩展 absorb option 出现
- **并且** 该 option SHALL NOT 默认选中

#### Scenario: No cache hit leaves standalone only

- **前提** `reachability[G.sectorMacro][S]` 不存在
- **并且** `S` 没有其他当前命中或 5 跳内扩展 group
- **当** 系统生成 `S` 的 assignment options
- **那么** options SHALL 仅包含 standalone
- **并且** `selectedOptionIndex` SHALL 为 `null`

#### Scenario: Existing assignment UI behavior is preserved

- **前提** 系统使用 reachability 缓存生成 assignment options
- **当** 用户查看和选择 assignment card
- **那么** card 排序、option 顺序、Standalone 最后一项、显式 Standalone 幂等行为 SHALL 与当前页面逻辑保持一致

### Requirement: Use Cache For Group Pills And Connections

系统 MUST 使用 reachability 缓存判断 group card 中的 candidate 和 connected candidate。

#### Scenario: Candidate pill uses cached distance

- **前提** group `G` 的 hub sector 到 sector `S` 的缓存距离小于等于 `G.jumpRange`
- **并且** `S` 不是任意 group anchor
- **当** 系统渲染编辑态 group card
- **那么** `S` SHALL 按现有规则显示为 candidate 或 coverage pill

#### Scenario: Connected candidate is limited to five jumps

- **前提** group `A` 到 group `B` 的缓存距离不存在
- **当** 系统渲染 connected candidate pill 或生成 MST 候选边
- **那么** `B` SHALL NOT 作为 `A` 的 5 跳内 connected candidate
- **并且** `A-B` SHALL NOT 作为自动 MST 候选边

### Requirement: Five Jump Domain Limit

系统 MUST 将 5 跳作为运输自动导航的领域上限。

#### Scenario: Effective range is clamped to five

- **前提** 已有持久化 group 的 `jumpRange` 大于 5
- **当** 系统执行 auto-sector-group 计算
- **那么** 计算 SHALL 按最大 5 跳处理该范围
- **并且** SHALL NOT 因该旧值生成 5 跳外 absorb option

#### Scenario: Bridge search does not exceed transport limit

- **前提** group anchor pair 的缓存距离不存在
- **当** 系统生成 connection 或 bridge 相关候选
- **那么** 该 pair SHALL 被视为超过运输自动导航能力
- **并且** SHALL NOT 自动写入普通 `connectedGroupIds`
