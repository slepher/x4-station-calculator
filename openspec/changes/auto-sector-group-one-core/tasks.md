# auto-sector-group-one-core Tasks

## 1. 核心状态模型

- [ ] 移除 `GroupDraftInfo.recalcState`，统一使用 `isPinned`
- [ ] 移除 per-group `exclude` 入口和算法分支
- [ ] 使用 `excludedDefaultAssignmentSectorMacros` 表达“可手动选但不默认”
- [ ] 删除 `disabledCoverageSectorMacros`、`excludedDefaultConnectedGroupIds` 和 bridge marker 持久化字段

## 2. Hub detection 与分组算法

- [ ] 保持 container-only 容量统计，并合并 `modules[]` 与 `constructions[]`
- [ ] 实现 pure hub、hub score、clean slate 和 incremental 的最终规则
- [ ] Clean slate 按 `generateHubs` 决定是否自动生成 pure hub
- [x] Incremental 先识别新/回归 pure hub，再决定 coverage / assignment 归属
- [ ] Sector 默认归属按距离、hub score、稳定 key 和 excluded default 规则决胜
- [ ] Incremental 使用每个既有 group 自己的 `jumpRange`
- [ ] 保持等距 score 差距小于 30% 的 unresolved assignment 规则
- [x] 保持超出覆盖跳数但 5 跳内的扩展吸收规则，超过 5 跳仅 standalone 且不默认选中

## 3. MST 与 bridge

- [ ] 构建排除单向 superhighway 的双向星区图
- [ ] Link 候选只包含 `distance <= bridgeSearchJumpRange` 的 anchor pairs
- [ ] `computeGroupGraph()` 支持 fixed connection edges
- [ ] Fixed edge 按 link 两端 retain 独立判定
- [ ] Kruskal MST 只补充缺失边，不删除 fixed edges
- [ ] Bridge unit 基于双向连通 component 生成
- [ ] 多 bridge plan gate ordinary assignments，单 bridge plan 自动采用
- [ ] Bridge group 作为普通 `BindingSectorGroup` 持久化

## 4. 编辑态与 pill

- [ ] 编辑态直接修改 shared draft，[退出] 只切回 result 模式
- [ ] Baseline groups 默认 pinned，unpin 后保留展示但不参与计算
- [ ] 手动新增 hub 可删除
- [ ] Sector group card 非编辑态展示 group、anchor、trade station、jump、pill rows、统计信息
- [ ] Sector group card 编辑态展示 retain、pin/unpin、jumpRange 和删除等输入控件
- [ ] Baseline/current diff 使用普通边框、加粗边框/侧边色块、虚线弱化等视觉标记
- [ ] 移除旧 coverage/candidate/connected 三 tab，改为统一 jump row
- [ ] 实现 coverage `×`、candidate `+`、transfer `→` 和 connected `+ / ×`
- [ ] 修改 connection 时双向同步 `connectedGroupIds`
- [ ] Card 中 coverage/jumpRange/transfer 变更后同步重建 affected assignments
- [ ] Hub 添加/删除后同步重建 affected assignments
- [ ] Assignment 同步保持既有 card 身份和排序

## 5. Assignment 与 confirm

- [ ] Hub anchor sector 不生成 ordinary assignment card
- [ ] 当前 coverage 命中的所有 groups 都成为 options
- [x] 扩展 options 只取 5 跳内最近距离层，且不默认选中
- [x] 超过 5 跳或无 hub 时生成 standalone-only unresolved assignment
- [ ] 无当前命中时处理 baseline 重新吸收或 standalone-only 默认规则
- [ ] Standalone 始终最后，且不作为自动 fallback
- [x] 显式 Standalone 选择按 `sectorMacro` upsert hub group，避免重复 append
- [ ] 用户选择 option 后不改变 card 身份和排序
- [ ] Confirm 按 UUID 优先、`sectorMacro` 兜底匹配 groups
- [ ] Confirm 后按最终 coverage 重分配 station plans
- [ ] Confirm 后按最终 groups 同步无 `saveStationCode` 的 virtual station plans
- [ ] Confirm 时仍未分组的 virtual station plans 不写回 binding
- [ ] Confirm 不通过 virtual station 同步流程修改带 `saveStationCode` 的 save station plans

## 6. Trade station

- [ ] 实现 trade station candidate 计算
- [ ] 实现 trade station 原始候选池：按 score 排序、保留 `isPureHub` / `qualified` 信息、不按 `requireQualified` 过滤、不在 store 层 top 5 截断
- [ ] 实现原始候选池零货舱规则：存在 `containerCap > 0` 时剔除 0；全部为 0 时保留
- [ ] presenter 基于原始候选池和 `containerThreshold` 生成展示候选，并在展示层执行 top 5 原则；展示候选池中存在 pure qualified 候选时，top 5 尽量保留最多 2 个 pure qualified 候选
- [ ] 原始候选池携带存档已生成的 `tag` / `factoryGroup` / `isHeadquarter` / `iconTag` 图标语义字段，候选池计算阶段不重新按模块或 construction 推导空间站类型
- [ ] Trade Station 候选列表使用 save station icon 映射渲染候选图标，以图标替代 radio 圆点；图标使用 sidebar 同款绿色染色，选中态使用绿色光晕；普通模式 24px，地图紧凑模式 20px，且不使用额外圆形背景
- [ ] 实现无玩家站 hub 的虚拟交易站默认值，以及候选默认选择规则
- [ ] Hub 添加时同步生成 trade station 候选和默认选择
- [ ] Hub 删除时同步移除 trade station draft 状态
- [ ] 实现 `tradeStationRetainEnabled` 与 `savedTradeStationCode`
- [ ] Confirm gate 覆盖 bridge、assignment、trade station 三类未决项
- [ ] Confirm 显式写入玩家站或虚拟站 trade station
- [ ] 虚拟交易站持久化时 `sectorMacro` 固定为 group hub sector
- [ ] 虚拟交易站 position 可来自 map draft 拖动结果
- [ ] 虚拟交易站拖动不得修改 group `sectorMacro`、coverage 或 station plan
- [ ] 防止旧 `hubStationCode` / fallback best station 逻辑覆盖用户选择

## 7. 构建验证

- [ ] 实现完成后运行 `npm run build`

## 8. Reachability 缓存与距离接入

- [x] 新增 `scripts/generate_sector_reachability.ts`
- [x] 使用 `getopts` 支持 `--version <version>` 和 `--help`
- [x] 解析版本到 `src/assets/x4_game_data/<folderName>/data/maps.json`
- [x] 复用现有 sector graph 构建逻辑，保持单向 superhighway 排除规则一致
- [x] 对所有地图 sector 生成 `0..5` 跳 reachability
- [x] 输出稳定排序的 `sector_reachability.json`
- [x] 打印版本、source 数量、target 数量、输出路径等生成统计
- [x] 增加 `SectorReachability` 类型定义
- [x] 在 `GameDataFiles` 中加入 `sectorReachability`
- [x] 在 `loadGameDataFiles()` 中加载 `sector_reachability.json`
- [x] 在 game data store 中暴露当前版本 reachability
- [x] 新增 reachability 查表 helper，统一返回 `number | null`
- [x] `buildAssignmentResult()` 改为使用 reachability 查距
- [x] standalone upsert 和派生 options 改为使用 reachability 查距
- [x] jumpRange 变更后的 assignment 重建改为使用 reachability 查距
- [x] `computeGroupGraph()` / MST 候选边改为使用 reachability 查距
- [x] confirm 写入 coverage entries 时使用 reachability 写入 jump
- [x] 移除 auto-sector-group assignment 路径中的重复运行时 BFS
- [x] presenter 从 game data store 读取 reachability 并传入领域函数
- [x] Sector group card 统一 pill 距离判断改为使用 reachability
- [x] 保持现有页面布局、按钮、card、pill 和 option 操作流程不变
- [x] 将 `jumpRange` 和 `bridgeSearchJumpRange` 的有效计算范围限制到 `0..5`
- [x] 运行 `vite-node scripts/generate_sector_reachability.ts --version 8.0`
- [x] 运行 `vite-node scripts/generate_sector_reachability.ts --version 9.0`
- [x] 检查两个版本均生成 `data/sector_reachability.json`
